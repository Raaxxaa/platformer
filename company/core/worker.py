"""Runs one local-model worker attempt with Aider inside the task's worktree."""
from __future__ import annotations

import os
import shutil
import subprocess
import time
from pathlib import Path
from string import Template

from . import gate, gitops, ollama
from .config import Config
from .store import Task

PROMPTS = Path(__file__).resolve().parent.parent / "prompts"


def prompt(name: str, **values) -> str:
    return Template((PROMPTS / name).read_text(encoding="utf-8")).safe_substitute(**values)


def bullet(items: list[str]) -> str:
    return "\n".join(f"- {i}" for i in items) or "- (see the task)"


def task_prompt(cfg: Config, t: Task) -> str:
    fb = ""
    if t.feedback.strip():
        fb = ("\n## The head reviewed your previous attempt and asked for these changes\n"
              "Your previous changes are still in the files. Fix them as asked:\n\n" + t.feedback.strip())
    return prompt("worker.md", role=t.role, role_about=cfg.role(t.role)["about"], title=t.title,
                  task_id=t.id, attempt=t.attempt, body=t.body, acceptance=bullet(t.acceptance), feedback=fb)


def aider_command(cfg: Config, t: Task, wt: Path, message_file: Path, log_dir: Path) -> list[str]:
    exe = shutil.which("aider") or "aider"
    model = cfg.model_for(t.role)
    reads = []
    for r in [*cfg.role(t.role).get("reads", []), *t.reads]:
        if (wt / r).exists() and r not in reads:
            reads.append(r)
    edits = [e for e in t.edits if not e.startswith(("docs/", "tools/", "public/assets/"))]
    cmd = [exe, "--model", f"ollama_chat/{model}",
           "--model-settings-file", str(cfg.state_dir / "aider.model.settings.yml"),
           "--message-file", str(message_file),
           "--yes-always", "--no-auto-commits", "--no-dirty-commits", "--no-git-commit-verify",
           "--no-check-update", "--analytics-disable", "--no-show-model-warnings",
           "--no-pretty", "--no-stream", "--no-fancy-input", "--no-suggest-shell-commands",
           "--no-detect-urls", "--no-notifications", "--no-gitignore",
           "--test-cmd", " && ".join(cfg.data["gate"]["quick"]), "--auto-test",
           "--map-tokens", "2048", "--timeout", str(int(cfg.data["ollama"].get("request_timeout_s", 600))),
           "--chat-history-file", str(log_dir / "aider.chat.md"),
           "--input-history-file", str(log_dir / "aider.input"),
           "--llm-history-file", str(log_dir / "aider.llm.txt")]
    for r in reads:
        cmd += ["--read", r]
    cmd += ["--aiderignore", str(write_aiderignore(cfg, log_dir, [*reads, *edits]))]
    cmd += edits
    return cmd


def write_aiderignore(cfg: Config, log_dir: Path, keep: list[str]) -> Path:
    """Aider auto-adds every file a prompt mentions. Hide docs, tests and huge files from that (and from the
    repo map) so a small model's context isn't flooded; the task's own reads and edits stay visible."""
    lines = [*cfg.data.get("worker", {}).get("hide", []), "!WORKER_NOTES.md", *(f"!{k}" for k in keep)]
    path = log_dir / "aiderignore"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def write_model_settings(cfg: Config) -> None:
    """Ollama defaults to a tiny context window; make every model use the configured one."""
    ctx = int(cfg.data["ollama"]["num_ctx"])
    names = sorted(set(cfg.data["models"].values()))
    lines = []
    for n in names:
        lines += [f"- name: ollama_chat/{n}", "  extra_params:", f"    num_ctx: {ctx}"]
        if not cfg.data["ollama"].get("think", True):
            lines.append("    think: false")         # thinking models spend minutes before each edit
    path = cfg.state_dir / "aider.model.settings.yml"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_attempt(cfg: Config, t: Task, wt: Path, log_dir: Path) -> dict:
    """Up to `worker_rounds` aider runs. Each later round gets the checks that still fail."""
    log_dir.mkdir(parents=True, exist_ok=True)
    write_model_settings(cfg)
    env = dict(os.environ, OLLAMA_API_BASE=cfg.data["ollama"]["host"], AIDER_ANALYTICS="false")
    rounds = []
    message = task_prompt(cfg, t)
    timeout_s = cfg.limit("worker_timeout_min") * 60
    for n in range(1, cfg.limit("worker_rounds") + 1):
        mf = log_dir / f"round{n}.prompt.md"
        mf.write_text(message, encoding="utf-8")
        t0 = time.time()
        try:
            p = subprocess.run(aider_command(cfg, t, wt, mf, log_dir), cwd=wt, env=env,
                               capture_output=True, text=True, timeout=timeout_s,
                               encoding="utf-8", errors="replace", stdin=subprocess.DEVNULL)
            out, code = (p.stdout or "") + (p.stderr or ""), p.returncode
        except subprocess.TimeoutExpired:
            out, code = f"aider timed out after {timeout_s}s", -1
        except FileNotFoundError:
            out, code = "aider is not installed (run `company doctor`)", -2
        (log_dir / f"round{n}.aider.log").write_text(out, encoding="utf-8")
        steps = gate.run_gate(cfg, wt, gitops.changed_files(wt), t.role, quick=True)
        rounds.append({"round": n, "aider_exit": code, "seconds": round(time.time() - t0),
                       "quick_checks_passed": gate.passed(steps)})
        if code == -2 or gate.passed(steps):
            break
        message = prompt("fix_round.md", failures=gate.failures_text(steps))
    return {"rounds": rounds}


def plan(cfg: Config, t: Task) -> dict:
    """The planner role: one Ollama call that returns proposed tasks as JSON (no code edits)."""
    ctx_parts = []
    for r in [*cfg.role("planner").get("reads", []), *t.reads]:
        f = cfg.root / r
        if f.exists():
            ctx_parts.append(f"### {r}\n{f.read_text(encoding='utf-8', errors='replace')[:12000]}")
    reply = ollama.chat(cfg.data["ollama"]["host"], cfg.model_for("planner"),
                        "You are a careful software planner. Reply with JSON only.",
                        prompt("planner.md", request=t.body, context="\n\n".join(ctx_parts)),
                        num_ctx=int(cfg.data["ollama"]["num_ctx"]), json_mode=True)
    return ollama.parse_json(reply)
