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
- M7 feature work through `c492149` was pushed to `main` after its complete local gate. The main-branch Pages workflow is the deployment evidence.
- Final M7 delivery commit `4bae25b` deployed successfully in Pages run `39093614763`. A fresh live browser loaded `index-CYagWFUO.js`, entered Home from the native Title menu, found all four statues, and reported no page errors. The live screenshot was inspected.
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

### M7 Task 7 — `3b95dc2`

- Added full save validation/migration, strict CRC-checked portable codes, backup/corrupt recovery, and protected newer-version saves.
- Added immutable old-run history before restart/reset, short-restart filtering, stage-reached tracking, bounded history, and real run counters/write moments.
- Red-to-green review fixes preserve a valid backup on failed repair, reset invalid bindings together, and strip temporary combat fields from history/PB snapshots so real saves round-trip exactly.
- Valid imported kits with an unbuilt third weapon keep their saved data and use a working class starter for this session, with a visible notice.
- Final checks: 915 unit tests in 116 files; typecheck/build; seven real save browser tests passed. Independent review reran 100 focused tests with no remaining finding.
- Root inspected storage-warning and future-weapon-notice screenshots. New SPEC-GAP #14 records the unspecified older-build kit fallback.

### M7 Task 8 — `a419d07`

- Added seeded elite/Guardian blueprint drops, touch pickup and immediate saving, candidate exclusion, and directly tested King unlock helpers.
- Every loot source uses the run's frozen catalog intersected with implemented gear. New runs refresh from the save; stage/village loads keep the current snapshot.
- Tests failed first for static placed-enemy source IDs and both Home seed-board directions; the gate now builds a fresh catalog from the current seed mode and saved unlocks.
- Third starting-weapon unlocks remain saved but unavailable as picker choices until their combat exists. No M9 combat was added.
- Final checks: 940 unit tests in 118 files; typecheck/build; sixteen related browser tests and five final blueprint browser checks passed. Independent review reran 42 focused tests with no findings.
- Root inspected the blueprint toast. No new SPEC-GAP.

### M7 Task 9 — `d09a196`

- Added Boot/Title, guarded Death, Records, current-feature Settings, and portable save Export/Import screens.
- Settings and imported controls apply to the live game and prompts. Text entry isolates gameplay while controller menu actions remain usable.
- Red-to-green review fixes cover audio unlock, fresh Pause/Start resume, fixed menu key priority, zero-tick input latches, two-key held actions, frozen Home Records, both death-to-Home fades, and imported record caches.
- Final checks: 987 unit tests in 128 files; typecheck/build/diff checks; seventeen browser cases plus the zero-tick regression and three affected import reruns passed.
- Root inspected all fifteen UI screenshots and saved stable copies. Independent review is clear; no new SPEC-GAP.

### M7 Task 10 — `c492149`

- Added the full Title-to-inn browser run, reload checks, and real-level stat/shop determinism tests.
- The run verifies saved Tank kit, Forest road, both Stage 1 segment keys, and no fabricated completed-run PB.
- Updated legacy Title/Home tests for the required first gesture, new Pause rows, and real intro fade.
- Final gate: typecheck; 989 unit tests in 129 files; production build; all 91 browser tests passed. The first full browser run found one old-menu test; its corrected rerun passed in full.
- Root reviewed all 46 M7 screenshots across the task checks and saved the final set; independent review checked 32 legacy UI images with no visible regressions.
- Gaps 12/13 are resolved. New gap 14 remains documented; no other M7 gap was added.

### M7.1 Task 1 — `d024eaf`

- Added water and ice movement, minecarts, collapsing platforms, grapple pull mechanics, charge-breakable walls, falling rocks, and darkness/firefly level data.
- Real failing regressions covered cart rider size, jump cuts and cancellation, stationary boarding, interaction order, hurt-water speed, and dive landing on water.
- Final checks: 1041 unit tests in 136 files; typecheck/build; eight movement/combat browser checks passed. Root inspected all nine browser screenshots.
- Independent review is clear. No new SPEC-GAP. Task 1 is committed locally; M7.1 remains undeployed until its final milestone gate.

### M7.1 Task 2 — `6c9427f`

- Added all five Mountain enemies, seeded Bat flight, golem armor and delayed turning, Shaman wards and Blink Away, bombs, and homing Hex Bolts.
- Real failing regressions covered guard and Ward damage, Bat collision/recovery, guarded Orb contact, and signed projectile knockback. Root owns the real-world Bat hit recovery test.
- Final checks: 1079 unit tests in 139 files; standalone typecheck/build; diff and protected-path checks passed. Independent review is clear.
- No new SPEC-GAP. This task is committed locally; the complete M7.1 milestone gate still comes before deployment.

