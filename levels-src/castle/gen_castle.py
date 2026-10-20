#!/usr/bin/env python3
"""Lays out Stage 4, King's Castle (docs/plans/M9-part4-stage4-king-dragon.md), and writes
levels-src/castle/ (castle.txt chunk + level.json manifest).

Run: python3 levels-src/castle/gen_castle.py && python3 tools/build_levels.py castle   (or `npm run levels`)

Tiles; rows grow downward. The castle floor is row F (first solid row), so feet stand on row F - 1.
Every platform is reachable with ONE jump from something reachable (06 section 8.5), or is a grounded tower climbed by a
wall-jump shaft 4 tiles wide, so the level passes reachLint and routeLint. Hazards sit in the ground: spike pits are cut into
the floor, swinging blades hang from cantilevered galleries that are part of a tower, bridges span the spike pits.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, F = 640, 144, 110
SECTIONS = [(1, 0, 30), (2, 30, 130), (3, 130, 236), (4, 236, 336), (5, 336, 378), (6, 378, 502), (7, 502, 580), (8, 580, 640)]

grid = [['#' if y >= F else '.' for _ in range(W)] for y in range(H)]
hh = [0] * W                      # terrain height above the floor, in tiles
objects = []


def fill(x0, y0, x1, y1, c):
    """Inclusive tile rectangle."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            grid[y][x] = c


def oneway(x0, x1, row):
    fill(x0, row, x1, row, '=')


def raise_(x0, x1, h):
    """Solid terrain h tiles above the floor over columns [x0, x1)."""
    for x in range(x0, x1):
        hh[x] = max(hh[x], h)


def pt(type_, x, y, **props):
    objects.append({'type': type_, 'x': x, 'y': y, 'props': props})


def rc(type_, x, y, w, h, **props):
    objects.append({'type': type_, 'x': x, 'y': y, 'w': w, 'h': h, 'props': props})


def enemy(name, x, feet, facing=-1, **props):
    pt('enemy', x, feet, enemy=name, facing=facing, **props)


def cannon(x, ped_w=3, ped_h=2, direction=-1):
    """A cannon on the street with a crate stack behind it; it fires along the street at torso height."""
    pt('cannon', x, F - ped_h, dir=direction, interval=3.0)
    raise_(x + 1, x + 1 + ped_w, ped_h)


def spike_pit(x0, x1, bridge=False):
    """A pit cut into the floor: two open rows over a row of spikes. A bridge of collapsing planks spans it."""
    fill(x0, F, x1, F + 1, '.')
    fill(x0, F + 2, x1, F + 2, '^')
    if bridge:
        fill(x0, F, x1, F, '%')


def cellar(xe, length, corridor_top):
    """A stairwell down from a one-way bridge in the floor into a corridor under it (see the Kingdom generator).
    Returns the interior bounds."""
    oneway(xe, xe + 8, F)
    fill(xe, F + 1, xe + 8, F + 8, '.')
    fill(xe, F + 3, xe + 2, F + 9, '#')
    fill(xe + 3, F + 6, xe + 5, F + 9, '#')
    fill(xe + 6, F + 9, xe + 6 + length, F + 9, '#')
    fill(xe + 6, F + 3, xe + 8, F + 8, '.')
    fill(xe + 9, corridor_top, xe + 6 + length - 1, F + 8, '.')
    return xe + 9, xe + 6 + length - 1


def tower(left, shaft_w, right_len, height=14):
    """A gate tower: a left wall with a 3-tile doorway, a 4-wide wall-jump shaft, and a rampart. Returns (shaft_x0, rampart_x0)."""
    lx0, lx1 = left, left + 3
    sx0 = lx1 + 1
    rx0 = sx0 + shaft_w
    fill(lx0, F - height, lx1, F - 1, '#')
    fill(lx0, F - 3, lx1, F - 1, '.')                         # the doorway
    fill(rx0, F - height, rx0 + right_len - 1, F - 1, '#')   # the rampart, a solid block down to the floor
    return sx0, rx0


def gallery(x0, x1, blades, phases):
    """A cantilevered gallery two tiles thick, 9 tiles above the floor, grown from a tower wall (x0 or x1 is the wall side).
    One blade hangs under it at each x in `blades` (a pendulum 88 px long: its lowest point is at torso height)."""
    fill(x0, F - 9, x1, F - 8, '#')
    for bx, ph in zip(blades, phases):
        pt('swinging_blade', bx, F - 7, length=88, amplitude=60, period=2.0, phase=ph)


# ----------------------------------------------------------------------------------------- S1 (0-29)
pt('player_start', 2, F - 1, facing=1)
pt('loot_stand', 14, F - 1, kind='weapon')

# ----------------------------------------------------------------------------------------- S2 (30-129): the outer ward
pt('lucky_block', 38, F - 3)
for x in (46, 50, 54):
    enemy('royal_guard', x, F - 1)
raise_(70, 73, 3)
enemy('gargoyle', 71, F - 4)                                  # perched on the crate stack
enemy('castle_mage', 80, F - 1)
for x in (88, 92, 96):
    enemy('living_armor', x, F - 1)
