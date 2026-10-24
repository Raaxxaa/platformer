#!/usr/bin/env python3
"""Kingdom section versions v2 and v3 (06 §8.7; docs/levels/kingdom.md "Versions"). Writes levels-src/kingdom/s<N>/v<V>.{txt,json}.

Every version keeps v1's size, anchors (the street, floor row 72, at both edges) and objects (only their places change, see
variants_lib.Sec). Cannons stand on the street with a 3 x 2 crate stack behind them (to their right, they fire left).
Rows grow downward. Main-path vertices are standing cells (the street: row 71). Run: python3 levels-src/kingdom/gen_variants.py && npm run levels
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from variants_lib import Sec  # noqa: E402

LV = 'kingdom'
F = 72


def street(v):
    v.ground(0, v.w - 1, F)


def stack(v, cannon_x):
    v.fill(cannon_x + 1, cannon_x + 3, F - 2, F - 1)


def free_path(v, xs, end=None):
    """Street vertices at xs, each moved right until it stands on open street (not on a crate or stack)."""
    out = []
    for x in xs:
        while v.g[F - 1][x] != '.' or v.g[F][x] != '#':
            x += 1
        out.append([x, F - 1])
    return out


def length_ok(v):
    return v.path_length() / v.v1_length()


# ------------------------------------------------------------------ § 2 Sentry street (112 wide)
def s2_v2():
    """Market street: stall counters and two cloth awnings (planks) over the street; the crossbowmen sit on the awnings. The street stays level."""
    v = Sec(LV, 2, 'open'); street(v)
    for x0 in (36, 60, 76):
        v.fill(x0, x0 + 2, F - 2, F - 1)
    v.fill(64, 72, 66, 66, '='); v.fill(78, 86, 66, 66, '=')
    v.mvs({0: (12, 69), 1: (22, 71), 2: (26, 71), 3: (44, 71), 4: (47, 71), 5: (50, 71), 6: (68, 65), 7: (82, 65),
           8: (96, 71), 9: (100, 71), 10: (105, 71), 11: (109, 71)})
    v.path = [[14, 71], [34, 71], [56, 71], [72, 71], [92, 71], [106, 71]]
    return v


def s2_v3():
    """SPEC-GAP 51: the street under the bridge stays open (a shortcut of about 1.5 s). Gatehouse: two towers (6 high) joined by a plank bridge, with the street running through the archway below. The crossbowmen shoot from the bridge."""
    v = Sec(LV, 2, 'open'); street(v)
    v.fill(56, 58, F - 3, F - 1); v.fill(59, 65, F - 6, F - 1)
    v.fill(83, 89, F - 6, F - 1); v.fill(90, 92, F - 3, F - 1)
    v.fill(66, 82, 66, 66, '=')
    v.mvs({0: (10, 69), 1: (18, 71), 2: (22, 71), 3: (36, 71), 4: (39, 71), 5: (42, 71), 6: (70, 65), 7: (78, 65),
           8: (98, 71), 9: (102, 71), 10: (106, 71), 11: (109, 71)})
    v.path = [[14, 71], [30, 71], [46, 71], [54, 71], [57, 68], [60, 65], [65, 65], [83, 65], [89, 65], [91, 68], [94, 71], [106, 71]]
    return v


# ------------------------------------------------------------------ § 3 Cannon street (112 wide)
def s3_common(v, cannons, crossbow_stacks, soldier, lucky, extra_crates=()):
    street(v)
    for x in cannons:
        stack(v, x)
    for x0, x1 in extra_crates:
        v.fill(x0, x1, F - 2, F - 1)
    v.stamp(70, 90, 58, 70)                  # the key's ladder of planks, as v1
    mv = {i: (x, 70) for i, x in enumerate(cannons)}
    mv.update({4: (crossbow_stacks[0] + 2, 69), 5: (crossbow_stacks[1] + 2, 69), 6: (soldier, 71), 8: lucky})
    v.mvs(mv)


def s3_v2():
    """Cannon alley: the four cannons at 14, 38, 62 and 86, the crossbowmen on the second and third stacks."""
    v = Sec(LV, 3, 'open')
    s3_common(v, (14, 38, 62, 86), (38, 62), 28, (50, 69), ((96, 98),))
    v.mv(7, 102, 71)
    v.path = free_path(v, [10, 26, 42, 58, 74, 90, 106])
    return v


def s3_v3():
    """Barricades: the cannons in two pairs (18 and 30, 54 and 64) with crate barricades between, the crossbowmen on the second and third stacks."""
    v = Sec(LV, 3, 'open')
    s3_common(v, (18, 30, 54, 64), (30, 54), 44, (47, 69), ((40, 43), (96, 99)))
    v.mv(7, 104, 71)
    v.path = free_path(v, [10, 26, 42, 58, 74, 90, 106])
    return v


# ------------------------------------------------------------------ § 4 Tower district (108 wide)
def stairs(v, x0):
    """Seven plank balconies, each 4 wide and 3 higher than the last (one jump each), going up to the right from the street."""
    for i in range(7):
        v.fill(x0 + 4 * i, x0 + 4 * i + 3, 69 - 3 * i, 69 - 3 * i, '=')


def roofs(v, x0, x1, gaps):
    """Rooftops 24 tiles above the street (rows 48-52) from x0 to x1, with the 3-4 tile gaps (list of (a, b))."""
    v.fill(x0, x1, 48, 52)
    for a, b in gaps:
        v.carve(a, b, 48, 52)


def cellar(v, xe, length=24):
    """A stairwell down from a plank hatch in the street into a corridor under it (rows 75-80, floor row 81)."""
    v.fill(xe, xe + 8, F, F, '=')
    v.carve(xe, xe + 8, F + 1, F + 8)
    v.fill(xe, xe + 2, F + 3, F + 9)
    v.fill(xe + 3, xe + 5, F + 6, F + 9)
    v.fill(xe + 6, xe + 6 + length, F + 9, F + 9)
    v.carve(xe + 6, xe + 8, F + 3, F + 8)
    v.carve(xe + 9, xe + 6 + length - 1, F + 3, F + 8)


def s4_v2():
    """Spire stairs: the balconies start at the middle of the district and lead to the rooftops on the right; the cellar is at the far left."""
    v = Sec(LV, 4, 'open'); street(v)
    stairs(v, 30); roofs(v, 58, 101, ((70, 72), (86, 88)))
    cellar(v, 4)
    v.mvs({0: (64, 47), 1: (80, 47), 2: (20, 71), 3: (66, 71), 4: (69, 71), 5: (72, 71), 6: (2, 70), 7: (17, 80), 8: (21, 80),
           9: (24, 80), 10: (27, 80), 11: (30, 80), 12: (33, 80), 13: (14, 70)})
    v.path = [[10, 71], [26, 71], [42, 71], [58, 71], [74, 71], [90, 71], [106, 71]]
    return v


def s4_v3():
    """Split roofs: the balconies are at the left again, but the rooftops are three pieces with wider gaps, and the cellar lies in the middle of the street."""
    v = Sec(LV, 4, 'open'); street(v)
    stairs(v, 6); roofs(v, 34, 89, ((46, 48), (78, 81)))
    cellar(v, 44)
    v.mvs({0: (40, 47), 1: (66, 47), 2: (20, 71), 3: (86, 71), 4: (89, 71), 5: (92, 71), 6: (2, 70), 7: (57, 80), 8: (60, 80),
           9: (63, 80), 10: (66, 80), 11: (69, 80), 12: (72, 80), 13: (40, 70)})
    v.path = [[10, 71], [26, 71], [42, 71], [58, 71], [74, 71], [90, 71], [106, 71]]
    return v


# ------------------------------------------------------------------ § 6 Gate hall (142 wide)
def s6_clear(v):
    """Removes v1's crate stacks around the gate hall (the barbican, its balconies and the key's ladder stay)."""
    for x0 in (35, 47, 131, 139):
        v.fill(x0, x0 + 2, F - 2, F - 1, '.')


def s6_v2():
    """Wide gate: cannons at 30 and 40 on the left (the crossbowman on the second stack) and at 120 and 134 on the right."""
    v = Sec(LV, 6, 'v1'); s6_clear(v)
    for x in (30, 40, 120, 134):
        stack(v, x)
    v.mvs({1: (24, 69), 3: (30, 70), 4: (40, 70), 5: (120, 70), 6: (134, 70), 7: (42, 69), 8: (136, 69), 9: (36, 71), 11: (80, 71), 12: (98, 71)})
    v.path = free_path(v, [4, 20, 36, 50, 68, 84, 100, 116, 130])
    v.path.append([138, 71])
    return v


def s6_v3():
    """Barricaded gate: cannons at 36 and 48 on the left, crate barricades, and cannons at 122 and 128 on the right under the key's ladder."""
    v = Sec(LV, 6, 'v1'); s6_clear(v)
    for x in (36, 48, 122, 128):
        stack(v, x)
    v.fill(22, 24, F - 2, F - 1); v.fill(62, 64, F - 2, F - 1)
    v.mvs({1: (26, 69), 3: (36, 70), 4: (48, 70), 5: (122, 70), 6: (128, 70), 7: (38, 69), 8: (130, 69), 9: (30, 71), 11: (80, 71), 12: (98, 71)})
    v.path = free_path(v, [4, 18, 32, 44, 60, 68, 84, 100, 116, 134])
    return v


