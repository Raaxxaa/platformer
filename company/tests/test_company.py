"""End-to-end tests of the controller with fake workers (aider), a fake reviewer (claude) and a local git remote.

Run: python3 -m unittest discover company/tests
"""
from __future__ import annotations

import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

COMPANY = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(COMPANY))

from core import config as config_mod  # noqa: E402
from core import hardware, ollama, review  # noqa: E402
from core.controller import Controller  # noqa: E402
from core.store import Store, Task  # noqa: E402


def sh(args, cwd):
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


FAKE_AIDER = r'''#!/usr/bin/env python3
# Fake worker. Behaviour comes from the task text in the prompt:
#   "WRITE <file> <content>"   writes a file
#   "FAILFIRST"                 the first round writes a failing marker; later rounds fix it
#   "NOTHING"                   changes nothing
import sys, pathlib, re
args = sys.argv[1:]
msg = pathlib.Path(args[args.index("--message-file") + 1]).read_text()
root = pathlib.Path.cwd()
counter = root.parent / (root.name + ".rounds")
n = int(counter.read_text()) + 1 if counter.exists() else 1
counter.write_text(str(n))
if "NOTHING" in msg:
    sys.exit(0)
for f, c in re.findall(r"WRITE (\S+) (\S+)", msg):
    p = root / f
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(c + "\n")
if "FAILFIRST" in msg and n == 1:
    (root / "BROKEN").write_text("x")
elif "failed" in msg or "asked for these changes" in msg:
    (root / "BROKEN").unlink(missing_ok=True)
    (root / "fixed.txt").write_text("fixed\n")
(root / "WORKER_NOTES.md").write_text("## What I changed\nwrote files\n")
'''

FAKE_CLAUDE = r'''#!/usr/bin/env python3
# Fake head reviewer. Reads its script from REVIEW_SCRIPT (one verdict per line, used in order).
import json, os, pathlib, sys
script = pathlib.Path(os.environ["REVIEW_SCRIPT"])
lines = script.read_text().splitlines()
verdict = lines[0] if lines else "approve"
script.write_text("\n".join(lines[1:]))
if verdict == "fixed":
    pathlib.Path("head_fix.txt").write_text("fixed by head\n")
out = {"type": "result", "result": "done",
       "structured_output": {"verdict": verdict, "summary": f"fake {verdict}",
                             "instructions": "1. Do it properly.", "user_note": "needs you",
                             "commit_message": "Fake change"}}
print(json.dumps(out))
'''

CHECK = "import pathlib, sys; sys.exit(1 if pathlib.Path('BROKEN').exists() else 0)"


