# Level Design: Stage 2 — Caves & Mountains

The Mountain road rises from the foothills into a tall mine, crosses an optional loot tunnel, then drops back into the mountain in a minecart. The main route uses normal movement only. Shoulder Charge opens a shorter upper tunnel in section 4. This document follows 06 §8–10, 05 §9.5 and M7.1; the chunks keep the same counts and route intent.

Thumbnails show the route, not exact cells. `P` start, `b` Bat Swarm, `m` Goblin Miner, `g` Rock Golem, `r` Ram, `S` Goblin Shaman, `L` Lucky Block, `K` key, `C` key chest, `Q` cursed chest, `W/A` weapon/ability stand, `M` merchant, `D` door, `+` cracked wall, `I` ice, `=` one-way, `V` minecart, `!` rock warning, arrows main route.

## Coordinate and count contract

The map is **552 × 176 tiles**. Tile coordinates below are absolute, with y increasing downward. The starting floor is y164; the great climb ends at y92. The minecart returns to y144. Section bounds contain their side routes. The built main-route polyline is about **680 tiles**, inside the required 650–730.

| Section | Chunk x range | Main route target | Floor / main height | Required contents |
|---|---|---|---|---|
| 1 | 0–32 | 30 | 164 | Start, weapon stand |
| 2 | 32–132 | 104 | Around 164 | 10 regulars, Shaman 1, Lucky 1 |
| 3 | 132–156 | About 116 | 164 up to 92 | 72-tile climb, two bats, rocks, Lucky 2, Key 1 |
| 4 | 156–246 | About 107; side 60–90 | Main 92–104; side 112 | Six main and two side regulars, Shaman 2, chest 1, curse, ability stand, cracked skip |
| 5 | 246–286 | 38 | 92 | Inner arena x247–285, y74–92, three waves |
| 6 | 286–416 | About 149 | Ice ledges near 86; cart 92 down to 144 | Ice, empty side arena, Lucky 3, Key 2, merchant, 120-tile cart ride, stop |
| 7 | 416–496 | About 80 | Around 144 | Lucky 4, chests 2/3, 125-second sealed room, Shaman 4 |
| 8 | 496–552 | 36 + 16 | 144 | Colossus arena, road, exit |

The main path keeps four-tile wall-jump shafts, gaps no wider than four tiles, late solid ledge rises no higher than seven tiles, and one-way rises no higher than six. Solid catch floors close every pit. A guide arrow marks every fork. Each section ends on a short safe landing. Long enemy attack lanes are visible before the player enters them.

## Section 1 — Mountain foot

An open, calm run-in lets the player try the Stage 1 loot before the climb. The weapon stand is in the middle of a wide floor, with a sign showing the upward route. A small two-tile rock step gives the silhouette of the road without danger. No enemy or hazard reaches the start.

```text
P         W       sign: uphill       >
########  ############################
```

## Section 2 — Rocky slopes

Four readable groups occupy broad ledges: first two Miners and a Ram, then a bat and a Ram, then a Miner, Golem and bat, then a Miner and Ram. No group has more than three regulars. Miners stand on low, visible shelves; Rams have flat takeoff and landing space rather than blind drops. Lucky Block 1 is between groups. Shaman 1 is alone at the end, so its ward and bolt can be read before section 3 narrows.

```text
       m m            b          m    b        m
   r      L       r          g             r       S  >
##########  ##########  #############  ################
```

## Section 3 — The great climb

Six short switchbacks climb **72 tiles**, from floor y164 to y92, in a 24-tile-wide mine shaft. Four-tile wall-jump channels alternate with safe rest ledges about 12 tiles apart; the horizontal links make the main route about 116 tiles. Two bats occupy separate open landings, never the first wall-jump entry. Falling-rock zones cover selected climbing channels; their floor marks remain visible for the full warning. Lucky Block 2 sits at a rest ledge. Key 1 is on a short upper ledge reached by a double jump and optional air dash, with a return detour below five seconds.

```text
             L    K      > out at y92
        ____|  |____
        | ! |  | b |       six rises, rest ledges
        |___|__|___|
        | b | !|   |
in > ___|   |__|___|          y164
```

## Section 4 — The split mine

The main path dips 12 tiles into a wide Golem tunnel and climbs back to y92 before the arena. Three Golems can be passed, hit from above or approached from behind; one Miner, one bat and one Ram complete the six main enemies. An upper corridor stays at y92, but a cracked wall closes its entrance. Shoulder Charge opens it; it avoids the tunnel and its fights, targeting a six-to-ten-second saving. The lower side route contains a Miner and Golem, then Shaman 2, key chest 1 and the cursed chest. The ability stand is at its end. A four-tile shaft rejoins the main route. The curse can be cleared by the following arena's ten enemies.

