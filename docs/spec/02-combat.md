# 02 — Combat

This file owns: health and damage, hit detection, hit-stop, knockback, enemy poise and stagger, player hurt state and i-frames, crits, the five elements, status effects, the heal flask, the Rush meter, all 19 weapons (attack data and S-grade signature moves), the Storm Hammer throw, shield block and parry, the rules for using two weapons, air attacks, and dive slam damage.

Other files own these topics. This file only refers to them:
- **01-movement.md**: `InputState`, dash (including its i-frames and cooldown), jump, dive slam movement and enemy bounce, one-way platform rules, `refundDash()`, camera and screen-shake strength.
- **03-classes-abilities.md**: class tags for weapons, the weapon match rule, bond passives, hybrid perks, and all ability data.
- **04-enemies-bosses.md**: enemy HP, attacks, poise values, `kbResist`, size class, guard and armor, and per-stage scaling.
- **05-loot-economy.md**: grades and odds, element assignment, A-grade perks, S-grade names, Lucky Block effects, curses, stat upgrades, and prices.
- **06-run-levels-save.md**: death and restart flow, arenas, and level objects.
- **07-ui-hud-controls.md**: HUD, damage numbers, and settings.
- **08-art-audio.md**: visuals and sounds.

Where the numbers live in code: sections 2–9, 11 and 12 go in `src/core/tuning.ts`. Sections 10 and 13 go in `src/data/weapons.ts`.

## 1. Terms

| Term | Meaning |
|---|---|
| **Attack instance** | One combo step, one charged attack, one dive slam, one throw or one shield bash. Everything it spawns (projectiles, waves, explosions, rings) belongs to it. |
| **Hit group** | One hitbox, projectile, explosion or persistent effect. A hit group hits each target **at most once**, unless it has `rehit`. |
| **Direct hit** | A hit group touching a target. A direct hit can crit, apply an element, and cause hit-stop, knockback and poise damage. |
| **Secondary damage** | Burn and poison ticks, lightning chain jumps, and fire spread. Secondary damage never crits and applies no element. It causes no hit-stop, knockback or poise damage, gives no Rush, and does not count toward the hit streak. It **can** kill. |
| **Weight** | `light`, `medium` or `heavy`, set per weapon (§10). Weight sets the Rush attack-speed bonus, the move cap while attacking, and the dive slam. |
| **Heavy hit** | A hit with `heavy: true`. These are: every War Maul, Storm Hammer and Giant Axe combo hit, the Storm Hammer throw, the Iron Fists uppercut, the Greatsword cleave, the Flail release, and heavy-weight dive slams. 03 uses this flag (Iron Will, Thunderlord). |
| **Charged attack** | The Katana dash-slash, Flail release, Bow charged shot and Staff orb. 03 uses this flag (Arcane Archer). |
| **Kind** | Every hit group is either `melee` (a box attached to the player) or `shot` (a projectile, explosion, thrown hammer, wave or ring). 03 uses this (Warden, Spellblade). Hit groups with `rehit` also carry `multiHit: true`. |
| **Size class** | Each enemy has `size`: `small`, `medium`, `large` or `boss` (set by 04). Elites carry a separate `elite` flag. |
| **procBase** | A direct hit's damage after steps 1–4 of §3.1, before crit and target multipliers. It is a float. Element effects are computed from it. |
| **Hit streak** | +1 for each attack instance (weapon or ability) whose first direct hit lands on an enemy. It resets to 0 after 2.0 s with no such landing, or when §5.2 step 10 runs (unblocked damage from an enemy hit or a hazard; damage-over-time ticks and blocked hits do not reset it). 03 uses it (Blademaster). |

## 2. Tick order and hit detection

### 2.1 Combat steps inside one tick (120 ticks/s)
1. Build `InputState` (01).
2. **Hit-stop.** Every entity with hit-stop remaining counts it down by 1 tick and skips steps 3–8 for itself this tick. This pauses its timers, physics, AI and statuses. For the exception, see §4.1.
   - Hit-stop freezes only the entity's **own** actions: its movement, timers, statuses and its own attached hit groups (player `melee` boxes, enemy attack boxes), which neither move nor test overlap. Projectiles, waves and other detached hit groups are not frozen by their owner's hit-stop (§9.8, 04).
   - Hit-stop never makes the entity untargetable. In step 7, other entities' hit groups still test against it, and damage, death, new hit-stop (max rule, §4.1), statuses, stagger, control effects and velocity changes apply at once. Their timers, and the movement from those velocities, wait until its hit-stop ends.
   - A player brought to 0 HP during hit-stop dies on that tick (06 §6.1).
3. **Player actions.** Process cancels (dash, jump, shield raise), the flask, weapon inputs and abilities (03). Advance the attack phase timers. Spawn or remove hit groups.
4. **Player movement and collision** (01).
5. **Enemy AI and movement** (04, using the collision from 01).
6. **Moving hit groups** (projectiles, waves, the hammer) move, then test against terrain.
7. **Hit resolution**, in this fixed order:
   - a. Player-owned hit groups against enemies and Lucky Blocks. Process hit groups in creation order, and targets in ascending entity id.
   - b. Enemy-owned hit groups and hazards against the player, in creation order.
8. **Status ticks** (burn and poison) for every entity, in entity id order.
9. **Deaths**: on-kill effects for each enemy that died this tick, in order of death (§3.5).
10. **Rush** passive gain and drain (§8), then **flask** conversion (§7.3).

### 2.2 Boxes
- Every hitbox and hurtbox is an **axis-aligned rectangle**. When this file says "radius r", it means a square box 2r × 2r centered on the point.
- Weapon boxes are written as `dx, dy, w, h`. `dx, dy` is the box **center** offset from the player's feet point (the bottom center of the hurtbox) when facing right. When facing left, use `−dx`. A negative `dy` means up.
- Melee boxes are attached to the player and are recomputed from the player's position on every active tick.
- The player's hurtbox per state is defined in 01. Enemy hurtboxes are defined in 04.

### 2.3 Hit rules
- A hit group tests for overlap on every tick it is active, including its first and last active tick.
- The same hit group hits a given target only once. The exception is a hit group with `rehit: t`, which can hit that target again once at least t seconds have passed since it last hit it. A `maxHits` cap may also apply.
- A melee box hits every target it overlaps. Projectiles stop at the first target unless they have `pierce`.
- Projectiles are tested with a **swept box**: the union of the previous tick's box and the current one. This way a fast shot never skips past a thin target.
- **Terrain:** melee boxes ignore terrain, for both the player and enemies. Projectiles collide with solid tiles but pass through one-way platforms. When a projectile hits terrain, it runs its `onWall` behavior (§9.8).
- **No friendly fire.** Player things never hurt the player, and enemy things never hurt enemies (04 may list exceptions).
- **No contact damage.** Touching an enemy's body never hurts. Only enemy attack hit groups, enemy projectiles and hazards (01) hurt the player.
- If a hit group overlaps a target that is **invulnerable**, the target is **not** marked as hit. The same hit group can still hit it later in that activation, once the invulnerability ends.
- **Lucky Blocks** break from any direct hit by a weapon (melee, projectile or dive). Ability hits do not break them. Breaking one gives no Rush and causes no hit-stop for the player.

### 2.4 Same-tick conflicts
- Player hits (7a) resolve before enemy hits (7b). An enemy that 7a kills, staggers, freezes or puts under a control effect loses its active attack hit groups before 7b. **Ties go to the player.** Any other simultaneous hits both land (a trade).
- If two or more enemy hits reach the player on the same tick, only the first in order applies. The new i-frames (§5.2) block the rest.
- If several player hit groups hit one enemy on the same tick, all of them apply, in order.

## 3. Damage

### 3.1 Player → enemy, in this exact order

| Step | Factor | Value |
|---|---|---|
| 1 | Base | The hit's base damage (§10 and §13 for weapons, 03 for abilities) |
| 2 | × grade | F **0.8**, C **1.0**, B **1.25**, A **1.6**, S **2.0**. Weapon hits only, including the weapon's projectiles, dives and signature effects |
| 3 | × match | **1.25** if the weapon is matched (matching is decided by 03), otherwise 1.0. Weapon hits only |
| 4 | × (1 + Σ attacker bonuses) | An **additive** pool. Each source and its amount is in its owner file: stat upgrades and A-grade perks (05); Rage, Gladiator, Warden, Connection link (03) |
| 5 | × crit | **2.0** if the hit crits (§3.2) |
| 6 | × Π target multipliers | Multiplied together: shatter (§6.3), enemy guard or armor (04), Hunter's Mark (03), boss break windows (04) |
| 7 | Round | Round half up (`Math.floor(x + 0.5)`), with a minimum of 1 |

- procBase is the unrounded value after step 4.
- Ability hits skip steps 2 and 3.
- **Secondary damage** = procBase × the element's % (§6), then × the target multipliers, then rounded half up, with a minimum of 1.
- Enemy HP is an integer. A hit never carries leftover damage over to another enemy.

