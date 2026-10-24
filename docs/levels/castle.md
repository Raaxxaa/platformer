# Level Design: Stage 4 — The King's Castle

The last road: a long castle floor from the Rebel Camp to the throne room. Follow `06-run-levels-save.md` sections 8–10, `05-loot-economy.md` section 9.5 and the M9 plan (Part 4). The map is **640 × 144 tiles**; the castle floor is level at row 110 (feet on row 109) and every section ends on it. Section bounds are x = **0, 30, 130, 236, 336, 378, 502, 580, 640**. The main path (about 676 tiles) runs along the floor and over the two gate towers. Hazards sit in the ground (spike pits cut into the floor; every spike tile has solid or spikes under it); swinging blades hang from galleries grown out of a tower wall; collapsing bridges span the pits (5 tiles at most).

Thumbnails show intent, not exact tiles. `g` Royal Guard, `G` Gargoyle (perched on a stack), `m` Castle Mage, `a` Living Armor, `X` Executioner, `N` cannon with its 3 × 2 crate stack, `L` Lucky Block, `K` key, `C/Q` key and cursed chest, `A` ability stand, `^` spikes, `%` collapsing bridge, `=` plank (one-way), `@` blink block, `/\` blade.

## Sections (classic layout, `v1`)

| § | x | What it is | Required contents |
|---|---|---|---|
| 1 | 0–30 | Gate road: start and the free weapon stand | player start, weapon stand |
| 2 | 30–130 | Outer ward: three guards, gargoyles on two crate stacks, mages, three armours, the Executioner | 10 regulars (3 guards, 2 gargoyles, 2 mages, 3 armours) + the Executioner, Lucky 1 |
| 3 | 130–236 | Bridges, blades, the first tower: three bridged spike pits, a gallery with two blades, the **gate tower** (doorway, 4-wide wall-jump shaft, rampart 14 up with Gargoyles and a Mage), a second gallery with two blades, the key's ladder | 4 regulars, 4 blades, 3 bridges, Lucky 2, key 1 (detour ≤ 5 s) |
| 4 | 236–336 | Branch: crate stacks, three spike pits with a **skip chain** of planks, and a **cellar** (hatch, two steps, a corridor) with the side path | 8 regulars, key chest 1, cursed chest, ability stand |
| 5 | 336–378 | Guard hall: the combat arena (38 × 18, three waves) | — |
| 6 | 378–502 | Cannon gallery: merchant, Lucky 3, key 2 on a ladder of planks, four cannons on stacks, a bridged pit, a gallery with two blades and the **second gate tower** | 5 regulars, 4 cannons, key 2 (detour ≤ 8 s) |
| 7 | 502–580 | Loot area: Lucky 4, key chests 2 and 3, Mage, Executioner, Armour and the sealed timed cellar (135 s door, 35 blink blocks) | 4 regulars, timed chest |
| 8 | 580–640 | The throne room (40 × 19, the King) and the road to the exit | — |

## Versions (M11, 06 §8.7)

Sections 2, 3, 4, 6 and 7 each have **3 versions**. The run's seed picks one per section, so there are 243 different Castles. `v1` is the layout above (the "classic" layout). Every version keeps its section's **exact contents** (the same enemies, Lucky Block, key and its ladder, chests, stand, cannons, blades with their phases, collapsing bridges, spike pits, gate tower, timed door and chest with its 35 blink blocks, merchant and arrows) and joins its neighbours on the castle floor at both edges. Sections 1, 5 and 8 never change. A version's main path is within ±10% of `v1` (all are 100–106%), every section keeps its width, so every combination stays 640 × 144. The versions are built by `levels-src/castle/gen_variants.py`.

### § 2 v2 — Parade ground
A raised stage (12 wide, 3 high) with a Mage on it, and a Gargoyle on a stack before it and one after. The three guards come first; the Armours and the second Mage follow, then the Executioner.
```
 L  g g g   G         [ m ]        G    a a a   m   X
##########  ####  ############  #### ################
```

### § 2 v3 — Rampart steps
Two 3-tile steps up to a 6-tile wall walk with a Gargoyle and a Mage on it, two steps down; the second stack and its Gargoyle stay.
```
                 G m
              [########]                G
 L  g g g  __/          \__  a a a   ###  m   X
```

### § 3 v2 — Tower first
The gallery with two blades comes right after the start, then the gate tower, the second gallery, and then the three bridged spike pits, all before the key's ladder.
```
        /\ /\                  /\ /\
 _____ [gallery]|tower rampart G m G|[gallery]__ g  %%%%^ %%%%^ %%%%^__ L  K
```

### § 3 v3 — Pits first
Two bridged pits first, then the guard, the gallery, the tower (further right), the second gallery and the last bridged pit.
```
                   /\ /\                  /\ /\
 _%%%^ %%%%^ g [gallery]|tower rampart G m G|[gallery]  %%%%^__ L  K
```

### § 4 v2 — Spikes first
The three spike pits and their plank chain at the very start, then the guard, two stacks with Gargoyles and the Armours before the cellar hatch on the right.
```
  ==  ==  ==  ==
 > ^^^^  ^^^^  ^^^^   g   G  a   G  a a  > cellar [hatch]
```

### § 4 v3 — Cellar first
The cellar hatch is at the start of the district (so the side path begins early), then the guard, two stacks, an Armour, and the spike pits with their plank chain last.
```
                                        ==  ==  ==  ==
 > g [hatch]  G  a  G         ^^^^  ^^^^  ^^^^   a a >
```

### § 6 v2 — Tower first
The ladder, then the gallery and the second gate tower, then the bridged pit and the four cannons with their stacks (a Gargoyle on a crate between them).
```
 M   L  K=   /\ /\
  ===  [gallery]|tower rampart m|    %%%%^   N  g a N G N N g
```

### § 6 v3 — Pit first
The bridged pit right after the ladder, then the four cannons and stacks, and the gallery and tower close to the exit.
```
 M   L  K=     %%%%^ g N a N G N N g  /\ /\
                                  [gallery]|tower rampart m|
```

### § 7 v2 — Early cellar
The cellar hatch at cols 14–22 and a 14 × 7 sealed room under the first third of the road.
```
 L g C  [hatch]  m       X   m  a        C
##### ( sealed room T ) ###########
```

### § 7 v3 — Late cellar
The hatch at cols 40–48 and a tall 12 × 9 sealed room under the road; the Executioner guards the hatch.
```
 L  g  C    m     X   [hatch]      m   a   C
####################### ( room ) ###########
```
