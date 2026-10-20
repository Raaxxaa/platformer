"""Git and GitHub operations. Every worker gets its own branch and worktree off the latest main."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from .config import Config

# Files a worker may leave behind that must never be committed.
SCRATCH = ("WORKER_NOTES.md", ".aider.chat.history.md", ".aider.input.history", ".aider.llm.history")


class GitError(RuntimeError):
    pass


def run(args: list[str], cwd: Path, check: bool = True, timeout: int = 600) -> str:
    p = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=timeout,
                       encoding="utf-8", errors="replace")
    if check and p.returncode != 0:
        raise GitError(f"{' '.join(args)} failed ({p.returncode}):\n{p.stderr.strip() or p.stdout.strip()}")
    return p.stdout.strip()


def git(cfg_or_root, *args: str, cwd: Path | None = None, check: bool = True) -> str:
    root = cfg_or_root.root if isinstance(cfg_or_root, Config) else cfg_or_root
    return run(["git", *args], cwd or root, check=check)


def fetch_main(cfg: Config) -> str:
    git(cfg, "fetch", "--quiet", cfg.remote, cfg.main_branch)
    return git(cfg, "rev-parse", f"{cfg.remote}/{cfg.main_branch}")


def create_worktree(cfg: Config, branch: str, path: Path) -> str:
    """New branch from the latest remote main, checked out at `path`. Returns the base commit."""
    base = fetch_main(cfg)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        remove_worktree(cfg, path)
    if git(cfg, "branch", "--list", branch):
        git(cfg, "branch", "-D", branch)
    git(cfg, "worktree", "add", "-b", branch, str(path), base)
    return base


def ensure_node_modules(cfg: Config, path: Path) -> None:
    """Worktrees share the main checkout's node_modules (a link), so npm install runs once."""
    target = path / "node_modules"
    source = cfg.root / "node_modules"
    if target.exists() or not source.exists():
        return
    try:
        target.symlink_to(source, target_is_directory=True)
    except OSError:
        # Windows without symlink rights: a directory junction works the same way.
        subprocess.run(["cmd", "/c", "mklink", "/J", str(target), str(source)], capture_output=True)


def remove_worktree(cfg: Config, path: Path) -> None:
    git(cfg, "worktree", "remove", "--force", str(path), check=False)
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
    git(cfg, "worktree", "prune", check=False)


def clean_scratch(path: Path) -> str:
    """Removes the worker's scratch files; returns WORKER_NOTES.md text if there was one."""
    notes = ""
    for name in SCRATCH:
        f = path / name
        if f.exists():
            if name == "WORKER_NOTES.md":
                notes = f.read_text(encoding="utf-8", errors="replace")
            f.unlink()
    return notes


def changed_files(path: Path) -> list[str]:
    """Every file that differs from the base commit, including new untracked files."""
    run(["git", "add", "-A", "--intent-to-add", "."], path, check=False)
    raw = subprocess.run(["git", "status", "--porcelain", "-z", "--untracked-files=all"], cwd=path,
                         capture_output=True, text=True, encoding="utf-8", errors="replace").stdout
    parts = raw.split("\0")
    files, i = [], 0
    while i < len(parts):
        entry = parts[i]
        i += 1
        if len(entry) < 4:
            continue
        code, name = entry[:2], entry[3:]
        if "R" in code or "C" in code:
            i += 1  # the next field is the old name
        if name != "node_modules" and not name.startswith("node_modules/"):
            files.append(name)
    return sorted(set(files))


def diff(path: Path, base: str) -> str:
    run(["git", "add", "-A", "--intent-to-add", "."], path, check=False)
    return run(["git", "diff", base, "--", ".", ":(exclude)node_modules"], path)


def diffstat(path: Path, base: str) -> str:
    return run(["git", "diff", "--stat", base, "--", ".", ":(exclude)node_modules"], path)


def commit_all(path: Path, message: str) -> str:
    run(["git", "reset", "--quiet"], path, check=False)
    run(["git", "add", "-A"], path)  # node_modules (a link) is gitignored
    run(["git", "commit", "--quiet", "-m", message], path)
    return run(["git", "rev-parse", "HEAD"], path)


def rebase_on_main(cfg: Config, path: Path) -> bool:
    """Brings an approved, committed branch up to the latest main. False on conflict (rebase aborted)."""
    run(["git", "fetch", "--quiet", cfg.remote, cfg.main_branch], path)
    p = subprocess.run(["git", "rebase", f"{cfg.remote}/{cfg.main_branch}"], cwd=path,
                       capture_output=True, text=True)
    if p.returncode != 0:
        subprocess.run(["git", "rebase", "--abort"], cwd=path, capture_output=True)
        return False
    return True


def main_moved(cfg: Config, base: str) -> bool:
    return fetch_main(cfg) != base


def push_branch(cfg: Config, path: Path, branch: str) -> None:
    run(["git", "push", "--force-with-lease", "-u", cfg.remote, branch], path, timeout=300)


def gh_available() -> bool:
    if not shutil.which("gh"):
        return False
    return subprocess.run(["gh", "auth", "status"], capture_output=True).returncode == 0


def open_pr(cfg: Config, path: Path, branch: str, title: str, body_file: Path) -> str:
    out = run(["gh", "pr", "create", "--base", cfg.main_branch, "--head", branch,
               "--title", title, "--body-file", str(body_file)], path, timeout=120)
    return out.splitlines()[-1].strip()


def has_ci(cfg: Config) -> bool:
    wf = cfg.root / ".github" / "workflows"
    return any("pull_request" in f.read_text(encoding="utf-8", errors="replace")
               for f in wf.glob("*.y*ml")) if wf.exists() else False


def wait_checks(path: Path, pr_url: str, timeout_s: int = 3600) -> bool:
    p = subprocess.run(["gh", "pr", "checks", pr_url, "--watch", "--fail-fast"], cwd=path,
                       capture_output=True, text=True, timeout=timeout_s)
    return p.returncode == 0


def merge_pr(path: Path, pr_url: str) -> None:
    run(["gh", "pr", "merge", pr_url, "--squash", "--delete-branch"], path, timeout=300)


def merge_local(cfg: Config, path: Path, branch: str) -> None:
    """No-GitHub-CLI fallback: fast-forward main to the rebased branch and push it."""
    run(["git", "push", cfg.remote, f"{branch}:{cfg.main_branch}"], path, timeout=300)
