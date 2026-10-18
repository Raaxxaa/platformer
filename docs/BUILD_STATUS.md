# Builder handoff

## Authorized scope

Build `M7-villages-and-saving.md`, then `M7.1-stage2-two-roads.md`, in task order.
Use tests first, observe failure, implement, verify, and commit each task.
Do not change `tools/`, `public/assets/`, or `docs/art/`.
Push feature work to `main` only after the milestone checks and screenshot review.
No later milestone is authorized.

## Repository state

- Design branch `claude/great-dijkstra-g00pcj` was fast-forwarded into `main` at `b95aa41` and pushed.
- Its GitHub Pages deployment succeeded: run `39085481312`.
- Local feature commits after that point have not been pushed yet.
- No open GitHub issues were found at initial inspection; the current plans and specs govern this work.

## Verified milestones

### Test environment — `dc7aece`

- Existing browser tests failed because the configured Linux Chromium path does not exist on Windows.
- Playwright now uses an installed Chrome/Edge on Windows, keeps the Linux browser path, and accepts an explicit executable-path override.
- No browser download was used. Added Node 22 type definitions for the config.
- Starting code: typecheck, 656 unit tests, production build, and 40 browser tests passed.
- Baseline title screenshots were inspected.

### M7 Task 1 — `2276d30`

- Added the full run phases, timer policy, loading and transition boundaries, pause state, delayed mandatory stat choice, and restart rules.
- A cross-level restart requests a real Plains load; it never relabels the old map as Plains.
- Scene hooks: `loadLevel`, stable `run.transition.target`, `completeLoading()`, `confirmStatPick()`, first-fade-in `enterVillage`.
- Tests failed first on missing phase support. Extra regression tests failed first for cross-level restart, seed acceptance, and automatic pause.
- Final checks: 40 new focused unit tests; 696 total unit tests; typecheck/build; five Stage 1 browser tests passed.
- Stage 1, boss, and transition screenshots were inspected. Two independent review findings were fixed and rechecked.
- No new SPEC-GAP.

## Active task

M7 Task 2: stat upgrades and the real stat-pick popup.
The Task 2 writer owns code. Other agents must remain read-only except for this handoff.

## Required integration after Task 2

- Tasks 3–4 must build fresh worlds on `loadLevel` and explicitly carry run/loadout/HP/flask/economy state before loot rolls.
- Preserve the original starting kit separately from current equipment; do not turn collected gear into the restart kit.
- Clear Lucky buffs and debuffs at stage end (05 section 7.4); keep stat stacks and curse progress.
- Implement real Home/Crossroads scenes and cross-level restart loading before milestone delivery.
- Save schema section 15.2 omits `training`, but section 12.4 and Task 7 require it; add it with default `[]`.
- Python is installed as `python` on Windows; `python3` is a WindowsApps alias. Keep the protected builder scripts unchanged.

## Delivery checks still required

- All remaining M7 tasks, then all M7.1 tasks.
- `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` on the final milestone state.
- Inspect all required milestone screenshots and share the useful screens with the designer.
- Fetch current GitHub state before pushing; preserve concurrent art work.
- Verify Pages deployment of the exact pushed commit.
- Report any new SPEC-GAPs. Stage 2 owner play acceptance remains a separate requirement.

## Existing warnings

- Vite reports a bundle larger than 500 kB.
- Test subprocesses report `NO_COLOR` / `FORCE_COLOR` conflicts.
- Git reports LF-to-CRLF conversion warnings on this Windows checkout.
