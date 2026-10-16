# M3: Stage 1 (Plains & Forest) and the Great Boar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The full Stage 1 level, Plains & Forest, playable from start to finish:
- all 8 sections and all 44 enemies;
- the locked combat arena with waves;
- spikes and doors;
- the timed door;
- teaching hints and guide arrows;
- the boss, the Great Boar;
- the run timer and the split when the boss dies.

Loot objects (Lucky Blocks, chests, keys, loot stands, merchant) are placed in the level but only show as grey markers. They start working in M5 (loot). M4 adds classes, abilities and weapons first.

**Architecture:**
- Levels are written as ASCII chunk files plus a manifest in `levels-src/`. A Python builder (`tools/build_levels.py`) turns them into Tiled-format JSON in `public/levels/`.
- The core parses that JSON into `LevelData`. It validates it against 06's counts and builds tiles, solid bodies, spawns, zones and arenas.
- A `RunState` holds the clocks, phases and split.
- The Great Boar runs on a shared boss layer (04 §9) built on M2's enemy AI.
- A new `StageScene` draws everything in grey boxes and adds a simple timer.

**Tech Stack:** As before: TypeScript, Phaser 4.2.1, Vitest, Playwright, and Python 3 for the level builder.

**Spec:** `docs/spec/06-run-levels-save.md` §2 (phases, the parts listed in Scope), §5.1–5.2 (clocks, splits), §8 (stage template, counts, movement limits), §9.1–9.3 and §9.5 (arenas, timed doors), §13 (level format). Also `docs/spec/04-enemies-bosses.md` §9 (bosses) and §10.1 (Great Boar), `01-movement.md` §13.4 (spikes) and §13.9 (solid bodies), `05-loot-economy.md` §9.5 (Plains enemy mix), and `07-ui-hud-controls.md` §4.11 (timer block, simplified here).

**Starting point:** M2 merged into `main`. Merge `main` and the design branch `origin/claude/great-dijkstra-g00pcj` first.

## Scope

**In M3:**
- Level builder and loader. `validateLevel`.
- Solid bodies (doors).
- Spikes.
- Combat arena: lock, waves, clear, flask bonus.
- Boss arena and the Great Boar: intro, break, enrage, charge, wall crash, rockfall, stomp waves. Death drops 60 gold and refills the flask to max.
- Timed doors.
- Hint zones and guide arrows (simple text and arrows).
- `RunState` with phases `stage`, `dead`, and a temporary `stageClear`. Clocks `runTicks` and `stageTicks`. Split 1 on the boss kill.
- Debug URL params `start`, `section`, `seed`.

**Later:**
- Loot behavior, the boss weapon drop, keys and chests (M5).
- The stat pick after a boss and the walk to the village (M7). M3 shows a temporary "Stage clear" screen instead.
- Personal bests and save data (M7).
- The real HUD and boss bar art (07).
- The Dragon, cannons, falling-rock zones, swinging blades, minecart, water and ice (later stages).

## Global Constraints

- All M0–M2 constraints still hold.
- **Level files are generated.** Never hand-edit `public/levels/*.json`. Edit `levels-src/` and run `npm run levels` (`python3 tools/build_levels.py`). Same source gives byte-identical JSON. Generated files are committed.
- The JSON is **Tiled 1.10 format** exactly as 06 §13.2–13.4: layer names, object types and properties, gids, tile-aligned rects, anchors.
- **Plains enemy mix is exact** (05 §9.5, 06 §8.2):
  - 40 regulars: 12 `wolf`, 10 `bandit`, 9 `bandit_archer`, 9 `wild_boar`, wave enemies included;
  - 4 `bandit_brute`;
  - 1 `great_boar`.
- **Object counts are exact** (06 §8.4): 4 Lucky Blocks, 2 loot stands, 2 keys, 3 key chests, 1 cursed chest, 1 timed door + timed chest, 1 merchant spot, 8 sections, 1 exit, 1 combat arena, 1 boss arena. Plains has no side arena and no Dragon warning.
- **Movement limits** for level design are 06 §8.5. The main path never needs an ability, a grapple point or a dash-jump-only gap. Wall-jump shafts are **3–5 tiles wide (default 4)**, which was changed after playtesting.
- Time formats are exactly 06 §5.1: `formatTime`, `formatDelta`.

