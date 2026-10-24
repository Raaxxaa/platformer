# Level Design: Stage 1 — Plains & Forest

This is the designed layout of Stage 1, section by section. The builder turns it into ASCII chunks (`levels-src/plains/`, plan M3 Task 9). The **rules and counts** are in `docs/spec/06-run-levels-save.md` §8 and the M3 plan. This file says **what each section looks like, what it teaches, and why**. If something here can't be built within the movement limits (06 §8.5), keep the intent, adjust the shape, and log a SPEC-GAP.

**Thumbnails** are rough sketches, not exact tiles. 1 character ≈ 4 tiles across and 2 tiles up. Legend: `P` player start, `#` ground, `=` one-way platform, `^` spikes, `w` wolf, `b` bandit, `a` archer, `o` boar, `B` Brute (elite), `L` Lucky Block, `S` loot stand, `K` key, `C` key chest, `Q` cursed chest, `T` timed door/chest, `M` merchant spot, `>` guide arrow, `D` door, `!` hint.

## The stage in one line

Morning meadow → open fields with the first fights → a wooded ravine you climb out of → a grove where the road splits (ground / tree-tops / hollow) → the old fort courtyard (arena) → into the forest canopy → a clearing with a sealed shrine (timed door) → the boar's den (boss).

**Mood curve:** calm → busy → tricky → choice → intense → flowing → treasure → climax. Every section ends with a short calm stretch (2–4 tiles of flat ground with no enemies), so the player can breathe and the camera settles.

## Design rules for the whole stage

1. **Teach, then test.** Each new move is shown once in a safe spot with a hint, then used twice with mild danger, then once with real danger (spikes or enemies). It is never needed before it's taught.
2. **The main path is obvious.** Light (open sky), guide arrows at every fork, enemies facing the way you came. Side paths are darker or narrower.
3. **Speed is rewarded, never required.** Every section has at least one faster line (a dash-jump over a gap the main path walks around, a wall-jump shortcut, a drop-through) that saves 1–3 s.
4. **Fair enemy placement.** No enemy is off-screen when it can hit you. Archers always stand where you can see them first. No enemy right after a blind drop.
5. **Spacing (Stage 1, 06 §8.6):** in §2 and §3, groups have **at most 2 regular enemies** (the Brute is always alone), and two groups are **at least 24 tiles apart** with a calm stretch between, so only one group is on screen at a time. Later sections may be denser (the arena is meant to be busy).
6. **Heights and gaps** follow 06 §8.5. Section 1–2 gaps are at most 3 tiles up and 4 across. Wall-jump shafts are 4 tiles wide.

---

## § 1 — Morning Meadow (start) · 30–40 tiles · ~15 s first time, 4 s speedrun

**Purpose:** let the player move freely, pick up the first weapon, learn jump and attack.

```
 sky                                                     >
P  !move   !jump    S !interact      !attack           ____
####################  ####   ###########################
                    ##    ##  (2-tile step up and down)
```

- Start on flat grass, facing right. The `move` hint, then a 2-tile step up and down with the `jump` hint.
- **Loot stand #1 (weapon)** in the open, with the `interact` hint.
- The `attack` hint near the end, just before the first enemy of §2 becomes visible.
- **Speed line:** none needed. A speedrunner holds right and skips the stand.

## § 2 — Open Fields (combat stretch) · 150–170 tiles · ~70 s / 16 s

**Purpose:** the first real fights, **one small group at a time**, so new players are never swarmed. Teaches dash (through attacks) and Lucky Blocks. (Spread out after playtesting: friends found the first fights overwhelming.)

```
 !dash         L !lucky                                          a(low hill)                       a
   b                w w               o              b b          w               o                B
 ________     ______________     _____________   ____________   _______     ______________   ______________
#########  ##  ##############  ##############  ##############  ##########  ################  ################
   G1   calm      G2       calm      G3      calm     G4      calm  G5    calm      G6      calm    Brute
```

- **Group 1:** 1 bandit, alone on flat ground. The slowest, easiest enemy to read comes first. The `dash` hint just before him.
- **Lucky Block #1** above the path on a 2-tile rise, with the `lucky_block` hint, in the calm stretch after group 1.
- **Group 2:** 2 wolves (a pack of 2) on a wide flat field.
- **Group 3:** 1 boar alone on a long flat run (at least 20 tiles), so its charge is easy to see and dodge.
- **Group 4:** 2 bandits, spaced 6+ tiles apart so only one reaches you at a time.
- **Group 5:** 1 archer on a low hill (2 tiles up) and 1 wolf below it.
- **Group 6:** 1 boar on the flat and 1 archer on a hill behind it.
- **Brute #1** alone at the end, on flat ground with room to move around him and a calm stretch before him.
- Gaps are 2–3 tiles across with ground underneath (never deadly).
- **Speed line:** a dash-jump over the group 5 hill skips the archer.

