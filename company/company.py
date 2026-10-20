#!/usr/bin/env python3
"""RUSHBLADE company: a Claude head that manages local Ollama workers.

    python company/company.py doctor          check that everything is installed
    python company/company.py setup           pick models for this machine and pull them
    python company/company.py run             start the controller (leave it running)
    python company/company.py status          what is happening
    python company/company.py task add ...    queue work (the head does this)
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from core import config as config_mod  # noqa: E402
from core import gitops, hardware, ollama  # noqa: E402
from core.controller import STOP_FILE, Controller  # noqa: E402
from core.store import Store, Task  # noqa: E402


def repo_root() -> Path:
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=HERE, capture_output=True,
                             text=True, check=True).stdout.strip()
        return Path(out)
    except (subprocess.CalledProcessError, FileNotFoundError):
        return HERE.parent


def ctx():
    cfg = config_mod.load(repo_root())
    return cfg, Store(cfg.state_dir / "queue.db")


# ---------------- doctor / setup ----------------
def cmd_doctor(a) -> int:
    cfg, _ = ctx()
    ok = True

    def check(name: str, good: bool, fix: str = "") -> None:
        nonlocal ok
        ok &= good
        print(f"  {'OK ' if good else 'NO '} {name}" + ("" if good else f"\n       → {fix}"))

    print("Tools")
    check(f"Python {sys.version.split()[0]} (3.11+)", sys.version_info >= (3, 11), "Install Python 3.11 or newer.")
    for exe, fix in (("git", "Install Git."), ("node", "Install Node.js 22."), ("npm", "Install Node.js 22."),
                     ("ollama", "Install Ollama from https://ollama.com."),
                     ("aider", "Run: python -m pip install aider-install && aider-install"),
                     (cfg.data["review"]["command"], "Install Claude Code and log in (`claude`).")):
        check(exe, shutil.which(exe) is not None, fix)
    check("gh (GitHub CLI, logged in)", gitops.gh_available(),
          "Install GitHub CLI and run `gh auth login` (without it, approved work is merged with plain git).")
    print("Repo")
    check("node_modules installed", (cfg.root / "node_modules").exists(), "Run `npm install` in the repo.")
    try:
        gitops.fetch_main(cfg)
        check(f"can fetch {cfg.remote}/{cfg.main_branch}", True)
    except Exception as e:
        check("can fetch the remote", False, str(e).splitlines()[0])
    print("Ollama")
    host = cfg.data["ollama"]["host"]
    try:
        have = ollama.models(host)
        check(f"Ollama running at {host}", True)
        for key, name in cfg.data["models"].items():
            check(f"model {name} ({key})", name in have or f"{name}:latest" in have,
                  f"Run: ollama pull {name}   (or `company setup`)")
    except ollama.OllamaError as e:
        check("Ollama running", False, f"Start Ollama. ({e})")
    gb, how = hardware.model_memory_gb()
    print(f"Hardware: {how}")
    print("\nAll good." if ok else "\nFix the NO lines above, then run doctor again.")
    return 0 if ok else 1


def cmd_setup(a) -> int:
    cfg, _ = ctx()
    gb, how = hardware.model_memory_gb()
    rec = hardware.recommend(gb if a.gb is None else a.gb)
    print(f"Found: {how}\n{rec['note']}")
    models = {"coder": rec["coder"], "planner": rec["planner"], "summary": rec["summary"]}
    for k, v in models.items():
        print(f"  {k:8} {v}")
    path = config_mod.write_local(cfg.root, {"models": models, "ollama": {"num_ctx": rec["num_ctx"]}})
    print(f"Saved to {path}")
    if a.no_pull:
        return 0
    for name in sorted(set(models.values())):
        print(f"Pulling {name} (this can take a while the first time)…")
        if subprocess.run(["ollama", "pull", name]).returncode != 0:
            print(f"Could not pull {name}. Is Ollama running?")
            return 1
    return 0


# ---------------- tasks ----------------
def _read_body(a) -> str:
    if a.file:
        return Path(a.file).read_text(encoding="utf-8")
    if a.body:
        return a.body
    if not sys.stdin.isatty():
        return sys.stdin.read()
    raise SystemExit("Give the task text with --body, --file, or on stdin.")


def cmd_task_add(a) -> int:
    cfg, store = ctx()
    cfg.role(a.role)
    t = store.add(Task(id="", title=a.title, role=a.role, body=_read_body(a).strip(),
                       acceptance=a.accept or [], reads=a.read or [], edits=a.edit or [],
                       priority=a.priority, risk=a.risk, depends=a.depends or [], source=a.source))
    print(t.id)
    Controller(cfg, log=lambda *_: None).write_digest()
    return 0


def cmd_task_list(a) -> int:
    _, store = ctx()
    for t in store.all(tuple(a.status) if a.status else None):
        print(f"{t.id}  {t.status:10} {t.role:7} p{t.priority:<3} a{t.attempt}  {t.title}"
              + (f"  {t.pr_url}" if t.pr_url else ""))
    return 0


def cmd_task_show(a) -> int:
    cfg, store = ctx()
    t = store.get(a.id)
    print(json.dumps({k: v for k, v in t.__dict__.items()}, indent=2, default=str))
    rd = cfg.state_dir / "reports" / t.id
    if rd.exists():
        print(f"\nReports: {rd}")
        for d in sorted(rd.iterdir()):
            print(f"  {d.name}")
    print("\nEvents:")
    for e in store.events(t.id):
        print(f"  {e['kind']}: {e['message'][:300]}")
    return 0


def cmd_task_retry(a) -> int:
    cfg, store = ctx()
    t = store.get(a.id)
    fields = {"status": "queued"}
    if a.feedback:
        fields["feedback"] = a.feedback
    if a.fresh:
        if t.worktree:
            gitops.remove_worktree(cfg, Path(t.worktree))
        fields.update(attempt=0, worktree=None)
    elif a.more_attempts:
        fields["attempt"] = max(0, t.attempt - a.more_attempts)
    store.update(t.id, **fields)
    store.log(t.id, "retry", "requeued by the head" + (" (fresh worktree)" if a.fresh else ""))
    print(f"{t.id} queued")
    return 0


def cmd_task_cancel(a) -> int:
    cfg, store = ctx()
    t = store.get(a.id)
    if t.worktree and not a.keep:
        gitops.remove_worktree(cfg, Path(t.worktree))
    store.update(t.id, status="cancelled")
    store.log(t.id, "cancelled", a.reason or "cancelled by the head")
    print(f"{t.id} cancelled")
    return 0


def cmd_task_approve(a) -> int:
    """The head approves by hand (e.g. after fixing an escalated task itself in the worktree)."""
    cfg, store = ctx()
    t = store.get(a.id)
    if not t.worktree or not Path(t.worktree).exists():
        raise SystemExit("That task has no worktree to merge.")
    store.update(t.id, status="merging")
    store.log(t.id, "approved", a.message or "approved by the head")
    if a.now:
        Controller(cfg).finish(store.get(t.id), {"commit_message": a.message or t.title, "summary": "Approved by the head."})
    else:
        print("Marked for merge; the running controller will merge it.")
    return 0


# ---------------- planner output ----------------
def _plan(cfg, t) -> dict:
    p = cfg.state_dir / "reports" / t.id / f"attempt-{t.attempt}" / "plan.json"
    if not p.exists():
        raise SystemExit("No plan for that task yet.")
    return json.loads(p.read_text(encoding="utf-8"))


def cmd_plan_show(a) -> int:
    cfg, store = ctx()
    print(json.dumps(_plan(cfg, store.get(a.id)), indent=2))
    return 0


def cmd_plan_accept(a) -> int:
    """Queues the planner's tasks (after the head has read and, if needed, edited plan.json)."""
    cfg, store = ctx()
    t = store.get(a.id)
    tasks = _plan(cfg, t).get("tasks", [])
    ids: list[str] = []
    for i, p in enumerate(tasks, 1):
        if a.only and i not in a.only:
            ids.append("")
            continue
        role = p.get("role", "core")
        cfg.role(role)
        deps = [ids[d - 1] for d in p.get("depends", []) if 0 < d <= len(ids) and ids[d - 1]]
        nt = store.add(Task(id="", title=p["title"], role=role, body=p.get("body", ""),
                            acceptance=p.get("acceptance", []), reads=p.get("reads", []), edits=p.get("edits", []),
                            depends=deps, risk=p.get("risk", "low"), priority=t.priority, source=f"plan:{t.id}"))
        ids.append(nt.id)
        print(f"{nt.id}  {nt.title}")
    store.update(t.id, status="done")
    return 0


