#!/usr/bin/env python3
"""Swamps section versions v2 and v3 (06 §8.7; docs/levels/swamps.md "Versions"). Writes levels-src/swamps/s<N>/v<V>.{txt,json}.

Every version keeps v1's size, anchors (floor row 56 at both edges) and objects (only their places change, see variants_lib.Sec).
Water is 2 tiles deep (rows 56-57) over a solid floor; a pool is `pool()`. Rows grow downward; main-path vertices are standing
cells (dry ground: row 55; the bottom of a pool: row 57). Run: python3 levels-src/swamps/gen_variants.py && npm run levels
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from variants_lib import Sec  # noqa: E402

LV = 'swamps'


def land(v):
    v.ground(0, v.w - 1, 56)


def pool(v, x0, x1, top=56):
    v.fill(x0, x1, top, top + 1, '~')


def mound(v, x0, x1, top=54):
    """A dry mound `56 - top` tiles high with a 1-tile step on each side."""
    v.fill(x0, x1, top, 55)
    v.fill(x0 - 1, x0 - 1, 55, 55)
    v.fill(x1 + 1, x1 + 1, 55, 55)


# ------------------------------------------------------------------ § 2 Bog (112 x 80)
def s2_v2():
    """Cypress islands: five wide pools, dry islands between them with a raised mound where the Witches stand."""
    v = Sec(LV, 2, 'open'); land(v)
    for x0, x1 in ((6, 18), (29, 36), (47, 54), (66, 73), (85, 92)):
        pool(v, x0, x1)
    for x0, x1 in ((21, 26), (39, 44), (57, 63), (76, 82)):
        mound(v, x0, x1)
    v.mvs({0: (9, 57), 1: (14, 57), 2: (32, 57), 3: (50, 57), 4: (40, 53), 5: (70, 57), 6: (12, 51), 7: (58, 51), 8: (81, 51),
           9: (43, 53), 10: (60, 53), 11: (79, 53), 12: (104, 55), 13: (23, 51)})
    v.path = [[3, 55], [12, 57], [19, 55], [28, 55], [32, 57], [37, 55], [46, 55], [50, 57], [55, 55], [65, 55], [70, 57], [74, 55],
              [84, 55], [89, 57], [93, 55], [111, 55]]
    return v


def s2_v3():
    """Twin marshes: two big pools with a long dry causeway between them and three low stumps."""
    v = Sec(LV, 2, 'open'); land(v)
    pool(v, 6, 27); pool(v, 62, 83)
    for x0, x1 in ((36, 39), (46, 49), (54, 57)):
        v.fill(x0, x1, 54, 55)
    v.mvs({0: (12, 57), 1: (20, 57), 2: (25, 57), 3: (68, 57), 4: (43, 55), 5: (75, 57), 6: (16, 51), 7: (53, 51), 8: (86, 51),
           9: (38, 53), 10: (56, 53), 11: (88, 55), 12: (104, 55), 13: (31, 53)})
    v.path = [[3, 55], [14, 57], [28, 55], [61, 55], [70, 57], [84, 55], [111, 55]]
    return v


# ------------------------------------------------------------------ § 3 Dark hollow (112 x 80)
def s3_common(v, pools, ledges, spiders, lucky_block, key_dx=0):
    land(v)
    for x0, x1 in pools:
        pool(v, x0, x1)
    for x0, x1, y, c in ledges:
        v.fill(x0, x1, y, y, c)
    v.stamp(90, 110, 40, 55, key_dx)            # the key's ladder of planks, as v1 (shifted)
    mv = {i: (x, 48) for i, x in enumerate(spiders)}
    mv[14] = lucky_block
    mv[15] = (104 + key_dx, 43)
    v.mvs(mv)


def s3_v2():
    """Mossy hollow: pools at 12-23, 36-45, 58-67, 80-89 with a plank across each, and a dry stone block for the Lucky Block."""
    v = Sec(LV, 3, 'open')
    s3_common(v, ((12, 23), (36, 45), (58, 67), (80, 89)), ((15, 20, 52, '='), (38, 43, 52, '='), (60, 65, 52, '='), (82, 87, 52, '='),
                                                              (47, 52, 54, '#')), (17, 40, 62, 84), (49, 52))
    v.fill(47, 52, 54, 55)
    v.path = [[7, 55], [28, 55], [72, 55], [95, 55], [111, 55]]
    return v


def s3_v3():
    """Stepping logs: pools at 6-13, 26-39, 52-59, 72-83 under higher plank logs; the key's ladder stands 4 tiles further left."""
    v = Sec(LV, 3, 'open')
    s3_common(v, ((6, 13), (26, 39), (52, 59), (72, 83)), ((7, 12, 51, '='), (28, 37, 52, '='), (53, 58, 51, '='), (74, 81, 52, '='),
                                                             (62, 67, 54, '#')), (9, 32, 55, 77), (65, 52), -4)
    v.fill(62, 67, 54, 55)
    v.path = [[3, 55], [20, 55], [45, 55], [70, 55], [91, 55], [111, 55]]
    return v


