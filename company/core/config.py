"""Loads company/company.toml, then .company/local.toml on top of it."""
from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any


def _merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


@dataclass
class Config:
    root: Path          # the main checkout of the repo
    data: dict[str, Any]

    @property
    def state_dir(self) -> Path:
        return self.root / ".company"

    @property
    def worktree_dir(self) -> Path:
        return (self.root / self.data["repo"]["worktree_dir"]).resolve()

    @property
    def main_branch(self) -> str:
        return self.data["repo"]["main_branch"]

    @property
    def remote(self) -> str:
        return self.data["repo"]["remote"]

    def limit(self, key: str) -> int:
        return int(self.data["limits"][key])

    def role(self, name: str) -> dict:
        roles = self.data["roles"]
        if name not in roles:
            raise KeyError(f"unknown role {name!r}; roles are {', '.join(sorted(roles))}")
        return roles[name]

    def model_for(self, role: str) -> str:
        return self.data["models"][self.role(role)["model"]]

    def gate_steps(self, changed: list[str], role: str) -> tuple[list[str], list[str], list[str]]:
        """Commands to run (before, always, after) for a set of changed paths."""
        g = self.data["gate"]
        before: list[str] = []
        after: list[str] = []
        for rule in g.get("when", []):
            if any(p.startswith(prefix) for p in changed for prefix in rule["paths"]):
                before += [c for c in rule.get("before", []) if c not in before]
                after += [c for c in rule.get("after", []) if c not in after]
        if self.role(role).get("e2e") and "npm run test:e2e" not in after and changed:
            after.append("npm run test:e2e")
        return before, list(g["always"]), after


def load(root: Path) -> Config:
    base = tomllib.loads((root / "company" / "company.toml").read_text(encoding="utf-8"))
    local = root / ".company" / "local.toml"
    if local.exists():
        base = _merge(base, tomllib.loads(local.read_text(encoding="utf-8")))
    return Config(root=root, data=base)


def write_local(root: Path, values: dict[str, dict[str, Any]]) -> Path:
    """Writes .company/local.toml (simple two-level tables only)."""
    path = root / ".company" / "local.toml"
    path.parent.mkdir(parents=True, exist_ok=True)
    existing: dict = {}
    if path.exists():
        existing = tomllib.loads(path.read_text(encoding="utf-8"))
    merged = _merge(existing, values)
    lines = ["# Written by `company setup`. Safe to edit.", ""]
    for table, kv in merged.items():
        lines.append(f"[{table}]")
        for k, v in kv.items():
            if isinstance(v, bool):
                lines.append(f"{k} = {'true' if v else 'false'}")
            elif isinstance(v, (int, float)):
                lines.append(f"{k} = {v}")
            else:
                lines.append(f'{k} = "{str(v)}"')
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")
    return path
