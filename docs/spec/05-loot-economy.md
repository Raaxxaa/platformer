# 05 — Loot and Economy

**This file owns:** grade odds for every source at every stage, how a dropped item is built (weapon type, class lean, element, A-grade perk, S-grade name), ability drops, chest kinds and contents, the Lucky Block (every buff and debuff), the cursed chest and curses, keys, gold (storage, kill-gold formula, coins, per-stage budget), village shop stock and services, every price, rerolls, selling, the wandering merchant, the 12 stat upgrades, blueprints and unlocks.

**Only referenced here:**
- `01-movement.md`: `MoveModifiers` (`speedPercents`, `canDoubleJump`, `dashCooldownMult`), gravity, camera bounds.
- `02-combat.md`: damage formula and its hooks (step-4 bonus pool, `critChance`, attack-speed bonuses, incoming multipliers), Burn, element levels per grade (§6.1), signature moves (§13), flask fill formula and `addFlaskFill`, Rush levels and the Rush gold factor (§8.3), kill credit and on-kill order (§3.4–3.5), `WeaponInstance`.
- `03-classes-abilities.md`: class tags of every weapon and ability, ability ids and data, Storm Caller and Arcane Archer elements, the Thief's Lockpick charges, ability cooldown rules.
- `04-enemies-bosses.md`: per-enemy gold, which elites drop a key or ability, boss gold, enemy spawn-in, `enemySpeedMult`.
- `06-run-levels-save.md`: level objects (where chests, keys, Lucky Blocks, merchant spots and shop stands are), timed-door limits, `deriveSeed`, typed seeds, practice mode, the `enterVillage` event, save data.
- `07-ui-hud-controls.md`: every popup and label (swap popup, price tags, Lucky Block text, curse counter, stat pick screen).
- `07-ui-hud-controls.md` §3.2: grade colors. `08-art-audio.md`: chest and coin sprites, sounds.

Numbers live in `src/data/loot.ts` (odds, perks, names, Lucky Block, curses, Ambush packs) and `src/data/economy.ts` (prices, chest gold, stat upgrades, blueprints). Logic lives in `src/core/loot/` and `src/core/economy/`. No Phaser imports.

## 1. Terms

| Term | Meaning |
|---|---|
| Stage index | 1–4. Both Stage 2 roads are stage 2. |
| `levelId` | The level's id from 06. Assumed: `plains`, `mountains`, `swamps`, `kingdom`, `castle`. |
| Source | Anything that creates an item: a free loot spot, a chest, a boss, an elite, a Lucky Block, a shop or the merchant. |
| `carriedClasses` | 03's list of the distinct classes of the carried abilities, read at roll time. Vampire adds nothing. Can be empty. |
| Stage end | 06's `enterVillage` event (arriving at the next village), or the run ending (win or death). |
| Weighted pick | See §2.2. |
| Shown gold | `floor(goldTenths / 10)` (§9.1). |

## 2. Randomness

### 2.1 One generator per source
- Every roll in this file uses a **fresh generator per source**: `mulberry32(deriveSeed(runSeed, stream, ...keys))`. `deriveSeed` is the shared helper (06). 04 uses the same helper for `enemyDrops`.
- So opening chests in a different order never changes what is inside them. **Same seed + same player state at roll time = same item.**

| What | Stream | Keys | When it rolls |
|---|---|---|---|
| Free loot spot | `loot` | levelId, objectId | Stage load |
| Key chest, cursed chest, timed chest | `loot` | levelId, objectId | When opened |
| Boss loot | `loot` | levelId, bossId | On the kill |
| Elite ability drop | `loot` | levelId, `'elite'`, spawnId | On the kill |
| Lucky Block result | `lucky` | levelId, objectId | When broken |
| Lucky Block Jackpot weapon | `loot` | levelId, objectId | When broken |
| Village shop stock | `shop` | villageIndex (1 Crossroads, 2 Border, 3 Rebel Camp), rerollCount | On entering the village, and on each reroll |
| Wandering merchant | `shop` | `'merchant'`, levelId | Stage load |
| Stat upgrade offer | `statPick` | stageIndex | When the pick screen opens |
| Blueprint roll | `blueprint` | levelId, sourceId (spawnId or bossId) | On the kill |


### 2.2 Weighted pick
```
pick(weights in order F, C, B, A, S  — or any listed order):
  total = sum(weights); r = rng() * total
  for each entry in order: if (r < w) return entry; r -= w
  return the last entry with w > 0
```
Weights of 0 are never picked. Uniform pick from a list: `list[floor(rng() * list.length)]`.

## 3. Grade odds

All rows are percentages and sum to 100. They are used as weights.

### 3.1 Free loot (fixed by the plan)

| Stage | F | C | B | A | S |
|---|---|---|---|---|---|
| 1 Plains & Forest | 50 | 35 | 10 | 4 | 1 |
| 2 Mountains / Dark Forest | 30 | 38 | 20 | 9 | 3 |
| 3 Enemy Kingdom | 12 | 32 | 33 | 18 | 5 |
| 4 King's Castle | 0 | 15 | 37 | 36 | 12 |

### 3.2 Key chest, Guardian, timed chest (Stage 1 fixed by the plan)

| Stage | F | C | B | A | S |
|---|---|---|---|---|---|
| 1 | 35 | 38 | 18 | 7 | 2 |
| 2 | 15 | 41 | 28 | 12 | 4 |
| 3 | 0 | 32 | 41 | 21 | 6 |
| 4 | 0 | 3 | 45 | 39 | 13 |

### 3.3 Cursed chest (Stage 1 fixed by the plan)

| Stage | F | C | B | A | S |
|---|---|---|---|---|---|
| 1 | 0 | 20 | 50 | 25 | 5 |
| 2 | 0 | 3 | 60 | 30 | 7 |
| 3 | 0 | 0 | 52 | 39 | 9 |
| 4 | 0 | 0 | 27 | 57 | 16 |

