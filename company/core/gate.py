"""The controller's own checks. Run in the worker's worktree after every attempt."""
from __future__ import annotations

import shlex
import shutil
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from .config import Config

TAIL = 6000  # characters of output kept per failing command


@dataclass
class Step:
    cmd: str
    ok: bool
    seconds: float
    output: str  # tail only


def expand(cmd: str) -> str:
    """`{python}` becomes this Python (python3 on Mac/Linux is often just python on Windows)."""
    py = f'"{sys.executable}"' if sys.platform == "win32" else shlex.quote(sys.executable)
    return cmd.replace("{python}", py)


def run_step(cmd: str, cwd: Path, timeout_s: int = 1800) -> Step:
    t0 = time.time()
    try:
        p = subprocess.run(expand(cmd), cwd=cwd, shell=True, capture_output=True, text=True,
                           timeout=timeout_s, encoding="utf-8", errors="replace")
        out = (p.stdout or "") + ("\n" + p.stderr if p.stderr else "")
        ok = p.returncode == 0
    except subprocess.TimeoutExpired as e:
        out = f"TIMED OUT after {timeout_s}s\n{(e.stdout or '')[-TAIL:] if isinstance(e.stdout, str) else ''}"
        ok = False
    return Step(cmd=cmd, ok=ok, seconds=round(time.time() - t0, 1), output=out[-TAIL:])


def run_gate(cfg: Config, cwd: Path, changed: list[str], role: str, quick: bool = False) -> list[Step]:
    """Stops at the first failing step: later steps would only repeat the failure."""
    if quick:
        cmds = list(cfg.data["gate"]["quick"])
        before, _, _ = cfg.gate_steps(changed, role)
        cmds = before + cmds
    else:
        before, always, after = cfg.gate_steps(changed, role)
        cmds = before + always + after
    steps: list[Step] = []
    for c in cmds:
        s = run_step(c, cwd)
        steps.append(s)
        if not s.ok:
            break
    return steps


def passed(steps: list[Step]) -> bool:
    return bool(steps) and all(s.ok for s in steps)


def failures_text(steps: list[Step]) -> str:
    bad = [s for s in steps if not s.ok]
    return "\n\n".join(f"### `{s.cmd}` failed\n```\n{s.output[-3000:]}\n```" for s in bad) or "(none)"


def summary(steps: list[Step]) -> str:
    return "\n".join(f"- {'PASS' if s.ok else 'FAIL'} `{s.cmd}` ({s.seconds}s)" for s in steps) or "- (no checks ran)"


def collect_screenshots(cwd: Path, dest: Path, since: float) -> list[str]:
    """Copies PNGs the browser tests wrote during this gate run."""
    out = []
    src = cwd / "test-results"
    if not src.exists():
        return out
    dest.mkdir(parents=True, exist_ok=True)
    for png in sorted(src.rglob("*.png")):
        if png.stat().st_mtime >= since - 1:
            name = png.relative_to(src).as_posix().replace("/", "__")
            shutil.copy2(png, dest / name)
            out.append(name)
    return out


def to_json(steps: list[Step]) -> list[dict]:
    return [asdict(s) for s in steps]
