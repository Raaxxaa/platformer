# 09 — Character Customization (M13)

How the player's character looks: race, body, hair, clothes and colors, accessories collected from every enemy type, shop-only cosmetics, the wardrobe (character creator) and the collection book. **Looks only: nothing here changes any number in the game.** Read `00-README.md` first. Design: `docs/GAME_PLAN.md` §4.5.

**Only referenced here:** class trim colors (`03` §4.2, `08` §3.4), player frames and anchors (`08` §4.1–4.2, §6), shop stock and its RNG stream (`05` §10), save storage (`06` §15), the Home Village layout and `mirror_spot` (`06` §12.3), toasts and popups (`07` §6).

**Code:** data in `src/data/cosmetics.ts`; rules in `src/core/cosmetics/` (pure: unlocks, shop slot, validation); the wardrobe UI in `src/ui/wardrobe/`; drawing in `src/game/view/PlayerLook.ts`.

---

## 1. Fairness rules
- Every race and look uses the **same hurtbox (12 × 28), the same frames, timings and anchors**. Accessories never change the hurtbox and are drawn inside the player's 48 × 48 frame (capes may overhang behind by up to 8 px).
- Nothing in `src/core/` reads the look, except the unlock bookkeeping (§4). The simulation is identical for every look.
- The class still shows: **trim A and trim B** stay tinted with the current class or hybrid color (08 §3.4) on every outfit.

## 2. The look

```ts
type RaceId = 'human' | 'elf' | 'dwarf' | 'orc';
interface Look {
  race: RaceId; skin: number; face: number; hair: number; hairColor: string; beard: number;
  outfit: OutfitId; colorA: string; colorB: string;          // cloth dye ids
  head: CosmeticId | null; back: CosmeticId | null; extra: CosmeticId | null;
}
```

| Part | Options |
|---|---|
| **Race** | Human · Elf (long pointed ears, slimmer face) · Dwarf (broader shoulders and a lower head drawn inside the same box, default full beard) · Orc (small tusks, heavier brow) |
| **Skin** | Human/Elf/Dwarf: 6 tones (light to dark). Orc: 3 greens + 1 grey |
| **Face** | 4 (eyes and brows: calm, fierce, cheerful, tired) |
| **Hair** | 8 styles: bald, short, spiky (the old Swordsman), long tied, braid, mohawk, curly, top-knot. Hats hide the top of the hair (art draws a "hat" variant of each style) |
| **Hair color** | 6 to start (black, brown, auburn, blond, grey, white) + dyes (§5) |
| **Beard** | none, stubble, short, long, braided. Elves default to none, dwarves to long; any race can pick any |
| **Outfit** | 4 sets, the old class outfits renamed: `leather` (jerkin and scarf), `plate` (plate chest, pauldrons, visor helmet), `ranger` (hood, short cape, bracers), `robe` (long robe, wide-brim hat). Any class can wear any outfit |
| **Colors** | `colorA` (main cloth) and `colorB` (second cloth) from the dye list: 8 to start (slate, brown, forest, navy, maroon, sand, grey, olive) + dyes (§5) |

