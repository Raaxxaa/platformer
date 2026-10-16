# 06 — Run Flow, Levels, Timer, Seeds, Save

This file defines how a run flows from the Home Village to the King, how stages and villages are built and stored, the timer and splits, seeds, death and restart, practice mode, and the save file. Read `00-README.md` first (units, 120 ticks/s, architecture, shared numbers).

**This file owns:** the run state machine; route choice; the Dragon spawn rule; the stage template and target sizes; object counts and placement per stage; the level file format (Tiled JSON layers and every object type with its properties); arenas, waves and door locking; timed doors; level hazards (cannons, falling rocks, swinging blades); interaction ranges and items lying on the ground; the wandering merchant's layout; village layouts and interactables; the run timer, splits and personal bests; seeds and RNG stream derivation; death and instant restart; practice mode and its ghost replay; save data, storage, export and import.

**Only referenced here:**
- `01-movement.md`: tile kinds and their physics, collision, `SolidBody`, collapsing platforms, minecart, grapple points, `teleport()`, camera zones, `InputState` (incl. `restart`), reach table (§10.4).
- `02-combat.md`: hurt pipeline, i-frames, flask (`addFlaskFill`), Rush resets, Lucky Block break rule, weapon slot rules (§9.5).
- `03-classes-abilities.md`: starting kits, ability pickup and swap choice (§7.1), Lv1 ability numbers, `classDiscovered`, cracked-wall breaking.
- `04-enemies-bosses.md`: enemy ids, spawn properties, dormancy, spawn-in, scaling, boss arena sizes and intro, Dragon behavior, `bossDefeated`.
- `05-loot-economy.md`: what every chest, stand, Lucky Block, shop and merchant contains; keys, curses, buffs, gold; stat upgrade options; blueprints and unlocks.
- `07-ui-hud-controls.md`: how every screen and popup looks, settings fields and defaults, bindings. `08-art-audio.md`: tile art, autotiling, parallax, VFX, SFX, music.

**Code:** `src/core/run/` (state machine, timer, splits, restart), `src/core/level/` (loader, validator, arenas, hazards, interaction), `src/core/rng.ts` (seed derivation), `src/core/save/` (schema, migrate, validate, codec: pure). `src/game/save/storage.ts` does the `localStorage` I/O and dates; `src/game/ghost/` records, stores and draws practice ghosts (M10). Numbers go in `src/core/tuning.ts` as `RUN` and `LEVEL`.

---

## 1. The run at a glance

```
Home Village ─gate─▶ Stage 1 Plains & Forest (Great Boar)
  ─▶ Crossroads Village (choose road at the inn)
  ─▶ Stage 2 Caves & Mountains (Stone Colossus)  OR  Dark Forest & Swamps (Spider Queen)
  ─▶ Border Village ─▶ Stage 3 Enemy Kingdom (Black Knight)
  ─▶ Rebel Camp ─▶ Stage 4 King's Castle (Enemy King) ─▶ Run summary
Dragon (30% of runs): perched in the side arena of Stage 2 or Stage 3.
```

| Id | Kind | Stage no. | Boss |
|---|---|---|---|
| `home` | village | 0 | — |
| `plains` | stage | 1 | `great_boar` |
| `crossroads` | village | — | — |
| `mountains` | stage | 2 (Mountain road) | `stone_colossus` |
| `swamps` | stage | 2 (Forest road) | `spider_queen` |
| `border` | village | — | — |
| `kingdom` | stage | 3 | `black_knight` |
| `rebel_camp` | village | — | — |
| `castle` | stage | 4 | `enemy_king` |

Death restarts the **whole run** from Stage 1 (assumption A2, see GAME_PLAN 0). Layouts are **hand-made and the same every run** (A4).

---

## 2. Run state machine

### 2.1 Phases