class Company(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="company-test-"))
        origin = self.tmp / "origin.git"
        sh(["git", "init", "--bare", "-b", "main", str(origin)], self.tmp)
        self.root = self.tmp / "repo"
        sh(["git", "clone", str(origin), str(self.root)], self.tmp)
        sh(["git", "config", "user.email", "t@t"], self.root)
        sh(["git", "config", "user.name", "t"], self.root)
        shutil.copytree(COMPANY, self.root / "company", ignore=shutil.ignore_patterns("__pycache__", "tests"))
        (self.root / ".gitignore").write_text(".company/\nnode_modules\n")
        (self.root / "README").write_text("game\n")
        sh(["git", "add", "-A"], self.root)
        sh(["git", "commit", "-m", "init"], self.root)
        sh(["git", "push", "-u", "origin", "main"], self.root)
        (self.root / ".company").mkdir()
        check = f'{sys.executable} -c "{CHECK}"'
        (self.root / ".company" / "local.toml").write_text(textwrap.dedent(f"""
            [merge]
            mode = "local"
            [limits]
            max_attempts = 2
            worker_rounds = 1
            poll_seconds = 1
            [ollama]
            host = "http://127.0.0.1:9"
            [gate]
            quick = [{json.dumps(check)}]
            always = [{json.dumps(check)}]
            when = []
            """))
        bindir = self.tmp / "bin"
        bindir.mkdir()
        for name, src in (("aider", FAKE_AIDER), ("claude", FAKE_CLAUDE)):
            p = bindir / name
            p.write_text(src.replace("/usr/bin/env python3", sys.executable, 1))
            p.chmod(p.stat().st_mode | stat.S_IEXEC)
        self.review_script = self.tmp / "review.txt"
        self.env = {"PATH": f"{bindir}{os.pathsep}{os.environ['PATH']}", "REVIEW_SCRIPT": str(self.review_script)}
        self._old = {k: os.environ.get(k) for k in self.env}
        os.environ.update(self.env)
        self.cfg = config_mod.load(self.root)
        self.store = Store(self.cfg.state_dir / "queue.db")
        self._has_model = ollama.has_model
        ollama.has_model = lambda host, name: True   # pretend Ollama is up with every model

    def tearDown(self):
        ollama.has_model = self._has_model
        for k, v in self._old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        shutil.rmtree(self.tmp, ignore_errors=True)

    def add(self, body, role="core", **kw):
        return self.store.add(Task(id="", title=kw.pop("title", "Test task"), role=role, body=body, **kw))

    def run_all(self, verdicts=""):
        self.review_script.write_text(verdicts)
        Controller(self.cfg, log=lambda *_: None).run(once=True)

    def origin_files(self):
        sh(["git", "fetch", "-q", "origin", "main"], self.root)
        return sh(["git", "ls-tree", "-r", "--name-only", "origin/main"], self.root).split()

    # --- the happy path ---
    def test_approved_work_is_merged_and_cleaned_up(self):
        t = self.add("WRITE src/hello.txt hi")
        self.run_all("approve")
        t = self.store.get(t.id)
        self.assertEqual(t.status, "done")
        files = self.origin_files()
        self.assertIn("src/hello.txt", files)
        self.assertNotIn("WORKER_NOTES.md", files)       # scratch files never reach main
        self.assertFalse(Path(t.worktree).exists())       # worktree removed after merge
        rep = json.loads((self.cfg.state_dir / "reports" / t.id / "attempt-1" / "report.json").read_text())
        self.assertEqual(rep["files_changed"], ["src/hello.txt"])
        self.assertTrue(rep["checks"]["passed"])
        self.assertIn("wrote files", rep["worker_notes"])
        msg = sh(["git", "log", "-1", "--format=%B", "origin/main"], self.root)
        self.assertIn("Fake change", msg)
        self.assertIn("reviewed and approved by the head", msg)

    # --- failing checks go back to the worker without spending a review ---
    def test_failed_checks_retry_without_review(self):
        t = self.add("WRITE a.txt 1 FAILFIRST")
        self.run_all("approve")
        t = self.store.get(t.id)
        self.assertEqual(t.status, "done")
        self.assertEqual(t.attempt, 2)
        self.assertEqual(self.review_script.read_text(), "")   # exactly one review was used
        self.assertIn("fixed.txt", self.origin_files())

    # --- the head asks for changes, then approves ---
    def test_changes_requested_then_approved(self):
        t = self.add("WRITE b.txt 1")
        self.run_all("changes_requested\napprove")
        t = self.store.get(t.id)
        self.assertEqual(t.status, "done")
        self.assertEqual(t.attempt, 2)
        self.assertIn("Do it properly", (self.cfg.state_dir / "reports" / t.id / "attempt-2" / "worker" /
                                         "round1.prompt.md").read_text())

    # --- the head fixes it itself ---
    def test_head_fix_is_rechecked_and_merged(self):
        t = self.add("WRITE c.txt 1")
        self.run_all("fixed")
        self.assertEqual(self.store.get(t.id).status, "done")
        self.assertIn("head_fix.txt", self.origin_files())

    # --- out of attempts: escalate to the head / you ---
    def test_escalates_after_max_attempts(self):
        t = self.add("WRITE d.txt 1")
        self.run_all("changes_requested\nchanges_requested")
        t = self.store.get(t.id)
        self.assertEqual(t.status, "escalated")
        self.assertNotIn("d.txt", self.origin_files())   # nothing unapproved reaches main

    def test_worker_that_changes_nothing_escalates(self):
        t = self.add("NOTHING")
        self.run_all("escalate")
        self.assertEqual(self.store.get(t.id).status, "escalated")

    # --- ordering and dependencies ---
    def test_dependencies_and_priority(self):
        a = self.add("WRITE x1.txt 1", title="first", priority=10)
        b = self.add("WRITE x2.txt 1", title="second", priority=90, depends=[a.id])
        c = self.add("WRITE x3.txt 1", title="third", priority=50)
        order = []
        self.review_script.write_text("approve\napprove\napprove")
        ctl = Controller(self.cfg, log=lambda m: order.append(m) if "working:" in m else None)
        ctl.run(once=True)
        ids = [m.split("]")[0][1:] for m in order]
        self.assertEqual(ids, [c.id, a.id, b.id])   # b waits for a despite its higher priority

    # --- crash recovery ---
    def test_recover_requeues_interrupted_work(self):
        t = self.add("WRITE r.txt 1")
        self.store.update(t.id, status="working", attempt=1)
        Controller(self.cfg, log=lambda *_: None).recover()
        t = self.store.get(t.id)
        self.assertEqual((t.status, t.attempt), ("queued", 0))

    def test_ollama_down_does_not_use_attempts(self):
        def down(host, name):
            raise ollama.OllamaError("down")
        ollama.has_model = down
        self.cfg.data["limits"]["poll_seconds"] = 0
        t = self.add("WRITE o.txt 1")
        ctl = Controller(self.cfg, log=lambda *_: None)
        for th in ctl.tick():
            th.join()
        t = self.store.get(t.id)
        self.assertEqual((t.status, t.attempt), ("queued", 0))

    def test_missing_model_escalates(self):
        ollama.has_model = lambda host, name: False
        t = self.add("WRITE m.txt 1")
        self.run_all("")
        self.assertEqual(self.store.get(t.id).status, "escalated")

    def test_digest_lists_escalations(self):
        t = self.add("WRITE d.txt 1")
        self.run_all("escalate")
        digest = (self.cfg.state_dir / "digest.md").read_text()
        self.assertIn("Needs a decision", digest)
        self.assertIn(t.id, digest)