### 3.2 Crits
- A direct hit crits if any guaranteed-crit rule applies. These rules are:
  - a Twin Daggers backstab (§10.5);
  - Shadow Step (§13);
  - Blademaster, Eagle Eye and Thief (all defined in 03).
- If no guaranteed rule applies and `critChance > 0`, roll `rng() < critChance`. `critChance` starts at 0. Sources are the A-grade perks and stat upgrades in 05. It is capped at 1.0.
- Crit rolls use their own seeded stream, `combat`, derived from the run seed in the same way as the streams in 00-README. Roll only when needed.
- A crit multiplies damage by ×2. Crits never stack. Secondary damage never crits.

### 3.3 Enemy → player
`damage = Math.floor(A × Π incoming multipliers + 0.5)` (round half up, as §3.1 step 7), with a minimum of 1.
- **A** is the attack's damage **at the current stage** as computed by 04. Stage scaling is applied in 04, not here.
- The incoming multipliers are: block **0.25** (§12), Glass Bones (05), and damage-taken stat upgrades (05).
- If a one-hit curse is active (05), damage = current HP.
- Hazards (spikes and so on, from 01) and the player's own damage-over-time effects (§5.4) go through this same formula.

### 3.4 Kill credit
- An enemy's death is a **player kill** when either of these is true:
  - the killing damage came from the player or from something the player owns (weapons, projectiles, abilities, statuses, turrets, signature effects);
  - the player damaged that enemy within the last 5.0 s.
- A player kill feeds the flask, Rush, gold and kill counters. Any other death gives nothing.
- Each kill records the killing source (weapon id or ability id), the element, and the tier (regular, elite or boss).
- Every status effect stores the weapon or ability that applied it, so a damage-over-time kill is credited to that source.

### 3.5 On-kill order (step 9)
1. Flask fill (§7.3)
2. Rush gain (§8)
3. Dash refunds: Wind (§6.6) and refunds from 03 (Blademaster)
4. Fire spread (§6.2) and the Scythe Soul Reap (§13)
5. Gold and loot drops (04 and 05)

Enemies that "get back up" (Living Armor, 04) count only their **final** death.

## 4. Hit reactions on enemies

### 4.1 Hit-stop
- Each hit lists its own hit-stop in §10. As a guide: light hits 0.025 s, medium 0.05 s, heavy 0.075 s, big finishers 0.10 s.
- **Melee direct hit:** the player and the target each get `hitStop = max(remaining, value)`. Hit-stop values never add together.
- **Shot direct hit:** only the target gets hit-stop. The player never freezes for a projectile hit.
- A crit adds +0.025 s, and a killing hit adds +0.025 s. The cap is **0.125 s**.
- Multi-hit groups (`rehit`) and Lucky Blocks freeze only the target. Secondary damage causes no hit-stop.
- When the player is hurt, the player and the attacking enemy (if the attack is melee) each get 0.075 s.
- A dash or jump pressed during the player's hit-stop **ends it at once** if that move is possible, and the move happens on that same tick. Other presses made during hit-stop are buffered. The 0.15 s buffer starts when hit-stop ends.
- The run timer keeps counting during hit-stop. Attack speed does not shorten hit-stop. **The DPS figures in §10 do not include hit-stop.**

### 4.2 Knockback on enemies
- Each hit has a knockback `kb (x, y)` in px/s. The x direction is away from the source:
  - **Melee and explosions:** use `sign(target.cx − source.cx)`. If they are equal, use the player's facing.
  - **Projectiles and waves:** use their travel direction.
- Applied velocity = `(dir·x·(1−kbResist), y·(1−kbResist))`. `kbResist` runs from 0 to 1 and comes from 04.
- Knockback is **ignored** if the target is Frozen or Pinned. It is also ignored if the target is in the startup or active phase of an attack ("committed") and this hit did not stagger it.
- **While knocked back, the enemy has no control.**
  - Horizontal knockback speed decays at 1600 px/s² on the ground and at 400 px/s² in the air.
  - Gravity is the same as in 01. Flying enemies have no gravity, and their vertical knockback decays at 1600 px/s².
  - The AI resumes when |vx| < 20 px/s, the enemy is grounded (or is a flyer), and it is not staggered or under a control effect.
- Walls set vx to 0. Knockback can push enemies off ledges.

### 4.3 Poise and stagger
- `poiseMax` comes from 04. Each direct hit removes its `poise` value from current poise. Wind multiplies this (§6.6). Secondary damage removes nothing.
- When current poise reaches 0 or below, the enemy is **staggered**:
  - Its current action is cancelled, including its telegraph and hit groups. The cancelled attack's cooldown starts as if the attack had been used.
  - It cannot act for **0.5 s**, or **0.8 s** if the breaking hit was heavy. Iron Will (03) doubles the heavy duration.
  - The full knockback applies, ignoring the "committed" rule.
- During a stagger, poise is locked at 0. Further hits deal damage and knockback but do not extend the stagger. When the stagger ends, poise goes back to max.
- If an enemy takes no direct hit for **1.5 s**, its poise refills to max at once.
- **Elites and bosses** get **2.0 s** of poise immunity after each stagger ends. Regular mobs get none.
- An enemy with `poiseMax = 0` is staggered by every direct hit.
- Bosses use this same system. 04 sets their own break durations and damage windows.

### 4.4 Control effects

| Effect | What happens | Regular | Elite | Boss |
|---|---|---|---|---|
| Stun | Cannot act. Stays in place (gravity applies) | Full duration | ×0.5 duration | Immune: takes 30 poise damage instead |
| Knockdown | Same as Stun, but lying down | Full | ×0.5 | Immune: 30 poise damage |
| Pin | Held flush against a wall with no gravity. Cannot act | Full | ×0.5 | Immune |
| Launch | Gets the hit's kb.y. Cannot act until it lands, plus 0.2 s | small or medium only | small or medium only | Immune |
| Pull | Moves toward a point at a given speed and cannot act. Ends when within 4 px of the point or after 0.3 s | small or medium only | small or medium only | Immune |

- Every control effect cancels the enemy's current action, the same way a stagger does.
- A new control effect replaces the current one only if it lasts longer than the time remaining on the current one.
- Large enemies are never Launched or Pulled. They take normal knockback instead.

### 4.5 Enemy guard and armor (hook for 04)
- A hit is **frontal** when the source center is on the side the enemy faces. If |dx| < 4 px, the hit counts as frontal. Enemies with `noFacing` never count as guarded.
- A guarded frontal direct hit is changed as follows:
  - Damage × `guardMult` (from 04).
  - Poise damage × 0.5. Heavy hits deal full poise damage.
  - No knockback, unless the hit is heavy.
  - A player melee hit gets recoil: player `vx = −facing × 120` px/s.
  - Frontal projectiles are destroyed.
- Dive slam hits always bypass guard. Hits from behind are normal.

### 4.6 Feedback events
Every direct hit emits an event `{target, amount, crit, element, heavy, secondary}`. 07 uses it for damage numbers, and 08 uses it for flash and sound.

Screen-shake requests:
- **small**: a heavy hit, an explosion, or the player getting hurt;
- **medium**: a heavy dive impact or War Maul Quake.

01 defines the strength of each level, and the player can turn shake off in 07.

## 5. Player health, hurt state and i-frames

### 5.1 HP
- Base max HP is 100. `maxHP = round((100 + Σ flat) × (1 + Σ %))`. The sources are stat upgrades (05) and Iron Will (03).
- When max HP rises by N, current HP also rises by N. When max HP falls, HP = min(HP, maxHP).
- Exception: when Iron Will turns off, current HP first falls by `ironWillAddedHP` (minimum 1), then is clamped (03 §5.3). Example: 50/100 → bond on → 80/130 → bond off → 50/100.
- HP is an integer and never goes above max. Heals round half up. HP is full at the start of a run.

### 5.2 Hurt pipeline (each enemy direct hit or hazard)
1. If the player is invulnerable, ignore the hit. Sources of invulnerability are: dash and slide i-frames (01), hurt i-frames, parry i-frames, the Katana dash-slash, the Spear lunge, and ability i-frames (03).
   - **Source `hazard`** (spikes in 01 §13.4, level hazards in 06 §10): only hurt i-frames count, including Second Wind's 2.0 s (05). Dash, slide, parry, weapon-move and ability i-frames do **not** protect from hazards (01 §7.2, 03 §8.1).
2. Riposte stance: 03 handles the hit.
3. If a shield parry applies (§12), parry and stop here.
4. If a shield block applies (§12), the block multiplier is used in step 5, and steps 7–10 follow §12 instead.
5. Compute damage (§3.3) and subtract it from HP.
6. If HP ≤ 0: if Second Wind is available, 05 applies it and the pipeline continues at step 7 (Second Wind's 2.0 s invulnerability replaces step 8's i-frames). Otherwise the player dies (06) and the pipeline stops. The death cause passed to 06 is the attacking enemy's id for a direct hit, `'spikes'` for spikes, `'hazard'` for a level hazard, and the status id for a damage-over-time tick.
7. **Hitstun 0.20 s** (skipped under super armor, §5.3):
   - No movement input, attacks, dash or jump. Gravity still applies.
   - The current attack, charge, drink and block are cancelled, and the combo resets to step 1.
   - Knockback: `vx = dir × 180`, `vy = −160`, where `dir` points away from the attacker's center. An attack may override this with `playerKb` (04), and a level hazard with its Player KB (06 §10).