```text
skip:     +++++++++++++++++++++++++++++ >
main:  >  \    g   m   g    b   r   g  / > arena
side:      \ m  g     S    C Q   A ___/
```

## Section 5 — Mine arena

The room has the exact 06 §9.2 **38 × 18 tile inner rectangle**, flat floor, two raised one-way platforms, and two floor-level doors. This uses the shared spec and validator size; M7.1's conflicting 20-tile width is recorded in SPEC-GAPS. Wave 1 is Miner, Golem and Ram. Wave 2 is a bat and two Rams. Wave 3 is Miner, Golem and Ram with Shaman 3. The stage-two 24-second par and normal wave delays apply.

```text
D |      ======          ======       | D
  |       3 / 3 / 3 + S waves          |
  ######################################
```

## Section 6 — Ice peaks and minecart descent

The short approach offers small icy ledges above a safe, dry merchant floor; the direct route can walk underneath them to the cart. Merchant x287 has at least 112 pixels of flat clear floor on both sides, extending into the cleared arena exit. Lucky Block 3 is on the upper ice line. Key 2 uses a short harder jump detour above it, below eight seconds there and back. The **empty 40 × 20 side arena** lies above the first flat part of the cart line, x335–375, floor y88 and top y68; its single three-tile-high opening faces left at x335. A two-tile one-way branch at x333–334, y88 lets a foot player double-jump four tiles up from the rail floor and enter. The room has the central eight-tile one-way platform six tiles above its floor, no doors, no lock and no camera zone. Entering and returning to the main route takes under four seconds. The warning zone is x290–291, across the main route; its right edge is 44 tiles (704 pixels) before the opening, so both warning and arena are in section 6.

The cart waits at approximately x293.5, y92. Its `minecart_stop` starts at x415, giving **121.5 nominal horizontal tiles** to the stop and at least **120 tiles of actual travel** before its box first touches the stop. Its first 40 tiles are flat; after x335 the track descends to y144 in visible steps, with two short gaps over catch floors and two low cart tunnels. The side room's floor at y88 leaves three empty rows above the flat rail floor at y92. A player can take the normal foot route and can leave the cart. One Miner, one Ram and one bat are spaced along the descent away from the merchant floor and first boarding point. The main arrow points down toward the cart; the side opening remains a clear optional fork. The Dragon room stays empty until M9.

```text
       [empty 40x20 room, central platform]
          opening
       I  L  K
> ___ M ___ V \__   __\_____   __\_____  stop >
               \_safe floor_____safe floor___
```

## Section 7 — Crystal cave loot

The cart exits onto a calm landing before the cave's loot. One of each regular type protects separate broad floor or ledge positions, then Shaman 4 guards the far end. Lucky Block 4 and key chests 2 and 3 are visible from the main route. The 125-second timed room is sealed with a ceiling, floor and blink-block walls; its single timed door faces the route. A missed timed door never blocks progress to the boss.

```text
> stop   C     L     C     [D timed chest]    b m g r   S >
########################################################
```

## Section 8 — Colossus cavern and road

The inner boss arena is **36 × 18 tiles** (576 × 288 pixels), with flat floor, solid ceiling and walls, and two four-tile-wide one-way ledges six tiles above the floor at the walls. Entry is from the left. The Colossus begins at three quarters of the room width. The exit door stays shut until its death; the following 16-tile road leads to the stage exit. The main route needs the mandatory stat choice before the exit can load the Border Village.

```text
D | ==            COLOSSUS            == | D   road > exit
  ######################################## ##############
```

## Enemy totals

| Enemy | Section 2 | Section 3 | Section 4 main | Section 4 side | Section 5 | Section 6 | Section 7 | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Bat Swarm | 2 | 2 | 1 | 0 | 1 | 1 | 1 | **8** |
| Goblin Miner | 4 | 0 | 1 | 1 | 2 | 1 | 1 | **10** |
| Rock Golem | 1 | 0 | 3 | 1 | 2 | 0 | 1 | **8** |
| Ram | 3 | 0 | 1 | 0 | 4 | 1 | 1 | **10** |
| Goblin Shaman | 1 | 0 | 0 | 1 | 1 | 0 | 1 | **4** |
| Regular total | **10** | **2** | **6** | **2** | **9** | **3** | **4** | **36** |

Four Lucky Blocks, two loot stands, two keys, three key chests, one cursed chest, one timed door/chest, one merchant spot, one combat arena, one empty side arena, one boss arena and one exit. Required keys precede their chest choices along the main route. Screenshots should show all eight sections, the 72-tile climb, the cracked skip, the cart's full descent and the empty side room.
