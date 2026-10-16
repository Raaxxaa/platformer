# M2: Combat Core and Stage 1 Enemies — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In a grey-box combat test level, the player fights all five Stage 1 enemies (Wolf, Bandit, Bandit Archer, Wild Boar, and the elite Bandit Brute) with two weapons (Greatsword and War Maul). The level also has health, getting hit, the heal flask, the Rush meter, hit-stop, screen shake, death and restart, all with the exact spec numbers and tests.

**Architecture:** M1's movement core stays as is. A new `GameWorld` in `src/core/sim/gameWorld.ts` owns the player body, combat state, health, flask, Rush, enemies, hit groups, projectiles, RNG streams and camera. Each tick it runs 02 §2.1's tick order. All rules are pure TypeScript under `src/core/` with Vitest tests. Weapons and enemies are data tables in `src/data/`. A new Phaser scene draws coloured boxes: telegraph flashes, hitboxes in debug, and a debug HUD. Real art comes from the separate art plan (`ART1-style-board-plains.md`), and the real HUD from a later milestone.

**Tech Stack:** As M0–M1: Phaser 4.2.1, TypeScript strict, Vite, Vitest, Playwright 1.56.1.

**Spec:** `docs/spec/02-combat.md`, `docs/spec/04-enemies-bosses.md` §1–3 and §8 (Stage 1 rows), `docs/spec/01-movement.md` §3 step 1 (hit-stop), §12.2 (knockback), §14.4 (shake), and `docs/spec/06-run-levels-save.md` §6 (death and restart) and §7.2 (`deriveSeed`). Section numbers like "02 §9.2" refer to these files. Read 02 completely and 04 §1–3 before starting.