### 3.4 How Stages 2–4 were derived ("moves up the same way free loot does")
For stage N and each grade g: `v[g] = stage1Row[g] + (free[N][g] − free[1][g])`. Then sweep F → C → B → A: if `v[g] < 0`, add `v[g]` to the next grade up and set `v[g] = 0`. The tables above are the result. They are stored as data, not computed at runtime. A unit test re-derives them, so if free loot is retuned the test says which rows to update.

### 3.5 Fixed-odds sources (same at every stage)

| Source | F | C | B | A | S | Notes |
|---|---|---|---|---|---|---|
| Dragon | 0 | 0 | 0 | 75 | 25 | Element is forced to the Dragon's (§4.3) |
| Lucky Block Jackpot | 0 | 0 | 0 | 85 | 15 | |
| Black Knight | 0 | 0 | 60 | 31 | 9 | Stage-3 key-chest row with F and C removed ("B or better"), renormalized to 100 (41 / 21 / 6 → 60 / 31 / 9) |

### 3.6 Which table each source uses

| Source | Table |
|---|---|
| Free loot spot | Free loot, its own stage |
| Key chest (both items) | Key chest, its own stage |
| Guardian (Stage 1 or 2) | Key chest, its own stage |
| Timed chest | Key chest, its own stage |
| Cursed chest | Cursed, its own stage |
| Black Knight, Dragon, Jackpot | §3.5 |
| Village shop, guaranteed slot | Free loot of the **next** stage with F and C set to 0 (§10.1) |
| Village shop, other slots | Free loot of the **next** stage (interpretation of "that stage's odds": the stage you are about to enter) |
| Wandering merchant | Cursed, the stage he is in |

## 4. Building an item

### 4.1 Weapon roll — exact draw order
Every weapon roll makes these 5 draws, in this order, **always all 5** (unused ones are discarded) so the sequence never shifts:
1. `grade = pick(table)`
2. `rLean = rng()`
3. `rType = rng()`
4. `element = pick(elementWeights(weaponId))`
5. `rPerk = rng()`

### 4.2 Weapon type and class lean
- **Pool:** the unlocked weapons (§14), in the `WeaponId` order of 02 §14, minus any ids the caller excludes (duplicate protection in key chests and shops).
- **Lean set:** pool weapons with any class tag (03) in `carriedClasses`. The Storm Hammer (`['tank', 'wizard']`) counts for both.
- If `carriedClasses` is non-empty, the lean set is non-empty, and `rLean < 0.35`: `list = lean set`. Otherwise `list = pool`.
- `weaponId = list[floor(rType × list.length)]`.
- Result: with one class carried, about half of weapon drops match (Swordsman: 0.35 + 0.65 × 5/19 = 52%).

### 4.3 Element
- Element weights, order fire, ice, lightning, poison, wind: **20 each**. Storm Hammer: fire 15, ice 15, **lightning 40**, poison 15, wind 15.
- **B, A, S:** `element` = the drawn element. Its level comes from the grade (02 §6.1: B 1, A 2, S 3). S grade therefore always has an element.
- **Dragon loot:** `element` = the Dragon's (Red fire, White ice, Storm lightning, Green poison). The draw still happens and is discarded.
- **F, C:** `element = null`; the draw is discarded. Storm Caller and Arcane Archer give such weapons Lightning level 1 while active (03 §5.5, §6.6); that is not stored on the item.
- An item's grade, element and perk never change after it is created.

### 4.4 A-grade perk pool
A and S weapons get `perk = PERKS[floor(rPerk × 8)]`. F, C and B weapons have `perk = null`. Each perk has one value, the same at A and S.

