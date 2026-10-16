# 04 — Enemies and Bosses

**This file owns:** every regular mob and elite in the 5 biomes (stats, size, hurtbox, speed, AI state machine, notice range and time, telegraphs, attacks, cooldowns, poise, guard and armor), enemy projectiles, per-enemy gold and item drops, elite rules, how stage scaling is applied, the 3 Guardians, the Black Knight, the Enemy King, the Dragon (4 colors), boss arenas, boss phases and break windows, and the data behind boss health bars.

**Only referenced here:**
- `01-movement.md`: gravity, the pixel-step collision algorithm, one-way rules, `applyImpulse`, `MoveModifiers.rooted`, camera bounds and `camera.shake`.
- `02-combat.md`: damage formula, hit rules, hit-stop, knockback on enemies, poise and stagger, control effects, freeze/chill/time scale, guard handling (§4.5), player hurt pipeline, player statuses (Burning, Poisoned, Chilled, Rooted), kill credit, flask fill and Rush per kill tier.
- `03-classes-abilities.md`: Thief Silent Steps numbers (they plug into §2.4 here), Time Slow, Hunter's Mark.
- `05-loot-economy.md`: what items drop and at what grade, coin pickup, Golden Touch, Ambush pack contents, blueprints, gold budget.
- `06-run-levels-save.md`: how spawns, arenas, waves and summon points are written in Tiled, arena door locking, when the Dragon lands, death and run end.
- `07-ui-hud-controls.md`: how HP bars, boss bars and notice marks are drawn. `08-art-audio.md`: sprites, flashes, sounds.

All numbers live in `src/data/enemies.ts` (defs), `src/data/enemyProjectiles.ts` and `STAGE_SCALING` in `src/core/tuning.ts`.

## 1. Notation

| Term | Meaning |
|---|---|
| Feet point | Bottom center of the enemy hurtbox. Enemy position `(x, y)` is the feet point, same convention as the player (01 §2.1). |
| `distX` | `abs(player.x − enemy.x)` in px. |
| `dY` | Player hurtbox center y − enemy hurtbox center y. **Negative = player is above.** |
| `x a–b` | "Use when `a ≤ distX ≤ b`." |
| Default vertical window | Melee attacks: `−40 ≤ dY ≤ 24`. Ranged and targeted attacks: `−96 ≤ dY ≤ 96`. Listed otherwise. |
| Box `dx,dy,w,h` | Same as 02 §2.2: box center offset from the enemy feet, facing right; mirror `dx` when facing left. Melee boxes move with the enemy. |
| Tele / Act / Rec | Telegraph (= startup), active, recovery, in seconds. |
| CD | Cooldown of that attack, starting when its recovery ends. |
| Player KB | `playerKb [x, y]` override for 02 §5.2 step 7. `x` points away from the enemy center (projectiles: their travel direction). Blank = 02's default. |
| Move `d/t` | During Act, the enemy moves `d` px over `t` s at constant speed in its facing. Stops at walls and ledges. |
| Leap `vx,vy` | At Act start set velocity (vx in facing). Gravity 1500 px/s² applies. Act lasts until landing (max 1.0 s). |
| Jump-to-X `T` | At Act start, target = player feet x (clamped to the arena or 16 px inside walls). `vx = (target − x) / T`, `vy = −750 × T` (lands at the same height after `T` s). Act lasts until landing. |
| Base | All HP and damage below are **Stage-1 base values**. Stage scaling (§2.3) is applied at spawn. Never pre-multiply in the data. |

## 2. Shared rules

### 2.1 Body and movement
- Each enemy has an axis-aligned hurtbox `w × h` with its feet at the bottom center. **Hurtbox = collision box.**
- **Ground enemies** use 01's pixel-step collision with their own box: solid tiles, solid bodies (doors, arena gates) and map edges block them; one-way platforms hold them from above. They **never drop through** one-way platforms. Gravity 1500 px/s², max fall 400 px/s.
- AI movement **sets `vx` directly** (no acceleration). Knockback, stagger and control effects follow 02 §4.
- **Ledges:** before a ground step, probe the point 1 px past the front edge of the hurtbox and 1 px below the feet. If there is no solid or one-way support there, the enemy does not step (it stops at the edge). Exception: enemies with `dropsLedges` walk off if the player's feet are lower than theirs. Knockback can push any enemy off a ledge.
- **Flyers** (`flying`): no gravity. They move in 2D straight toward their desired point at `fly` px/s, collide with solid tiles (slide along them) and pass through one-way platforms. **Ghost** flyers (`ghost`) also pass through solid tiles.
- **Water:** ground enemies in water move at ×0.5 speed, except `waterWalker`. **Spikes, ice and collapsing-platform triggers do nothing to enemies** (a collapsed platform under an enemy makes it fall).
- **No body collision** with the player (`blocksPlayer` is `false` for every enemy in v1). Enemies do not collide with each other. **Separation:** each tick, two grounded non-boss enemies whose feet x are within 10 px push apart at 40 px/s each (collision-checked, lower id moves left on a tie).
- **Speed modifiers:** `walk`, `chase` and `fly` are multiplied by the global `enemySpeedMult` (Hunted curse, 05) and by the enemy's `timeScale` (02 §6.3, Time Slow in 03). Attack moves and leaps are scaled only by `timeScale`.
- **Facing:** while engaged and not attacking, the enemy faces the player (`sign(player.x − enemy.x)`; keep facing if `distX < 2`). If `turnDelay > 0`, it turns only after the player has been on the other side **continuously** for `turnDelay` s. Facing is locked from Tele start to Rec end.

### 2.2 Spawning and activation
- Spawns are level objects (06) with these properties: `enemy` (id), `facing` (1 or −1), `patrol` (px each side, default 0), `group` (string, optional), `hang` (Giant Spider), `submerged` (Bog Zombie), `stone` (Gargoyle, default true).
- An enemy is **dormant** (not simulated, not hittable, not drawn) until its spawn point is inside the camera view expanded by 96 px on every side. Then it activates and stays active for the rest of the stage. Enemies never respawn.
- **Arena waves, Ambush packs (05) and summons** play a **0.5 s spawn-in**: invulnerable, cannot act. They then start **aware** (skip noticing) and never return home.

### 2.3 Stage scaling
Every enemy uses the multipliers of the **stage it appears in** (the stage's level, not the player's progress):

| Stage | Level | Mob/elite HP × (`mobHp`) | Boss HP × (`bossHp`) | Damage × (`dmg`) |
|---|---|---|---|---|
| 1 | Plains & Forest | 1.0 | 1.0 | 1.0 |
| 2 | Caves & Mountains / Dark Forest & Swamps | 1.4 | 1.7 | 1.3 |
| 3 | Enemy Kingdom | 1.9 | 2.6 | 1.5 |
| 4 | King's Castle | 2.4 | 3.6 | 1.7 |

(Same values as the shared-numbers table in 00-README.)

- `maxHP = round(baseHP × m)`, rounded half up, set once at spawn. `m` is `mobHp` for regular mobs, elites, summons (Spiderlings, Royal Decree guards) and Ambush packs, and `bossHp` for the 6 bosses (3 Guardians, Black Knight, Enemy King, Dragon). Living Armor's revive HP and Goblin Shaman barriers use `mobHp` (see their entries).
- Attack damage at the current stage `A = baseDamage × dmg` as a float. 02 §3.3 rounds the final result. Player statuses from enemy attacks are scaled by 02 §5.4 with the same `dmg`.
- **Not scaled:** speeds, timings, telegraphs, poise, kbResist, notice values, gold, hitbox sizes.
- The **Dragon** uses Stage 2 or Stage 3 multipliers, whichever stage it lands in. Summons use the stage of their summoner. Practice mode (06) uses the practiced stage. Ambush packs use the current stage.

### 2.4 Noticing the player (awareness)
Every non-boss enemy has `aware: boolean` (starts `false`) and a notice timer `noticeT` (starts 0).

- **Can see** = all of these are true:
  1. `distX ≤ range` (if the player is **behind** the enemy, i.e. on the side opposite its facing: `distX ≤ range / 2`). `noFacing` enemies always use the full range.
  2. `abs(dY) ≤ rangeY` (default 80 px; flyers 128 px).
  3. Line of sight: a ray from the enemy's eye `(x, y − h + 6)` to the player hurtbox center crosses no solid tile and no active non-one-way solid body (step the tile grid with Bresenham). One-way tiles and water never block. Ghost enemies skip this check.