## § 3 — Wooded Ravine (traversal) · 120–140 tiles · ~48 s / 13 s

**Purpose:** platforming. Teaches double jump, wall jump and slide. First spikes.

```
           (climb out)                       !slide
     !wall_jump  |  |                    ____________
 !double_jump    |  | <- 4-tile shaft   |############| <- 1-tile tunnel
  __   ^^  __    |  |__     L          _|____________|_   w w   a  o
 #  #^^^^^^#  #  |  |  #####  ______  #                ###########
    spike pit                                   K (detour up, 5 s)
```

- **Double jump** taught on a ledge 6 tiles up over safe ground (hint), then used over a **spike pit** (2 tiles wide, ground on both sides).
- **First wall-jump shaft:** 4 tiles wide, about 10 tiles tall, with the `wall_jump` hint at the bottom. A small ledge halfway up to rest on. Exit at the top onto the ravine rim.
- **Lucky Block #2** on the rim.
- **Slide tunnel:** a low rock overhang, 1 tile high and 7 tiles long, with the `slide` hint.
- **Key #1:** a short detour up the side (2 platforms and one dash-jump), about 5 s there and back.
- Enemies at the end, on flat ground after the tunnel, in **two groups** with a calm stretch between: first 2 wolves (pack), then, 24+ tiles later, 1 archer and 1 boar.
- **Speed line:** a skilled single-wall climb gets up the shaft faster. A dash-jump across the spike pit skips the double jump.

## § 4 — The Old Grove (branch) · 100–120 tiles main, +60–90 side · ~60 s / 11 s

**Purpose:** the first real choice. Ground path (normal), tree-top route (fast, hard), or the hollow below (loot).

```
 TREE-TOPS (skip, 12–18 tiles up, saves 6–10 s):  ==  ==   ==== (dash-jump gaps ≤7)
                                                 |  |
 GROUND (main):  >   w w w      b b       o      |  |  shaft     !dive_slam
 #################################################  ###########################
         \  HOLLOW (side path, down): a   b   B(elite)  C  Q   S(ability)
          \_______________________________________________________/
```

- **Fork marker:** a big old tree with a guide arrow pointing along the ground path.
- **Ground path (main):** 3 wolves (pack), 2 bandits, 1 boar under the trees. Fairly simple.
- **Tree-top route (skip):** reached by a wall-jump shaft between two trunks (4 wide). It runs along branches 12–18 tiles up with dash-jump gaps of up to 7 tiles, then drops back down past the ground enemies. No enemies up top. It saves 6–10 s.
- **The Hollow (side path, down a slope):** darker, roots and stones. 1 archer, 1 bandit, then **Brute #2** guarding **key chest #1** and the **cursed chest**. **Loot stand #2 (ability)** is at the very end. You climb back out with one jump + ledge grab. The cursed chest is here, just before the arena, so its 10 kills can be made in the arena.
- **Dive slam hint:** at a ledge directly above the hollow's first two enemies, so diving onto them feels natural.

## § 5 — Fort Courtyard (arena) · 38 tiles · ~35 s / 12 s

**Purpose:** a locked fight that rewards killing fast (a bigger flask refill when cleared under 20 s).

```
        D ________________________________________ D
        |    ====          ====          ====     |
        |                                         |   18 tiles tall inside
 !heal  |   wave 1: w w b b                       |   38 tiles wide inside
        |   wave 2: a a o o b + B(elite)          |
        ###########################################
```

- An old stone courtyard with broken walls, inner size **38 × 18 tiles**. 3 one-way platforms at 4–5 tiles up (archers in wave 2 spawn on two of them).
- The `heal` hint just before the entrance, so the player can top up.
- **Wave 1:** 2 wolves and 2 bandits, spawning from both sides. **Wave 2:** 2 archers (on the platforms), 2 boars (on the floor, room to charge into the walls) and 1 bandit, plus **Brute #3**.
- **Speed line:** none. Kill fast.

## § 6 — Forest Canopy (traversal 2) · 130–150 tiles · ~50 s / 15 s

**Purpose:** a harder, flowing version of §3, up in the trees. Teaches drop-through.