8. **I-frames for 0.80 s**, counted from this tick. During them the sprite alpha toggles every 0.05 s.
9. **Hit-stop** of 0.075 s for the player and the attacker (if the attack is melee).
10. **Rush −75**, hit streak reset to 0, and the Leaky Pockets hook (05) fires.

**Which steps run, by source:**

| Source | Steps that run |
|---|---|
| Enemy direct hit (attack box or projectile) | 1–10 |
| Level hazard (06 §10: cannon ball, falling rock, swinging blade) | 1 (hazard rule), then 5–10. Riposte and the shield ignore hazards, so steps 2–4 never apply |
| Spikes (01 §13.4) | 1 (hazard rule), 5, 6, 8 and 10 only. No hitstun, knockback or hit-stop; 01 applies the pop |
| Damage-over-time tick (§5.4) | 5 and 6 only. Second Wind can save a lethal tick |
| Blocked hit (§12) | 1–6, with the block multiplier in step 5, then §12 in place of steps 7–10. It does not fire Leaky Pockets |

When Second Wind saves the player (step 6), its 2.0 s invulnerability is always granted; after that, only the later steps that the source runs are applied.

### 5.3 Super armor
While super armor is active, step 7 is skipped entirely: no hitstun, no knockback and no cancel. Damage, i-frames, hit-stop and the Rush loss still apply. Sources: Iron Will while attacking, Rage, and Shoulder Charge during its charge (all in 03).

### 5.4 Player status effects (applied by enemy attacks)
04 says which attacks apply which status, and it may override the duration. Damage is given at Stage 1 and is multiplied by the stage's enemy-damage multiplier (00-README).

| Status | Effect | Numbers |
|---|---|---|
| Burning | Damage over time | **3** damage per tick, a tick every 0.5 s, for **2.0 s**. A new application resets the duration. Does not stack |
| Poisoned | Stacking damage over time | **1** damage per stack per tick, every 0.5 s, up to **3** stacks. **4.0 s**, reset by each new stack. All stacks end together |
| Chilled | Sets 01's `MoveModifiers.statusMult` to **0.70** (multiplies the run max after the `speedMult` clamp, 01 §5.2) | **2.0 s**, reset on reapply |
| Rooted | No horizontal movement, jump, dash or drop-through. Attacks, abilities, the flask and turning still work. A rooted player in the air falls straight down | **1.0 s**, not reset while active |

- Damage-over-time ticks ignore i-frames. They run only steps 5 and 6 of §5.2: no hitstun, knockback, hit-stop, Rush loss, hit-streak reset or Leaky Pockets, and they cannot be blocked. They use §3.3, so a curse makes them lethal.
- The first tick comes 0.5 s after the status is applied.
- Drinking the flask (§7.2) removes Burning and Poisoned.
- Status timers pause during the player's hit-stop. All statuses clear at stage start and at death.

## 6. Elements and enemy status effects

### 6.1 Element level
- **B = level 1, A = level 2, S = level 3.** A C- or F-grade weapon that gets an element from 03 (Storm Caller, Arcane Archer) is level 1. 05 and 03 decide which element it is.
- The element applies to **every direct hit** of that weapon: combo steps, projectiles, dives and signature effects. It never applies to secondary damage.
- Storm Caller (03) multiplies the burn, chain and poison percentages by `(1 + bonus)`. It multiplies shatter as `1 + (shatter − 1)(1 + bonus)`. 03 sets the bonus.
- Firestarter (05) adds Burn to every direct hit. 05 sets its level.

### 6.2 Fire: Burn

| | L1 | L2 | L3 |
|---|---|---|---|
| Damage per tick (% of procBase) | 10% | 15% | 20% |
| Duration and tick interval | 3.0 s / 0.5 s | 3.0 s / 0.5 s | 3.0 s / 0.5 s |
| Spread radius on death | 48 px | 48 px | 64 px |

- An enemy can have only one burn. A new burn hit resets the duration to 3.0 s, and the per-tick value becomes the larger of the old and new values. The first tick is 0.5 s after application, which gives 6 ticks in total.
- **Spread:** when a burning enemy dies (from any cause), every living enemy whose center is within the radius gets a fresh full-duration Burn. It has the same per-tick value and the same source weapon. Spread can chain from one enemy to the next.

### 6.3 Ice: Chill, Freeze, Shatter

| | L1 | L2 | L3 |
|---|---|---|---|
| Chill: enemy `timeScale` | 0.75 | 0.65 | 0.55 |
| Frost stacks needed to freeze | 5 | 4 | 3 |
| Shatter multiplier | ×2.0 | ×2.5 | ×3.0 |

- Each ice direct hit Chills the enemy for 2.5 s and adds +1 frost stack. Reapplying resets the duration and keeps the strongest slow.
- `timeScale` scales the enemy's movement speed and every AI timer: telegraphs, attack phases and cooldowns. It multiplies with Time Slow (03).
- Reaching the stack threshold **Freezes** the enemy: **1.5 s** for a regular, **0.75 s** for an elite.
- Bosses never freeze. On bosses, stacks do not build and the chill slow is halved: `1 − (1 − s)/2`.
- Frost stacks clear 3.0 s after the last ice hit.
- **Frozen** means:
  - The enemy cannot act or move, and its current action is cancelled.
  - It takes no knockback. Gravity still applies.
  - The status stores the level of the hit that froze it.
- **Shatter:** the next **direct** hit from any weapon or ability on a Frozen enemy gets the shatter multiplier for the stored level (as a step-6 target multiplier). That hit also removes Frozen.
- After Frozen ends (from its timer or a shatter), the enemy has **3.0 s of freeze immunity**. Stacks do not build during it, but Chill still applies.
- A freeze from an ability (Frost Burst, 03) stores level 1 unless 03 says otherwise.

### 6.4 Lightning: Chain

