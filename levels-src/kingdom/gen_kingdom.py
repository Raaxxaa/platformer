#!/usr/bin/env python3
"""Lays out Stage 3, the Enemy Kingdom (docs/plans/M9-part3-stage3-black-knight.md), and writes
levels-src/kingdom/ (kingdom.txt chunk + level.json manifest).

Run: python3 levels-src/kingdom/gen_kingdom.py && python3 tools/build_levels.py kingdom   (or `npm run levels`)

Tiles; rows grow downward. The street floor is row F (first solid row), so feet stand on row F - 1.
Every platform is reachable with ONE jump from something reachable (06 §8.5): one-way steps rise 3 tiles at most,
solid steps up to 3 tiles, so the generated level passes reachLint and routeLint.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, F = 700, 100, 72
SECTIONS = [(1, 0, 36), (2, 36, 148), (3, 148, 260), (4, 260, 368), (5, 368, 410), (6, 410, 552), (7, 552, 632), (8, 632, 700)]

grid = [['#' if y >= F else '.' for _ in range(W)] for y in range(H)]
hh = [0] * W                      # terrain height above the street, in tiles
objects = []


def put(x, y, c):
    grid[y][x] = c


def fill(x0, y0, x1, y1, c):
    """Inclusive tile rectangle."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            grid[y][x] = c


def oneway(x0, x1, row):
    fill(x0, row, x1, row, '=')


def raise_(x0, x1, h):
    """Solid terrain h tiles above the street over columns [x0, x1)."""
    for x in range(x0, x1):
        hh[x] = max(hh[x], h)


def pt(type_, x, y, **props):
    objects.append({'type': type_, 'x': x, 'y': y, 'props': props})


def rc(type_, x, y, w, h, **props):
    objects.append({'type': type_, 'x': x, 'y': y, 'w': w, 'h': h, 'props': props})


def enemy(name, x, feet, facing=-1, **props):
    pt('enemy', x, feet, enemy=name, facing=facing, **props)


def staircase(x, row, n, width=4):
    """n one-way steps going up to the right, each 3 tiles higher than the last (one jump each)."""
    for i in range(n):
        oneway(x + i * width, x + i * width + width - 1, row - 3 * i)


def cannon(x, ped_w=3, ped_h=2, direction=-1):
    """A cannon on the street with a crate stack behind it; it fires along the street at torso height."""
    pt('cannon', x, F - ped_h, dir=direction, interval=3.0)
    if direction < 0:
        raise_(x + 1, x + 1 + ped_w, ped_h)
    else:
        raise_(x - ped_w, x, ped_h)


def cellar(xe, length, corridor_top, extra_wall=None):
    """A stairwell down from a one-way bridge in the street into a corridor under it. Returns the interior bounds.
    Steps: floor rows F+3, F+6, F+9. The corridor interior spans rows corridor_top .. F+8."""
    oneway(xe, xe + 8, F)                                  # the bridge: the street stays unbroken
    fill(xe, F + 1, xe + 8, F + 8, '.')                    # the shaft
    fill(xe, F + 3, xe + 2, F + 9, '#')                    # step 1
    fill(xe + 3, F + 6, xe + 5, F + 9, '#')                # step 2
    fill(xe + 6, F + 9, xe + 6 + length, F + 9, '#')       # corridor floor
    fill(xe + 6, F + 3, xe + 8, F + 8, '.')
    fill(xe + 9, corridor_top, xe + 6 + length - 1, F + 8, '.')
    return xe + 9, xe + 6 + length - 1


# ----------------------------------------------------------------------------------------- S1 (0-35)
pt('player_start', 2, F - 1, facing=1)
pt('loot_stand', 14, F - 1, kind='weapon')

# ----------------------------------------------------------------------------------------- S2 (36-147)
pt('lucky_block', 44, F - 3)
enemy('soldier', 52, F - 1)
enemy('soldier', 56, F - 1)
raise_(64, 66, 2)                                             # crates
for dx in range(3):
    enemy('war_hound', 84 + dx * 3, F - 1, group='hounds_s2')
raise_(98, 101, 3); raise_(101, 121, 6); raise_(121, 124, 3)   # the rampart: two steps up, a wall walk, two down
enemy('crossbowman', 108, F - 7)
enemy('crossbowman', 114, F - 7)
enemy('soldier', 132, F - 1)
enemy('soldier', 136, F - 1)
enemy('battle_mage', 141, F - 1)
enemy('knight', 145, F - 1)

# ----------------------------------------------------------------------------------------- S3 (148-259)
for cx in (168, 192, 214, 238):
    cannon(cx)                                                 # 4 cannons, each with a 3 x 2 crate stack