raise_(104, 107, 3)
enemy('gargoyle', 105, F - 4)
enemy('castle_mage', 114, F - 1)
enemy('royal_executioner', 124, F - 1)

# ----------------------------------------------------------------------------------------- S3 (130-235): bridges, blades, the first tower
spike_pit(138, 142, bridge=True)
spike_pit(146, 150, bridge=True)
spike_pit(154, 158, bridge=True)
enemy('royal_guard', 162, F - 1)
gallery(172, 183, [175, 180], [0.0, 0.5])                     # grown from the tower's left wall below
sx0, rx0 = tower(184, 4, 23)                                   # left wall 184-187, shaft 188-191, rampart 192-214
gallery(215, 224, [218, 222], [0.25, 0.75])                    # grown from the rampart's right end
enemy('gargoyle', 196, F - 15)                                # on the rampart
enemy('gargoyle', 208, F - 15)
enemy('castle_mage', 202, F - 15)
pt('lucky_block', 230, F - 3)
oneway(226, 229, F - 3); oneway(230, 233, F - 6); oneway(234, 235, F - 9)     # the key detour (about 4 s)
pt('key', 235, F - 10)

# ----------------------------------------------------------------------------------------- S4 (236-335): branch
raise_(250, 253, 3)
enemy('gargoyle', 251, F - 4)
enemy('royal_guard', 244, F - 1)
raise_(262, 265, 3)
enemy('gargoyle', 263, F - 4)
enemy('living_armor', 258, F - 1)
spike_pit(270, 273); spike_pit(277, 280); spike_pit(284, 287)
oneway(268, 271, F - 3); oneway(275, 278, F - 3); oneway(282, 285, F - 3); oneway(289, 292, F - 3)   # the skip chain over the spikes
enemy('living_armor', 294, F - 1)
enemy('living_armor', 298, F - 1)
pt('guide_arrow', 238, F - 2, angle=0)
lo, hi = cellar(306, 24, F + 3)                                # the side path: key chest, cursed chest, Executioner, ability
enemy('royal_guard', 317, F + 8)
enemy('castle_mage', 320, F + 8)
pt('key_chest', 322, F + 8)
pt('cursed_chest', 325, F + 8)
enemy('royal_executioner', 328, F + 8)
pt('loot_stand', 333, F + 8, kind='ability')
pt('guide_arrow', 304, F - 2, angle=0)

# ----------------------------------------------------------------------------------------- S5 (336-377): the combat arena
AX0, AX1 = 338, 375                                            # interior 38 x 18
fill(AX0 - 1, F - 19, AX1 + 1, F - 19, '#')
fill(AX0 - 1, F - 19, AX0 - 1, F - 4, '#'); fill(AX1 + 1, F - 19, AX1 + 1, F - 4, '#')
oneway(344, 349, F - 3); oneway(364, 369, F - 3); oneway(351, 356, F - 6)
rc('arena', AX0, F - 18, 38, 18, id='guard_hall', kind='combat')
rc('arena_door', AX0 - 1, F - 3, 1, 3, arena='guard_hall', role='entry')
rc('arena_door', AX1 + 1, F - 3, 1, 3, arena='guard_hall', role='entry')
WAVES = [
    [('royal_guard', 348, F - 1), ('royal_guard', 352, F - 1), ('castle_mage', 372, F - 1)],
    [('gargoyle', 346, F - 1), ('gargoyle', 356, F - 1), ('gargoyle', 366, F - 1)],
    [('living_armor', 348, F - 1), ('living_armor', 352, F - 1), ('royal_guard', 370, F - 1), ('royal_executioner', 362, F - 1)],
]
for n, wave in enumerate(WAVES, start=1):
    for name, x, feet in wave:
        enemy(name, x, feet, wave=n, arena='guard_hall')

# ----------------------------------------------------------------------------------------- S6 (378-501): cannon gallery, second tower
pt('merchant_spot', 388, F - 1)
pt('lucky_block', 404, F - 3)
oneway(408, 411, F - 3); oneway(412, 415, F - 6); oneway(416, 419, F - 9)     # key #2: harder
pt('key', 417, F - 10)
for cx in (424, 434, 444, 452):
    cannon(cx)                                                 # the cannon gallery: 4 cannons, each with a 3 x 2 crate stack
raise_(437, 440, 3)
enemy('gargoyle', 438, F - 4)
enemy('royal_guard', 430, F - 1)
enemy('royal_guard', 448, F - 1)
enemy('living_armor', 441, F - 1)
spike_pit(458, 462, bridge=True)
sx6, rx6 = tower(476, 4, 13)                                   # left wall 476-479, shaft 480-483, rampart 484-496
gallery(466, 475, [469, 473], [0.0, 0.5])
enemy('castle_mage', 490, F - 15)
pt('guide_arrow', 380, F - 2, angle=0)