### M7.1 Task 3 — `cceb400`

- Added all five Swamp enemies, potion splashes and puddles, player poison/root rules, and shared status handling.
- Real failing regressions covered hidden secondary targets, ghost notice through walls, Wisp self-death rewards, stale root markers, and Rooted movement in existing actions.
- Root's ten world tests verify wake timing, harmless Spider drops, both Wisp reward paths, fixed root markers/gaps, flask sip/cancel cleanup, and stopping an existing dash. Test-fixture corrections were separated from source defects.
- Final checks: 1116 unit tests in 144 files; typecheck/build; diff and protected-path checks passed. Independent review is clear. No new SPEC-GAP.

### M7.1 Task 4 — `b50a283`

- Added the Stone Colossus, Spider Queen and Spiderlings, their attacks and phases, and Stage 2 Guardian rewards and split timing.
- Real failing regressions covered chilled rain timing, summoned-enemy rewards, wave knockback, boss death duration, immediate kill-tick cleanup, repeated boss moves and airborne Break cancellation.
- Root's ten world cases verify both real arena intros, exact HP, chosen-road split 2, stat-pick delay, reward rolls, armor Break and full summon spawn-in/cleanup.
- Final checks: 1152 unit tests in 148 files; standalone typecheck/build; diff and protected-path checks passed. Independent review is clear.
- New gap 15 preserves the shared projectile speed cap when long-range Queen venom cannot reach its named targets.

### M7.1 Task 5 — `d0bbae3`

- Wrote and reviewed both eight-section level documents before their chunks. Added both complete roads and Border Village with Stage 3 shop odds, real inn travel and biome Ambush packs.
- The real movement tests walk both entire roads, collect both roads' keys within their detour limits, and ride the Mountain cart through both gaps and tunnels for at least 120 actual tiles.
- Real failing checks caught duplicate Guardian placement, an exit endpoint, unsupported Mountain route points, an inaccessible key platform, a 1919-pixel cart ride and floating-water validation. Isolated Stage 2 test fixtures were given their required preceding split without changing normal split rules.
- Final checks: 1187 unit tests in 154 files; typecheck/build; all 24 map/route/carry checks; byte-identical repeated generation; diff and protected-path checks passed. Independent review is clear.
- New gap 16 uses the shared 38 × 18 combat room instead of the plan's conflicting 20-tile width. The warning-placement issue was resolved within the spec, without a new gap.
- Added the required isolated three-draw Dragon roll. The Dragon remains deferred to M9, as authorized by the plan.

## Active task

M7 is delivered. M7.1 Tasks 1–5 are committed. Task 6 is active: terrain and entity views, darkness, visible hazards, and available art/audio fallbacks. Task 7 covers final browser evidence and delivery.
Root owns this handoff. Source partitions require clear file ownership and tested commits. No later milestone is authorized.

## Remaining integration notes

- Keep the original starting kit separate from collected equipment and preserve fresh-world carry ordering before loot rolls.
- Lucky buffs, debuffs, and curses end with the stage; permanent stat stacks carry on.
- Save schema section 15.2 omits `training`, but section 12.4 and Task 7 require it; add it with default `[]`.
- Capture end-history snapshots before restart/reset; village history uses the last played stage.
- A collected blueprint joins the next run's pool, not the current run's later worlds.
- Falling rocks first mark the floor 36 ticks after zone entry; the warning then lasts 72 ticks. Their 18 damage is unscaled. The earlier helper note saying an 18-tick entry delay was incorrect.
- Minecarts require real boarding, jumps/exits, death detachment, collision, stop/crash, respawn, and nearest-interaction coverage. Water/ice affect existing movement and clamp rules; body-supported ice must retain its surface.
- Python is installed as `python` on Windows; `python3` is a WindowsApps alias. Keep the protected builder scripts unchanged.

## Delivery checks still required

- Complete all M7.1 tasks.
- `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` on the final milestone state.
- Inspect all required milestone screenshots and share the useful screens with the designer.
- Fetch current GitHub state before pushing; preserve concurrent art work.
- Verify Pages deployment of the exact pushed commit.
- Report any new SPEC-GAPs. Stage 2 owner play acceptance remains a separate requirement.

## Existing warnings

- Vite reports a bundle larger than 500 kB.
- Test subprocesses report `NO_COLOR` / `FORCE_COLOR` conflicts.
- Git reports LF-to-CRLF conversion warnings on this Windows checkout.
