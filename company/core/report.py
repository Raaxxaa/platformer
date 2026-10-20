"""Builds the structured report for one attempt: report.json (for machines) and report.md (for people)."""
from __future__ import annotations

import json
from pathlib import Path

from . import gate, ollama
from .config import Config
from .store import Task
from .worker import bullet, prompt

DIFF_FOR_MODEL = 24000


def model_summary(cfg: Config, t: Task, notes: str, steps: list[gate.Step], diff: str) -> dict:
    try:
        reply = ollama.chat(cfg.data["ollama"]["host"], cfg.data["models"]["summary"],
                            "You write short, factual engineering summaries. Reply with JSON only.",
                            prompt("summary.md", task=f"{t.title}\n{t.body}", notes=notes or "(none)",
                                   gate=gate.summary(steps), diff=diff[:DIFF_FOR_MODEL] or "(empty)"),
                            num_ctx=int(cfg.data["ollama"]["num_ctx"]), json_mode=True, timeout=600)
        data = ollama.parse_json(reply)
        return {"changed": str(data.get("changed", "")), "concerns": list(data.get("concerns", [])),
                "recommendations": list(data.get("recommendations", []))}
    except Exception as e:  # the report must still be written if the summary model fails
        return {"changed": "", "concerns": [f"(summary model unavailable: {e})"], "recommendations": []}


def build(cfg: Config, t: Task, report_dir: Path, *, files: list[str], diff: str, diffstat: str,
          steps: list[gate.Step], screenshots: list[str], notes: str, worker_info: dict) -> dict:
    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / "diff.patch").write_text(diff, encoding="utf-8")
    (report_dir / "gate.json").write_text(json.dumps(gate.to_json(steps), indent=2), encoding="utf-8")
    summ = model_summary(cfg, t, notes, steps, diff) if diff else {
        "changed": "(no changes)", "concerns": ["The worker changed nothing."], "recommendations": []}
    rep = {
        "task": {"id": t.id, "title": t.title, "role": t.role, "attempt": t.attempt, "branch": t.branch,
                 "base": t.base_sha},
        "files_changed": files,
        "diffstat": diffstat,
        "checks": {"passed": gate.passed(steps), "steps": gate.to_json(steps)},
        "screenshots": screenshots,
        "worker_notes": notes,
        "summary": summ,
        "worker": worker_info,
        "model": cfg.model_for(t.role),
    }
    (report_dir / "report.json").write_text(json.dumps(rep, indent=2), encoding="utf-8")
    (report_dir / "report.md").write_text(to_markdown(rep), encoding="utf-8")
    return rep


def to_markdown(rep: dict) -> str:
    t = rep["task"]
    s = rep["summary"]
    lines = [f"# {t['id']} — {t['title']}", "",
             f"Role `{t['role']}` · attempt {t['attempt']} · branch `{t['branch']}` · model `{rep['model']}`", "",
             "## What changed", s.get("changed") or "(no summary)", "",
             "## Files", "```", rep["diffstat"] or "(none)", "```", "",
             "## Checks (run by the controller)", gate.summary([gate.Step(**x) for x in rep["checks"]["steps"]]), ""]
    if rep["screenshots"]:
        lines += ["## Screenshots", *[f"- `screenshots/{n}`" for n in rep["screenshots"]], ""]
    lines += ["## Worker's notes", rep["worker_notes"].strip() or "(the worker wrote no notes)", "",
              "## Concerns", bullet(s.get("concerns", [])) if s.get("concerns") else "- none found", "",
              "## Recommendations", bullet(s.get("recommendations", [])) if s.get("recommendations") else "- none", ""]
    failed = [x for x in rep["checks"]["steps"] if not x["ok"]]
    if failed:
        lines += ["## Failing output", *[f"### `{x['cmd']}`\n```\n{x['output'][-3000:]}\n```" for x in failed]]
    return "\n".join(lines)