# ----------------------------------------------------------------------------------------- S7 (502-579): loot area
pt('lucky_block', 510, F - 3)
enemy('royal_guard', 514, F - 1)
pt('key_chest', 518, F - 1)
enemy('castle_mage', 524, F - 1)
enemy('castle_mage', 560, F - 1)
enemy('living_armor', 570, F - 1)
enemy('royal_executioner', 548, F - 1)
pt('key_chest', 576, F - 1)
# The timed room: a sealed cellar behind a door (blink blocks seal every wall tile).
T0 = 534
fill(T0, F + 1, T0 + 8, F + 8, '.'); oneway(T0, T0 + 8, F)
fill(T0, F + 3, T0 + 2, F + 9, '#'); fill(T0 + 3, F + 6, T0 + 5, F + 9, '#')
fill(T0 + 6, F + 9, T0 + 31, F + 9, '#')
fill(T0 + 6, F + 6, T0 + 8, F + 8, '.')
fill(T0 + 9, F + 6, T0 + 30, F + 8, '.')
fill(T0 + 16, F + 5, T0 + 31, F + 5, '@'); fill(T0 + 16, F + 9, T0 + 31, F + 9, '@')
fill(T0 + 31, F + 5, T0 + 31, F + 9, '@')
fill(T0 + 16, F + 6, T0 + 16, F + 8, '.')
rc('timed_door', T0 + 16, F + 6, 1, 3, id='castle_timed', side='left', timeLimit=135)
pt('timed_chest', T0 + 28, F + 8, door='castle_timed')
pt('guide_arrow', 506, F - 2, angle=0)

# ----------------------------------------------------------------------------------------- S8 (580-639): the throne room
BA0, BA1 = 583, 622                                            # interior 40 x 19
fill(BA0 - 1, F - 20, BA1 + 1, F - 20, '#')
fill(BA0 - 1, F - 20, BA0 - 1, F - 4, '#'); fill(BA1 + 1, F - 20, BA1 + 1, F - 4, '#')
oneway(BA0 + 7, BA0 + 12, F - 6); oneway(BA0 + 27, BA0 + 32, F - 6)    # 96 px wide, 96 px up, at 1/4 and 3/4 (04 9.2)
rc('arena', BA0, F - 19, 40, 19, id='throne_room', kind='boss', boss='enemy_king', entry='left')
rc('arena_door', BA0 - 1, F - 3, 1, 3, arena='throne_room', role='entry')
rc('arena_door', BA1 + 1, F - 3, 1, 3, arena='throne_room', role='exit')
pt('summon_point', BA0 + 3, F - 1, arena='throne_room')       # 48 px from each wall
pt('summon_point', BA1 - 3, F - 1, arena='throne_room')
rc('exit', 636, F - 3, 2, 3)

# ----------------------------------------------------------------------------------------- terrain from the height profile
for x in range(W):
    for y in range(F - hh[x], F):
        if grid[y][x] == '.':
            grid[y][x] = '#'

for idx, x0, x1 in SECTIONS:
    rc('section', x0, 0, x1 - x0, H, index=idx)

# ----------------------------------------------------------------------------------------- main path
blocked = {x for x in range(W) if hh[x] > 0}
def street(x):
    while x in blocked:
        x += 1
    return (x, F - 1)
clean = [(2, F - 1)]


def walk(a, b, step=16):
    """Street vertices from a to b, skipping crate stacks."""
    x = a
    while x < b:
        p = street(x)
        if p[0] > clean[-1][0] and p[0] < b + step:
            clean.append(p)
        x += step


walk(18, 134)
clean += [(136, F - 1), (144, F - 1), (152, F - 1), (160, F - 1), (166, F - 1), (172, F - 1), (180, F - 1)]
# tower 1: through the doorway, up the shaft, along the rampart, off its end
clean += [(185, F - 1), (190, F - 1), (192, F - 15), (203, F - 15), (213, F - 15), (218, F - 10), (222, F - 10), (227, F - 1)]
walk(240, 266, 8)
clean += [(267, F - 1), (275, F - 1), (282, F - 1), (289, F - 1), (295, F - 1), (301, F - 1)]
walk(309, 456)
clean += [(457, F - 1), (463, F - 1), (470, F - 1), (477, F - 1), (481, F - 1), (484, F - 15), (490, F - 15), (495, F - 15), (500, F - 1)]
walk(505, 630)
clean.append((637, F - 1))

man = {
    'levelId': 'castle', 'kind': 'stage', 'stage': 4, 'biome': 'castle', 'width': W, 'height': H,
    'chunks': [{'file': 'castle.txt', 'x': 0, 'y': 0}],
    'legend': {}, 'objects': objects, 'mainPath': [list(p) for p in clean],
}
with open(os.path.join(HERE, 'level.json'), 'w', encoding='utf-8', newline='\n') as f:
    json.dump(man, f, indent=1)
    f.write('\n')
with open(os.path.join(HERE, 'castle.txt'), 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(''.join(r) for r in grid) + '\n')

length = sum(((clean[i][0] - clean[i - 1][0]) ** 2 + (clean[i][1] - clean[i - 1][1]) ** 2) ** 0.5 for i in range(1, len(clean)))
print('castle: wrote %dx%d, main path %.1f tiles, %d objects' % (W, H, length, len(objects)))