| Phase | World simulates | Run timer counts | Gameplay input | Leaves to |
|---|---|---|---|---|
| `title` | no | no | menus (07) | `homeVillage`, practice setup menu (07, §14) |
| `homeVillage` | yes | no (run not started) | yes | `transition` (gate) |
| `transition` | frozen | yes, if the run has started | no | next scene |
| `loading` | no | no | no | `transition` (fade in) |
| `stage` | yes | yes | yes | `statPick`, `transition`, `dead`, `runComplete` |
| `statPick` | frozen | yes | popup (07) + `restart` | `stage` |
| `village` | yes | yes | yes | `routeChoice`, `transition` (sleep) |
| `routeChoice` | frozen | yes | popup (07) + `restart` | `transition` (sleep), `village` (cancel) |
| `dead` | yes for 1.0 s, then frozen | no (stopped on the death tick) | only `restart` | death screen → restart / `homeVillage` / `title` |
| `runComplete` | frozen | no (stopped on the King's death tick) | no | run summary → restart / `homeVillage` / `title` |
| `paused` (overlay) | no | **no** | menus (07) | the phase it paused |

- "World frozen" = the core still ticks (run timer, restart hold), but no entity, timer or status advances.
- The game auto-pauses (opens `paused`) when the window loses focus or the tab becomes hidden.
- Other gameplay popups (swap choices and the weapon swap popup, Lucky Block result, split popup, shop prompts) never change the phase and never stop the run timer. If 07 freezes the world for one of them, the run timer still counts.

### 2.2 Transitions (fixed lengths)

| Transition | Fade out | Fade in | Counted by the run timer |
|---|---|---|---|
| Home Village gate → Stage 1 | 0.5 s | 0.5 s | no (run starts after) |
| Stage exit → village | 0.5 s | 0.5 s | yes (1.0 s) |
| Inn sleep → next stage | 0.5 s | 0.5 s | yes (1.0 s, the plan's "1-second fade") |
| Instant restart → Stage 1 | none (cut) | 0.25 s | no |
| Death screen / summary → Home Village | 0.5 s | 0.5 s | no |

- Asset and level loading happens in `loading`, between fade out and fade in. It is never timed.
- During fades the world is frozen and input is ignored (including `restart`).
- The camera snaps on every scene start (01 §14.3).

### 2.3 Run start
1. The player picks a kit at a class statue in the Home Village (§12.3). The kit is saved as `lastKit`.
2. The player touches the gate `exit`. If no kit is chosen, nothing happens (07 shows "Choose a class first").
3. A new `RunState` is made: seed (§7), Dragon roll (§4), `runTicks = 0`, splits empty, `road = null`.
4. Fade out, load `plains`, fade in.
5. **Tick 0 of the run** is the first tick of Stage 1 where the player has control. `runTicks` and `stageTicks` start counting from there.
6. `stats.runsStarted += 1` and `plains` is added to `levelsReached` (save is written).

### 2.4 Stage start (every stage)
- The player appears at `player_start`, facing its `facing`, with the run's current loadout, HP, flask, gold and keys.
- `stageTicks = 0`. All stage objects are fresh: Lucky Blocks, chests, cracked walls, collapsing platforms, doors, timed doors.
- RNG streams with stage scope are re-derived (§7.2).
- Other files' stage-start resets apply: Rush and statuses (02), ability charges, link and Lockpick (03), Lucky Block buffs end at stage end (05).
- Stage 1 only: the run starts with full HP and a full flask (02).

### 2.5 Stage clear (Stages 1–3)
On the tick the stage boss dies (`bossDefeated`, 04):
1. Record the split (§5.2). The run timer keeps running.
2. The boss arena's `exit` door opens. Boss loot spawns (04 §9.6).
3. **1.0 s later** the phase becomes `statPick`: 05 offers 3 stat upgrades and 07 draws them. The world is frozen; the run timer runs. The player must pick one (no skip).
4. Back to `stage`. The player may collect loot, then walks through the exit door and along the road (12–20 tiles) into the stage `exit` zone.
5. Touching `exit` → transition → the next village.

If the player dies during the 1.0 s before the pick (e.g. from Burning), it is a normal death (§6).

Special cases for `bossDefeated` (all bosses):
- **Same tick:** if a Stage 1–3 boss and the player reach 0 HP on the same tick, record the split (§5.2, best segments included), then the death applies (§6): no stat pick. (The Enemy King case is §2.6: the run completes.)
- **During `dead`:** while the phase is `dead`, `bossDefeated` is ignored for splits and run completion (e.g. a boss dying from damage over time during the player's 1.0 s death phase, or the King dying then). The Dragon outcome does not change either.
- **The Dragon** (`bossId: 'dragon'`) is not a stage boss: see §4. It never records a split, opens a door or starts a stat pick.

### 2.6 Run complete (Stage 4)
- On the tick `bossDefeated {bossId: 'enemy_king'}` fires: record split 4. `runTicks` stops. Phase → `runComplete`. This **wins over** a player death on the same tick.
- The King's 1.5 s death animation plays (world frozen otherwise), then the run summary opens (07).
- The save is updated (PB, best segments, history, stats) before the summary opens.

### 2.7 What the run keeps between stages
Carried: weapons, abilities and their levels, HP (restored only by the inn), max HP, flask charges and fill bar, gold, keys, stat upgrades, curses and debuffs still running (05 decides their lifetimes), the start kit, seed, road, Dragon roll. Not carried: items lying on the ground, opened chests, enemy state.

### 2.8 Order inside one tick
After 02's tick steps 1–10 (01 and 04 run inside them), this file adds:
- **Step 5 (with enemy AI):** hazard timers advance and hazards spawn their projectiles (§10). Hazard projectiles move in step 6 and hit in step 7b (02).
- **Step 11, level logic:** interaction (§11), key and item pickups, triggers (`hint`, `dragon_warning`, timed door triggers), arena lock / waves / clear (§9), stage `exit`.
- **Step 12, run logic:** restart hold (§6.2), death check, split and run-complete events, phase changes. Phase changes take effect from the next tick.

---

## 3. Route choice
- Happens at the **Crossroads Village inn** (assumed: the player chooses, GAME_PLAN 15.3 #1). Interacting with the inn opens the route choice popup (07) instead of sleeping right away. Phase `routeChoice`.
- Two options: **Mountain road** (`road = 'mountain'`, loads level `mountains`) and **Forest road** (`road = 'forest'`, loads level `swamps`). PB keys and `lastRoad` always use the `Road` value (`tank|forest`), never the level id. The cursor starts on `save.lastRoad` (default Mountain), so a repeat runner can confirm with one press.
- Confirm → `road` is set, `lastRoad` is saved, then the normal inn sleep runs. Cancel → back to `village`; nothing changes.
- Both roads are available from the first run.

---

## 4. Dragon spawn rule
Rolled once at run start on the `dragon` stream with scope `run` (§7.2). **Always draw all three numbers, in this order**, so seeds stay stable:

| Draw | Rule |
|---|---|
| `r1` | Dragon present if `r1 < 0.30` |
| `r2` | Stage 2 if `r2 < 0.5`, else Stage 3 |
| `r3` | Color `['red','white','storm','green'][floor(r3 × 4)]` |

- If present, the Dragon is spawned at load of that stage, **perched** in the stage's side arena (§9.4). 04 runs it from there. On either Stage 2 road it uses that road's side arena.
- The first time the player's center enters the stage's `dragon_warning` zone, emit `dragonWarning {color}` once (08: shadow and roar; 07: warning banner). The zone does nothing in stages without the Dragon.
- Dragon outcome for the summary and history: `absent`, `skipped` (stage left, Dragon never damaged), `escaped` (damaged, not killed), `killed`.
- **Dragon kill:** `bossDefeated {bossId: 'dragon'}` (04 §9.5) only sets `dragon.outcome = 'killed'` and `save.stats.dragonsKilled += 1` (normal runs only; practice writes nothing but `practiceBests`, §14). No split, no door and no stat pick. Ignored while the phase is `dead` (§2.5).
- If the run dies before that stage, the Dragon never appears. Practice mode has its own Dragon option (§14).

---

## 5. Timer, splits and personal bests

### 5.1 Clocks

| Clock | Starts | Counts in phases | Used for |
|---|---|---|---|
| `runTicks` | 0 at run tick 0 (§2.3) | `stage`, `statPick`, `village`, `routeChoice`, timed `transition`s. Also during hit-stop | Run time, splits |
| `stageTicks` | 0 at each stage start | `stage`, `statPick` | Timed doors, practice time, death screen |

- Both are integer tick counts (README). Displayed seconds = ticks / 120.
- **Time format** `formatTime(ticks)`: `cs = floor(ticks × 100 / 120)`. Under one hour: `m:ss.cc` (e.g. 12 345 ticks → `1:42.87`). From one hour: `h:mm:ss.cc`.
- **Delta format** `formatDelta(ticks)`: sign always shown (`+` or `−`; 0 shows `±0.00`). Under 60 s: `s.cc` (e.g. `−3.25`). Otherwise `m:ss.cc`.
- The timer can be hidden in settings (07). It still counts.

### 5.2 Splits
- There are **4 splits**, one per stage boss death. `splits[k]` = `runTicks` on the tick the stage-k boss dies (cumulative).
- Segment k = `splits[k] − splits[k−1]` (with `splits[0] = 0`). So segment 2 includes the end of Stage 1, the Crossroads Village and Stage 2.
- The run's final time = `splits[4]`.

### 5.3 Personal bests
- **PB key** = `${startClass}|${road}`, e.g. `tank|forest`. 4 classes × 2 roads = 8 PBs. The start class is the class of the kit picked at a statue, not the class shown on the HUD later.
- **Comparison run** for deltas:
  - Before the road is chosen (split 1): the faster of the class's two road PBs. If neither exists, no comparison.
  - After: the PB for the chosen road. If none, no comparison.
- On each split emit `split {index, runTicks, segmentTicks, deltaTicks | null, bestSegment}`. `deltaTicks = runTicks − comparison.splits[index]`. 07 shows green when `deltaTicks < 0`, red when `> 0`.
- **Best segments** (per PB key, 4 values): written at the split even if the run later dies.
  - Segment 1 is road-free: compare and write it to **both** of the class's keys.
  - Segments 2–4: the chosen road's key.
  - `bestSegment` is true when the segment is lower than the stored best (or none was stored).
- **PB update:** on run complete, if the run counts (below) and there is no PB for the key or `splits[4] < pb.ticks`, replace the PB with this run's splits. Emit `pbSaved`.
- **Runs that never write PBs or best segments:** typed-seed runs (assumption, §7.1), practice runs. They still compare against the PBs.

---

## 6. Death and instant restart

### 6.1 Death
1. 02 reports HP ≤ 0 with no Second Wind. That tick: phase `dead`, `runTicks` stops, emit `playerDied {cause}` (`cause` = the enemy id of the killing hit, `'hazard'`, `'spikes'`, or the status id `'burning'` / `'poisoned'`; 02 §5.2 step 6 passes it).
2. For **1.0 s** the world keeps simulating (death animation; enemies keep moving, they cannot hurt a dead player). Then it freezes and the death screen opens (07).
3. The death screen shows: time of death, stage and section reached (`section` zone index, §13.4), cause, seed. Options: **Restart** (same kit), **Change class** (→ Home Village), **Title**.
4. **Restart from death:** a fresh `restart.pressed` (no hold) counts from **0.25 s** after the death tick. Earlier presses are ignored. Confirming "Restart" in the menu does the same.
5. Save: `stats.deaths += 1`, a history entry (`result: 'death'`). No PB write.

### 6.2 Instant restart (hold)
- Allowed in phases `stage`, `statPick`, `village`, `routeChoice`. Ignored in `homeVillage`, `transition`, `loading`, `paused`, `runComplete` (the summary has its own Restart option).
- `restartHoldTicks += 1` on every tick `restart.held` is true; set to 0 on any tick it is false. When it reaches **60 ticks (0.5 s)**, restart. 07 draws a ring showing `restartHoldTicks / 60`.
- After any restart, the hold counter stays at 0 until `restart.held` has been false for at least one tick. Holding through a restart never restarts twice.
- **What restart keeps:** the start kit `(class, weapon)` (03 §3). A typed seed is kept; a random seed is replaced with a new random seed. In practice mode, restart keeps the practice settings (§14).
- **What restart does:** ends the current run (history `result: 'restart'` if `runTicks ≥ 30 s`), skips the Home Village, builds a new `RunState` (§2.3 steps 3–6) and loads Stage 1 with a cut and a 0.25 s fade in.
- The pause menu also has "Restart run" and "Quit to Home Village" (history `result: 'quit'` if `runTicks ≥ 30 s`).

---

## 7. Seeds and random streams

### 7.1 Seed text
- A seed is text of **1–12 characters**, `A–Z` and `0–9`. Typed lowercase is turned into uppercase; other characters are refused by the input (07).
- **Random seeds** are 8 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, made by the Phaser layer with `crypto.getRandomValues` (never `Math.random`; the core only receives the text).
- `runSeed = fnv1a32(seedText)` (32-bit FNV-1a over the UTF-8 bytes; offset basis `0x811C9DC5`, prime `0x01000193`), as an unsigned 32-bit integer.
- **Typed seeds:** entered at the Home Village seed board (§12.3). The seed applies to every run started until it is cleared. A run with a typed seed has `seeded: true` and does not write PBs (assumption: otherwise a known easy seed could set records). The seed is shown on the pause menu, death screen and run summary.

### 7.2 Stream derivation
- `deriveSeed(runSeed, stream, ...keys) = fnv1a32([runSeed, stream, ...keys].join(':'))` (keys are strings or integers, written in decimal); if the result is 0, use 1. A generator is `mulberry32(deriveSeed(...))`. This is the shared helper in `src/core/rng.ts`.
- **Per-source generators:** 05 makes a fresh generator for every loot source with extra keys (05 §2.1, e.g. `('loot', levelId, objectId)`). Nothing to do here beyond the helper.
- **Long-lived streams** are created when their scope begins and use the scope as their one key. Using a stream in one scope never shifts another scope's numbers.

| Scope key | When created | Long-lived streams |
|---|---|---|
| `'run'` | Run start | `dragon` (§4) |
| `1`–`4` (stage number) | Each stage start | `enemyAI` (04), `enemyDrops` (04), `combat` (02), `cosmetic` (01) |
| `'home'`, `'crossroads'`, `'border'`, `'rebel_camp'` | Each village start | `combat`, `cosmetic` |

- Other files may add streams by name with the same helper.
- Practice mode uses the same derivation with the practiced stage's number.
- Same seed + same inputs = same run, tick for tick (test in the checklist).

---

## 8. Stage template and target sizes

### 8.1 Time targets
From GAME_PLAN 1.2: a stage takes **5–7 min the first time** and **~1:45 for a good speedrunner** (Stages 3–4 run longer because of boss HP, §8.2). Planning speeds: a speedrunner moves about **200 px/s** on traversal (dash chains, Rush); a first-time player about **80–100 px/s** plus fighting time.

### 8.2 The 8 sections
Every stage chains these 8 sections, in order (GAME_PLAN 7.5). Length = main path length in tiles (§13.4 `main_path`). Times are planning targets, not tested.

| # | Section | Main path (tiles) | Regular mobs | Elites | Speedrunner | First time |
|---|---|---|---|---|---|---|
| 1 | Start: short run-in | 30–40 | 0 | 0 | 4 s | 15 s |
| 2 | Combat stretch: 3–4 mob groups on open ground | 100–120 | 10 | 1 | 14 s | 60 s |
| 3 | Traversal: biome gimmick | 110–130 | 4 | 0 | 13 s | 45 s |
| 4 | Branch: main path, side path, skip route | 100–120 (+60–90 side path) | 8 (6 main, 2 side) | 1 (side) | 11 s | 60 s |
| 5 | Arena: doors lock, waves | 38 (one locked screen) | 9 (in waves) | 1 (last wave) | 12 s | 35 s |
| 6 | Traversal 2: harder gimmick | 130–150 | 5 | 0 | 15 s | 50 s |
| 7 | Loot area: chests, timed door | 70–90 | 4 | 1 | 8 s | 45 s |
| 8 | Boss arena + road to exit | 36–40 + 12–20 | 0 | boss | Stage 1 / 2 / 3 / 4: 25 / 30 / 45 / 45 s | 55 s |
| | **Total** | **650–730** | **40** | **4** | **~1:42 / 1:47 / 2:02 / 2:02** | **~6:05** |

- **Section 8 speedrunner times are per stage** because boss HP sets a floor even at 100% uptime with Rush 3 (×1.15 attack speed, 02 §8.3): Stone Colossus 1,530 HP ÷ (B-matched 56 × 1.15 ≈ 65) ≥ 24 s; Black Knight 3,120 ÷ (A-matched 72 × 1.15 ≈ 83) ≥ 38 s; Enemy King 3,960 ÷ (S-matched 90 × 1.15 ≈ 104) ≥ 38 s (04 §9.1 HP).
- **Full run at these targets:** 4 stages ≈ 7:33, plus 3 villages (~10 s each, GAME_PLAN 6.2) and 6 s of timed fades ≈ **8:10**, at the top of the plan's ~7–8 min (GAME_PLAN 1.2). Decided by the design chat: the Enemy King's base HP is 1,100 (3,960 at Stage 4) to keep the run near 8 min.

**Road differences** (GAME_PLAN 7.2: Mountain = more climbing, Forest = more fighting). Stages 1, 3, 4 use the default column.

| Section | Default | `mountains` | `swamps` |
|---|---|---|---|
| 2 | 10 | 10 | 12 |
| 3 | 4 | 2 | 4 |
| 6 | 5 | 3 | 7 |
| **Total regulars** | **40** | **36** | **44** |

- Regular mobs are only the stage biome's 4 regular types (04), in the **exact per-type mix of 05 §9.5** (it sets the gold budget). Elites are only the biome's elite. Wolves and War Hounds are placed in packs (04 traits) sharing a `group`.
- **Arena waves:** Stage 1 has 2 waves (4, then 5 + the elite). Stages 2–4 have 3 waves (3, 3, then 3 + the elite).

### 8.3 Per-level size and gimmicks

| Level | Max size (W × H tiles) | Gimmicks and where |
|---|---|---|
| `plains` | 720 × 96 | Teaches moves (`hint` zones, §13.3). §3: open fields, first gaps, first wall-jump shaft, first slide tunnel. §4: tree-top skip route (wall jumps, dash-jumps) above the ground main path. §6: forest canopy with one-way branches. Spike pits only from §3 on. |
| `mountains` | 560 × 176 | §3: vertical climb of ≥ 60 tiles with `falling_rocks`. §4: skip through a `cracked_wall` or grapple points. §6: icy peaks (ice tiles), then a minecart ride of ≥ 120 tiles down into the caves. |
| `swamps` | 720 × 96 | Swamp water covers ≥ 30% of the floor length in §2, §3, §6. `dark_zone`s with fireflies in §3 and §6. Grapple-vine skip route in §4. |
| `kingdom` | 720 × 112 | §4: town streets (main) vs rooftops (skip, 20–30 tiles above). ≥ 3 cannons each in §3 and §6. Crossbowmen on walls and rooftops. |
| `castle` | 640 × 144 | Spike floors, ≥ 4 swinging blades and ≥ 3 collapsing bridges across §3 and §6. A cannon gallery in §6. Wall-jump towers. |

### 8.4 Object counts and placement (every stage)

| Section | Objects |
|---|---|
| 1 | `loot_stand` #1 (`kind: 'weapon'`) on the main path |
| 2 | `lucky_block` #1 on the main path; elite #1 |
| 3 | `lucky_block` #2 on the main path; `key` #1 at the end of a short hard-jump detour (≤ 5 s) |
| 4 | Side path: `key_chest` #1, `cursed_chest`, elite #2, `loot_stand` #2 (`kind: 'ability'`) at its end. A skip route that saves 6–10 s. The cursed chest sits before the arena so its 10 kills (05) can be made there |
| 5 | Combat arena (§9.2); elite #3 in the last wave |
| 6 | `lucky_block` #3; `key` #2 after a hard jump section (detour ≤ 8 s); `merchant_spot` on the main path; side arena + `dragon_warning` (Stages 2 and 3 only) |
| 7 | `lucky_block` #4; `key_chest` #2 and #3; `timed_door` + `timed_chest`; elite #4 |
| 8 | Boss arena (§9.3), road, `exit` |

Totals per stage: **4** Lucky Blocks, **2** free loot, **2** keys, **3** key chests, **1** cursed chest, **1** timed door, **1** merchant spot, **4** placed elites (wave elite included). Keys always come before the chests they are meant for, so 2 keys open 2 of the 3 chests (Lockpick, 03, gives a third). Elite key drops (04) are extra.

### 8.5 Movement limits for level design
Built on 01 §10.4 and 03 §7.2 (always assume Lv1 abilities).

| Route | May require |
|---|---|
| Main path | Rises up to 5 tiles (jump + ledge grab); up to 7 tiles with a double jump from §3 on. Onto one-way platforms (no ledge grab, 01 §10.1; only the 6 px apex assist, 01 §2.7): up to 3 tiles with one jump (56 + 6 = 62 px; 4 tiles = 64 px fails) and 6 tiles with both jumps (96 + 6 = 102 px; 7 tiles fails). Gaps up to 5 tiles (Stage 1 §1–§2: 3 tiles up, 4 across). Wall-jump shafts 3–5 tiles wide (48–80 px between the walls; 4 tiles = 64 px is the default, playtest feedback: wider shafts were hard to control). 1-tile slide/crawl gaps. Air dash from Stage 1 §3 on. **Never** an ability, a grapple point or a dash-jump-only gap |
| Side paths | Main path rules (the one-way rise limits included: 3 tiles with one jump, 6 with both) + dash-jump gaps up to 7 tiles |
| Skip routes | Anything 01 allows (without an ability, rises onto one-way platforms keep the 3 / 6 tile limits above), or a Lv1 ability: grapple points within 150 px of a reachable spot; Blink walls ≤ 3 tiles (48 px) thick; `cracked_wall`s (Shoulder Charge) |
| Everywhere | No bottomless pits (01 §2.3); block areas with ceilings, not tall walls alone (01 §8); `guide_arrow` at every fork pointing along the main path |

---

## 9. Arenas, doors and the side arena

### 9.1 Shared
- An `arena` object is the **inner rectangle**. The loader adds a `whileLocked` camera zone (01 §14.3) equal to it, for kinds `combat` and `boss`.
- `arena_door` objects are `SolidBody`s with `noTeleport: true`, 1 tile wide and at least 3 tiles tall, set in the arena walls at floor level.
- **Lock:** on the first tick the player's hurtbox is fully inside the arena rectangle, every door of that arena becomes active (solid) and emit `arenaLocked {arenaId}`.
- The arena counts as **locked** (for 01's camera zone and 04) from that tick until its doors open: combat = 0.5 s after the clear; boss = the `bossDefeated` tick. An arena locks only once per stage visit.
- Placed (non-wave) enemy spawns inside a combat arena rectangle are not allowed (validator).

### 9.2 Combat arena (section 5)
- Inner size **38 × 18 tiles** (allowed 34–40 × 14–20), flat floor, 2–4 one-way platforms. Both doors open at stage load.
- On lock: wave 1 spawns. Each spawn plays 04's 0.5 s spawn-in and starts aware.
- **Next wave** spawns **0.75 s** after the last enemy of the current wave dies.
- **Stuck rule:** a wave enemy whose feet are outside the arena rectangle for 3.0 s in a row is moved back to its spawn point.
- **Clear:** the tick the last enemy of the last wave dies. `clearTime = clear tick − lock tick`. At once: `addFlaskFill(400)` (40%) if `clearTime ≤ parTime`, else `addFlaskFill(250)` (25%) (02 §7.3). Emit `arenaCleared {arenaId, clearTicks, fast}`. **0.5 s later** all doors open.
- `parTime` default by stage: **Stage 1: 20 s · Stage 2: 24 s · Stage 3: 29 s · Stage 4: 32 s**. That is about 2× the arena's pure kill time with a class-matched weapon of the expected grade: total HP (9 regulars + the elite, 04 base HP × `mobHp`) ≈ 484 / ~680 / ~920 / ~1,160, against 45 (C) / 56 (B) / ~64 (B–A) / 72 (A) DPS. If 04's stage HP scaling changes, re-derive these values the same way.
- Ambush packs (05) and summons are not waves; they never hold the arena closed.

### 9.3 Boss arena (section 8)
- Inner size = the boss's arena from 04 §9.2 (all are whole tiles). The `entry` door is open at load; the `exit` door is **closed** at load.
- The boss is spawned at stage load, dormant, at 75% of the arena width from the `entry` side (04). On lock, 04's 1.0 s intro starts.
- On `bossDefeated`: the `exit` door opens. The `entry` door stays closed.

### 9.4 Side arena (Stages 2 and 3, section 6)
- Inner size 40 × 20 tiles (the Dragon's 640 × 320, 04 §9.2): flat floor, one central one-way platform 128 px wide, 96 px up.
- Joined to the main path by one opening 3 tiles tall at floor level. No doors, never locks, no camera zone.
- A detour into it and back without fighting costs ≤ 4 s.
- **With the Dragon:** 04 §13.3 runs it. **Without the Dragon** (assumption, GAME_PLAN 15.3 #2): the arena is empty.
- `dragon_warning` zone: across the main path, at least 640 px before the side arena opening.

### 9.5 Timed doors (section 7)
- A `timed_door` is a `SolidBody` (`noTeleport: true`) closing a sealed room with a `timed_chest`. Its **trigger** is the 48 px wide strip directly in front of the door on its `side`, as tall as the door.
- The first tick the player's center is in the trigger:
  - if `stageTicks ≤ timeLimit × 120`: the door opens for the rest of the stage. Emit `timedDoorOpened`.
  - otherwise: it stays closed for the rest of the stage. Emit `timedDoorMissed`.
- Before it is decided, the door shows the time left (`timeLimit − stageTicks/120`, never below 0); 07 also shows it on the HUD while the player is within 640 px horizontally.
- The room is sealed: solid ceiling and floor, and every wall tile of the room is covered by `blink_block` so Blink cannot enter (01 §12.4).

| Level | `timeLimit` default |
|---|---|
| `plains` | 120 s (2:00) |
| `mountains`, `swamps` | 125 s |
| `kingdom` | 130 s |
| `castle` | 135 s |

A speedrunner reaches §7 at about 70 s. Fighting the Dragon (~60 s) usually costs the timed door; that trade is intended.

---

## 10. Level hazards
Hazards are not enemies (04 §14): not targetable, no kill credit, **not stage-scaled**, never hurt enemies. Their hits go through 02's hurt pipeline as source `hazard`. Dash, slide, ability and weapon-move i-frames (parry, Katana dash-slash, Spear lunge) do **not** protect (01 §7.2, 03 §8.1, same as spikes in 01 §13.4). Only hurt i-frames protect (including Second Wind's 2.0 s, 05). The shield does **not** block them, and Riposte does not catch them (03). Their timers and speeds are multiplied by `worldTimeScale` (Time Slow, 03). Spikes are in 01 §13.4.

| Hazard | Behavior | Damage | Player KB |
|---|---|---|---|
| `cannon` | Fires a ball in `dir` every `interval` (default 3.0 s), only while its point is inside the camera view expanded by 160 px. The first shot comes `offset` s (default 1.0) after it first enters that area. The muzzle flashes for the last **0.6 s** before each shot (telegraph). Ball: 12 × 12, 300 px/s, straight, stops at solid tiles and solid bodies (passes one-way), vanishes after `range` px (default 960) | 20 | `240, −180` along travel |
| `falling_rocks` (zone) | While the player's center is inside the zone: 0.3 s after entering, then every `interval` (default 2.0 s), mark the floor below the player's x (clamped 8 px inside the zone) for **0.6 s**, then drop a 16 × 16 rock from the zone's top edge at 360 px/s. It passes one-way platforms and shatters on solid tiles or bodies | 18 | 02 default |
| `swinging_blade` | Pendulum from the pivot point. `θ(t) = amplitude × sin(2π × (t / period + phase))`, 0° = straight down, positive = toward +x. Blade center = pivot + `length × (sin θ, cos θ)`. Box 20 × 20 at the blade center. `t` = the stage's world time (seconds, × `worldTimeScale`). Rehit 0.5 s. Defaults: `length` 64 px, `amplitude` 60°, `period` 2.0 s, `phase` 0 | 20 | `260, −200` away from the blade center |

---

## 11. Interaction and items on the ground

### 11.1 Interact
- **Placed interactables** (chests, stands, shop objects, altars, statues, boards, and the merchant's items and altars, §11.3) have an **interact box** 24 px wide and 32 px tall, bottom center on the object's anchor point. The inn uses its rectangle. **Ground items** use 05 §5.7's 16 × 16 pickup box.
- **Minecart:** a minecart waiting at its spawn (not yet boarded, 01 §13.6) is an interactable with its 24 × 14 cart box (07 InteractKind `minecart`, prompt `Ride`). The press boards it (01). A rolling cart is not an interact target.
- On a tick with `interact.pressed`: if a swap choice or swap popup (03 §7.1, 05 §5.7, 07) is open, the press only closes it. Otherwise collect every interactable and ground item whose box overlaps the player's hurtbox; pick the one whose center is nearest the player's center x (tie: lower id). One target per press. Then the owner file runs it (chests, stands, shop, merchant, ground items: 05; abilities: 03; minecart: 01; inn, statues, boards: here).
- Allowed player states: `ground`, `air`, `crawl`, `slide`, `dash`, `wallSlide`, `diveLand`. Village objects (shop, altars, inn, statues, boards) and the merchant's items and altars need `ground` or `crawl`.
- Keys, coins and blueprints are collected by touch (05). Lucky Blocks break by 02's rule; results by 05.

### 11.2 Items on the ground
- Falling, resting, pickup, the weapon swap and despawning are 05 §5.7 (abilities 03 §7.1). Level-side safety rule: if an item's spawn point is inside a solid tile, it is moved straight up to the first free pixel row before it falls.
- Weapon pickup with full slots uses 07's swap popup (05 §5.7); it is refused while attacking (02 §9.5). Shop purchases: 05 §10.2 (gold is taken only when the item is actually taken).

### 11.3 Wandering merchant
When 05 §12 says the merchant is present (rolled at stage load), the loader adds these runtime entities around the `merchant_spot` (x = the spot's x, all feet on the spot's floor y). Ids are new entity ids, in this order: items 0–2, then altars 1–2.

| Entity | x offset | Interaction |
|---|---|---|
| Merchant NPC | 0 | Not interactable. Can't be hurt; enemies ignore him (05) |
| `merchant_item` slots 0, 1, 2 (05 `MerchantState.slots` order) | −96, −64, −32 | 24 × 32 interact box. Press: buy (05 §10.2, merchant price). 07 item card. A bought slot shows `SOLD` and is inactive |
| `merchant_altar` slot 1, 2 | +32, +64 | 24 × 32 interact box. **Upgrade only:** a press buys +1 level for that ability slot at 05's normal upgrade price (03 rules). No hold-to-sell. Shows `MAX` at Lv5 (press does nothing) and `No ability` for an empty slot (inactive) |

- Without the merchant, nothing is added and the spot is empty.
- `validateLevel` requires **112 px of flat open floor on each side** of every `merchant_spot` (§13.6).

---

## 12. Villages

### 12.1 Shared
- No enemies (except the Home Village dummy) and no hazards. Movement, weapons, abilities and the flask all work. Rush is 0 and frozen (02).
- The run timer runs (except in the Home Village).
- Map size **48 × 23 tiles**. Floor surface at row 20 (feet `y = 320`); rows 20–22 solid; columns 0 and 47 solid walls; open sky above. All anchors are on the floor (feet anchor).
- **`enterVillage {villageId}`** is emitted on the first tick of the village scene (start of its fade in). 05 rolls shop stock and clears stage buffs on it. Dropped and unbought items vanish when the village is left.

### 12.2 Crossroads, Border Village, Rebel Camp (same layout; art differs, 08)

| Object | Tile x (center) | Interaction |
|---|---|---|
| `player_start` | 3 | facing right |
| `shop_item` slot 0, 1, 2 | 9, 12, 15 | Press: buy (05 §10.2) |
| `ability_altar` slot 1, 2 | 19, 22 | **Tap** (release before 0.75 s): upgrade that slot +1 level (05 price, 03 rules). **Hold 0.75 s** (90 ticks, box overlapped the whole time): sell it (05). Empty slot: inactive. Lv5: tap does nothing |
| `shop_flask` | 26 | Press: flask upgrade (05) |
| `shop_refill` | 29 | Press: instant refill (05) |
| `shop_key` | 32 | Press: buy a key (05). Hidden and inactive when 05's stock has no key |
| `shop_reroll` | 35 | Press: reroll the 3 items (05) |
| `inn` | rect, tiles x 41–43, rows 16–19 | Press: sleep (Crossroads: route choice first, §3) |

- **Sleep:** fade out 0.5 s; at the end of the fade out, HP = max HP (flask unchanged, 02 §7.1); load the next stage; fade in 0.5 s.
- A fast player walks from start to inn (39 tiles, 624 px) in under 4 s.

### 12.3 Home Village

| Object | Tile x (center) | Interaction |
|---|---|---|
| `player_start` | 3 | Facing right. Spawns with `save.lastKit` equipped (or empty-handed on the very first launch) |
| `class_statue` swordsman, tank, archer, wizard | 9, 13, 17, 21 | Opens the class pick popup (07) for that class: pick one of its starting weapons (the 2 from 03 §3, plus a 3rd once `save.unlocks.startWeapons` has it, 05 §14.3). Confirm → the kit replaces the current loadout at once; `lastKit` saved |
| `mirror_spot` | 25 | Not interactable yet. The future character mirror (GAME_PLAN 4.5, M12); until then an empty frame |
| `enemy` `training_dummy` (04 §2.10) | 28 | Hit it to try the kit |
| `unlocks_board` | 34 | Opens the unlocks / classes discovered page (07) |
| `seed_board` | 37 | Opens seed entry (07): type a seed or clear it. The board shows the active typed seed |
| `exit` (gate) | rect, tiles x 45–46, rows 16–19 | Starts the run (§2.3) if a kit is equipped |

---

## 13. Level file format

### 13.1 Files and pipeline
- **Game files:** `public/levels/<levelId>.json`, one per stage level and per village (`village_home.json`, `village_crossroads.json`, `village_border.json`, `village_rebel_camp.json`). Tiled 1.10 JSON, written by code. They open in the Tiled app for viewing, but nobody edits them by hand.
- **Source files:** `levels-src/<levelId>/` holds ASCII chunk files and a `level.json` manifest (§13.5). `tools/build_levels.py` turns them into the game files and writes `public/levels/kinds.png` (the collision tileset image: 8 flat-colored 16 × 16 tiles). Run with `npm run levels` (also part of `npm run assets`). Generated files are committed.
- The Phaser layer loads the file with `load.json`; the core parses it (`src/core/level/loadLevel.ts`) into `LevelData`; 08 draws tiles from `LevelData` (autotiling).

### 13.2 Map
- `orientation: "orthogonal"`, `renderorder: "right-down"`, `tilewidth: 16`, `tileheight: 16`, `infinite: false`, `width`/`height` in tiles.
- Map `properties` (Tiled array of `{name, type, value}`): `levelId` (string), `kind` (`"stage"` or `"village"`), `stage` (int 1–4; 0 for villages), `biome` (string: the level id, or the village id; 08 maps it to art).
- Tilesets: `kinds` with `firstgid: 1`, 16 tiles reserved (8 used). Optional decoration tilesets (08) start at `firstgid: 17`.

### 13.3 Layers

| Layer | Type | Content |
|---|---|---|
| `collision` | tilelayer | Gameplay tile kinds (table below). Plain array `data` (no encoding), row-major, length `width × height` |
| `deco_back`, `deco_front` | tilelayer | Optional decoration gids (08). No gameplay effect |
| `zones` | objectgroup | Rect/polyline zone objects |
| `objects` | objectgroup | Point and rect gameplay objects |
| `spawns` | objectgroup | `enemy` objects |

The loader reads objects from all object layers (the layer split is only for readability). Unknown layers are ignored.

| gid | TileKind (01 §13) | ASCII |
|---|---|---|
| 0 | `empty` | `.` |
| 1 | `solid` | `#` |
| 2 | `oneway` | `=` |
| 3 | `ice` | `I` |
| 4 | `water` | `~` |
| 5 | `spikeUp` | `^` |
| 6 | `spikeDown` | `v` |
| 7 | `spikeLeft` | `<` |
| 8 | `spikeRight` | `>` |

Flip/rotation bits on `collision` gids are an error.

### 13.4 Object types
Common Tiled object fields: `id` (unique int; becomes the entity id), `type` (below), `x`, `y`, `width`, `height`, `point` (true for point objects), `polyline` (for `main_path`), `properties`. **Rects** are tile-aligned (x, y, w, h multiples of 16). **Anchors** for points: *feet* = bottom center of the marker tile (`tx×16+8, ty×16+16`); *center* = tile center (`tx×16+8, ty×16+8`).

| Type | Shape / anchor | Properties (`name: type = default`) | Notes |
|---|---|---|---|
| `player_start` | point / feet | `facing: int = 1` | Exactly 1 |
| `exit` | rect | — | Exactly 1. Stage: end of the road. Home: the gate |
| `main_path` | polyline | — | Exactly 1 per stage, from start to exit; length = Σ segment lengths / 16 |
| `section` | rect | `index: int` (1–8) | Exactly 8 per stage; side paths lie inside their section |
| `camera_zone` | rect | `mode: string = "always"` | 01 §14.3. Arena zones are added by the loader |
| `hint` | rect | `action: string` | Stage 1 only. One of `move, jump, double_jump, dash, wall_jump, slide, dive_slam, attack, lucky_block, ability, heal, interact, drop_through`. 07 shows that button prompt while the player is inside, until `progress.stage1Cleared` |
| `dragon_warning` | rect | — | Stages 2 and 3, exactly 1 |
| `enemy` | point / feet | 04 §2.2: `enemy: string`, `facing: int = 1`, `patrol: int = 0`, `group: string = ""`, `hang: bool = false`, `submerged: bool = false`, `stone: bool = true`; plus `wave: int = 0`, `arena: string = ""` | `wave ≥ 1` = arena wave spawn (needs `arena`) |
| `arena` | rect (inner) | `id: string`, `kind: string` (`combat`, `boss`, `side`), `boss: string = ""`, `entry: string = "left"`, `parTime: float` (default: §9.2's value for the level's stage) | §9 |
| `arena_door` | rect | `arena: string`, `role: string` (`entry`, `exit`; combat doors use `entry`) | §9.1 |
| `summon_point` | point / feet | `arena: string` | Enemy King arena: 2, 48 px from each wall (04) |
| `lucky_block` | point / center | — | Box 16 × 16 on its tile. Floats; no gravity |
| `loot_stand` | point / feet | `kind: string` (`weapon`, `ability`, `any`) | Free loot (05 §5.1) |
| `key` | point / center | — | Pickup box 16 × 16 |
| `key_chest` | point / feet | — | |
| `cursed_chest` | point / feet | — | |
| `timed_door` | rect | `id: string`, `side: string` (`left`, `right`), `timeLimit: float` (§9.5 default) | |
| `timed_chest` | point / feet | `door: string` | |
| `merchant_spot` | point / feet | — | 05 decides if the merchant appears. If present: the NPC stands here, his 3 `merchant_item`s at x −96 / −64 / −32 and 2 upgrade-only `merchant_altar`s at x +32 / +64 (§11.3). Needs 112 px of flat open floor each side |
| `collapsing_platform` | rect, h = 16 | `oneWay: bool = false`, `collapseDelay: float = 0.5`, `respawnTime: float = 4.0` | 01 §13.5 |
| `cracked_wall` | rect | — | Solid body, `grabbable: true`. Broken by Shoulder Charge (03); stays broken for the rest of the stage visit |
| `blink_block` | rect | — | Solid body with `noTeleport: true`. Must lie fully on solid tiles |
| `minecart` | point / feet | `dir: int = 1` | 01 §13.6 |
| `minecart_stop` | rect | — | |
| `grapple_point` | point / center | — | 01 §13.7 |
| `cannon` | point / center (muzzle) | `dir: int = 1`, `interval: float = 3.0`, `offset: float = 1.0`, `range: int = 960` | §10 |
| `falling_rocks` | rect | `interval: float = 2.0` | §10 |
| `swinging_blade` | point / center (pivot) | `length: int = 64`, `amplitude: float = 60`, `period: float = 2.0`, `phase: float = 0` | §10 |
| `dark_zone` | rect | `lightRadius: int = 112` | Visual only (08) |
| `firefly` | point / center | `radius: int = 48` | Visual light (08) |
| `guide_arrow` | point / center | `angle: float = 0` | Visual only |
| `inn` | rect | — | Villages |
| `shop_item` | point / feet | `slot: int` (0–2) | Villages |
| `ability_altar` | point / feet | `slot: int` (1–2) | Villages |
| `shop_flask`, `shop_refill`, `shop_key`, `shop_reroll` | point / feet | — | Villages |
| `class_statue` | point / feet | `cls: string` | Home Village |
| `unlocks_board`, `seed_board` | point / feet | — | Home Village |

### 13.5 Source format (ASCII chunks)
- `level.json` manifest: `levelId`, `kind`, `stage`, `biome`, `width`, `height` (tiles), `chunks: [{file, x, y}]` (tile offset of the chunk's top-left), `legend` (character → `{type, ...props}`), `objects: [{type, x, y, w?, h?, props}]` (tile units, absolute), `mainPath: [[tx, ty], ...]` (tile centers).
- Cells not covered by any chunk are **solid**. Chunks are applied in order; a later chunk overwrites earlier cells. A space in a chunk means "leave the cell as it is".
- Tile characters: the ASCII column of §13.3, plus `%` collapsing solid platform, `&` collapsing one-way platform, `+` cracked wall, `@` blink block (cell becomes solid). The builder merges `%`/`&` horizontal runs into one `collapsing_platform` each (`h = 16`), and merges `+` and `@` cells into the fewest rectangles (horizontal runs first, then stacks identical runs).
- Every other character is an **object marker** looked up in `legend` (the cell becomes `.`). Default legend: `P` player_start, `L` lucky_block, `K` key, `C` key_chest, `Q` cursed_chest, `T` timed_chest, `M` merchant_spot, `G` grapple_point. Levels add their own (e.g. `"1": {"type": "enemy", "enemy": "wolf", "group": "p1"}`). An unknown character is a build error.
- Object ids are assigned in order: point objects sorted by (y, x), then rects, then the polyline. Same source = same ids.

### 13.6 Runtime shape and validation

```ts
type StageLevelId = 'plains' | 'mountains' | 'swamps' | 'kingdom' | 'castle';
type VillageId = 'home' | 'crossroads' | 'border' | 'rebel_camp';
interface LevelObject { id: number; type: string; x: number; y: number; w: number; h: number;
  points?: { x: number; y: number }[]; props: Record<string, string | number | boolean>; }
interface LevelData { id: StageLevelId | VillageId; kind: 'stage' | 'village'; stage: 0 | 1 | 2 | 3 | 4;
  biome: string; widthTiles: number; heightTiles: number;
  tiles: Uint8Array;          // TileKind index (= gid) per cell, row-major
  objects: LevelObject[]; }   // ascending id
```

`validateLevel(data)` runs in a Vitest test for every file in `public/levels/` and fails on any of: counts from §8.4 and the "Exactly" notes in §13.4; enemy ids outside the stage biome's 5 (plus the boss); regular/elite counts off §8.2 (waves included); arena sizes off §9 and 04 §9.2; a combat arena without 2 doors or with non-wave spawns inside; a boss arena whose `boss` is not the stage's boss; a `timed_chest` whose `door` id is missing; a `blink_block` not fully on solid tiles; a `merchant_spot` without 112 px of flat open floor on each side (§11.3: `solid` tiles in the row under its feet and `empty` tiles in the 3 rows above, for every column from x − 112 to x + 112); a non-tile-aligned rect; a `main_path` length outside 650–730 tiles; a level larger than §8.3.

---

## 14. Practice mode
- Opened from the title screen (07). Choose a stage level and a start kit `(class, weapon)`.
- **Available levels:** any in `save.progress.levelsReached` (a level is added when it is started in a normal run). `plains` is always available.
- **Dragon option** (Stages 2 and 3 only): `off` (default), `random color`, or a color. If on, the Dragon is perched in the side arena.
- Seed: random each attempt, or the typed seed if one is active. Enemies use the practiced stage's scaling (04).
- **Preset loadout** (fixed, so practice times are fair to compare):

| Stage | Weapon 1 (the kit's weapon) | Ability 1 (the kit's ability) | Ability 2 / Weapon 2 | Flask | HP | Gold | Keys |
|---|---|---|---|---|---|---|---|
| 1 | C | Lv1 | empty | 2 / 2 | 100 | 0 | 0 |
| 2 | B + class element | Lv2 | empty | 2 / 2 | 100 | 0 | 1 |
| 3 | B + class element | Lv3 | empty | 3 / 3 | 100 | 0 | 1 |
| 4 | B + class element | Lv3 | empty | 3 / 3 | 100 | 0 | 1 |

Class element: Swordsman `fire`, Tank `lightning`, Archer `wind`, Wizard `lightning`. No stat upgrades, no perks.

- Time = `stageTicks` from control to the boss's death tick. Then a practice result screen (07) shows the time and the practice best for `${levelId}|${class}`. Options: retry, change setup, title.
- Hold restart (§6.2) or death → restart the same practice setup.
- Practice writes **only** `practiceBests` (when faster) to the save. No PBs, best segments, history, stats, unlocks, blueprints or classes discovered. When a practice best is written, emit `practiceBestSaved {key, ticks}`.

**Ghost replay** (GAME_PLAN 6.4, milestone **M10**; before M10 nothing is recorded, stored or drawn). Practice mode only.
- **Recording** (Phaser layer, `src/game/ghost/`): during each practice attempt, sample `i` is the player as drawn when `stageTicks = 2i` (i = 0, 1, 2, …; one sample per 2 ticks): feet `x`, `y` (rounded px, clamped to 0–65 535), facing, and the body frame (08 §5–6: anim key and frame index). At most **12 000 samples** (200 s); after that, recording stops and the ghost ends there.
- **Encoding:** 6 bytes per sample, little-endian: `uint16 x`, `uint16 y`, `uint8` anim index (position among the player anim keys in `src/data/animKeys.ts`), `uint8` frame index (bits 0–6) with bit 7 set when facing left. The bytes are base64url (no padding).
- **Storing:** on `practiceBestSaved`, write that attempt's samples to `localStorage` key `rushblade.ghosts` as JSON `{ v: 1, ghosts: Partial<Record<PracticeKey, { ticks: number; data: string }>> }` (`ticks` = the new best), replacing the key's old ghost. It is kept **outside** `SaveData` so the export code stays small (§15.3): not exported, imported or backed up. Reads and writes are wrapped in try/catch; a failure means no ghost, with no warning.
- **Playback:** in a practice attempt, if a ghost exists for `${levelId}|${class}` and its `ticks` equals `save.practiceBests` for that key, draw sample `floor(stageTicks / 2)` as the player **body sprite only** (no trim, weapon or smear, 08 §4.2) at **alpha 0.4**, just below the player. It has no collision, hitboxes, sounds or interaction and does not affect the core. After its last sample it disappears. A ghost whose `ticks` does not match (e.g. after a save import) is ignored.

---

## 15. Save data

### 15.1 Storage
- `localStorage` key `rushblade.save` holds the JSON. Before each write, the previous value is copied to `rushblade.save.bak`.
- **Write moments:** settings change, `lastKit` or `typedSeed` change, run start, each stage start (`levelsReached`), each split, run end (complete, death, restart, quit), `classDiscovered` (03), blueprint or unlock (05), practice best. Writes are synchronous and immediate. (Practice ghosts live under their own key `rushblade.ghosts`, §14, from M10.)
- Every read and write is wrapped in try/catch. If writing fails (quota, private mode), keep playing with the in-memory save and show a one-time warning (07).
- **Load:** parse `rushblade.save` → migrate → validate. If parsing fails, try `.bak`. If both fail, copy the bad text to `rushblade.save.corrupt` and start a fresh save. If `v` is newer than this build knows, play with a fresh in-memory save and **never write** (07 warns).
- **Validation:** missing sections or fields get defaults; invalid PB, history or practice entries are dropped one by one. Adding a field with a default does not need a version bump; renaming or changing meaning does (add a migration `v → v+1`).

### 15.2 Schema (version 1)

```ts
type Road = 'mountain' | 'forest';
type PbKey = `${ClassId}|${Road}`;
type PracticeKey = `${StageLevelId}|${ClassId}`;
interface KitSummary { weapons: (WeaponInstance | null)[]; abilities: ({ id: AbilityId; level: AbilityLevel } | null)[];
  displayName: string; }
interface PbRecord { ticks: number; splits: [number, number, number, number]; date: string; seedText: string; kit: KitSummary; }
interface RunRecord {
  date: string; startClass: ClassId; startWeapon: WeaponId; road: Road | null;
  seedText: string; seeded: boolean;
  result: 'complete' | 'death' | 'restart' | 'quit';
  stageReached: 1 | 2 | 3 | 4; sectionReached: number; runTicks: number; splits: (number | null)[];
  cause: string | null; dragon: 'absent' | 'skipped' | 'escaped' | 'killed'; kit: KitSummary; stats: RunStats;
}
interface RunStats { kills: number; eliteKills: number; goldEarned: number; chestsOpened: number;
  luckyBlocksBroken: number; damageTaken: number; flasksDrunk: number; }
interface SaveData {
  v: 1;
  settings: SettingsData;                  // fields and defaults: 07
  lastKit: { cls: ClassId; weapon: WeaponId } | null;
  lastRoad: Road;                          // default 'mountain'
  typedSeed: string | null;                // active seed from the seed board
  progress: { levelsReached: StageLevelId[]; stage1Cleared: boolean; classesDiscovered: (BondId | HybridId)[]; };
  unlocks: { blueprints: (WeaponId | AbilityId)[];                     // 05 §14.2
    startWeapons: Partial<Record<ClassId, WeaponId[]>>; };          // 05 §14.3
  stats: { runsStarted: number; runsCompleted: number; deaths: number; dragonsKilled: number; };
  pbs: Partial<Record<PbKey, PbRecord>>;
  bestSegments: Partial<Record<PbKey, [number | null, number | null, number | null, number | null]>>;
  practiceBests: Partial<Record<PracticeKey, number>>;   // ticks
  history: RunRecord[];                    // newest first, max 20
}
```

- History keeps runs with `result` `complete` or `death`, and `restart`/`quit` runs with `runTicks ≥ 30 s`. Oldest entries beyond 20 are dropped.
- `stage1Cleared` becomes true the first time the Great Boar dies in a normal run.
- Dates are ISO strings made by the Phaser layer (`new Date().toISOString()`); the core never reads the clock.

### 15.3 Export and import
- **Export code:** `RB1:` + base64url (no padding) of the UTF-8 save JSON + `:` + CRC-32 (IEEE, as 8 uppercase hex digits) of those UTF-8 bytes. 07 shows it in a copyable text box.
- **Import:** remove all whitespace (players paste line breaks); check the `RB1:` prefix, the base64url and the checksum; parse, migrate, validate. Any failure → "That code isn't valid" (07) and nothing changes. Codes over 1 000 000 characters are refused.
- On success, 07 asks to confirm ("Replace your save? This can't be undone"). Confirm → the old save goes to `.bak`, the imported save is written whole (no merge), and settings apply at once.

---

## 16. Data shapes and events

```ts
type RunPhase = 'title' | 'homeVillage' | 'transition' | 'loading' | 'stage' | 'statPick'
  | 'village' | 'routeChoice' | 'dead' | 'runComplete' | 'paused';
interface RunState {
  mode: 'run' | 'practice';
  seedText: string; runSeed: number; seeded: boolean;
  startKit: { cls: ClassId; weapon: WeaponId };
  road: Road | null;
  dragon: { present: boolean; stage: 2 | 3; color: DragonColor; outcome: 'absent' | 'skipped' | 'escaped' | 'killed' };
  phase: RunPhase; stage: 0 | 1 | 2 | 3 | 4; levelId: StageLevelId | VillageId;
  runTicks: number; stageTicks: number; splits: [number | null, number | null, number | null, number | null];
  restartHoldTicks: number; restartNeedsRelease: boolean;
  deathTick: number | null; sectionReached: number;
  arenas: Record<string, { locked: boolean; wave: number; lockTick: number; cleared: boolean }>;
  timedDoors: Record<string, 'pending' | 'open' | 'missed'>;
  stats: RunStats;
}
type RunEvent = 'runStarted' | 'stageStarted' | 'enterVillage' | 'roadChosen' | 'sleepStart'
  | 'split' | 'pbSaved' | 'practiceBestSaved' | 'arenaLocked' | 'arenaWave' | 'arenaCleared'
  | 'timedDoorOpened' | 'timedDoorMissed' | 'dragonWarning' | 'playerDied' | 'runCompleted'
  | 'restart' | 'saveFailed';
```

- Events go on the core's per-tick event list (01 §15). `window.__game` exposes `RunState`, the current `LevelData` id and the in-memory `SaveData` (read only).
- **Debug URL params** (only with `?debug=1`): `start=<levelId>` starts practice of that level with the Swordsman kit; `section=<n>` places the player at the first `main_path` vertex inside section n; `seed=<text>` sets the seed. Playwright tests use them.

---

## Test checklist

1. `formatTime(0)` is `0:00.00`, `formatTime(12345)` is `1:42.87`, `formatTime(432000)` is `1:00:00.00`; `formatDelta(-390)` is `−3.25`.
2. `fnv1a32("ABC123")` equals `fnv1a32` of the seed typed as `abc123` (uppercased first); different stream names or scopes give different `deriveSeed` values.
3. Drawing 50 numbers from the Stage 1 `enemyAI` stream does not change the first number of the Stage 2 `enemyAI` stream for the same run seed; `deriveSeed(s, 'loot', 'plains', 7)` differs from `deriveSeed(s, 'loot', 'plains', 8)`.
4. Over 100 000 random run seeds, the Dragon is present in 30% ± 0.5% of runs, Stage 2 vs 3 is 50% ± 0.5%, and each color is 25% ± 0.5%; the `dragon` stream always consumes exactly 3 numbers.
5. Holding restart for 59 ticks does not restart; 60 ticks does; keeping it held afterwards never triggers a second restart until it is released for at least 1 tick.
6. A restart keeps the start kit; it keeps a typed seed and replaces a random seed.
7. `runTicks` does not advance in `homeVillage`, `paused`, `loading` or after the death tick; it advances in `stage`, `statPick`, `village`, `routeChoice`, during hit-stop and during the 1.0 s stage-exit and inn transitions.
8. An inn sleep adds exactly 120 ticks to `runTicks`, sets HP to max HP at the end of the fade out, and leaves flask charges and fill unchanged.
9. Split k equals `runTicks` on the tick the stage-k boss dies; segment 2 includes the Crossroads Village time.
10. With no PB, a split emits `deltaTicks: null`; with a PB, `deltaTicks = runTicks − pb.splits[k]`; before the road is chosen the comparison uses the faster of the class's two road PBs.
11. A completed normal run faster than the PB replaces it; a slower one does not; a typed-seed run and a practice run never change `pbs` or `bestSegments`.
12. A best segment 1 is written to both road keys of the class at split 1, even if the run then dies.
13. If the Enemy King and the player reach 0 HP on the same tick, the run completes and no death is recorded.
14. After death, a `restart.pressed` at 0.1 s is ignored and one at 0.25 s restarts.
15. A combat arena locks on the first tick the hurtbox is fully inside; wave 2 spawns 90 ticks after wave 1's last kill; doors open 60 ticks after the clear.
16. Clearing an arena with `parTime` 20 s in 19.9 s adds 400 tenths to the flask fill; in 20.1 s it adds 250.
17. A timed door with `timeLimit` 120 opens when its trigger is entered at `stageTicks` 14 400 and stays closed when entered at 14 401.
18. A cannon in view fires every 360 ticks after its first shot; its ball moves 2.5 px per tick and deals 20 damage, ignoring stage scaling.
19. A swinging blade with defaults is straight down at t = 0 and at +60° at t = 0.5 s; touching it during a dash still deals 20 damage; touching it during hurt i-frames deals none.
20. An item spawned with its point inside a solid tile ends up resting on top of that tile.
21. With a chest's interact box and a ground item both overlapping the player, one interact press acts only on the one whose center x is nearer the player's x; with an ability swap choice open, the press only closes it.
22. In the village layout, walking from `player_start` to the inn at 170 px/s with no input but right takes less than 4.0 s.
23. Tapping an ability altar (release after 30 ticks) upgrades; holding it 90 ticks sells; leaving the box during the hold sells nothing.
24. Every file in `public/levels/` passes `validateLevel`: each stage has 4 Lucky Blocks, 2 loot stands, 2 keys, 3 key chests, 1 cursed chest, 1 timed door, 8 sections, 1 exit, its own boss, a side arena in Stages 2–3, and 40 / 36 / 44 regular mobs as in §8.2.
25. The builder turns a chunk row `..%%%..` into one `collapsing_platform` 48 px wide, and `+` cells in a 2 × 3 block into one `cracked_wall` 32 × 48.
26. Building the same `levels-src` twice gives byte-identical JSON files.
27. Export then import of a save gives a deep-equal save; changing one character of the code fails the checksum and leaves the save unchanged.
28. A save with `v: 2` (newer than the build) loads as a fresh in-memory save and `localStorage` is never written; a `setItem` that throws does not crash the game.
29. Practice mode on `kingdom` with the Tank kit starts with a B-grade lightning War Maul or Iron Fists, Shockwave Lv3 and a 3/3 flask; finishing writes only `practiceBests["kingdom|tank"]`.
30. Feeding the same seed and the same full-run input recording twice gives identical `RunState`, splits and final time.
31. A combat arena with no `parTime` property gets 20 / 24 / 29 / 32 s in Stages 1 / 2 / 3 / 4.
32. `bossDefeated {bossId: 'dragon'}` sets `dragon.outcome = 'killed'` and `stats.dragonsKilled` +1, with no split, no door opening and no stat pick. A Guardian and the player reaching 0 HP on the same tick record the split, then phase `dead` with no stat pick. A boss dying from Burning 0.5 s after the player's death tick records no split.
33. With the merchant present, the loader adds 3 `merchant_item`s at spot x −96, −64, −32 and 2 `merchant_altar`s at +32, +64. Pressing the slot-1 altar with a Lv2 ability and 175 gold upgrades it to Lv3 and leaves 0 gold; holding the press 90 ticks never sells. Without the merchant nothing is added. A `merchant_spot` with a solid wall 96 px to its right fails `validateLevel`.
34. With a waiting minecart and a ground item both overlapping the player, one interact press acts only on the one whose center x is nearer; a press on the cart boards it; a rolling cart is never the `interactTarget`.
35. Confirming the Forest road sets `road = 'forest'` and loads `swamps`; a completed Tank run on it writes `pbs['tank|forest']` (never a key with a level id).
36. (M10) A practice best of 7 200 ticks stores a ghost of 3 601 samples (stageTicks 0, 2, …, 7 200; 6 bytes each) under `rushblade.ghosts` with `ticks: 7200`, and the export code does not contain it. The next attempt draws ghost sample `floor(stageTicks / 2)`. After importing a save whose `practiceBests` value for that key differs from the ghost's `ticks`, the ghost is not drawn.
