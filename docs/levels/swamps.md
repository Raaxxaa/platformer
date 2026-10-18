# Level Design: Stage 2 — Dark Forest & Swamps

This is the Forest road from the Crossroads. Follow `06-run-levels-save.md` sections 8–10, `05-loot-economy.md` section 9.5 and the M7.1 plan. The road has more fights than the Mountain road. Water slows running, darkness narrows sight, and hanging spiders make the player watch above. The main path needs only the normal movement kit. Grapple vines are an optional future shortcut.

The map is **700 × 80 tiles**. Section bounds are x = **0, 36, 148, 260, 368, 410, 552, 632, 700**. The usual floor is row 56. The short underpass in section 6 drops eight tiles and returns in four-tile steps. Main-path length stays within 650–730 tiles. All pits have floors. Solid ledges rise at most five tiles; one-way ledges rise at most six tiles after section 2. Each section ends with a calm landing.

Thumbnails show intent, not exact tiles. `#` ground, `~` water, `=` one-way branch, `Z` Bog Zombie, `S` Giant Spider, `w` Wisp, `W` Swamp Witch, `E` Treant, `L` Lucky Block, `K` key, `C` key chest, `Q` cursed chest, `A` ability stand, `M` merchant spot, `G` grapple point, `D` door, `T` timed chest, `>` main route.

## Section 1 — Forest edge, x 0–36

A calm, dusky forest edge gives room to enter from the village and read the road. The player starts on dry ground, passes a free weapon stand and a small rise, then sees the first pool before meeting an enemy. There is no blind drop or attack at the entrance. The straight road lets a returning runner keep speed.

```text
P       weapon stand          > first pool
#################  #######################
```

## Section 2 — Bog, x 36–148

Teach water in the first short pool before testing it with submerged Zombies. At least 40 columns of the 112-column floor are water, split into readable pools with dry mounds between them. Twelve regulars form four groups of at most three: Z/Z/w, Z/W/S, Z/W/w, S/W/w. Witches stand on low dry mounds where their throws are visible. Ground spiders are already visible here; hanging spiders come later. Lucky Block 1 follows the first group. Treant 1 stands alone near the end, after a calm dry stretch. Running through pools is slow; jumping, dashing and sliding give faster lines.

```text
       Z Z  w       L        W       Z W w       S W w        E
####~~~~~~~~~~#######~~~~~~#####~~~~~~~~~~~####~~~~~~~~##########
       water         dry mounds and calm gaps                 >
```

## Section 3 — Dark hollow, x 148–260

The first dark zone starts on safe ground. Fireflies mark the floor and each landing, so the next step is always readable. Four hanging spiders sit over separate pools with room to see their warning before passing under. At least 40 floor columns contain water. Lucky Block 2 sits on a dry rest ledge. Key 1 is above a short double-jump detour near the exit; it takes at most five seconds to visit and return. The normal floor route remains open under it. A fast player can jump between dry branches, but no grapple or ability is needed.

```text
       S             S             S             S        K
  *      *     *          *    L       *          ==   ==
###~~~~~~~~~~#####~~~~~~~~~~#####~~~~~~~~~~#####~~~~~~~~### >
          fireflies show the main floor
```

## Section 4 — Bog branch, x 260–368

A guide arrow points along the normal bog road. Its six regulars are two Zombies, two spiders, one Wisp and one Witch. A short lower side path holds a Wisp and Witch, then Treant 2, key chest 1, the cursed chest and the free ability stand. It returns before the combat arena, so the curse can be cleared in the waves. The optional upper vine route has grapple points no more than 150 px from reachable spots and bypasses the fighting for a future Grapple Arrow user; the road below never depends on them. The lower return uses ordinary solid steps.

```text
VINES (future skip):       G      G      G      G
MAIN:                >   Z S   Z S    w W        >
######################   #########################
SIDE:                  w W     E    C Q A   / steps
                       #####################
```

## Section 5 — Sunken ruin, x 368–410

Two doors frame a flat **38 × 18 tile** combat room with two one-way platforms. Wave 1 is Zombie, Spider, Witch; wave 2 is Zombie, Wisp, Witch; wave 3 is Spider, Wisp, Witch plus Treant 3. The platforms give space to move above puddles and falling throws. Every wave uses the shared spawn warning. The room keeps its flat floor clear of water so the locked fight tests combat rather than trapping a slow player. A short dry approach allows healing before entry.

