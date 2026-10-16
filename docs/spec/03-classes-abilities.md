# 03 — Classes, Connection Bonuses, Hybrids, Abilities

This file defines classes, which class every weapon and ability belongs to, the starting kits, how your two abilities decide your class, the 4 Connection bonuses, the 6 hybrids, the weapon match rule, and all 17 abilities with Lv1–Lv5 numbers. Read `00-README.md` first (units, 120 ticks/s, architecture).

**This file owns:** class tags for every weapon and ability; starting kits; class state and the HUD class name; the Connection bonus (4 bond passives) and the 3-second link; the 6 hybrid perks; the weapon match rule; all 17 abilities (Lv1–Lv5 numbers, hitboxes, behavior); ability usage rules (buffer, cooldowns, charges, air use, cancels, pickup, swapping, dropping, Lv1 on pickup).

**Not here (only referenced):** damage formula, crits, hit-stop rules, knockback rules, poise and stagger, control effects (Stun, Launch, Pull), Frozen and Chill, super armor, i-frame handling, the hit streak, kill credit, flask filling, Rush meter, Storm Hammer throw recharge: `02-combat.md`. `ForcedMove`, `teleport()`, `refundDash()`, `MoveModifiers`, grapple point arrival, collision: `01-movement.md`. Enemy size, `elite`, `aware`, notice time, `unblockable`: `04-enemies-bosses.md`. Ability drop odds, class lean, shop stock, upgrade and sell prices, stat upgrades, key chests: `05-loot-economy.md`. Cracked wall objects, stage start, restart, discovered-classes save: `06-run-levels-save.md`. HUD layout, swap popup drawing, link glow: `07-ui-hud-controls.md`. Outfit trim colors, VFX, SFX: `08-art-audio.md`.

**Code:** data tables in `src/data/classes.ts` (tags, kits, bond and hybrid numbers) and `src/data/abilities.ts` (ability defs and level rows). Logic in `src/core/classes/classState.ts` (pure `computeClassState`), `src/core/classes/bonds.ts`, `src/core/classes/hybrids.ts`, `src/core/abilities/abilitySystem.ts` (slots, buffer, cooldowns, link, pickup) and one file per ability in `src/core/abilities/`.

---

## 1. Terms and conventions