| | L1 | L2 | L3 |
|---|---|---|---|
| Chain targets | 2 | 2 | 2 |
| Chain damage (% of procBase) | 35% | 50% | 65% |
| Chain range (from the hit target's center) | 80 px | 96 px | 112 px |

- After each lightning direct hit, pick up to 2 **other** living enemies whose centers are within range. Choose the nearest first; on a tie, choose the lower id. Each takes secondary damage right away, within step 7a.
- Chains do not chain again and need no line of sight.

### 6.5 Poison: Stacks

| | L1 | L2 | L3 |
|---|---|---|---|
| Damage per stack per tick (% of procBase) | 3% | 4.5% | 6% |
| Max stacks | 5 | 6 | 8 |

- Each poison direct hit adds 1 stack that stores its own per-tick value (a float). The max is taken from the current hit's level.
- If the enemy is already at max stacks, the new stack replaces the weakest one, but only if the new one is stronger.
- Ticks come every 0.5 s. Tick damage = Σ stack values × target multipliers, rounded half up, with a minimum of 1.
- All stacks expire 4.0 s after the last poison hit.

### 6.6 Wind

| | L1 | L2 | L3 |
|---|---|---|---|
| Knockback multiplier (x and y) | ×1.5 | ×1.8 | ×2.2 |
| Poise damage multiplier | ×1.25 | ×1.5 | ×2.0 |

- When a kill's killing source is a wind weapon, call `refundDash()` (01). This is the "speed element".
- Wind knockback still uses `(1 − kbResist)`, so it never moves bosses.

### 6.7 Immunities

| | Regular | Elite | Boss (Guardians, Black Knight, King, Dragon) |
|---|---|---|---|
| Burn, Poison, Chain | Yes | Yes | Yes |
| Chill | Full | Full | Half strength |
| Freeze | 1.5 s | 0.75 s | Immune |
| Stun, Knockdown, Pin | Full | ×0.5 | Immune (30 poise damage instead) |
| Launch, Pull | small or medium | small or medium | Immune |

Each Dragon is immune to its own element: Red to Burn, White to Chill and Freeze, Storm to chain damage, Green to Poison. 04 may add more immunities.

## 7. Heal flask

### 7.1 Charges
- Max charges start at **2**. Each flask upgrade (05) gives **+1 max and +1 current** charge, up to a max of 4. The shop's instant refill sets charges to max.
- Every run starts with charges at max and the fill bar at 0. Sleeping at the inn does **not** refill the flask.
- The fill bar is stored as an **integer in tenths of a percent** (0–1000), so it never drifts.

### 7.2 Drinking
- **Pressing heal works only if all of these are true:** at least 1 charge, HP below max, no Dry Flask or No Heal (05), and not in hitstun. Otherwise the press is ignored and the core emits `healRefused {reason: 'noCharge' | 'fullHp' | 'blocked' | 'hitstun'}`, naming the first failed check in that order (`blocked` = Dry Flask or No Heal). 07 §4.5 flashes the flask icons and 08 plays `flask_empty`.
- **During an attack:**
  - In startup or active, the press is buffered for 0.15 s.
  - In recovery, while charging, or while blocking, the press cancels that action and starts the drink.
- **Timing:** a drink lasts **0.40 s**. At **0.25 s** (the sip point), these happen together:
  - charges −1;
  - `HP += round(0.40 × maxHP)`, capped at max;
  - Burning and Poisoned are removed.
- **Cancelling:**
  - A dash or jump **before** the sip point cancels the drink, and nothing is used.
  - **After** the sip point, a dash or jump cancels the rest of the drink freely.
  - A hit before the sip point (without super armor) cancels the drink, and nothing is used.
- **While drinking:** the ground move cap is 40% of max run speed, air control is normal, and attack presses are buffered for 0.15 s. Drinking works in the air.

### 7.3 Filling
For each player kill:
`fill += (base + vampire + scythe + bloodthirst) × (bloodrush ? 2 : 1)`

| Source | Amount | Owner |
|---|---|---|
| Regular enemy | **5.0%** (20 kills = 1 charge) | Here |
| Elite enemy | **15.0%** | Here |
| Guardian, Black Knight, Dragon | **Charges set to max.** The fill bar is unchanged | Here |
| Vampire | Per level | 03 |
| Scythe, when it is the killing source (its burn and poison count too) | **+3.0%** | Here |
| Bloodthirst | Per 05 | 05 |
| Bloodrush | ×2 on the total | 05 |

- Other sources, such as the arena clear bonus in 06, call the same function, `addFlaskFill(tenths)`.
- **Conversion:** after any change, run `while (fill >= 1000 && charges < max) { charges++; fill -= 1000; }`. If charges are at max, then `fill = min(fill, 1000)`. A full bar is banked: it turns into a charge the moment a charge is spent.

## 8. Rush meter

### 8.1 Value and levels
- The value is a float from 0 to 300, shown as 3 segments.
- Level 0 is below 100, level 1 is 100–199, level 2 is 200–299, and **level 3 is exactly 300**.
- The meter resets to 0 at each stage start and at death. On entering a village it is set to 0 and frozen there (no gain and no drain).
- Overdrive (05) sets a floor: the value cannot drop below 200 while it is active.

### 8.2 Gain and drain

| Event | Rush |
|---|---|
| An attack instance (weapon or ability) lands its first direct hit on an enemy | **+3** |
| That landing happened during a dash, a Spear lunge, a Katana dash-slash, or a moving ability marked `dashAttack` in 03, or within 0.20 s after a dash ends | **+5** extra |
| Dashing through an enemy (player hurtbox overlaps its hurtbox during a dash) | **+4** per enemy per dash |
| Kill: regular / elite / Guardian, Black Knight or Dragon | **+15 / +40 / +100** |
| Moving with \|vx\| ≥ 60% of base max run speed (01), on the ground or in the air | **+6 per second** |
| Successful parry | **+10** |
| Taking unblocked damage from an enemy attack or hazard (not damage over time) | **−75** |
| Standing still: grounded, \|vx\| < 20 px/s, and no attack or ability started in the last 1.0 s. Applies once this has lasted 0.5 s | **−50 per second** |
| No Rush gain of any kind for 4.0 s | **−15 per second** (stops at the next gain) |

The value is clamped to `[floor, 300]`, where the floor is 0, or 200 under Overdrive.

### 8.3 Effects

| Level | Move speed (`speedPercents`) | Attack speed (light, medium) | Attack speed (heavy) | Gold dropped by enemies |
|---|---|---|---|---|
| 0 | +0.00 | ×1.00 | ×1.00 | ×1.00 |
| 1 | +0.05 | ×1.05 | ×1.15 | ×1.10 |
| 2 | +0.10 | ×1.10 | ×1.30 | ×1.20 |
| 3 | +0.15 | ×1.15 | ×1.45 | ×1.30 |

- Rush pushes +0.05 / +0.10 / +0.15 into 01's `speedPercents` (additive with Swift, Thief and the other sources, then clamped by 01 §5.2; Chilled is separate, 01 `statusMult`). Example: Thief (+0.20) at Rush level 3 gives ×1.35.
- The heavy column is the plan's "speed twist": big weapons speed up the most.
- The gold factor applies only to gold dropped by enemies. 05 budgets for it.
- A change of level takes effect at the start of the next attack step. A step already running keeps its timing.

## 9. Using weapons

### 9.1 Buttons and hold behavior
- Weapon 1 and Weapon 2 each have their own button (07). Every weapon has a `hold` type:
  - `repeat`: holding the button continues the combo, so you attack nonstop.
  - `charge` (Katana, Flail, Bow, Staff): see §9.4.
  - `shield`: see §12.
- **Input buffer:** an attack press that cannot start yet is remembered for 0.15 s.
- Pressing a weapon button whose slot is empty does nothing.

### 9.2 Phases, combo and cancels
- Each step runs startup → active → recovery. Hit groups exist only during the active phase.
- A projectile step has an active phase of 0. Its projectiles spawn on the tick when startup ends.
- **Next step:**
  - A press during any phase of the current step (or holding, for `repeat` weapons) queues the next step. Only one press is queued.
  - The queued step starts on the tick the current recovery ends.
  - If nothing is queued, a press within the **combo window of 0.35 s** after the step ends continues the combo. After that, the combo resets to step 1.
  - After the last step, the combo wraps to step 1.
- **Cancels.**
  - **Dash, jump or raising a shield** cancel an attack in **any** phase, but only if that move is possible right now. For example, a dash on cooldown does not cancel. Shield raise: see §12.
  - **Dive slam** (down + either weapon button in the air, 01 §11) cancels an air attack in **any** phase, like a dash, when 01 allows the dive. A cancel in startup or active means that step does not count.
  - **The other weapon and the flask** cancel only during recovery. Presses during startup or active wait until recovery starts. When the other weapon is pressed, its press is held until then, with no 0.15 s limit.
  - **Abilities**: see 03.
  - **Hurt** (without super armor) cancels the attack (§5.2).
- **After a cancel:**
  - A cancel during **recovery** keeps the combo progress, and the combo window starts at the cancel.
  - A cancel during **startup or active** means the step does not count: the next press repeats the same step.
  - Hit groups are removed at the cancel. Hits that already landed stay. Projectiles already fired keep flying.

### 9.3 Moving and facing while attacking

| Weight | Ground move cap during startup, active and recovery (`moveMult`) |
|---|---|
| Light | 60% of max run speed (0.60) |
| Medium | 40% (0.40) |
| Heavy | 25% (0.25) |

- The cap limits the target speed. 01's ground deceleration brings the player down to it. In the air there is no cap, and air control follows 01.
- **`moveMult` per step** (§14): every combo, charged and throw step uses its weapon's weight value from the table, except these, which use **1**: the Katana dash-slash, the Spear lunge and the Giant Axe spin (they set the player's velocity themselves), and the Hand Cannon's recovery (`recoveryMoveMult: 1`, §10.5).
- **`actionMoveMult` passed to 01 (§5.2):** while grounded, 02 sets it to the running step's `moveMult` (its `recoveryMoveMult` during recovery, if set); while charging (§9.4), to the weapon's weight value; with the shield up (§12), to 0.50; while drinking (§7.2), to 0.40; otherwise 1. While airborne it is always 1. Abilities set their own (03).
- **`gravityMult`** (01 §5.4) is 1 for every weapon step. The Katana dash-slash turns gravity off through its `ForcedMove` (`gravity: false`, 01 §12.3) instead.
- **Facing:** at the start of each step, the player turns to face the held direction, if any. Facing is then locked for that step (01 §12.2), unless the step has `canTurn: true`. Only the Giant Axe spin has it. While charging (§9.4), 02 also reports `canTurn: true`.
- **What attack presses do in other movement states (01):**
  - **Sliding:** an attack press ends the slide.
  - **Ledge pull-up:** presses are buffered until the pull-up ends.
  - **Wall slide:** an attack press detaches the player (now airborne), turns them to face away from the wall, and starts the attack.
  - **Dashing:** presses are held until the dash ends. They are not dropped. Exceptions: the Spear lunge (§10.5), and down + a weapon button while airborne, which is a dive slam that starts at once and cancels the dash (01 §11.1).
- Moving attacks (Katana dash-slash, Spear lunge, Giant Axe spin) set the player's velocity themselves and stop at walls.

### 9.4 Charge weapons (Katana, Flail, Bow, Staff)
- If the button is still held (continuously since the press that started the step) when a step's recovery ends, the weapon enters **Charge** instead of the next step.
- **While charging:**
  - The weapon's attack move cap applies, and facing follows the held direction.
  - The charge is **full** after `chargeTime`, which is scaled by attack speed. The player can keep holding at full.