# ------------------------------------------------------------------ § 4 Bog branch (108 x 80)
def s4_vines(v, ys, x0=6, step=8):
    for k, y in enumerate(ys):
        v.mv(12 + k, x0 + step * k, y)


def s4_stair(v, x0):
    """The side route's way back: four 2-tile steps (cols x0.., 2 wide each) up to a plank ceiling at row 56."""
    for j in range(4):
        v.fill(x0 + 2 * j, x0 + 2 * j + 1, 64 - 2 * j, 65)
    v.fill(x0 + 8, x0 + 9, 58, 65)


def s4_v2():
    """Cellar stairs: solid road over a cellar. A plank hatch (cols 24-31) drops into it; a stair of four steps climbs back through a second hatch."""
    v = Sec(LV, 4, 'open'); land(v)
    v.carve(24, 89, 58, 65)                  # the cellar
    v.carve(24, 31, 57, 57)                  # the hatch shaft
    v.fill(24, 31, 56, 56, '=')
    v.carve(78, 89, 57, 57)
    v.fill(78, 89, 56, 56, '=')
    s4_stair(v, 80)
    v.mvs({0: (20, 55), 1: (46, 55), 2: (36, 55), 3: (58, 55), 4: (70, 51), 5: (92, 55), 6: (28, 62), 7: (40, 65), 8: (56, 65),
           9: (64, 65), 10: (69, 65), 11: (74, 65), 25: (4, 53), 26: (99, 53)})
    s4_vines(v, [47, 44] * 6 + [47])
    v.path = [[13, 55], [19, 55], [45, 55], [71, 55], [97, 55], [107, 55]]
    return v


def s4_v3():
    """Twin bridges: two plank bridges over two cellars joined by a low tunnel under the middle; the stair back is in the second one."""
    v = Sec(LV, 4, 'open'); land(v)
    v.carve(16, 44, 57, 65); v.fill(16, 44, 56, 56, '=')
    v.carve(60, 93, 57, 65); v.fill(60, 93, 56, 56, '=')
    v.carve(45, 59, 60, 65)                  # the tunnel under the middle
    s4_stair(v, 82)
    v.fill(92, 93, 58, 65)
    v.mvs({0: (20, 55), 1: (46, 55), 2: (32, 55), 3: (58, 55), 4: (70, 51), 5: (86, 55), 6: (26, 62), 7: (36, 65), 8: (52, 65),
           9: (66, 65), 10: (72, 65), 11: (78, 65), 25: (4, 53), 26: (99, 53)})
    s4_vines(v, [47, 45, 44, 44, 45, 47, 47, 45, 44, 43, 44, 45, 47])
    v.path = [[13, 55], [19, 55], [45, 55], [71, 55], [97, 55], [107, 55]]
    return v


# ------------------------------------------------------------------ § 6 Deep swamp (142 x 80)
def s6_front(v, pools, mounds, underpass):
    """The approach (cols 0-47) and the underpass pits (cols 54-109) rebuilt; the arena, the planks, the steps and the exit stay as v1."""
    v.fill(0, 47, 52, 55, '.')
    v.fill(0, 47, 56, 57, '#')
    for x0, x1 in pools:
        pool(v, x0, x1)
    for x0, x1, top in mounds:
        mound(v, x0, x1, top)
    v.fill(54, 109, 64, 65, '#')
    for x0, x1 in underpass:
        v.fill(x0, x1, 64, 65, '~')