enemy('crossbowman', 194, F - 3)                              # atop the stacks
enemy('crossbowman', 216, F - 3)
enemy('soldier', 178, F - 1)
enemy('battle_mage', 250, F - 1)
pt('lucky_block', 202, F - 3)
oneway(224, 227, F - 3); oneway(228, 231, F - 6); oneway(232, 235, F - 9)   # the key detour (about 4 s)
pt('key', 233, F - 10)

# ----------------------------------------------------------------------------------------- S4 (260-367)
staircase(266, F - 3, 7)                                      # balconies up the tower: 3, 6 ... 21 tiles
ROOF = F - 24
fill(294, ROOF, 349, ROOF + 4, '#')                           # the rooftops, 24 tiles above the street
for gx in (312, 330):
    fill(gx, ROOF, gx + 2, ROOF + 4, '.')                     # gaps between the roofs
enemy('crossbowman', 304, ROOF - 1)
enemy('crossbowman', 322, ROOF - 1)
enemy('soldier', 284, F - 1)
for dx in range(3):
    enemy('war_hound', 300 + dx * 3, F - 1, group='hounds_s4')
pt('guide_arrow', 262, F - 2, angle=0)
lo, hi = cellar(334, 24, F + 3)                               # the side path: key chest, cursed chest, Knight, ability
enemy('soldier', 347, F + 8)
enemy('battle_mage', 351, F + 8)
pt('key_chest', 352, F + 8)
pt('cursed_chest', 356, F + 8)
enemy('knight', 360, F + 8)
pt('loot_stand', 363, F + 8, kind='ability')
pt('guide_arrow', 330, F - 2, angle=0)

# ----------------------------------------------------------------------------------------- S5 (368-409)
AX0, AX1 = 370, 407                                           # combat arena interior, 38 x 18
fill(AX0 - 1, F - 19, AX1 + 1, F - 19, '#')
fill(AX0 - 1, F - 19, AX0 - 1, F - 4, '#'); fill(AX1 + 1, F - 19, AX1 + 1, F - 4, '#')
oneway(376, 381, F - 3); oneway(396, 401, F - 3); oneway(383, 388, F - 6)
rc('arena', AX0, F - 18, 38, 18, id='palace_yard', kind='combat', parTime=29)
rc('arena_door', AX0 - 1, F - 3, 1, 3, arena='palace_yard', role='entry')
rc('arena_door', AX1 + 1, F - 3, 1, 3, arena='palace_yard', role='entry')
WAVES = [
    [('soldier', 380, F - 1), ('soldier', 384, F - 1), ('battle_mage', 404, F - 1)],
    [('war_hound', 374, F - 1), ('war_hound', 376, F - 1), ('war_hound', 378, F - 1)],
    [('soldier', 380, F - 1), ('crossbowman', 402, F - 1), ('crossbowman', 405, F - 1), ('knight', 394, F - 1)],
]
for n, wave in enumerate(WAVES, start=1):
    for name, x, feet in wave:
        extra = {'group': 'hounds_yard'} if name == 'war_hound' else {}
        enemy(name, x, feet, wave=n, arena='palace_yard', **extra)

# ----------------------------------------------------------------------------------------- S6 (410-551)
pt('merchant_spot', 424, F - 1)
pt('lucky_block', 438, F - 3)
rc('dragon_warning', 436, F - 6, 1, 6)                        # 40+ tiles before the side arena
for cx in (444, 456, 540, 548):
    cannon(cx)
enemy('crossbowman', 446, F - 3)
enemy('crossbowman', 542, F - 3)
enemy('soldier', 450, F - 1)
# The barbican: the street runs through a tunnel under the Dragon's empty side arena.
BX0, BX1 = 477, 518                                           # wall columns of the arena
fill(BX0, F - 30, BX1, F - 30, '#')                           # ceiling
fill(BX0, F - 30, BX0, F - 8, '#'); fill(BX1, F - 30, BX1, F - 8, '#')
fill(BX0, F - 9, BX1, F - 8, '#')                             # the slab: the arena floor surface is row F - 9
fill(BX0 + 1, F - 29, BX1 - 1, F - 10, '.')                   # interior 40 x 20
fill(BX0, F - 12, BX0, F - 10, '.')                           # the opening, 3 tiles at floor level
fill(BX0, F - 7, BX1, F - 1, '.')                             # the tunnel under the slab
oneway(463, 466, F - 3); oneway(467, 470, F - 6); oneway(471, 476, F - 9)   # balconies up to the opening
oneway(494, 501, F - 15)                                      # the central platform: 128 px wide, 96 px up
rc('arena', BX0 + 1, F - 29, 40, 20, id='gate_hall', kind='side')
enemy('soldier', 490, F - 1)
enemy('battle_mage', 508, F - 1)
oneway(522, 525, F - 3); oneway(526, 529, F - 6); oneway(530, 533, F - 9); oneway(534, 537, F - 12)   # key #2: harder
pt('key', 536, F - 13)
pt('guide_arrow', 458, F - 2, angle=0)

