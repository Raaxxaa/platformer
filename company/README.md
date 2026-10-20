# The RUSHBLADE company

You talk to **one chat: the head** (Claude Code with Opus, opened in this repo on your computer). The head turns
your ideas, bug reports and priorities into small tasks. **Local Ollama models** do the work, each in its own
copy of the repo. A **controller** program runs for hours in a terminal, checks every result itself, asks the
head to review it, and only then merges it into GitHub.

```
You ─▶ Head (Claude Code)
          │  company task add …
          ▼
   ┌──────────────────── controller (company run) ────────────────────┐
   │ queue (.company/queue.db, survives restarts)                      │
   │   → worker: Aider + Ollama model in ../platformer-work/T00xx       │
   │       (own branch work/t00xx-…, up to 3 rounds per attempt)       │
   │   → the controller's own checks: typecheck, unit tests, build,     │
   │       browser tests + screenshots for UI/level work                │
   │   → report: what changed, files, diff, checks, screenshots,        │
   │       worker's notes, concerns                                     │
   │   → head review (claude -p, Opus): approve / fix it itself /       │
   │       send back with instructions / escalate to you                │
   │   → approved: commit, update to latest main, re-check, push,       │
   │       pull request, CI, squash-merge  → GitHub Pages deploys       │
   └───────────────────────────────────────────────────────────────────┘
          │  .company/digest.md
          ▼
       Head reports back to you in plain words
```

## Why it's built this way

- **Workers use [Aider](https://aider.chat)**: a mature open-source coding agent that works well with Ollama,
  edits files in a git checkout and re-runs tests after each change. It's driven non-interactively.
- **The controller never trusts a worker's claims.** It runs the project's real checks itself, and failed checks
  go straight back to the worker (no review spent). The head only reviews work that passes, or the last attempt.
- **One worker at a time** by default. On one GPU, two local models just slow each other down. Reviews and
  merges run in a separate lane, so the GPU keeps working while the head reviews.
- **Nothing reaches GitHub without the head's approval.** Workers can't commit; the controller commits only
  approved work. High-risk tasks open a pull request and wait for you instead of merging.
- **GitHub is the source of truth for the game.** The queue and reports are local (in `.company/`, not committed),
  so the controller can run, crash, restart and continue.
- **Workers are given roles that fit this project:** `core` (game rules + Vitest tests), `level` (ASCII level
  chunks), `ui` (Phaser views and HUD), `test` (unit and browser tests), `debug` (reproduce a bug with a test,
  then fix), `planner` (break a big request into tasks). Art scripts stay with the head or the art chat, because
  they need to look at images.

**Be realistic about local models.** On a 16–24 GB GPU they do well on small, exact tasks (add a rule with a
test, a level section, a HUD element) and badly on anything vague or spread across many systems. The head is
told to keep tasks small and to fix or take over what workers can't finish. Expect many first attempts to go
back for a second try. That's normal and cheap.

## One-time setup (on your computer)

You need: **Git**, **Node.js 22**, **Python 3.11+**, **Ollama**, **Claude Code**, and ideally the **GitHub CLI**.

1. Get the repo and install the game's packages:
   ```
   git clone https://github.com/Raaxxaa/platformer.git
   cd platformer
   npm install
   ```
   Until this folder is merged into `main`, also run:
   `git fetch origin claude/great-dijkstra-g00pcj && git merge origin/claude/great-dijkstra-g00pcj`.
2. Install Ollama from https://ollama.com and start it.
3. Install Aider: `python -m pip install aider-install` then `aider-install`.
4. Install Claude Code and log in: run `claude` once in this folder.
5. Install the GitHub CLI and log in: `gh auth login`. Without it, approved work is merged with plain git.
6. Pick and download models that fit your computer:
   ```
   python company/company.py setup
   ```
   It looks at your GPU and memory and picks:

   | Memory for models | Coder model | Notes |
   |---|---|---|
   | 40 GB+ | `qwen3-coder:30b`, 64k context | Best local option |
   | 22–40 GB (e.g. RTX 3090/4090, 32 GB Mac) | `qwen3-coder:30b`, 32k context | Fast mixture-of-experts model |
   | 14–22 GB (e.g. RTX 4080, 16 GB cards) | `qwen2.5-coder:14b` | Good for small tasks |
   | 8–14 GB | `qwen2.5-coder:7b` | Only tiny tasks; the head will do more |

   A small model (`qwen2.5-coder:7b`) writes the report summaries. Change any of this in `.company/local.toml`.
7. Check everything: `python company/company.py doctor`.

## Daily use

1. **Start the controller** and leave it running: double-click `company\start.cmd` (Windows) or run
   `company/start.sh` (Mac/Linux). It keeps working through the queue for as long as it's open.
2. **Open the head**: `claude` in the repo folder (with Opus). Tell it what you want: ideas, bugs, priorities,
   "status". It uses the `company-head` skill to queue tasks and report back.
3. To stop: `python company/company.py stop` (finishes the current task first) or close the window (the
   interrupted task is redone when you start it again).

## Commands (mostly for the head)

| Command | What it does |
|---|---|
| `status` | Summary: needs a decision, waiting, in progress, queued, recently done, last events |
| `task add --role R --title T --file body.md [--read F] [--edit F] [--accept A] [--depends ID] [--priority N] [--risk high]` | Queue a task |
| `task list`, `task show ID` | List tasks; one task with its events and reports |
| `task retry ID [--feedback …] [--fresh]` | Send back to a worker (optionally starting over) |
| `task approve ID --now [--message …]` | Merge a task the head fixed by hand |
| `task cancel ID` | Drop a task |
| `plan show ID`, `plan accept ID [--only N]` | Read and queue a planner's proposed tasks |
| `run [--once]`, `stop` | Start / stop the controller |
| `setup`, `doctor` | Pick models; check the installation |

Reports are in `.company/reports/T00xx/attempt-N/`: `report.md`, `report.json`, `diff.patch`, `gate.json`,
`screenshots/`, `review.json`, and the worker's full logs in `worker/`.

## Settings (`company/company.toml`)

- `merge.mode`: `auto` (PR + squash-merge after CI, the default), `pr` (open PRs, you merge), `local` (no GitHub CLI).
- `limits`: attempts per task (3), worker rounds per attempt (3), timeouts, workers in parallel (1).
- `gate`: the checks. UI and level work also runs the browser tests (about 4 minutes) and collects screenshots.
- `roles`: what each worker role does and which files it always reads.

## Tests

`python -m unittest discover company/tests`: runs the whole loop with fake workers, a fake reviewer and a local
git remote (approve, retry on failed checks, head fixes, changes requested, escalation, dependencies, crash
recovery, Ollama down, missing model).
