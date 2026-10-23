#!/usr/bin/env python3
"""Castle section versions v2 and v3 (06 §8.7; docs/levels/castle.md "Versions"). Writes levels-src/castle/s<N>/v<V>.{txt,json}.

Every version keeps v1's size, anchors (the castle floor, row 110, at both edges) and objects (only their places change, see
variants_lib.Sec). Hazards sit in the ground: spike pits are cut into the floor (two open rows over a row of spikes), swinging
blades hang from galleries grown out of a tower, bridges (`%`) span the pits (5 tiles at most). A gate tower is a left wall with a
3-tile doorway, a 4-wide wall-jump shaft and a rampart. Rows grow downward. Main-path vertices are standing cells (row 109).
Run: python3 levels-src/castle/gen_variants.py && npm run levels
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from variants_lib import Sec  # noqa: E402

LV = 'castle'
F = 110


def floor(v):
    v.ground(0, v.w - 1, F)


def stack(v, cannon_x):
    v.fill(cannon_x + 1, cannon_x + 3, F - 2, F - 1)


def crate(v, x0, x1, h):
    v.fill(x0, x1, F - h, F - 1)


def pit(v, x0, x1, bridge=False):
    v.carve(x0, x1, F, F + 1)
    v.fill(x0, x1, F + 2, F + 2, '^')
    if bridge:
        v.fill(x0, x1, F, F, '%')


def tower(v, left, right_len=23, height=14):
    """Left wall `left`..+3 with a doorway, shaft +4..+7, rampart from +8; returns the rampart's last column."""
    v.fill(left, left + 3, F - height, F - 1)
    v.carve(left, left + 3, F - 3, F - 1)
    rx = left + 8
    v.fill(rx, rx + right_len - 1, F - height, F - 1)
    v.fill(left + 4, rx - 1, F - height, F - height, '=')
    return rx + right_len - 1


def gallery(v, x0, x1, blade_i, blade_x, phases_idx=None):
    """A gallery slab (rows 101-102) with the blades hanging under it at blade_x."""
    v.fill(x0, x1, F - 9, F - 8)
    for i, bx in zip(blade_i, blade_x):
        v.mv(i, bx, F - 7)


def free_path(v, xs):
    out = []
    for x in xs:
        while v.g[F - 1][x] != '.' or v.g[F][x] not in '#=%':
            x += 1
        out.append([x, F - 1])
    return out


# ------------------------------------------------------------------ § 2 Outer ward (100 wide)
def s2_v2():
    """Parade ground: a raised stage 12 wide (3 high) with a Mage on it, a gargoyle stack before it and one after; the street stays level."""
    v = Sec(LV, 2, 'open'); floor(v)
    crate(v, 44, 55, 3); crate(v, 30, 32, 3); crate(v, 66, 68, 3)
    v.mvs({0: (10, 107), 1: (14, 109), 2: (18, 109), 3: (22, 109), 4: (31, 106), 5: (50, 106), 6: (60, 109), 7: (63, 109), 8: (72, 109),
           9: (67, 106), 10: (86, 109), 11: (94, 109)})
    v.path = [[4, 109], [20, 109], [36, 109], [58, 109], [70, 109], [84, 109]]
    return v


def s2_v3():
    """Rampart steps: two 3-tile steps up to a 6-tile wall walk (a gargoyle and a Mage on it) and two steps down; the second stack stays."""
    v = Sec(LV, 2, 'open'); floor(v)
    crate(v, 36, 38, 3); crate(v, 39, 52, 6); crate(v, 53, 55, 3); crate(v, 74, 76, 3)
    v.mvs({0: (8, 107), 1: (12, 109), 2: (16, 109), 3: (20, 109), 4: (42, 103), 5: (48, 103), 6: (60, 109), 7: (64, 109), 8: (68, 109),
           9: (75, 106), 10: (84, 109), 11: (94, 109)})
    v.path = [[4, 109], [20, 109], [34, 109], [37, 106], [40, 103], [50, 103], [53, 106], [56, 109], [68, 109], [84, 109]]
    return v


# ------------------------------------------------------------------ § 3 Bridges, blades and the first tower (106 wide)
def s3_common(v):
    floor(v)
    v.stamp(90, 105, 98, 109)                # the key's ladder of planks, as v1