- **Releasing:**
  - Releasing at full fires the **charged attack**. The combo then resets to step 1.
  - Releasing before full starts the next combo step right away, as if the button had been tapped.
- **Losing a charge:** a dash, jump, dive slam or shield raise, or getting hit without super armor, cancels the charge, and it is lost.

### 9.5 Two weapons
- If both weapon buttons are pressed on the same tick, Weapon 1 is used and Weapon 2's press is dropped.
- **Switching weapons** resets the old weapon's combo to step 1, and the new weapon starts at step 1. If the `keepComboOnSwap` hook is on (Gladiator, 03), 03 defines what carries over.
- Each weapon keeps its own timers. For example, the Storm Hammer's throw recharge keeps running while the other weapon is in use.
- Two copies of the same weapon are allowed and work independently.
- **Picking up a new weapon** (interact, handled by 06 and 07) is accepted only when the player is not attacking. Projectiles from the replaced weapon keep flying. Two exceptions:
  - the thrown Storm Hammer is removed (§11);
  - the Spell Tome's rune ring disappears.
- Butterfingers (05) blocks slot 2.

### 9.6 Air attacks
- Every combo step works in the air with the same data. Gravity and air control follow 01. Attacking adds no hang time; Eagle Eye in 03 is the only exception.
- Exceptions:
  - The Giant Axe spin works only on the ground. In the air, the Axe uses its normal combo.
  - The Spear lunge works after an air dash.
  - The Katana dash-slash turns gravity off for its 0.15 s move.
- Landing in the middle of an attack does not cancel it. The ground move cap applies from the moment of landing.
- **Down + weapon button in the air** is a dive slam (§9.7) instead of a combo step. 01 decides when a dive is allowed.

### 9.7 Dive slam damage (movement and bounce: 01)

| | Light or medium weapon | Heavy weapon |
|---|---|---|
| Descent box, active for the whole descent | `0, +2, 16, 12` | `0, +2, 16, 12` |
| Impact box, active for 0.05 s from landing | `0, −8, 48, 16` | `0, −8, 64, 16` |
| Damage (descent or impact) | 18 | 26 |
| Knockback | (150, −150), away from the player | (200, −180) |
| Poise / hit-stop | 25 / 0.05 s | 40 / 0.075 s, heavy |

- Each enemy can be hit at most once per dive.
- If the descent box hits an enemy, the bounce from 01 happens and there is no impact.
- A dive uses the weapon's grade, match and element. Its kind is `melee`, and it always bypasses guard (§4.5).
- The War Maul and Storm Hammer have special dives (§10.5).

### 9.8 Projectiles (shared rules)
- A projectile spawns at `+12, −18` from the feet, in the facing direction. If that point is inside a solid tile, the projectile runs its `onWall` behavior on the spot.
- Speed is constant unless `gravity` or `homing` is set.
- `range` is the distance traveled. When it reaches its range, the projectile vanishes, or explodes if its type explodes.
- Angles: 0° is horizontal in the facing direction, and a negative angle tilts upward.
- `onWall` is one of `vanish`, `explode`, `stick` (Javelin) or `return` (Storm Hammer).
- Every weapon has infinite ammo. Projectiles are not slowed by the player's hit-stop, and Rush does not change their speed.

### 9.9 Attack speed
- `atkSpeed = rushMult(weight) × (1 + Σ attack-speed bonuses)`. The bonuses come from 05 (A-grade perks, stat upgrades) and 03.
- Each startup, active and recovery phase, and each charge time, lasts `max(1, round(seconds × 120 / atkSpeed))` ticks. A phase of 0 stays 0.
- **Not scaled:** the movement phases (dash-slash move, lunge move, spin duration), projectile speed, hit-stop, and the Storm Hammer recharge.

## 10. Weapon data (all 19)

### 10.1 Reading guide and DPS check

All damage values are **base** values (C grade, unmatched, Rush 0, excluding hit-stop). Class tags are in 03.

In this table:
- the **C matched** column applies ×1.25 and rounds each hit (§3.1);
- the **F unmatched** column shows how many presses it takes to kill a 30 HP enemy (×0.8 per hit).

| Weapon | Weight | Hold | Combo cycle (s) | Base damage / cycle | Base DPS | C matched DPS | F unmatched, 30 HP |
|---|---|---|---|---|---|---|---|
| Greatsword | heavy | repeat | 1.80 | 66 | 36.7 | 46.1 | 3 |
| Katana | medium | charge | 1.125 | 41 | 36.4 | 45.3 | 3 |
| Twin Daggers | light | repeat | 1.175 | 42 | 35.7 | 46.0 | 4 |
| Spear | medium | repeat | 1.30 | 46 | 35.4 | 45.4 | 3 |
| Scythe | medium | repeat | 1.525 | 54 | 35.4 | 44.6 | 3 |
| War Maul | heavy | repeat | 1.675 | 61 | 36.4 | 45.4 | 2 |
| Iron Fists | light | repeat | 1.375 | 49 | 35.6 | 45.8 | 4 |
| Giant Axe | heavy | repeat | 1.60 | 58 | 36.3 | 45.6 | 2 |
| Flail | heavy | charge | 1.10 | 40 | 36.4 | 45.5 | 2 |
| Shield (bash) | medium | shield | ≥0.408 | 12 | ~29 | ~37 | 3 |
| Bow | medium | charge | 0.325 | 12 | 36.9 | 46.2 | 3 |
| Crossbow | heavy | repeat | 0.80 | 29 | 36.3 | 45.0 | 2 |
| Hand Cannon | heavy | repeat | 0.85 | 30 | 35.3 | 44.7 | 2 |
| Javelin | heavy | repeat | 0.70 | 25 | 35.7 | 44.3 | 2 |
| Throwing Knives | light | repeat | 0.40 | 15 (3 × 5) | 37.5 | 45.0 | 3 |
| Storm Hammer | heavy | repeat | 1.30 | 47 | 36.2 | 45.4 | 2 |
| Staff | medium | charge | 0.35 | 13 | 37.1 | 45.7 | 3 |
| Wand | light | repeat | 0.30 | 10 | 33.3 | 43.3 | 4 |
| Spell Tome | medium | repeat | 1.20 (+ ring) | 24 + ring | 36.0 | 45.0 | 4 |

- The Shield is a defensive weapon and is deliberately below the standard 45 DPS.
- Throwing Knives assume all 3 knives hit.
- For the Spell Tome, the ring adds 16 base DPS, or 20 when matched, against a target inside the ring. In the F unmatched column, press 3 (the ring cast) has no direct hit, and its runes (3 per hit, `rehit` 0.25 s) land only 1–2 hits before the next press: 10 + 10 + 3–6 = 23–26, so the 4th press (step 1 again) makes the kill.

### 10.2 Melee steps
Times are in seconds. Knockback is in px/s.

| Weapon | Step | Start | Active | Recov | Dmg | Box `dx,dy,w,h` | KB `x,y` | Poise | Stop | Flags |
|---|---|---|---|---|---|---|---|---|---|---|
| Greatsword | 1 | 0.20 | 0.10 | 0.20 | 16 | 22,−16,40,28 | 120,−40 | 15 | 0.05 | |
| | 2 | 0.20 | 0.10 | 0.20 | 16 | 22,−18,40,32 | 120,−40 | 15 | 0.05 | |
| | 3 cleave | 0.30 | 0.15 | 0.35 | 34 | 24,−18,64,40 | 260,−120 | 40 | 0.10 | heavy |
| Katana | 1, 2 | 0.10 | 0.075 | 0.15 | 12 | 20,−16,32,20 | 80,−20 | 10 | 0.025 | |
| | 3 | 0.125 | 0.10 | 0.25 | 17 | 22,−16,40,24 | 160,−60 | 20 | 0.05 | |
| Twin Daggers | 1, 2, 3 | 0.075 | 0.05 | 0.15 | 10 | 14,−14,24,20 | 40,0 | 6 | 0.025 | |
| | 4 | 0.075 | 0.05 | 0.225 | 12 | 16,−14,28,20 | 140,−40 | 15 | 0.05 | |
| Spear | 1, 2 | 0.125 | 0.075 | 0.20 | 14 | 34,−16,52,10 | 100,−20 | 12 | 0.05 | |
| | 3 | 0.15 | 0.10 | 0.25 | 18 | 38,−16,60,12 | 180,−40 | 20 | 0.05 | |
| Scythe | 1, 2 | 0.15 | 0.10 | 0.20 | 15 | 16,−20,52,40 | 120,−40 | 14 | 0.05 | |
| | 3 | 0.20 | 0.125 | 0.30 | 24 | 0,−20,84,40 | 180,−80 | 25 | 0.075 | hits both sides |
| War Maul | 1 | 0.35 | 0.10 | 0.30 | 25 | 24,−16,40,32 | 200,−80 | 35 | 0.075 | heavy |
| | 2 smash | 0.40 | 0.125 | 0.40 | 36 | 28,−10,56,20 | 300,−200 | 50 | 0.10 | heavy |
| Iron Fists | 1, 2 | 0.075 | 0.05 | 0.15 | 10 | 14,−16,22,16 | 50,0 | 6 | 0.025 | |
| | 3 | 0.075 | 0.05 | 0.175 | 11 | 14,−16,24,18 | 80,−20 | 10 | 0.025 | |
| | 4 uppercut | 0.125 | 0.10 | 0.30 | 18 | 12,−24,20,36 | 40,−380 | 30 | 0.075 | heavy, Launch |
| Giant Axe | 1 | 0.30 | 0.125 | 0.30 | 26 | 22,−16,44,32 | 220,−60 | 35 | 0.075 | heavy |
| | 2 | 0.35 | 0.15 | 0.375 | 32 | 24,−18,52,36 | 280,−120 | 45 | 0.10 | heavy |
| Flail | 1, 2 | 0.20 | 0.10 | 0.25 | 20 | 40,−14,32,24 | 140,−40 | 18 | 0.05 | mid-range |
| Shield | bash | 0.05 | 0.10 | 0.25 | 12 | 14,−14,20,28 | 220,−40 | 25 | 0.05 | see §12 |
| Storm Hammer | 1 | 0.25 | 0.10 | 0.25 | 22 | 22,−16,40,30 | 180,−60 | 30 | 0.075 | heavy |
| | 2 | 0.30 | 0.10 | 0.30 | 25 | 24,−14,48,28 | 240,−100 | 40 | 0.075 | heavy |
| Spell Tome | 1, 2 blast | 0.10 | 0.10 | 0.20 | 12 | 24,−16,36,28 | 90,−20 | 10 | 0.025 | |
| | 3 ring cast | 0.15 | 0 | 0.25 | — | — | — | — | — | spawns Rune Ring (§10.5) |

