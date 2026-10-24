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

## Versions (M11, 06 §8.7)

Sections 2, 3, 4, 6 and 7 each have **3 versions**. The run's seed picks one per section, so there are 243 different Forest roads. `v1` is the layout above (the "classic" layout). Every version keeps its section's **exact contents** (the same enemies, Lucky Block, key and its ladder, chests, stand, timed door and chest with its 37 blink blocks, the 13 grapple points, dark zone and fireflies, side arena, warning zone, merchant and arrows) and joins its neighbours on floor row 56 at both edges. Sections 1, 5 and 8 never change. Water stays 2 tiles deep over a solid floor. A version's main path is within ±10% of `v1` (all are 98–104%), and every section keeps its width, so every combination stays 700 x 80. The versions are built by `levels-src/swamps/gen_variants.py`. Thumbnails: `~` water, `Z` Zombie, `S` spider, `w` Wisp, `W` Witch, `E` Treant, `=` plank (one-way), `@` blink block.

### § 2 v2 — Cypress islands
Five wide pools (45 water columns) with dry islands between them. Each of the four dry islands has a raised mound; the Witches and one spider stand on the mounds, the Zombies wait in the pools, and the Lucky Block floats over the first island.
```
        w     L      w W S        w W         w S W
 ____~~~~~~~_____ _/\_ ~~~~ _/\_ ~~~ _/\_ ~~~~ _/\_ ~~~~~ ____ E
   Z  Z           Z        Z              S
```

### § 2 v3 — Twin marshes
Two big marshes (22 columns each), joined by a long dry causeway of 34 tiles with three low stumps. The first group wades the first marsh, the middle groups fight on the causeway (the Witches on stumps), and the last group waits at the far marsh.
```
     w      L   W    w   W        w    w W
 ___~~~~~~~~~~~~~~~~___ _#_ _#_ _#_ ____~~~~~~~~~~~~~~~~___ E
    Z Z    Z        S                Z    S
```

### § 3 v2 — Mossy hollow
Four pools (42 water columns) with a plank across each pool and a hanging spider above its middle. A dry stone block between the second and third pool carries the Lucky Block. The key and its ladder of planks are as in `v1`.
```
       S  =====      S  =====     L      S  =====   S  =====    K
   ~~~~~~~~~~~~    ~~~~~~~~~      ##       ~~~~~~~  ~~~~~~~     =
 ##############################################################
```

### § 3 v3 — Stepping logs
Four pools of different sizes (8, 14, 8, 12 columns), logs of two heights, and a dry block between the third and fourth pool for the Lucky Block. The key's ladder stands four tiles further left, with the same steps.
```
   S  ===     S  =======     S ===      L   S  =======      K
 ~~~~~~      ~~~~~~~~~~~~~~    ~~~~~    ##   ~~~~~~~~~~~      =
```

### § 4 v2 — Cellar stairs
The road is solid ground over a cellar. A **plank hatch** (8 tiles) drops into the cellar; inside are the Wisp and Witch, Treant 2, the key chest, the cursed chest and the ability stand. Four 2-tile steps climb back to a second hatch before the arena. The vines above are a flat zigzag.
```
vines:       G    G    G    G    G    G    G
main:  > Z   ==== S   Z  S   w          steps W >
cellar:        w  W    E   C  Q  A  /4 steps/
```

### § 4 v3 — Twin bridges
Two **plank bridges** (29 and 34 tiles) over two cellars, with solid ground between and a low tunnel joining the cellars underneath (the Treant waits in it). The stair back up is at the far end of the second cellar. The vines form two arches, one over each bridge.
```
vines:    G G G           G G G
main: >  Z===S====   Z S  ====w===W===  >
side:        w W   [ E ]    C  Q  A / steps
```

### § 6 v2 — Flooded ruin
Three pools (33 water columns) with a mound for the Witch, a short dry bank, and an underpass with two pits (22 water columns) and two stalactites. The dark zone, fireflies, warning, side arena, planks, steps, key ladder and merchant are as `v1`.
```
warning     L        > [empty side arena]
  Z  w W    Z   w S   \
 __~~~~~_/\_~~~~~~__~~~~~~~___ steps          steps ___ K
        \___ ~~~ ___ ~~~~~~~~ ___/  underpass  M
```

### § 6 v3 — Sunken stumps
Three pools of different lengths with a stump (the Witch on it) before the longest pool. The underpass has three small pits (22 water columns), two of them crossed on planks.
```
warning  L       > [empty side arena]
  Z    Z W  w S    \
 ~~~~ __~~~~~~~_#_~~~~~~~~~~~ steps  __~~ ==== ~~ ____ ==~~ steps  K
```

### § 7 v2 — Cellar vault
The sealed timed room lies deep (rows 58–67) in the left half of the road, 12 wide and 10 tall. A plank hatch drops you into a 4-wide shaft in front of its door; wall-jump back out. The key chests and Lucky Block are on the road, in view.
```
 S  w L  C  ==== E            W  W    C       E >
######  ##hatch ######################
        |  [T room]  |
```

### § 7 v3 — Flat vault
A wide, low sealed room (16 wide, 6 tall) under the middle of the road with its hatch just before it. Same contents and the same long calm road to the Queen's nest.
```
 S  w L  W  C  ==hatch== ...      W  C   E >
##########   ################################
              |   [ T room ]    |
```