| id | Name | Effect | Applies to |
|---|---|---|---|
| `quick` | Quick | **+15%** attack-speed bonus (02 §9.9) | This weapon's attacks |
| `keen` | Keen | **+12%** `critChance` (02 §3.2) | This weapon's direct hits |
| `brutal` | Brutal | **+15%** in the step-4 bonus pool (02 §3.1) | This weapon's direct hits |
| `finisher` | Finisher | **+40%** in the step-4 bonus pool if, before the hit, the target's HP ≤ 30% of its max HP | This weapon's direct hits |
| `leeching` | Leeching | Heal **1 HP per 40 damage** dealt (see below) | This weapon's direct hits |
| `fleet` | Fleet | **+8%** move speed (adds `+0.08` to 01's `speedPercents`) | While in either weapon slot |
| `sturdy` | Sturdy | Incoming damage **×0.90** (02 §3.3 incoming multiplier) | While in either weapon slot |
| `greedy` | Greedy | **+50%** kill gold (§9.3) | Kills whose killing source is this weapon |

- "This weapon's direct hits" includes its projectiles, dives and signature effects (02). Secondary damage is never a direct hit, but Brutal and Finisher still raise it through procBase (02 §3.1).
- **Leeching:** each weapon instance keeps an integer `leechBank`. After each direct hit by this weapon, add the final rounded damage. While `leechBank ≥ 40`: heal 1 HP (capped at max HP) and subtract 40. The bank resets to 0 when the weapon leaves the player's slots.
- Two carried weapons with the same "while carried" perk both apply: Fleet + Fleet = +16%, Sturdy + Sturdy = ×0.81.
- `critChance` stays capped at 1.0 (02).

### 4.5 Item names
- **F, C:** the weapon name, e.g. "Katana".
- **B, A:** `<Element> <Weapon>`, element words Fire, Ice, Lightning, Poison, Wind. Example: "Wind Spear". 07 shows an A or S perk name as a second line.
- **S:** one word = element prefix + weapon suffix, only the first letter capitalized.

| Element | fire | ice | lightning | poison | wind |
|---|---|---|---|---|---|
| Prefix | Sun | Frost | Sky | Venom | Gale |

| Weapon | Suffix | Weapon | Suffix | Weapon | Suffix |
|---|---|---|---|---|---|
| Greatsword | breaker | Giant Axe | cleaver | Javelin | lance |
| Katana | fang | Flail | star | Throwing Knives | shard |
| Twin Daggers | sting | Shield | ward | Storm Hammer | splitter |
| Spear | piercer | Bow | bow | Staff | spire |
| Scythe | reaper | Crossbow | bolt | Wand | spark |
| War Maul | quake | Hand Cannon | roar | Spell Tome | rune |
| Iron Fists | fist | | | | |

Examples: fire Greatsword = **Sunbreaker**, lightning Storm Hammer = **Skysplitter**, wind Bow = **Galebow**.

### 4.6 Ability roll
Abilities have no grade. Draws, always both: `rLean = rng()`, then `rType = rng()`.
- **Pool:** unlocked abilities (§14) in 03's `AbilityId` order, minus the abilities the player carries, minus caller exclusions.
- **Lean set:** pool abilities whose class is in `carriedClasses`. Vampire is never in the lean set.
- Same rule as §4.2 with 0.35. Result: a new 03 `AbilitySlot` `{ id, level: 1, charges: full, rechargeLeft: 0 }`. Every newly generated ability is **Lv1** (03 §7.1; assumption, GAME_PLAN 15.3 #3–#4).
- If the pool is empty (cannot happen with the default unlocks), the source gives a weapon from its own table instead.

### 4.7 Starting weapon
The chosen starting weapon is `{ grade: 'C', element: null, perk: null }`. No draws are made.

## 5. Loot sources

### 5.1 Free loot spot
- 06 object with property `kind: 'weapon' | 'ability' | 'any'`. It shows its item on a stand (or in an open chest) from the start, so it rolls at **stage load**, using the abilities carried at that moment.
- `'any'`: first draw `rng() < 0.35` → ability, else weapon. Then the item draws.
- It gives no gold.

### 5.2 Key chest
1. Press interact while overlapping the chest. **The Thief's Lockpick is used first** if 03 §6.1 says it is available (Thief active, not used this stage); otherwise 1 key is used. With neither, nothing happens (07 shows a lock prompt).
2. +**40 gold** at once.
3. Item A = weapon roll (key table). Then `rng() < 0.50` → item B = ability roll; else item B = weapon roll excluding item A's `weaponId`.
4. Item A pops out at chest x − 16, item B at chest x + 16 (§5.7).
5. Taking either item makes the other vanish at once. The choice is final. If neither is taken, both stay until stage end.

### 5.3 Cursed chest
No key needed. A single interact press opens it at once (no confirm). It gives **100 gold**, 1 weapon roll (cursed table) at chest x, and the curse (§8).

### 5.4 Timed chest
Sits behind a timed door (06 sets the limits). Interact opens it: **80 gold** and 1 weapon roll (key table).

### 5.5 Boss loot
04 lists what each boss drops and its gold. The rolls: weapon first, then the ability (if any), from the same generator.

| Boss | Weapon table | Extra |
|---|---|---|
| Guardian (Great Boar, Stone Colossus, Spider Queen) | Key chest, its stage | — |
| Black Knight | §3.5 Black Knight | 1 ability roll |
| Dragon | §3.5 Dragon, forced element | — |
| Enemy King | none (run ends) | — |

### 5.6 Elite drops
04 decides if an elite drops a key, an ability or nothing. An ability drop uses §4.6 on its own generator (§2.1). Regular mobs never drop items.

### 5.7 Items on the ground and picking up
- Every item that pops out becomes a **ground item**: it spawns at its point, falls (gravity 1500 px/s², max 400 px/s) and rests on solid tiles or one-way tops. Pickup box 16 × 16.
- Ground items **never despawn** during the stage. All of them are removed at stage end. In a village they are removed when the player leaves.
- **Weapons:** interact while overlapping (if several overlap: nearest center, then lowest id). If a weapon slot is empty, it goes there (slot 1 first). If both are full, 07's swap popup asks which slot to replace; the replaced weapon drops at the player's feet as a ground item with its grade, element and perk. Cancelling the popup takes nothing. Pickup is refused while attacking (02 §9.5).
- **Abilities:** pickup, same-id swap, empty-slot fill and the swap choice follow 03 §7.1. A replaced ability drops here as a ground item with its level and charge state.
- **Keys, blueprints and coins** are collected by touch, with no button.
- While Butterfingers is active, slot 2 can't be filled or replaced, and an empty slot 2 counts as full and locked for the rule above (§7.3, 07 §6.2).

## 6. Keys
- Start of run: **0 keys**. Max carried: **3**. Keys carry over between stages and are lost at death.
- Sources: 2 placed per stage (06), elite drops (04), the shop (§10).
- **At 3 keys, a key is not collected**: it stays on the ground (07 shows "Keys full"). A key an elite drops at the cap still drops and stays. Keys left on the ground at stage end are lost.
- 1 key opens 1 key chest. Nothing else uses keys (cursed and timed chests are free).

## 7. Lucky Block

### 7.1 The roll
- A Lucky Block breaks on any weapon direct hit (02), including dives and a thrown Storm Hammer. It gives no gold, no Rush and no flask fill. It never respawns.
- Draw 1: `rng() < buffChance` → buff, else debuff. `buffChance` = **0.55** (assumption, GAME_PLAN 15.3 #8), or **0.70** with Lucky Charm (§13).
- Draw 2: weighted pick among the **eligible** entries. Eligible buffs = every buff not active right now (Jackpot is always eligible). Eligible debuffs = all 7.
- The effect starts on the same tick. 07 shows the name in big text.
- Two blocks broken on the same tick resolve in ascending object id, so the second sees the first one's buff as active.
- Overall odds at 55%: each normal buff 8.25%, **Jackpot 5.5%**, each debuff ≈ 6.43%.

### 7.2 Buffs (last until stage end)

| id | Name | Weight | Exact effect |
|---|---|---|---|
| `swift` | Swift | 15 | +0.25 in 01's `speedPercents` |
| `golden_touch` | Golden Touch | 15 | Kill gold ×2 (§9.3). Chest and sell gold are unchanged |
| `firestarter` | Firestarter | 15 | Every direct hit from the player's weapons **and abilities** applies Burn at **level 1** (02 §6.2). A fire weapon's own burn uses the higher value (02) |
| `second_wind` | Second Wind | 15 | Once: when 02 §5.2 step 6 finds HP ≤ 0, set HP = `round(0.5 × maxHP)`, remove Burning and Poisoned, grant **2.0 s** of invulnerability instead of the 0.8 s hurt i-frames, then continue with the later steps that the source runs (02 §5.2 table). The buff is then used up |
| `overdrive` | Overdrive | 15 | Rush value = max(value, 200) at once, and the floor is 200 (02 §8.1) |
| `bloodrush` | Bloodrush | 15 | Flask fill per kill ×2 (02 §7.3) |
| `jackpot` | Jackpot | 10 | Instant: a weapon roll on the Jackpot table pops out at the block |

### 7.3 Debuffs (last 45.0 s = 5400 ticks, except Ambush)

| id | Name | Weight | Exact effect |
|---|---|---|---|
| `heavy` | Heavy | 1 | −0.20 in 01's `speedPercents` |
| `glass_bones` | Glass Bones | 1 | Incoming damage ×2 (02 §3.3 incoming multiplier) |
| `leaky_pockets` | Leaky Pockets | 1 | On 02's Leaky Pockets hook (§5.2 step 10): drop gold as coins (§9.4) |
| `ambush` | Ambush | 1 | Instant: spawns the biome's pack around the player (§7.5) |
| `jammed` | Jammed | 1 | `dashCooldownMult` × 2 (01) |
| `dry_flask` | Dry Flask | 1 | The flask can't be drunk (02 §7.2). A drink already started finishes. Fill still builds |
| `butterfingers` | Butterfingers | 1 | Weapon slot 2 is locked: presses and dives with it are ignored, a charge or block on it is cancelled, an attack step already running finishes, a thrown Storm Hammer still returns and is caught. Slot 2 can't be filled or replaced. If slot 2 is empty it stays empty and counts as locked: with slot 1 full, a weapon pickup or purchase opens 07's swap choice with slot 1 as the only option (07 §6.2); with slot 1 empty the item goes to slot 1 |

### 7.4 Timing and stacking
- Debuff timers count down on every tick of phase `stage`, including hit-stop. They do not count in `statPick`, `routeChoice`, `transition`, `paused` or menus (06 §2.1: the world is frozen or stopped there). Debuffs never reach a `village`: they end at stage end. Rolling a debuff that is already active resets it to 45.0 s.
- All buffs and debuffs end at stage end and at death. Unused Second Wind is lost at stage end.
- Opposite effects simply add: Swift + Heavy = +0.05 move speed. Glass Bones × block 0.25 = ×0.5.

### 7.5 Ambush packs
The pack spawns on the break tick using 04's 0.5 s spawn-in (aware, current-stage scaling). Its enemies give normal rewards (gold, flask, Rush, curse kills).

| levelId | Pack, in spawn order |
|---|---|
| `plains` | wolf, wolf, bandit |
| `mountains` | goblin_miner, ram, bat_swarm |
| `swamps` | bog_zombie (already risen), giant_spider (on the ground, not hanging), swamp_witch |
| `kingdom` | war_hound, war_hound, soldier |
| `castle` | royal_guard, living_armor, gargoyle (awake, not in stone form) |

**Placement**, enemy i of the pack uses x offset `[−96, +96, +160][i]` from the player's x, clamped to 16 px inside the camera bounds (01):
- **Ground enemy:** from `y = playerFeetY − 64` down to `playerFeetY + 128`, 1 px at a time, find the first y where the enemy's hurtbox (feet at y) overlaps no solid tile and the pixel under its feet is solid or a one-way top. If none, try the mirrored offset. If still none, skip that enemy.
- **Flyer** (bat_swarm, gargoyle): at `(x, playerY − 72)`; if inside a solid, at `playerY − 32`; if still inside, skip.

## 8. Curses
- Opening a cursed chest applies `curse = { id, killsLeft: 10 }` on that tick.
- **v1 curse is always `one_hit`.** The extra curses exist behind the tuning flag `EXTRA_CURSES` (default **false**; the plan says "for variety later"). When true, the chest's generator makes one more draw after the weapon roll: `one_hit` 40, `no_heal` 20, `heavy_feet` 20, `hunted` 20.
- Each **player kill** (02 §3.4) of a regular, elite or boss lowers `killsLeft` by 1. Deaths that give no rewards (04: summons, a self-exploding Wisp, Living Armor's first collapse) don't count. At 0 the curse is lifted (07 shows "Curse lifted").
- The curse also ends at stage end and at death.
- Opening another cursed chest while cursed replaces the curse and resets `killsLeft` to 10.

| id | Effect while active |
|---|---|
| `one_hit` | Every damage to the player equals current HP (02 §3.3): blocked hits, hazards and damage-over-time ticks too. Second Wind still saves you once |
| `no_heal` | The flask can't be drunk (02 §7.2) |
| `heavy_feet` | `canDoubleJump = false` (01) |
| `hunted` | `enemySpeedMult = 1.25` (04) |

## 9. Gold

### 9.1 Storage
- Gold is an integer `goldTenths` (tenths of a gold), like the flask fill in 02. Shown gold = `floor(goldTenths / 10)`. Max shown gold is 9999; anything above is lost.
- Start of every run: 0. Gold resets at death. It is not saved between runs.
- A price is affordable if shown gold ≥ price. Paying subtracts `price × 10`.

### 9.2 Sources

| Source | Gold |
|---|---|
| Enemy kill | The enemy's `gold` (04) through §9.3 |
| Key chest | 40 |
| Timed chest | 80 |
| Cursed chest | 100 |
| Selling an ability | §11 |
| Leaky Pockets coins picked back up | Their value |

Free loot, Lucky Blocks and the shop give no gold. Chest gold, sell gold and coins are never multiplied.

### 9.3 Kill gold
Gold is credited **instantly** on the kill tick, in step 5 of 02 §3.5. There are no coins to chase (08 plays a cosmetic coin trail to the HUD). Integer math, round half up:

```
rushPct  = 100 / 110 / 120 / 130 for Rush level 0 / 1 / 2 / 3 at the kill (02 §8.3)
gt       = 2 if Golden Touch is active, else 1
bonusPct = 100 + 25 × prospectorStacks + (50 if the killing source is a weapon with Greedy)
goldTenths += floor((gold × 10 × rushPct × gt × bonusPct + 5000) / 10000)
```
Example: a Wolf (3 gold) at Rush level 2 with Golden Touch gives 72 tenths (7.2 gold). Boss gold uses the same formula.

### 9.4 Leaky Pockets coins
On each hook call: `lost = min(shownGold, max(5, floor(shownGold × 0.10)))`. If `lost = 0`, nothing happens. Otherwise:
- Subtract `lost × 10` tenths.
- Spawn `n = min(8, ceil(lost / 5))` coins. Split `lost` evenly; the first `lost mod n` coins get +1.
- Coin i spawns at the player's center with `vx = −150 + 300 × i / (n − 1)` (n = 1: `vx = 0`) and `vy = −260`. Gravity 1500 px/s². Coins stop on solid tiles and one-way tops (vx becomes 0 on landing or on hitting a wall).
- A coin can be collected after 0.40 s, by touching the player's hurtbox grown by 8 px on every side. It gives back its value × 10 tenths. A coin vanishes after 5.0 s (it blinks for the last 1.0 s).

### 9.5 Per-stage budget (target 400–600)
**Assumed level contents.** 06 should place these, and 04's gold values are used. Counts include arena waves.

| levelId | Regulars (exact mix) | Regular gold | Elites | Boss gold | Lucky Blocks | Free loot | Keys | Key chests | Cursed | Timed doors | Merchant spots |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `plains` | 40: 12 wolf, 10 bandit, 9 bandit_archer, 9 wild_boar | 148 | 4 bandit_brute | 60 | 3–4 | 2 | 2 | 3 | 1 | 1 | 1 |
| `mountains` | 36: 8 bat_swarm, 10 goblin_miner, 8 rock_golem, 10 ram | 144 | 4 goblin_shaman | 60 | 3–4 | 2 | 2 | 3 | 1 | 1 | 1 |
| `swamps` | 44: 10 bog_zombie, 12 giant_spider, 10 wisp, 12 swamp_witch | 166 | 4 treant | 60 | 3–4 | 2 | 2 | 3 | 1 | 1 | 1 |
| `kingdom` | 40: 12 soldier, 10 crossbowman, 12 war_hound, 6 battle_mage | 154 | 4 knight | 80 | 3–4 | 2 | 2 | 3 | 1 | 1 | 1 |
| `castle` | 40: 12 royal_guard, 10 gargoyle, 8 castle_mage, 10 living_armor | 200 | 4 royal_executioner | 0 | 3–4 | 2 | 2 | 3 | 1 | 1 | 1 |

(The Forest road has more fighting, the Mountain road more climbing, as the plan says.)

**"Clears most of a stage"** means: kills 90% of the regulars, all 4 elites (20 gold each) and the boss; opens 2 key chests (+80) and the timed chest (+80); average Rush gold factor ×1.10. The cursed chest (+100) is optional.

`total = (0.9 × regularGold + 80 + bossGold) × 1.10 + 160 (+100 with the cursed chest)`

| levelId | Enemies | Without cursed | With cursed |
|---|---|---|---|
| `plains` | (133.2 + 80 + 60) × 1.1 = 300.5 | **461** | **561** |
| `mountains` | (129.6 + 80 + 60) × 1.1 = 296.6 | **457** | **557** |
| `swamps` | (149.4 + 80 + 60) × 1.1 = 318.3 | **478** | **578** |
| `kingdom` | (138.6 + 80 + 80) × 1.1 = 328.5 | **488** | **588** |
| `castle` | (180 + 80 + 0) × 1.1 = 286.0 | **446** | **546** |

- All land in 400–600. Golden Touch, the Thief's Lockpick and the Dragon (+150 × Rush factor, Stage 2 or 3) push a stage above 600 on purpose.
- A main-path speedrunner (about 70% of regulars, 2 elites, the boss, 1 key chest, higher Rush) gets about 270–300 per stage.
- Stage-4 gold can only be spent at a Stage-4 merchant. The run summary still shows it.

## 10. Village shop
Crossroads Village, Border Village and Rebel Camp each have one shop. The Home Village has none. 06 places the stands; 07 draws the price tags.

### 10.1 Stock (rolled on `enterVillage`)
Generator `shop` (villageIndex, rerollCount = 0). "Next stage" = 2 for Crossroads, 3 for Border, 4 for Rebel Camp.
1. **Slot 1:** a weapon roll from the next stage's free-loot row with F and C weights set to 0. This is the "at least one weapon B or better" rule. (Crossroads B/A/S = 20/9/3, Border 33/18/5, Rebel Camp 37/36/12.)
2. **Slots 2 and 3:** draw `rng() < 0.40` → ability roll, else weapon roll (next stage's free-loot row).
3. There are no duplicate weapon ids or ability ids within one shop. Later rolls exclude ids already in the shop.
4. **Key:** draw `rng() < 0.50` → 1 key is in stock. This happens only on the first roll, and rerolls never change it.

The stock and what was bought stay as they are while the player is in the village.

### 10.2 Buying rules
- One interact press = one purchase, if it is affordable and allowed. Otherwise nothing happens (07 shows the red price, "MAX", "Owned" or "Keys full").
- A bought item goes through §5.7 (abilities: 03 §7.1). Gold is taken only when the item is actually taken (after the swap popup or swap choice is confirmed). The stand then shows SOLD.
- A shop ability whose id the player already carries can't be bought (07 shows "Owned"), so gold is never spent to replace an ability with a Lv1 copy of itself.
- **Ability upgrade:** +1 level to one carried ability, up to Lv5. 06/07 give one upgrade stand per ability slot (assumption). Price = the cost to reach the next level (§11). Lv5 shows MAX.
- **Sell ability:** removes the ability from its slot (it does not drop) and pays the sell price for its level. Allowed with any ability, including the last one. Weapons can't be sold.
- **Flask upgrade:** +1 max charge and +1 current charge (02 §7.1). Allowed while max < 4. Each upgrade costs the same.
- **Instant refill:** charges = max. Allowed only while charges < max. The fill bar is unchanged.
- **Key:** allowed if in stock and keys < 3. One per shop.

### 10.3 Reroll
- Price `50 + 50 × rerollCount` (50, 100, 150...). `rerollCount` resets to 0 in each village.
- It replaces **all 3 item slots** (SOLD slots too) with a new roll from generator (villageIndex, rerollCount + 1), using the slot rules in §10.1 steps 1–3. Then `rerollCount += 1`.

## 11. Price list
Fixed for the whole run (not stage-scaled).

**Abilities**

| Level | Cost to reach | Total spent | Sells for |
|---|---|---|---|
| Lv1 | 120 (buy) | 120 | 60 |
| Lv2 | 100 | 220 | 110 |
| Lv3 | 175 | 395 | 200 |
| Lv4 | 275 | 670 | 335 |
| Lv5 | 400 | 1,070 | 535 |

**Weapons:** F 40 · C 80 · B 160 · A 320 · S 640.

**Other:** flask upgrade 300 · instant refill 250 · key 150 · reroll 50, then +50 each time.

**Price modifiers.** `markupPct` = 125 for the merchant's items, else 100. `hagglerPct` = 85 with Haggler (§13), else 100. Sell prices never change.
```
price = 5 × floor((base × markupPct × hagglerPct + 25000) / 50000)     // round to the nearest 5, half up
```

| Base | 40 | 80 | 160 | 320 | 640 | 120 | 100 | 175 | 275 | 400 | 300 | 250 | 150 | 50 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Haggler | 35 | 70 | 135 | 270 | 545 | 100 | 85 | 150 | 235 | 340 | 255 | 215 | 130 | 45 |
| Merchant | 50 | 100 | 200 | 400 | 800 | 150 | — | — | — | — | — | — | — | — |

## 12. Wandering merchant
- 06 puts 1 `merchant_spot` on the main path of each stage (1–4). At stage load, generator `shop` (`'merchant'`, levelId) draws `rng() < 0.40` → the merchant is there for the whole stage. Otherwise the spot is empty.
- **Stock** (the draws right after, using the abilities carried at stage load): 2 weapon rolls from the cursed table of that stage (different `weaponId`s), then 1 ability roll.
- **Prices:** item price × 1.25 (§11). He also sells **ability upgrades** at normal prices.
- He doesn't buy (no selling) and offers no flask services, keys or rerolls. He can't be hurt, and enemies ignore him.

## 13. Stat upgrades
- After each **stage boss** (Stage-1 Guardian, Stage-2 Guardian, Black Knight) the player picks 1 of 3. That is 3 picks per run. There is no pick after the Dragon or the Enemy King.
- **Offer:** generator `statPick` (stageIndex). `eligible` = all 12 in table order, minus upgrades at max stacks. Repeat 3 times: `i = floor(rng() × eligible.length)`, take `eligible[i]` and remove it. Show them in draw order. The player must pick one. It applies at once and lasts the whole run.
- Taken upgrades can be offered again and stack, except those marked max 1.

| # | id | Name | Effect per stack | Hook | Max |
|---|---|---|---|---|---|
| 1 | `vitality` | Vitality | **+20** max HP (flat); current HP +20 too | 02 §5.1 | 3 |
| 2 | `might` | Might | **+10%** in the step-4 bonus pool (weapons and abilities) | 02 §3.1 | 3 |
| 3 | `quickstep` | Quickstep | **+0.08** `speedPercents` | 01 §5.2 | 3 |
| 4 | `focus` | Focus | Ability cooldowns recharge **15%** faster (+0.15 recharge rate) | 03 | 3 |
| 5 | `bloodthirst` | Bloodthirst | **+2%** flask fill per kill (+20 tenths) | 02 §7.3 | 3 |
| 6 | `precision` | Precision | **+8%** `critChance` | 02 §3.2 | 3 |
| 7 | `frenzy` | Frenzy | **+10%** attack-speed bonus | 02 §9.9 | 3 |
| 8 | `iron_skin` | Iron Skin | Incoming damage **×0.88** (stacks multiply) | 02 §3.3 | 3 |
| 9 | `prospector` | Prospector | **+25%** kill gold (`bonusPct`) | §9.3 | 3 |
| 10 | `light_feet` | Light Feet | `dashCooldownMult` **×0.80** (stacks multiply; Jammed ×2 also multiplies) | 01 §7 | 3 |
| 11 | `haggler` | Haggler | Buy prices ×0.85 (§11) | §11 | 1 |
| 12 | `lucky_charm` | Lucky Charm | Lucky Block `buffChance` 0.55 → **0.70** | §7.1 | 1 |

01 rounds the cooldown half up: Light Feet gives 42 × 0.8 = 33.6 → 34 ticks; with Jammed, 42 × 1.6 = 67.2 → 67 ticks.

## 14. Blueprints and unlocks

### 14.1 Loot pool
- **Locked at first launch** (assumption): weapons `scythe`, `flail`, `hand_cannon`, `javelin`, `spell_tome`; abilities `riposte`, `boulder_toss`, `turret`, `time_slow`. Everything else is unlocked, including every starting kit item and Vampire.
- **Random-seed runs** use the unlocked pool. **Typed-seed runs and practice mode** (06) always use the **full pool** (19 weapons, 17 abilities) and never drop blueprints, so seeded races are fair.

### 14.2 Blueprint drops
- Chance on a player kill: elite **2%**; Guardian, Black Knight and Dragon **25%**. Generator `blueprint` (levelId, sourceId): draw 1 `rng() < chance`; draw 2 picks uniformly from `candidates` = locked items not already dropped this run (weapons in `WeaponId` order, then abilities in `AbilityId` order). With no candidates, nothing drops.
- It appears as a ground item at the death point and is collected by touch. On pickup, 06 saves it at once to `save.unlocks.blueprints`. The item joins the pool from the **next** run. A blueprint not collected by stage end is lost and stays locked.
- **Beating the Enemy King** in a random-seed run unlocks one more candidate (draw 2 only, generator `blueprint` (`castle`, `'enemy_king'`)), shown on the run summary (07).
- Expected rate is about 1.1 blueprints per run plus 1 per win, so all 9 unlock in roughly 6–8 runs.

### 14.3 Other unlocks
- **Third starting weapon:** beating the Enemy King with a starting class (any run except practice) unlocks one more starting choice for that class: Swordsman → Spear, Tank → Giant Axe, Archer → Throwing Knives, Wizard → Wand. Saved in `save.unlocks.startWeapons`.
- **Outfit recolors: later, not in v1.** Plan 10.2's cosmetic outfits are left for a later milestone; v1 has one outfit per starting class (08). When added, the planned rule is: beating the Enemy King with a starting class unlocks that class's alternate outfit.
- There are no permanent stat boosts.

## 15. Data shapes

```ts
import type { Grade, WeaponId, WeaponInstance } from './weapons';              // 02
import type { AbilityId, AbilitySlot } from './abilities';                    // 03

export type StageIndex = 1 | 2 | 3 | 4;
export type GradeWeights = Record<Grade, number>;                 // percentages; order F, C, B, A, S
export const GRADE_ODDS: Record<'free' | 'key' | 'cursed', Record<StageIndex, GradeWeights>>;
export const FIXED_ODDS: Record<'dragon' | 'jackpot' | 'blackKnight', GradeWeights>;

// 05 adds one runtime field to 02's WeaponInstance (perk is a PerkId or null):
export interface LootWeapon extends WeaponInstance { leechBank: number }
// Abilities use 03's AbilitySlot { id, level, charges, rechargeLeft } everywhere (ground, shop, merchant).

export type PerkId = 'quick' | 'keen' | 'brutal' | 'finisher' | 'leeching' | 'fleet' | 'sturdy' | 'greedy';
export interface PerkDef { id: PerkId; name: string; scope: 'weapon' | 'carried'; value: number }

export type LuckyId = 'swift' | 'golden_touch' | 'firestarter' | 'second_wind' | 'overdrive' | 'bloodrush' | 'jackpot'
  | 'heavy' | 'glass_bones' | 'leaky_pockets' | 'ambush' | 'jammed' | 'dry_flask' | 'butterfingers';
export interface LuckyDef { id: LuckyId; kind: 'buff' | 'debuff'; weight: number; duration: 'stage' | 'instant' | number; name: string }

export type CurseId = 'one_hit' | 'no_heal' | 'heavy_feet' | 'hunted';
export type StatUpgradeId = 'vitality' | 'might' | 'quickstep' | 'focus' | 'bloodthirst' | 'precision'
  | 'frenzy' | 'iron_skin' | 'prospector' | 'light_feet' | 'haggler' | 'lucky_charm';
export interface StatUpgradeDef { id: StatUpgradeId; name: string; text: string; value: number; maxStacks: number }

export type ShopItem = { kind: 'weapon'; weapon: LootWeapon } | { kind: 'ability'; ability: AbilitySlot };
export interface ShopState { villageIndex: 1 | 2 | 3; rerollCount: number; slots: (ShopItem | 'sold')[]; keyInStock: boolean }
export interface MerchantState { present: boolean; slots: (ShopItem | 'sold')[] }

export interface GroundItem {
  id: number; kind: 'weapon' | 'ability' | 'key' | 'blueprint' | 'coin'; x: number; y: number; vx: number; vy: number;
  weapon?: LootWeapon; ability?: AbilitySlot; blueprint?: WeaponId | AbilityId;
  coinValue?: number; collectableAtTick?: number; expiresAtTick?: number;
  chestGroup?: number;                                   // key-chest pair: taking one removes the other
}
export interface EconomyState {
  goldTenths: number; keys: number;
  buffs: LuckyId[];                                      // active stage buffs
  debuffs: { id: LuckyId; ticksLeft: number }[];
  curse: { id: CurseId; killsLeft: number } | null;
  statStacks: Partial<Record<StatUpgradeId, number>>;
  blueprintsDroppedThisRun: (WeaponId | AbilityId)[];
}
export const PRICES = {
  weapon: { F: 40, C: 80, B: 160, A: 320, S: 640 }, abilityBuy: 120,
  upgradeTo: { 2: 100, 3: 175, 4: 275, 5: 400 }, sell: { 1: 60, 2: 110, 3: 200, 4: 335, 5: 535 },
  flaskUpgrade: 300, flaskRefill: 250, key: 150, rerollBase: 50, rerollStep: 50,
  merchantMarkupPct: 125, hagglerPct: 85,
} as const;
export const CHEST_GOLD = { key: 40, timed: 80, cursed: 100 } as const;
```

**Events emitted** (for 07/08): `luckyResult {id}`, `curseApplied {id}`, `curseLifted`, `goldChanged {tenths, reason}`, `purchase {what, price}`, `keysFull`, `blueprintFound {id}`.

## Test checklist
1. Every row of `GRADE_ODDS` and `FIXED_ODDS` sums to 100.
2. Re-deriving the key-chest and cursed rows for Stages 2–4 with the §3.4 rule from their Stage-1 rows and the free-loot rows gives exactly the stored tables.
3. `pick` on the Stage-1 free row returns F for `rng() = 0.4999`, C for 0.50, and S for 0.995.
4. Over 10,000 seeds, shop slot 1 is never F or C, and the Crossroads slot-1 grades come out about 62.5% B / 28.1% A / 9.4% S (±1.5%).
5. 100,000 Dragon rolls give only A or S, with A at 75% ±0.5%, and every one has the Dragon's element. 100,000 Black Knight rolls give only B, A or S, at 60% / 31% / 9% ±0.5%.
6. With exactly one Swordsman ability carried and the full pool, 100,000 weapon rolls give a Swordsman weapon 52.1% ±0.5% of the time. With only Vampire carried, every weapon appears at 1/19 ±0.3%.
7. Every generated B, A and S weapon has a non-null `element`. Every F and C weapon has `element = null`. Only A and S have a perk. Every weapon roll consumes exactly 5 draws.
8. A fire S Greatsword is named "Sunbreaker", a lightning S Storm Hammer "Skysplitter", a wind B Spear "Wind Spear" and a C Katana "Katana".
9. For the same run seed, a key chest's two items are identical whether it is opened first or last in the stage, as long as the carried abilities are the same.
10. Taking one key-chest item removes the other on the same tick. The chest consumes a Lockpick charge before a key.
11. At 3 keys, touching a key leaves it on the ground and the count stays 3. The shop key can't be bought at 3 keys.
12. Over 100,000 Lucky Block rolls with no active buffs: buffs 55% ±0.5%, Jackpot 5.5% ±0.3%. With Lucky Charm: buffs 70% ±0.5%.
13. A buff that is already active is never rolled. With all 6 normal buffs active, a buff roll always gives Jackpot.
14. Heavy rolled at t = 0 s and again at t = 30 s ends at t = 75 s (9000 ticks after the first roll). All buffs and debuffs are cleared on `enterVillage`. A debuff with 600 ticks left when `statPick` opens still has 600 ticks left when the pick is made; hit-stop ticks in `stage` do lower it.
15. With Glass Bones, a 12-damage enemy hit removes 24 HP. With Swift and Heavy both active, `speedPercents` sums to +0.05 from these two.
16. With Second Wind at 10/100 HP, a 30-damage hit sets HP to 50 and the buff is gone. The next lethal hit kills.
17. After opening a cursed chest at 100 HP, a 1-damage hit kills the player. After 10 player kills the curse is lifted and a 12-damage hit leaves 88 HP. Summon kills don't lower `killsLeft`.
18. Kill gold: a Wolf at Rush level 2 with Golden Touch adds 72 tenths. A Bandit at Rush 0 with 1 Prospector stack, killed by a Greedy weapon, adds 70 tenths. A Wolf at Rush level 1 adds 33 tenths.
19. Leaky Pockets: at 200 gold a hit drops 20 gold as 4 coins of 5. At 30 gold it drops 5 gold as 1 coin. At 3 gold it drops 3. At 0 gold it drops nothing. A coin can't be collected before 0.40 s and is gone at 5.0 s.
20. The §9.5 budget calculation, computed from 04's enemy gold values and the assumed counts, gives 400–600 for all 5 levels, with and without the cursed chest.
21. Buying an ability (120) and upgrading it to Lv5 costs 1,070 in total. Selling it at Lv5 adds exactly 535 gold.
22. With Haggler: S weapon 640 → 545, ability 120 → 100, Lv3 upgrade 175 → 150, refill 250 → 215, rerolls 45, 85, 130. The merchant's B weapon costs 200 (170 with Haggler).
23. Rerolls in one village cost 50, 100, 150. In the next village the first reroll costs 50. A reroll refills SOLD slots and never changes key stock.
24. A flask upgrade is refused at 4 max charges. The refill is refused when charges are at max. A flask upgrade at 2/2 gives 3/3.
25. A stat offer always contains 3 different upgrades. After Haggler is taken it is never offered again. Vitality at 70/100 HP gives 90/120.
26. Light Feet makes the dash cooldown 34 ticks. Light Feet + Jammed makes it 67 ticks.
27. In a typed-seed run the loot pool has all 19 weapons and 17 abilities, and no blueprint ever drops. A collected blueprint item is not in the pool of the current run but is in the next random-seed run.
28. An ability roll never returns an ability the player currently carries, and a new ability item is Lv1 with full charges. A shop never shows two items with the same weapon id or ability id.
29. Under Butterfingers with slot 1 full and slot 2 empty, interact on a weapon (ground or shop) opens the swap choice with slot 1 as the only option, and slot 2 stays empty. After Butterfingers ends, the same pickup goes straight into slot 2.
30. Beating the Enemy King as Tank in a random- or typed-seed run unlocks Giant Axe as a Tank starting weapon once (a second win does not add it again). A practice-mode King kill does not unlock it.
