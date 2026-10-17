# M4: Classes, Abilities and Weapons (Basics) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the four classes real. The player:
- picks a class and a starting weapon;
- uses abilities on the two ability buttons;
- sees their class change as they carry different abilities;
- gets the **Connection bonus** with two abilities of one class, or a **hybrid** with two different ones;
- tries the new weapons.

This milestone does the **basics**, not everything:
- all **4 classes** and their starting kits;
- **8 abilities** (2 per class) plus **Vampire**;
- **6 new weapons**, so every starting kit works: Katana, Iron Fists, Bow, Crossbow, Storm Hammer (with its throw), Staff. Greatsword and War Maul already exist;
- all **4 bonds**, the **link**, all **6 hybrids**, weapon match.

The other 8 abilities and 11 weapons come later (M9). Loot (grades, chests, Lucky Blocks) is the **next** milestone, M5.

| Class | Ability 1 (starting) | Ability 2 (new in M4) | Starting weapons |
|---|---|---|---|
| Swordsman | Blade Dash | Whirlwind | Greatsword (exists), Katana |
| Tank | Shockwave | Shoulder Charge | War Maul (exists), Iron Fists |
| Archer | Arrow Rain | Hunter's Mark | Bow, Crossbow |
| Wizard | Thunder Strike | Blink | Storm Hammer, Staff |
| Neutral | Vampire (passive) | | |

**Why these second abilities:** each one works with what is already built. Grapple Arrow needs grapple points (Dark Forest). Frost Burst needs Frozen and shatter (elements, M5). The others are fine but less needed for testing.

**Since there is no Home Village or loot yet**, the player gets classes and items in the **Training Yard**: a tutorial level (`docs/levels/training-yard.md`) with 17 stations that teach every move and technique, four class statues at its start, and an armory of item stands and a training dummy at its end. In Stage 1, a kit picker opens before the run.

**Architecture:**
- **Pure core** (no Phaser):
  - `src/core/classes/` holds class state, bonds and hybrids;
  - `src/core/abilities/` holds the ability system and one file per ability;
  - player projectiles, charge weapons and the Storm Hammer throw go in `src/core/combat/`;
  - `ForcedMove` and `teleport()` go in `src/core/player/`.
- **Data:** `src/data/classes.ts`, `src/data/abilities.ts`, and more weapons in `src/data/weapons.ts`.
- **View:** grey-box drawing of ability effects, a simple HUD for ability slots and the class name, the class pick popup, the swap choices.

**Tech Stack:** As before: TypeScript, Phaser 4.2.1, Vitest, Playwright.

**Spec:**
- `docs/spec/03-classes-abilities.md`: everything except the 8 abilities and the parts listed under "Later";
- `docs/spec/02-combat.md`:
  - §1 (hit streak);
  - §6.1 and §6.4 (element level, Lightning chain; Lightning only);
  - §9.4 (charge weapons);
  - §9.8 (projectiles);
  - §10.2–10.5 for the 6 weapons;
  - §11 (Storm Hammer throw);
  - §4.4 (Launch, Pull, Stun, Pin);
- `docs/spec/01-movement.md` §12.3 (`ForcedMove`), §12.4 (`teleport`), `refundDash()`;
- `docs/spec/04-enemies-bosses.md` §2.10 (Training Dummy), §2.4 (notice time, for Thief);
- `docs/spec/05-loot-economy.md` §5.7 (items on the ground, pickup and drop);
- `docs/spec/06-run-levels-save.md` §11 (interact), §12.3 (class statue behavior);
- `docs/spec/07-ui-hud-controls.md`:
  - §4.8–4.10 (weapon and ability slots, class name);
  - §5.5 (charge bar), §5.7 (interact prompts), §5.8 (dummy DPS);
  - §6.2–6.3 (swap choices), §6.7 (class pick).

**Starting point:** M3 and V1 merged into `main`. Merge `main` and the design branch `origin/claude/great-dijkstra-g00pcj` first.

## Scope