### 10.3 Ranged steps

| Weapon | Step | Start | Recov | Fires |
|---|---|---|---|---|
| Bow | shot | 0.10 | 0.225 | 1 `arrow` |
| | charged (0.45 s charge) | 0.05 | 0.25 | 1 `arrow_charged` |
| Crossbow | shot | 0.15 | 0.65 | 1 `bolt` |
| Hand Cannon | shot | 0.15 | 0.70 | 1 `cannonball`, plus recoil (§10.5) |
| Javelin | throw | 0.20 | 0.50 | 1 `javelin` |
| Throwing Knives | throw | 0.05 | 0.35 | 3 `knife` at −6°, 0°, +6° |
| Staff | bolt | 0.10 | 0.25 | 1 `staff_bolt` |
| | charged (0.50 s charge) | 0.05 | 0.30 | 1 `orb` |
| Wand | shot | 0.05 | 0.25 | 1 `wand_shot` |

### 10.4 Projectiles
All projectiles are kind `shot`.

| Id | Speed | Range | Box w×h | Gravity | Pierce | onWall | Dmg | KB `x,y` | Poise | Stop | Special |
|---|---|---|---|---|---|---|---|---|---|---|---|
| arrow | 600 | 320 | 12×4 | 0 | 0 | vanish | 12 | 80,−10 | 8 | 0.025 | |
| arrow_charged | 800 | 480 | 16×4 | 0 | all | vanish | 32 | 160,−20 | 25 | 0.05 | charged |
| bolt | 720 | 400 | 14×4 | 0 | 0 | vanish | 29 | 280,−40 | 30 | 0.05 | Pin |
| cannonball | 520 | 360 | 10×10 | 0 | 0 | explode | 30 (blast) | 260,−120 | 35 | 0.075 | explodes on enemy contact; blast 56×56; heavy-weapon shot |
| javelin | 560 | 1.5 s life | 20×4 | 300 | 1 (hits 2) | stick | 25 | 200,−40 | 30 | 0.05 | wall platform |
| knife | 640 | 240 | 8×4 | 0 | 0 | vanish | 5 | 40,0 | 4 | 0.025 | |
| staff_bolt | 480 | 280 | 8×8 | 0 | 0 | vanish | 13 | 60,−10 | 8 | 0.025 | |
| orb | 300 | 320 | 14×14 | 0 | 0 | explode | 40 (blast) | 220,−120 | 40 | 0.075 | charged; explodes on enemy contact; blast 80×80 |
| wand_shot | 420 | 240 | 6×6 | 0 | 0 | vanish | 10 | 40,0 | 5 | 0.025 | homing: radius 96, 180°/s |

- **Explosions:** an explosion hits every enemy in its blast box once. The enemy the projectile touched is hit only by the blast, never twice. The blast's knockback x points away from the blast center.
- **Homing:** each tick, find the nearest living enemy whose center is within the homing radius **and** ahead of the projectile (dot product with its velocity > 0). Rotate the velocity toward it by at most `turnRate × TICK`.

### 10.5 Per-weapon special rules
- **Greatsword.** Step 3 is the cleave; its box covers the front and some of the space overhead. No other special.
- **Katana: dash-slash** (charge weapon, `chargeTime` 0.40 s).
  - Startup is 0.05 s. The player then moves **90 px in 0.15 s** (600 px/s, the 01 §2.4 speed cap; a `ForcedMove`, 01 §12.3) in the facing direction and is **invulnerable** during the move. Gravity is off and the move stops at walls.
  - The hit box is the area swept by the player during the move, 32 px tall and centered on the hurtbox center. Each enemy in it is hit once: **40** damage, KB `60,−100`, poise 40, stop 0.075 s (enemy only), charged.
  - After the move: vy = 0, vx = facing × base max run speed (01), then a 0.25 s recovery.
- **Twin Daggers: backstab.**
  - A Daggers hit is a guaranteed crit when the target faces **away** from the player: the target faces right and `player.cx < target.cx`, or it faces left and `player.cx > target.cx`.
  - Enemies with `noFacing` never count as backstabbed. Bosses can be backstabbed.
- **Spear: lunge.**
  - **Trigger:** pressing the Spear button while dashing (01), or within 0.10 s after a dash ends, does a Lunge instead of a combo step. This also works after an air dash. If the player is airborne with `moveY = +1`, the press is a dive slam (01 §11.1), not a Lunge, and is not held until the dash ends.
  - **Move:** the Lunge ends the dash. The player moves **95 px in 0.16 s** (19 ticks at 600 px/s) in the dash direction and is invulnerable during the move.
  - **Hit:** the hit box is the tip box `34,−16,52,10` plus the body sweep (as for the Katana). It deals **24** damage, KB `200,−60`, poise 30, stop 0.05 s (enemy only).
  - **After:** vx = facing × base max run speed, then a 0.20 s recovery. The combo resets.
- **Scythe.** Kills where the Scythe is the killing source add +3.0% flask fill (§7.3). Step 3 hits both sides of the player.
- **War Maul: dive shockwave.**
  - The War Maul's dive impact replaces the heavy impact. The impact box is `0,−12,128,24`, with **30** damage, KB `200,−200`, poise 50, stop 0.10 s, heavy.
  - Every enemy hit is **Knocked down for 1.0 s** (×0.5 for elites; bosses take 30 poise damage instead).
  - The descent damage stays at 26.
- **Iron Fists: uppercut.**
  - Step 4 Launches small and medium targets.
  - On its first active tick, the player's `vy = −300` px/s, on the ground or in the air. This happens only once per airtime; it resets on touching ground or a wall.
- **Giant Axe: spin.**
  - **Trigger:** pressing the Axe button while all of these are true: on the ground, a direction is held, and |vx| ≥ 50% of base max run speed. This does a Spin instead of a combo step, and the combo resets.
  - **Timing:** startup 0.10 s, a 0.80 s spin (not scaled by attack speed), then recovery 0.20 s.
  - **Movement:** during the spin the player moves at 70% of max run speed in the held direction and can turn (`canTurn: true`, `moveMult: 1`, §9.3).
  - **Hit:** the hit box is `0,−16,64,32`, with `rehit` 0.20 s and at most **4 hits per target**. Each hit deals **10** damage, KB `120,−40`, poise 10, stop 0.025 s (target only). Spin hits are not heavy.
  - Running off a ledge does not stop the spin.
- **Flail: release** (charge weapon, `chargeTime` 0.60 s).
  - Startup 0.05, active 0.10, recovery 0.35. The box is `48,−16,64,32`. It deals **55** damage, poise 60, stop 0.10 s, and is heavy and charged.
  - **Small and medium enemies hit are Pulled** to the point 24 px in front of the player at 480 px/s, then staggered for 0.6 s (a forced stagger that ignores poise).
  - Large enemies and bosses take KB `300,−80` instead.
- **Shield.** See §12.
- **Bow.** A quick tap shot; the charged shot pierces every enemy (§10.4).
- **Crossbow: pin.**
  - After a bolt hit on a living target that is not a boss, check the 24 px just past the target's hurtbox edge in the bolt's direction.
  - If that space contains a solid tile, the target is moved flush against the wall and **Pinned for 1.5 s** (0.75 s for elites).
