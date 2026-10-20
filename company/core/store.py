"""The persistent task queue: one SQLite file in .company/queue.db.

It survives restarts of the controller and of any chat. Each thread opens its own connection.
"""
from __future__ import annotations

import json
import sqlite3
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path

# queued -> working -> gating -> reviewing -> merging -> done
#                                    |-> (changes requested) -> queued (attempt + 1)
#                                    |-> escalated  (the head or you must decide)
#                          merging   |-> waiting    (PR open, merge left to a person)
# any -> cancelled
STATUSES = ("queued", "working", "gating", "reviewing", "merging", "waiting", "done",
            "escalated", "cancelled")
ACTIVE = ("working", "gating", "reviewing", "merging")

SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  role TEXT NOT NULL,
  body TEXT NOT NULL,
  acceptance TEXT NOT NULL DEFAULT '[]',
  reads TEXT NOT NULL DEFAULT '[]',
  edits TEXT NOT NULL DEFAULT '[]',
  priority INTEGER NOT NULL DEFAULT 50,
  risk TEXT NOT NULL DEFAULT 'low',
  depends TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'queued',
  attempt INTEGER NOT NULL DEFAULT 0,
  branch TEXT,
  worktree TEXT,
  base_sha TEXT,
  feedback TEXT NOT NULL DEFAULT '',
  pr_url TEXT,
  source TEXT NOT NULL DEFAULT 'head',
  created REAL NOT NULL,
  updated REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  n INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT,
  ts REAL NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL
);
"""


@dataclass
class Task:
    id: str
    title: str
    role: str
    body: str
    acceptance: list[str] = field(default_factory=list)
    reads: list[str] = field(default_factory=list)
    edits: list[str] = field(default_factory=list)
    priority: int = 50
    risk: str = "low"
    depends: list[str] = field(default_factory=list)
    status: str = "queued"
    attempt: int = 0
    branch: str | None = None
    worktree: str | None = None
    base_sha: str | None = None
    feedback: str = ""
    pr_url: str | None = None
    source: str = "head"
    created: float = 0.0
    updated: float = 0.0

    @property
    def slug(self) -> str:
        s = "".join(c.lower() if c.isalnum() else "-" for c in self.title)
        while "--" in s:
            s = s.replace("--", "-")
        return s.strip("-")[:40] or "task"


_JSON = ("acceptance", "reads", "edits", "depends")


class Store:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as c:
            c.executescript(SCHEMA)

    @contextmanager
    def _conn(self):
        c = sqlite3.connect(self.path, timeout=30)
        c.row_factory = sqlite3.Row
        try:
            yield c
            c.commit()
        finally:
            c.close()

    def _row(self, r: sqlite3.Row) -> Task:
        d = dict(r)
        for k in _JSON:
            d[k] = json.loads(d[k])
        return Task(**d)

    def next_id(self) -> str:
        with self._conn() as c:
            n = c.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
        return f"T{n + 1:04d}"

    def add(self, task: Task) -> Task:
        now = time.time()
        task.id = task.id or self.next_id()
        task.created = task.updated = now
        d = task.__dict__.copy()
        for k in _JSON:
            d[k] = json.dumps(d[k])
        cols = ", ".join(d)
        with self._conn() as c:
            c.execute(f"INSERT INTO tasks ({cols}) VALUES ({', '.join('?' * len(d))})", list(d.values()))
        self.log(task.id, "created", f"{task.role}: {task.title}")
        return task

    def get(self, task_id: str) -> Task:
        with self._conn() as c:
            r = c.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if r is None:
            raise KeyError(f"no task {task_id}")
        return self._row(r)

    def all(self, statuses: tuple[str, ...] | None = None) -> list[Task]:
        q = "SELECT * FROM tasks"
        args: tuple = ()
        if statuses:
            q += f" WHERE status IN ({', '.join('?' * len(statuses))})"
            args = statuses
        with self._conn() as c:
            return [self._row(r) for r in c.execute(q + " ORDER BY priority DESC, created", args)]

    def update(self, task_id: str, **fields) -> Task:
        if "status" in fields and fields["status"] not in STATUSES:
            raise ValueError(f"bad status {fields['status']}")
        for k in _JSON:
            if k in fields:
                fields[k] = json.dumps(fields[k])
        fields["updated"] = time.time()
        sets = ", ".join(f"{k} = ?" for k in fields)
        with self._conn() as c:
            c.execute(f"UPDATE tasks SET {sets} WHERE id = ?", [*fields.values(), task_id])
        return self.get(task_id)

    def claim_next(self) -> Task | None:
        """Atomically moves the best ready task from queued to working."""
        done = {t.id for t in self.all(("done",))}
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            rows = c.execute(
                "SELECT * FROM tasks WHERE status = 'queued' ORDER BY priority DESC, created").fetchall()
            for r in rows:
                t = self._row(r)
                if all(d in done for d in t.depends):
                    c.execute("UPDATE tasks SET status = 'working', attempt = attempt + 1, updated = ? "
                              "WHERE id = ?", (time.time(), t.id))
                    c.commit()
                    return self.get(t.id)
            c.commit()
        return None

    def recover(self) -> list[str]:
        """After a crash: work in progress goes back to the queue (its attempt is not counted twice)."""
        moved = []
        for t in self.all(ACTIVE):
            back = "queued"
            self.update(t.id, status=back, attempt=max(0, t.attempt - 1))
            self.log(t.id, "recovered", f"was {t.status} when the controller stopped; requeued")
            moved.append(t.id)
        return moved

    def log(self, task_id: str | None, kind: str, message: str) -> None:
        with self._conn() as c:
            c.execute("INSERT INTO events (task_id, ts, kind, message) VALUES (?, ?, ?, ?)",
                      (task_id, time.time(), kind, message))

    def events(self, task_id: str | None = None, limit: int = 50) -> list[sqlite3.Row]:
        with self._conn() as c:
            if task_id:
                q = c.execute("SELECT * FROM events WHERE task_id = ? ORDER BY n DESC LIMIT ?", (task_id, limit))
            else:
                q = c.execute("SELECT * FROM events ORDER BY n DESC LIMIT ?", (limit,))
            return list(reversed(q.fetchall()))
