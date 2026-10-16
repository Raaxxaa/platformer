# RUSHBLADE — Build Spec

This folder is the **exact** version of `docs/GAME_PLAN.md`. The plan says what the game is; the spec gives the numbers, rules and screens a programmer needs to build it without guessing.

- If the spec and `GAME_PLAN.md` disagree, **the spec wins** for numbers and rules; tell the design chat so the plan gets fixed.
- If something is missing or unclear, **don't invent design**. Pick the simplest option that matches the plan, mark it in code with `// SPEC-GAP: <question>`, and list it for the design chat.
- Every number here is a **starting value** for tuning. All of them live in one place in code (see "Tuning constants") so they can be changed without hunting.

## Files

| File | Covers |
|---|---|
| `00-README.md` | This file: tech stack, units, architecture, shared numbers every other file relies on |
| `01-movement.md` | Player movement, collision, every move's exact numbers and rules |
| `02-combat.md` | Health, damage formula, hitboxes, i-frames, hit-stop, knockback, crits, elements, status effects, flask, Rush meter, all 19 weapons' attack data |
| `03-classes-abilities.md` | Classes, Connection bonuses, hybrids, weapon match, all 17 abilities with Lv1–Lv5 numbers |
| `04-enemies-bosses.md` | Every mob, elite, Guardian, big boss and the Dragon: stats, behavior, attacks, per-stage scaling |
| `05-loot-economy.md` | Grades, drop odds, chests, Lucky Block, cursed chest, keys, gold, shop stock, prices, selling, stat upgrades |
| `06-run-levels-save.md` | Run flow, stages, villages, route choice, Dragon spawning, level data format, timer and splits, seeds, death and restart, save data |
| `07-ui-hud-controls.md` | HUD layout, every screen and popup, fonts, colors, controls and rebinding |
| `08-art-audio.md` | Art style, palettes, sprite sizes, animation lists, the art and sound generation pipeline, music |

## Tech stack (decided)