- **Hand Cannon: recoil.**
  - On firing, the player's `vx = −facing × 300` px/s. If the player is airborne, also `vy = min(vy, −150)`.
  - The recoil is an external impulse that follows 01's momentum rules. The attack move cap does not apply during the Hand Cannon's recovery (`recoveryMoveMult: 1`, §9.3); its startup uses the heavy cap.
  - The player is never hurt by their own explosion.
- **Javelin: wall platform.**
  - A javelin that hits a solid tile while |vx| > |vy| **sticks**. It becomes a **one-way platform** (01's rules), 24×4 px, sticking out of the wall face, with its top edge at the javelin's center y − 2.
  - The platform lasts **6.0 s** and blinks during its last 1.0 s. At most **2** platforms exist at once; a 3rd removes the oldest.
  - A javelin that hits a floor or ceiling, or anything that is not a static solid tile, vanishes.
  - Platforms are removed at stage end.
- **Throwing Knives.** Each knife is its own hit group. A target within about 114 px is hit by all 3 knives.
- **Storm Hammer.** The throw is covered in §11.
  - **Dive:** the standard heavy dive, plus a **lightning bolt** 0.10 s after landing. Its box is `0,−80,32,160`, with **24** damage, KB `0,−100`, poise 30, stop 0.05 s (target only). It is heavy, kind `shot`, and carries the hammer's element.
- **Staff.** The charged orb explodes for 40 in an 80×80 blast (§10.4).
- **Wand.** Shots home in slightly (§10.4). The Wand auto-fires while held.
- **Spell Tome: Rune Ring.**
  - Step 3 spawns **4 runes**, each 10×10, orbiting the player's center `(0, −14)` at a radius of 28 px, spinning at 360°/s, 90° apart, for **2.0 s**.
  - The whole ring is one hit group (kind `shot`, `multiHit`): any rune touching an enemy hits it, with `rehit` 0.25 s. Each hit deals **4** damage, KB `30,−10`, poise 3, and no hit-stop.
  - Only one ring exists at a time; casting again replaces it and resets its timer.
  - The ring stays while the player uses the other weapon. It disappears if the Tome leaves its slot.

## 11. Storm Hammer throw
- **Input:**
  - Hold **Up** (`InputState`, 01) and press the Storm Hammer's weapon button while the hammer is in hand and the throw is ready. This throws it.
  - If Up + the button is pressed while the throw is not ready, the player does a normal combo step instead.
- **Throw step:** startup 0.10 s (cancellable as usual), then the hammer launches from `+12, −18`. The player then has a 0.20 s recovery.
- **Outbound:** the hammer flies horizontally in the facing direction at **520 px/s**. It turns back when 0.30 s have passed (156 px), when it hits a solid tile, or when the player recalls it.
- **Return:**
  - The hammer flies at **600 px/s** toward the player's center `(0, −14)`. It re-aims every tick and passes through all terrain.
  - It is **caught** when its center is within 16 px of the player's center. If it has been returning for 2.0 s, it is caught automatically.
- **Hits:** the outbound flight and the return are two separate hit groups, so each enemy can be hit at most once going out and once coming back.
  - Both groups pierce all enemies and are 16×16.
  - Each hit deals **18** damage, KB `160,−40` in the travel direction, poise 20, stop 0.05 s (target only), and is heavy, kind `shot`.
  - Hits carry the element and also break Lucky Blocks.
- **While the hammer is out:**
  - The Storm Hammer cannot swing.
  - **Any press of its button recalls it**: an outbound hammer starts returning at once. A press during the return does nothing.
  - Down + its button in the air recalls it (or does nothing during the return) and does **not** start a dive: while the hammer is out, its slot is not usable for a dive slam (01 §11.1).
  - Movement, the other weapon and abilities all work as normal.
- **Recharge (plan 4.2):**
  - The timer starts on the launch tick.
  - The throw is ready when the hammer is in hand **and** the time since launch is ≥ **2.0 s** if the player carries at least one Wizard-tagged ability right now (03), or ≥ **5.0 s** otherwise.
  - This is checked every tick, so picking up a Wizard ability in the middle of a recharge shortens it.
  - Swinging has no recharge.
- **Removal:** if the Storm Hammer leaves its slot while out, or the player dies, or the stage ends, the flying hammer is removed and the recharge becomes ready.

## 12. Shield: parry, block, bash
- **Press:** the shield goes up **immediately**, with no startup. The **parry window** is the first **0.20 s**.
- **Release within 0.20 s:** the parry window ends and a **bash** starts at once (§10.2).
- **Held for 0.20 s or longer:** the player **blocks** until release. Lowering the shield then takes a 0.10 s recovery, which can be cancelled.
- **While the shield is up:**
  - The ground move cap is 50%, and facing is locked.
  - A dash or jump cancels the shield.
  - Pressing the other weapon lowers the shield and attacks.
- **Raising the shield cancels the other weapon's attack in any phase**, just as a dash does.
- **Frontal check:**
  - For melee, the attacking hit group's center is on the player's facing side (|dx| < 4 counts as frontal).
  - For a projectile, its vx sign equals −facing.
  - Unblockable attacks (an 04 flag), hazards and damage over time ignore the shield completely.
- **Parry** (a frontal hit during the window):
  - The player takes **0 damage** and no hurt.
  - **Melee attacker:** Stunned for **1.5 s** (0.75 s if elite). A boss takes 50 poise damage instead.
  - **Projectile:** reflected as a player shot. It reverses direction at 1.5× speed with its range reset to 320. It deals **24** base damage, using the Shield's grade, match and element, with KB `120,−20` and poise 20.
  - **Player:** `refundDash()` (01), **0.30 s** of invulnerability, Rush +10, and 0.075 s of hit-stop for the player and a melee attacker.
  - The window stays open, so several hits can be parried.
- **Block** (a frontal hit after the window, while the shield is up):
  - Incoming damage is multiplied by **0.25** (§3.3).
  - The player gets no hitstun and no i-frames. Knockback is `vx = dir × 90`, `vy = 0`.
  - There is no Rush loss, the hit streak is not reset, and Leaky Pockets (05) does not fire (§5.2). Blocked projectiles are destroyed. Hit-stop is 0.05 s for the player and the attacker.
  - A blocked hit still counts as damage, so a one-hit curse still kills.
- The shield works in the air under the same rules.

## 13. S-grade signature moves
- Every S-grade weapon has its signature move. 05 guarantees that S-grade weapons have an element (level 3). 05 also owns the item names (such as "Sunbreaker" and "Skysplitter").
- Signature hits use the normal pipeline: base × S 2.0 × match. They carry the element and belong to the attack instance that spawned them.

| Weapon | Signature | Exact rule |
|---|---|---|
| Greatsword | Ground Wave | The cleave also sends a wave from `+32, 0`. The box is 16×20, sitting on the floor. It travels at 360 px/s for 192 px along the floor and stops at a wall or a ledge edge. It hits each enemy once for **16**, with KB `160,−80` and poise 20 |
| Katana | Phantom Edge | `chargeTime` drops to 0.25 s. 0.30 s after the dash-slash ends, its path detonates. Every enemy inside the path box takes a second hit of **24**, with poise 30 |
| Twin Daggers | Shadow Step | Dashing through an enemy marks it for 1.5 s. The next Daggers hit on a marked enemy is a guaranteed crit |
| Spear | Skewer Wave | The lunge ends by firing a shot from the tip: 32×8, 640 px/s, 160 px range, piercing, **18** damage, poise 15 |
| Scythe | Soul Reap | Each Scythe kill releases a soul (10×10, 300 px/s, homing radius 160, 360°/s, 2.0 s life). It deals **20** damage to the first enemy it touches. With no enemy within 160 px at spawn, it fades |
| War Maul | Quake | Step 2 also sends 2 floor waves, left and right: 16×16, 300 px/s, 128 px. Each deals **16** damage and a Knockdown of 0.6 s |
| Iron Fists | Thunderclap | The uppercut also fires a blast `0,−16,96,48` dealing **16** damage that Launches small and medium enemies (KB `0,−300`) |
| Giant Axe | Cyclone | The spin lasts 1.20 s (up to 6 hits). Small and medium enemies within 64 px are Pulled toward the player at 120 px/s while the spin lasts |
| Flail | Meteor | The release also explodes at the ball (`48,−16`): an 80×80 blast dealing **30** damage, poise 30 |
| Shield | Aegis | The parry window grows to 0.30 s. Each parry also fires a shockwave `32,−20,64,40` dealing **40** damage, poise 60 |
| Bow | Triple Shot | The full charged shot fires 3 arrows at −6°, 0°, +6°. The side arrows deal **16**, the center deals 32. All pierce |
| Crossbow | Impaler | Bolts pierce up to 3 enemies, and each can be Pinned. When a Pin ends, it explodes in a 64×64 blast around the target for **24** |
| Hand Cannon | Big Bore | The blast grows to 96×96 and the recoil to 450 px/s |
| Javelin | Anchor | On its first enemy hit, a javelin also explodes in a 64×64 blast for **20**. Stuck platforms last 12 s, and up to 3 can exist at once |
| Throwing Knives | Fan of Blades | Throws 5 knives at −12°, −6°, 0°, +6°, +12°. Each knife pierces 1 extra enemy |
| Storm Hammer | Tempest | While thrown, out and back, the hammer drops a storm cloud at its position every 0.10 s. Each cloud is 24×24 and lasts 1.0 s, with `rehit` 0.25 s, **5** damage, no hit-stop, and the element |
| Staff | Singularity | While flying, the orb Pulls small and medium enemies within 64 px toward its center at 150 px/s. Its blast grows to 112×112 |
| Wand | Seeker Swarm | Every 5th shot fires 3 shots at −15°, 0°, +15°, with homing radius 160 and 540°/s |
| Spell Tome | Rune Storm | The ring has 6 runes at a radius of 36 px and lasts 3.0 s |

## 14. Data shapes

```ts
export type WeaponId = 'greatsword' | 'katana' | 'twin_daggers' | 'spear' | 'scythe' | 'war_maul'
  | 'iron_fists' | 'giant_axe' | 'flail' | 'shield' | 'bow' | 'crossbow' | 'hand_cannon' | 'javelin'
  | 'throwing_knives' | 'storm_hammer' | 'staff' | 'wand' | 'spell_tome';
export type Grade = 'F' | 'C' | 'B' | 'A' | 'S';
export type ElementId = 'fire' | 'ice' | 'lightning' | 'poison' | 'wind';
export type Weight = 'light' | 'medium' | 'heavy';
export type ControlType = 'stun' | 'knockdown' | 'pin' | 'launch' | 'pull';
export interface Box { dx: number; dy: number; w: number; h: number }      // center offset from feet, facing right
export interface HitSpec {
  damage: number; kb: [number, number]; poise: number; hitStop: number;    // base values; seconds
  kind: 'melee' | 'shot'; heavy?: boolean; charged?: boolean;
  rehit?: number; maxHits?: number; multiHit?: boolean; control?: { type: ControlType; duration: number };
}
export interface AttackStep {
  id: string; startup: number; active: number; recovery: number;
  moveMult: number;           // 01 §5.2 actionMoveMult on the ground (§9.3): light 0.60, medium 0.40, heavy 0.25;
                              // 1 for the Katana dash-slash, Spear lunge and Giant Axe spin
  recoveryMoveMult?: number;  // replaces moveMult during recovery (Hand Cannon: 1)
  gravityMult?: number;       // 01 §5.4; default 1 (no weapon step changes it)
  canTurn?: boolean;          // 01 §12.2; default false (true: Giant Axe spin)
  box?: Box; hit?: HitSpec; projectiles?: { id: ProjectileId; angle: number }[];
}
export interface WeaponDef {
  id: WeaponId; weight: Weight; hold: 'repeat' | 'charge' | 'shield';
  combo: AttackStep[]; chargeTime?: number; chargedStep?: AttackStep;
  dive: 'standard' | 'war_maul' | 'storm_hammer'; signature: string;
}
export interface ProjectileDef {
  id: ProjectileId; speed: number; range: number; lifetime?: number; w: number; h: number;
  gravity: number; pierce: number; onWall: 'vanish' | 'explode' | 'stick' | 'return';
  explodeOnEnemy?: boolean; blast?: { w: number; h: number }; hit: HitSpec;
  homing?: { radius: number; turnRate: number };
}
export interface WeaponInstance { weaponId: WeaponId; grade: Grade; element: ElementId | null; perk: string | null }
export interface FlaskState { charges: number; maxCharges: number; fillTenths: number }
export type HealRefusedReason = 'noCharge' | 'fullHp' | 'blocked' | 'hitstun';  // event healRefused {reason} (§7.2)
export interface RushState { value: number; stillTime: number; noGainTime: number; floor: number }
// Fields this file reads from enemy data (04): hp, poiseMax, kbResist, size, elite, noFacing?, guard?
```

## Test checklist
1. A C-grade matched Greatsword deals 20, 20, 43 per combo. One cycle is 216 ticks (1.80 s) for 83 damage, excluding hit-stop.
2. An F-grade unmatched Twin Daggers kills a 30 HP enemy (no armor) in exactly 4 hits (8 + 8 + 8 + 10).
3. Every weapon except the Shield has a C-grade matched DPS from §10.1 between 43 and 47. A test computes this from `weapons.ts`.
4. For every weapon at F grade unmatched, the first 4 presses of its combo deal at least 30 total to one target. This matches the §10.1 column.
5. Base 20, C grade, matched, +0.30 bonus pool, crit, target multiplier 1.3 deals `round(84.5) = 85`.
6. Base 12 at F grade deals 10 (9.6 rounded half up). Damage is never below 1.
7. A player hit for 12 goes from 100 to 88 HP. A second enemy hit at +0.79 s is ignored, and one at +0.81 s applies.
8. When hurt, the player cannot start a dash until 0.20 s of hitstun has passed. Under super armor, the current attack keeps going.
9. Pressing dash on any startup tick of Greatsword step 3 cancels it with no hit. The next attack press starts step 3 again.
10. A Greatsword cleave hit freezes the player and the target for 12 ticks, or 15 ticks if it crits. The run timer still advances 12 ticks.
11. Two enemy attacks overlapping the player on the same tick deal damage only once.
12. An enemy killed by a player hit in step 7a deals no damage from its own hitbox active on that tick.
13. 20 regular kills starting at 1 of 2 charges and 0 fill end at 2 charges and 0 fill. An elite kill adds 150 tenths. A Guardian kill sets charges to max.
14. At max charges, the fill caps at 1000. Drinking then leaves charges at max and fill at 0.
15. A drink at 60/100 HP heals to 100 at tick 30 (0.25 s). A dash at 0.20 s cancels the drink and keeps the charge.
16. Pressing heal at full HP does nothing, uses no charge, and emits `healRefused {reason: 'fullHp'}`. At 0 charges and full HP the reason is `'noCharge'`.
17. Rush: the kill bonuses of 7 regular kills (+105) alone take the meter from 0 to level 1. Taking a hit at 150 drops it to 75 (level 0). Under Overdrive it never goes below 200.
18. At Rush level 3, a Greatsword combo cycle takes 150 ticks: phases are rounded per phase at ×1.45.
19. Standing still on the ground with no attacks drains Rush at 50/s, starting 0.5 s after stopping.
20. A Burn L1 hit with procBase 20 deals 6 ticks of 2 over 3.0 s (12 total). A burning enemy that dies ignites an enemy 40 px away.
21. Ice L1: the 5th ice hit freezes a regular enemy for 1.5 s. The next hit deals ×2.0, and further ice hits cannot freeze it for 3.0 s. A boss never freezes.
22. Lightning L1, procBase 20: the 2 nearest enemies within 80 px each take 7. A third enemy within range takes nothing.
23. Poison L1: 5 hits with procBase 20 give 5 stacks, and each tick deals 3.
24. A kill made with a wind weapon calls `refundDash()`. A kill made with a fire weapon does not.
25. Storm Hammer without a Wizard ability: after throwing and catching it at 0.8 s, Up + the button swings instead of throwing until 5.0 s after launch. With a Wizard ability, it throws again at 2.0 s.
26. A thrown Storm Hammer hits a stationary enemy in its path exactly twice (once out, once back). Pressing its button while outbound starts the return at once.
27. A shield press, then a melee hit at 0.10 s: 0 damage, the attacker is stunned for 1.5 s, and the dash is refunded. A 20-damage hit at 0.50 s while holding deals 5.
28. Spear pressed during a dash moves the player 95 px in 19 ticks with no damage taken from any enemy hit during the move.
29. Hand Cannon fired in the air while facing right sets vx = −300 and vy ≤ −150.
30. A javelin that hits a wall makes a standable one-way platform that disappears after 6.0 s. A 3rd stuck javelin removes the oldest platform.
31. A Katana dash-slash on open ground moves the player exactly 90 px in 18 ticks (600 px/s) with gravity off.
32. Down + a weapon button during the startup of an air attack starts a dive slam on that tick, and the cancelled step does not count. Down + the Spear button during an air dash starts a dive slam, not a Lunge.
33. Thief (+0.20) at Rush level 3 (+0.15) gives a run target of 170 × 1.35 = 229.5 px/s. Swift (+0.25) with Chilled gives 170 × 1.25 × 0.70 = 148.75 px/s.
34. Spikes touched during a dash or during parry i-frames deal 20 damage, start the 0.80 s hurt i-frames and take 75 Rush, with no hitstun, knockback or hit-stop.
35. At 2/100 HP with Burning and Second Wind, the next burn tick (3) sets HP to 50 instead of killing. A blocked hit does not fire Leaky Pockets.
36. An enemy projectile that reaches the player during the player's own melee hit-stop deals its damage on that tick. A frozen melee box does not test overlap.
37. Iron Will on at 50/100 gives 80/130. Turning it off gives 50/100, not 80/100.