## Review Focus

1. **Unbeatable or soft-locking geometry** (a jump that's 1 px too high, a door that closes with the player inside, an arena enemy stuck behind a wall): handled by the route lint (Task 9), the push-out (01 §2.8) when a door activates on the player (Task 3), and the arena stuck rule (Task 5).
2. **Dying or restarting inside the locked arena or boss fight:** after a restart everything is fresh (doors open, waves reset, boss at full HP). Pinned in Task 10.
3. **Leaving the arena area during a wave** (knockback, dash through the door frame before it closes): lock only when the hurtbox is fully inside. Doors push the player out if needed. Pinned in Task 5.
4. **Timer edge cases:** the split happens exactly on the boss-death tick, and the timer stops on the death tick. The timer still counts during hit-stop. Pinned in Task 8.
5. **A level that looks right but has wrong counts** (41 regulars, a missing key): `validateLevel` runs in CI on every level file. Pinned in Tasks 2 and 9.

---

## File structure

```
tools/build_levels.py                ASCII chunks + manifest → Tiled JSON + kinds.png (06 §13.1, §13.5)
tools/tests/test_build_levels.py
levels-src/plains/level.json         manifest (size, chunks, legend, objects, mainPath)
levels-src/plains/s1.txt … s8.txt    one ASCII chunk per section (plus extra chunks if useful)
public/levels/plains.json, public/levels/kinds.png   (generated)
src/core/
  time.ts                            formatTime, formatDelta (06 §5.1)
  level/loadLevel.ts                 Tiled JSON → LevelData + TileGrid + SolidBody list + typed objects
  level/validateLevel.ts             06 §13.6 rules (Stage 1 subset used now; written for all levels)
  level/routeLint.ts                 main_path movement-limit lint (06 §8.5)
  physics/bodies.ts                  SolidBody registry used by collision (01 §13, §13.9)
  physics/collide.ts                 (modify) solid bodies block like tiles; push-out on activation
  hazards/spikes.ts                  01 §13.4
  run/runState.ts                    RunState subset, phases, clocks, split (06 §2, §5)
  run/arenas.ts                      combat arena lock/waves/clear, boss arena doors (06 §9.1–9.3)
  run/timedDoors.ts                  06 §9.5
  run/zones.ts                       hint zones, sections reached, exit
  enemies/boss.ts                    shared boss layer: intro, break, enrage, boss bar data, death (04 §9)
  enemies/greatBoar.ts               Great Boar attacks and wall crash / rockfall (04 §10.1)
  enemies/projectiles.ts             (modify) shockwave floor wave, falling_rock
  sim/gameWorld.ts                   (modify) build from LevelData; hook arenas, doors, zones, run logic (06 §2.8 steps 11–12)
src/data/
  enemies.ts                         (modify) add great_boar (04 §9.1, §10.1)
  enemyProjectiles.ts                (modify) shockwave, falling_rock (04 §8)
src/game/
  scenes/StageScene.ts               loads public/levels/<id>.json, draws level + entities + markers + simple timer/hints/boss bar
  debug.ts                           (modify) URL params start/section/seed, runState()
tests/e2e/stage1.spec.ts
```

---

### Task 1: Time formatting and run clocks

**Files:**
- Create: `src/core/time.ts`, `src/core/time.test.ts`, `src/core/run/runState.ts`, `src/core/run/runState.test.ts`

**Interfaces:**
- Produces:
  - `formatTime(ticks: number): string` and `formatDelta(ticks: number): string`, exactly as 06 §5.1. The minus sign is U+2212 `−`.
  - `type RunPhaseM3 = 'stage' | 'dead' | 'stageClear'`.
  - `interface RunState { phase: RunPhaseM3; seedText: string; runSeed: number; stage: 1; levelId: 'plains'; runTicks: number; stageTicks: number; splits: [number | null, number | null, number | null, number | null]; deathTick: number | null; sectionReached: number; arenas: Record<string, { locked: boolean; wave: number; lockTick: number; cleared: boolean; clearTick: number | null }>; timedDoors: Record<string, 'pending' | 'open' | 'missed'>; restartHoldTicks: number; restartNeedsRelease: boolean }`.
  - `stepClocks(r: RunState): void`. `runTicks` and `stageTicks` advance only in `stage`. They also advance during hit-stop, because the run logic runs every tick.

- [ ] **Step 1: Write the failing tests** (06 test 1, plus the clocks).
  - `formatTime(0) === '0:00.00'`, `formatTime(12345) === '1:42.87'`, `formatTime(432000) === '1:00:00.00'`.
  - `formatDelta(-390) === '−3.25'`, `formatDelta(0) === '±0.00'`, `formatDelta(9000) === '+1:15.00'`.
  - Clocks advance in `stage` and stop in `dead`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(run): time formatting and run clocks"`

### Task 2: Level builder (Python) and loader + validator (TypeScript)

**Files:**
- Create: `tools/build_levels.py`, `tools/tests/test_build_levels.py`, `src/core/level/loadLevel.ts`, `src/core/level/validateLevel.ts`, `src/core/level/loadLevel.test.ts`, `src/core/level/validateLevel.test.ts`, `src/core/level/fixtures/mini.json` (a tiny hand-made Tiled file used only by tests)
- Modify: `package.json`: add `"levels": "python3 tools/build_levels.py"`. If `assets` exists (ART1), make it also run the levels build.

**Interfaces:**
- Produces:
  - **Builder:** reads `levels-src/<id>/level.json` and its chunks (06 §13.5). Uncovered cells are solid. Later chunks win, and a space leaves the cell unchanged. Tile characters follow the 06 §13.3 ASCII column, plus `% & + @`. Object markers come from the legend (with the default legend). The builder merges `%`/`&` runs and `+`/`@` blocks. Object ids are assigned in order: points by (y, x), then rects, then the polyline. Output is Tiled 1.10 JSON with the `collision`, `zones`, `objects` and `spawns` layers, plus `kinds.png` (8 flat 16 × 16 tiles). There are no timestamps, and keys are sorted in a fixed order.
  - **Loader:**
    - `interface LevelObject`, `interface LevelData` (06 §13.6).
    - `loadLevel(json: unknown): LevelData`. It throws on flip bits in `collision`, unknown gids, or non-tile-aligned rects.
    - `buildWorldParts(d: LevelData): { grid: TileGrid; bodies: SolidBodyDef[]; spawns: EnemySpawn[]; objects: LevelObject[] }`.
  - **Validator:** `validateLevel(d: LevelData): string[]` (an empty list means valid). It implements every 06 §13.6 rule that applies to the level's kind and stage. For Plains it checks counts, the exact enemy mix, arena sizes, doors, the timed chest `door` id, `main_path` length 650–730, and size ≤ 720 × 96.

- [ ] **Step 1: Write the failing tests.**
  - Python (06 tests 25, 26):
    - A chunk row `..%%%..` gives one `collapsing_platform` 48 px wide.
    - A 2 × 3 block of `+` gives one `cracked_wall` 32 × 48.
    - Uncovered cells are solid.
    - A space keeps the earlier cell.
    - Ids are ordered as specified.
    - Building twice gives byte-identical JSON.
    - An unknown character is an error.
  - TypeScript:
    - `mini.json` loads.
    - Tiles map to `TileKind`.
    - Feet and center anchors are right.
    - A flipped gid throws.
    - `validateLevel` reports a missing `player_start`, two `exit`s, a combat arena without 2 doors, and a timed chest whose door doesn't exist.
- [ ] **Step 2: Run** `python3 -m unittest discover tools/tests` and `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(level): ASCII level builder, Tiled loader and validator"`

### Task 3: Solid bodies and spikes

**Files:**
- Create: `src/core/physics/bodies.ts`, `src/core/physics/bodies.test.ts`, `src/core/hazards/spikes.ts`, `src/core/hazards/spikes.test.ts`
- Modify: `src/core/physics/collide.ts`, `src/core/player/movement.ts` (step 9 spike check), `src/core/enemies/body.ts` (enemies collide with bodies)

**Interfaces:**
- Produces:
  - `SolidBody` as in 01 §13.
  - `class Bodies { add(b: SolidBody): void; setActive(id: string, on: boolean): void; solidAt(px: number, py: number): boolean; oneWayTopAt(px: number, py: number): boolean }`.
  - Collision treats active bodies like tiles: horizontal, falling and rising blocking per 01 §2.3. When a body becomes active over the player, push-out (01 §2.8) runs.
  - **Spikes:** `checkSpikes(w: GameWorld): void` (01 §13.4).
    - The hurt zones are inside the tile.
    - 20 damage through `hurtPlayer` as source `hazard` with cause `'spikes'`.
    - It starts the hurt i-frames, but no knockback, hitstun or hit-stop.
    - It applies the pop of the zone with the largest overlap (tie order: Up, Left, Right, Down).
    - Dash i-frames don't protect.

- [ ] **Step 1: Write the failing tests** (01 tests 23, 36, plus bodies).
  - Touching `spikeUp` deals 20, sets `vy = −330` and starts the i-frames.
  - Touching it during a dash still deals damage. During hurt i-frames it deals none.
  - A spike death has cause `'spikes'`.
  - An active door blocks walking. An inactive one doesn't.
  - Activating a door on top of the player pushes the player out.
  - Enemies are blocked by doors too.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(physics): solid bodies (doors) and spikes"`

### Task 4: Build the GameWorld from a level

**Files:**
- Modify: `src/core/sim/gameWorld.ts`, `src/core/testkit/combatWorld.ts`
- Create: `src/core/sim/levelWorld.test.ts`

**Interfaces:**
- Produces:
  - `GameWorld.fromLevel(d: LevelData, opts: { seedText: string }): GameWorld`. It places the player at `player_start` with its facing, adds every non-wave `enemy` spawn (dormant until activated, 04 §2.2) and every body (arena doors, timed doors), and builds `RunState`.
  - The world also keeps `w.markers: LevelObject[]` for loot objects that don't work yet (`lucky_block`, `loot_stand`, `key`, `key_chest`, `cursed_chest`, `timed_chest`, `merchant_spot`), drawn as grey markers in M3.
  - The camera bounds are the level rectangle. Arena camera zones are added by Task 5.
  - Run seed: `runSeed = fnv1a32(seedText)`. The `enemyAI`, `combat` and `cosmetic` streams use key `1` (the stage).

- [ ] **Step 1: Write the failing tests.**
  - On `mini.json`: the player starts at the feet anchor, enemies exist and are dormant, doors are bodies, and markers are listed.
  - The same seed gives the same stream values.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(core): build the game world from level data"`

### Task 5: Combat arena (lock, waves, clear)

**Files:**
- Create: `src/core/run/arenas.ts`, `src/core/run/arenas.test.ts`
- Modify: `src/core/camera.ts` (camera zones `always` and `whileLocked`, the 0.4 s bounds blend, 01 §14.3), `src/core/sim/gameWorld.ts` (06 §2.8 step 11)

**Interfaces:**
- Produces:
  - `stepArenas(w: GameWorld): void`.
    - **Lock:** on the first tick the hurtbox is fully inside the arena. Every door activates and an `arenaLocked` event fires.
    - **Waves** (Plains: wave 1 = 4 enemies; wave 2 = 5 enemies plus the elite). Wave enemies play the 0.5 s spawn-in and start aware. The next wave comes 0.75 s after the last kill.
    - **Stuck rule:** a wave enemy outside the arena for 3.0 s goes back to its spawn.
    - **Clear:** fill +400 tenths if `clearTicks ≤ parTime × 120` (Plains par 20 s), otherwise +250. An `arenaCleared` event fires and the doors open 0.5 s later.
  - **Camera zones:** while an arena is locked its rectangle is the camera bounds, blended over 0.4 s.

- [ ] **Step 1: Write the failing tests** (06 tests 15, 16).
  - Lock happens on the first tick the hurtbox is fully inside.
  - Wave 2 spawns 90 ticks after wave 1's last kill.
  - The doors open 60 ticks after the clear.
  - A clear in 19.9 s adds 400. In 20.1 s it adds 250.
  - The camera never shows outside the arena while it is locked.
  - An enemy knocked out of the arena for 3.0 s returns to its spawn.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(run): combat arena lock, waves and clear bonus"`

### Task 6: Timed door, hints, sections, exit

**Files:**
- Create: `src/core/run/timedDoors.ts`, `src/core/run/zones.ts`, `src/core/run/zones.test.ts`

**Interfaces:**
- Produces:
  - `stepTimedDoors(w)` (06 §9.5). The trigger is the 48 px strip in front of the door on its `side`. If `stageTicks ≤ timeLimit × 120` when the player's center enters it, the door opens for the stage; otherwise it stays shut. Plains default is 120 s. The events are `timedDoorOpened` and `timedDoorMissed`. Before it is decided, `timedDoorTimeLeft(w, id)` gives the seconds left.
  - `stepZones(w)` returns `w.activeHint: HintAction | null` (the hint zone that contains the player's center), updates `run.sectionReached` (the highest section index entered), and detects the `exit` (touching it in phase `stage` after split 1 → `stageClear`).

- [ ] **Step 1: Write the failing tests** (06 test 17).
  - With `timeLimit` 120, the door opens when entered at `stageTicks` 14 400 and stays closed at 14 401.
  - Entering hint zone `dash` sets `activeHint = 'dash'`, and leaving clears it.
  - `sectionReached` only goes up.
  - The exit is ignored before the boss is dead.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(run): timed doors, hint zones, sections and exit"`

### Task 7: Boss layer and the Great Boar

**Files:**
- Create: `src/core/enemies/boss.ts`, `src/core/enemies/greatBoar.ts`, `src/core/enemies/boss.test.ts`, `src/core/enemies/greatBoar.test.ts`
- Modify: `src/data/enemies.ts` (add `great_boar`), `src/data/enemyProjectiles.ts` (add `shockwave` and `falling_rock`), `src/core/enemies/projectiles.ts`, `src/core/run/arenas.ts` (boss arena: the entry door is open at load, the exit door is closed; lock starts the intro; the exit opens on `bossDefeated`)

**Interfaces:**
- Produces:
  - **`boss.ts`** (04 §9):
    - Boss spawn: 75% of the arena width from the `entry` side, facing the entry, dormant until the lock.
    - On lock: a 1.0 s intro (can be damaged and broken, but doesn't attack). `bossBar` data is `{name: 'Great Boar', title: 'Guardian of the Plains', marks: [0.5]}`.
    - **Break:** when poise reaches 0, the boss can't act for 2.0 s and takes ×1.25 damage (a step-6 target multiplier). Then 2.0 s of poise immunity.
    - **Enrage** at ≤ 50% HP, with no pause.
    - `bossDefeated {bossId, stage}` on the kill tick. The boss's hit groups and projectiles are removed.
    - **Loot in M3:** +60 gold (× Rush factor) and flask charges set to max. The weapon drop is a `// SPEC-GAP: boss weapon drop arrives with loot in M5`.
  - **`greatBoar.ts`** (04 §10.1):
    - **Charge:** 380 px/s, 440 when enraged. It doesn't turn and runs until it hits a wall (max 2.0 s).
    - **Wall crash:** dazed 2.0 s (1.4 s enraged) and `shake(4, 0.3)`. When enraged, 3 falling rocks drop at x from `enemyAI` (inside the arena, at least 48 px apart), each with a 0.8 s floor marker.
    - **Tusk Toss.**
    - **Stomp Quake:** a close box plus 2 floor `shockwave`s at 260 px/s that run to the walls.
    - Preferred band 0–72. Attack gap 1.0 s (0.6 s enraged). Stage scaling uses `bossHp` (Stage 1 is ×1.0, so 900 HP).

- [ ] **Step 1: Write the failing tests.** These include 04 tests 24, 25 (break behavior) and 33.
  - The Great Boar spawns with its feet x 432 px from the entry side of its 576 px arena, facing the entry.
  - It doesn't attack during the 1.0 s intro.
  - A charge into the wall dazes it for 240 ticks (168 when enraged) and emits shake.
  - When enraged, the 3 rock x positions are ≥ 48 px apart and repeat with the same seed.
  - Breaking it gives 240 ticks of no action and ×1.25 damage.
  - A Stomp Quake wave hits a standing player once, and a player jumping over it takes nothing.
  - The kill emits `bossDefeated`, gives +60 gold and refills the flask to max.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(enemies): boss layer and the Great Boar"`

### Task 8: Run logic (split, death, stage clear, restart)

**Files:**
- Modify: `src/core/run/runState.ts`, `src/core/sim/gameWorld.ts` (06 §2.8 step 12)
- Create: `src/core/run/runLogic.test.ts`

**Interfaces:**
- Produces:
  - On `bossDefeated` for the stage boss: `splits[0] = runTicks` on that tick, plus a `split {index: 1, runTicks, segmentTicks, deltaTicks: null, bestSegment: false}` event. PB comparison arrives in M7.
  - **Same-tick rule** (06 §2.5): if the boss and the player reach 0 HP on the same tick, record the split, then apply the death.
  - **During `dead`:** `bossDefeated` is ignored.
  - **Death:** the M2 rules move into `RunState`. `runTicks` stops on the death tick.
  - **Exit after the split:** phase `stageClear`. The world freezes and the clocks stop. In M3, a fresh `restart.pressed` restarts the run.

- [ ] **Step 1: Write the failing tests** (06 tests 7, 9, 32 Guardian part, 30 for one stage).
  - The split equals `runTicks` on the boss-death tick.
  - `runTicks` advances during hit-stop and stops after the death tick.
  - When the boss and the player die on the same tick, the split is recorded and the phase is `dead`.
  - A boss dying from damage after the player's death tick records no split.
  - Feeding the same seed and a recorded 20 000-tick input twice gives an identical `RunState`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(run): split on boss kill, death and stage clear"`

### Task 9: The Plains & Forest level

**Files:**
- Create: `levels-src/plains/level.json`, `levels-src/plains/s1.txt` … `s8.txt`, `src/core/level/routeLint.ts`, `src/core/level/routeLint.test.ts`, `src/data/levels/plains.test.ts`
- Generated: `public/levels/plains.json`, `public/levels/kinds.png`

**Interfaces:**
- Produces:
  - `routeLint(d: LevelData): string[]`. For each consecutive pair of `main_path` vertices, it checks the 06 §8.5 main-path limits:
    - rise ≤ 5 tiles (≤ 7 from section 3 on, which needs the double jump);
    - rise onto a one-way platform ≤ 3 tiles (6 from section 3);
    - horizontal gap ≤ 4 tiles in sections 1–2 (≤ 5 after), measured as the empty floor run between the two vertices' support tiles;
    - no vertex inside a solid tile.

    It reports `section, vertex index, problem`.

**Level design document: `docs/levels/plains.md`.** Read it first. It describes every section's look, purpose, enemy groups, hints and speed lines; build the chunks to match it. The table below is the short version and the counts that must hold.

**Level brief.** Size up to **720 × 64 tiles** (the spec allows 96 tall; 64 is enough). Main path **650–730 tiles**. Floor at varying heights. Every gap has a floor below it (no bottomless pits). Spikes only from section 3 on. A `guide_arrow` at every fork. Wolves are placed in packs that share a `group`.

| § | Main path (tiles) | Layout and gimmick | Regulars | Elite | Objects | Hints |
|---|---|---|---|---|---|---|
| 1 Start | 30–40 | Flat meadow run-in, one small 2-tile step | — | — | `player_start`; `loot_stand` #1 (`weapon`) on the path | `move`, `jump`, `interact` (at the stand), `attack` (near the end) |
| 2 Combat stretch | 100–120 | Open fields with 4 mob groups on low hills, gaps ≤ 3 tiles across, rises ≤ 3 tiles | wolf 3 (pack), bandit 3, archer 2, boar 2 | Brute #1 | `lucky_block` #1 on the path | `dash` (before the first group), `lucky_block` (at it) |
| 3 Traversal | 110–130 | First gaps over spike floors, the first **wall-jump shaft (4 tiles wide, about 10 tiles tall)**, and the first **slide tunnel** (1 tile high, 6–8 tiles long). Double-jump ledges up to 7 tiles | wolf 2 (pack), archer 1, boar 1 | — | `lucky_block` #2; `key` #1 at the end of a short hard-jump detour (≤ 5 s) | `double_jump`, `wall_jump` (at the shaft), `slide` (at the tunnel) |
| 4 Branch | 100–120 (+60–90 side path) | Ground main path through a grove. **Tree-top skip route** 12–18 tiles above, reached by a wall-jump shaft and dash-jump gaps (≤ 7 tiles), which saves 6–10 s. **Side path** going down to a hollow with chests | main: wolf 3 (pack), bandit 2, boar 1 · side: archer 1, bandit 1 | Brute #2 (side) | side path: `key_chest` #1, `cursed_chest`, `loot_stand` #2 (`ability`) at its end | `dive_slam` (at a ledge over the side-path enemies) |
| 5 Arena | 38 | Combat arena, inner **38 × 18 tiles**, flat floor, 3 one-way platforms, 2 doors | wave 1: wolf 2 (pack), bandit 2 · wave 2: archer 2, boar 2, bandit 1 | Brute #3 (wave 2) | `arena` `id: 'a1'`, `kind: 'combat'`; 2 `arena_door`s | `heal` (just before the arena) |
| 6 Traversal 2 | 130–150 | **Forest canopy**: one-way branches at 2–3 tile steps, drop-throughs, a harder wall-jump shaft (4 tiles wide, about 14 tall), spike pits | wolf 2 (pack), archer 2, boar 1 | — | `lucky_block` #3; `key` #2 after a hard jump section (detour ≤ 8 s); `merchant_spot` on the main path (112 px of flat floor each side) | `drop_through` |
| 7 Loot area | 70–90 | A clearing with a sealed timed room (walls covered by `blink_block`) | bandit 1, archer 1, boar 2 | Brute #4 | `lucky_block` #4; `key_chest` #2 and #3; `timed_door` (`id: 'td1'`, 120 s) + `timed_chest` | — |
| 8 Boss + road | 36 + 12–20 | Boss arena, inner **576 × 224 px (36 × 14 tiles)**, flat floor, walls, ceiling. `entry` door on the left, `exit` door on the right, then a 12–20 tile road to the `exit` zone | — | **Great Boar** | `arena` `id: 'boss1'`, `kind: 'boss'`, `boss: 'great_boar'`, `entry: 'left'` | — |

Totals: wolf 12, bandit 10, archer 9, boar 9 (40), plus 4 brutes. The validator must agree.

- [ ] **Step 1: Write the failing tests.**
  - `plains.test.ts` loads `public/levels/plains.json`. `validateLevel` returns `[]` and `routeLint` returns `[]`.
  - The per-section enemy counts match the table (an enemy's section is the `section` rect that contains its spawn point).
  - Every hint action in the table exists in the right section.
  - `routeLint` unit tests: a 6-tile rise in section 2 is flagged, a 5-tile rise is OK, and a 6-tile rise in section 3 is OK.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Author the level** in ASCII chunks, run `npm run levels`, and iterate until the tests pass.
  - Then **play it through in a test.** A Vitest "route runner" teleports the player to each `main_path` vertex in turn and asserts the player can stand there (free box, support below). This only catches placement bugs; real feel comes from the user.
  - Use `?debug=1&start=plains&section=n` screenshots (Task 10) to look at every section with the Read tool.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(level): Plains & Forest stage (8 sections, 44 enemies, arena, boss arena)"`

### Task 10: StageScene, debug params, e2e

**Files:**
- Create: `src/game/scenes/StageScene.ts`, `tests/e2e/stage1.spec.ts`
- Modify: `src/main.ts` (start `StageScene` with `plains`; keep `?scene=combat` and `?scene=movement` for the old test scenes), `src/game/debug.ts`

**Interfaces:**
- **Debug URL params** (only with `?debug=1`, 06 §16): `start=plains`; `section=<n>` (the player goes to the first `main_path` vertex inside section n); `seed=<text>`. `window.__game.runState()` returns a copy of `RunState`.

- [ ] **Step 1: Build the scene.** It reuses M2's drawing for the player, enemies, telegraphs and projectiles. It adds:
  - **Tiles by kind:**
    - solid `#4a4f63`;
    - one-way: a 4 px `#8a90a8` strip at the tile top;
    - spikes: red `#e0463c` triangles pointing the right way.
  - **Bodies and markers:**
    - doors `#6b4a2c`, darker while active;
    - timed door: its color shows the state, and the seconds left are drawn above it;
    - loot markers: grey 12 × 12 boxes with a letter (L Lucky Block, S loot stand, K key, C key chest, Q cursed chest, T timed chest, M merchant spot);
    - guide arrows: a white arrow at the object's angle.
  - **Hint text:** while `activeHint` is set, a short line near the bottom center, such as `Space — jump` or `Shift — dash`, using the M1 key names.
  - **Boss bar:** while the boss arena is locked, a simple bar across the top with the name, the title, and a tick at 50%.
  - **Timer:** top-right `formatTime(runTicks)`. When the split fires, a popup `Split 1  1:41.23` for 3 s.
  - **Stage clear screen:** a dark overlay with `Stage 1 clear — 1:52.47` and `Press R to run again`.
- [ ] **Step 2: Write `tests/e2e/stage1.spec.ts`.**
  - **Boots into Plains with no errors.** Save `test-results/plains-s1.png`.
  - **Every section loads.** For n = 1..8, open `?debug=1&start=plains&section=n` and save `test-results/plains-s<n>.png`.
  - **The arena locks and waves spawn.** Teleport into arena `a1`, step 5 ticks, and assert it is locked with 4 enemies. Kill them via a debug helper `killAll()` and assert wave 2 arrives after 90 ticks.
  - **The boss fight ends in a split.** Go to section 8, walk into the arena, set the boss HP to 1 via a debug helper, hit it, and assert `runState().splits[0]` equals `runTicks` at the kill. Walk to the exit and assert the `stageClear` screen. Save `test-results/plains-clear.png`.
- [ ] **Step 3: Run everything.** `npm run levels && npm run typecheck && npm test && npm run build && npm run test:e2e` and `python3 -m unittest discover tools/tests`. **Read every screenshot**, especially all 8 sections.
- [ ] **Step 4: Commit and push to `main`.** Check that the site deploys.
- [ ] **Step 5: Hand-off to the user.**
  - Send the section screenshots and the link.
  - Tell them in plain words: "Stage 1 is playable from start to the Great Boar. The grey boxes with letters are chests, keys and so on, which start working in the next milestone."
  - Ask them:
    - Is the stage too long or too short?
    - Is anything too hard to jump?
    - Are the hints clear?
    - How does the boss fight feel?
    - What was your time?
  - Mention any SPEC-GAPs.

---

## Done when

- All tasks are checked. These all pass:
  - `npm run levels`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`;
  - `python3 -m unittest discover tools/tests`.
- Spec checklist items with passing tests:
  - **06:** 1, 7, 9, 15, 16, 17, 24 (Plains part), 25, 26, 30 (one stage), 32 (Guardian part).
  - **04:** 24, 33 (Great Boar part).
  - **01:** 23, 36.
- `public/levels/plains.json` passes `validateLevel` and `routeLint`.
- The user has played Stage 1 (or seen every section) and given feedback.

**Next plan:** `V1-stage1-sprites-and-sound.md`, then `M4-classes-abilities-weapons-basics.md`. Loot comes after that, in M5.