class Units(unittest.TestCase):
    def test_parse_verdict_forms(self):
        self.assertEqual(review.parse_verdict(json.dumps({"structured_output": {"verdict": "approve", "summary": "s"}}))["verdict"], "approve")
        self.assertEqual(review.parse_verdict(json.dumps({"result": 'ok ```{"verdict": "fixed", "summary": "s"}```'}))["verdict"], "fixed")
        self.assertEqual(review.parse_verdict("garbage")["verdict"], "escalate")

    def test_parse_json_with_prose(self):
        self.assertEqual(ollama.parse_json('Sure! {"a": {"b": 1}} done'), {"a": {"b": 1}})

    def test_hardware_tiers(self):
        self.assertEqual(hardware.recommend(24)["coder"], "qwen3-coder:30b")
        self.assertEqual(hardware.recommend(16)["coder"], "qwen2.5-coder:14b")
        self.assertEqual(hardware.recommend(4)["num_ctx"], 8192)

    def test_gate_rules_follow_changed_paths(self):
        cfg = config_mod.load(COMPANY.parent)
        before, always, after = cfg.gate_steps(["levels-src/plains/s1.txt"], "core")
        self.assertEqual(before, ["npm run levels"])
        self.assertIn("npm run build", always)
        _, _, after = cfg.gate_steps(["src/core/x.ts"], "core")
        self.assertEqual(after, [])
        _, _, after = cfg.gate_steps(["src/ui/hud.ts"], "core")
        self.assertEqual(after, ["npm run test:e2e"])
        _, _, after = cfg.gate_steps(["src/core/x.ts"], "ui")
        self.assertEqual(after, ["npm run test:e2e"])


if __name__ == "__main__":
    unittest.main()