- Each tick (scaled by `timeScale`): if it can see, `noticeT += TICK`; otherwise `noticeT = max(0, noticeT − TICK)`.
- When `noticeT ≥ time × noticeTimeMult`, the enemy becomes **aware**. `noticeTimeMult` and `noticeRangeMult` (applied to `range` and `rangeY`) are player-side multipliers, 1.0 by default. **Thief Silent Steps sets them; values in 03.**
- While `noticeT > 0` and unaware, the enemy **stops moving and keeps its facing** (07 shows a "?").
- **Instant awareness** (no timer): taking any damage from the player (direct or secondary); being in a spawn-in group (§2.2); an ally sharing its `group` id becoming aware (any distance).
- **Alert spread:** when an enemy becomes aware, every unaware enemy within 128 px of it (center to center, no LOS) becomes aware 0.3 s later.
- On becoming aware: an **alert reaction of 0.25 s** (turns to face the player at once, ignoring `turnDelay`; cannot attack; can be hit). Skipped if the enemy became aware by being hit.
- A hit that makes an enemy aware is resolved **while it is still unaware** (03's Thief first-hit crit sees `aware = false`); the flag flips right after that hit. Later hits in the same tick see `aware = true`.
- **Bosses are always aware.** Gargoyles in stone form, hanging spiders and submerged zombies are unaware until they wake (their entries).

### 2.5 AI state machine
```
dormant ─activate─▶ unaware(idle|patrol) ─notice─▶ alert(0.25 s) ─▶ engage
engage ─pick attack─▶ attack[tele ▶ act ▶ rec] ─▶ engage (attackGap timer)
engage ─player beyond loseRange for 5.0 s─▶ return ─home reached─▶ unaware
any but dead ─02 effects─▶ knockback | stagger | stun | knockdown | pin | launch | pull | frozen ─done─▶ engage
any ─HP ≤ 0─▶ dead   (Living Armor first time: pile ▶ rise ▶ engage)
special states: spawnIn, hanging, submerged, stone, channel, dazed, perched/passive (Dragon)
```
- **Idle / patrol:** `patrol = 0` stands still facing `facing`. Otherwise walks at `walk` from spawn x to `x + patrol·facing`, then to `x − patrol·facing`, pausing 1.0 s at each end. A wall or ledge counts as an end.
- **Engage:** move to keep `distX` inside the enemy's `preferred` band `[min, max]` at `chase` speed (ranged enemies use `walk` when backing off). If `distX > max`: move toward. If `distX < min`: move away unless blocked by a wall or ledge (then stand). Otherwise stand facing the player. Unreachable players (on a platform, across a gap) make ground enemies stand at the closest reachable point.
- **loseRange** = `max(320, 2 × range)`. **Return:** walk home at `walk`; noticing restarts from `noticeT = 0`. If blocked, stop there and become unaware.
- Interrupts from 02 cancel the current attack (its cooldown still starts, 02 §4.3). Afterwards the enemy goes to engage with its attack-gap timer at 0.
- Enemy timers (telegraph, active, recovery, cooldowns, gaps, notice) advance by `TICK × timeScale` and pause during the enemy's hit-stop.

### 2.6 Choosing and running attacks
- In engage, when the **attack-gap timer** is 0 (default **0.6 s** regular, **0.8 s** elite; listed per boss) and the enemy is not turning, collect **eligible** attacks: in range and vertical window, off cooldown, required token available, and (for ranged and targeted attacks) the enemy's hurtbox center is **inside the camera view** (bosses exempt) with LOS from the shot spawn point.
- If several are eligible, pick by `weight` (default 1) with the `enemyAI` RNG stream (README). Roll only when 2 or more are eligible. **Bosses never pick the same attack twice in a row** when another is eligible.
- **Reactions** (Hex Hop, Teleport, Blink Away, Bulwark) are checked **before** attacks and ignore the attack gap. They use no token.
- **Attack tokens:** at most **2** enemies may be in Tele or Act of a `melee`-token attack at once, and at most **2** of a `ranged`-token attack. A token is held from Tele start to Act end. On a tie, the lower entity id gets it. **Elites** always get a token (but still count toward the limit). Bosses use no tokens.
- **Telegraph (every attack):** Tele always has the enemy flashing (08 picks colors; the last 0.15 s is the bright "go" flash). Area attacks also show a ground or line marker for the whole Tele. Core emits `enemyTelegraph {enemyId, attackId, duration}`. **Minimum Tele is 0.35 s for the first hit of any attack and 0.25 s for a chained follow-up hit** (`chain`). Telegraph times never shrink in later boss phases.
- **Chains:** a multi-hit attack lists extra hits. Each follows the previous Act with its own short Tele (still flashing), then its own Act. Rec comes after the last hit.
- After Rec: the attack's CD starts and the attack-gap timer restarts.
- 02's "committed" rule applies from Tele start to Act end.

### 2.7 Hit groups and projectiles
- An enemy hit group hits the player at most once per activation unless it lists `rehit`/`maxHits` (02 §2.3). Melee boxes ignore terrain. Enemy attacks never hurt enemies, Lucky Blocks or level objects.
- Enemy hits go through 02 §5.2. Attacks marked **unblockable** ignore the shield (02 §12).
- **Projectile spawn point:** `dx = hurtbox.w / 2 + 4`, `dy = −0.6 × hurtbox.h` from the feet, on the facing side, unless listed.
- **Aimed shots** aim at the player hurtbox center at the moment Act starts (the end of Tele), then clamp the angle to the attack's limit (default ±30° from horizontal).
- **Arc shots** target the player's feet point at Act start: `vx = clamp((tx − sx) / T, −260, 260)`, `vy = (ty − sy − 0.5 × g × T²) / T`, with `g = 1000` px/s². They land on solid tiles and on one-way platforms while falling.
- **Straight shots** stop at solid tiles and pass through one-way platforms (02 §2.3). Swept-box tests as in 02.
- **Floor waves** slide along the floor at a fixed speed, sitting on it. They stop at walls, at ledge edges, or at their range.
- **Falling objects** (rocks, swords, fire rain) spawn at the arena ceiling at a marked x and fall straight down at a fixed speed, passing through one-way platforms. They vanish on the floor. Their marker shows on the floor from cast start.
- Projectiles fly on after their shooter dies or is staggered. They are not affected by the shooter's hit-stop or chill, but they are scaled by the global Time Slow factor (03).
- **Puddles and clouds** are hazards: every 0.5 s from creation, if the player hurtbox overlaps one, apply its status once. They ignore i-frames, cannot be blocked, deal no direct damage and cause no hurt reaction.

### 2.8 Death, rewards and drops
- On `HP ≤ 0` (02 §3.4 decides kill credit): the hurtbox and all hit groups are removed that tick. The death animation lasts 0.4 s (08). On-kill effects run in 02 §3.5 order.
- **Gold:** each enemy drops its listed `gold` (flat, not stage-scaled) on a player kill. 05 handles coin pickup, Rush gold factor (02 §8.3), Golden Touch and the budget. For budgeting only: an assumed stage with ~40 regulars, ~4 elites and its boss gives about 160 + 80 + boss gold from enemies before multipliers.
- **Elite item roll:** each elite spawn rolls once **at stage load**, in ascending spawn-id order, on the `enemyDrops` RNG stream derived from `(runSeed, 'enemyDrops', stageIndex)`: `r < 0.15` → drops a **key**; `0.15 ≤ r < 0.30` → drops a **Lv1 ability** (which one: 05); otherwise nothing. The drop appears at the death point on a player kill. A key drops even if the player is at the key cap (05's pickup rules apply). Ambush/wave elites roll when they spawn, on the same stream.
- **Blueprints:** elites and bosses have `blueprintRoll: true`; chance and pool are in 05. Regulars never drop items.
- **No rewards** (no gold, flask, Rush, kill counters, curse counter, drops): summons, the Training Dummy, a Will-o'-Wisp that blows itself up, and Living Armor's first collapse.
- Boss loot: §9.6.

### 2.9 Elite rules
- One elite type per biome (§3–§7). `elite: true`, size `large`. 02 applies: flask +15%, Rush +40, ×0.5 control durations, 0.75 s freeze, 2.0 s poise immunity after stagger.
- Attack gap 0.8 s. Elites always get an attack token. `hpBar: 'always'` (07 draws a small bar over them). Regular mobs use `'damaged'` (bar shows after first damage), bosses `'boss'`.
- Level design (06) places elites; this file never turns regulars into elites.

### 2.10 Training Dummy (Home Village)
`training_dummy`: size medium, hurtbox 16 × 32, HP 9999, poiseMax 50, kbResist 1.0, never acts, never dies (HP returns to max 1.0 s after the last damage), faces right (backstabs work), no rewards. Not stage-scaled.

## 3. Stage 1 — Plains & Forest

| Enemy | id | Size | Hurtbox | HP | Poise | kbRes | Walk / Chase | Notice range / time | Preferred | Gold | Traits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Wolf | `wolf` | small | 28×16 | 30 | 10 | 0 | 60 / 150 | 176 / 0.35 | 72–112 | 3 | `dropsLedges`, packs of 2–3 |
| Bandit | `bandit` | medium | 14×28 | 40 | 20 | 0.1 | 50 / 95 | 160 / 0.45 | 20–32 | 4 | |
| Bandit Archer | `bandit_archer` | medium | 14×28 | 28 | 10 | 0.1 | 50 / 70 | 240 / 0.50 | 120–220 | 4 | backs off |
| Wild Boar | `wild_boar` | medium | 30×20 | 45 | 30 | 0.3 | 40 / 70 | 192 / 0.40 | 24–200 | 4 | charger |
| **Bandit Brute** (elite) | `bandit_brute` | large | 24×40 | 160 | 70 | 0.7 | 40 / 70 | 160 / 0.50 | 24–40 | 20 | |

| Enemy | Attack | Use when | Tele | Act | Rec | CD | Dmg | Box / shot | Player KB | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Wolf | Lunge Bite | x 48–112, `−24 ≤ dY ≤ 16` | 0.40 | leap | 0.45 | 1.6 | 10 | `14,−8,22,14` | | Leap `320,−180` |
| | Snap | x ≤ 40 | 0.35 | 0.10 | 0.35 | 1.0 | 8 | `16,−8,20,14` | | |
| Bandit | Slash | x ≤ 36 | 0.45 | 0.10 | 0.40 | 1.2 | 10 | `20,−14,32,24` | | weight 2 |
| | Lunge Stab | x 40–80 | 0.50 | 0.20 | 0.50 | 3.0 | 12 | `18,−14,28,10` | | Move 64/0.2 |
| Bandit Archer | Arrow | x 64–240 | 0.60 | 0 | 0.50 | 1.8 | 9 | `enemy_arrow` | | aimed |
| | Kick | x ≤ 32 | 0.35 | 0.08 | 0.40 | 2.0 | 8 | `14,−12,18,16` | 260, −120 | |
| Wild Boar | Charge | x 32–256, `abs(dY) ≤ 16` | 0.60 | ≤0.90 | 0.60 | 2.5 | 12 | `14,−10,24,18` | 300, −200 | runs 300 px/s |
| | Tusk Jab | x ≤ 28 | 0.45 | 0.10 | 0.45 | 1.5 | 10 | `14,−10,22,18` | | |
| Bandit Brute | Club Swing | x ≤ 48 | 0.55 | 0.12 | 0.55 | 1.4 | 18 | `26,−20,44,36` | 260, −160 | |
| | Overhead Smash | x ≤ 56 | 0.80 | 0.10 | 0.80 | 3.5 | 22 | `30,−12,40,24` + `brute_wave` | 300, −240 | wave forward |

- **Wolf:** after any attack it backs off to its preferred band (72–112) and paces. It does not turn during the leap; the leap box ends on landing.
- **Bandit Archer:** if `distX < 96` and it can step back, it walks away at `walk`; if cornered, it uses Kick.
- **Wild Boar Charge:** does not turn while charging. The box stays active for the whole run and hits the player at most once. Ends when 0.90 s pass (then Rec), at a ledge (skids to a stop, then Rec), or at a wall: then **dazed** for 1.2 s (cannot act, takes damage normally; not a 02 control effect) instead of Rec. Emits `camera.shake(2, 0.15)` on a wall.
- **Bandit Brute:** the Overhead Smash wave spawns at `+24, 0` on Act start.

## 4. Stage 2 — Caves & Mountains

| Enemy | id | Size | Hurtbox | HP | Poise | kbRes | Walk / Chase (Fly) | Notice | Preferred | Gold | Traits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Bat Swarm | `bat_swarm` | small | 24×16 | 25 | 0 | 0 | (110) | 160 / 0.30 | — | 3 | flyer, `noFacing` |
| Goblin Miner | `goblin_miner` | small | 12×20 | 30 | 10 | 0 | 55 / 70 | 192 / 0.45 | 80–180 | 4 | |
| Rock Golem | `rock_golem` | large | 26×32 | 60 | 40 | 0.6 | 35 / 35 | 128 / 0.60 | 20–40 | 5 | guard, `turnDelay` 0.8 |
| Ram | `ram` | medium | 26×22 | 40 | 25 | 0.3 | 50 / 90 | 176 / 0.40 | 24–56 | 4 | |
| **Goblin Shaman** (elite) | `goblin_shaman` | large | 14×24 | 120 | 50 | 0.5 | 50 / 60 | 208 / 0.50 | 120–200 | 20 | support |

| Enemy | Attack | Use when | Tele | Act | Rec | CD | Dmg | Box / shot | Player KB | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Bat Swarm | Dive Bite | center-to-center ≤ 96 | 0.40 | ≤0.50 | 0.60 | 1.5 | 8 | `0,−8,20,14` | | dives 260 px/s |
| Goblin Miner | Bomb Toss | x 48–200 | 0.55 | 0 | 0.50 | 2.2 | 13 | `bomb` | 240, −220 | arc T 0.8 |
| | Pick Swing | x ≤ 30 | 0.40 | 0.10 | 0.40 | 1.2 | 9 | `14,−10,20,18` | | |
| Rock Golem | Fist Slam | x ≤ 44 | 0.65 | 0.12 | 0.70 | 1.6 | 14 | `24,−10,36,20` | | |
| | Shoulder Ram | x 48–120 | 0.60 | 0.30 | 0.70 | 3.0 | 12 | `16,−16,24,30` | 280, −180 | Move 96/0.3 |
| Ram | Headbutt | x ≤ 64 | 0.55 | 0.20 | 0.60 | 1.8 | 11 | `16,−11,22,20` | **420, −220** | Move 72/0.2 |
| | Leap Butt | x ≤ 96, `−64 ≤ dY ≤ −24` | 0.60 | leap | 0.50 | 3.0 | 11 | `16,−11,22,20` | 420, −220 | Leap `160,−420` |
| Goblin Shaman | Stone Ward | ally in 160 px without a ward | 0.60 | — | 0.40 | 7.0 | — | — | | support, no token |
| | Hex Bolt | x 48–224 | 0.55 | 0 | 0.50 | 2.0 | 18 | `hex_bolt` | | aimed, homing |
| | Stone Spikes | x ≤ 64 | 0.70 | 0.20 | 0.60 | 4.0 | 20 | `36,−12,64,24` | 200, −300 | ground marker |

- **Bat Swarm movement:** every 0.5 s pick a waypoint = player center + (`rngInt(−48, 48)`, `rngInt(−72, −32)`) on the `enemyAI` stream and fly toward it. Dive Bite flies straight toward the player center as it was at Act start, for up to 0.5 s or until hitting a solid tile, then Rec (rises back). Poise 0: every direct hit staggers it. **Data:** `notice {range: 160, rangeY: 128, time: 0.30}` (flyer default rangeY), `preferred: [0, 0]` (this waypoint rule replaces the preferred band).
- **Rock Golem armor:** `guard {guardMult: 0.25, when: 'always', bypassAbove: true}`. 02 §4.5 handles frontal hits. **`bypassAbove`:** a hit whose source center y is above the golem's hurtbox top is never guarded. Dive slams always bypass (02). It is meant to be hit from behind or above.
- **Ram:** the Headbutt knockback is the "off ledges" threat. Leap Butt lets it follow the player up one platform.
- **Goblin Shaman — Stone Ward:** gives a barrier to up to 3 allies within 160 px (never itself): Goblin Miners first, then the lowest HP fraction, ties by lower id. Barrier HP = `round(20 × mobHp)`; lasts 8.0 s or until used up. Final damage (after 02's rounding, including secondary damage) goes to the barrier first; leftover goes to HP. While a barrier is up, the target takes no poise damage and no knockback. A new ward replaces an old one. **Blink Away** (reaction): when `distX ≤ 48`, CD 5.0 s: 0.3 s fade (hittable), then teleports to the first valid spot 160 px away from the player on its own side, else the other side (valid = 14×24 box free, standing on ground found by scanning down ≤ 64 px, inside the camera view). No valid spot: no teleport, CD still starts.

## 5. Stage 2 — Dark Forest & Swamps

| Enemy | id | Size | Hurtbox | HP | Poise | kbRes | Walk / Chase (Fly) | Notice | Preferred | Gold | Traits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Bog Zombie | `bog_zombie` | medium | 14×28 | 45 | 20 | 0.2 | 40 / 40 | 128 / 0.60 (rise: 72) | 16–32 | 4 | `waterWalker`, submerged |
| Giant Spider | `giant_spider` | medium | 26×16 | 35 | 15 | 0.2 | 70 / 110 | 160 / 0.40 (hang: 40) | 24–96 | 4 | hanging |
| Will-o'-Wisp | `wisp` | small | 14×14 | 25 | 0 | 0 | (70) | 192 / 0.30 | 0 | 3 | ghost flyer, `noFacing` |
| Swamp Witch | `swamp_witch` | medium | 14×28 | 32 | 10 | 0.1 | 45 / 60 | 224 / 0.50 | 120–200 | 4 | backs off |
| **Treant** (elite) | `treant` | large | 30×52 | 170 | 80 | 0.8 | 30 / 30 | 160 / 0.60 | 32–64 | 20 | `turnDelay` 0.6 |

| Enemy | Attack | Use when | Tele | Act | Rec | CD | Dmg | Box / shot | Player KB | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Bog Zombie | Rise Swipe | wakes (see below) | 0.80 | 0.10 | 0.40 | — | 10 | `0,−14,24,28` | | once, on rising |
| | Claw | x ≤ 36 | 0.50 | 0.10 | 0.50 | 1.4 | 11 | `18,−16,28,24` | | |
| | Grab Lunge | x ≤ 56 | 0.60 | 0.20 | 0.70 | 3.5 | 13 | `20,−16,24,20` | | Move 40/0.2, +1 Poisoned |
| Giant Spider | Drop | hanging trigger | 0.35 | fall | 0.40 | — | 12 | `0,−8,24,16` | | falls 480 px/s |
| | Bite | x ≤ 32 | 0.40 | 0.10 | 0.40 | 1.2 | 9 | `16,−8,20,14` | | |
| | Pounce | x 48–128 | 0.50 | leap | 0.50 | 2.5 | 11 | `12,−8,22,14` | | Leap `280,−260` |
| Wisp | Detonate | center-to-center ≤ 40 | 0.70 | 0.10 | — | — | 14 | `0,−7,72,72` | 260, −200 | dies after |
| Swamp Witch | Poison Potion | x 64–224 | 0.60 | 0 | 0.50 | 2.6 | 9 | `potion` | | arc T 0.7, +1 Poisoned, puddle |
| | Claw | x ≤ 28 | 0.40 | 0.10 | 0.40 | 1.5 | 8 | `14,−14,20,20` | | |
| Treant | Root Snare | x ≤ 224, `abs(dY) ≤ 64` | 0.80 | 0.25 | 0.60 | 4.0 | 12 | `0,−20,40,40` at marker | | Rooted 1.0 s |
| | Branch Slam | x ≤ 64 | 0.65 | 0.12 | 0.70 | 1.6 | 20 | `34,−20,52,40` | 280, −200 | |

- **Bog Zombie — submerged** (default when its spawn point is in water; `submerged: false` makes it a normal unaware zombie): invisible except bubbles, not hittable, unaware. Wakes when the player center is within 72 px horizontally and `abs(dY) ≤ 48` (no LOS check, no timer). It then plays **Rise Swipe**: the 0.8 s rise is its telegraph (hittable, flashing), then the swipe. Then it is aware.
- **Giant Spider — hanging** (`hang: true`): it hangs at its spawn point on a thread from the ceiling, hittable, unaware. **Trigger:** the player center is within 40 px horizontally, below the spider, with LOS. Then Drop: 0.35 s telegraph (thread shakes), then it falls at 480 px/s with its box active until it lands, then Rec, then aware. If damaged while hanging, it falls at once **with no hit box** and becomes aware.
- **Wisp:** flies straight at the player center (through walls). When within 40 px it stops and swells for 0.7 s, then explodes and dies. **A self-explosion gives no rewards.** Killed by the player at any time before Act: harmless pop, normal kill. Its explosion is blockable.
- **Swamp Witch:** the potion shatters on the ground or on the player: splash box 40×24 centered on the impact point (9 damage + 1 Poisoned stack), then a puddle (§2.7) 48×8 on the floor for 2.5 s that adds 1 Poisoned stack per 0.5 s. A potion that shatters on the player leaves no puddle. **Hex Hop** (reaction): when `distX ≤ 56`, CD 3.0 s: 0.3 s tele, then Leap `−200, −300` (backward). Uses Claw if Hex Hop is on cooldown or blocked by a wall/ledge.
- **Treant — Root Snare:** the marker (40 px wide) appears under the player's feet x at Tele start and **does not follow**. Roots hit only inside the marker box. After Root Snare's Rec the Treant's attack gap is **1.2 s** (so Branch Slam cannot land during the 1.0 s root).

## 6. Stage 3 — Enemy Kingdom

| Enemy | id | Size | Hurtbox | HP | Poise | kbRes | Walk / Chase | Notice | Preferred | Gold | Traits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Soldier | `soldier` | medium | 14×28 | 45 | 25 | 0.3 | 50 / 85 | 176 / 0.45 | 24–40 | 4 | shield, `turnDelay` 0.5 |
| Crossbowman | `crossbowman` | medium | 14×28 | 30 | 10 | 0.1 | 0 / 0 | 288 / 0.50, rangeY 160 | — | 4 | `stationary` |
| War Hound | `war_hound` | small | 28×18 | 28 | 10 | 0 | 80 / 165 | 192 / 0.30 | see notes | 3 | `dropsLedges`, packs of 3 |
| Battle Mage | `battle_mage` | medium | 14×28 | 35 | 10 | 0.1 | 45 / 60 | 224 / 0.50 | 128–224 | 5 | teleports |
| **Knight** (elite) | `knight` | large | 18×36 | 160 | 80 | 0.7 | 45 / 70 | 176 / 0.50 | 32–52 | 20 | armor |

| Enemy | Attack | Use when | Tele | Act | Rec | CD | Dmg | Box / shot | Player KB | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Soldier | Sword Thrust | x ≤ 44 | 0.50 | 0.10 | 0.45 | 1.3 | 11 | `24,−16,36,12` | | shield down |
| | Shield Bash | x ≤ 28 | 0.40 | 0.10 | 0.40 | 2.5 | 8 | `14,−14,18,26` | 320, −140 | shield stays up |
| Crossbowman | Bolt | x 48–320, `abs(dY) ≤ 160` | 0.70 | 0 | 0.60 | 2.2 | 12 | `enemy_bolt` | | aim line, ±45° |
| | Kick | x ≤ 32 | 0.35 | 0.08 | 0.40 | 2.0 | 9 | `14,−12,18,16` | 300, −160 | |
| War Hound | Leap Bite | x 40–120 | 0.40 | leap | 0.40 | 1.8 | 10 | `14,−9,22,14` | | Leap `340,−200` |
| | Snap | x ≤ 36 | 0.35 | 0.08 | 0.35 | 1.0 | 8 | `16,−9,20,14` | | |
| Battle Mage | Fireball | x 80–288 | 0.60 | 0 | 0.50 | 2.4 | 12 | `fireball` | | aimed, Burning |
| | Flame Burst | x ≤ 48 | 0.55 | 0.15 | 0.60 | 3.0 | 13 | `0,−20,64,40` | | Burning, ground marker |
| Knight | Sword Combo | x ≤ 52 | 0.55 | 0.10 | 0.70 | 2.0 | 18 | `26,−18,44,30` | | chain ↓ |
| | ↳ hit 2 | | 0.30 | 0.12 | | | 20 | `28,−16,48,26` | 300, −180 | |
| | Charging Thrust | x 64–176 | 0.70 | 0.35 | 0.80 | 4.0 | 22 | `22,−18,36,14` | 340, −160 | Move 160/0.35 |

- **Soldier shield:** `guard {guardMult: 0.2, when: 'notAttacking', bypassAbove: false}`. The guard is **down** during its own Sword Thrust (Tele through Rec) and up at all other times, including Shield Bash, stagger excluded (no guard while staggered or under a control effect).
- **Crossbowman:** never walks (it stands on walls and rooftops); it only turns. During the first 0.5 s of Tele its red aim line tracks the player center; for the last 0.2 s the aim is locked and the bolt fires along it. If knocked off its perch it stays where it lands and keeps shooting. **Data:** `notice {range: 288, rangeY: 160, time: 0.50}`, `preferred: [0, 0]` (it never walks, so the band is unused).
- **War Hound pack:** hounds sharing a `group` get `packIndex` 0, 1, 2 in spawn-id order. Preferred band = `[40 + 24·i, 64 + 24·i]` (the def stores `preferred: [40, 64]`; the runtime adds `24·i`). Group alert is instant (§2.4).
- **Battle Mage — Teleport** (reaction): when `distX ≤ 64`, CD 5.0 s. Same rules as Blink Away (§4) but 176 px away and a 14×28 box. 0.3 s fade-out (hittable), then 0.3 s fade-in (cannot act).
- **Knight armor:** `armor {mult: 0.75, heavyIgnores: true}`: every hit from any side is ×0.75 (step-6 target multiplier, 02 §3.1) unless the hit is heavy.

## 7. Stage 4 — King's Castle

| Enemy | id | Size | Hurtbox | HP | Poise | kbRes | Walk / Chase (Fly) | Notice | Preferred | Gold | Traits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Royal Guard | `royal_guard` | medium | 14×30 | 50 | 30 | 0.3 | 50 / 80 | 176 / 0.45 | 56–80 | 5 | long reach |
| Gargoyle | `gargoyle` | medium | 20×22 | 40 | 20 | 0.2 | (120) | wake 96 | hover | 5 | flyer, stone form |
| Castle Mage | `castle_mage` | medium | 14×28 | 35 | 10 | 0.1 | 45 / 60 | 224 / 0.50 | 144–224 | 5 | support |
| Living Armor | `living_armor` | medium | 16×30 | 45 | 25 | 0.4 | 40 / 70 | 160 / 0.50 | 20–40 | 5 | `revives: 1` |
| **Royal Executioner** (elite) | `royal_executioner` | large | 22×40 | 170 | 80 | 0.7 | 45 / 75 | 176 / 0.50 | 32–56 | 20 | |

| Enemy | Attack | Use when | Tele | Act | Rec | CD | Dmg | Box / shot | Player KB | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Royal Guard | Halberd Thrust | x 40–88 | 0.55 | 0.12 | 0.50 | 1.6 | 13 | `46,−18,72,10` | | |
| | Halberd Sweep | x ≤ 56 | 0.65 | 0.15 | 0.70 | 3.0 | 14 | `24,−16,64,32` | 260, −200 | |
| Gargoyle | Swoop | hovering in place | 0.50 | ≤0.60 | 0.50 | 2.0 | 12 | `0,−11,24,20` | | dives 360 px/s |
| Castle Mage | Ward | ally in 192 px + LOS, unwarded | 0.60 | channel | 0.40 | 8.0 | — | — | | support, no token |
| | Arcane Bolts | x 64–256 | 0.55 | 0 | 0.50 | 2.6 | 10 ×3 | `arcane_bolt` at −10°, 0°, +10° | | aimed |
| Living Armor | Sword Slash | x ≤ 44 | 0.50 | 0.10 | 0.50 | 1.4 | 12 | `22,−16,36,28` | | |
| | Overhead Chop | x ≤ 48 | 0.70 | 0.12 | 0.70 | 3.0 | 15 | `24,−14,32,28` | 260, −200 | |
| Royal Executioner | Overhead Chop | x ≤ 60 | 0.75 | 0.12 | 0.80 | 2.2 | 22 | `32,−20,48,40` | 280, −220 | |
| | Whirling Axe | x ≤ 72 | 0.70 | 1.20 | 0.90 | 5.0 | 10/hit | `0,−20,80,40` | | rehit 0.3, max 3, moves 60 px/s |
| | Leap Chop | x 96–224 | 0.65 | Jump-to-X 0.6 | 0.80 | 4.5 | 22 | `0,−20,64,40` on landing | 300, −220 | |

- **Royal Guard:** backs off if `distX < 40` so it fights at halberd range.
- **Gargoyle — stone form** (`stone: true`): sits on its perch, unaware, **damage ×0.2** (target multiplier), no knockback, no poise damage. **Wakes** when the player center is within 96 px (any direction) with LOS, or when it takes damage. Waking: 0.5 s crack (cannot act, normal damage from now on), then aware and flying. **Hover:** it flies to the point 72 px above the player's feet and 48 px toward its own side, at 120 px/s. When it is within 8 px of that point and Swoop is ready, it starts Swoop. Swoop dives in a straight line toward the player's feet point as it was at Act start, until it reaches that y, touches ground, or 0.6 s pass; then Rec and back to hover. If the player is farther than 320 px for 6.0 s, it flies back to its perch and turns to stone (unaware again).
- **Gargoyle data:** `notice {range: 96, rangeY: 96, time: 0}`, `preferred: [0, 0]` (the hover rule overrides the band). The notice values are used only by the stone-form wake check, which replaces §2.4's timer: it uses the full 96 px on **both** sides (any direction, no half range behind), needs LOS, and wakes on the first tick it can see (`noticeT` stays 0, so no "?" and `noticeTimeMult` has no effect).
- **Castle Mage — Ward:** targets the warded-able ally with the highest current HP (ties: lower id). After Tele, it **channels**: stands still, cannot attack, beam drawn to the ally. The ally takes **damage ×0.5** (target multiplier). The ward ends when 6.0 s pass, the mage is staggered, controlled, frozen or dies, the ally dies, or their centers are more than 256 px apart. The 8.0 s CD starts when the ward ends.
- **Living Armor — revive:** the first time HP reaches 0 it **collapses** (not a kill; no rewards; statuses and hit groups removed). The **pile** (hurtbox 20×10) lasts 2.0 s and is invulnerable to everything **except a dive slam** (descent or impact): that hit is its final death and a normal kill credited to the dive's weapon. After 2.0 s it rises: HP = `round(0.5 × maxHP)`, poise full, 0.5 s rise (hittable, cannot act), then aware and engaged. The second time HP reaches 0 is its final death.
- **Royal Executioner — Whirling Axe:** moves toward the player at 60 px/s for 1.2 s, stopping at walls and ledges. The box can hit the player once every 0.3 s, max 3 hits.

## 8. Enemy projectiles

| id | Used by | Kind | Speed | Box | Range / life | Damage (base) | On impact | Notes |
|---|---|---|---|---|---|---|---|---|
| `enemy_arrow` | Bandit Archer | straight | 300 | 12×4 | 320 px | 9 | vanish | |
| `bomb` | Goblin Miner | arc, T 0.8 | — | 8×8 | — | 13 (blast) | fuse 0.5 s on ground, then blast 56×56 | touching the player in flight = blast at once |
| `brute_wave` | Bandit Brute | floor wave | 240 | 16×12 | 160 px | 14 | stops | jumpable |
| `hex_bolt` | Goblin Shaman | straight, homing r 160, 60°/s | 220 | 10×10 | 320 px | 18 | vanish | |
| `potion` | Swamp Witch | arc, T 0.7 | — | 8×8 | — | 9 (splash) | splash 40×24 + puddle 48×8, 2.5 s | Poisoned +1 |
| `enemy_bolt` | Crossbowman | straight | 420 | 12×4 | 400 px | 12 | vanish | |
| `fireball` | Battle Mage | straight | 260 | 12×12 | 360 px | 12 | vanish | Burning |
| `arcane_bolt` | Castle Mage | straight | 240 | 8×8 | 300 px | 10 | vanish | |
| `shockwave` | bosses | floor wave | per attack | 16×16 | per attack | per attack | stops | jumpable |
| `falling_rock` | Great Boar, Stone Colossus | falling | 420 | 18×18 | — | 15 / 16 | shatters | floor marker |
| `venom_glob` | Spider Queen | arc, T 0.8 | — | 10×10 | — | 15 | puddle 48×8, 2.0 s | Poisoned +1 |
| `dark_wave` | Black Knight | floor wave | 300 | 20×32 | 480 px | 18 | stops | jumpable (peak 56) |
| `royal_orb` | Enemy King | straight, homing r 200, 45°/s | 160 | 12×12 | 3.0 s life | 15 | vanish | |
| `falling_sword` | Enemy King | falling | 600 | 12×32 | — | 18 | stays 0.5 s (no hits), vanishes | floor marker |
| `fire_rain` | Red Dragon | falling | 450 | 16×16 | — | 16 | fire pool 48×8, 3.0 s (Burning) | Burning on hit |

- Blasts and splashes hit the player at most once. All projectiles are blockable and parryable (02 §12) unless their attack is `unblockable`. A parried arc or falling projectile is reflected per 02 like any projectile.

## 9. Bosses — shared rules

### 9.1 Stats

| Boss | id | Stage | Hurtbox | Base HP | Poise | Walk | Attack gap | Break | Gold |
|---|---|---|---|---|---|---|---|---|---|
| Great Boar | `great_boar` | 1 | 64×40 | 900 | 150 | 70 | 1.0 (enraged 0.6) | 2.0 s, ×1.25 | 60 |
| Stone Colossus | `stone_colossus` | 2 | 56×72 | 900 | 160 | 35 | 1.2 (enraged 0.8) | 2.0 s, ×1.25 | 60 |
| Spider Queen | `spider_queen` | 2 | 64×36 | 850 | 150 | 90 | 1.0 (enraged 0.6) | 2.0 s, ×1.25 | 60 |
| Black Knight | `black_knight` | 3 | 22×44 | 1200 | 180 | 70 (P2 84) | 0.9 / 0.6 | 3.0 s, ×1.5 | 80 |
| Enemy King | `enemy_king` | 4 | 24×48 | 1100 | 200 | 80 / 80 / 100 | 0.9 / 0.7 / 0.5 | 3.0 s, ×1.5 | 0 |
| Dragon | `dragon` | 2 or 3 | 72×48 | 1000 | 160 | 110 (fly 140) | 0.8 / 0.6 | 2.5 s, ×1.25 | 150 |

- All bosses: size `boss`, `kbResist 1.0`, always aware, no tokens, `hpBar: 'boss'`. Stage scaling per §2.3 (examples: Black Knight 3120 HP, Enemy King 3960, Dragon 1700 in Stage 2 or 2600 in Stage 3).
- **Break** = 02's stagger with this file's duration: when poise hits 0 the boss drops (kneels, or crashes to the ground if airborne) for the listed time, can't act, and takes the listed **damage multiplier** (step-6 target multiplier). The duration is fixed: heavy hits and Iron Will do not lengthen it. Afterwards 02's 2.0 s poise immunity applies.

### 9.2 Arenas

| Boss | Inner size (w × h px) | Layout | Locks |
|---|---|---|---|
| Great Boar | 576 × 224 | Flat floor, solid walls both sides, ceiling | yes |
| Stone Colossus | 576 × 288 | Flat floor; one-way ledge 64 px wide, 96 px up, against each wall; ceiling | yes |
| Spider Queen | 512 × 320 | Flat floor; one-way platforms 96 px wide, 96 px up, centered at ¼ and ¾ width (x 80–176 and 336–432, on the 16 px grid); ceiling | yes |
| Black Knight | 640 × 256 | Flat floor (castle gate courtyard) | yes |
| Enemy King | 640 × 304 | Flat floor; one-way platforms 96 px wide, 96 px up, at ¼ and ¾; summon points 48 px from each wall | yes |
| Dragon | 640 × 320 | Flat floor; one central one-way platform 128 px wide, 96 px up | **no** |

- 06 writes arenas and door locking; 01 uses the arena as a `whileLocked` camera zone. Boss spawn: 75% of the arena width from the entry side, facing the entry. Exception: the Dragon spawns perched at the side arena's center x, on its floor, facing the opening (§13.3; the side arena has one opening and no `entry` door, 06 §9.4).
- **Platform height:** every one-way platform or ledge in a boss arena is at most **96 px (6 tiles)** above the floor. One-way platforms can't be ledge-grabbed (01 §10.1), so a player on the floor reaches them only with a full jump plus a double jump (96 px) and the 6 px apex assist (01 §2.7, 06 §8.5); 112 px (7 tiles) would be out of reach.
- **Start:** when 06 reports the arena locked (Dragon: when the player center enters its arena), the boss bar appears and the boss plays a **1.0 s intro**. It can be damaged (and broken) during the intro but does not attack.

### 9.3 Phases and enrage
- **Guardians** have one phase. At **≤ 50% HP** they become **enraged** at once (no pause): attack gap and the changes listed in their entry.
- **Black Knight** (2 phases, P2 at ≤ 50%), **Enemy King** (3 phases, P2 at ≤ 66%, P3 at ≤ 33%), **Dragon** (P2 at ≤ 50%).
- **Phase transition:** checked after step 9 of each tick. When HP crosses a threshold, the current attack is cancelled (hit groups removed, CD starts) and a **1.0 s transition** plays: the boss does not act, still takes damage, takes **no poise damage and no control effects**.
- **If the boss is in Break** when it crosses a threshold, the transition waits until the Break ends. **Phase skip:** if HP crossed more than one threshold before the transition starts, it goes straight to the lowest phase reached and plays one transition. Phase-entry events (King's Royal Decree) fire only for the phase actually entered.
- Phase changes never restore HP or poise.

### 9.4 Boss bar data
`bossBar: { name, title, marks }`. `marks` are HP fractions where 07 draws ticks.

| Boss | name | title | marks |
|---|---|---|---|
| Great Boar | Great Boar | Guardian of the Plains | [0.5] |
| Stone Colossus | Stone Colossus | Guardian of the Mountain | [0.5] |
| Spider Queen | Spider Queen | Guardian of the Swamp | [0.66, 0.5, 0.33] |
| Black Knight | The Black Knight | Champion of the King | [0.5] |
| Enemy King | The Enemy King | (name open, GAME_PLAN 15.2) | [0.66, 0.33] |
| Dragon | Red / White / Storm / Green Dragon | Wandering Terror | [0.5] |

### 9.5 Death
On the killing tick: emit `bossDefeated {bossId, stage}` (06 stops the split and opens doors; 05/07 run loot and the stat pick). Hit groups and projectiles of the boss and its summons are removed; summons die with no rewards. The 1.5 s death animation is cosmetic.

### 9.6 Boss loot (what drops; odds and item rules are in 05)

| Boss | Drops |
|---|---|
| Guardian | 1 weapon at key-chest odds + 60 gold. Flask charges to max (02) |
| Black Knight | 1 weapon, B grade or better, + 1 ability + 80 gold. Flask to max |
| Dragon | 1 weapon, A or S, with the Dragon's element + 150 gold. Flask to max |
| Enemy King | Nothing; the run ends (06) |

Items spawn at the boss's feet x, clamped to 32 px inside the arena walls.

## 10. Guardians

Giant versions of a biome mob, with 1–2 new attacks. Default vertical window applies.

### 10.1 Great Boar (giant Wild Boar)

| Attack | Use when | Tele | Act | Rec | CD | Dmg | Box / shot | Player KB | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Charge | x ≥ 96 | 0.75 | until wall (≤2.0) | 0.50 | 3.0 | 20 | `28,−20,40,36` | 360, −260 | 380 px/s (enraged 440) |
| Tusk Toss | x ≤ 72 | 0.55 | 0.15 | 0.60 | 2.5 | 18 | `36,−24,48,48` | 200, −420 | |
| Stomp Quake (new) | any | 0.70 | 0.10 | 0.70 | 5.0 | 18 / 15 | `0,−8,96,16` + 2 `shockwave` | 260, −200 | waves 260 px/s, to the walls |
| Rockfall (new, enraged) | after a wall crash | — | — | — | — | 15 | 3 `falling_rock` | | markers 0.8 s |

- Preferred band 0–72 (walks toward the player at 70 px/s when nothing is eligible). Charge does not turn and ignores ledges (arena is flat).
- **Wall crash:** dazed **2.0 s** (enraged **1.4 s**), `camera.shake(4, 0.3)`. Enraged only: 3 rocks fall at x picked from `enemyAI` (uniform in the arena interior, at least 48 px apart), each with a 0.8 s floor marker before it drops.
- Stomp Quake: the close box and the two waves (one each way, from its feet) come out on the same Act tick.

### 10.2 Stone Colossus (giant Rock Golem)

| Attack | Use when | Tele | Act | Rec | CD | Dmg | Box / shot | Player KB | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Fist Slam | x ≤ 80 | 0.70 | 0.12 | 0.80 | 2.0 | 22 | `44,−16,56,32` | 300, −200 | |
| Shoulder Ram | x 64–200 | 0.70 | 0.40 | 0.90 | 4.0 | 20 | `30,−36,32,64` | 320, −180 | Move 160/0.4 |
| Leap Slam (new) | x ≥ 96 | 0.80 | Jump-to-X 0.9 | 1.00 | 6.0 | 24 / 15 | `0,−12,120,24` + 2 `shockwave` | 300, −260 | waves 240 px/s, 160 px |
| Rock Rain (new) | any | 1.00 | 0.10 | 0.80 | 8.0 | 16 | 5 `falling_rock` (enraged 7) | | markers from Tele start |

- Armor: `guard {guardMult: 0.25, when: 'always', bypassAbove: true}`, **off during Break**. `turnDelay` **1.0 s** (enraged 0.6 s). Preferred band 0–64.
- Leap Slam: **keeps its facing on landing** (does not turn), so a player who dodges behind it gets a free window.
- Rock Rain markers sit at the player's feet x at Tele start and ±64, ±128 (enraged also ±192), clamped 16 px inside the walls. Rocks drop when Tele ends.

### 10.3 Spider Queen (giant Giant Spider)

| Attack | Use when | Tele | Act | Rec | CD | Dmg | Box / shot | Player KB | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Ceiling Drop | any | 0.6 climb + 1.0 marker | fall | 1.20 | 7.0 | 24 | `0,−12,96,24` | 280, −240 | falls 600 px/s |
| Fang Strike | x ≤ 72 | 0.50 | 0.12 | 0.60 | 1.8 | 18 | `40,−14,48,28` | | |
| Pounce | x 80–224 | 0.55 | leap | 0.60 | 3.0 | 18 | `24,−12,48,28` | 260, −200 | Leap `360,−300` |
| Venom Spit (new) | x 64–320 | 0.60 | 0 | 0.60 | 3.5 | 15 ×3 | 3 `venom_glob` | | land at player x −48, 0, +48 |
| Brood (new) | see below | 0.80 | — | 0.40 | 15.0 | — | 2 Spiderlings | | |

- Preferred band 64–160.
- **Ceiling Drop:** climbs straight up her thread to the ceiling in 0.6 s (hittable). A floor marker 96 px wide follows the player's x for 0.7 s, then **locks** for 0.3 s, then she drops at that x. She lands and is open during the 1.2 s Rec.
- **Brood:** forced (ignores weights and the attack gap) the first time HP ≤ 66% and the first time HP ≤ 33%; otherwise eligible when fewer than 2 Spiderlings are alive. Spiderlings appear 32 px to each side of her, with a 0.5 s spawn-in. Max 4 alive.
- **Spiderling** (`spiderling`, summon, Stage-2 scaling): small, hurtbox 12×8, HP 12, poise 0, kbRes 0, chase 120, preferred 0–16. Bite: x ≤ 20, Tele 0.35, Act 0.10, Rec 0.35, CD 1.2, 8 damage, box `10,−5,14,10`, melee token. No rewards.

## 11. The Black Knight (Stage 3)

| Attack | Phase | Use when | Tele | Act | Rec | CD | Dmg | Box / shot | Player KB | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Triple Slash | 1 | x ≤ 64 | 0.55 | 0.10 | 0.80 | 2.5 | 16 | `30,−22,52,40` | | each hit Move 16/0.1 |
| ↳ hit 2 | | | 0.30 | 0.10 | | | 16 | `30,−22,52,40` | | |
| ↳ hit 3 | | | 0.30 | 0.10 | | | 22 | `34,−20,60,44` | 300, −200 | |
| ↳ hit 4 (P2 only) | 2 | | 0.30 | 0.12 | | | 24 | `0,−22,96,44` | 320, −220 | spin, both sides |
| Lunge Thrust | 1, 2 | x 96–320 | 0.60 | 0.30 | 0.70 | 4.0 | 20 | `26,−22,44,14` | 360, −160 | Move 224/0.3 |
| Shield Bash | 1, 2 | x ≤ 40 | 0.45 | 0.10 | 0.50 | 3.0 | 15 | `18,−22,24,40` | 380, −180 | **unblockable** |
| Dark Wave | 2 | x 96–480 | 0.60 | 0 | 0.60 | 3.5 | 18 | `dark_wave` | | from `+20, 0` |
| Leaping Slam | 2 | x ≥ 64 | 0.60 | Jump-to-X 0.7 | 0.90 | 5.0 | 24 / 15 | `0,−14,96,28` + 2 `shockwave` | 300, −240 | waves 260 px/s, 128 px |

- Preferred band 40–64. P2: walk ×1.2 (84 px/s), attack gap 0.6, Triple Slash becomes the 4-hit Quad Slash.
- **Bulwark** (reaction, both phases): when a player direct hit lands on it **frontally** while it is in engage (not attacking, broken or transitioning) and Bulwark is ready (CD 6.0 s in P1, 4.0 s in P2). From the next tick it holds its shield for **1.0 s**: `guard {guardMult: 0.1, when: 'stance'}`, facing **locked** (a player can dash through it to get behind). When the stance ends, if `distX ≤ 48` it starts Shield Bash at once (ignoring Shield Bash's CD, full Tele).
- Shield Bash is unblockable so shield users can't turtle; it can still be dodged with dash i-frames.

## 12. The Enemy King (Stage 4, final boss)

| Attack | Phase | Use when | Tele | Act | Rec | CD | Dmg | Box / shot | Player KB | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Crown Cleave | 1–3 | x ≤ 72 | 0.55 | 0.10 | 0.80 | 2.5 | 18 | `34,−24,60,44` | | |
| ↳ hit 2 | | | 0.30 | 0.12 | | | 22 | `36,−20,68,40` | 300, −200 | |
| Royal Thrust | 1–3 | x 96–288 | 0.60 | 0.30 | 0.70 | 4.0 | 20 | `30,−22,52,14` | 360, −160 | Move 192/0.3 |
| Scepter Orbs | 1–3 | x ≥ 96 | 0.70 | 0 | 0.60 | 5.0 | 15 each | P1: 3 `royal_orb` at −20°, 0°, +20°; P2–3: 5 at −30°…+30° (15° apart) | | aimed |
| Royal Decree | 2, 3 | phase entry | 1.00 | — | 0.40 | — | — | 2 Royal Guards | | summon |
| Shockwave Slam | 2, 3 | x ≥ 64 | 0.70 | Jump-to-X 0.7 | 0.90 | 5.0 | 24 / 16 | `0,−14,96,28` + 2 `shockwave` 16×20 | 300, −240 | waves 280 px/s, to the walls |
| Blade Rain | 3 | any | 1.00 | — | 0.40 | 7.0 | 18 | 6 `falling_sword` | | markers 1.0 s |
| Throne Beam | 3 | any | 0.3 move + 0.90 | 0.35 | 1.00 | 9.0 | 26 | full-width beam | 240, −160 | **unblockable** |

- Preferred band 48–72. Walk 80 / 80 / 100 px/s; attack gap 0.9 / 0.7 / 0.5 s.
- **Royal Decree:** forced on entering P2 and on entering P3 (once each; only for phases actually entered, §9.3). Spawns one Royal Guard (`summon`, Stage-4 scaling, 0.5 s spawn-in, aware, no rewards) at each summon point. Skipped for a point whose guard from an earlier Decree is still alive.
- **Blade Rain:** 6 markers at the player's feet x at Tele start, then +80, −80, +160, −160, +240 from it, clamped 16 px inside the walls (duplicates are allowed). Swords drop when Tele ends.
- **Throne Beam:** fades out (0.3 s, hittable) and reappears 48 px from the wall **farther** from the player, facing the player. Tele 0.9 s shows a thin line at the beam's height. The height is picked 50/50 on `enemyAI`:
  - **Low:** covers `floor − 16` to `floor`. Jump over it.
  - **High:** covers `floor − 44` to `floor − 18`. Slide or crawl under it (12×14 box), or jump over it.
  - The beam spans from the King's front to the far wall. It hits once. Dash i-frames also avoid it.

## 13. The Dragon (special event, Stage 2 or 3)

06 decides if and when the Dragon lands and picks its color (25% each) with the `dragon` RNG stream. The color sets its breath, its special, its immunity (02 §6.7) and its loot element (05).

| Color | id suffix | Breath effect | Special |
|---|---|---|---|
| Red | `red` | 16 per hit + **Burning** | Fire Rain |
| White | `white` | 16 per hit + **Chilled** | Ice Spikes |
| Storm | `storm` | **20**, single hit, Act 0.6 s | Thunder Call |
| Green | `green` | 16 per hit + **Poisoned +1** | Toxic Cloud |

### 13.1 Moves

| Attack | Phase | Use when | Tele | Act | Rec | CD | Dmg | Box / shot | Player KB | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Breath | ground | x 64–320 | 0.80 | 1.00 | 0.80 | 4.0 | see colors | `56,−16,80,32` + `120,−20,80,40` + `184,−24,80,48` | 200, −120 | rehit 0.5, max 2 (Storm: 1 hit) |
| Claw Swipe | ground | x ≤ 96 | 0.50 | 0.12 | 0.60 | 1.8 | 20 | `52,−20,72,40` | 300, −200 | |
| Tail Sweep | ground | player **behind**, x ≤ 112 | 0.55 | 0.12 | 0.60 | 3.0 | 18 | `−60,−12,104,24` | 340, −260 | jumpable |
| Wing Gust | ground | x ≤ 224 | 0.60 | 0.80 | 0.50 | 6.0 | 0 | push zone `100,−40,200,80` | — | Breath weight ×3 next |
| Color Special | both | any | 0.80–0.90 | — | 0.50 | 10.0 | below | below | | |
| Dive Bomb | air | any | 0.5 rise + 1.1 marker | fall | 1.00 | 6.0 | 26 / 16 | `0,−16,128,32` + 2 `shockwave` | 320, −260 | falls 700 px/s; waves 300 px/s, 160 px |
| Strafing Breath | air | any | 0.70 | crossing | 0.50 | 8.0 | 15 (Storm 20) | column 48 wide, feet to floor | | rehit 0.4, max 2 |

- **Ground movement:** preferred band 64–200 at 110 px/s. `turnDelay` 0.6 s. **Wing Hop** (reaction, CD 3.0 s): when the player is behind it and `distX > 120`, it hops 160 px toward the player (Leap `400,−300`, 0.4 s airtime, no hit box), landing facing the player.
- **Wing Gust:** no damage and no hurt. Each tick the player hurtbox overlaps the zone, call 01 `applyImpulse({vx: dir × 5, mode: 'add'})` (600 px/s²) while the player's speed away from the dragon is below 240 px/s. Ignored in `dash`, `forced` and `minecart`.
- **P2 (≤ 50%):** 1.0 s transition (takes off). Then it loops: **air segment 8.0 s** (hovers with feet 104 px above the floor, following the player's x at 140 px/s with a 96 px offset to its own side; uses Dive Bomb, Strafing Breath, Color Special), always ending with a forced Dive Bomb (which lands it); then **ground segment 8.0 s** (ground moves); then a 0.6 s take-off (not an attack); repeat. Breaking it in the air makes it fall at 400 px/s; the Break starts when it lands and the air segment ends.
- **Dive Bomb:** rises off the top of the arena in 0.5 s (not hittable while above the arena top). Its 128 px floor marker follows the player's x for 0.8 s, then locks for 0.3 s; then it drops at that x.
- **Strafing Breath:** flies to the arena side farther from the player at hover height, Tele 0.7 s, then crosses to the other side at 260 px/s, breathing straight down. Breath status per color.

### 13.2 Color Specials

| Special | Tele | What happens | Dmg | Status |
|---|---|---|---|---|
| **Fire Rain** (Red) | 0.90 | 5 `fire_rain` at player x, ±96, ±192 (markers from Tele start). Each leaves a fire pool 48×8 for 3.0 s | 16 per hit | Burning on hit; pools re-apply Burning |
| **Ice Spikes** (White) | 0.80 | 4 spikes erupt in a line in front, starting 64 px ahead, 64 px apart, 0.15 s after each other. Each box 24×48 on the floor, active 0.15 s. Markers from Tele start | 18 | Chilled |
| **Thunder Call** (Storm) | 0.80 | Bolt 1 at the player x locked at Tele start. Bolts 2 and 3 at the player's x 0.4 s and 0.8 s after bolt 1, each with its own 0.6 s marker. Each bolt: 24 px wide, full arena height, active 0.1 s | 20 | — , **unblockable** |
| **Toxic Cloud** (Green) | 0.80 | 3 clouds 64×48 at player x, ±96, drifting toward the player at 30 px/s for 5.0 s | 0 | Poisoned +1 per 0.5 s inside |

### 13.3 Arena and leaving
- The Dragon's arena does not lock (06). It never leaves the arena rectangle. It starts **perched** at the arena center and wakes (1.0 s intro) when the player center enters the arena.
- If the player center is outside the arena for **3.0 s**, it becomes **passive**: lands at the arena center and idles. **Its HP and poise do not reset**, and it resumes (no intro) when the player re-enters. Its projectiles and clouds vanish when it turns passive. The player may skip it entirely.

## 14. Level hazards are not enemies
Kingdom cannons, falling rocks in the Caves, swinging blades and similar traps are level hazards: not targetable, no kill credit, not stage-scaled unless their owner says so. Their numbers belong with the level objects (06; spikes are in 01). Boss falling objects (§8) are boss attacks and are scaled like other boss damage.

## 15. Data shapes

```ts
export type EnemyId =
  | 'wolf' | 'bandit' | 'bandit_archer' | 'wild_boar' | 'bandit_brute'
  | 'bat_swarm' | 'goblin_miner' | 'rock_golem' | 'ram' | 'goblin_shaman'
  | 'bog_zombie' | 'giant_spider' | 'wisp' | 'swamp_witch' | 'treant'
  | 'soldier' | 'crossbowman' | 'war_hound' | 'battle_mage' | 'knight'
  | 'royal_guard' | 'gargoyle' | 'castle_mage' | 'living_armor' | 'royal_executioner'
  | 'spiderling' | 'training_dummy'
  | 'great_boar' | 'stone_colossus' | 'spider_queen' | 'black_knight' | 'enemy_king' | 'dragon';
export type DragonColor = 'red' | 'white' | 'storm' | 'green';
export type SizeClass = 'small' | 'medium' | 'large' | 'boss';
export type Tier = 'regular' | 'elite' | 'boss' | 'summon' | 'dummy';
export type PlayerStatusId = 'burning' | 'poisoned' | 'chilled' | 'rooted';
export interface Box { dx: number; dy: number; w: number; h: number }   // same as 02
export interface EnemyHit {
  box: Box; damage: number;                     // base (Stage 1)
  playerKb?: [number, number]; status?: { id: PlayerStatusId; duration?: number; stacks?: number };
  unblockable?: boolean; rehit?: number; maxHits?: number;
}
export interface EnemyAttackDef {
  id: string; phases?: number[];                 // bosses: phases that may use it (1-based)
  use: { minX: number; maxX: number; minDY?: number; maxDY?: number; behind?: boolean };
  weight?: number; cooldown: number; token: 'melee' | 'ranged' | 'none';
  telegraph: number; active: number; recovery: number;
  hit?: EnemyHit;
  move?: { dist: number; time: number };
  leap?: { vx: number; vy: number } | { jumpToX: number };     // jumpToX = airtime T
  shots?: { projectile: EnemyProjectileId; angles: number[]; aim: 'player' | 'facing' | 'arc' }[];
  chain?: { telegraph: number; active: number; hit: EnemyHit; move?: { dist: number; time: number }; phases?: number[] }[];
}
export interface EnemyDef {
  id: EnemyId; tier: Tier; size: SizeClass; elite: boolean;
  hurtbox: { w: number; h: number };
  hp: number; poiseMax: number; kbResist: number;            // hp is Stage-1 base
  walk: number; chase: number; fly?: number;
  flying?: boolean; ghost?: boolean; dropsLedges?: boolean; waterWalker?: boolean; stationary?: boolean;
  notice: { range: number; rangeY: number; time: number };
  preferred: [number, number]; attackGap: number; turnDelay: number;
  noFacing?: boolean; blocksPlayer?: boolean;                // false for all in v1
  guard?: { guardMult: number; when: 'always' | 'notAttacking' | 'stance'; bypassAbove: boolean };
  armor?: { mult: number; heavyIgnores: boolean };
  revives?: number; gold: number; itemRoll: 'none' | 'elite'; blueprintRoll: boolean;
  hpBar: 'damaged' | 'always' | 'boss';
  attacks: EnemyAttackDef[]; boss?: BossDef;
}
export interface BossDef {
  phaseStarts: number[];                 // HP fractions: [1] | [1, 0.5] | [1, 0.66, 0.33]
  attackGap: number[]; walk: number[];   // per phase (Guardians: [normal, enraged])
  breakDuration: number; breakDamageMult: number; transition: number;
  bar: { name: string; title: string; marks: number[] };
  arena: { w: number; h: number; locks: boolean };
}
export interface EnemyProjectileDef {
  id: EnemyProjectileId; w: number; h: number;
  motion: 'straight' | 'arc' | 'floorWave' | 'falling'; speed?: number; arcTime?: number;
  range?: number; life?: number; homing?: { radius: number; turnRate: number };
  hit: EnemyHit; blast?: { w: number; h: number; fuse: number };
  puddle?: { w: number; h: number; life: number; status: PlayerStatusId };
}
export const STAGE_SCALING = {
  1: { mobHp: 1.0, bossHp: 1.0, dmg: 1.0 }, 2: { mobHp: 1.4, bossHp: 1.7, dmg: 1.3 },
  3: { mobHp: 1.9, bossHp: 2.6, dmg: 1.5 }, 4: { mobHp: 2.4, bossHp: 3.6, dmg: 1.7 } } as const;
// Runtime fields others read: aware, noticeT, hp, maxHp, poise, facing, phase, state, barrierHp, warded.
```

## Test checklist
1. A data test: every regular mob's base HP is in 25–60 (Spiderling and Training Dummy excluded), every elite's is in 120–170, every Guardian's is in 850–900.
2. A data test: every regular mob attack's base damage is in 8–15; every elite's strongest attack is in 18–22; every boss attack that deals damage is in 15–30 (summon attacks excluded).
3. A data test: every attack's first Tele is ≥ 0.35 s and every chained hit's Tele is ≥ 0.25 s.
4. A Soldier spawned in the Enemy Kingdom has 86 max HP (`round(45 × 1.9)`, half up); its Sword Thrust hits an unbuffed player for 17 (`round(11 × 1.5)`, half up).
5. A Bandit's Slash in Stage 2 hits for 13; the same Bandit def in Stage 1 hits for 10.
6. A Dragon in Stage 2 has 1700 HP; in Stage 3 it has 2600. The Black Knight has 3120 and the Enemy King 3960.
7. A Wolf facing right with the player 150 px in front, same height, clear LOS becomes aware after exactly 42 ticks; it cannot start an attack for 30 more ticks (alert reaction).
8. The same Wolf with the player 150 px **behind** it never becomes aware (half range = 88 px); at 80 px behind it does.
9. With `noticeTimeMult = 2`, the Wolf in test 7 needs 84 ticks.
10. A solid tile between a Bandit and the player keeps `noticeT` at 0; a one-way platform in between does not.
11. Hitting an unaware Bandit makes it aware; the hit is resolved with `aware = false`, and a second hit on the same tick sees `aware = true`.
12. When one War Hound becomes aware, the other two in its `group` become aware on the same tick, even 300 px away. An unrelated Bandit 100 px away becomes aware 36 ticks later.
13. With 3 Bandits in range and off cooldown, at most 2 are in Tele or Act at the same time.
14. A Bandit Archer whose center is outside the camera view never starts its Arrow telegraph.
15. A Wild Boar Charge that hits a wall leaves the boar dazed for 1.2 s; a charge that runs 0.90 s on open ground enters its 0.60 s Rec instead.
16. A C-grade matched Greatsword hit (20) on a Rock Golem from the front deals 5; from behind deals 20; a dive slam from above deals full damage.
17. A Goblin Shaman ward in Stage 2 gives a 28 HP barrier (`round(20 × 1.4)`); a 40-damage hit removes the barrier and deals 12 to HP.
18. A Will-o'-Wisp that explodes on its own gives no gold, no flask fill and no Rush. Killed by the player before exploding, it gives 3 gold and 5% flask.
19. A Living Armor (Stage 4, 108 HP = `round(45 × 2.4)`) reduced to 0 HP collapses with no rewards, ignores normal hits for 2.0 s, then rises with 54 HP. A dive slam on the pile kills it for good and counts as a kill.
20. A Gargoyle in stone form takes 4 damage from a 20-damage hit and wakes; afterwards it takes full damage.
21. A Bog Zombie set as submerged is not hittable until the player comes within 72 px; its Rise Swipe hit lands 0.8 s after it wakes.
22. Treant Root Snare roots the player for 1.0 s; its Branch Slam cannot start until at least 1.8 s after the root lands (Rec 0.6 + gap 1.2).
23. Same seed: the same elites carry the same key/ability drop, regardless of kill order. Different seeds can change them.
24. A Guardian kill sets flask charges to max and drops 60 gold; Spiderlings and Royal Decree guards give no rewards.
25. The Black Knight broken at 60% HP takes ×1.5 damage for 3.0 s; if that damage takes it below 50%, its phase transition starts only after the break ends.
26. The Enemy King taken from 70% to 30% HP during one break goes straight to phase 3 when the break ends: one transition, one Royal Decree.
27. The Enemy King's high Throne Beam misses a sliding player and hits a standing one; the low beam misses a player whose feet are 20 px above the floor.
28. The Dragon becomes passive 3.0 s after the player leaves its arena, keeps its HP, and resumes without an intro when the player returns.
29. A Red Dragon takes no Burn damage; a White Dragon cannot be chilled or frozen (02 immunity) and its breath chills the player.
30. A data test: every `EnemyId` except `training_dummy` has a def with at least one attack, and every projectile id referenced by an attack exists in `enemyProjectiles.ts`.
31. A data test: the Gargoyle def has `notice {range: 96, rangeY: 96, time: 0}` and `preferred: [0, 0]`; Bat Swarm and Crossbowman have `preferred: [0, 0]`; War Hound has `[40, 64]`. A stone-form Gargoyle facing right with clear LOS starts its 0.5 s crack on the first tick the player's center is 90 px to its **left** at the same height, also with `noticeTimeMult = 2`; with the player 100 px away it stays stone.
32. In the Spider Queen and Enemy King arenas built per §9.2, a player standing on the floor under a one-way platform lands on it (96 px up) with a full jump plus a double jump at the apex, with no ledge grab and no wall.
33. The Great Boar spawns with its feet x 432 px from the `entry` side of its 576 px arena (75%), facing the entry. The Dragon spawns perched on the side arena floor at its center x (320 px from either side wall), facing the opening.