- **Defaults** (first launch, also the "Random" button's fallback): human, skin 2, face 1, hair 3 (spiky), brown hair, no beard, `leather`, slate/brown, no accessories.
- The `plate` helmet and `robe` hat count as built-in headwear: choosing a `head` accessory replaces them (the outfit's hat layer hides).

## 3. Accessories from enemies
The **first time the player kills an enemy type**, they get its accessory, always. Kills count in normal runs, typed-seed runs and practice; not the Training Yard's dummies and straw targets. Summons count (Spiderlings). The Dragon gives one accessory **per color**.

| Enemy | Accessory | Slot |
|---|---|---|
| Wolf | Wolf-pelt hood | head |
| Bandit | Bandit bandana | head |
| Bandit Archer | Feathered cap | head |
| Wild Boar | Tusk necklace | extra |
| Bandit Brute | Spiked shoulder pads | extra |
| Great Boar | Boar-skull helmet | head |
| Bat Swarm | Bat-wing cape | back |
| Goblin Miner | Miner's lamp helmet | head |
| Rock Golem | Pebble pauldrons | extra |
| Ram | Curled horns | head |
| Goblin Shaman | Shaman's bead mask | extra |
| Stone Colossus | Stone crown | head |
| Bog Zombie | Tattered shroud | back |
| Giant Spider | Silk scarf | extra |
| Spiderling | Tiny spider (rides on the shoulder) | extra |
| Will-o'-Wisp | Wisp lantern (floats by the head) | extra |
| Swamp Witch | Crooked witch hat | head |
| Treant | Leafy mantle | back |
| Spider Queen | Queen's eight-eye circlet | head |
| Soldier | Kingdom kettle helm | head |
| Crossbowman | Quiver of bolts | back |
| War Hound | Spiked collar | extra |
| Battle Mage | Runed hood | head |
| Knight | Knight's tabard cape | back |
| Black Knight | Black plume helm | head |
| Royal Guard | Halberdier's plumed hat | head |
| Gargoyle | Stone wings | back |
| Castle Mage | Star-scarf | extra |
| Living Armor | Haunted gauntlet pauldron | extra |
| Royal Executioner | Executioner's hood | head |
| Enemy King | The fallen crown | head |
| Dragon (red / white / storm / green) | Dragon-scale cape (in that color) | back |

That is **35 accessories**. Ids: `acc_<enemyId>` (Dragon: `acc_dragon_red`, …).

- On unlock: emit `cosmeticUnlocked {id, source}`; a toast (07 §6.10) `New look: Wolf-pelt hood` with its icon; the save is written at once (06 §15.1).
- An accessory unlocked during a run can be worn from the next visit to the wardrobe.

## 4. Unlock bookkeeping (core)
- `save.cosmetics.owned: CosmeticId[]` and `save.cosmetics.seenEnemies: EnemyId[]` (every enemy type the player has ever met, for the collection book's hints).
- On every player kill (02 §3.4) of an enemy type in §3 not yet owned: add it. Same-tick kills of several types unlock all, in kill order.
- Meeting an enemy (it becomes aware, 04 §2.4) adds it to `seenEnemies`.

## 5. Shop-only cosmetics
Each village shop (Crossroads, Border Village, Rebel Camp) has **1 cosmetic slot**, an extra stand next to the reroll barrel (art and position: 06 §12.2 gets a `shop_cosmetic` at tile x 38).

| Kind | Items (id) | Price |
|---|---|---|
| Cloth dyes (unlock a new `colorA`/`colorB` choice) | crimson, gold, teal, violet, black, white, rose, sky (`dye_<name>`) | 150 |
| Hair dyes (unlock a new hair color) | silver, pink, blue, green, fire-red, platinum (`hair_<name>`) | 150 |
| Hats (head) | straw hat, feathered beret, flower crown, pirate tricorn, tall top hat (`hat_<name>`) | 250 |
| Capes (back) | royal purple, patched traveler, starry night, checkered speedrunner (`cape_<name>`) | 300 |
| Golden cape (back) | `cape_gold` | 400 |

**24 shop cosmetics.** Rules:
- **Roll:** after the shop's normal stock (05 §10.1) and its key draw, the same `shop` generator makes **one more draw**: `item = unowned[floor(rng() × unowned.length)]` over the table's order. With nothing unowned, the stand shows `Collection complete` and is inactive. Rerolls (05 §10.3) do **not** change the cosmetic. Typed-seed runs roll it too.
- Buying uses run gold (05 §11 prices do not apply; Haggler does: 85%, rounded to 5). Owned forever; no item is dropped, it goes straight into the collection (toast as in §3).
- Practice mode and the Training Yard have no shops, so no cosmetic slot.

## 6. The wardrobe (character creator)
- The Home Village `mirror_spot` (06 §12.3, tile 25) becomes interactable: **Look** (07 §5.7). It opens the wardrobe popup (phase `homeVillage`, world keeps running, the player gets neutral input, like the class pick 07 §6.7).
- **First launch:** the wardrobe opens once by itself before the first class pick ("Make your hero"), with Confirm on the first row so a player can skip.
- **Layout:** full-screen panel. Left half: a big live preview of the character (3× scale) playing `idle`, with buttons to preview `run`, `jump` and an attack; the class trim shows the currently equipped kit's class (Neutral grey without a kit). Right half: 4 tabs (07 popup skin): **Body** (race, skin, face, hair, hair color, beard), **Clothes** (outfit, color A, color B), **Accessories** (head, back, extra: owned items or None), **Collection**.
- Each row: left/right (or tap) cycles the options, showing the option's name. Locked colors and items are not in the cycle.
- Buttons: **Random** (random owned options; uses `Math.random` in the UI layer only, never the core), **Undo changes**, **Confirm** (saves `save.look`).
- **Collection tab:** a grid of all 59 cosmetics (35 accessories + 24 shop items) with icons. Owned: full color, name and where it came from. Not owned: a dark silhouette; the name shows as `???` and the hint shows `Dropped by: Wolf` if the enemy is in `seenEnemies`, else `Dropped by: an enemy you haven't met`; shop items show `Sold in village shops`. A counter `23 / 59`.
- The unlocks board's Records screen (07 §7.5) gets a fourth tab `LOOKS` showing the same collection (read-only).

## 7. Drawing the character (view)
The player is drawn as layers at one position, flipped together (extends 08 §4.2), back to front:

1. `back` accessory (cape/wings/quiver), behind the body
2. **skin** layer (the race's body and head in a grey ramp) — multiply-tinted with the skin tone
3. **outfit A** layer (main cloth, grey ramp) — tinted `colorA`
4. **outfit B** layer (second cloth, grey ramp) — tinted `colorB`
5. **fixed** layer (eyes, face, leather, metal, boots: full color, not tinted)
6. **trim A**, **trim B** — tinted with the class color (unchanged rule)
7. **beard** (grey ramp, tinted hair color), **hair** (grey ramp, tinted hair color; the "under a hat" variant when a hat or built-in headwear is worn), **outfit headwear** (plate helmet / robe hat, hidden if a `head` accessory is worn)
8. `extra` accessory, `head` accessory
9. weapon and smear (unchanged)

- Every body frame in `anims.json` carries attachment points (`head`, `back`, `neck`, `shoulder`) in frame pixels; accessories are single images (a few frames for capes: `idle`, `run`, `air`) placed on those points and flipped with the player. Floating extras (Wisp lantern, tiny spider) follow their point with a small 1 px bob.
- Grey ramps use 4 fixed greys so a multiply tint gives a clean 4-shade color; dye and skin hex values are in `src/data/cosmetics.ts` (copied from 08's palette table for M13).
- The overlay flashes (hit flash, telegraph) cover every layer (08 §5.3).
- Other places that show the player (class pick preview, run summary, death screen, practice ghost) use the same look. Ghosts stay a single-color silhouette.

## 8. Save data
`SaveData` gains (06 §15.2; defaults for old saves):
```ts
look: Look;                                   // §2 defaults
cosmetics: { owned: CosmeticId[]; seenEnemies: EnemyId[]; wardrobeIntroDone: boolean };
```
A `look` field naming an unknown or unowned option falls back to its default on load.

## Test checklist
1. Every race uses the same hurtbox and frames; a full run with a dwarf and with an elf (same seed, same inputs) gives an identical `RunState` and final time.
2. The first Wolf kill adds `acc_wolf` and emits `cosmeticUnlocked` once; the second Wolf kill adds nothing. Killing a straw target or dummy unlocks nothing. A Spiderling kill unlocks `acc_spiderling`. A storm Dragon kill unlocks only `acc_dragon_storm`.
3. There are 35 accessories (one per enemy type of §3, Dragon ×4) and 24 shop items, all with unique ids, a slot or kind, and an icon frame.
4. The shop cosmetic draw is made after the key draw: the item stock and key of a Crossroads shop are identical with and without M13 for the same seed. A reroll keeps the cosmetic. With every shop item owned, the stand is inactive.
5. Buying `cape_gold` at 400 gold with Haggler costs 340; it is owned at once and appears in the wardrobe's back slot.
6. A saved look with an unowned hat loads with `head = null`; an unknown race loads as human.
7. Wearing a `head` accessory with the `plate` outfit hides the plate helmet and uses the hair's under-hat variant.
8. The collection shows `Dropped by: Wolf` for an unowned wolf accessory only after a Wolf has become aware of the player once.