# ------------------------------------------------------------------ § 7 Parade ground (80 wide)
def s7_room(v, xe, w, h):
    """A cellar (stairwell and corridor) with the sealed timed room at its end: `w` x `h` with 35 blink blocks, the door on its left wall."""
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
    """Early cellar: the stairwell at cols 14-22, a 14 x 7 sealed room under the street's middle. The Hounds wait further on."""
    v = Sec(LV, 7, 'open'); street(v)
    s7_room(v, 14, 14, 7)
    v.mvs({0: (56, 71), 1: (59, 71), 2: (62, 71), 3: (6, 69), 4: (10, 71), 5: (26, 71), 6: (70, 71), 7: (76, 71), 10: (30, 70)})
    v.path = [[6, 71], [22, 71], [38, 71], [54, 71], [70, 71]]
    return v


def s7_v3():
    """Late cellar: the stairwell at cols 40-48 and a tall 12 x 9 sealed room right under the road. The Knight stands before the stairwell."""
    v = Sec(LV, 7, 'open'); street(v)
    s7_room(v, 40, 12, 9)
    v.mvs({0: (4, 71), 1: (7, 71), 2: (10, 71), 3: (16, 69), 4: (22, 71), 5: (70, 71), 6: (36, 71), 7: (76, 71), 10: (30, 70)})
    v.path = [[6, 71], [22, 71], [38, 71], [54, 71], [70, 71]]
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
