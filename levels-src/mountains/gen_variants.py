#!/usr/bin/env python3
"""Mountains section versions v2 and v3 (06 §8.7; docs/levels/mountains.md "Versions"). Writes levels-src/mountains/s<N>/v<V>.{txt,json}.

Every version keeps v1's size, its anchors (entry/exit rows) and its objects (only their places change, see variants_lib.Sec).
Rows grow downward. Main-path vertices are standing cells. Run: python3 levels-src/mountains/gen_variants.py && npm run levels
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from variants_lib import Sec  # noqa: E402

LV = 'mountains'


# ------------------------------------------------------------------ § 2 Rocky slopes (100 x 176, floor 164, open sky)
def s2_v2():
    """Quarry terraces: the road climbs three 2-tile terraces to a quarry floor and steps back down; one group per terrace."""
    v = Sec(LV, 2, 'open')
    v.profile([(0, 11, 164), (12, 35, 162), (36, 59, 160), (60, 83, 162), (84, 99, 164)])
    v.mvs({0: (16, 161), 1: (20, 161), 2: (27, 161), 11: (31, 159),
           3: (41, 153), 4: (46, 159), 5: (52, 159), 6: (57, 159), 7: (58, 152),
           8: (66, 161), 9: (76, 161), 10: (94, 163), 12: (98, 160)})
    v.path = [[0, 163], [11, 163], [12, 161], [35, 161], [36, 159], [59, 159], [60, 161], [83, 161], [84, 163], [99, 163]]
    return v


def s2_v3():
    """Boulder gully: the road sinks into a 3-tile gully in 1-tile steps and climbs out; Miners on a boulder and on shelves."""
    v = Sec(LV, 2, 'open')
    v.profile([(0, 27, 164), (28, 31, 165), (32, 35, 166), (36, 63, 167), (64, 67, 166), (68, 71, 165), (72, 99, 164)])
    v.fill(12, 18, 161, 163)                 # the boulder, Miners on top
    v.fill(50, 56, 161, 161, '=')            # shelf over the gully
    v.fill(76, 78, 161, 161, '=')
    v.mvs({0: (14, 160), 1: (17, 160), 2: (23, 163), 11: (26, 161),
           3: (40, 158), 4: (44, 166), 5: (53, 160), 6: (59, 166), 7: (61, 160),
           8: (77, 160), 9: (88, 163), 10: (94, 163), 12: (98, 160)})
    v.path = [[0, 163], [11, 163], [12, 160], [18, 160], [19, 163], [27, 163], [28, 164], [32, 165], [36, 166], [63, 166],
              [64, 165], [68, 164], [72, 163], [99, 163]]
    return v


# ------------------------------------------------------------------ § 6 Ice peaks and minecart descent (130 x 176, rail row 92 -> 144)
def s6_descent(v, segs):
    """Rewrites the cart track from col 51 to the last col of `segs`: segs = [(columns, rows dropped per column)], from the
    rail at row 92. Cols 90+ (the safe flat, tunnel 2, gap 2, last slope) stay as v1. Returns the corner vertices."""
    col, row = 50, 92
    pts = [[col, row - 1]]
    for n, d in segs:
        for _ in range(n):
            col += 1
            row += d
            v.carve(col, col, 93, row - 1)
            v.fill(col, col, row, v.h - 1)
        pts.append([col, row - 1])
    assert col == 89 and row == 132, (col, row)
    return pts


def s6_front(v, tunnel, gap, shelf, shelf_miner, ice):
    """The rail line from the plaza to the arena: the low tunnel (8 cols, roof row 90), the 2-wide gap over its catch floor,
    the Miner's shelf and extra ice ledges (cols), all moved from v1's place (tunnel 26-33, gap 39-40, shelf 21-23)."""
    v.fill(26, 33, 90, 90, '.')
    v.fill(21, 23, 88, 88, '.')
    v.fill(39, 40, 92, 99, '#')
    v.fill(tunnel, tunnel + 7, 90, 90, '#')
    v.carve(gap, gap + 1, 92, 99)
    v.fill(shelf, shelf + 2, 88, 88, '=')
    for x0, x1, y in ice:
        v.fill(x0, x1, y, y, 'I')
    v.mv(7, shelf_miner, 87)


def s6_v2():
    """Glacier shelf: tunnel and gap come early, a long ice shelf hangs over the middle of the rail; the track drops in a short
    steep run, a long flat rest and a steeper fall."""
    v = Sec(LV, 6, 'v1')
    s6_front(v, 14, 31, 36, 37, [(22, 29, 87)])
    pts = s6_descent(v, [(8, 1), (13, 0), (14, 2), (4, 1)])
    v.mvs({8: (66, 99), 9: (96, 124), 12: (34, 88)})
    v.path = [[0, 91], [8, 91], [13, 91], [22, 91], [30, 91], [33, 91], [36, 91], [49, 91]] + pts[1:] + [[99, 131], [107, 131], [110, 132], [113, 134], [128, 143], [129, 143]]
    return v


def s6_v3():
    """Steep start: the gap comes first (col 20), the tunnel late (cols 30-37), then a steep drop, a rest, and a second drop."""
    v = Sec(LV, 6, 'v1')
    s6_front(v, 30, 20, 10, 11, [(13, 17, 86)])
    pts = s6_descent(v, [(6, 2), (10, 0), (8, 1), (10, 2), (5, 0)])
    v.mvs({8: (62, 103), 9: (97, 124), 12: (24, 88)})
    v.path = [[0, 91], [8, 91], [19, 91], [22, 91], [29, 91], [38, 91], [41, 91], [49, 91]] + pts[1:] + [[99, 131], [107, 131], [110, 132], [113, 134], [128, 143], [129, 143]]
    return v


# ------------------------------------------------------------------ § 7 Crystal cave loot (80 x 176, floor 144, open sky)
def shrine(v, x0, top, chest_i, door_i):
    """The sealed timed room (31 blink blocks, door on the left wall facing the route): roof and floor 10 wide, 9 tall.
    Returns nothing; moves the chest and the door object."""
    v.fill(x0, x0 + 9, top, top, '@')
    v.fill(x0, x0 + 9, top + 8, top + 8, '@')
    v.fill(x0, x0, top + 1, top + 4, '@')
    v.fill(x0 + 9, x0 + 9, top + 1, top + 7, '@')
    v.mv(door_i, x0, top + 5, 1, 3)
    v.mv(chest_i, x0 + 5, top + 7)
    v.carve(x0 + 1, x0 + 8, top + 1, top + 7)


def s7_v2():
    """Hanging vault: the sealed room hangs high over the middle of the cave; two one-way landings climb to its door."""
    v = Sec(LV, 7, 'open')
    v.ground(0, 79, 144)
    v.fill(28, 33, 142, 143)                 # a low mound
    shrine(v, 44, 128, 3, 4)
    v.fill(36, 38, 140, 140, '=')            # landing 1 (4 up)
    v.fill(42, 43, 136, 136, '=')            # landing 2 at the door (standing row 135)
    v.mvs({0: (6, 140), 1: (12, 143), 2: (23, 143), 5: (17, 143), 6: (30, 141), 7: (62, 143), 8: (70, 135), 9: (73, 143),
           10: (21, 140), 11: (78, 140)})
    v.path = [[0, 143], [27, 143], [28, 141], [33, 141], [34, 143], [79, 143]]
    return v


def s7_v3():
    """Low vault on a rock step: the room sits further on, its door reached over a rock step and a short landing."""
    v = Sec(LV, 7, 'open')
    v.ground(0, 79, 144)
    v.fill(8, 14, 142, 143)                  # a low shelf near the start
    v.fill(48, 51, 141, 143)                 # the rock step to the landing
    shrine(v, 56, 131, 3, 4)
    v.fill(54, 55, 139, 139, '=')            # landing at the door (standing row 138)
    v.mvs({0: (3, 140), 1: (19, 143), 2: (30, 143), 5: (11, 141), 6: (40, 143), 7: (70, 143), 8: (35, 136), 9: (75, 143),
           10: (25, 140), 11: (78, 140)})
    v.path = [[0, 143], [7, 143], [8, 141], [14, 141], [15, 143], [79, 143]]
    return v


# ------------------------------------------------------------------ § 3 The great climb (24 x 176, solid mountain, floor 164 -> 92)
LV_ROWS = [164, 152, 140, 128, 116, 104, 92]       # the floors of the six rises (12 tiles apart)


def climb(shafts, heights, margins, rocks):
    """Six wall-jump shafts (4 wide) joined by five rest rooms; the rock zones sit on the shafts listed in `rocks`.
    shafts: left column of each shaft; heights: room heights for rooms 1..5; margins: (left, right) per room 1..5."""
    v = Sec(LV, 3, 'solid')
    L = LV_ROWS
    v.carve(0, shafts[0] + 3, 161, 163)                             # the base room (3 high), as v1
    for k, s in enumerate(shafts):
        h_below = 3 if k == 0 else heights[k - 1]
        v.carve(s, s + 3, L[k + 1], L[k] - h_below - 1)             # shaft k
    for k in range(1, 6):
        lo, hi = min(shafts[k - 1], shafts[k]), max(shafts[k - 1], shafts[k]) + 3
        v.carve(lo - margins[k - 1][0], hi + margins[k - 1][1], L[k] - heights[k - 1], L[k] - 1)
    s5 = shafts[5]
    v.carve(s5 - 2, 23, 84, 91)                                    # the top room
    v.fill(s5 + 4, s5 + 6, 88, 88)                                 # the key ledge
    path = [[0, 163], [shafts[0] + 1, 163]]
    for k in range(6):
        nxt = shafts[k + 1] if k < 5 else None
        ex = shafts[k] + 5 if (nxt is not None and nxt > shafts[k]) else shafts[k] - 2
        path.append([ex, L[k + 1] - 1])
        if nxt is not None:
            path.append([nxt + 1, L[k + 1] - 1])
    path.append([23, 91])
    v.path = path
    mid = lambda k: (min(shafts[k - 1], shafts[k]) + max(shafts[k - 1], shafts[k]) + 3) // 2      # centre of room k
    ob = {0: (mid(2), L[2] - 3), 1: (mid(4), L[4] - 3), 2: (mid(3), L[3] - 2), 3: (s5 + 5, 85)}
    for j, k in enumerate(rocks):
        ob[4 + j] = (shafts[k], L[k + 1], 4, 12)
    for k in range(5):
        x = shafts[k] + 2
        v.objects[7 + k]['props']['angle'] = 0 if shafts[k + 1] > shafts[k] else 180
        ob[7 + k] = (x, L[k + 1] - 1)
    ob[12] = (22, 89)
    v.mvs(ob)
    return v


def s3_v2():
    """Right-hand chimneys: the zigzag runs along the right half of the mountain with tall rest rooms at the ends."""
    return climb([8, 16, 8, 16, 8, 16], [6, 6, 3, 6, 6], [(1, 2), (1, 2), (0, 0), (1, 2), (1, 2)], [1, 3, 5])


def s3_v3():
    """Left-hand chimneys: the zigzag hugs the left wall, with a long first rest and a long last climb."""
    return climb([2, 10, 2, 10, 2, 10], [3, 6, 6, 6, 3], [(0, 0), (1, 3), (1, 3), (1, 3), (0, 0)], [1, 3, 5])


# ------------------------------------------------------------------ § 4 The split mine (90 x 176, solid mountain, corridor floor 92)
def s4_base(down, up):
    """Corridor rows 88-91 (the cracked skip), main tunnel rows 100-103, side tunnel rows 108-111; the entry gap at cols 3-6,
    the cracked wall at cols 8-9 and the last shaft at cols 81-84 as v1. `down`/`up`: left columns of the side route's shafts."""
    v = Sec(LV, 4, 'solid')
    v.carve(0, 89, 88, 91)
    v.fill(8, 9, 88, 91, '+')
    v.carve(3, 6, 92, 103)
    v.carve(3, 84, 100, 103)
    v.carve(81, 84, 92, 103)
    v.carve(down, down + 3, 104, 107)
    v.carve(up, up + 3, 104, 107)
    v.carve(down, up + 3, 108, 111)
    return v