# ----------------------------------------------------------------------------------------- S7 (552-631)
for dx in range(3):
    enemy('war_hound', 556 + dx * 3, F - 1, group='hounds_s7')
pt('lucky_block', 566, F - 3)
pt('key_chest', 572, F - 1)
enemy('battle_mage', 596, F - 1)
enemy('knight', 620, F - 1)
pt('key_chest', 626, F - 1)
# The timed room: a sealed cellar behind a door (blink blocks seal every wall tile).
fill(584, F + 1, 592, F + 8, '.'); oneway(584, 592, F)
fill(584, F + 3, 586, F + 9, '#'); fill(587, F + 6, 589, F + 9, '#')
fill(590, F + 9, 615, F + 9, '#')
fill(590, F + 6, 592, F + 8, '.')
fill(593, F + 6, 614, F + 8, '.')
fill(600, F + 5, 615, F + 5, '@'); fill(600, F + 9, 615, F + 9, '@')
fill(615, F + 5, 615, F + 9, '@'); fill(600, F + 5, 600, F + 5, '@'); fill(600, F + 9, 600, F + 9, '@')
fill(600, F + 6, 600, F + 8, '.')
rc('timed_door', 600, F + 6, 1, 3, id='kingdom_timed', side='left', timeLimit=130)
pt('timed_chest', 612, F + 8, door='kingdom_timed')
pt('guide_arrow', 580, F - 2, angle=0)

# ----------------------------------------------------------------------------------------- S8 (632-703)
BA0, BA1 = 636, 675                                           # boss arena interior, 40 x 16
fill(BA0 - 1, F - 17, BA1 + 1, F - 17, '#')
fill(BA0 - 1, F - 17, BA0 - 1, F - 4, '#'); fill(BA1 + 1, F - 17, BA1 + 1, F - 4, '#')
rc('arena', BA0, F - 16, 40, 16, id='castle_gate', kind='boss', boss='black_knight', entry='left')
rc('arena_door', BA0 - 1, F - 3, 1, 3, arena='castle_gate', role='entry')
rc('arena_door', BA1 + 1, F - 3, 1, 3, arena='castle_gate', role='exit')
rc('exit', 695, F - 3, 2, 3)

# ----------------------------------------------------------------------------------------- terrain from the height profile
for x in range(W):
    for y in range(F - hh[x], F):
        grid[y][x] = '#'

for idx, x0, x1 in SECTIONS:
    rc('section', x0, 0, x1 - x0, H, index=idx)

# ----------------------------------------------------------------------------------------- main path
# The street, over the rampart; crates and cannon stacks are jumped, not routed over.
blocked = {x for x in range(W) if hh[x] > 0}
def street(x):
    while x in blocked:
        x += 1
    return (x, F - 1)
clean = [(2, F - 1)]
x = 18
while x < 90:
    clean.append(street(x)); x += 16
clean += [(96, F - 1), (99, F - 4), (103, F - 7), (118, F - 7), (122, F - 4), (126, F - 1)]
x = 142
while x < 690:
    clean.append(street(x)); x += 16
clean.append((696, F - 1))

man = {
    'levelId': 'kingdom', 'kind': 'stage', 'stage': 3, 'biome': 'kingdom', 'width': W, 'height': H,
    'chunks': [{'file': 'kingdom.txt', 'x': 0, 'y': 0}],
    'legend': {}, 'objects': objects, 'mainPath': [list(p) for p in clean],
}
with open(os.path.join(HERE, 'level.json'), 'w', encoding='utf-8', newline='\n') as f:
    json.dump(man, f, indent=1)
    f.write('\n')
with open(os.path.join(HERE, 'kingdom.txt'), 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(''.join(r) for r in grid) + '\n')

length = sum(((clean[i][0] - clean[i - 1][0]) ** 2 + (clean[i][1] - clean[i - 1][1]) ** 2) ** 0.5 for i in range(1, len(clean)))
print('kingdom: wrote %dx%d, main path %.1f tiles, %d objects' % (W, H, length, len(objects)))
