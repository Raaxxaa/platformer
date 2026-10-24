# Level Design: Stage 3 — The Enemy Kingdom

A walled town street from the Border Village to the castle gate. Follow `06-run-levels-save.md` sections 8–10, `05-loot-economy.md` section 9.5 and the M9 plan (Part 3). The map is **700 × 100 tiles**; the street is level at floor row 72 (feet on row 71) all the way, and every section ends on it. Section bounds are x = **0, 36, 148, 260, 368, 410, 552, 632, 700**. The main path (about 698 tiles) stays on the street; crates and cannon stacks are jumped, not routed over. Rooftops, balconies and cellars are optional routes.

Thumbnails show intent, not exact tiles. `s` Soldier, `x` Crossbowman, `h` War Hound, `m` Battle Mage, `k` Knight, `N` cannon (fires left along the street at torso height) with its 3 × 2 crate stack behind it, `L` Lucky Block, `K` key, `C/Q` key and cursed chest, `A` ability stand, `M` merchant, `=` plank (one-way), `@` blink block.

## Sections (classic layout, `v1`)

| § | x | What it is | Required contents |
|---|---|---|---|
| 1 | 0–36 | Gate road: start and the free weapon stand | player start, weapon stand |
| 2 | 36–148 | Sentry street: soldiers, a pack of hounds, crossbowmen on a 6-tile rampart (two steps up, a wall walk, two down), then mage and knight | 10 regulars + Knight, Lucky 1 |
| 3 | 148–260 | Cannon street: four cannons on stacks, crossbowmen on two stacks; the key's ladder of three planks near the end | 4 regulars + 4 cannons, Lucky 2, key 1 (detour ≤ 5 s) |
| 4 | 260–368 | Tower district: seven balconies up to rooftops 24 tiles above the street (two roof gaps) — the **rooftop skip** — and a **cellar** (hatch, two steps, a corridor) with the side path | 8 regulars + Knight, key chest 1, cursed chest, ability stand |
| 5 | 368–410 | Palace yard: the combat arena (38 × 18, three waves) | — |
| 6 | 410–552 | Gate hall: merchant, Lucky 3, four cannons, the **barbican** (the street runs under the Dragon's empty 40 × 20 side arena; three balconies climb to its opening), key 2 on four planks | 5 regulars, Dragon warning ≥ 640 px before the arena, key 2 (detour ≤ 8 s) |
| 7 | 552–632 | Parade ground: hounds, key chests, mage, knight and the sealed timed cellar (130 s door, 35 blink blocks) | 4 regulars + Knight, Lucky 4, chests 2 and 3, timed chest |
| 8 | 632–700 | The Black Knight's arena (40 × 16) and the road to the exit | — |

## Versions (M11, 06 §8.7)

Sections 2, 3, 4, 6 and 7 each have **3 versions**. The run's seed picks one per section, so there are 243 different Kingdoms. `v1` is the layout above (the "classic" layout). Every version keeps its section's **exact contents** (the same enemies and packs, Lucky Block, key and its ladder, chests, stand, cannons and their `dir`/`interval`, timed door and chest with its 35 blink blocks, the barbican, warning zone, merchant and arrows) and joins its neighbours on the street at both edges. Sections 1, 5 and 8 never change. A version's main path is within ±10% of `v1`, every section keeps its width, so every combination stays 700 × 100. The versions are built by `levels-src/kingdom/gen_variants.py`.

### § 2 v2 — Market street
Stall counters (3 × 2) and two cloth awnings (planks, 6 up) over the street; the crossbowmen sit on the awnings and shoot down. The street stays level; the Hounds meet you earlier than in `v1`.
```
 L       ====     ====         x x
 s s   h h h  [=]   [=]  =   s s m k
##################################
```

### § 2 v3 — Gatehouse
Two 6-tile towers with a plank bridge between them and the street running through the archway below. The crossbowmen shoot from the bridge. The main route climbs over (two 3-tile steps each side); the street below is a faster but more exposed way.
```
              x   x
         [######======######]
 L s s h h h /##          ##\ s s m k
##################################
```

### § 3 v2 — Cannon alley
Cannons at 14, 38, 62 and 86; the crossbowmen sit on the second and third stacks, and a crate barricade stands before the last stretch. The key's ladder is as in `v1`.
```
   N        N   x      N   x     N       [#]   m
 ####################################################
```

### § 3 v3 — Barricades
The cannons in two pairs (18 and 30, 54 and 64) with crate barricades between; the crossbowmen sit on the second and third stacks. The key's ladder is as in `v1`.
```
   N   N  x   [##]    N   N   x          [##]   m
 ####################################################
```

### § 4 v2 — Spire stairs
The seven balconies start in the middle of the district and lead up to rooftops at the right (two gaps); the cellar hatch is at the far left, so the side path starts right after the Gate. The Hounds wait under the stairs.
```
roofs:                       xx======  ==x  ======
stairs:             =  =  =  =  = = =
street: > cellar s        h h h     > arena
```

### § 4 v3 — Split roofs
Balconies at the left as in `v1`, but the rooftops are three pieces with wider gaps (3 and 4 tiles), and the cellar hatch lies in the middle of the street, so the side path is a detour of the same length.
```
roofs:      ====== x   ==== x ====   (gaps 3 and 4)
stairs: = = = = = = =
street: > s    [cellar hatch]       h h h  > arena
```

### § 6 v2 — Wide gate
Cannons at 30 and 40 on the left (the crossbowman on the second stack) and at 120 and 134 on the right. The barbican, its balconies, merchant, warning and the key's ladder stay as `v1`.
```
 M      L  N N x s        [barbican]        N        N x
```

### § 6 v3 — Barricaded gate
Cannons at 36 and 48 on the left with a crate barricade before the barbican; cannons at 122 and 128 on the right, close under the key's ladder.
```
 M      L [#]  N  N x s    [barbican]     K=== N N x
```

### § 7 v2 — Early cellar
The cellar stairwell is at cols 14–22 and the sealed room is 14 × 7 under the early street. The Hounds wait further on, the Lucky Block and a key chest are at the very start.
```
 L  C      [hatch]      m          h h h        k  C
############ (  sealed room  ) #######
```

### § 7 v3 — Late cellar
The stairwell is at cols 40–48 and the sealed room is 12 × 9, tall, right under the road; the Knight stands before the hatch.
```
 h h h  L    s  C      k   [hatch]        m   C
######################### ( room ) ###########
```