def s3_v2():
    """Tower first: the gallery with two blades, the tower, the second gallery, then three bridged spike pits before the key's ladder."""
    v = Sec(LV, 3, 'open'); s3_common(v)
    gallery(v, 10, 21, (1, 2), (13, 18)); re = tower(v, 22)
    gallery(v, re + 1, re + 10, (3, 4), (re + 4, re + 8))
    for x0 in (70, 78, 86):
        pit(v, x0, x0 + 4, True)
    v.mvs({0: (66, 109), 5: (34, 95), 6: (46, 95), 7: (40, 95), 8: (100, 107), 9: (105, 100)})
    v.path = [[0, 109], [6, 109], [12, 109], [18, 109], [23, 109], [28, 109], [30, 95], [41, 95], [51, 95], [56, 100], [60, 100],
              [65, 109], [68, 109], [76, 109], [84, 109], [92, 109], [98, 109]]
    return v


def s3_v3():
    """Two pits first, then the guard, the gallery, the tower (shifted right), the second gallery and the last bridged pit."""
    v = Sec(LV, 3, 'open'); s3_common(v)
    for x0 in (6, 14):
        pit(v, x0, x0 + 4, True)
    gallery(v, 30, 41, (1, 2), (33, 38)); re = tower(v, 42)
    gallery(v, re + 1, re + 10, (3, 4), (re + 4, re + 8))
    pit(v, 86, 90, True)
    v.mvs({0: (24, 109), 5: (54, 95), 6: (66, 95), 7: (60, 95), 8: (100, 107), 9: (105, 100)})
    v.path = [[0, 109], [4, 109], [12, 109], [20, 109], [26, 109], [32, 109], [43, 109], [48, 109], [50, 95], [61, 95], [71, 95],
              [76, 100], [80, 100], [85, 109], [92, 109], [98, 109]]
    return v


# ------------------------------------------------------------------ § 4 Branch (100 wide)
def cellar(v, xe, length=24):
    """A stairwell down from a plank hatch into a corridor under the floor (rows 113-118, floor row 119)."""
    v.fill(xe, xe + 8, F, F, '=')
    v.carve(xe, xe + 8, F + 1, F + 8)
    v.fill(xe, xe + 2, F + 3, F + 9)
    v.fill(xe + 3, xe + 5, F + 6, F + 9)
    v.carve(xe + 6, xe + 8, F + 3, F + 8)
    v.carve(xe + 9, min(xe + 6 + length - 1, v.w - 1), F + 3, F + 8)


def spike_chain(v, xs):
    """Three 4-wide spike pits (open pits) with a chain of four planks 3 over the floor (the skip), each plank 2 before its pit; the last plank follows the last pit."""
    for x0 in xs:
        pit(v, x0, x0 + 3)
    for x0 in xs:
        v.fill(x0 - 2, x0 + 1, F - 3, F - 3, '=')
    v.fill(xs[-1] + 5, xs[-1] + 8, F - 3, F - 3, '=')


def s4_v2():
    """Spikes first: the three spike pits and their plank chain right at the start, then the guard, the stacks and the armours before the cellar."""
    v = Sec(LV, 4, 'open'); floor(v)
    spike_chain(v, (14, 21, 28))
    crate(v, 48, 50, 3); crate(v, 58, 60, 3)
    cellar(v, 70)
    v.mvs({0: (49, 106), 1: (42, 109), 2: (59, 106), 3: (54, 109), 4: (64, 109), 5: (67, 109), 6: (2, 108), 7: (81, 118), 8: (84, 118),
           9: (86, 118), 10: (89, 118), 11: (92, 118), 12: (97, 118), 13: (68, 108)})
    v.path = [[4, 109], [10, 109], [19, 109], [26, 109], [34, 109], [40, 109], [46, 109], [53, 109], [56, 109], [63, 109], [66, 109], [73, 109], [89, 109]]
    return v


def s4_v3():
    """Cellar first: the stairwell is at the start of the district, then the guard, the stacks and the armour, and the spike pits last."""
    v = Sec(LV, 4, 'open'); floor(v)
    cellar(v, 14)
    crate(v, 28, 30, 3); crate(v, 38, 40, 3)
    spike_chain(v, (46, 53, 60))
    v.mvs({0: (29, 106), 1: (6, 109), 2: (39, 106), 3: (34, 109), 4: (74, 109), 5: (78, 109), 6: (2, 108), 7: (25, 118), 8: (28, 118),
           9: (30, 118), 10: (33, 118), 11: (36, 118), 12: (41, 118), 13: (12, 108)})
    v.path = [[4, 109], [10, 109], [18, 109], [26, 109], [33, 109], [42, 109], [51, 109], [58, 109], [66, 109], [74, 109], [90, 109]]
    return v


# ------------------------------------------------------------------ § 6 Cannon gallery and the second tower (124 wide)
def s6_common(v, ladder_x=0):
    floor(v)
    v.stamp(28, 42, 99, 108)                 # the key's ladder of planks, as v1
    v.mv(2, 39, 100)


