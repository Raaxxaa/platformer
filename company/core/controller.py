"""The controller: a long-running loop that moves tasks through work -> checks -> review -> merge.

Two lanes run side by side so the GPU never waits on a review:
- the worker lane (parallel_workers threads) runs local models and the controller's checks;
- the review lane (one thread) runs the head's review and merges approved work.
All state is in the SQLite queue, so the loop can be stopped and restarted at any point.
"""
from __future__ import annotations

import json
import threading
import time
import traceback
from pathlib import Path

from . import gate, gitops, ollama, report, review, worker
from .config import Config
from .store import Store, Task

STOP_FILE = "STOP"


class Controller:
    def __init__(self, cfg: Config, log=print):
        self.cfg = cfg
        self.store = Store(cfg.state_dir / "queue.db")
        self.log = log
        self._busy: set[str] = set()
        self._lock = threading.Lock()

    # ---------- paths ----------
    def worktree(self, t: Task) -> Path:
        return self.cfg.worktree_dir / t.id

    def report_dir(self, t: Task, attempt: int | None = None) -> Path:
        return self.cfg.state_dir / "reports" / t.id / f"attempt-{attempt or t.attempt}"

    def event(self, t: Task | None, kind: str, msg: str) -> None:
        self.store.log(t.id if t else None, kind, msg)
        self.log(f"[{t.id if t else '-'}] {kind}: {msg}")
        self.write_digest()

    # ---------- startup ----------
    def recover(self) -> None:
        for t in self.store.all(("working", "gating")):
            self.store.update(t.id, status="queued", attempt=max(0, t.attempt - 1))
            self.event(t, "recovered", f"was {t.status} when the controller stopped; requeued")

    # ---------- worker lane ----------
    def work(self, t: Task) -> None:
        cfg, s = self.cfg, self.store
        wt = self.worktree(t)
        host = cfg.data["ollama"]["host"]
        try:
            if not ollama.has_model(host, cfg.model_for(t.role)):
                return self.escalate(t, f"The model {cfg.model_for(t.role)} is not installed in Ollama. "
                                        "Run `company setup` (or `ollama pull` it), then `company task retry`.")
        except ollama.OllamaError:
            # Not the task's fault: put it back without using up an attempt, and wait.
            s.update(t.id, status="queued", attempt=max(0, t.attempt - 1))
            self.event(t, "waiting", "Ollama is not running; will try again")
            time.sleep(cfg.limit("poll_seconds"))
            return
        if t.role == "planner":
            return self.plan(t)
        if t.attempt == 1 or not wt.exists():
            branch = f"work/{t.id.lower()}-{t.slug}"
            base = gitops.create_worktree(cfg, branch, wt)
            gitops.ensure_node_modules(cfg, wt)
            t = s.update(t.id, branch=branch, worktree=str(wt), base_sha=base)
        self.event(t, "working", f"attempt {t.attempt} with {cfg.model_for(t.role)}")
        rdir = self.report_dir(t)
        info = worker.run_attempt(cfg, t, wt, rdir / "worker")
        notes = gitops.clean_scratch(wt)
        t = s.update(t.id, status="gating")
        files = gitops.changed_files(wt)
        t0 = time.time()
        steps = gate.run_gate(cfg, wt, files, t.role) if files else []
        shots = gate.collect_screenshots(wt, rdir / "screenshots", t0)
        rep = report.build(cfg, t, rdir, files=files, diff=gitops.diff(wt, t.base_sha),
                           diffstat=gitops.diffstat(wt, t.base_sha), steps=steps, screenshots=shots,
                           notes=notes, worker_info=info)
        ok = rep["checks"]["passed"]
        self.event(t, "report", f"{len(files)} files changed, checks {'passed' if ok else 'FAILED'}")
        attempts_left = t.attempt < cfg.limit("max_attempts")
        if not files and attempts_left:
            return self.requeue(t, "You did not change any files. Do the task described above.")
        if files and not ok and attempts_left:
            # Cheap path: the checks already say what is wrong, so the worker retries without a head review.
            return self.requeue(t, "The controller's checks failed:\n\n" + gate.failures_text(steps))
        s.update(t.id, status="reviewing")

    def requeue(self, t: Task, feedback: str) -> None:
        self.store.update(t.id, status="queued", feedback=feedback)
        self.event(t, "retry", f"attempt {t.attempt} sent back to the worker")

    def plan(self, t: Task) -> None:
        rdir = self.report_dir(t)
        rdir.mkdir(parents=True, exist_ok=True)
        try:
            proposal = worker.plan(self.cfg, t)
        except Exception as e:
            self.store.update(t.id, status="escalated", feedback=f"Planner failed: {e}")
            return self.event(t, "escalated", f"planner failed: {e}")
        (rdir / "plan.json").write_text(json.dumps(proposal, indent=2), encoding="utf-8")
        n = len(proposal.get("tasks", []))
        self.store.update(t.id, status="waiting",
                          feedback=f"Plan with {n} tasks is ready. The head checks it with "
                                   f"`company plan show {t.id}` and queues it with `company plan accept {t.id}`.")
        self.event(t, "plan-ready", f"{n} proposed tasks waiting for the head")

    # ---------- review lane ----------
    def review(self, t: Task) -> None:
        cfg, s = self.cfg, self.store
        wt = Path(t.worktree)
        rdir = self.report_dir(t)
        steps = [gate.Step(**x) for x in json.loads((rdir / "gate.json").read_text(encoding="utf-8"))]
        self.event(t, "reviewing", "the head is reviewing")
        v = review.run_review(cfg, t, wt, rdir, steps)
        (rdir / "review.json").write_text(json.dumps(v, indent=2), encoding="utf-8")
        self.event(t, f"verdict:{v['verdict']}", v["summary"])
        verdict = v["verdict"]
        if verdict == "fixed":
            files = gitops.changed_files(wt)
            steps = gate.run_gate(cfg, wt, files, t.role)
            (rdir / "gate.after-fix.json").write_text(json.dumps(gate.to_json(steps), indent=2), encoding="utf-8")
            if not gate.passed(steps):
                return self.escalate(t, "The head fixed the work, but the checks still fail:\n"
                                     + gate.failures_text(steps))
            verdict = "approve"
        if verdict == "approve":
            s.update(t.id, status="merging")
            return self.finish(s.get(t.id), v)
        if verdict == "changes_requested" and t.attempt < cfg.limit("max_attempts"):
            return self.requeue(t, v.get("instructions") or v["summary"])
        self.escalate(t, v.get("user_note") or v.get("instructions") or v["summary"])

    def escalate(self, t: Task, note: str) -> None:
        self.store.update(t.id, status="escalated", feedback=note)
        self.event(t, "escalated", note.splitlines()[0][:200] if note else "needs a decision")

    def finish(self, t: Task, v: dict) -> None:
        """Commit, bring up to date with main, re-check if main moved, push, and merge per policy."""
        cfg, s = self.cfg, self.store
        wt = Path(t.worktree)
        rdir = self.report_dir(t)
        head = gitops.git(cfg, "rev-parse", "HEAD", cwd=wt)
        if head == t.base_sha:
            title = (v.get("commit_message") or t.title).strip().splitlines()[0][:72]
            body = f"{title}\n\nTask {t.id} ({t.role}), attempt {t.attempt}.\n\n{v.get('summary', '')}\n\n" \
                   f"Worked by a local model ({cfg.model_for(t.role)}); reviewed and approved by the head (Claude)."
            gitops.commit_all(wt, body)
        if not gitops.rebase_on_main(cfg, wt):
            return self.escalate(t, "Approved, but it conflicts with newer work on main. The head should "
                                    "redo the merge by hand or recreate the task.")
        if gitops.git(cfg, "rev-parse", "HEAD~1", cwd=wt) != t.base_sha:
            # Main moved while this was being worked on: the rebased result must pass again.
            steps = gate.run_gate(cfg, wt, gitops.git(cfg, "diff", "--name-only", "HEAD~1", cwd=wt).split(), t.role)
            if not gate.passed(steps):
                return self.escalate(t, "Approved, but after updating to the latest main the checks fail:\n"
                                     + gate.failures_text(steps))
        mode = cfg.data["merge"]["high_risk_mode"] if t.risk == "high" else cfg.data["merge"]["mode"]
        if mode in ("auto", "pr") and not gitops.gh_available():
            mode = "local" if mode == "auto" else "pr-missing-gh"
        if mode == "pr-missing-gh":
            return self.escalate(t, "Approved and committed on branch " + t.branch +
                                 ", but GitHub's CLI (gh) is not logged in, so no pull request was opened.")
        if mode == "local":
            gitops.merge_local(cfg, wt, t.branch)
            return self.done(t, "merged into main")
        gitops.push_branch(cfg, wt, t.branch)
        pr = t.pr_url or gitops.open_pr(cfg, wt, t.branch, (v.get("commit_message") or t.title)[:72],
                                        rdir / "report.md")
        s.update(t.id, pr_url=pr)
        if mode == "pr":
            s.update(t.id, status="waiting", feedback=f"Pull request ready for a person to merge: {pr}")
            return self.event(t, "pr-open", pr)
        if cfg.data["merge"].get("wait_for_ci", True) and gitops.has_ci(cfg):
            if not gitops.wait_checks(wt, pr):
                return self.escalate(t, f"CI failed on the pull request {pr}.")
        gitops.merge_pr(wt, pr)
        self.done(t, f"merged {pr}")

    def done(self, t: Task, how: str) -> None:
        self.store.update(t.id, status="done")
        gitops.remove_worktree(self.cfg, Path(t.worktree))
        self.event(t, "done", how)

    # ---------- loop ----------
    def _guard(self, fn, t: Task) -> None:
        try:
            fn(t)
        except Exception as e:
            err = "".join(traceback.format_exception_only(type(e), e)).strip()
            (self.cfg.state_dir / "reports" / t.id).mkdir(parents=True, exist_ok=True)
            (self.cfg.state_dir / "reports" / t.id / "crash.txt").write_text(traceback.format_exc(), encoding="utf-8")
            self.escalate(self.store.get(t.id), f"The controller hit an error: {err}")
        finally:
            with self._lock:
                self._busy.discard(t.id)

    def _start(self, fn, t: Task) -> threading.Thread:
        with self._lock:
            self._busy.add(t.id)
        th = threading.Thread(target=self._guard, args=(fn, t), name=f"{fn.__name__}-{t.id}", daemon=True)
        th.start()
        return th

    def tick(self) -> list[threading.Thread]:
        started = []
        with self._lock:
            busy = set(self._busy)
        working = [i for i in busy if self.store.get(i).status in ("working", "gating")]
        if not any(self.store.get(i).status in ("reviewing", "merging") for i in busy):
            for t in self.store.all(("reviewing", "merging")):
                if t.id not in busy:
                    started.append(self._start(self.review if t.status == "reviewing" else
                                               (lambda x: self.finish(x, {})), t))
                    break
        while len(working) < self.cfg.limit("parallel_workers"):
            t = self.store.claim_next()
            if not t:
                break
            working.append(t.id)
            started.append(self._start(self.work, t))
        return started

    def idle(self) -> bool:
        with self._lock:
            if self._busy:
                return False
        return not self.store.all(("queued", "reviewing", "merging"))

    def run(self, once: bool = False) -> None:
        self.recover()
        self.event(None, "controller", "started")
        stop = self.cfg.state_dir / STOP_FILE
        while True:
            if stop.exists():
                if not self._busy:
                    stop.unlink()
                    self.event(None, "controller", "stopped (STOP file)")
                    return
            else:
                self.tick()
            if once and self.idle():
                self.event(None, "controller", "queue empty, exiting")
                return
            time.sleep(1 if once else self.cfg.limit("poll_seconds"))

    # ---------- digest for the head and for you ----------
    def write_digest(self) -> None:
        tasks = self.store.all()
        by: dict[str, list[Task]] = {}
        for t in tasks:
            by.setdefault(t.status, []).append(t)
        lines = ["# Company status", "", " · ".join(f"{k}: {len(v)}" for k, v in sorted(by.items())) or "No tasks yet.", ""]
        for title, key in (("Needs a decision", "escalated"), ("Waiting", "waiting"), ("In progress", None),
                           ("Queued", "queued"), ("Recently done", "done")):
            group = by.get(key, []) if key else [t for t in tasks if t.status in ("working", "gating", "reviewing", "merging")]
            if key == "done":
                group = sorted(group, key=lambda t: -t.updated)[:10]
            if group:
                lines.append(f"## {title}")
                for t in group:
                    extra = f" — {t.feedback.splitlines()[0][:160]}" if key in ("escalated", "waiting") and t.feedback else ""
                    pr = f" ({t.pr_url})" if t.pr_url else ""
                    lines.append(f"- **{t.id}** [{t.role}, {t.status}, attempt {t.attempt}] {t.title}{pr}{extra}")
                lines.append("")
        lines.append("## Last events")
        for e in self.store.events(limit=20):
            lines.append(f"- {time.strftime('%m-%d %H:%M', time.localtime(e['ts']))} {e['task_id'] or '-'} "
                         f"{e['kind']}: {e['message'][:160]}")
        (self.cfg.state_dir / "digest.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