```
      ===   ===    ===        (canopy, 2–3 tile steps)        M (flat 15+ tiles)
   ===  !drop_through  ===  |    |       w w     a      a    _______________
 ===         L            ===|    | <- 4-wide, ~14 tall shaft   ===  o   ===
 ######  ^^^^^^^^^  ####     |    |######  ^^^  ######   K (after hard jumps)
```

- **Climb into the canopy** on one-way branches in 2–3 tile steps. The `drop_through` hint at a spot where you must drop down to continue.
- **Lucky Block #3** on a branch.
- **Harder wall-jump shaft:** 4 wide, about 14 tall, with spikes at the bottom of the pit beside it (falling just costs HP and time).
- Enemies in the trees: 2 wolves (pack) on a wide branch, 2 archers on higher branches (always visible before they can shoot), 1 boar on the ground at the end.
- **Key #2:** after a hard jump section (double jump + air dash over spikes), a detour of about 8 s.
- **Merchant spot:** on the forest floor at the end, a flat clearing with at least 15 tiles of open floor (7 each side).
- **Speed line:** chaining drop-throughs and air dashes skips two branch climbs.

## § 7 — The Sealed Shrine (loot area) · 70–90 tiles · ~45 s / 8 s

**Purpose:** treasure and a race against the clock.

```
     L                     T-room (sealed, 120 s door)
  C      C        b   a  [D|  T  ]       o   o   B(elite)
 ##########################|#######|###########################
```

- A sunny clearing with an old stone shrine.
- **Lucky Block #4**, **key chest #2** and **key chest #3** around the clearing. With 2 keys you open 2 of the 3, so you choose.
- **Timed door** into the shrine (120 s from stage start; a speedrunner arrives at about 70 s). Inside: the **timed chest**. The room's walls are covered with blink blocks, so you can't Blink in.
- Enemies: 1 bandit, 1 archer, 2 boars on the flat, and **Brute #4** at the far end before the boss den.

## § 8 — The Boar's Den (boss) + road · 36 + 12–20 tiles · ~55 s / 25 s

**Purpose:** the Great Boar fight, then the road out.

```
     D  (entry)                                   (exit) D
     |  ____________________________________________     |   road →  [exit]
     |  |        flat floor, 36 × 14 tiles,          |    |  ##############
     |  |   B O A R  starts at 75% from the left     |    |
     ######################################################
```

- A cave mouth in a hillside, inner **36 × 14 tiles**: flat floor, solid walls (the boar crashes into them), and a ceiling.
- The entry door is on the left and closes when you're fully inside. The exit door on the right opens when the boar dies.
- Then a short road (12–20 tiles) through the trees to the stage `exit`.

---

## Totals check (must match the M3 plan and 05 §9.5)

| | §2 | §3 | §4 main | §4 side | §5 | §6 | §7 | Total |
|---|---|---|---|---|---|---|---|---|
| Wolf | 3 | 2 | 3 | — | 2 | 2 | — | **12** |
| Bandit | 3 | — | 2 | 1 | 3 | — | 1 | **10** |
| Archer | 2 | 1 | — | 1 | 2 | 2 | 1 | **9** |
| Boar | 2 | 1 | 1 | — | 2 | 1 | 2 | **9** |
| Brute | 1 | — | — | 1 | 1 | — | 1 | **4** |

Lucky Blocks 4 (§2, §3, §6, §7) · loot stands 2 (§1, §4) · keys 2 (§3, §6) · key chests 3 (§4, §7 ×2) · cursed chest 1 (§4) · timed door 1 (§7) · merchant spot 1 (§6).

## What to show the user

After building it, take a screenshot of each section (M3 Task 10). Then ask: does each section feel like its description ("busy", "tricky", "choice"…)? Which section is the most fun, and which is the most annoying?

---

## Versions (M11, 06 §8.7)

Sections 2, 3, 4, 6 and 7 each have **3 versions**. The run's seed picks one per section, so there are 243 different Stage 1s. `v1` is the layout above (the "classic" layout). Every version keeps its section's **exact contents** (the same enemies, packs, chests, keys, Lucky Block, hints in the same order) and joins its neighbours on the floor row at both edges. Its main path is within ±10% of `v1`. Because classic Stage 1 is already 787 of its 790 allowed main-path tiles, no version is longer than `v1` by more than a tile. The versions are built by `levels-src/plains/gen_variants.py`. Thumbnails use the legend at the top; `=` is a plank (one-way).