def s6_v2():
    """Tower first: the gallery and tower right after the ladder, then the bridged pit and the four cannons with their crate stacks."""
    v = Sec(LV, 6, 'open'); s6_common(v)
    gallery(v, 44, 53, (11, 12), (47, 51)); re = tower(v, 54, 13)
    pit(v, 78, 82, True)
    for x in (88, 96, 104, 112):
        stack(v, x)
    crate(v, 100, 102, 3)
    v.mvs({1: (26, 107), 3: (88, 108), 4: (96, 108), 5: (104, 108), 6: (112, 108), 7: (101, 106), 8: (92, 109), 9: (110, 109), 10: (95, 109), 13: (68, 95)})
    v.path = [[11, 109], [27, 109], [43, 109], [49, 109], [55, 109], [59, 109], [62, 95], [68, 95], [73, 95], [76, 109], [84, 109]] + free_path(v, [86, 94, 101, 108, 116]) + [[122, 109]]
    return v


def s6_v3():
    """Pit first: the bridged pit right after the ladder, then the four cannons, and the gallery and tower close to the exit."""
    v = Sec(LV, 6, 'open'); s6_common(v)
    pit(v, 46, 50, True)
    for x in (56, 64, 72, 80):
        stack(v, x)
    crate(v, 76, 78, 3)
    gallery(v, 89, 98, (11, 12), (92, 96)); tower(v, 99, 13)
    v.mvs({1: (26, 107), 3: (56, 108), 4: (64, 108), 5: (72, 108), 6: (80, 108), 7: (77, 106), 8: (53, 109), 9: (86, 109), 10: (61, 109), 13: (113, 95)})
    v.path = [[11, 109], [27, 109], [43, 109], [44, 109], [52, 109]] + free_path(v, [54, 62, 70, 85]) + [[100, 109], [104, 109], [107, 95], [113, 95], [118, 95], [122, 109]]
    return v


# ------------------------------------------------------------------ § 7 Loot area (78 wide)
def s7_room(v, xe, w, h):
    """The sealed timed room (35 blink blocks, door on its left wall) at the end of a cellar's stairwell."""
    v.fill(xe, xe + 8, F, F, '=')
    v.carve(xe, xe + 8, F + 1, F + 8)
    v.fill(xe, xe + 2, F + 3, F + 9)
    v.fill(xe + 3, xe + 5, F + 6, F + 9)
    xd = xe + 16
    top, bottom = F + 9 - h + 1, F + 9
    v.fill(xd, xd + w - 1, top, top, '@')
    v.fill(xd, xd + w - 1, bottom, bottom, '@')
    v.fill(xd + w - 1, xd + w - 1, top + 1, bottom - 1, '@')
    if h > 5:
        v.fill(xd, xd, top + 1, bottom - 4, '@')
    v.carve(xd, xd, bottom - 3, bottom - 1)
    v.carve(xd + 1, xd + w - 2, top + 1, bottom - 1)
    v.carve(xe + 9, xd - 1, F + 6, F + 8)
    v.mv(8, xd, bottom - 3, 1, 3)
    v.mv(9, xd + w - 4, bottom - 1)


def s7_v2():
    """Early cellar: the stairwell at cols 14-22 and a 14 x 7 sealed room under the first third of the road."""
    v = Sec(LV, 7, 'open'); floor(v)
    s7_room(v, 14, 14, 7)
    v.mvs({0: (6, 107), 1: (10, 109), 2: (12, 109), 3: (28, 109), 4: (50, 109), 5: (60, 109), 6: (46, 109), 7: (74, 109), 10: (4, 108)})
    v.path = [[3, 109], [19, 109], [35, 109], [51, 109], [67, 109]]
    return v


def s7_v3():
    """Late cellar: the stairwell at cols 40-48 and a tall 12 x 9 sealed room under the road, the Executioner guarding the hatch."""
    v = Sec(LV, 7, 'open'); floor(v)
    s7_room(v, 40, 12, 9)
    v.mvs({0: (6, 107), 1: (12, 109), 2: (18, 109), 3: (28, 109), 4: (62, 109), 5: (72, 109), 6: (34, 109), 7: (76, 109), 10: (4, 108)})
    v.path = [[3, 109], [19, 109], [35, 109], [51, 109], [67, 109]]
    return v


def main():
    only = sys.argv[1:]
    table = {2: (s2_v2, s2_v3), 3: (s3_v2, s3_v3), 4: (s4_v2, s4_v3), 6: (s6_v2, s6_v3), 7: (s7_v2, s7_v3)}
    for sec, fns in table.items():
        if only and str(sec) not in only:
            continue
        for ver, fn in zip((2, 3), fns):
            fn().write(ver)


main()