```text
 D |        ====               ====          | D
   |   wave 1: Z S W                         |
   |   wave 2: Z w W                         |
   |   wave 3: S w W + E                     |
   ###########################################
```

## Section 6 — Deep swamp, x 410–552

A second dark zone combines water, fireflies and seven regulars: two Zombies, one spider, two Wisps and two Witches. More than 30% of floor columns contain water, including about 40 before the fork and 12 in the lower underpass. A Dragon warning lies at the section entrance, at least 640 px before the side-room opening. The optional **40 × 20 tile** side arena is x 470–510, y 36–56, with its central eight-tile platform six tiles above the floor. It stays empty until M9. Its single three-tile-high opening is reached from a dry fork ten tiles away; stepping inside and back takes less than four seconds. The marked main route drops beneath the room through two four-tile steps, crosses the underpass and climbs back through two four-tile steps. Lucky Block 3 lies on the main line. Key 2 uses a short hard-jump detour after the underpass, with a safe floor below and a return under eight seconds. The merchant stands on dry, open ground near x 540, with at least seven clear tiles on either side.

```text
warning       L        dry fork > [empty side arena:    ====   ]
  Z  W   w  Z       w  S      \   [                     floor ]
#####~~~~~~~~~~~~~###########  \  #############################
                              \_____~~~~~~~_____ / steps    K
                                   main underpass           ==
                                                        ##### M ### >
```

## Section 7 — Witch's grove, x 552–632

Dry ground and low roots lead through one spider, one Wisp and two Witches, then Treant 4. The fights leave space before the final rewards. Lucky Block 4 and key chests 2 and 3 are visible from the main road. The timed chest sits in a sealed side room with the 125-second timed door and Blink-blocked walls. The player can pass that room after the timer expires. A guide arrow points toward the Queen's nest and the last calm stretch gives room to heal.

```text
  S    w      W       W      E       L    C C       > nest
##################################   ####################
                                  D T (sealed room)
                                  ####
```

## Section 8 — Queen's nest, x 632–700

A dry approach reaches the **32 × 20 tile** Queen arena. It has a flat floor, a solid ceiling for Ceiling Drop, and two six-tile-wide one-way platforms six tiles above the floor at the required offsets. The dormant Queen stands at 75% of the room width from entry. The entry closes for her introduction; the exit opens on the kill tick. After the stat choice, a short clear road reaches the Border Village. There are no regular enemies or hidden hazards after the Guardian.

```text
         solid ceiling
 D |    ======              ======       | D
   |                            QUEEN    |
   ######################################     > exit
```

## Enemy budget

Counts include all arena waves. The Queen is the Guardian, separate from the 44 regulars and four Treants. Section 4 has six regulars on the main route and two on the side path. Wave sizes are 3, 3, then 3 plus the elite.

| Section | Bog Zombie | Giant Spider | Wisp | Swamp Witch | Regular total | Treant |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | 4 | 2 | 3 | 3 | 12 | 1 |
| 3 | 0 | 4 | 0 | 0 | 4 | 0 |
| 4 | 2 | 2 | 2 | 2 | 8 | 1 |
| 5 | 2 | 2 | 2 | 3 | 9 | 1 |
| 6 | 2 | 1 | 2 | 2 | 7 | 0 |
| 7 | 0 | 1 | 1 | 2 | 4 | 1 |
| 8 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **10** | **12** | **10** | **12** | **44** | **4** |

## Object and route checks

Place exactly four Lucky Blocks (sections 2, 3, 6, 7), two free stands (weapon in 1, ability in 4), two keys (3, 6), three key chests (4, 7, 7), one cursed chest (4), one timed door and chest (7), one merchant spot (6), one empty side arena and Dragon warning (6), one combat arena (5), one Queen arena (8), and one exit. Every fork has a main-route arrow. The main line uses neither vines nor a required ability. Dark zones contain fireflies; danger warnings and projectiles draw above darkness. Validate exact counts, water coverage, arena dimensions, the main-path length and movement limits before browser play.
