"""The head's review: runs Claude Code headless (`claude -p`) inside the worktree and reads its verdict."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from . import gate
from .config import Config
from .ollama import parse_json
from .store import Task
from .worker import bullet, prompt

VERDICTS = ("approve", "fixed", "changes_requested", "escalate")

SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": list(VERDICTS)},
        "summary": {"type": "string", "description": "2-4 sentences for the log: what the work does and why this verdict"},
        "instructions": {"type": "string", "description": "for changes_requested: numbered fix instructions"},
        "user_note": {"type": "string", "description": "plain-words note for the designer (escalations, notable results)"},
        "commit_message": {"type": "string", "description": "for approve/fixed: a one-line commit title"},
    },
    "required": ["verdict", "summary"],
}

# The reviewer may read anything, run the project's checks and git read commands, and edit files when fixing.
ALLOWED = ["Read", "Grep", "Glob", "Edit", "Write", "MultiEdit",
           "Bash(git diff:*)", "Bash(git status:*)", "Bash(git log:*)", "Bash(git show:*)",
           "Bash(npm run typecheck)", "Bash(npm test:*)", "Bash(npm run build)", "Bash(npm run test:e2e:*)",
           "Bash(npm run levels)", "Bash(npx vitest:*)", "Bash(npx playwright test:*)"]


def review_prompt(cfg: Config, t: Task, report_dir: Path, steps: list[gate.Step]) -> str:
    return prompt("review.md", task_id=t.id, role=t.role, attempt=t.attempt,
                  max_attempts=cfg.limit("max_attempts"), title=t.title, body=t.body,
                  acceptance=bullet(t.acceptance), report_md=str(report_dir / "report.md"),
                  report_dir=str(report_dir), gate_summary=gate.summary(steps))


def run_review(cfg: Config, t: Task, wt: Path, report_dir: Path, steps: list[gate.Step]) -> dict:
    exe = shutil.which(cfg.data["review"]["command"]) or cfg.data["review"]["command"]
    cmd = [exe, "-p", review_prompt(cfg, t, report_dir, steps),
           "--model", cfg.data["review"]["model"],
           "--output-format", "json",
           "--json-schema", json.dumps(SCHEMA),
           "--permission-mode", "acceptEdits",
           "--add-dir", str(report_dir),
           "--allowedTools", *ALLOWED]
    timeout_s = cfg.limit("review_timeout_min") * 60
    try:
        p = subprocess.run(cmd, cwd=wt, capture_output=True, text=True, timeout=timeout_s,
                           encoding="utf-8", errors="replace", stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        return {"verdict": "escalate", "summary": f"The review timed out after {timeout_s}s.",
                "user_note": "The head's automatic review timed out; it needs a manual look."}
    except FileNotFoundError:
        return {"verdict": "escalate", "summary": "Claude Code (`claude`) is not installed or not on PATH.",
                "user_note": "Install Claude Code and log in, then run `company retry` on this task."}
    (report_dir / "review.raw.json").write_text(p.stdout or p.stderr, encoding="utf-8")
    return parse_verdict(p.stdout, p.stderr, p.returncode)


def parse_verdict(stdout: str, stderr: str = "", code: int = 0) -> dict:
    """Accepts `claude -p --output-format json` output, with or without structured output."""
    try:
        outer = json.loads(stdout)
    except (json.JSONDecodeError, TypeError):
        outer = None
    candidates = []
    if isinstance(outer, dict):
        if isinstance(outer.get("structured_output"), dict):
            candidates.append(outer["structured_output"])
        if isinstance(outer.get("result"), str):
            try:
                candidates.append(parse_json(outer["result"]))
            except ValueError:
                pass
        if "verdict" in outer:
            candidates.append(outer)
    elif stdout:
        try:
            candidates.append(parse_json(stdout))
        except ValueError:
            pass
    for c in candidates:
        if c.get("verdict") in VERDICTS:
            return {k: str(c.get(k, "")) for k in ("verdict", "summary", "instructions", "user_note", "commit_message")}
    detail = (stderr or stdout or "")[-1500:]
    return {"verdict": "escalate", "summary": f"Could not read the review verdict (exit {code}).",
            "instructions": "", "user_note": "The automatic review gave no usable answer.\n" + detail,
            "commit_message": ""}
