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

### M7 Task 2 — `9e522e0`

- Added all twelve run-long stat upgrades, their caps, deterministic offers, live effect hooks, and the actual choice cards.
- The core enforces the 36-tick guard and one accepted choice. Keyboard, gamepad, mouse, pause, restart, and held input are covered.
- Tests failed before implementation. Regression tests also failed first for a stale release gate, non-left mouse confirmation, and Guardian flask-fill banking.
- Final checks: 56 focused unit tests; 739 total unit tests in 97 files; typecheck/build; eleven stat-pick and Stage 1 browser tests passed.
- Both stat-card screenshots were inspected by the writer and root. Independent review findings were fixed and rechecked.
- No new SPEC-GAP.

### M7 Task 3 — `58cd749`

- Added the Home Village with existing ART3 assets, class statues, the first-kit Training prompt, seed/records boards, gate checks, and persistent kit/training progress.
- Fresh-world carry keeps the original starting kit separate, transfers run stats and Iron Will/Vitality state, and is consumed only once before loot rolls.
- Added real Home/Training/Stage loading, correct Training return source, untimed Home/Yard clocks, and one Stage 1 run-start event.
- Shared save scaffold catches storage getter/method failures, protects newer saves, and exposes a one-time visible warning.
- Test-first and red-to-green review fixes cover held controller inputs, same-session return paths, visible warnings, and HP transfer.
- Final checks: 762 unit tests in 101 files; typecheck/build; 22 Home/class/HUD/Stage 1 browser tests passed.
- Root inspected all four Home screenshots. Independent review fixes were rechecked with no findings.
- Existing protected scripts/art were unchanged. The level wrapper honors `PYTHON`; bundled Python with Pillow was used locally. Original `kinds.png` bytes were restored.
- No new SPEC-GAP.

### M7 Task 4 — `7919ae3`

- Added the Crossroads map, exact seeded stock, delayed purchase payment/SOLD state, ability tap upgrades and hold sales, flask services, keys, and rerolls.
- Verified canceled/invalidated swaps, Owned/MAX/Full states, key sold-state preservation, and price modifiers.
- Review fixes align merchant tags with the real discounted price and place the hold ring around the measured interaction glyph.
- Final checks: 793 unit tests in 105 files; typecheck/build; fifteen related browser checks plus the final shop rerender passed.
- Root inspected stock, SOLD, held-ring, and shop screenshots. No remaining review finding; no new SPEC-GAP.

### M7 Task 5 — `2fc4b3b`

- Added the saved road choice, exact 120-tick inn sleep, mid-fade health refill, and the authorized run-so-far ending with real Restart/Home/Title actions.
- The ending freezes gameplay and never claims Stage 2 progress, a completed run, or a PB. Canceling the road choice keeps the current run unchanged.
- Review regressions failed first for ignored route-menu pause and a second restart caused by a held controller button. Both were fixed and independently rechecked.
- Final checks: 808 unit tests in 108 files; typecheck/build; three inn browser tests plus seven related browser cases passed.
- Root inspected road-choice and ending screenshots. No new SPEC-GAP; the plan's authorized placeholder comment is present.

### M7 Task 6 — `13ff1c0`

- Added cumulative splits, original-start-class PB comparisons, immediate best segments, and completed-run PB helpers. Segment 1 writes both road keys; typed and practice attempts compare without writing records.
- Replaced the old timer text with the real timer block and split alert. It shows village names, signed/color deltas, and a best-segment badge; hiding the timer retains info and alerts.
- Test-first review fixes cover full ISO saved dates, a 0.1-second UI frame limit, and practice events leaving normal progress unchanged.
- Corrected an earlier carry bug: curses now end at village entry and death, along with stage effects. Permanent stat stacks stay intact.
- Final checks: 844 unit tests in 112 files; typecheck/build; eighteen related browser tests and the final four split browser checks passed.
- Root inspected all three split/timer screenshots. Independent review is clear; no new SPEC-GAP.

## Active task

M7 Task 7: save validation, recovery, portable codes, history, and write moments.
The M7 writer is authorized to continue Tasks 3–10 strictly in order, with a tested commit per task and checkpoint reports.
Root owns this handoff. Review agents stay read-only. No feature push before M7 checks and screenshot review.

## Remaining integration notes

- Keep the original starting kit separate from collected equipment and preserve fresh-world carry ordering before loot rolls.
- Lucky buffs, debuffs, and curses end with the stage; permanent stat stacks carry on.
- Save schema section 15.2 omits `training`, but section 12.4 and Task 7 require it; add it with default `[]`.
- Capture end-history snapshots before restart/reset; village history uses the last played stage.
- A collected blueprint joins the next run's pool, not the current run's later worlds.
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