**In M4:**
- Class tags for all 19 weapons and all 17 abilities (data only; most aren't playable yet).
- Starting kits and the class pick.
- `computeClassState`, the HUD class name, weapon match (+25%).
- The ability system:
  - 2 slots;
  - the 0.15 s press buffer;
  - activation rules and the state table;
  - cast timing and cancels;
  - cooldowns, charges and recharge rate;
  - fizzles and events;
  - Lv1–5 data (every level row is in the data and tested, even though shops arrive later).
- The 8 abilities and Vampire.
- The link and all 4 bonds.
- All 6 hybrids. Thief's Lockpick is only a hook (`tryLockpick()`), because key chests arrive in M5.
- **Lightning element at level 1 only** (02 §6.4 chain). Storm Caller and Arcane Archer need it. The other elements come with loot.
- The 6 new weapons, player projectiles, charge weapons, Crossbow Pin, Storm Hammer throw and dive bolt.
- `ForcedMove`, `teleport()`, `refundDash()` (if not already there).
- Weapon and ability items on the ground: pickup, swap choice, dropping the old one with its level and charge state.
- The Training Yard tutorial (17 stations, sparring dummy, straw targets), and the Stage 1 kit picker.
- Training Dummy with the DPS readout.
- Simple HUD: weapon slots with class icons, ability slots (cooldown shade, charges, level pips, link glow), class name and bond line.

**Later:**
- The other 8 abilities: Blade Flurry, Riposte, Rage, Boulder Toss, Turret, Grapple Arrow, Frost Burst, Time Slow (M9).
- The other 11 weapons (M9).
- Grades, other elements, perks, chests, Lucky Blocks, shops, selling, upgrading (M5 and M7). In M4, every weapon is **C grade with no element**.
- Cracked walls (Shoulder Charge breaks them once a stage has them).
- Saving `lastKit` and discovered classes to the save file (M7). In M4 they are kept in memory. `classDiscovered` is still emitted.
- Real art for abilities, weapons and class outfits (art chat, later).

## Global Constraints

- All M0–M3 and V1 constraints still hold.
- **All numbers come from 03 and 02.** Ability level rows go in `src/data/abilities.ts` with field names exactly as the 03 §8–§12 table headers. Durations in seconds are converted with `Math.round(s × 120)`.
- **Player ticks vs world ticks** (03 §1): cooldowns, the buffer, the link, stances and player effects count player ticks (not in hit-stop). Ability entities (Arrow Rain zone, Thunder Strike bolts, marks) count world ticks.
- **Ability hits skip grade and match and never scale with the stage** (03 §7.8). They do get the additive pool (link), crits and target multipliers (Hunter's Mark).
- **Class state is a pure function** of the ability slots and weapon slots. It is recomputed the same tick any slot changes.
- **Use the real art when it is on `main`.** If ART4 (player moves, Greatsword and War Maul, `ui` atlas, fonts, effects, sounds) and ART5 (the 6 new weapons, projectiles, ability poses, effects and sounds) are merged, draw with them instead of grey boxes: player anims per 08 §5.2 (this removes V1's idle/run SPEC-GAP), weapon layers and smears per 08 §6.3, HUD icons from the `ui` atlas, text in the `rb_*` fonts. Anything still missing stays a grey box. Loot art (chests, keys, coins, glows) is wired in M5.
- The **M2 tests must keep passing.** When no kit has been picked, the combat test level keeps its M2 loadout (Greatsword + War Maul, no abilities).
- Everything new is visible through `window.__game` with `?debug=1`:
  - `abilityRuntime()` and `classState()`;
  - `setKit(cls, weapon)`, `giveAbility(slot, id, level)`, `giveWeapon(slot, id)`;
  - `spawnDummy(x, y)`.

## Review Focus

1. **Link timing off by one:** gap 360 ticks is linked, 361 is not, and links never chain. Pinned by 03 checklist 6–7.
2. **Cooldown counting during hit-stop:** player ticks in hit-stop must not count. Pinned by 03 checklist 8.
3. **Charges spent on cancelled casts:** a cast cancelled in startup costs nothing. A fizzle costs nothing. Pinned by 03 checklist 16, 24, 27.
4. **Iron Will healing exploit:** swapping a Tank ability in and out must not heal. Pinned by 03 checklist 10.
5. **Ability damage scaling with stage or grade:** it must not. Pinned by 03 checklist 30.
6. **ForcedMove and walls:** Blade Dash and Shoulder Charge stop at walls. Blink passes through a 16 px wall but never through doors (`noTeleport`).
7. **Swap choice traps:** while it is open, the ability buttons pick a slot and never activate. It closes when you walk away or take damage.
8. **Determinism:** the determinism test covers a run that uses every M4 ability and weapon.

## File structure

| Path | What |
|---|---|
| `src/data/classes.ts` | Class tags (weapons, abilities), starting kits, bond and hybrid names and numbers |
| `src/data/abilities.ts` | `AbilityDef` for the 9 M4 abilities, all 5 levels; ids and kinds for all 17 |
| `src/data/weapons.ts` | Add katana, iron_fists, bow, crossbow, storm_hammer, staff |
| `src/data/playerProjectiles.ts` | arrow, arrow_charged, bolt, staff_bolt, orb |
| `src/core/classes/classState.ts` | `computeClassState`, `displayName`, weapon match |
| `src/core/classes/bonds.ts`, `hybrids.ts` | Bond and hybrid effects |
| `src/core/abilities/abilitySystem.ts` | Slots, buffer, activation, casts, cooldowns, link, events |
| `src/core/abilities/<id>.ts` | One file per ability |
| `src/core/abilities/items.ts` | Ability items on the ground, pickup, swap choice |
| `src/core/combat/playerProjectiles.ts` | Player projectiles and explosions |
| `src/core/combat/charge.ts` | Charge weapons (02 §9.4) |
| `src/core/combat/stormHammer.ts` | The throw (02 §11) and the dive bolt |
| `src/core/combat/elements.ts` | Lightning chain (level 1 only for now) |
| `src/core/combat/weaponItems.ts` | Weapon items on the ground, pickup, swap choice |
| `src/core/player/forcedMove.ts`, `teleport.ts` | 01 §12.3–12.4 |
| `src/game/view/abilityView.ts` | Grey-box drawing of ability effects |
| `src/ui/hud/abilityHud.ts`, `src/ui/popups/classPick.ts`, `src/ui/popups/swapChoice.ts` | HUD parts and popups |

If a file in the table already exists under another name, extend that one instead of making a new one.

---

### Task 1: Class tags, kits and ability data

**Files:** `src/data/classes.ts`, `src/data/abilities.ts`, `src/core/abilities/types.ts` (the 03 §14 types), tests next to each.

- [ ] **Write the tests first:**
  - 03 checklist 5: all 19 weapon ids have at least one tag, only `storm_hammer` has two; every ability except `vampire` has exactly one class; there are 17 ability ids.
  - Starting kits match 03 §3.
  - The 9 M4 abilities have 5 level rows each, and spot values match 03: Blade Dash Lv5 damage 82 and 2 charges; Whirlwind Lv3 maxHits 6; Shockwave Lv4 R 84; Shoulder Charge Lv5 stunS 1.0; Arrow Rain Lv5 waves 10; Hunter's Mark Lv3 marks 2; Thunder Strike Lv2 bolts 3 and damage 23; Blink Lv5 96 px and 2 charges; Vampire 20/25/30/40/50 tenths.
  - Cast data matches 03 §7.6 for Shockwave, Arrow Rain and Thunder Strike.
- [ ] **Write the data.** Abilities not in M4 get an id, a name, a class and a kind, but no `AbilityDef` yet (`ABILITIES` is `Partial<Record<AbilityId, AbilityDef>>`, like `WEAPONS`).
- [ ] **Run, commit.**

### Task 2: Class state and weapon match

**Files:** `src/core/classes/classState.ts` + test; wire into the damage formula.

- [ ] **Tests:** 03 checklist 1–4. Also:
  - every one of the 10 pair kinds gives the right `displayName` and `bondName`;
  - a Greatsword hit on a 1000 HP target deals 16 when unmatched and 20 when matched (×1.25, 02 §3.1 step 3);
  - `classChanged` fires only when `displayName`, bond or hybrid changes;
  - `classDiscovered` fires once per bond or hybrid per session.
- [ ] **Implement** `computeClassState(slots, weapons)` (03 §4.1–4.3). The world recomputes it whenever a slot changes (03 §4.4) and keeps it in `world.classState`. Damage step 3 reads `weaponMatched[slot]`.
- [ ] **Commit.**

### Task 3: ForcedMove, teleport, refundDash

**Files:** `src/core/player/forcedMove.ts`, `src/core/player/teleport.ts`, tests.

- [ ] **Tests:**
  - A `ForcedMove { vx: 480, durationS: 0.20, gravity: false, endOnWall: true }` moves exactly 96 px on open ground, stops at a wall, and ends with `clampToRun` speed.
  - `cancelByJump` and `cancelByDash` end it on that tick. Getting knocked back ends it.
  - It does not use or refresh the air dash.
  - The target form (`target`, `speed`, `arriveDist`) arrives and ends.
  - `teleport(64, 0)` on open ground moves 64 px; through a 16 px wall it lands 64 px away; it never crosses a `noTeleport` body (the M3 doors) or leaves the camera bounds; with no free spot it reports failure; after, `vy = 0`, `vx` kept.
  - `refundDash()` resets the dash cooldown and gives the air dash back (01, "refundDash").
- [ ] **Implement** per 01 §12.3–12.4. State `forced` keeps the previous box.
- [ ] **Commit.**

### Task 4: The ability system

**Files:** `src/core/abilities/abilitySystem.ts` + test. Uses a fake test ability of each kind so the rules are tested before real abilities exist.

- [ ] **Tests:**
  - **Buffer:** a press is kept 18 player ticks; a press during hit-stop starts its window after hit-stop.
  - **Activation conditions** (03 §7.4 list 1–5) and the **state table** (03 §7.5), one test per row. For example: `cast` from `wallSlide` turns the player away from the wall; `cast` from `dash` ends the dash first; `hurt` buffers everything.
  - **Cast timing** (03 §7.6): with startup 24, the effect fires on tick T+24 and the player is free on T+24+R; move cap and gravity apply; hover sets `vy = 0`; facing locks.
  - **Cancels:** 03 checklist 16. Getting hurt in startup spends nothing.
  - **Cooldowns and charges** (03 §7.7): an 8 s cooldown takes 960 player ticks; with 2 charges only one recharges at a time; leftover is lost; hit-stop ticks don't count (03 checklist 8, without Storm Caller).
  - **Fizzle** spends nothing and emits `abilityFizzle`. A press with no charge emits `abilityNotReady` once.
  - **Stage start** fills all charges. **Death** clears every ability entity and effect (03 §7.9).
  - A `cast` or `move` activation cancels a weapon attack or a charge (02 §9.2 after-cancel rules), lowers nothing else.
  - Slot 1 is processed before slot 2.
- [ ] **Implement.** Abilities run last in 02 §2.1 step 3. Emit `abilityUsed(slot, id, linked)`; the link itself comes in Task 10, so `linked` is false for now.
- [ ] **Commit.**

### Task 5: Player projectiles and charge weapons

**Files:** `src/data/playerProjectiles.ts`, `src/core/combat/playerProjectiles.ts`, `src/core/combat/charge.ts`, tests.

- [ ] **Tests:**
  - Projectiles spawn at `+12, −18` from the feet; inside a wall they run `onWall` at once (02 §9.8).
  - Each projectile flies at its speed and vanishes at its range (02 §10.4 table: arrow 600/320, arrow_charged 800/480 pierce all, bolt 720/400, staff_bolt 480/280, orb 300/320).
  - The orb explodes on enemy contact or range end; the touched enemy is hit only by the blast (80 × 80).
  - Projectiles track **distance traveled** (Eagle Eye needs it).
  - They are not slowed by the player's hit-stop.
  - **Charge** (02 §9.4): holding past recovery enters Charge; full after `chargeTime` (scaled by attack speed); release at full fires the charged step and resets the combo; release early does the next step; dash, jump, dive, or getting hit loses the charge.
- [ ] **Implement.** Draw projectiles as grey-box rectangles rotated to velocity (V1's projectile drawing if it fits). Add the charge bar (07 §5.5) in its simplest form.
- [ ] **Commit.**

### Task 6: The six new weapons

**Files:** `src/data/weapons.ts`, `src/core/combat/` (specials), tests.

- [ ] **Data** from 02 §10.2–10.4: Katana, Iron Fists, Bow, Crossbow, Storm Hammer (combo), Staff. Weights, holds (`charge` for Katana, Bow, Staff), signature names, dive types.
- [ ] **Tests:**
  - **Katana:** combo steps deal 12, 12, 17; the dash-slash moves exactly 90 px in 18 ticks with gravity off, is invulnerable, and hits each enemy in the swept box once for 40 (02 checklist 31).
  - **Iron Fists:** 4 steps 10, 10, 11, 18; step 4 Launches a small enemy and sets the player's `vy = −300` once per airtime.
  - **Bow:** tap shot 12; charged after 0.45 s, 32, pierces all.
  - **Crossbow:** bolt 29; a target hit with a wall within 24 px behind it is moved flush and **Pinned** 1.5 s (elites 0.75 s, bosses never).
  - **Staff:** bolt 13; charged orb after 0.50 s, blast 40.
  - **Storm Hammer** combo 22, 25 (both heavy). Its dive adds a lightning bolt 0.10 s after landing: 24 damage, box `0, −80, 32, 160`.
- [ ] **Implement.** Pin is a control effect (02 §4.4): the enemy can't act or move while pinned.
- [ ] **Commit.**

### Task 7: Storm Hammer throw

**Files:** `src/core/combat/stormHammer.ts` + test.

- [ ] **Tests:** 02 checklist 25–26:
  - Up + button throws; out 520 px/s, turns back at 0.30 s, on a wall, or on recall; returns at 600 px/s through terrain; caught within 16 px, or automatically after 2.0 s.
  - Each enemy is hit at most once out and once back, for 18, heavy, kind `shot`.
  - While out: no swing; any press recalls; Down + button in the air recalls and does not dive.
  - Recharge: 5.0 s, or 2.0 s while carrying a Wizard ability (checked every tick).
  - Leaving the slot, dying, or stage end removes the hammer and makes the throw ready.
- [ ] **Implement. Commit.**

### Task 8: Abilities, part 1 (Swordsman and Tank)

**Files:** `src/core/abilities/blade_dash.ts`, `whirlwind.ts`, `shockwave.ts`, `shoulder_charge.ts`, tests.

- [ ] **Tests:**
  - 03 checklist 17 (Blade Dash), 18 (Whirlwind), 20 (Shockwave);
  - 03 checklist 19 without the cracked wall: Shoulder Charge Lv1 moves 96 px in 32 ticks with super armor; against a large enemy (Brute) it stops on the hit tick with `vx = 0`; a small enemy is knocked aside and the charge goes on;
  - Whirlwind Lv5 Pulls small and medium enemies within 64 px at 120 px/s;
  - Shoulder Charge Lv5 Stuns 1.0 s;
  - Blade Dash and Shoulder Charge count as Rush `dashAttack` (02 §8.2).
- [ ] **Implement** per 03 §8.1, §8.2, §9.1, §9.2. Add an empty hook `breakCrackedWalls()`. It does nothing until a stage has cracked walls (06); later stages only fill it in.
- [ ] **Commit.**

### Task 9: Abilities, part 2 (Archer, Wizard, Vampire)

**Files:** `arrow_rain.ts`, `hunters_mark.ts`, `thunder_strike.ts`, `blink.ts`, `vampire.ts`, tests.

- [ ] **Tests:**
  - 03 checklist 21 (Arrow Rain), 24 (Hunter's Mark), 25 (Thunder Strike), 27 (Blink), 30 (ability damage never scales).
  - 03 checklist 12, first sentence only (Vampire tenths per level). The Scythe and Bloodthirst parts come with those items.
  - Thunder Strike with no enemies strikes empty columns at `x + f × (48 + 32k)`.
  - Hunter's Mark: casting again clears old marks; marks end on death or after their duration.
  - Blink: diagonal uses `round(d × 0.7071)`; displacement under 8 px fizzles; 0.15 s of ability i-frames after.
- [ ] **Implement** per 03 §10.1, §10.4, §11.1, §11.3, §12.
- [ ] **Commit.**

### Task 10: The link and the four bonds

**Files:** `src/core/classes/bonds.ts`, link logic in `abilitySystem.ts`, `src/core/combat/elements.ts`, tests.

- [ ] **Hit streak and Lightning first** (if not already there):
  - 02 §1 hit streak (what counts, the 2.0 s timeout, reset when you take damage);
  - 02 §6.1 element level and §6.4 Lightning chain, **level 1 only** (02 checklist 22).
- [ ] **Tests:**
  - **Link:** 03 checklist 6 and 7. Same-tick activation: slot 2 is linked. The link clears when the Connection is lost, at stage start and at death. Non-damage values ×1.5: Blink Lv1 linked goes 96 px; Hunter's Mark linked is ×1.45; Shoulder Charge Lv5 linked Stun 1.5 s.
  - **Blademaster:** 03 checklist 11.
  - **Iron Will:** 03 checklist 10; super armor while attacking or casting; heavy stagger 1.6 s.
  - **Eagle Eye:** a Bow arrow that has traveled 130 px always crits, one at 100 px doesn't; slow fall at 60 px/s while aiming in the air, budget 120 ticks, refilled on landing.
  - **Storm Caller:** 03 checklist 8 (768 ticks); a C-grade weapon with no element gets Lightning 1; the chain % is ×1.25.
- [ ] **Implement** per 03 §5. The link glow data (`linkTicksLeft`) goes into the world state for the HUD.
- [ ] **Commit.**

### Task 11: The six hybrids

**Files:** `src/core/classes/hybrids.ts` + test.

- [ ] **Tests:**
  - **Thief:** +20% speed; enemies take twice as long to notice you; a hit on an unaware enemy crits. `tryLockpick()` works once per stage while Thief and returns false after (M5's key chests will call it).
  - **Gladiator:** the two examples in 03 §6.2; the +0.50 bonus has a 180-tick internal cooldown.
  - **Spellblade:** 03 checklist 9.
  - **Warden:** a melee hit primes the next shot (+0.50), a shot hit primes the next landing melee hit; whiffs don't consume the melee prime.
  - **Thunderlord:** a heavy hit calls a bolt 12 ticks later for 50% of the hit's base damage; at most 3 per attack instance; bolts never call bolts.
  - **Arcane Archer:** Bow and Crossbow arrows get Lightning 1; a charged Bow arrow explodes once (64 × 64, 50% damage); the Staff orb blast is 120 × 120.
  - All primes and timers clear at stage start, death, and when the hybrid ends.
- [ ] **Implement** per 03 §6. **Commit.**

### Task 12: Items on the ground and swap choices

**Files:** `src/core/abilities/items.ts`, `src/core/combat/weaponItems.ts`, `src/ui/popups/swapChoice.ts`, tests.

- [ ] **Tests:**
  - 03 checklist 13 (new items are Lv1 with full charges), 14 (a dropped ability keeps its level and keeps recharging), 15 (same id swaps directly).
  - Ability pickup is refused during a cast or an ability `ForcedMove`.
  - With both slots full the swap choice opens; the ability buttons pick the slot and never activate; it closes on interact, walking away, or taking damage (03 §7.1, 07 §6.2–6.3).
  - Weapon pickup works the same with the attack buttons, and is refused while attacking (02 §9.5).
  - Only one swap choice is open at a time.
  - The class state recomputes on the swap tick.
- [ ] **Implement** with 06 §11.1 interact targeting and 05 §5.7 drop and rest rules. Item stands in M4 are **endless**: taking an item leaves a copy, so the user can try everything. Mark it `// SPEC-GAP: M4 armory stands never run out (test only)`. This is the design chat's choice, so it doesn't go in `SPEC-GAPS.md`.
- [ ] **Commit.**

### Task 13: Class pick, armory and dummies

**Files:** `src/ui/popups/classPick.ts`, the Stage 1 scene, the dummies (`src/data/enemies.ts`, `src/core/enemies/`), tests.

- [ ] **Parts for the Training Yard** (placed in Task 14; until then test them in the combat test level):
  - **4 class statue markers** (grey boxes with the class letter). Interact opens the class pick (07 §6.7) with that class's 2 starting weapons. Confirm equips the kit at once (03 §3: ability slot 1 Lv1, slot 2 empty, weapon slot 1 at C, slot 2 empty).
  - **Armory:** a row of endless stands with each M4 ability (Lv1) and each of the 8 weapons, grouped by class with a class-colored label.
  - **Training Dummy** (04 §2.10) with the DPS readout (07 §5.8), **Sparring Dummy** (04 §2.11) and **Straw Target** (04 §2.12).
  - **Dummy art:** the enemy view must accept an enemy that has only `idle` and `hit` anims (the dummy: play `hit` when struck, never stagger or die) and load the `enemies_extra` atlas. The art is already built; the art chat left `training_dummy_idle` and `training_dummy_hit` out of `anims.json` until the view handles them (`docs/art/SPEC-GAPS-art.md` #3). When this works, tell the user so the art chat can add the two lines back.
- [ ] **Stage 1:** before the run starts, the same class pick panel opens with all 4 classes (left/right picks the class, up/down the weapon). The pick is kept for instant restart. `?kit=archer:bow` skips the panel (tests use it).
- [ ] **Tests:** the kit equips the right items; restart keeps the kit; the dummy never dies and its HP returns 1.0 s after the last hit; the DPS formula; the sparring dummy swings every 2.0 s with a 0.6 s Tele and deals 0 damage; a straw target breaks in 1 hit, gives +15 Rush and no gold, and respawns after 3.0 s.
- [ ] **Commit.**

### Task 14: The Training Yard

**Files:** `levels-src/training_yard/`, `public/levels/training_yard.json` (generated), `src/core/run/training.ts` + test, scene support.

Design: `docs/levels/training-yard.md`. Rules: `docs/spec/06-run-levels-save.md` §12.4.

- [ ] **Build the level** from the doc: 17 stations in 3 parts, the statues at the start, the checklist board, armory and training dummy at the end, an exit at both ends. Add `station`, `checkpoint` and `respawn` objects to the level format and `validateLevel` (a `training` level needs stations 1–17, each with a checkpoint and a hint).
- [ ] **Station checks** (pure core, one test each): each station's "done when" rule from the doc, reading core events (for example station 3 = crossed the gap with an air dash; station 11 = 3 sparring swings dodged by dash i-frames in a row, reset when hit; station 13 = an `abilityLinked`; station 14 = Rush level ≥ 1; station 17 = 3 dive bounces without touching the pit).
- [ ] **Rules:** no run timer; HP never drops below 1; pits fade 0.3 s and return you to the checkpoint with a full flask; Rush resets at checkpoints; leaving resets the loadout to the picked kit.
- [ ] **View:** signs drawn as hint text with key names (M1 key names), check flags (grey → green with `ui_confirm`), the checklist board. Use ART4/ART5 art where it exists (`guide_arrow`, training dummy, fonts); the sparring dummy and straw target get art in ART5.
- [ ] **Commit.**

### Task 15: The full HUD, popups and ability visuals

**Files:** `src/ui/hud/` (one file per HUD part), `src/ui/popups/` (`itemCard.ts`, `swapChoice.ts`, `classPick.ts`, `pause.ts`), `src/game/view/abilityView.ts`, tests for the pure parts (`src/ui/model/`).

This is the **real HUD** from 07 §4, not a debug one. Playtesters asked for a clear health bar and visible slots, flask and gold. Use the `ui` atlas and `rb_*` fonts from ART4/ART5; anything not yet drawn uses 07 §1.1's placeholder rectangles.

- [ ] **Tests first** (pure `HudModel`, 07 §4.15): 07 checklist 1 (HP fill 50/100 → 79 px, 100/100 → 158 px), the Rush segment widths, the flask fill width, the cooldown shade height and seconds, the link bar width, `displayName` lines.
- [ ] **HUD** (positions exactly 07 §4.1):
  - the two **HUD plates** behind the top-left and bottom-left groups;
  - **heart + big HP bar** (160 × 12) with the lag, heal flash and low-HP pulse (07 §4.2), and the HP text;
  - **Rush** 3 segments (§4.4), **flask** charge icons and fill bar (§4.5), **gold** and **keys** (§4.6; keys show 0 until M5), status icons (§4.3);
  - **weapon slots** with grade frame, icon, class icons lit when matched, Storm Hammer recharge bar (§4.8);
  - **ability slots**: class-colored frame, icon, cooldown shade and seconds, charges, level pips, the link glow and bar, flashes on `abilityUsed`, `abilityNotReady`, `abilityFizzle` with `No target` / `Blocked` (§4.9);
  - **class name** and the bond or hybrid line, toast on `classDiscovered` (§4.10);
  - the run timer block (§4.11; keep M3's split popup working).
- [ ] **Popups** with the popup skin (`panel_9`, buttons, cursor; 07 §3.4):
  - **item card** for ground items and stands (07 §6.1): shows what you'd get, `→ <class after>`, and the `[U]`/`[I]` slot choice. This is **how the player chooses abilities**: walk to an ability, read the card, press the slot to replace;
  - weapon and ability **swap choices** (07 §6.2–6.3);
  - **class pick** (07 §6.7);
  - **pause with tabs** `MENU`, `LOADOUT`, `CONTROLS` (07 §7.6), with the bond and hybrid blurbs (07 §9.2).
- [ ] **Ability visuals:** ART5's effects where they exist, otherwise grey boxes in class colors: dash trails, the Whirlwind spin, the Shockwave flash, the Arrow Rain zone with falling arrows, Thunder Strike columns, the mark over marked enemies, a Blink puff at both ends, Lightning chain lines.
- [ ] **E2E screenshots** of the HUD over the Plains and over the village background, the item card with both slots full, and the `LOADOUT` tab. **Read them.**
- [ ] **Commit.**

### Task 16: E2E, review, hand-off

- [ ] **E2E** `tests/e2e/classes.spec.ts`:
  - The Training Yard loads (`?start=training`); pick each class at its statue and screenshot the HUD (`test-results/class-<cls>.png`).
  - Complete stations 1, 3, 4, 8, 11 and 14 with scripted inputs and assert `stationDone` for each; screenshot each part (`test-results/yard-a.png`, `yard-b.png`, `yard-c.png`).
  - Take a second ability of the same class from the armory and assert `connection` is true and the bond name is shown; screenshot.
  - Take one of another class and assert the hybrid name; screenshot.
  - Use each M4 ability next to the dummy and screenshot mid-effect (`test-results/ability-<id>.png`).
  - Throw the Storm Hammer; screenshot.
  - Stage 1 with `?kit=wizard:staff` boots and Thunder Strike hits a wolf.
- [ ] **Determinism:** extend the determinism test with a scripted input run that uses every M4 ability and weapon.
- [ ] **Run everything:** `npm run typecheck && npm test && npm run build && npm run test:e2e`. **Read every screenshot.** Push to `main`; check that the site deploys.
- [ ] **Hand-off to the user:**
  - Send screenshots and the link.
  - Tell them in plain words: "Classes work now, and there is a Training Yard that teaches every move. Pick a class at a statue, go through the stations, then try other abilities and weapons in the armory at the end. Stage 1 asks you to pick a class first."
  - Ask them:
    - Which class feels best? Which feels weakest?
    - Do the abilities feel strong enough? Are cooldowns too long or too short?
    - Do the Connection bonus and the link feel worth it compared with hybrids?
    - Is the Storm Hammer throw fun?
  - Mention any SPEC-GAPs.

---

## Done when

- All tasks are checked. `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e` pass.
- Spec checklist items with passing tests:
  - **03:** 1–11, 12 (Vampire part), 13–18, 19 (no cracked wall), 20, 21, 24, 25, 27, 30.
  - **02:** 22, 25, 26, 31.
- The user has tried the four classes and given feedback.

**Next plan:** `M5-loot.md`. Grades and elements, free loot stands, Lucky Blocks, keys and key chests (with Thief's Lockpick), the cursed chest, the timed chest, coins, the boss weapon drop, and the wandering merchant's items. Written by the design chat after M4.
