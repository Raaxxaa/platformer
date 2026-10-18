# M7: Villages, the Full Run Loop and Saving — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn "Stage 1 then a Stage clear screen" into a real run:
- **Title screen** → **Home Village** (pick a class at a statue, try it on the dummy, enter the Training Yard, walk out the gate) → **Stage 1** → **pick 1 of 3 stat upgrades** after the Great Boar → **Crossroads Village** (shop, sell and upgrade abilities, flask upgrade and refill, key, reroll) → **inn**: choose the road and sleep.
- Stage 2 doesn't exist until M7.1, so after the inn a **"To be continued"** screen shows the run so far.
- **Saving:** last kit, last road, personal bests, splits and best segments, run history, classes discovered, Training Yard progress, blueprints and unlocks, settings. Export and import codes.
- **Death screen**, **records screen**, a basic **settings** screen.

**Architecture:**
- Core: `src/core/run/` (full phase machine, transitions, splits, PBs), `src/core/economy/shop.ts`, `src/core/economy/stats.ts` (stat upgrades), `src/core/save/` (schema, migrate, validate, codec; pure).
- Phaser: `src/game/save/storage.ts` (`localStorage` I/O and dates), `VillageScene`, `TitleScene`.
- UI: shop price tags, inn card, route choice, stat pick, seed entry, death screen, records, settings, run-so-far screen.

**Tech Stack:** As before.

**Spec:**
- `docs/spec/06-run-levels-save.md`: §2 (all phases and transitions), §3 (route choice), §5 (timer, splits, PBs), §6 (death and restart), §7 (seeds; typed seeds from the seed board), §12 (villages, Home Village incl. `training_gate` and `mirror_spot`, Training Yard entry), §15 (save data, export/import), §16.
- `docs/spec/05-loot-economy.md`: §10 (shop stock, buying, reroll), §11 (prices), §13 (stat upgrades), §14 (blueprints and unlocks).
- `docs/spec/07-ui-hud-controls.md`: §4.14 (HUD in villages), §6.4–6.6 (shop, inn card, route choice), §6.7 (class pick, already built), §6.10 (toasts), §6.11 (stat pick), §6.12 (seed entry), §7.1–7.3 (menus, boot, title), §7.5 (records), §7.6 (pause, already built), §7.7 (settings), §7.9 (export/import), §7.10 (death screen).
- `docs/spec/04-enemies-bosses.md` §2.10 (Training Dummy in the Home Village).

**Starting point:** M5 on `main`. Merge `main` and `origin/claude/great-dijkstra-g00pcj` first. The village art is on `main` from ART3.

## Scope

**In M7:** everything in the Goal. The Home Village and Crossroads layouts are 06 §12.2–12.3 (tile positions for every object). Practice mode (06 §14) is **not** in M7 (M10).