| Term | Meaning |
|---|---|
| **Player tick** | A tick in which the player is not in hit-stop (02 §4.1). Ability cooldowns, the press buffer, the link window, and every effect attached to the player (stances, Rage, Time Slow's duration, Blade Flurry) count player ticks. |
| **World tick** | Every simulation tick. Independent ability entities (Turret, boulder, Arrow Rain zone, Thunder Strike bolts, marks) count world ticks. |
| **Attack instance, hit group, direct hit, kind (`melee`/`shot`), heavy hit, charged attack, hit streak, size class** | As defined in 02 §1. |
| **Lands** | An attack instance "lands" on the tick its first direct hit touches an enemy (not a Lucky Block or object). |
| **Body center** | `(x, y − h/2)` of the player box (01 §2.2): `(x, y − 14)` when standing. |
| **Boxes** | 02 §2.2 notation: `dx, dy, w, h` = box center offset from the player's feet, facing right; mirror `dx` when facing left. "Radius r" = a square 2r × 2r. |
| **f** | Facing: +1 right, −1 left. |
| **LOS** | Line of sight: the straight segment between two points crosses no solid tile and no active non-one-way solid body. |

Seconds convert to ticks with `Math.round(s × 120)`. Where a table lists ticks, use the ticks.

## 2. Class tags

```ts
type ClassId = 'swordsman' | 'tank' | 'archer' | 'wizard';
```

### 2.1 Weapons (ids from 02 §14)

| Class | Weapons |
|---|---|
| Swordsman | `greatsword`, `katana`, `twin_daggers`, `spear`, `scythe` |
| Tank | `war_maul`, `iron_fists`, `giant_axe`, `flail`, `shield`, `storm_hammer` |
| Archer | `bow`, `crossbow`, `hand_cannon`, `javelin`, `throwing_knives` |
| Wizard | `storm_hammer`, `staff`, `wand`, `spell_tome` |

`storm_hammer` has **two** tags: `['tank', 'wizard']`. Every other weapon has exactly one. Every weapon has at least one tag (no neutral weapons).

### 2.2 Abilities

| Class | Abilities (id, kind) |
|---|---|
| Swordsman | `blade_dash` (move), `whirlwind` (move), `blade_flurry` (instant), `riposte` (cast) |
| Tank | `shockwave` (cast), `shoulder_charge` (move), `rage` (instant), `boulder_toss` (cast) |
| Archer | `arrow_rain` (cast), `turret` (cast), `grapple_arrow` (move), `hunters_mark` (instant) |
| Wizard | `thunder_strike` (cast), `frost_burst` (cast), `blink` (move), `time_slow` (instant) |
| Neutral (`cls: null`) | `vampire` (passive) |

Kinds are defined in §7.3.

## 3. Starting kits

| Class | Starting ability | Starting weapon (pick 1) |
|---|---|---|
| Swordsman | `blade_dash` | `greatsword` or `katana` |
| Tank | `shockwave` | `war_maul` or `iron_fists` |
| Archer | `arrow_rain` | `bow` or `crossbow` |
| Wizard | `thunder_strike` | `storm_hammer` or `staff` |

- The kit is: ability slot 1 = the starting ability at **Lv1**, full charges. Ability slot 2 empty. Weapon slot 1 = the picked weapon at **C grade**, no element, no perk. Weapon slot 2 empty.
- The starting weapon always matches (§4.3), so it gets +25% from the start.
- Instant restart (06) reuses the last `(class, weapon)` pick.

## 4. Class state

### 4.1 `computeClassState(slots)`

A pure function of the two ability slots. Let `A` = the list of class tags of the carried abilities, ignoring empty slots and neutral abilities (`vampire`).

| `A` | `displayClass` | `bond` | `hybrid` | `connection` |
|---|---|---|---|---|
| empty (no abilities, or only Vampire) | `null` | `null` | `null` | false |
| one class `c` (one class ability; the other slot empty or Vampire) | `c` | `null` | `null` | false |
| `[c, c]` (two abilities of the same class) | `c` | bond of `c` | `null` | **true** |
| `[c1, c2]`, `c1 ≠ c2` | `null` | `null` | hybrid of `{c1, c2}` | false |

| Pair | Hybrid id | Name |
|---|---|---|
| swordsman + archer | `thief` | Thief |
| swordsman + tank | `gladiator` | Gladiator |
| swordsman + wizard | `spellblade` | Spellblade |
| tank + archer | `warden` | Warden |
| tank + wizard | `thunderlord` | Thunderlord |
| archer + wizard | `arcane_archer` | Arcane Archer |

| Class | Bond id | Bond name |
|---|---|---|
| swordsman | `blademaster` | Blademaster |
| tank | `iron_will` | Iron Will |
| archer | `eagle_eye` | Eagle Eye |
| wizard | `storm_caller` | Storm Caller |

`carriedClasses` = the distinct members of `A` (05 uses it for the class lean of drops; 02 uses `carriedClasses.includes('wizard')` for the Storm Hammer throw recharge).

### 4.2 HUD class name (`displayName`)

- No class: **"No Class"**.
- One class or same-class pair: the class name: **"Swordsman"**, **"Tank"**, **"Archer"**, **"Wizard"**. When `connection` is true, `bondName` (e.g. "Storm Caller") is also set; 07 shows it under the class name with the link icon.
- Hybrid: the hybrid name (e.g. **"Thief"**, **"Arcane Archer"**).
- 08 picks the outfit trim color from `displayClass` / `hybrid`.

The swap popup (07) calls `computeClassState` on the slots **as they would be after the swap**, and shows any change of `displayName`, bond or hybrid.

### 4.3 Weapon match

- A weapon slot is **matched** if any tag of its weapon is in `carriedClasses`. Neutral abilities add nothing.
- Matched → 02 §3.1 step 3 applies ×1.25. Not matched → it still works normally, ×1.0.
- `weaponMatched: [boolean, boolean]` is part of the class state; 07 lights the weapon's class icon when true. An empty weapon slot is `false`.
- Examples: `bow` + `arrow_rain` → matched. `bow` + `thunder_strike` → not matched. `bow` + `arrow_rain` + `thunder_strike` → Arcane Archer, matched. `storm_hammer` is matched with any Tank **or** Wizard ability. With `vampire` alone, nothing is matched.

### 4.4 When the class state changes

- Recompute immediately after any change to an ability slot (pickup, swap, sell, death/restart) or a weapon slot. Every rule in this file reads the current class state at the moment it is needed.
- Effects turn on and off at once. Exceptions are listed per bond and hybrid (Iron Will HP, §5.3).
- Values another system already read this tick (e.g. `MoveModifiers` at 01 §3 step 4) use the new state from the next tick.
- Emit `classChanged` when `displayName`, `bond` or `hybrid` changes.
- Emit `classDiscovered(id)` the first time in the save file that a bond or hybrid becomes active. 06 stores the set (it fills the "classes discovered" page).

## 5. Connection bonus (same class)

Active while `connection` is true. It gives (a) that class's bond passive and (b) the link.

### 5.1 The link (3-second rule)

- State: `link: { fromSlot: 0 | 1, openedTick: number } | null` (player ticks).
- When an ability **activates** (§7.4: the tick its effect starts) and that activation is **not linked**, set `link = { fromSlot: thisSlot, openedTick: now }`. This replaces any open link. Using the same ability again (e.g. a second charge) re-opens the window from the same slot.
- When the ability in the **other** slot activates while `connection` is true, `link.fromSlot ≠ thisSlot`, and `now − openedTick ≤ 360` (3.0 s, inclusive): this activation is **linked**. Then `link = null`. A linked activation never opens a new window, so links do not chain.
- Both slots activating on the same tick: slot 1 is processed first, so slot 2 is linked (gap 0).
- The link clears (`null`) when `connection` becomes false, at stage start and at death.
- **What "50% stronger" means:** every ability says exactly what a linked activation changes (the **Linked** line of §8–§11). Damage is always **+0.50 in 02's additive attacker-bonus pool** (02 §3.1 step 4) for every hit of that activation and of everything it spawns. Non-damage values (durations, distances, bonuses) are **×1.5**, rounded to whole px or whole ticks.
- Emit `abilityLinked(slot)`. 07 makes the other slot's icon glow while a link window is open (`linkTicksLeft = 360 − (now − openedTick)`).

### 5.2 Blademaster (Swordsman)

1. **3rd hit crits:** when an attack instance (weapon or ability) lands and that landing makes 02's **hit streak** equal to 3, 6, 9, … (a multiple of 3), every direct hit of that attack instance is a guaranteed crit (02 §3.2). The streak itself (what counts, 2.0 s timeout, reset on damage) is 02's.
2. **Kills reset your dash:** every player kill (02 §3.4) calls `refundDash()` (01 §7.4) in on-kill step 3 (02 §3.5). Several kills on one tick = one call.

### 5.3 Iron Will (Tank)

1. **+30% max HP:** adds **+0.30** to the % term of 02 §5.1's `maxHP` formula (base 100 → 130).
   - Turning on: current HP rises by the max HP gained (02 §5.1). Store that amount as `ironWillAddedHP`.
   - **Turning off (exception to 02 §5.1):** current HP falls by `ironWillAddedHP`, to a minimum of 1, then is clamped to the new max. This stops "swap a Tank ability in and out" from healing. Example: 50/100 → bond on → 80/130 → bond off → 50/100.
2. **No knockback while attacking:** super armor (02 §5.3) while "attacking" = a weapon attack is in startup, active or recovery, or a weapon is charging (02 §9.4), or an ability cast (§7.6) is in startup, stance or recovery, or an ability `ForcedMove` is running. Shield block/raise and drinking do not count.
3. **Heavy hits stagger twice as long:** the heavy stagger (0.8 s in 02 §4.3) becomes **1.6 s**. 02 applies it; this file only sets `heavyStaggerMult = 2.0`.

### 5.4 Eagle Eye (Archer)

1. **Long-range hits always crit:** a direct hit is a guaranteed crit when it comes from:
   - a weapon projectile, explosion or thrown hammer (any kind `shot` weapon hit group that is a projectile or comes from one) that has **traveled ≥ 128 px** (02 tracks traveled distance for `range`; a returning Storm Hammer counts its full path);
   - a Turret bolt (§10.2) that has traveled ≥ 128 px;
   - a Grapple Arrow hit (§10.3) on an enemy whose center is ≥ 128 px from the player's body center at activation.
   Not: Arrow Rain, Thunder Strike, melee boxes, or anything else.
2. **Slow fall while aiming:** while airborne (`air` state) and **aiming**, set `MoveModifiers.maxFallOverride = 60` px/s (01 §5.4 brings `vy` down to it at 2400 px/s²). Aiming = a weapon step that fires projectiles is in startup, or a charge weapon whose charged step fires projectiles (Bow, Staff) is charging, or the Storm Hammer throw is in startup.
   - **Budget: 1.0 s (120 player ticks) per airtime.** It drains only on ticks where the override is set and `vy ≥ 0`. It refills on landing (01 §5.5). With the budget at 0, no override.

### 5.5 Storm Caller (Wizard)

1. **Abilities recharge 25% faster:** +0.25 to `rechargeRate` (§7.7). Example: an 8 s cooldown takes 6.4 s (768 ticks).
2. **Elements are stronger:** the `bonus` in 02 §6.1 is **0.25** (burn, chain and poison % ×1.25; shatter `1 + (s − 1) × 1.25`, e.g. ×2.0 → ×2.25).
3. **C-grade weapons get an element:** a C-grade weapon with no element gets **Lightning, level 1** (02 §6.1) while Storm Caller is active. F-grade weapons do not. It turns off with the bond.

## 6. Hybrids (different classes)

A hybrid perk is active while `hybrid` equals its id. Primes and timers below clear at stage start, at death, and when the hybrid ends.

### 6.1 Thief (Swordsman + Archer)

1. **Silent Steps — speed:** push **+0.20** into `MoveModifiers.speedPercents` (01 §5.2).
2. **Silent Steps — stealth:** set 04 §2.4's player-side `noticeTimeMult = 2.0` (enemies take twice as long to notice you) and leave `noticeRangeMult = 1.0`. Both are 1.0 when Thief is not active.
3. **Silent Steps — sneak crit:** any direct hit (weapon or ability) on an enemy whose `aware` flag (04) is false is a guaranteed crit (02 §3.2). 04 makes any damaged enemy aware, so in practice this is the first hit. Several unaware enemies hit by one attack instance all crit. Bosses are always aware.
4. **Lockpick:** `lockpickUsedThisStage` (reset to false at every stage start). When the player interacts with a **locked key chest** (05) while Thief is active and `lockpickUsedThisStage` is false, the chest opens without a key and the flag becomes true. The Lockpick is used **before** keys. It works only on key chests, not cursed chests or timed doors. Becoming Thief again later in the same stage does not give a second use. Emit `lockpickUsed`.

### 6.2 Gladiator (Swordsman + Tank)

Turns on 02 §9.5's `keepComboOnSwap` hook.

1. **Combo carries over:** when the player starts a step with weapon slot B while weapon slot A's combo is live (A's step is still running, or A's step ended less than 0.35 s ago, the combo window of 02 §9.2), and A's last step **counted** (finished, or cancelled in recovery): B starts at step `(sA mod lenB) + 1`, where `sA` is A's last counted step number (1-based) and `lenB` is the number of steps in B's combo. Charged steps and special moves (lunge, spin, throw) are not part of `lenB`. A then resets to step 1. If B is the `shield`, nothing carries over and no bonus is given.
2. **Switch bonus:** that first step of B gets **+0.50** in 02's additive pool for all its hits. **Internal cooldown 1.5 s** (180 player ticks) from the tick the bonus was given; a switch during the cooldown still carries the combo over but gives no bonus. (Balance guard so that alternating weapons every step is not a permanent +50%.)
- Example: Greatsword steps 1, 2 → switch to War Maul (2 steps) → War Maul starts at step `(2 mod 2) + 1 = 1` with +50%. Katana steps 1, 2 → Greatsword → step 3 (the cleave) with +50%.

### 6.3 Spellblade (Swordsman + Wizard)

- Each **weapon** attack instance whose `melee` hit group lands (02 §1 kind) removes **0.5 s (60 ticks)** from the `rechargeLeft` of **both** ability slots (§7.7), once per attack instance however many enemies it hits. The reduction is flat (not scaled by `rechargeRate`). If it brings `rechargeLeft` to 0 or below, that charge completes this tick; leftover is lost.
- Weapon `shot` hit groups (projectiles, explosions, the thrown hammer, rings, waves) and ability hits do not count. Dive slams are `melee` (02 §9.7) and count.

### 6.4 Warden (Tank + Archer)

Two booleans, `shotPrimed` and `meleePrimed`. Neither stacks or expires (except the clears listed at the top of §6).

1. When a **weapon** attack instance's `melee` hit group lands → `shotPrimed = true`.
2. When a **weapon** projectile spawns while `shotPrimed` → that projectile (and its explosion, if any) gets **+0.50** in 02's additive pool; `shotPrimed = false`. For multi-projectile steps (Throwing Knives, Triple Shot), every projectile of that step gets it. Consumed on firing, hit or miss.
3. When a **weapon** projectile (kind `shot`) lands → `meleePrimed = true`.
4. The next **weapon** `melee` attack instance that lands while `meleePrimed` gets **+0.50** on every hit of that instance; `meleePrimed = false`. Consumed only on landing (whiffs do not use it).

Ability hits never prime or consume.

### 6.5 Thunderlord (Tank + Wizard)

- Each **heavy** direct hit (02 §1 list) on an enemy calls a **lightning bolt** on that enemy, **0.10 s (12 world ticks)** later, at most **3 bolts per attack instance** (the first 3 heavy direct hits in hit order).
- Bolt box: `0, −80, 24, 160` placed with its bottom at the target's feet and centered on the target's center x **at strike time** (if the target died, use its last position). It hits every enemy in the box once.
- Bolt hit: base damage = **50% of the triggering hit's base damage** (02 §3.1 step 1, before grade), kind `shot`, **not heavy** (bolts never call bolts), KB `0, −100`, poise 20, hit-stop 0.05 s (target only). It belongs to the weapon's attack instance, so grade, match and the weapon's element apply (like the Storm Hammer dive bolt, 02 §10.5).
- Storm Hammer's 2 s throw recharge comes from carrying a Wizard ability (02 §11), not from this perk.

### 6.6 Arcane Archer (Archer + Wizard)

1. **Every arrow carries an element:** every projectile fired by an **Archer-tagged** weapon (`bow`, `crossbow`, `hand_cannon`, `javelin`, `throwing_knives`) whose weapon has no element gets **Lightning, level 1** (02 §6.1). Any grade, F included. A weapon that has its own element keeps it.
2. **Charged shots explode:** a weapon charged attack of kind `shot` (02 §1: Bow charged shot, Staff orb):
   - **Bow `arrow_charged`** (and each Triple Shot arrow): explodes once, at the first enemy it hits (it keeps piercing), or where it ends (wall or range) if it hit nothing. Blast 64 × 64 centered on the hit enemy's center (or the end point). Base damage = 50% of that arrow's base damage (32 → 16; side arrows 16 → 8). KB `140, −60`, poise 20, hit-stop 0.05 s. The directly hit enemy is not hit by the blast (02 §10.4). Uses the bow's grade, match and element.
   - **Staff `orb`** already explodes: its blast box is ×1.5 (80 × 80 → 120 × 120; Singularity 112 → 168).

## 7. Ability rules

### 7.1 Slots, pickup and swapping

- **2 ability slots, never more.** Two copies of the same ability id can never be carried.
- **Every newly generated ability is Lv1:** free loot, key chests, elite and boss drops, shop stock, wandering merchant. The level of your other abilities does not matter. New items start with full charges.
- **A dropped ability keeps its level** and its charge state (`charges`, `rechargeLeft`). While on the ground it keeps recharging at rate 1.0 (world ticks).
- **Pickup (interact on an ability item; 06/07 decide the overlap and the prompt):**
  1. Refused while an ability cast (§7.6) or an ability `ForcedMove` is running (press ignored).
  2. If you carry an ability with the **same id**: swap with that slot (no choice).
  3. Else if a slot is empty: fill it (slot 1 before slot 2).
  4. Else (both full): open the **swap choice** (07 draws it). While it is open the game does not pause, movement and weapons work, and `ability1.pressed` / `ability2.pressed` mean "replace slot 1 / slot 2" instead of activating (no ability can activate). It closes without a swap on: interact pressed again, the player's box no longer overlapping the item's pickup box, or the player taking damage.
- **Replacing:** the old ability becomes an item at the player's feet (same drop rule as a dropped weapon, 05/06) with its level and charge state. The new one goes into that slot with its stored state. Class state recomputes the same tick.
- **Buying** an ability in a shop uses the same steps 2–4 (the bought item is treated as picked up).
- Dropped ability items are removed when the stage (or village) is left.

### 7.2 Levels, upgrading, selling

- Levels 1–5. Each level's numbers are in §8–§12. Abilities do **not** use weapon grades.
- **Upgrade** (village shop or wandering merchant; prices 05): +1 level to one carried ability, max Lv5. The charge state is kept. If max charges rises (Blade Dash and Blink at Lv5), the new charge is added **ready**.
- **Sell** (village shop only; prices 05): the slot becomes empty. Any ability can be sold, including the starting one; selling both leaves "No Class".
- Level design (06) must assume **Lv1** numbers for any route that needs an ability (Grapple Arrow range, Blink distance, Shoulder Charge).

### 7.3 Ability kinds

| Kind | Abilities | Behavior |
|---|---|---|
| `passive` | Vampire | Always on. Pressing its button does nothing. |
| `instant` | Blade Flurry, Rage, Hunter's Mark, Time Slow | Effect starts on the press tick. No cast, no movement change. Does not cancel weapon attacks, dashes or anything else. |
| `cast` | Riposte, Shockwave, Boulder Toss, Arrow Rain, Turret, Thunder Strike, Frost Burst | Startup → effect → recovery (§7.6), like a weapon step. |
| `move` | Blade Dash, Whirlwind, Shoulder Charge, Grapple Arrow, Blink | Starts a `ForcedMove` (01 §12.3) or `teleport()` (01 §12.4) on the press tick. |

### 7.4 Pressing and activation

- **Buffer:** a press is remembered for **0.15 s (18 player ticks)** per slot, like 02's input buffer. A press during the player's hit-stop is buffered, and its window starts when hit-stop ends.
- **Where:** abilities are processed last in 02 §2.1 step 3 (after dash/jump cancels, the flask and weapon inputs). Slot 1 before slot 2.
- Each tick a buffered press exists, try to start it. It starts when **all** hold:
  1. the slot holds an ability that is not `passive`, and the swap choice is closed;
  2. `charges ≥ 1`;
  3. the current state allows it (§7.5);
  4. no other ability cast or ability `ForcedMove` is running — except: `instant` abilities ignore this, and any ability may start during another cast's **recovery** (cancelling it);
  5. while Rooted (02 §5.4): `move` abilities that move the player are refused (Grapple Arrow may still target small/medium enemies, §10.3).
  If 2–5 fail, the press stays buffered until its window ends; on the press tick, emit `abilityNotReady(slot)` if the reason is no charge (07 flashes the icon).
- **Fizzle:** if the ability starts but its own check fails (Hunter's Mark finds no target; Blink finds no free spot), the press is used up, **nothing is spent**, emit `abilityFizzle(slot)`.
- **Activation** = the tick the effect starts: the press tick for `instant` and `move`, the end of startup for `cast` (§7.6). On activation: `charges −= 1`; if the slot was not already recharging, `rechargeLeft = cooldownTicks`; apply the link rule (§5.1); emit `abilityUsed(slot, id, linked)`. 02's Rush "ability started" check (02 §8.2) uses the press tick.

### 7.5 What each movement state allows (01 §5.1)

| Player state | `instant` | `cast` | `move` |
|---|---|---|---|
| `ground`, `air` | yes | yes | yes |
| `wallSlide` | yes | yes: state → `air`, facing away from the wall | yes: direction away from the wall |
| `dash`, `slide` | yes (dash/slide continues) | yes: ends the dash/slide first (01's end rules; dash cooldown starts) | same as cast |
| `crawl` | yes | yes (stays in crawl, low box) | yes (`ForcedMove` keeps the low box) |
| `ledgeClimb` | yes | snap to the end position (01 §10.3), then start | same |
| `diveWindup`, `diveFall` | yes | dive cancelled → `air`, then start | same |
| `diveLand` | yes | cancelled → `ground`, then start | same |
| `forced` (any ForcedMove) | yes | buffered | buffered |
| `minecart` | yes | yes, player stays in the cart (no move cap, no hover) | player leaves the cart first (01 §13.6), then it runs |
| `hurt` (hitstun) | buffered | buffered | buffered |
| `dead` | no | no | no |

- A `cast` or `move` activation **cancels any weapon attack or charge** in any phase, with 02 §9.2's after-cancel rules (a cancel in startup/active means that step does not count; a charge is lost). It also lowers a raised shield and cancels a drink before its sip point (nothing used).
- Every ability can be used in the air. Air behavior is in §7.6 and per ability.

### 7.6 Cast timing, movement and cancels

A cast with startup `S` ticks and recovery `R` ticks pressed on tick `T`: startup is ticks `T … T+S−1`, the **effect fires on tick `T+S`**, and the player is free on tick `T+S+R`. With `S = 0` the effect fires on `T`.

| Ability | Startup s (ticks) | Recovery s (ticks) | Ground move cap | In the air |
|---|---|---|---|---|
| Riposte | 0 (stance 1.0 s) | counter 0.25 (30) | 0% | gravity ×0.5 |
| Shockwave | 0.20 (24) | 0.25 (30) | 0% | hover in startup, gravity ×0.5 in recovery |
| Boulder Toss | 0.25 (30) | 0.20 (24) | 30% | gravity ×0.5 |
| Arrow Rain | 0.15 (18) | 0.15 (18) | 50% | gravity ×0.5 |
| Turret | 0.10 (12) | 0.10 (12) | 0% | normal gravity |
| Thunder Strike | 0.15 (18) | 0.20 (24) | 30% | gravity ×0.3 |
| Frost Burst | 0.10 (12) | 0.20 (24) | 0% | hover in startup, gravity ×0.5 in recovery |

- **Move cap** works like 02 §9.3 (sets 01's `actionMoveMult`; target speed limit on the ground only). **Gravity ×k** is 01's `gravityMult`. **Hover:** at cast start `vy = 0`, and gravity is 0 for the whole startup. These apply from the tick the cast starts.
- **Facing:** at cast start the player turns to `moveX` if it is not 0. Facing is then locked until the cast ends. All "in front" rules use this facing.
- **Cancels during startup:** jump, dash or shield raise cancel the cast; **nothing is spent**. Getting hurt (without super armor) also cancels it with nothing spent.
- **Cancels during recovery:** jump, dash, shield raise, a weapon press, or another ability press end the recovery at once (already spent).
- **Weapon presses during startup** wait in 02's 0.15 s buffer.
- `move` abilities follow their own `ForcedMove` cancel flags (per ability); getting knocked back ends any `ForcedMove` (01 §12.2).

### 7.7 Cooldowns, charges, recharge rate

```
rechargeRate = 1 + Σ recharge bonuses        // Storm Caller +0.25; stat upgrades (05)
each player tick, for each slot with charges < maxCharges:
  rechargeLeft -= rechargeRate
  if rechargeLeft <= 0:
    charges += 1
    rechargeLeft = (charges < maxCharges) ? cooldownTicks : 0     // leftover is lost
```

- `cooldownTicks = Math.round(cooldownS × 120)`, read from the current level when a recharge starts.
- One charge recharges at a time. With 2 charges, using both starts one timer; the second charge starts recharging when the first returns.
- The cooldown starts on **activation** for every ability (§7.4), even ones with a duration (all cooldowns are longer than their durations at base rate).
- **Stage start:** every carried ability is set to full charges and `rechargeLeft = 0`.

### 7.8 Ability hits

- Every ability hit is a `HitSpec` (02 §14) and goes through 02's pipeline. **Ability hits skip grade and match** (02 §3.1 steps 2–3) and **never scale with the stage.** They do get 02's additive pool (Rage, link, stat upgrades), crits (random and guaranteed), and target multipliers (Hunter's Mark, shatter, guard).
- Ability hits carry **no element** and are never `heavy` or `charged`. Frost Burst applies Frozen/Chill itself (§11.2).
- Kind (`melee`/`shot`) per ability is given below; it sets hit-stop behavior (02 §4.1). Hybrid perks that say "weapon" ignore ability hits.
- **Rush `dashAttack`** (02 §8.2): Blade Dash and Shoulder Charge.
- Ability hits do not break Lucky Blocks (02 §2.3). Only Shoulder Charge breaks cracked walls (§9.2).
- Kill credit, flask fill and on-kill effects are 02's; kills record the ability id as the source.
- Size and control: Launch, Pull, Stun follow 02 §4.4 (small/medium/large/boss, elite ×0.5).

### 7.9 Effects after a swap, sell, death or stage change

- Effects already started (Rage, Turret, Blade Flurry, marks, Time Slow, a running stance or `ForcedMove`, a flying boulder) **continue to their normal end** after the ability leaves its slot. Only bonds, hybrids, Vampire and the link update at once.
- **Death** and **stage start** remove every ability entity and effect (turrets, zones, bolts, boulders, marks, Blade Flurry, Rage, Time Slow).

## 8. Swordsman abilities

### 8.1 Blade Dash (`blade_dash`, move) — cooldown 6 s

An extra dash that slices through every enemy in its path. Separate from the normal dash: it does not use the air dash and does not start the dash cooldown.

| Lv | `damage` | `charges` |
|---|---|---|
| 1 | 30 | 1 |
| 2 | 40 | 1 |
| 3 | 52 | 1 |
| 4 | 66 | 1 |
| 5 | 82 | **2** |

- **Direction:** `moveX` if not 0, else facing (from `wallSlide`: away from the wall). Facing = direction.
- **Move:** `ForcedMove { vx: dir × 480, vy: 0, durationS: 0.20 (24 ticks), gravity: false, endOnWall: true, endVelocity: 'clampToRun', cancelByJump: true, cancelByDash: true }` → **96 px** on open ground, horizontal in the air.
- **I-frames** (02 "ability i-frames") on all 24 ticks. Hazards still hit (same as the dash, 01 §7.2).
- **Hit:** box `0, −14, 28, 32` every tick of the move; each enemy once per activation. KB `120, −60`, poise 20, hit-stop 0.05 s (enemy only), kind `melee`, `dashAttack`.
- Started while touching a wall in the move direction: it ends on its first tick (still spent).
- **Linked:** +0.50 damage.

### 8.2 Whirlwind (`whirlwind`, move) — cooldown 8 s

Spin forward through enemies.

| Lv | `damagePerHit` | `durationS` (ticks) | `maxHits` | Pull |
|---|---|---|---|---|
| 1 | 10 | 0.60 (72) | 4 | no |
| 2 | 11 | 0.75 (90) | 5 | no |
| 3 | 12 | 0.90 (108) | 6 | no |
| 4 | 13 | 1.05 (126) | 7 | no |
| 5 | 14 | 1.20 (144) | 8 | **yes** |

- **Move:** `ForcedMove { vx: dir × 120, vy: 0, gravity: true, endOnWall: false, endVelocity: 'clampToRun', cancelByJump: true, cancelByDash: true }` for the level's duration (72–144 px). Direction rule as Blade Dash. Gravity applies, so it falls off ledges and arcs down in the air. Against a wall it keeps spinning in place.
- **Hit:** box `0, −16, 48, 32`, kind `melee`, `multiHit`, `rehit` 0.15 s, `maxHits` per target from the table. KB `60, −20`, poise 6, hit-stop 0.025 s (target only). An enemy inside the box for the whole spin takes exactly `maxHits` hits.
- **Lv5 pull:** while spinning, small and medium enemies whose center is within 64 px of the body center are Pulled toward the player at **120 px/s** (02 §4.4, same as the Cyclone in 02 §13).
- No i-frames, no super armor: a hit that knocks the player back ends the spin.
- **Linked:** +0.50 damage.

### 8.3 Blade Flurry (`blade_flurry`, instant) — cooldown 14 s

Swords spin around you.

| Lv | `blades` | `durationS` | `damagePerHit` |
|---|---|---|---|
| 1 | 2 | 4.0 | 5 |
| 2 | 2 | 5.0 | 5 |
| 3 | 3 | 5.0 | 5 |
| 4 | 3 | 6.0 | 5 |
| 5 | 4 | 6.0 | 5 |

- Blades orbit the body center at radius **28 px**, **450°/s** (one turn per 0.8 s), evenly spaced; blade `k` starts at angle `k × 360 / blades` (0° = right). Each blade is a 10 × 10 box.
- **Each blade is its own hit group:** kind `shot`, `multiHit`, `rehit` **0.75 s**. KB `40, −10`, poise 3, hit-stop 0. A blade hits a given enemy at most once per turn, so a target next to the player takes about `blades / 0.8` hits per second.
- The duration counts player ticks. Blades ignore terrain and do not block projectiles. Recasting (if a cooldown bonus makes it possible) replaces the old blades and restarts the duration.
- **Linked:** +0.50 damage.

### 8.4 Riposte (`riposte`, cast) — cooldown 8 s

A 1-second stance: if you get hit, block it and counter with a big slash.

| Lv | `damage` | Counter `w` × `h` | Refund dash |
|---|---|---|---|
| 1 | 45 | 64 × 40 | no |
| 2 | 60 | 72 × 40 | no |
| 3 | 78 | 80 × 48 | no |
| 4 | 98 | 88 × 48 | no |
| 5 | 122 | 96 × 56 | **yes** |

- **Stance:** activates on the press tick (spent then). Lasts **1.0 s (120 player ticks)**. Ground move cap 0%; in the air gravity ×0.5. Jump, dash or shield raise end the stance (still spent). If no hit comes, it ends with no effect.
- **Block:** 02 §5.2 step 2 hands every enemy direct hit (melee hit group or projectile) to Riposte while the stance is up. Hazards, damage over time and attacks with 04's `unblockable` flag are **not** blocked and go through the normal pipeline (the stance stays up). A blocked hit: 0 damage, no hitstun, no Rush loss, no hit-streak reset; a blocked projectile is destroyed. The first blocked hit ends the stance and triggers the counter on that tick `T`:
  - Facing turns toward the attacker (`sign(attacker.cx − player.cx)`; for a projectile with no living owner, toward where it came from).
  - **Ability i-frames 0.40 s** (ticks `T … T+47`). Hit-stop 0.075 s for the player and a melee attacker.
  - **Counter:** box `w/2, −14, w, h` (it starts at the feet and extends `w` px forward), active ticks `T+1 … T+12`, each enemy once. KB `260, −120`, poise 50, hit-stop 0.10 s, kind `melee`.
  - Recovery until tick `T+30` (cancellable, §7.6).
  - **Lv5:** `refundDash()` on tick `T`.
- Riposte takes priority over a shield (it runs at step 2, before parry/block).
- **Linked:** +0.50 counter damage.

## 9. Tank abilities

### 9.1 Shockwave (`shockwave`, cast) — cooldown 9 s

Ground slam that knocks enemies up.

| Lv | `damage` | Half-width `R` (px) |
|---|---|---|
| 1 | 40 | 56 |
| 2 | 54 | 64 |
| 3 | 70 | 72 |
| 4 | 88 | 84 |
| 5 | 110 | 96 |

- Cast data in §7.6 (hover in the air during startup).
- **Effect tick:** one hit group, box `0, −18, 2R, 44` (from 4 px below the feet to 40 px above, `R` px to each side), active 1 tick, ignores terrain. Works the same in the air (centered on the feet).
- Hit: KB `80, −320` (x away from the player's center), **Launch** (02 §4.4: small/medium are launched; large take the knockback; bosses immune), poise 40, hit-stop 0.075 s, kind `shot`.
- **Linked:** +0.50 damage.

### 9.2 Shoulder Charge (`shoulder_charge`, move) — cooldown 7 s

Charge forward, knocking enemies aside. Breaks cracked walls.

| Lv | `damage` | `distancePx` | Ticks | `stunS` |
|---|---|---|---|---|
| 1 | 25 | 96 | 32 | 0 |
| 2 | 32 | 108 | 36 | 0 |
| 3 | 40 | 120 | 40 | 0 |
| 4 | 50 | 132 | 44 | 0 |
| 5 | 62 | 144 | 48 | **1.0** |

- **Move:** `ForcedMove { vx: dir × 360, vy: 0, gravity: false, endOnWall: true, endVelocity: 'clampToRun', cancelByJump: true, cancelByDash: true }` for the listed ticks (3 px per tick). Direction rule as Blade Dash. Horizontal in the air.
- **Super armor** (02 §5.3) for the whole charge.
- **Hit:** box `14, −14, 20, 28` every tick; each enemy once. KB `300, −180` in the charge direction, poise 35, hit-stop 0.05 s (enemy only), kind `melee`, `dashAttack`. Lv5 adds **Stun 1.0 s** (02 §4.4).
  - Small or medium enemy: knocked aside; the charge continues.
  - Large enemy or boss: takes the hit, and the charge **ends at once** with `vx = 0`.
- **Cracked walls:** at the start of each tick of the charge, every active cracked-wall body (06) that overlaps the player's box extended 4 px in the charge direction breaks (`active = false`; 06 owns whether it stays broken). The charge then moves normally, so it never stops on a cracked wall. Only Shoulder Charge breaks them.
- **Linked:** +0.50 damage.

### 9.3 Rage (`rage`, instant) — cooldown 18 s

| Lv | `damageBonus` |
|---|---|
| 1 | +0.30 |
| 2 | +0.37 |
| 3 | +0.45 |
| 4 | +0.52 |
| 5 | +0.60 |

- For **6.0 s** (player ticks): `damageBonus` is added to 02's additive pool for **every** player direct hit (weapons and abilities; secondary damage follows procBase per 02), checked at the moment of each hit, and the player has **super armor** (02 §5.3).
- Recasting while active (only possible with cooldown bonuses) restarts the 6.0 s and uses the new bonus; it does not stack.
- **Linked:** bonus ×1.5 (Lv1 +0.45, Lv5 +0.90).

### 9.4 Boulder Toss (`boulder_toss`, cast) — cooldown 8 s

| Lv | `damage` | `sizePx` | `shards` |
|---|---|---|---|
| 1 | 45 | 16 | 0 |
| 2 | 60 | 18 | 0 |
| 3 | 78 | 20 | 0 |
| 4 | 98 | 22 | 0 |
| 5 | 120 | 24 | **4** |

- **Effect tick:** a boulder projectile spawns at `+12, −18` from the feet (02 §9.8; if inside a solid, it breaks at once). Velocity `(f × 360, −240)` px/s, gravity **900 px/s²**, square box `sizePx`. On flat ground it lands about 220 px ahead.
- It collides with solid tiles and solid bodies (passes through one-way platforms). It breaks on its first enemy hit or terrain contact, or after 3.0 s.
- Hit: KB `220, −160` (travel direction), poise 40, hit-stop 0.075 s, kind `shot`.
- **Lv5 shatter:** when the boulder breaks (not by timeout), 4 shards spawn at its last free position with velocities `(−160, −260)`, `(−80, −320)`, `(80, −320)`, `(160, −260)`, gravity 900, box 8 × 8, life 1.5 s. Each breaks on its first enemy or terrain contact. Shard hit: **20** damage, KB `100, −80`, poise 10, hit-stop 0.025 s, kind `shot`. Shards never hit the enemy the boulder hit.
- **Linked:** +0.50 damage (boulder and shards).

## 10. Archer abilities

### 10.1 Arrow Rain (`arrow_rain`, cast) — cooldown 10 s

Rain of arrows on the area ahead.

| Lv | `waves` | `damagePerWave` | `widthPx` |
|---|---|---|---|
| 1 | 5 | 10 | 96 |
| 2 | 6 | 11 | 112 |
| 3 | 7 | 12 | 128 |
| 4 | 8 | 13 | 144 |
| 5 | 10 | 14 | 160 |

- **Zone** (fixed in the world at the effect tick): horizontally from `x + f × 16` to `x + f × (16 + widthPx)`; vertically from `feetY − 96` to `feetY + 32`. **Clip at walls:** scan from the body center along row `feetY − 14` in the facing direction; the zone's far edge stops at the first solid tile or solid body pixel.
- **Waves:** wave `k` (1 … `waves`) fires `24 × k` world ticks after the effect tick (every 0.2 s). Each wave is its own hit group: one direct hit on every enemy overlapping the zone. KB `20, 0`, poise 5, hit-stop 0.025 s (target only), kind `shot`. Hits come from above (04's front-guard check counts them as not frontal).
- An enemy standing in the zone the whole time takes `waves × damagePerWave` (Lv1: 50).
- The falling arrows are visuals only (08, `hash2`).
- **Linked:** +0.50 damage.

### 10.2 Turret (`turret`, cast) — cooldown 14 s

Drop a ballista that shoots for 8 s.

| Lv | `turrets` | `boltDamage` | `fireIntervalS` |
|---|---|---|---|
| 1 | 1 | 12 | 1.0 |
| 2 | 1 | 14 | 0.9 |
| 3 | 1 | 16 | 0.8 |
| 4 | 1 | 18 | 0.7 |
| 5 | **2** | 14 | 0.7 |

(Lv5 per-bolt damage is lower because there are two turrets.)

- **Placement (effect tick):** turret feet at `(x + f × 12, feetY)`; at Lv5 a second one at `(x − f × 12, feetY)`. If a spot is inside a solid, use `x`. Box 16 × 16, feet at the bottom center. Not solid, invulnerable, and enemies ignore it.
- **In the air:** it falls (gravity 1500, max 600 px/s) until it lands on solid ground or a one-way platform. If it has not landed after 2.0 s, it vanishes.
- **Life:** **8.0 s** from placement (world ticks). Max alive: 1 (Lv1–4), 2 (Lv5); placing more removes the oldest.
- **Firing:** starts **0.2 s after landing**. Muzzle at the turret's feet + `(0, −10)`. Target = the nearest living enemy (muzzle to hurtbox center) within **256 px** with LOS; ties → lower entity id. When the fire timer is ready and a target exists, it fires one bolt aimed at the target's center (no homing) and the timer resets to `fireIntervalS`. With no target, the timer waits at ready. Lv1 at a stationary target in range fires exactly 8 bolts.
- **Bolt** (`turret_bolt`): speed 500, range 320, box 8 × 4, gravity 0, pierce 0, `onWall: vanish`. KB `60, −10`, poise 6, hit-stop 0.025 s, kind `shot`.
- **Linked:** +0.50 damage for every bolt of the turret(s) from that activation.

### 10.3 Grapple Arrow (`grapple_arrow`, move) — cooldown 4 s (miss: 1 s)

Rope arrow: pulls you to walls and grapple points, or pulls enemies to you.

| Lv | `rangePx` | `pullSpeed` (px/s) | `damage` |
|---|---|---|---|
| 1 | 160 | 450 | 15 |
| 2 | 176 | 480 | 20 |
| 3 | 192 | 520 | 26 |
| 4 | 208 | 560 | 33 |
| 5 | 224 | 600 | 40 |

- **Aim** (on the press tick): horizontal sign `h = moveX` if not 0, else facing. If `moveY = −1` and `moveX ≠ 0` → 45° up toward `h`. If `moveY = −1` and `moveX = 0` → straight up. Otherwise → horizontal toward `h`. Down is never aimed. Distances are from the body center.
- **Target choice, first match wins** (all within `rangePx`, all need LOS):
  1. **Grapple point** (01 §13.7) whose direction is within **35°** of the aim → the nearest.
  2. **Enemy** whose hurtbox center is within **20°** of the aim → the nearest.
  3. **Raycast** along the aim up to `rangePx`: the first enemy hurtbox → that enemy; the first solid tile or non-one-way solid body → wall.
  4. Nothing → **miss**: the charge is used and `rechargeLeft = 120` (1.0 s) instead of the full cooldown.
- The rope is instant (the flying arrow is a visual).
- **Grapple point:** 01 §13.7's pull: `ForcedMove` to the point at `pullSpeed`, `durationS = distance / pullSpeed + 0.1`; arrival per 01.
- **Wall:** `ForcedMove { target: hit point, speed: pullSpeed, gravity: false, endOnWall: true, arriveDist: 12, durationS: distance / pullSpeed + 0.1, endVelocity: 'zero', cancelByJump: true, cancelByDash: true }`; arrival per 01 §13.7 ("arrival at a wall"). Ceilings work the same.
- **Enemy:** hit on the activation tick: `damage`, KB `0, 0`, poise 10, hit-stop 0.05 s, kind `shot`. Then:
  - Small or medium: **Pull** (02 §4.4) toward `(x + f × 20, feetY)` at speed `max(480, distance / 0.25)`, then **Stun 0.5 s** when the Pull ends.
  - Large or boss: the **player** is pulled: `ForcedMove` to the enemy's center at activation, `arriveDist: 20`, gravity off, ends on wall, cancellable; on arrival `vx = 0`, `vy = −150`, state `air`.
- While Rooted: only rule 2/3 small or medium enemies are valid targets (the player cannot be pulled); a large/boss enemy target deals damage only.
- **Linked:** +0.50 damage and Stun ×1.5 (0.75 s).

### 10.4 Hunter's Mark (`hunters_mark`, instant) — cooldown 12 s

| Lv | `marks` | `radiusPx` | `durationS` |
|---|---|---|---|
| 1 | 1 | 192 | 8 |
| 2 | 1 | 224 | 10 |
| 3 | 2 | 224 | 10 |
| 4 | 2 | 256 | 12 |
| 5 | **3** | 256 | 12 |

- **Targets:** living enemies (bosses and elites included) whose hurtbox center is within `radiusPx` of the body center (no LOS needed). Sort by **current HP, highest first**, then distance, then lower entity id. Mark the first `marks`.
- No enemy in range → **fizzle** (nothing spent, §7.4).
- Casting clears all your existing marks first. A mark ends when its enemy dies or after `durationS` (world ticks).
- **Effect:** ×**1.30** target multiplier (02 §3.1 step 6) on all player damage to a marked enemy, including secondary damage.
- **Linked:** ×1.45 for those marks.

## 11. Wizard abilities

### 11.1 Thunder Strike (`thunder_strike`, cast) — cooldown 8 s

Calls lightning down on enemies in front of you.

| Lv | `bolts` | `damagePerBolt` | Total on one target |
|---|---|---|---|
| 1 | 2 | 25 | 50 |
| 2 | 3 | 23 | 69 |
| 3 | 4 | 22 | 88 |
| 4 | 5 | 22 | 110 |
| 5 | 6 | 23 | 138 |

- **Candidates** (effect tick): living enemies with `0 ≤ (cx − x) × f ≤ 224` and `|cy − bodyCenterY| ≤ 112`, with LOS from the body center. Sorted by horizontal distance, then lower id.
- **Bolt `k`** (0 … `bolts−1`) strikes `12 × k` world ticks after the effect tick (every 0.1 s). Target = `candidates[k mod count]`; if that one has died, the next living one in the list; if none (or no candidates), a fixed column at `x + f × (48 + 32k)` (the `x` at the effect tick) with its bottom on the first solid surface within 160 px below the feet row (else at the feet row).
- **Bolt box:** `0, −80, 24, 160` with its bottom at the target's feet (or the column bottom), centered on the target's current center x. It hits every enemy in it once: `damagePerBolt`, KB `0, −100`, poise 15, hit-stop 0.05 s, kind `shot`, from above (not frontal for 04's guard check).
- **Linked:** +0.50 damage.

### 11.2 Frost Burst (`frost_burst`, cast) — cooldown 12 s

Freeze enemies around you.

| Lv | `damage` | `radiusPx` | `freezeS` | Freeze level |
|---|---|---|---|---|
| 1 | 20 | 56 | 1.5 | 1 |
| 2 | 26 | 64 | 1.8 | 1 |
| 3 | 33 | 72 | 2.1 | 2 |
| 4 | 42 | 80 | 2.5 | 2 |
| 5 | 52 | 96 | 3.0 | 3 |

- Cast data in §7.6 (hover in the air during startup).
- **Effect tick:** box `0, −14, 2r, 2r` (radius `r` around the body center), active 1 tick, ignores terrain. Hit: `damage`, KB `60, −20`, poise 10, hit-stop 0.05 s, kind `shot`. Then each enemy hit is **Frozen** (02 §6.3) for `freezeS` (elites ×0.5); the Frozen status stores the listed freeze level (so the shatter is ×2.0 / ×2.5 / ×3.0, 02 §6.3).
  - Bosses, and enemies in freeze immunity: no freeze; they get **Chill level 1** for 2.5 s instead (02 §6.3, halved on bosses).
- The Frost Burst hit itself does not shatter (it freezes after damage). The next direct hit does.
- **Linked:** +0.50 damage and `freezeS` ×1.5.

### 11.3 Blink (`blink`, move) — cooldown 5 s

Teleport a short distance, even through thin walls.

| Lv | `distancePx` | `charges` |
|---|---|---|
| 1 | 64 | 1 |
| 2 | 72 | 1 |
| 3 | 80 | 1 |
| 4 | 88 | 1 |
| 5 | 96 | **2** |

- **Direction:** 8-way from `(moveX, moveY)`; both 0 → `(f, 0)`. Straight: `(d × dirX, d × dirY)`. Diagonal: each axis `round(d × 0.7071)`. From `wallSlide`, with `moveX` toward the wall or 0, horizontal is away from the wall.
- Calls `teleport(dx, dy)` (01 §12.4: steps back toward the start until the box fits, so it passes through walls up to about `d − 12` px thick; respects `noTeleport` bodies and camera bounds).
- **Fails** (fizzle, nothing spent) if 01 reports no free spot or the final displacement is under **8 px**.
- After: **ability i-frames 0.15 s (18 ticks)**. Momentum per 01 (`vy = 0`, `vx` kept). Does not refresh the air dash or double jump.
- **Linked:** distance ×1.5 (Lv1 96 px).

### 11.4 Time Slow (`time_slow`, instant) — cooldown 25 s

Slow everything except you.

| Lv | `durationS` |
|---|---|
| 1 | 3.0 |
| 2 | 3.5 |
| 3 | 4.0 |
| 4 | 4.5 |
| 5 | 5.0 |

- For `durationS` (player ticks), every **non-player** entity runs at **×0.35** speed: enemies and bosses (multiply into 02's enemy `timeScale`, which already scales movement and all AI timers), enemy projectiles (speed and life timers ×0.35), enemy status timers, and level hazards and their timers (cannons, swinging blades, falling rocks, collapsing platform timers). The core exposes this as `worldTimeScale` (0.35 while Time Slow runs, else 1.0); 01, 04 and 06 objects multiply their speeds and timers by it.
- **Not slowed:** the player, the run timer, timed doors (they use the run timer), player-owned things (projectiles, Turret, boulder, zones, bolts, Blade Flurry, the thrown Storm Hammer), the minecart, Lucky Block buff/debuff timers, the Rush meter.
- Recasting (only possible with cooldown bonuses) restarts the duration; it does not stack.
- **Linked:** duration ×1.5.

## 12. Neutral: Vampire (`vampire`, passive)

| Lv | Extra flask fill per player kill | In tenths (02 §7.1) |
|---|---|---|
| 1 | +2.0% | 20 |
| 2 | +2.5% | 25 |
| 3 | +3.0% | 30 |
| 4 | +4.0% | 40 |
| 5 | +5.0% | 50 |

- Always on while carried; no button, no cooldown, never linked. It is the `vampire` term in 02 §7.3 for every player kill (regular, elite, boss).
- Neutral: it gives no class, no bond, no hybrid and no weapon match (§4.1). Maximum: Vampire Lv5 5% + regular 5% + Scythe 3% + Bloodthirst ×3 6% = 19% per kill (×2 = 38% with Bloodrush). (The plan's 15% counts only one Bloodthirst stack; 05 §13 allows 3.)

## 13. Balance reference (informative)

- Lv1 single-target bursts (≈ 30–50) kill a 25–30 HP Stage-1 mob in one use and take most of a 60 HP mob. Lv1 abilities add about 5–12 DPS on top of the standard 45 DPS weapon; they are bursts and tools, not the main damage.
- Damage index per level is about **×1.0 / 1.35 / 1.75 / 2.2 / 2.75** (Turret and Blade Flurry spike at Lv5). Regular mob and elite HP is ×1.0 / 1.4 / 1.9 / 2.4 by stage and boss HP ×1.0 / 1.7 / 2.6 / 3.6 (00-README), so an ability that gains about one level per stage keeps pace with weapon grades (C 1.0 → A 1.6 / S 2.0). A Lv1 ability found late is mostly a utility tool, which is the "invest or switch" choice of plan 5.5.
- Utility numbers (Blink distance, Grapple range, Shoulder Charge distance) grow only modestly so level design can rely on Lv1.

## 14. Data shapes and events

```ts
export type ClassId = 'swordsman' | 'tank' | 'archer' | 'wizard';
export type AbilityId = 'blade_dash' | 'whirlwind' | 'blade_flurry' | 'riposte'
  | 'shockwave' | 'shoulder_charge' | 'rage' | 'boulder_toss'
  | 'arrow_rain' | 'turret' | 'grapple_arrow' | 'hunters_mark'
  | 'thunder_strike' | 'frost_burst' | 'blink' | 'time_slow' | 'vampire';
export type BondId = 'blademaster' | 'iron_will' | 'eagle_eye' | 'storm_caller';
export type HybridId = 'thief' | 'gladiator' | 'spellblade' | 'warden' | 'thunderlord' | 'arcane_archer';
export type AbilityKind = 'passive' | 'instant' | 'cast' | 'move';
export type AbilityLevel = 1 | 2 | 3 | 4 | 5;

export interface AbilityLevelRow {
  cooldownS: number;                  // 0 for vampire
  charges: 1 | 2;
  [field: string]: number | boolean;  // ability fields, named exactly as the §8–§12 table headers
}
export interface AbilityDef {
  id: AbilityId; name: string; cls: ClassId | null; kind: AbilityKind;
  startupS: number; recoveryS: number;             // §7.6; 0 for instant/move/passive
  groundMoveCap: number; airGravityMult: number; airHover: boolean;
  dashAttack: boolean;
  hits: Record<string, HitSpec>;                    // 02 §14; damage filled from the level row
  levels: [AbilityLevelRow, AbilityLevelRow, AbilityLevelRow, AbilityLevelRow, AbilityLevelRow];
}
export interface AbilitySlot { id: AbilityId; level: AbilityLevel; charges: number; rechargeLeft: number /* ticks */ }
export interface AbilityItem extends AbilitySlot { x: number; y: number }   // on the ground
export interface ClassState {
  displayClass: ClassId | null; displayName: string;
  connection: boolean; bond: BondId | null; bondName: string | null;
  hybrid: HybridId | null; carriedClasses: ClassId[];
  weaponMatched: [boolean, boolean];
}
export interface StartingKit { cls: ClassId; ability: AbilityId; weapons: [WeaponId, WeaponId] }
export interface AbilityRuntime {
  slots: [AbilitySlot | null, AbilitySlot | null];
  pressTick: [number, number];                      // −Infinity when no buffered press
  link: { fromSlot: 0 | 1; openedTick: number } | null;
  cast: { slot: 0 | 1; startTick: number; linked: boolean } | null;
  swapChoice: { itemId: string } | null;
  eagleEyeBudget: number; lockpickUsedThisStage: boolean;
  gladiatorReadyTick: number; shotPrimed: boolean; meleePrimed: boolean;
}

export type ClassEvent = 'abilityUsed' | 'abilityLinked' | 'abilityFizzle' | 'abilityNotReady'
  | 'classChanged' | 'classDiscovered' | 'riposteCounter' | 'lockpickUsed' | 'wallBroken';
```

Events go on the core's per-tick event list (01 §15). `window.__game` (README) exposes `AbilityRuntime` and `ClassState`.

## Test checklist

All tests run in Vitest on `src/core` with no modifiers unless stated (no stat upgrades, Rush 0, no crit chance).

1. `computeClassState([blade_dash, arrow_rain])` gives `hybrid = 'thief'`, `displayName = "Thief"`, `connection = false`.
2. `computeClassState([thunder_strike, frost_burst])` gives `bond = 'storm_caller'`, `displayName = "Wizard"`, `bondName = "Storm Caller"`, `connection = true`.
3. `[vampire, blink]` gives `displayName = "Wizard"`, no bond, no hybrid; a `staff` slot is matched and a `bow` slot is not. `[vampire, null]` and `[null, null]` give "No Class" and nothing matched.
4. `storm_hammer` is matched with `[shockwave]`, with `[blink]`, and with `[shockwave, blink]` (Thunderlord); it is not matched with `[arrow_rain]`.
5. Every one of the 19 weapon ids has at least one class tag; only `storm_hammer` has two. Every ability except `vampire` has exactly one class; there are 17 abilities.
6. Link: with Connection, Thunder Strike activating on tick 1000 and Frost Burst on tick 1360 deals 20 × 1.5 = 30; on tick 1361 it deals 20. With a hybrid pair, the same timing deals 20.
7. A linked activation does not open a new window: A at tick 0, B at tick 100 (linked), A at tick 200 → not linked.
8. With Storm Caller, an 8 s cooldown recharges in 768 player ticks; without it, 960. Player ticks spent in hit-stop do not count.
9. Spellblade: a weapon melee instance that lands on 3 enemies lowers each slot's `rechargeLeft` by exactly 60 ticks; a weapon shot hit lowers nothing.
10. Iron Will: at 50/100 HP, getting the bond gives 80/130; losing it gives 50/100. At 10/130, losing it gives 1/100.
11. Blademaster: the attack instance that makes the hit streak 3 crits on every target it hits; the 4th and 5th do not; the 6th does. Each player kill calls `refundDash()` once.
12. Vampire adds 20 / 25 / 30 / 40 / 50 tenths of flask fill per kill at Lv1–Lv5. With Vampire Lv5 and 3 Bloodthirst stacks, a Scythe kill of a regular enemy adds 190 tenths (19%); with Bloodrush active, 380.
13. A newly generated ability item is Lv1 with full charges, even while carrying a Lv5 ability of the same class.
14. Swapping out a Lv3 ability on cooldown drops an item with level 3; picking it back up 2 s later shows `rechargeLeft` 240 ticks lower than when dropped.
15. Pressing interact on a `blink` item while carrying `blink` Lv4 and `frost_burst` swaps it with the `blink` slot without opening the swap choice.
16. A cast cancelled by jump during startup uses no charge and starts no cooldown; one cancelled during recovery has used its charge.
17. Blade Dash Lv1 moves the player 96 px in 24 ticks, the player takes no damage from an enemy hit during it, each enemy in the path takes 30 once, and the dash cooldown and air dash are unchanged. Lv5 has 2 charges.
18. Whirlwind Lv1 hits a stationary enemy that stays in its box exactly 4 times for 10 each.
19. Shoulder Charge Lv1 moves 96 px in 32 ticks and passes through a cracked wall in its path without stopping; the wall becomes inactive. Against a large enemy it stops on the hit tick with `vx = 0`.
20. Shockwave Lv1 hits a small enemy 50 px to the side with a Launch (kb `80, −320` before `kbResist`), does not launch a large enemy, and misses an enemy whose hurtbox's near edge is 60 px from the player's `x`.
21. Arrow Rain Lv1 deals 5 hits of 10 to an enemy standing in the zone, at 24, 48, 72, 96 and 120 ticks after the effect tick; an enemy behind a wall 40 px ahead is not hit.
22. Turret Lv1 fires exactly 8 bolts at a stationary enemy 150 px away during its 8 s life; Lv5 places 2 turrets, and a 3rd placement removes the oldest.
23. Grapple Arrow Lv1 aimed up-forward with a grapple point 150 px away at 40° pulls the player to it; with no target in range it uses a charge and sets `rechargeLeft` to 120 ticks.
24. Hunter's Mark with no enemy within 192 px fizzles and leaves `charges` unchanged; with enemies of 40 and 60 HP in range it marks the 60 HP one, and a 20-damage hit on it deals 26.
25. Thunder Strike Lv3 against one enemy in range deals 4 hits of 22 (88 total) on ticks +0, +12, +24, +36 after the effect tick.
26. Frost Burst Lv1 freezes a regular enemy within 56 px for 1.5 s and an elite for 0.75 s; a boss is not frozen.
27. Blink Lv1 to the right moves the player 64 px on open ground and 64 px through a 16 px wall; if no free spot exists it fizzles and the charge is kept.
28. Riposte Lv1: an enemy hit during the stance deals 0 damage and the counter deals 45 to the attacker; a spike hazard during the stance still deals damage. At Lv5 the counter calls `refundDash()`.
29. Time Slow Lv1: an enemy walking at 100 px/s moves 35 px per second for 3.0 s; the run timer still advances 360 ticks.
30. A Lv1 Thunder Strike bolt deals 25 to a Stage-1 enemy and 25 to a Stage-4 enemy (ability damage never uses stage, grade or match); a Lucky Block in a bolt column does not break.