**Starting point:** the M0–M1 code on `main` (from the builder branch `claude/jolly-euler-2bt96f`). Merge `main` (and, if it isn't merged yet, `origin/claude/great-dijkstra-g00pcj`, which has the latest spec) into your branch first.

## Scope

**In M2:**
- RNG streams.
- Player HP and the hurt pipeline: steps 1, 5–10. Steps 2–4 (riposte, parry, block) and Second Wind are hooks only.
- Hit-stop and knockback.
- Greatsword and War Maul: combo, cancels, buffer, move caps, facing.
- Dive slam damage, including the War Maul shockwave with knockdown.
- Enemy poise, stagger and knockdown.
- Flask and Rush.
- Camera shake.
- The 5 Stage 1 enemies plus the Training Dummy, with awareness, AI, tokens, telegraphs, the `enemy_arrow` and `brute_wave` projectiles, and death.
- Gold counted on kill.
- Death and restart.

**Not in M2 (later milestones):**
- Grades other than C. Elements and crits (the formula supports them, but nothing grants them yet).
- The other 17 weapons. Shield, parry and block. Abilities and classes. Weapon match (`matched` is always false in M2).
- Player statuses (Burning etc.). Coins as pickups. Elite key and ability drops.
- Real HUD and art. Arenas and waves. Bosses.

## Global Constraints

- Everything from M0–M1's Global Constraints still holds: Phaser pinned at 4.2.1, `src/core/` never imports Phaser, 120 ticks/s, numbers only in `src/core/tuning.ts` and `src/data/`.
- **All randomness** goes through `src/core/rng.ts`. Each stream is `mulberry32(deriveSeed(runSeed, stream, ...keys))` (06 §7.2). M2 uses the streams `enemyAI` (key: stage index), `combat` (key: stage index) and `cosmetic` (key: stage index). Never `Math.random()` in `src/core/`.
- Rounding is **half up** everywhere (`Math.floor(x + 0.5)`), with a minimum of 1 for damage (02 §3.1 step 7).
- Seconds convert to ticks with `Math.round(s × 120)` once, in data loading or tuning. Attack phases convert with 02 §9.9: `max(1, round(seconds × 120 / atkSpeed))`, and a phase of 0 stays 0.
- **Enemy data holds Stage-1 base values.** Stage scaling (04 §2.3: `mobHp`, `bossHp`, `dmg`) is applied once at spawn. Never pre-multiply in data.
- **Gold in M2** is added straight to `world.gold` on a player kill: `round(def.gold × rushGoldMult)` (02 §8.3). Coins as pickups arrive with loot (M4). Mark it `// SPEC-GAP: M2 credits gold instantly; coins in M4` once, in the kill code. This is the design chat's decision, so don't add it to `SPEC-GAPS.md`.

## Review Focus

1. **Two things hit on the same tick** (the player's swing kills an enemy whose attack box is active that tick; two enemies hit the player together): the player wins ties, and the player takes only one hit (02 §2.4). Pinned in Task 9.
2. **Dying during hit-stop or mid-attack:** death must happen on that tick, and no "ghost" hits land afterwards. Pinned in Task 6 and Task 16.
3. **Holding the attack button** (`repeat` weapons) and **mashing** must give the same combo timing, with only one queued step (02 §9.2). Pinned in Task 7.
4. **Enemies at ledges and walls:** knockback pushes enemies off ledges, AI walking never does (except Wolves when the player is lower), and a charging boar hitting a wall becomes dazed. Pinned in Tasks 11 and 14.
5. **Restarting mid-fight:** a hold-R restart or death restart leaves no leftover hitboxes, projectiles, hit-stop, i-frames or Rush. The same seed then gives the same enemy behaviour. Pinned in Task 16.

---

## File structure

```
src/core/
  rng.ts                         fnv1a32, mulberry32, deriveSeed, Rng (weighted pick)
  math.ts                        (exists) add roundHalfUp if missing
  camera.ts                      (modify) shake (01 §14.4)
  combat/
    types.ts                     02 §14 types (Box, HitSpec, AttackStep, WeaponDef, WeaponInstance, Grade, Weight, ...)
    damage.ts                    GRADE_MULT, playerHitDamage (02 §3.1), enemyHitDamage (02 §3.3)
    hitStop.ts                   hit-stop values and max rule (02 §4.1)
    hitGroups.ts                 HitGroup, world-space boxes, overlap, swept boxes, once-per-target bookkeeping (02 §2)
    playerCombat.ts              attack state machine: phases, combo, buffer, cancels, move caps, facing (02 §9)
    dive.ts                      dive slam hit groups and War Maul shockwave (02 §9.7, §10.5)
    health.ts                    player HP, hurt pipeline, i-frames, hitstun, death cause (02 §5.1–5.2)
    enemyReactions.ts            knockback, poise and stagger, knockdown on enemies (02 §4.2–4.4)
    flask.ts                     charges, drinking, fill in tenths (02 §7)
    rush.ts                      Rush value, levels, gain and drain, effects (02 §8)
  enemies/
    types.ts                     04 §15 types (EnemyDef, EnemyAttackDef, EnemyHit, EnemyProjectileDef, ...)
    enemy.ts                     EnemyState, spawnEnemy (stage scaling), activation
    body.ts                      ground movement, ledge probe, separation, knockback motion (04 §2.1, 02 §4.2)
    awareness.ts                 canSee (LOS), notice timer, alert spread (04 §2.4)
    ai.ts                        state machine, engage band, attack choice, tokens, telegraph, chains (04 §2.5–2.6)
    special.ts                   Wolf, Archer, Boar, Brute special rules (04 §3 notes)
    projectiles.ts               enemy_arrow (aimed straight), brute_wave (floor wave) (04 §2.7, §8)
  player/movement.ts             (modify) hit-stop step 1, applyKnockback + 'hurt' state (01 §3, §12.2)
  sim/gameWorld.ts               GameWorld: owns everything, 02 §2.1 tick order, restart
src/data/
  weapons.ts                     WEAPONS: greatsword, war_maul (02 §10.2, §10.5)
  enemies.ts                     ENEMIES: wolf, bandit, bandit_archer, wild_boar, bandit_brute, training_dummy (04 §3, §2.10)
  enemyProjectiles.ts            enemy_arrow, brute_wave (04 §8)
  levels/combatTest.ts           M2 grey-box combat level + spawn list
src/game/
  scenes/CombatTestScene.ts      draws world, enemies, telegraphs, debug HUD, death overlay
  debug.ts                       (modify) world access, spawn, enemies(), stats()
tests/e2e/combat.spec.ts
```

Unit tests sit next to the code as `*.test.ts`. Add one shared test helper `src/core/testkit/combatWorld.ts` (Task 6).

---

### Task 1: RNG streams

**Files:**
- Create: `src/core/rng.ts`, `src/core/rng.test.ts`

**Interfaces:**
- Produces:
  - `fnv1a32(text: string): number`: 32-bit FNV-1a over UTF-8 bytes, offset basis `0x811C9DC5`, prime `0x01000193`, unsigned.
  - `mulberry32(seed: number): () => number`: floats in [0, 1).
  - `deriveSeed(runSeed: number, stream: string, ...keys: (string | number)[]): number`: `fnv1a32([runSeed, stream, ...keys].join(':'))`; a result of 0 becomes 1.
  - `class Rng { constructor(seed: number); next(): number; int(n: number): number; pickWeighted<T>(items: { item: T; weight: number }[]): T }`. `pickWeighted` draws exactly one `next()`.

- [ ] **Step 1: Write the failing tests**
  - `fnv1a32('')` is `0x811C9DC5`.
  - `fnv1a32('a')` is `0xE40C292C`.
  - `fnv1a32('foobar')` is `0xBF9CF968`.
  - The same seed gives the same first 5 numbers. Different seeds give different numbers.
  - `deriveSeed(s, 'enemyAI', 1) !== deriveSeed(s, 'enemyAI', 2)`.
  - Drawing 50 numbers from `enemyAI` stage 1 does not change the first number of `enemyAI` stage 2 (06 test 3).
  - `pickWeighted` with weights 2 and 1 over 30,000 draws lands within ±2% of 2/3.
- [ ] **Step 2: Run.** `npx vitest run src/core/rng.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Use `Math.imul` and `>>> 0` for 32-bit math.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(core): seeded RNG streams (fnv1a32, mulberry32, deriveSeed)"`

### Task 2: Combat types, damage formula, hit-stop math

**Files:**
- Create: `src/core/combat/types.ts`, `src/core/combat/damage.ts`, `src/core/combat/hitStop.ts`, `src/core/combat/damage.test.ts`, `src/core/combat/hitStop.test.ts`
- Modify: `src/core/tuning.ts` (add `COMBAT`: grade multipliers, match 1.25, crit 2.0, hit-stop cap 0.125, crit/kill +0.025, hurt hit-stop 0.075, i-frames 0.80, hitstun 0.20, hurt KB 180/−160, combo window 0.35, input buffer 0.15)

**Interfaces:**
- Produces:
  - `types.ts`: the 02 §14 types `WeaponId`, `Grade`, `ElementId`, `Weight`, `ControlType`, `Box`, `HitSpec`, `AttackStep`, `WeaponDef`, `ProjectileDef`, `WeaponInstance`, `FlaskState`, `HealRefusedReason`, `RushState`. Copy the names exactly.
  - `damage.ts`:
    - `GRADE_MULT: Record<Grade, number>`.
    - `playerHitDamage(o: { base: number; grade?: Grade; matched?: boolean; bonus?: number; crit?: boolean; targetMult?: number; isWeapon: boolean }): { procBase: number; damage: number }`. This is 02 §3.1 steps 1–7. Ability hits (`isWeapon: false`) skip steps 2–3.
    - `enemyHitDamage(A: number, incomingMult: number, oneHitCurseHp: number | null): number`. This is 02 §3.3.
  - `hitStop.ts`: `meleeHitStopTicks(valueS: number, crit: boolean, kill: boolean): number` returns `round(min(value + 0.025·crit + 0.025·kill, 0.125) × 120)`. Also `maxStop(current: number, next: number): number`.

- [ ] **Step 1: Write the failing tests.** These are 02 checklist 5, 6 and 10.
  - Base 20, C, matched, bonus 0.30, crit, target 1.3 gives `85` (procBase 32.5).
  - Base 12 at F gives `10`.
  - Base 0.1 gives `1` (minimum).
  - An ability hit ignores grade and match.
  - `enemyHitDamage(10 × 1.3, 1, null)` is `13`.
  - `enemyHitDamage(10, 0.25, null)` is `3` (2.5 rounds half up).
  - A curse at 37 HP returns `37`.
  - `meleeHitStopTicks(0.10, false, false)` is `12`, with a crit `15`, with a crit and a kill `15` (cap 0.125 is 15 ticks).
  - `meleeHitStopTicks(0.025, false, false)` is `3`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(combat): damage formula, hit-stop math and combat types"`

### Task 3: Weapon data (Greatsword, War Maul)

**Files:**
- Create: `src/data/weapons.ts`, `src/data/weapons.test.ts`

**Interfaces:**
- Consumes: `types.ts`.
- Produces: `WEAPONS: Partial<Record<WeaponId, WeaponDef>>` with `greatsword` and `war_maul` exactly from 02 §10.2: steps, boxes, KB, poise, hit-stop, `heavy` flags, weight `heavy`, hold `repeat`, `moveMult` 0.25, `dive: 'standard'` for the Greatsword and `'war_maul'` for the War Maul, and `signature` names from §13. Also `DIVE: { lightMedium: ..., heavy: ..., warMaul: ... }` from 02 §9.7 and §10.5.

- [ ] **Step 1: Write the failing tests.** These are 02 checklist 1 and 3, for these two weapons.
  - A C-grade **matched** Greatsword combo deals `20, 20, 43`.
  - One cycle (sum of all phases, ticks at atkSpeed 1) is `216` ticks.
  - The matched DPS of each weapon computed from the data is between 43 and 47 (Greatsword 46.1, War Maul 45.4 ±0.2).
  - War Maul step 2 is `heavy`, with box `28,−10,56,20`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(data): Greatsword and War Maul attack data"`

### Task 4: Movement hooks for combat (hit-stop, knockback, hurt state)

**Files:**
- Modify: `src/core/player/movement.ts`, `src/core/player/modifiers.ts` (nothing new, just use `facingLocked`, `actionMoveMult`)
- Create: `src/core/player/hurt.test.ts`

**Interfaces:**
- Produces:
  - `applyKnockback(b: PlayerBody, vx: number, vy: number, stunTicks: number): void`. This is 01 §12.2: it ends any state except `minecart` and `dead`, sets the velocity, and puts the body in state `hurt` for `stunTicks`. In `hurt`, input is ignored, horizontal uses the no-input decel, and gravity applies. When the stun ends, the state becomes `ground` or `air`.
  - In `stepPlayer`, step 1 is the hit-stop rule from 01 §3. While `b.hitStopTicks > 0`: if a dash or jump press would be accepted this tick, set `hitStopTicks = 0` and continue. Otherwise stamp the buffers, decrement, and return with no movement.
  - `setDead(b: PlayerBody): void` puts the body in state `dead` (01 §5.4 dead physics).

- [ ] **Step 1: Write the failing tests.** These are 01 checklist 31 and 39.
  - In a 12-tick hit-stop with the dash ready, a dash pressed on hit-stop tick 3 ends the hit-stop and the dash moves that same tick.
  - With the dash on cooldown, the same press does not end the hit-stop (it runs all 12 ticks) and stays buffered.
  - `applyKnockback(b, 180, −160, 24)`: the body moves away, input is ignored for 24 ticks, and then the state is `air` or `ground`.
  - A dead body falls, lands, and ignores input.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS. All M1 movement tests still pass.
- [ ] **Step 5: Commit.** `git commit -m "feat(player): hit-stop, knockback and hurt/dead states for combat"`

### Task 5: Hit groups and overlap

**Files:**
- Create: `src/core/combat/hitGroups.ts`, `src/core/combat/hitGroups.test.ts`

**Interfaces:**
- Produces:
  - `interface Rect { x: number; y: number; w: number; h: number }` (top-left, world px).
  - `boxToWorld(box: Box, feetX: number, feetY: number, facing: 1 | -1): Rect` (02 §2.2: center offset, mirrored `dx`).
  - `overlaps(a: Rect, b: Rect): boolean`.
  - `sweep(prev: Rect, cur: Rect): Rect`.
  - `interface HitGroup { id: number; owner: 'player' | number /* enemy id */; kind: 'melee' | 'shot'; rect: Rect; spec: HitSpec; active: boolean; lastHitTick: Map<number, number>; hitCount: Map<number, number>; attackInstance: number; slot?: 0 | 1 }`.
  - `canHit(g: HitGroup, targetId: number, tick: number): boolean` (02 §2.3 once-per-target, `rehit`, `maxHits`).
  - `markHit(g: HitGroup, targetId: number, tick: number): void`.

- [ ] **Step 1: Write the failing tests.**
  - `boxToWorld({dx: 22, dy: −16, w: 40, h: 28}, 100, 200, 1)` is `{x: 102, y: 170, w: 40, h: 28}`. Facing −1 gives `x: 58`.
  - Edges touching don't overlap. A 1 px overlap does.
  - A group can't hit the same target twice. With `rehit 0.25`, it can again after 30 ticks, and `maxHits` caps it.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(combat): hit groups, world boxes and hit bookkeeping"`

### Task 6: GameWorld skeleton, player health and the hurt pipeline

**Files:**
- Create: `src/core/sim/gameWorld.ts`, `src/core/combat/health.ts`, `src/core/combat/health.test.ts`, `src/core/testkit/combatWorld.ts`

**Interfaces:**
- Consumes: `PlayerBody`, `stepPlayer`, `applyKnockback`, `Rng`, hit groups.
- Produces:
  - `health.ts`:
    - `interface PlayerHealth { hp: number; maxHp: number; iframeTicks: number; hitstunTicks: number; dead: boolean; deathCause: string | null }`.
    - `createHealth(): PlayerHealth` (100/100).
    - `type HurtSource = { kind: 'enemyHit'; enemyId: number; enemyDefId: string; damageA: number; attackerCx: number; melee: boolean; playerKb?: [number, number] } | { kind: 'hazard'; cause: 'spikes' | 'hazard'; damageA: number }`.
    - `hurtPlayer(w: GameWorld, src: HurtSource): boolean`: 02 §5.2 steps 1, 5–10 by the source table. Returns whether damage landed. Steps 2–4 are hooks that return "not handled". Second Wind is a hook that returns false.
  - `gameWorld.ts`:
    - `class GameWorld { grid; body; mods; ctx; health; camera; tick; runTicks; gold; stage: 1|2|3|4; runSeed: number; rng: { enemyAI: Rng; combat: Rng; cosmetic: Rng }; enemies: EnemyState[]; hitGroups: HitGroup[]; events: WorldEvent[]; constructor(opts: { grid: TileGrid; spawn: { x: number; y: number }; stage?: 1|2|3|4; runSeed?: number; enemies?: EnemySpawn[] }); step(input: InputState): void; restart(): void }`.
    - `step()` runs 02 §2.1's order as numbered stubs. Later tasks fill in the stubs.
    - `type WorldEvent = { t: 'move'; e: MoveEvent } | { t: 'hit'; target: 'player' | number; amount: number; crit: boolean; heavy: boolean } | { t: 'shake'; level: 'small' | 'medium' } | { t: 'enemyTelegraph'; enemyId: number; attackId: string; duration: number } | { t: 'kill'; enemyId: number; tier: 'regular' | 'elite' } | { t: 'playerDied'; cause: string } | { t: 'healRefused'; reason: HealRefusedReason } | { t: 'drink' }`. `events` is cleared at the start of each `step`.
  - `testkit/combatWorld.ts`:
    - `arenaWorld(opts?: { enemies?: EnemySpawn[]; stage?: 1|2|3|4; seed?: number }): GameWorld`. A flat 60 × 23 tile floor with walls; the player spawns at x 200.
    - `stepSpec(w: GameWorld, spec: InputSpec, n = 1): WorldEvent[]` (reuses `specToInput`).

- [ ] **Step 1: Write the failing tests.** These are 02 checklist 7 and 8, plus 01 test 36.
  - A test helper `hurtPlayer(w, {kind: 'enemyHit', damageA: 12, ...})` takes 100 to 88.
  - A second hit 0.79 s later is ignored. A hit 0.81 s later applies.
  - During dash i-frames an enemy hit is ignored. A `hazard` hit during dash i-frames still applies (20 damage, i-frames, no hitstun, no knockback, Rush −75).
  - After a hurt, a dash press is refused for 24 ticks (0.20 s hitstun), then accepted.
  - Knockback is `vx = 180 × dir`, `vy = −160`, with `dir` away from the attacker.
  - Hit-stop of 9 ticks (0.075 s) for the player.
  - At 5 HP a 12 hit kills: `health.dead`, `deathCause` is the enemy def id, a `playerDied` event, and the body in state `dead`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(combat): GameWorld skeleton and player hurt pipeline"`

### Task 7: Player attacks (combo, buffer, cancels, move caps, facing)

**Files:**
- Create: `src/core/combat/playerCombat.ts`, `src/core/combat/playerCombat.test.ts`
- Modify: `src/core/sim/gameWorld.ts` (step 3 "player actions")

**Interfaces:**
- Consumes: `WEAPONS`, `HitGroup`, `GameWorld`.
- Produces:
  - `interface PlayerCombat { slots: [WeaponInstance | null, WeaponInstance | null]; current: { slot: 0 | 1; step: number; phase: 'startup' | 'active' | 'recovery'; phaseTicks: number; attackInstance: number } | null; queued: boolean; comboStep: [number, number]; comboWindowTicks: [number, number]; bufferTicks: number; bufferedSlot: 0 | 1 | null; nextAttackInstance: number }`.
  - `createPlayerCombat(slots)`. M2 default is `[{greatsword, C}, {war_maul, C}]`.
  - `stepPlayerCombat(w: GameWorld, input: InputState): void`. This covers 02 §9.1–9.3 and §9.5–9.6. It sets `w.mods.actionMoveMult` (while grounded: the step's `moveMult`) and `w.mods.facingLocked`, and spawns or removes melee hit groups.
  - `cancelAttack(w: GameWorld, reason: 'dash' | 'jump' | 'dive' | 'hurt'): void`. This is also called by the movement hooks when a dash or jump is accepted mid-attack (01 §3 step 5).
  - `attackSpeed(w: GameWorld, weight: Weight): number`. Returns the Rush multiplier (02 §8.3) times 1. Bonuses come later.

- [ ] **Step 1: Write the failing tests.** These are 02 checklist 9 and 18, plus §9.2.
  - Holding J: Greatsword steps 1 → 2 → 3 → 1 with phases of 24/12/24, 24/12/24, 36/18/42 ticks.
  - Mashing gives the same timing. Only one press is queued.
  - A press within 42 ticks (0.35 s) after a step ends continues the combo. After that it restarts at step 1.
  - Dash pressed on any startup tick of step 3 cancels with no hit. The next press starts step 3 again.
  - Dash during recovery keeps the combo progress.
  - Pressing K (War Maul) during Greatsword startup waits until recovery, then switches. The Greatsword combo resets to step 1.
  - Both buttons on the same tick: weapon 1 is used.
  - On the ground during a heavy step, run speed caps at 42.5 px/s (01 test 32). In the air there is no cap.
  - Facing turns to `moveX` at step start, then is locked.
  - An attack press during a slide ends the slide that tick (01 test 34). During a wall slide it detaches and faces away.
  - At Rush level 3 a Greatsword cycle takes 150 ticks (02 test 18). Set `rush.value = 300` directly.
  - An empty slot does nothing.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(combat): weapon combos, input buffer, cancels and move caps"`

### Task 8: Enemy data, spawning and stage scaling

**Files:**
- Create: `src/core/enemies/types.ts`, `src/core/enemies/enemy.ts`, `src/data/enemies.ts`, `src/data/enemyProjectiles.ts`, `src/data/enemies.test.ts`, `src/core/enemies/enemy.test.ts`
- Modify: `src/core/tuning.ts` (add `STAGE_SCALING` exactly as 04 §15, and `ENEMY`: gravity 1500, max fall 400, separation 10 px / 40 px/s, attack gap regular 0.6 / elite 0.8, alert 0.25, alert spread 128 px / 0.3 s, lose-range rule, return wait 5.0 s, death anim 0.4, activation margin 96)

**Interfaces:**
- Produces:
  - `types.ts`: 04 §15 types (`EnemyId`, `SizeClass`, `Tier`, `EnemyHit`, `EnemyAttackDef`, `EnemyDef`, `EnemyProjectileDef`). Add `EnemySpawn { enemy: EnemyId; x: number; y: number; facing: 1 | -1; patrol?: number; group?: string }`.
  - `ENEMIES`: `wolf`, `bandit`, `bandit_archer`, `wild_boar`, `bandit_brute`, `training_dummy`, exactly from 04 §3 and §2.10. Attack ids are snake_case of the names (`lunge_bite`, `snap`, `slash`, `lunge_stab`, `arrow`, `kick`, `charge`, `tusk_jab`, `club_swing`, `overhead_smash`). Stage 1 rows have no `turnDelay` values, so 0.
  - `ENEMY_PROJECTILES`: `enemy_arrow`, `brute_wave` from 04 §8.
  - `enemy.ts`:
    - `interface EnemyState { id: number; def: EnemyDef; x; y; remX; remY; vx; vy; facing: 1 | -1; hp: number; maxHp: number; poise: number; poiseImmuneTicks: number; noPoiseHitTicks: number; aware: boolean; noticeT: number; ai: AiState; hitStopTicks: number; control: { type: 'stagger' | 'knockdown' | 'dazed'; ticks: number } | null; knockback: boolean; dormant: boolean; dead: boolean; deathTicks: number; spawn: EnemySpawn; lastPlayerHitTick: number; token: 'melee' | 'ranged' | null }`.
    - `spawnEnemy(w: GameWorld, s: EnemySpawn): EnemyState` sets `maxHp = roundHalfUp(def.hp × mobHp)` (bosses would use `bossHp`), dormant until activated (04 §2.2).

- [ ] **Step 1: Write the failing tests.**
  - Data tests 04 #1 and #2 for Stage 1: regular HP in 25–60, elite 120–170, regular attack damage 8–15, elite strongest 18–22.
  - Test #3: every first Tele is ≥ 0.35 s and every chained Tele ≥ 0.25 s.
  - A Bandit spawned in Stage 2 has `56` HP (40 × 1.4). Its Slash hits for `13` (04 test 5).
  - A dormant enemy activates when its spawn point enters the camera view grown by 96 px. It stays active afterwards.
  - Every attack's `shots[].projectile` exists in `ENEMY_PROJECTILES`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(enemies): Stage 1 enemy data, spawning and stage scaling"`

### Task 9: Hit resolution and enemy reactions

**Files:**
- Create: `src/core/combat/enemyReactions.ts`, `src/core/combat/resolve.test.ts`
- Modify: `src/core/sim/gameWorld.ts` (step 7: 7a then 7b; step 9: deaths)

**Interfaces:**
- Produces:
  - `resolvePlayerHits(w: GameWorld): void` (02 §2.1 7a). Groups in creation order, targets by ascending id. Damage uses `playerHitDamage`. Then hit-stop (§4.1: melee = player and target, shot = target only), knockback (§4.2), poise and stagger (§4.3), an event, `lastPlayerHitTick`, and instant awareness.
  - `resolveEnemyHits(w: GameWorld): void` (7b). Calls `hurtPlayer`. A killed, staggered or knocked-down enemy's active hit groups were already removed in 7a, so they don't hit.
  - `applyEnemyKnockback(e: EnemyState, kb: [number, number], dir: 1 | -1)`, `damagePoise(e, amount, heavy)`, `applyControl(e, type, seconds)`: knockdown is ×0.5 for elites, regulars full (02 §4.4).
  - Kill handling, in 02 §3.5 order: flask fill (Task 12), Rush (Task 13), gold, the `kill` event, and the 0.4 s death.

- [ ] **Step 1: Write the failing tests.** These are 02 checklist 11 and 12, plus §4.2–4.3.
  - A Greatsword step-1 hit on a Bandit (40 HP, poise 20, kbResist 0.1) deals 16. Poise drops 20 → 5. KB `vx = 120 × 0.9 = 108`. Hit-stop is 6 ticks on both.
  - Two step-1 hits stagger it (poise ≤ 0). Stagger lasts 0.5 s (60 ticks) and cancels its telegraph. Its attack's cooldown starts.
  - A heavy breaking hit (cleave) gives a 0.8 s stagger.
  - No hits for 1.5 s refills poise.
  - An enemy "committed" in Tele or Act ignores knockback unless the hit staggers it.
  - An enemy killed in 7a deals no damage from a hit box active that same tick.
  - Two enemy boxes on the player on the same tick: one hit applies.
  - Knockback can push an enemy off a ledge. Walls set vx to 0.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(combat): hit resolution, poise, stagger and enemy knockback"`

### Task 10: Dive slam damage and the War Maul shockwave

**Files:**
- Create: `src/core/combat/dive.ts`, `src/core/combat/dive.test.ts`
- Modify: `src/core/sim/gameWorld.ts`, `src/core/combat/playerCombat.ts` (dive cancels an air attack, 02 §9.2)

**Interfaces:**
- Produces: `onDiveEvents(w: GameWorld, events: MoveEvent[]): void`.
  - On `diveStart` it creates the descent group for the slot's weapon.
  - On the first enemy hit it calls M1's `onDiveHit(body)` (bounce, no impact).
  - On `diveLand` it creates the impact group, which is active for 6 ticks (0.05 s).
  - For the War Maul it uses the shockwave impact box `0,−12,128,24`, 30 damage, Knockdown 1.0 s (×0.5 elite), and a `shake: medium`.
  - Each enemy is hit at most once per dive. Dives bypass guard.

- [ ] **Step 1: Write the failing tests.**
  - A Greatsword dive (heavy) onto a Wolf hits with the descent box for 26. The player bounces `vy −360`. There is no impact.
  - A War Maul dive landing next to two Bandits hits both for 30, knocks them down for 120 ticks, and emits `shake: medium`.
  - A Bandit Brute hit by it is knocked down for 60 ticks.
  - Down + attack during air-attack startup starts a dive, and the step doesn't count (02 test 32).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(combat): dive slam damage and War Maul shockwave"`

### Task 11: Enemy body movement

**Files:**
- Create: `src/core/enemies/body.ts`, `src/core/enemies/body.test.ts`

**Interfaces:**
- Produces: `stepEnemyBody(w: GameWorld, e: EnemyState): void`. This is 04 §2.1:
  - AI sets `vx` directly. The enemy uses M1's `moveX`/`moveY` collision with its own box, never drops through one-way platforms, and has gravity and max fall.
  - **Ledge probe:** before a ground step, check 1 px past the front edge and 1 px below the feet. With no support, it doesn't step, unless `dropsLedges` and the player's feet are lower.
  - Knockback motion (02 §4.2): decay of 1600 px/s² on the ground and 400 in the air. Control returns when |vx| < 20 and the enemy is grounded.
  - Separation: grounded non-bosses within 10 px push apart at 40 px/s, and the lower id moves left on a tie.
  - Facing rules.

- [ ] **Step 1: Write the failing tests.**
  - A Bandit walking at 50 px/s toward a ledge stops at the edge.
  - A Wolf (`dropsLedges`) walks off when the player is lower, and stops when the player is level.
  - Knocked-back enemies slide and stop, and fall off ledges.
  - Two Bandits on the same x separate to more than 10 px apart.
  - An enemy never drops through a one-way platform.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(enemies): enemy movement, ledges, separation and knockback motion"`

### Task 12: Heal flask

**Files:**
- Create: `src/core/combat/flask.ts`, `src/core/combat/flask.test.ts`
- Modify: `src/core/sim/gameWorld.ts` (step 3 drink input; step 10 conversion)

**Interfaces:**
- Produces:
  - `createFlask(): FlaskState` (2/2, fill 0).
  - `tryStartDrink(w, input): void`. This is 02 §7.2 checks in order: `noCharge`, `fullHp`, `blocked`, `hitstun`, then the `healRefused` event. During attack startup or active the press is buffered 0.15 s. During recovery it cancels the attack.
  - `stepDrink(w)`: lasts 48 ticks. The sip is at tick 30: charge −1, `HP += round(0.40 × maxHP)`. The move cap is 0.40. A dash or jump before the sip cancels with no cost. A hit before the sip cancels with no cost.
  - `addFlaskFill(w, tenths)`.
  - `onKillFill(w, tier)`: regular +50, elite +150, plus the conversion loop (02 §7.3).

- [ ] **Step 1: Write the failing tests.** These are 02 checklist 13, 14, 15 and 16.
  - 20 regular kills from 1/2 charges and 0 fill end at 2 charges and 0 fill.
  - An elite kill adds 150.
  - At max charges the fill caps at 1000. Drinking then leaves charges at max and fill at 0.
  - A drink at 60/100 heals to 100 on tick 30.
  - A dash at 0.20 s (tick 24) cancels the drink and keeps the charge.
  - Heal at full HP gives `healRefused fullHp` and uses nothing. At 0 charges and full HP the reason is `noCharge`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(combat): heal flask with kill-charged fill"`

### Task 13: Rush meter

**Files:**
- Create: `src/core/combat/rush.ts`, `src/core/combat/rush.test.ts`
- Modify: `src/core/sim/gameWorld.ts` (gains from hits and kills, the dash-through gain, step 10 drain, push `speedPercents`)

**Interfaces:**
- Produces:
  - `createRush(): RushState`.
  - `rushLevel(r): 0 | 1 | 2 | 3`.
  - `addRush(w, amount)`.
  - `stepRush(w)` handles the passive gain and both drains (02 §8.2).
  - `rushAttackSpeed(level, weight)`, `rushGoldMult(level)`, `rushSpeedPercent(level)` (02 §8.3).
  - Event hooks: first hit of an attack instance +3, plus +5 during or ≤ 0.20 s after a dash. Dash-through +4 per enemy per dash. Kill +15/+40. Hurt −75. Rush resets on restart.

- [ ] **Step 1: Write the failing tests.** These are 02 checklist 17 and 19.
  - 7 regular kills (+105) alone reach level 1.
  - A hit at 150 drops it to 75.
  - Standing still drains 50/s, starting 0.5 s after stopping.
  - With no gain for 4.0 s it drains 15/s.
  - Running at ≥ 102 px/s gains 6/s.
  - At level 3 `speedPercents` contains 0.15 and heavy attack speed is ×1.45.
  - The level change applies from the next attack step.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(combat): Rush meter gain, drain and effects"`

### Task 14: Enemy awareness and AI

**Files:**
- Create: `src/core/enemies/awareness.ts`, `src/core/enemies/ai.ts`, `src/core/enemies/awareness.test.ts`, `src/core/enemies/ai.test.ts`
- Modify: `src/core/sim/gameWorld.ts` (step 5: AI and movement for each active enemy in id order)

**Interfaces:**
- Produces:
  - `canSee(w, e): boolean`. This is 04 §2.4: range (half range behind), `rangeY` 80, and LOS from the eye `(x, y − h + 6)` to the player center using a Bresenham walk over tiles. One-way tiles don't block.
  - `stepAwareness(w, e)`: notice timer, alert reaction of 30 ticks, alert spread (128 px, 36 ticks later), group sharing, instant awareness on damage.
  - `stepAi(w, e)`. This is 04 §2.5–2.6:
    - States idle, patrol, alert, engage, attack, return.
    - The preferred band and the attack-gap timer.
    - Eligible attacks: range, vertical window, cooldown, a token, and for ranged attacks the enemy center inside the camera view plus LOS.
    - A weighted pick on the `enemyAI` stream, only when 2 or more are eligible.
    - Tokens: max 2 melee and 2 ranged; ties go to the lower id; elites always get one but still count.
    - Telegraph: the `enemyTelegraph` event, then Act spawns the hit group (or the Move or Leap), then Rec, then the cooldown.
    - Chains (none in Stage 1, but support the data shape).
    - Return after 5.0 s beyond `loseRange`.

- [ ] **Step 1: Write the failing tests.** These are 04 checklist 7–14, adapted to Stage 1.
  - A Wolf facing right, the player 150 px in front, same height, clear LOS: aware after exactly 42 ticks. It can't attack for 30 more.
  - With the player 150 px behind it never notices (half range 88). At 80 px behind it does.
  - With `noticeTimeMult = 2` it needs 84 ticks.
  - A solid tile between a Bandit and the player keeps `noticeT` at 0. A one-way platform doesn't block.
  - Hitting an unaware Bandit makes it aware. The hit resolves with `aware = false`.
  - When one Wolf in `group` "pack" becomes aware, the others do the same tick even 300 px away. An unrelated Bandit 100 px away becomes aware 36 ticks later.
  - With 3 Bandits in range and off cooldown, at most 2 are in Tele or Act at once.
  - A Bandit Archer whose center is outside the camera view never starts Arrow.
  - With the same seed, the same attack choices happen. A different seed can differ.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(enemies): awareness, AI state machine, attack tokens and telegraphs"`

### Task 15: Stage 1 enemy specials and enemy projectiles

**Files:**
- Create: `src/core/enemies/special.ts`, `src/core/enemies/projectiles.ts`, `src/core/enemies/special.test.ts`, `src/core/enemies/projectiles.test.ts`
- Modify: `src/core/sim/gameWorld.ts` (step 6 moves projectiles; 7b tests them against the player)

**Interfaces:**
- Produces:
  - `special.ts`:
    - Wolf back-off to 72–112 after any attack. The Lunge Bite leap `320, −180` doesn't turn, and its box ends on landing.
    - Archer walks away at `walk` when `distX < 96` and it can step back. When cornered it uses Kick.
    - Boar Charge: 300 px/s, doesn't turn, box active the whole run, hits at most once. It ends at 0.90 s (then Rec), at a ledge (skid, then Rec), or at a wall (`dazed` 1.2 s and `camera.shake(2, 0.15)`).
    - Brute Overhead Smash spawns `brute_wave` at `+24, 0` on Act start.
  - `projectiles.ts`:
    - `EnemyProjectile { id; def; x; y; vx; vy; traveled; owner: number; hitDone: boolean }`.
    - Aimed straight shots aim at the player center when Act starts, clamped to ±30°, and stop at solid tiles but not at one-way platforms.
    - Floor waves slide along the floor and stop at walls, ledge edges or their range.
    - Swept-box hit against the player once.
    - Projectiles keep flying after the shooter dies.

- [ ] **Step 1: Write the failing tests.** This includes 04 checklist 15.
  - A Boar Charge into a wall leaves it dazed for 144 ticks and emits shake. 0.90 s on open ground goes to the 72-tick Rec instead.
  - An Archer arrow fired at a player 200 px away and 30 px higher flies at the clamped angle, hits once for 9, and is stopped by a solid tile in between.
  - A `brute_wave` travels 160 px along the floor, stops at a ledge, and is jumpable: a player who jumps over it takes nothing.
  - A Wolf leap lands and its box ends on landing.
  - After a Wolf attack, the Wolf returns to `distX` 72–112.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(enemies): Stage 1 enemy specials and enemy projectiles"`

### Task 16: Camera shake, death and restart

**Files:**
- Modify: `src/core/camera.ts`, `src/core/sim/gameWorld.ts`
- Create: `src/core/sim/restart.test.ts`, `src/core/camera.shake.test.ts`

**Interfaces:**
- Produces:
  - `shake(c: CameraState, amplitude: number, durationS: number): void` and the shake offset in `stepCamera` (01 §14.4: largest `A × remaining / duration`, cap 8 px, `cosmetic` stream, 0 when the setting is off via `c.shakeEnabled`). Named levels: `small = shake(2, 0.12)`, `medium = shake(4, 0.25)`.
  - Death (06 §6.1, simplified for M2):
    - On the death tick `runTicks` stops.
    - The world keeps simulating for 120 ticks (enemies can't hurt a dead player).
    - Then `w.phase = 'deathScreen'` and the world freezes.
    - A fresh `restart.pressed` counts from 30 ticks after the death tick and calls `restart()`.
  - Instant restart (06 §6.2): `restart.held` for 60 consecutive ticks restarts in any phase except `deathScreen` (which uses the press rule). After a restart the hold counter needs one released tick.
  - `restart()` rebuilds everything from the constructor options (same `runSeed` in M2) and clears hit groups, projectiles, hit-stop, i-frames, Rush, flask and gold.

- [ ] **Step 1: Write the failing tests.** These are 01 checklist 38 and 39.
  - A `small` shake starts at amplitude 2 and lasts 14 ticks. A `medium` shake starts at 4 and lasts 30 ticks.
  - With shake off the offset is always 0.
  - Dying at tick T: `runTicks` stops at T. A restart press at T+20 is ignored, at T+31 it restarts.
  - Holding R for 59 ticks does nothing, 60 restarts. Holding through a restart doesn't restart twice.
  - After a restart mid-fight there are no hit groups or projectiles, `hp` is 100, Rush is 0, the flask is 2/2 with fill 0, and gold is 0.
  - Replaying the same 3,000-tick input recording after a restart gives identical enemy positions and HP every tick (determinism with enemies).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(core): camera shake, death and restart"`

### Task 17: Combat test level and scene

**Files:**
- Create: `src/data/levels/combatTest.ts`, `src/data/levels/combatTest.test.ts`, `src/game/scenes/CombatTestScene.ts`, `tests/e2e/combat.spec.ts`
- Modify: `src/main.ts` (start in `CombatTestScene`; `?scene=movement` opens the M1 scene), `src/game/debug.ts`, `src/game/input/devices.ts` (map `heal` Q and `restart` R if not already)

**Level** (`COMBAT_TEST`, 100 × 23 tiles, floor at row 20, feet y 320). Rects (inclusive tiles):

| # | Rect | Kind | Purpose |
|---|---|---|---|
| 1 | x 0–99, y 20–22 | solid | Floor |
| 2 | x 0, y 0–22 and x 99, y 0–22 | solid | Walls |
| 3 | x 30–36, y 16 | oneway | Archer platform 64 px up |
| 4 | x 48–52, y 17–19 | solid | Low block (ledge for enemies, cover from arrows) |
| 5 | x 70–71, y 12–19 | solid | Wall the boar can charge into |

**Spawns** (feet positions):

| Enemy | x | Facing | Notes |
|---|---|---|---|
| `training_dummy` | 120 | −1 | Next to the player spawn (x 64) |
| `wolf` × 3 | 400, 430, 460 | −1 | `group: 'pack'` |
| `bandit` × 2 | 600, 680 | −1 | `patrol: 32` |
| `bandit_archer` | 528 | −1 | Stands on the platform (#3), feet y 256 |
| `wild_boar` | 1000 | −1 | Long run toward the wall at #5 |
| `bandit_brute` | 1400 | −1 | Elite, at the far end |

- [ ] **Step 1: Write the level test.** It checks the dimensions, that each spawn stands on support and is free of solids, and that the boar has 200+ px of flat run in front of it.
- [ ] **Step 2: Build the scene.**
  - It steps `GameWorld` with the M1 fixed-step loop and copies the camera, including the shake offset.
  - **Drawing** (grey boxes, colors by state):
    - Player as in M1. While attacking, the active hitbox is a translucent red rectangle (always shown in M2, not only with `?debug=1`).
    - Enemies are filled rectangles of their hurtbox: Wolf `#73809f`, Bandit `#b8443f`, Archer `#e27b5b`, Boar `#7e2a34`, Brute `#4a1824`, Dummy `#9a6e3e`, each with a 2 × 2 eye on the facing side.
    - The telegraph flashes orange `#ff9a3c`, and the last 0.15 s near-white `#fff4d0`.
    - Hurt flash is white for 2 ticks. Stagger and knockdown are tinted grey. Dying fades out over 0.4 s.
    - Projectiles are small `#ffd84a` rectangles. A "?" above an enemy while `noticeT > 0` and unaware.
    - Enemy HP bars: elites always, regulars after the first damage. Each is 1 px tall, as wide as the hurtbox, 4 px above it.
  - **Debug HUD** (top-left, default font, M2 only): `HP 88/100`, `Flask ●● 35%`, `Rush 172 (L1)`, `Gold 14`, the weapons with their current combo step, and `Time 0:42.31` (`runTicks`).
  - **Death overlay**: after the 1.0 s, a dark overlay with `You died — press R`.
  - `debug.ts` adds `world()` (a read-only snapshot: player HP, flask, Rush, gold, phase, and enemies with id, def, x, y, hp, aware and ai state) and `spawn(enemyId, x, y, facing)`.
- [ ] **Step 3: Write `tests/e2e/combat.spec.ts`.**
  - **Boots into the combat scene with no errors.** Save `test-results/combat-start.png`.
  - **Kills the training dummy's HP bar down.** In manual mode, step right until next to the dummy, hold J for 216 ticks, then assert dummy damage taken ≥ 66.
  - **Wolves notice and attack.** Teleport near the pack, step 120 ticks idle, then assert at least one wolf is aware and the player took damage. Save `test-results/combat-wolves.png` during a telegraph.
  - **Death and restart.** Set HP to 1 via debug, let a Bandit hit, step 130 ticks, then save `test-results/combat-dead.png`. Press R and assert HP 100 and no enemies dead.
- [ ] **Step 4: Run** `npm run typecheck && npm test && npm run build && npm run test:e2e`. All pass. **Read every screenshot.**
- [ ] **Step 5: Commit and push.** `git commit -m "feat(game): combat test level with Stage 1 enemies"`

### Task 18: Review and hand-off

- [ ] **Step 1: Run the complete check suite again** and confirm the 02 and 04 checklist items listed under "Done when" all have passing tests.
- [ ] **Step 2: Independent review.** If you can dispatch a fresh reviewer (subagent), do so on the whole M2 diff, focused on the Review Focus list. Fix real bugs with tests. If you can't, say so plainly in the hand-off.
- [ ] **Step 3: Tell the user,** in plain words with screenshots:
  - **Controls:** J Greatsword, K War Maul, Q drink, hold R to restart, down + J/K in the air to dive slam.
  - **What to fight, in order:** the dummy, the wolf pack, the bandits, the archer on the platform, the boar (make it charge into the wall), and the Brute at the end.
  - **What to look for:** orange flashes mean an enemy is about to attack. Dash through it (i-frames) or out of range.
  - **Ask** how combat feels. Do hits feel heavy (hit-stop)? Are enemies too passive or too aggressive? Is the Brute fair?
  - **List** any new SPEC-GAPs.

---

## Done when

- All tasks are checked, and `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e` pass.
- These spec checklist items have passing tests:
  - **02:** 1 (Greatsword part), 3 (two weapons), 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 32.
  - **04:** 1, 2, 3 (Stage 1 data), 5, 7, 8, 9, 10, 11, 12 (with the wolf pack in place of War Hounds), 13, 14, 15.
  - **01:** 31, 36 (spike part waits for M3), 38, 39.
- The user has fought the Stage 1 enemies (or seen the screenshots) and given feedback on the feel.

**Next plans:**
- `ART1-style-board-plains.md`: real art for the player and the Stage 1 enemies, for the user to approve. Can run in parallel; it only touches `tools/` and `public/assets/`.
- `M3-stage1-level.md`: the real Plains & Forest stage built from Tiled JSON, the timer and splits. Written by the design chat after M2.