**Later:** Stage 2 and the Border Village (M7.1); run summary for a finished run (M9, when Stage 4 exists; M7 shows the run-so-far screen instead); practice mode and ghosts (M10); controls rebinding screen (M10, keep M4.1's read-only CONTROLS tab).

## Global Constraints

- All earlier constraints hold.
- **The core never reads the clock or storage.** Dates and `localStorage` live in `src/game/save/storage.ts` (06 §15).
- **Every save read and write is wrapped in try/catch** and falls back to an in-memory save with a one-time warning (06 §15.1).
- **The run timer** counts exactly as 06 §5.1 says (villages count; the Home Village doesn't; transitions per 06 §2.2). Tests pin it.
- **Seeds:** the shop, stat pick and blueprint rolls use their 05 §2.1 streams. Same seed + same inputs = same shop.

## Review Focus

1. **Timer counting in the wrong phases** (06 checklist 7, 8).
2. **PB and best-segment rules** (06 checklist 9–12): segment 1 goes to both road keys; typed-seed runs never write PBs.
3. **Shop rules:** gold taken only when the item is actually taken; no duplicate ids; reroll prices; "Owned" (05 checklist 21–24, 28).
4. **Save corruption:** bad JSON, newer versions, failing `setItem` (06 checklist 27, 28).
5. **Iron Will / stat HP:** Vitality raises current HP too (05 checklist 25).

---

### Task 1: The full phase machine

**Files:** `src/core/run/runState.ts` (extend), `src/core/run/phases.ts`, tests.

- [x] **Tests:** 06 checklist 5, 6, 7, 8, 13 (King part later), 14, 32 (Guardian part); phases and transitions of 06 §2.1–2.2 (fade lengths, which ones the timer counts); after the Great Boar dies, `statPick` opens 1.0 s later; dying in that 1.0 s is a normal death; touching `exit` loads the Crossroads.
- [x] **Implement** 06 §2. **Commit.**

### Task 2: Stat upgrades

**Files:** `src/data/economy.ts` (stat table), `src/core/economy/stats.ts`, `src/ui/popups/statPick.ts`, tests.

- [x] **Tests:** 05 checklist 25, 26; each of the 12 upgrades hooks into the right system (02, 01, 03, 05) with its exact value; max stacks.
- [x] **UI:** 07 §6.11. Confirms during the first 0.30 s are ignored; no skip.
- [x] **Commit.**

### Task 3: Home Village

**Files:** `levels-src/village_home/` (generated JSON), `src/game/scenes/VillageScene.ts`, tests.

- [x] **Level** from 06 §12.1 and §12.3: 48 × 23 tiles, floor at row 20; class statues at 9, 13, 17, 21; mirror spot at 25 (decoration only); training dummy at 28; unlocks board at 34; seed board at 37; gate `exit` at 45–46; `training_gate` at 1–2.
- [x] **Behaviour:** spawn with `save.lastKit` (empty-handed on first launch); statues open the class pick and save `lastKit`; the gate refuses without a kit (`Choose a class at a statue first`); the first time a class is confirmed, ask "Try the Training Yard first?" (06 §12.3); the training gate enters the yard, and leaving it returns here; the unlocks board opens records; the seed board opens seed entry (07 §6.12).
- [x] **Art:** ART3's Home Village background, cottages, well, statues, gate, mirror frame, villagers, dummy.
- [x] **Tests:** the gate starts a run only with a kit; `lastKit` persists across a reload; the timer doesn't run here.
- [x] **Commit.**

### Task 4: Crossroads Village and the shop

**Files:** `levels-src/village_crossroads/`, `src/core/economy/shop.ts`, `src/ui/popups/shop.ts`, tests.

- [x] **Level** from 06 §12.2: shop items at 9, 12, 15; ability altars at 19, 22; flask upgrade 26; refill 29; key 32; reroll 35; inn at tiles 41–43, rows 16–19.
- [x] **Shop** (05 §10–11): stock on `enterVillage` (slot 1 B or better; slots 2–3 40% ability; no duplicate ids; key 50%); buying through the pickup and swap rules (gold taken only when taken); `Owned`; altar **tap** upgrades, **hold 0.75 s** sells (06 checklist 23); flask upgrade up to 4; refill only when not full; key up to 3; reroll 50, 100, 150 … refilling SOLD slots.
- [x] **Tests:** 05 checklist 4, 21, 22, 23, 24, 28; 06 checklist 22, 23.
- [x] **Art:** ART3's Crossroads background, market roof, inn, props, shopkeeper, innkeeper, merchant.
- [x] **Commit.**

### Task 5: Inn, route choice and "To be continued"

- [x] **Inn** (06 §12.2, §3): interact opens the route choice (07 §6.6) with the cursor on `save.lastRoad`; confirm sets `road`, saves `lastRoad`, sleeps (fade out 0.5 s, HP = max at the end of the fade out, fade in 0.5 s; the timer counts both).
- [x] **Until M7.1:** after the sleep, show a **"To be continued"** screen with the run so far (time, split 1, kit, gold, kills) and buttons Restart / Home Village / Title. Mark it `// SPEC-GAP: placeholder end until Stage 2 (M7.1)`; design chat's choice, no `SPEC-GAPS.md` entry.
- [x] **Tests:** 06 checklist 8 (inn adds exactly 120 ticks), 35 (road key, not level id).
- [x] **Commit.**

### Task 6: Timer, splits and PBs

**Files:** `src/core/run/splits.ts`, `src/ui/hud/timerBlock.ts`, tests.

- [x] **Tests:** 06 checklist 1, 9, 10, 11, 12; the split popup and timer block (07 §4.11) show the delta in green/red.
- [x] **Implement** 06 §5.2–5.3. **Commit.**

### Task 7: Save data

**Files:** `src/core/save/schema.ts`, `migrate.ts`, `validate.ts`, `codec.ts`, `src/game/save/storage.ts`, tests.

- [x] **Tests:** 06 checklist 27, 28; validation fills defaults and drops bad entries one by one; history keeps max 20, newest first, and skips short restarts/quits; write moments of 06 §15.1; `.bak` and `.corrupt` handling; `save.training` holds Training Yard progress (06 §12.4); `classesDiscovered` from M4's event.
- [x] **Implement** 06 §15. **Commit.**

### Task 8: Blueprints and unlocks

- [x] **Tests:** 05 checklist 27, 30 (the King part becomes testable in M9; test the unlock function directly now); elites 2%, Guardians 25%; a collected blueprint joins the pool from the next random-seed run; typed-seed runs use the full pool and drop none.
- [x] **Note:** most locked items (Scythe, Flail, Hand Cannon, Javelin, Spell Tome, Riposte, Boulder Toss, Turret, Time Slow) aren't built until M9. A blueprint for an unbuilt item is still saved, but the pool stays `unlocked ∩ implemented` (M5).
- [x] **Commit.**

### Task 9: Title, death screen, records, settings, export/import

- [x] **Title** (07 §7.3): `Play` (→ Home Village), `Training Yard`, `Records`, `Settings`. Replaces M4.1's start screen. The boot screen (07 §7.2).
- [x] **Death screen** (07 §7.10, 06 §6.1): time, stage and section, cause, seed; Restart / Change class / Title; restart allowed from 0.25 s.
- [x] **Records** (07 §7.5): tabs `BEST RUNS`, `CLASSES`, `UNLOCKS`.
- [x] **Settings** (07 §7.7): every setting there whose feature exists today; leave out the rest. **Export/import** (07 §7.9, 06 §15.3).
- [x] **Commit.**

### Task 10: E2E and hand-off

- [x] **E2E** `tests/e2e/run.spec.ts`: title → Home Village → pick Tank at the statue → gate → Stage 1 (`?debug=1` helpers to skip to the boss and kill it) → stat pick → Crossroads → buy an item, upgrade an ability, sell one → inn → Forest road → "To be continued". Reload the page and check `lastKit`, `lastRoad` and the PB/best segment were saved. Screenshots of every screen; **read them**.
- [x] **Determinism:** same seed + same inputs give the same shop stock and stat offer.
- [x] **Run everything; push to `main`.** Typecheck, 989 unit tests, build, and 91 browser tests passed. Milestone `c492149` was pushed to `main`; Pages deployment is verified separately before the next milestone starts.
- [x] **Hand-off:** "You can now play a real run: start in the Home Village, beat Stage 1, pick an upgrade, shop in the Crossroads and choose your road at the inn. Your best times and settings are saved." Ask: is the village too slow to walk through? Are prices fair for the gold you have? Which stat upgrade did you pick?

## Done when

All tasks are checked, all checks pass, and the 06 and 05 checklist items named above have passing tests.

**Next plan:** `M7.1-stage2-two-roads.md`.