### § 2 v2 — Riverbank
A dry stream bed of stepping stones (three 3-tile gaps over a safe bed), then two **plank bridges** over gullies. The groups stand in the same order and spacing as `v1`: the boar gets a long bank to charge on, and each archer still has its low hill.
```
 L                                 a                a
b ^^  ww   _ _ _   o     b  b   ======   a w   ======  o a          B
#####################  ###########   ######   ######   ###########
     stepping stones          bridge 1          bridge 2
```

### § 2 v3 — Windmill hill
One long gentle climb in 2-tile terraces to a wide summit, then back down. Each group stands on its own terrace: the boar on a 25-tile terrace, the two bandits on the summit, the archers at terrace edges.
```
                         b  b (summit)
                o     __________      a w
 L    ww     ________          ________       o a
b##########__                          ________      B
```

### § 3 v2 — Waterfall cliff
After the double-jump ledge and spike pit (as `v1`), a **wall-jump shaft** climbs the cliff face beside the falls. On the clifftop, the **slide tunnel** runs under an overhang behind the waterfall, and the key sits on two planks above it. Then you drop down to the wolves, the archer and the boar.
```
                         K =
                       = |##|   <- overhang (slide under)
 !dj   __  ^^ __   |  |______________
 #  ##########  ## |sh|  clifftop      |___ w w ......... a o
```

### § 3 v3 — Fallen trees
Double-jump across two fallen logs over a spiked gully. The **wall-jump shaft is inside a hollow trunk** (walk in at the bottom). From the top you run along a thick branch and **slide under a knot**, then drop to the ground. The key is on two planks past the tree.
```
                      |knot|
               |  |===========  (branch)      K
  __    __     |tr|                      = =
 #  #^^#  #    |nk|              w w ............ a o
```

### § 4 v2 — Under the arch
The tree-top skip runs on branches **below a rock arch**, reached through the same two-trunk shaft. The hollow is entered at the **far end** of the road (a 4-wide drop by the guide arrow) and runs back under the road: archer, bandit, the Brute, the key chest, the cursed chest and the ability stand last, at the far left. **Climbing out:** a ladder of four plank steps (3 tiles apart, staggered left and right) leads up through the entrance.
```
        ______________ rock arch ______________
     | |  ==   ==   ==   ==
 www | |   b  b        o        > !dive  _
 ###########################################  ####
   s  Q  C  B             b  a   <- HOLLOW  ##
```

### § 4 v3 — Ridge path
The skip is a **ridge path** on a stone ridge above the road (with planks on its crest). The side path is a **cave under the ridge**, entered by a drop in the middle of the road. The cave holds the archer and bandit on the left, and the Brute, chests and ability stand on the right. **Climbing out:** the same four-step plank ladder up through the entrance.
```
     | |  ==  ==  ==  ==
     | | ______ ridge ______
 www | b  b  > !dive  _     o
 ##################  #####################
  a  b      <- CAVE ->   B  C  Q  s
```

### § 6 v2 — Rope bridges
Three **plank bridges** between four tree trunks, high over a spiked floor. The wolves are on the middle bridge and an archer is at each end. **Drop through** the last bridge to the ground (hint), where the key waits. Then climb one more trunk, reach the merchant's clearing, and pass a rock with the boar on top.
```
   L
  a=======|ww=====|=====a|
 _|       |       |  K   |      M          _o_
 #^^^^^^^^#^^^^^^^#######################  ####
```

### § 6 v3 — Treehouse village
An abandoned village in the trees. Plank **ladders** lead up to treehouse 1 (archer). A rung takes you up to treehouse 2, whose plank floor holds the wolves and teaches the **drop-through**. A rope bridge (archer) leads to the big treehouse where the **merchant** stands on 21 flat tiles. The key is on the ground under the bridge.
```
                 ==ww=====
           =                ================______M______
    =   __a___                     a       |  treehouse |     _o_
 ==    ^^^^^^          K                                     ####
```

### § 7 v2 — Shrine on the stair
The **shrine stands high on a terrace over the road**, reached by a plank stair at its right side (where the timed door is). One key chest is on the low terrace with the archer, the other is on the shrine terrace. The road itself runs underneath to the boars and the Brute.
```
                  @@@@@@@@@@@@
                C @   T      D=
   L         a  ____________ =
 b      C_____                     o  o   B
```

### § 7 v3 — Sunken shrine
The road crosses a **plank floor over a pit**. Drop through to reach the sunken shrine (its timed door faces right). Climb out by two steps. The archer stands on a ledge just past the pit.
```
  L                                 a
   C     b       C  ==========    ___    o  o   B
 ####################        ######   ##########
                    | @@@@@  |
                    | @ T  D _|
                    |________|
```
