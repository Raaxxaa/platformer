# M10: Speedrun extras (seeds, practice mode, ghosts, balance checks)

**Goal:** the speedrun extras from GAME_PLAN 6.4 and 14: type a seed for races, practise any stage you reached with a fixed loadout, and race a ghost of your best practice attempt.

**Status: in progress (started 2026-10-22).**

**Spec:** `docs/spec/06-run-levels-save.md` §7 (seeds), §14 (practice mode and ghost replay), §16 (debug params); `docs/spec/07-ui-hud-controls.md` §3 (info line, practice timer), §6.12 (seed entry), §7.3, §7.4 (practice setup and result), §7.6 (pause in practice); `docs/spec/04-enemies-bosses.md` §13 (Dragon in practice); `docs/spec/03-classes-abilities.md` §13 and `docs/spec/06-run-levels-save.md` §8.2 (balance numbers).

## What already exists (checked before writing this plan)

- **Seeds:** `fnv1a32` / `deriveSeed` / seeded streams (`src/core/rng.ts`), random 8-letter seeds (`src/game/seed.ts`), the Home Village seed board (`src/ui/home/homePanels.ts`), `save.typedSeed`, `?debug=1&seed=`, seeded runs never write PBs or best segments (`src/core/run/splits.ts`), `SEED x` in the pause menu, death screen, victory screen and HUD info line.
- **Practice:** only the flag `GameWorldOptions.practice` (suppresses PBs, unlocks and history) and the `practiceBests` save field with its validation. There is no setup menu, no preset loadout, no result screen, no best-time write.
- **Ghosts:** nothing.
- **Balance:** the weapon DPS check (`src/data/weapons.test.ts`); stage scaling tables in `src/data/`.

## Tasks

| # | Task | Files | Tests |
|---|---|---|---|
| 1 | Practice rules (pure): available levels, preset loadout per stage, class element, Dragon option, key, best-time compare | `src/data/practice.ts`, `src/core/run/practice.ts` | `practice.test.ts`: preset table rows, class elements, levels from `levelsReached`, Dragon option to roll, `applyPracticeTime` |
| 2 | Practice in the world: preset applied (HP, flask, keys, gold), no split or stat pick or run end, boss death emits `practiceCleared` with `stageTicks`, restart reloads the same level in place | `src/core/sim/gameWorld.ts` | `practiceWorld.test.ts`: each stage preset, boss death time, restart keeps setup, no `split` |
| 3 | Practice saves: write `practiceBests` only when faster, emit `practiceBestSaved`, nothing else is saved | `src/game/session.ts` | `session.test.ts` additions |
| 4 | Practice menu and flow: Title `Practice` row, setup screen (§7.4), start, HUD (`PRACTICE`, practice time), pause items, death restarts, result screen | `src/ui/screens/practice.ts`, `src/game/scenes/TitleScene.ts`, `StageScene.ts`, `src/ui/model/pauseModel.ts`, `src/ui/hud/timerBlock.ts` | model tests for setup rows and result; pause model; timer block |
| 5 | Ghost codec and storage (pure): 6-byte samples, base64url, 12 000 cap, `rushblade.ghosts` read and write in try/catch, ticks must match the practice best | `src/game/ghost/codec.ts`, `src/game/ghost/store.ts` | round trip, cap, bad JSON, mismatch ignored |
| 6 | Ghost recording and playback: one sample per 2 ticks from the player sprite, stored on `practiceBestSaved`, drawn as the body at alpha 0.4 | `src/game/ghost/`, `StageScene.ts`, `EntitySprites.ts` | sample index math; e2e |
| 7 | Seeds: tests that pin the existing rules (same seed same run, seeded run writes no records), practice shows the seed row | `src/core/sim/*.test.ts`, practice menu | determinism, no-record tests |
| 8 | Balance checks: boss-HP floor times (06 §8.2) and the HP scaling tables (00-README, 03 §13) checked from the data tables; numbers that disagree become SPEC-GAPs, not edits | `src/data/balance.test.ts` | the checks themselves |
| 9 | E2E: enter a seed, start practice for a stage and for the boss, a ghost replays a best | `tests/e2e/m10.spec.ts` | screenshots |

**Done when:** typecheck, unit tests, build and e2e pass; screenshots read; SPEC-GAPs from 42 on are in `docs/SPEC-GAPS.md`.