# ---------------- running ----------------
def cmd_run(a) -> int:
    cfg, _ = ctx()
    (cfg.state_dir / STOP_FILE).unlink(missing_ok=True)
    Controller(cfg).run(once=a.once)
    return 0


def cmd_stop(a) -> int:
    cfg, _ = ctx()
    (cfg.state_dir / STOP_FILE).write_text("stop\n")
    print("The controller will stop after the work in progress finishes.")
    return 0


def cmd_status(a) -> int:
    cfg, _ = ctx()
    Controller(cfg, log=lambda *_: None).write_digest()
    print((cfg.state_dir / "digest.md").read_text(encoding="utf-8"))
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="company", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("doctor").set_defaults(fn=cmd_doctor)
    sp = sub.add_parser("setup")
    sp.add_argument("--gb", type=float, help="override the detected model memory (GB)")
    sp.add_argument("--no-pull", action="store_true")
    sp.set_defaults(fn=cmd_setup)
    rp = sub.add_parser("run")
    rp.add_argument("--once", action="store_true", help="exit when the queue is empty")
    rp.set_defaults(fn=cmd_run)
    sub.add_parser("stop").set_defaults(fn=cmd_stop)
    sub.add_parser("status").set_defaults(fn=cmd_status)

    tp = sub.add_parser("task").add_subparsers(dest="tcmd", required=True)
    ta = tp.add_parser("add")
    ta.add_argument("--title", required=True)
    ta.add_argument("--role", required=True)
    ta.add_argument("--body")
    ta.add_argument("--file")
    ta.add_argument("--accept", action="append", help="an acceptance check (repeat)")
    ta.add_argument("--read", action="append", help="a file the worker should read (repeat)")
    ta.add_argument("--edit", action="append", help="a file the worker will probably edit (repeat)")
    ta.add_argument("--depends", action="append", help="a task id that must be done first (repeat)")
    ta.add_argument("--priority", type=int, default=50)
    ta.add_argument("--risk", choices=["low", "high"], default="low")
    ta.add_argument("--source", default="head")
    ta.set_defaults(fn=cmd_task_add)
    tl = tp.add_parser("list")
    tl.add_argument("--status", action="append")
    tl.set_defaults(fn=cmd_task_list)
    ts = tp.add_parser("show")
    ts.add_argument("id")
    ts.set_defaults(fn=cmd_task_show)
    tr = tp.add_parser("retry")
    tr.add_argument("id")
    tr.add_argument("--feedback")
    tr.add_argument("--fresh", action="store_true", help="throw away the worktree and start over")
    tr.add_argument("--more-attempts", type=int, default=1)
    tr.set_defaults(fn=cmd_task_retry)
    tc = tp.add_parser("cancel")
    tc.add_argument("id")
    tc.add_argument("--reason")
    tc.add_argument("--keep", action="store_true", help="keep the worktree")
    tc.set_defaults(fn=cmd_task_cancel)
    tv = tp.add_parser("approve")
    tv.add_argument("id")
    tv.add_argument("--message")
    tv.add_argument("--now", action="store_true", help="merge immediately instead of leaving it to the controller")
    tv.set_defaults(fn=cmd_task_approve)

    pp = sub.add_parser("plan").add_subparsers(dest="pcmd", required=True)
    ps = pp.add_parser("show")
    ps.add_argument("id")
    ps.set_defaults(fn=cmd_plan_show)
    pa = pp.add_parser("accept")
    pa.add_argument("id")
    pa.add_argument("--only", type=int, action="append", help="queue only these task numbers (repeat)")
    pa.set_defaults(fn=cmd_plan_accept)

    a = p.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    raise SystemExit(main())