def s4_v2():
    """Stepped halls: a raised dais in the middle of the tunnel (Golems on it) and a side route that loops in the left half."""
    v = s4_base(12, 63)
    v.carve(35, 58, 98, 101)                 # the dais: floor 102 over cols 35-58 (the tunnel is 4 high there too)
    v.fill(35, 58, 102, 103)
    v.mvs({0: (20, 103), 1: (28, 103), 2: (40, 101), 3: (46, 99), 4: (53, 101), 5: (72, 103),
           6: (22, 111), 7: (36, 111), 8: (46, 111), 9: (52, 111), 10: (56, 111), 11: (60, 111),
           12: (2, 88), 13: (10, 101), 14: (62, 101), 15: (84, 90)})
    v.path = [[0, 91], [4, 103], [34, 103], [35, 101], [58, 101], [59, 103], [80, 103], [82, 103], [86, 91], [89, 91]]
    return v


def s4_v3():
    """Ramp mine: a stair of 1-tile steps leads down instead of a shaft, and the side route starts further on (cols 28-31)."""
    v = s4_base(28, 75)
    v.carve(75, 78, 92, 103)                 # the rejoin shaft also reaches the corridor, as v1
    for c in range(3, 15):                   # the ramp: surface at row 92 + (c - 2)
        v.carve(c, c, 93, 91 + (c - 2))
        v.fill(c, c, 92 + (c - 2), 103, '#') if c < 14 else None
    v.carve(7, 14, 93, 96)
    v.fill(5, 6, 92, 92)                     # the opening to the ramp is 2 wide (cols 3-4)
    v.mvs({0: (22, 103), 1: (32, 103), 2: (45, 103), 3: (56, 101), 4: (62, 103), 5: (70, 103),
           6: (36, 111), 7: (48, 111), 8: (58, 111), 9: (64, 111), 10: (68, 111), 11: (72, 111),
           12: (2, 88), 13: (17, 101), 14: (73, 101), 15: (84, 90)})
    v.path = [[0, 91]] + [[c, 89 + c] for c in range(3, 15)] + [[26, 103], [34, 103], [50, 103], [74, 103], [79, 103], [82, 103], [86, 91], [89, 91]]
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