def s6_v2():
    """Flooded ruin: three pools with a raised mound for the Witch, a short dry bank, and an underpass with its pits early and late and two stalactites."""
    v = Sec(LV, 6, 'v1')
    s6_front(v, ((3, 14), (23, 34), (39, 47)), ((17, 20, 54),), ((62, 69), (84, 97)))
    v.fill(66, 68, 57, 58); v.fill(86, 88, 57, 58)
    v.mvs({4: (8, 57), 5: (28, 57), 6: (42, 48), 7: (24, 51), 9: (19, 53), 22: (36, 53)})
    v.path = [[23, 57], [36, 55], [43, 57], [47, 57], [51, 59], [55, 63], [60, 63], [75, 63], [100, 63], [109, 63], [112, 59], [116, 55], [141, 55]]
    return v


def s6_v3():
    """Sunken stumps: three pools split by a dry bank and a stump, and an underpass with three small pits crossed on planks."""
    v = Sec(LV, 6, 'v1')
    s6_front(v, ((3, 10), (15, 26), (31, 47)), ((29, 30, 54),), ((66, 73), (78, 85), (100, 105)))
    v.fill(66, 73, 61, 61, '='); v.fill(100, 105, 61, 61, '=')
    v.mvs({4: (6, 57), 5: (20, 57), 6: (39, 48), 7: (14, 51), 9: (29, 53), 22: (12, 53)})
    v.path = [[23, 57], [28, 54], [29, 53], [30, 53], [34, 57], [47, 57], [51, 59], [55, 63], [64, 63], [75, 63], [90, 63], [109, 63], [112, 59], [116, 55], [141, 55]]
    return v


# ------------------------------------------------------------------ § 7 Witch's grove (80 x 80)
def s7_room(v, xd, top, w, h, planks):
    """The sealed timed room (37 blink blocks): door on the left wall, a 4-wide shaft on its left, plank hatch over the shaft."""
    bottom = top + h - 1
    v.fill(xd, xd + w - 1, top, top, '@')
    v.fill(xd, xd + w - 1, bottom, bottom, '@')
    v.fill(xd + w - 1, xd + w - 1, top + 1, bottom - 1, '@')
    v.fill(xd, xd, top + 1, bottom - 4, '@')
    v.carve(xd + 1, xd + w - 2, top + 1, bottom - 1)
    v.mv(8, xd, bottom - 3, 1, 3)
    v.mv(9, xd + w // 2, bottom - 1)
    v.carve(xd - 4, xd - 1, 57, bottom - 1)                  # the shaft
    v.carve(xd - 8, xd - 1, 57, 59)                          # its wide top
    v.fill(planks[0], planks[1], 56, 56, '=')


def s7_v2():
    """Cellar vault: the sealed room lies deep (rows 58-67) under the road's left half, with a plank hatch to drop through."""
    v = Sec(LV, 7, 'open'); land(v)
    s7_room(v, 28, 58, 12, 10, (20, 27))
    v.mvs({0: (6, 55), 1: (14, 51), 2: (46, 55), 3: (60, 55), 4: (72, 55), 5: (11, 53), 6: (17, 55), 7: (53, 55), 10: (19, 53), 11: (78, 53)})
    v.path = [[33, 55], [79, 55]]
    return v


def s7_v3():
    """Flat vault: a wide, low sealed room (16 x 6) sits under the middle of the road, its hatch just before it."""
    v = Sec(LV, 7, 'open'); land(v)
    s7_room(v, 44, 59, 16, 6, (36, 43))
    v.mvs({0: (6, 55), 1: (16, 51), 2: (24, 55), 3: (68, 55), 4: (74, 55), 5: (12, 53), 6: (30, 55), 7: (64, 55), 10: (33, 53), 11: (78, 53)})
    v.path = [[33, 55], [79, 55]]
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
