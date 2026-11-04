# M14: Assist Mode and Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
1. **Assist mode** for players who find the game too hard: slower game speed, less damage taken, an extra flask charge, longer timed doors. Assisted runs never set best times but still unlock everything.
2. **Polish:** the changes the design chat decided when answering the open SPEC-GAPs (`docs/SPEC-GAPS.md`, "Design chat answers (2026-11-04)").

**Spec:** `docs/spec/06-run-levels-save.md` **§5.4** (assist mode, new); 02 §3.3 (incoming multiplier), §5.2 step 3 (`parry` event); 03 §11.4 (Time Slow, changed); 04 §3 Wolf (pacing), §8 `venom_glob` (speed cap); 07 §4.1 (HUD plate 216 px), §4.11 (`ASSIST` tag), §7.7 (settings), §7.10–7.11 (death screen, run summary), §8.6 (vibration on `parry`); 09 §7 (look on more screens).

**Starting point:** M13 on `main`. Merge `main` and `origin/claude/great-dijkstra-g00pcj` first.

## Global Constraints

- All earlier constraints hold. Determinism: the same seed, inputs and assist settings give the same run. Game speed must not change any tick count.
- Non-assisted play is unchanged: every existing test still passes.

## Review Focus

1. **Assisted runs writing best times:** never (06 §5.4). Pinned in Task 2.
2. **Game speed touching the simulation:** it only changes how many ticks run per real second. Pinned in Task 1.
3. **Mid-run changes:** damage, flask and doors stay as they were at run start; speed changes at once and marks the run.

---

## Part A — Assist mode

### Task 1: Assist in the core and the loop
- [ ] **Tests first:** `RunState.assist` is copied from settings at run start; Damage taken 50% halves a 12-damage Bandit hit to 6 and a 1-damage hit stays 1; the one-hit curse still kills; Extra flask charge starts the run at 3/3 (or one more than the current max) and allows a 5th charge with upgrades; Longer timed doors make a 120 s door 180 s; changing these settings mid-run changes nothing until the next run; a full-run determinism test with assist on.
- [ ] **Game speed:** the fixed-step loop runs `120 × speed` ticks per real second (fixed tick size unchanged). Test: at 70%, 1.0 real s runs 84 ticks; the run timer shows ticks, so it advances 84 ticks (0.70 s of game time).
- [ ] `slowedEver` becomes true the first time speed is below 100% during a run.
- [ ] **Commit.**

### Task 2: Best times, history and records
- [ ] **Tests:** an assisted run never writes `pbs`, `bestSegments` or practice bests (06 §5.4) but still compares against them; unlocks, blueprints, accessories and discovered classes still count; `RunRecord.assist` is saved; old saves load with `assist: false` and default assist settings.
- [ ] **UI:** `ASSIST` under the run timer (07 §4.11); an `A` tag on assisted runs in Records.
- [ ] **Commit.**

### Task 3: Settings, practice and the offer
- [ ] Settings → **Assist** page (keyboard, gamepad and touch) with the four options and a line explaining that assisted runs don't set best times; during a run, the note "Applies from your next run" next to the locked three.
- [ ] Practice setup gets the same four options.
- [ ] The **offer** on the death screen after the 5th death before the Great Boar was ever beaten, shown once (`progress.assistOffered`).
- [ ] **E2E:** turn on 70% speed and 50% damage, start a run, take a hit (half damage), see the `ASSIST` tag, finish Stage 1 with debug helpers, check no PB was written. Screenshots of the Assist page and the tag. **Read them.**
- [ ] **Commit.**

## Part B — Polish from the SPEC-GAP answers

### Task 4: Small rule fixes
- [ ] **Wolf pacing** (04 §3): back and forth inside its band, turning after `0.6 + rng × 0.4` s or at the band's edge, always facing the player. Test with a fixed seed.
- [ ] **Venom Spit** (04 §8): the glob's own 420 px/s arc cap; test that a glob aimed 300 px away lands within 4 px of its target.
- [ ] **Time Slow** (03 §11.4): enemy status timers not slowed (matches the build already; just confirm with a test and remove the `SPEC-GAP` comment).
- [ ] **`parry` event** (02 §5.2 step 3) on a shield parry and on a Riposte block; the phone vibration (07 §8.6) uses it (SPEC-GAP 52).
- [ ] **HUD plate** 216 px wide (07 §4.1).
- [ ] **Commit.**

### Task 5: Full run summary and the hero on more screens
- [ ] Track the counters 07 §7.11 needs (chests opened, Lucky Blocks broken, flasks drunk, damage taken, classes discovered this run) in `RunStats` (06 §15.2 already lists them) and draw the **full run summary**: splits table with deltas and best-segment stars, the counters, the kit, the layout codes (06 §8.7), the Dragon outcome, unlocks.
- [ ] The hero's look (09 §7) on the class pick preview, the death screen and the run summary (a 2× portrait, idle).
- [ ] **Commit.**

### Task 6: View polish from the art notes
- [ ] Crossbowman `aim` frames (art note 20): pick the frame from the aim angle (5 steps).
- [ ] Dragon `wing_hop` pose (art note 22) during its Wing Hop.
- [ ] Enemy King: stretch the Throne Beam art over the beam's full hit rectangle, and draw the phase-3 gold aura (08 §7.4) (art note 23).
- [ ] Music ducking under `boss_roar_*`, `dragon_roar` and `jackpot` (08 §15) (art note 26).
- [ ] Screenshots of each. **Commit.**

### Task 7: Hand-off
- [ ] Run everything; push to `main`.
- [ ] Tell the user in plain words: "Assist mode is in Settings → Assist: slow the game to 85% or 70%, take less damage, get an extra flask charge, and longer timed doors. Assisted runs don't set best times but unlock everything as usual. The game also offers it after a few deaths in Stage 1." Plus the polish list in one line each. Send screenshots of the Assist page and the new run summary. Ask a friend who found it hard to try it.

## Done when
All tasks are checked and all checks pass.