| Thing | Choice |
|---|---|
| Engine | **Phaser 4.2.1**, pinned exactly (`"phaser": "4.2.1"`). Phaser 4 is the current stable line; most tutorials online are Phaser 3, so check APIs against Phaser 4 docs/types |
| Language | **TypeScript** (strict mode), version from the Vite `vanilla-ts` template (~6.0) |
| Build | **Vite** (^8.3), Node 22 |
| Unit tests | **Vitest**, for everything under `src/core/` and `src/data/` |
| Browser tests | **Playwright** with the preinstalled Chromium (`/opt/pw-browsers/chromium`, launch arg `--enable-unsafe-swiftshader`). Never run `playwright install` |
| Art + sound generation | **Python 3** + Pillow + numpy scripts in `tools/` (already installed in the cloud containers) |
| Level editing | Hand-written **Tiled-format JSON** (orthogonal, 16×16 tiles), generated or edited by code |
| Hosting | Static web build on **GitHub Pages**. The player opens a link. (A build can't be opened by double-clicking `index.html`; browsers block it.) |
| Platform | PC, keyboard or controller, any modern desktop browser |

## Units and coordinates

- **Pixels** for distance, **seconds** for time. Speeds in **px/s**, accelerations in **px/s²**.
- **+x is right, +y is down** (Phaser's convention). Jump velocities are negative.
- **Game resolution: 640 × 360**, scaled up to fill the window by a **whole number** (2×, 3×, 4×...) with black bars if needed. `pixelArt: true`, `roundPixels: true`.
- **Tiles are 16 × 16 px.** The screen is 40 × 22.5 tiles.
- Angles in degrees, 0° = right, 90° = down.

## Simulation (decided)

- The game logic runs at a **fixed 120 ticks per second** (`TICK = 1/120 s`), independent of the monitor's refresh rate. The renderer draws at the display's rate and shows the latest tick (interpolation optional, later).
- Each frame: add real elapsed time to an accumulator (capped at 0.25 s so a hitch never causes a spiral), run as many 1/120 s ticks as fit.
- Durations in the spec are in seconds; code converts them to ticks with `Math.round(seconds * 120)` once, in the tuning file.
- **The run timer counts ticks**, not wall-clock time, so times are fair and repeatable. Displayed time = ticks / 120.
- **Hit-stop** (freeze on big hits) pauses the simulation ticks for the player and the hit enemy, but **the run timer keeps counting**.
- All randomness uses a **seeded RNG** (`mulberry32`), never `Math.random()`. Each system gets its own stream derived from the run seed (`loot`, `lucky`, `shop`, `dragon`, `enemyAI`, `enemyDrops`, `combat`, `statPick`, `blueprint`, `cosmetic`), each made with 06 §7.2's `deriveSeed(runSeed, stream, ...keys)`, so one system's rolls never shift another's. Scopes and keys: 06 §7.2 (long-lived streams) and 05 §2.1 (per-source loot streams). A file that adds a stream adds it to this list too. Same seed + same choices = same loot.

## Architecture (decided)

The game is split so almost all rules can be unit-tested without a browser:

```
src/
  core/      Pure TypeScript game rules. NO Phaser imports. Deterministic.
             Takes an input snapshot per tick, updates state. Fully unit-tested.
  data/      Typed data tables: weapons, abilities, enemies, loot odds, prices, stat upgrades.
  game/      Phaser layer: scenes, sprites, camera, particles, audio, input reading.
             Reads core state every frame and draws it. Never decides game rules.
  ui/        Phaser UI: HUD, menus, popups (part of the Phaser layer).
  main.ts    Phaser game config and scene list.
tools/       Python scripts that generate art (PNG sprite sheets) and sound (WAV) into public/assets/.
tests/
  e2e/       Playwright tests: boot the build, drive inputs, read window.__game, take screenshots.
```

- **Input snapshot:** each tick the Phaser layer builds an `InputState` (which buttons are held, which were pressed this tick) from keyboard/gamepad and hands it to the core. The core never reads devices directly. This also makes ghost replays and tests easy (feed recorded snapshots).
- **Tuning constants:** every number in this spec lives in `src/core/tuning.ts` (movement, combat, rush, flask) or in the `src/data/` tables (items, enemies, odds, prices). No magic numbers elsewhere.
- **Debug hook:** in dev builds and when the URL has `?debug=1`, expose `window.__game` with read access to the core state and a way to push inputs and step ticks. `?debug=1` also draws hitboxes (green = player hurtbox, red = attack hitboxes, blue = enemy hurtboxes).

## Shared numbers (every file must agree with these)

These anchor the balance. Section files build on them; don't change them in one file without changing them here.

| Anchor | Value |
|---|---|
| Player max HP (base) | **100** |
| Player hurtbox | **12 × 28 px** standing (feet at the bottom center) |
| Player / human-size enemy sprite frame | **48 × 48 px** (room for weapons); bosses bigger |
| Flask | **2 charges** at start (max 4), each heals **40% of max HP** |
| "Standard" weapon | A **C-grade, class-matched** weapon at Stage 1 deals **~45 damage per second** while attacking nonstop |
| Regular mob HP, Stage 1 | **25–60**, so a C/B weapon kills it in **2–4 hits** (plan 5.6: "die fast", no damage sponges). Mob HP scaling below keeps it at 2–4 hits in every stage |
| Elite HP, Stage 1 | **~150** |
| Guardian HP, Stage 1 | **~900** (aim: 30–60 s fight) |
| Mob hit on player, Stage 1 | **8–15 damage**; elite **~20**; boss attacks **15–30** |
| Stage scaling: regular mob and elite HP (`mobHp`) | Stage 1: **×1.0** · Stage 2: **×1.4** · Stage 3: **×1.9** · Stage 4: **×2.4**. Also used for summons, Ambush packs, Goblin Shaman barriers and Living Armor's revive HP. With a class-matched weapon of the expected grade (Stage 1 C, 2 B, 3 B–A, 4 A), an average regular mob dies in a median of about **2–3 / 3 / 3 / 3–4 hits** |
| Stage scaling: boss HP (Guardians, Black Knight, Enemy King, Dragon) | Stage 1: **×1.0** · Stage 2: **×1.7** · Stage 3: **×2.6** · Stage 4: **×3.6** |
| Stage scaling: enemy damage (every enemy and boss) | Stage 1: **×1.0** · Stage 2: **×1.3** · Stage 3: **×1.5** · Stage 4: **×1.7**. 04 §2.3 applies all three scaling rows (`STAGE_SCALING` in `src/core/tuning.ts`) |
| Biggest single enemy hit (no Glass Bones, no curse) | **44**, in Stage 4 (Enemy King's Throne Beam, round(26 × 1.7)). Per stage: 22 / 34 / 39 / 44 (Stages 2–3: the Dragon's Dive Bomb). No single enemy hit is above 44, so it always takes **at least 3 hits** to kill a 100 HP player |
| Grade damage multiplier | F **0.8** · C **1.0** · B **1.25** · A **1.6** · S **2.0** |
| Weapon match bonus | **+25%** damage |
| Crit | **×2** damage |
| Gold per stage (if you clear most of it) | **400–600** |
| Run timer | Ticks at 120/s; runs in stages and villages; pauses only in menus |

## Decisions the spec assumes (from GAME_PLAN.md section 0 and 15.3)

These are still open with the user. The spec builds the assumed version; keep them easy to change.

- Dying restarts the **whole run** (A2).
- Stage layouts are **hand-made and the same every run** (A4).
- Road choice (Mountain vs Forest) is the **player's choice** at the Crossroads Village.
- Dragon: **30% of runs**, in Stage 2 or 3, optional side arena.
- Ability levels go **1–5**; abilities only level up by **paying at shops**.
- Sleeping restores **HP, not the flask**.
- Vampire is **neutral**.
- Grades are **F, C, B, A, S**.
- Lucky Block is **55% buff / 45% debuff**.
