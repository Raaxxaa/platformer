#!/usr/bin/env python3
"""Plains section versions v2 and v3 (06 §8.7, docs/levels/plains.md "Versions"). Writes levels-src/plains/s<N>/v<V>.{txt,json}.

Every version keeps v1's width, contents (enemies, objects, hints in order) and the floor row 38 at both edges.
Tiles; rows grow downward; the map is 64 rows; a fresh grid is open above row 38 and solid from row 38 down.
Main path vertices are standing cells (the row above the floor).
SPEC-GAP: versions stay within ~1 tile of v1 so all 243 combinations fit the 790-tile Plains path cap (docs/SPEC-GAPS.md 49).
Run: python3 levels-src/plains/gen_variants.py && npm run levels
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
H = 64
FLOOR = 38
WIDTH = {2: 166, 3: 107, 4: 104, 6: 101, 7: 80}


class V:
    def __init__(self, sec):
        self.w = WIDTH[sec]
        self.g = [['.' if y < FLOOR else '#' for _ in range(self.w)] for y in range(H)]
        self.objects = []
        self.path = []

    def fill(self, x0, x1, y0, y1, c='#'):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.g[y][x] = c

    def ground(self, x0, x1, top):
        """Floor surface at row `top` for columns x0..x1: open above, solid from `top` down."""
        self.fill(x0, x1, 0, top - 1, '.')
        self.fill(x0, x1, top, H - 1, '#')

    def put(self, x, y, c):
        self.g[y][x] = c

    def hint(self, action, x, y, w, h):
        self.objects.append({'type': 'hint', 'x': x, 'y': y, 'w': w, 'h': h, 'props': {'action': action}})

    def write(self, sec, ver):
        d = os.path.join(HERE, f's{sec}')
        with open(os.path.join(d, f'v{ver}.txt'), 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(''.join(r) for r in self.g) + '\n')
        meta = {'entry': [0, FLOOR], 'exit': [self.w - 1, FLOOR], 'objects': self.objects, 'mainPath': self.path}
        with open(os.path.join(d, f'v{ver}.json'), 'w', encoding='utf-8', newline='\n') as f:
            json.dump(meta, f, indent=1)
            f.write('\n')


def s2_start(v):
    """The first 20 columns as v1: bandit alone, the Lucky Block over a 2-tile rise, the dash and lucky_block hints."""
    v.fill(12, 18, 36, 37)
    v.put(2, 37, 'b')
    v.put(15, 33, 'L')
    v.hint('dash', 0, 34, 2, 4)
    v.hint('lucky_block', 12, 32, 7, 4)


# ---------------------------------------------------------------- § 2 Open Fields
def s2_v2():
    """Riverbank: a dry stream bed of stepping stones, then two plank bridges over gullies."""
    v = V(2)
    s2_start(v)
    # Stream bed 36–50: three 3-wide gaps between dry stones, a safe bed 3 rows down.
    v.fill(36, 50, FLOOR, FLOOR + 2, '.')
    v.fill(39, 40, FLOOR, FLOOR + 2)
    v.fill(44, 45, FLOOR, FLOOR + 2)
    v.fill(49, 50, FLOOR, FLOOR + 2)
    v.put(28, 37, '1'); v.put(30, 37, '1')
    v.put(54, 37, 'o')                       # the boar alone on a long flat bank (51–86)
    v.put(78, 37, 'b'); v.put(84, 37, 'b')
    # Bridge 1: planks over a gully 88–100.
    v.fill(88, 100, FLOOR, FLOOR + 3, '.')
    v.fill(88, 100, FLOOR, FLOOR, '=')
    v.fill(106, 109, 36, 37)                 # the archer's low hill, as v1
    v.put(108, 35, 'r'); v.put(111, 37, '5')
    # Bridge 2: planks over a gully 116–130.
    v.fill(116, 130, FLOOR, FLOOR + 3, '.')
    v.fill(116, 130, FLOOR, FLOOR, '=')
    v.fill(137, 140, 36, 37)
    v.put(138, 35, 'r'); v.put(136, 37, 'o')
    v.put(162, 37, 'B')
    v.path = [[11, 37], [12, 35], [18, 35], [19, 37], [35, 37], [51, 37], [105, 37], [106, 35], [109, 35], [110, 37],
              [136, 37], [137, 35], [140, 35], [141, 37], [165, 37]]
    return v


def s2_v3():
    """Windmill hill: one long gentle climb in 2-tile terraces to the summit (71–101) and back down; groups on terraces."""
    v = V(2)
    s2_start(v)
    for x0, x1, top in ((40, 45, 36), (46, 70, 34), (71, 101, 32), (102, 133, 34), (134, 150, 36)):
        v.ground(x0, x1, top)
    v.put(28, 37, '1'); v.put(30, 37, '1')
    v.put(54, 33, 'o')                       # 25 flat tiles of terrace for its charge
    v.put(78, 31, 'b'); v.put(84, 31, 'b')
    v.put(108, 33, 'r'); v.put(111, 33, '5') # the archer at the terrace edge, the wolf below the summit
    v.put(138, 35, 'r'); v.put(136, 35, 'o')
    v.put(162, 37, 'B')
    v.path = [[11, 37], [12, 35], [18, 35], [19, 37], [39, 37], [40, 35], [45, 35], [46, 33], [70, 33], [71, 31],
              [101, 31], [102, 33], [133, 33], [134, 35], [150, 35], [151, 37], [165, 37]]
    return v


def s3_start(v):
    """Double jump taught on the 6-high ledge, then over the spike pit, as v1."""
    v.fill(8, 14, 32, 37)
    v.fill(22, 27, 33, 37)
    v.put(20, 37, '^'); v.put(21, 37, '^')
    v.hint('double_jump', 1, 30, 7, 8)


def s3_end(v):
    v.put(74, 37, '2'); v.put(77, 37, '2')
    v.fill(100, 103, 36, 37)
    v.put(101, 35, 'r'); v.put(104, 37, 'o')


def s3_v2():
    """Waterfall cliff: a wall-jump shaft up the cliff face, the slide tunnel behind the falls on top, a key above."""
    v = V(3)
    s3_start(v)
    # Shaft 42–45 between a rock wall (x 41, open at the bottom to walk in) and the cliff face (x 46).
    v.fill(41, 41, 22, 35)
    v.ground(46, 70, 28)
    v.hint('wall_jump', 37, 34, 4, 4)
    # Slide tunnel on the clifftop: an overhang leaves one open row (27) over 54–60.
    v.fill(54, 60, 20, 26)
    v.hint('slide', 49, 25, 5, 3)
    v.put(50, 24, 'L')
    # The key: two plank ledges above the tunnel's far end.
    v.fill(64, 66, 24, 24, '=')
    v.fill(60, 62, 21, 21, '=')
    v.put(61, 19, 'K')
    s3_end(v)
    v.path = [[7, 37], [9, 31], [14, 31], [16, 37], [19, 37], [23, 32], [27, 32], [28, 37], [42, 37], [46, 27], [53, 27],
              [61, 27], [70, 27], [71, 37], [99, 37], [100, 35], [103, 35], [104, 37], [106, 37]]
    return v


def s3_v3():
    """Fallen trees: log jumps over a spiked gully, the wall-jump shaft inside a hollow trunk, the slide along a branch."""
    v = V(3)
    v.fill(8, 14, 32, 37)                    # the first log: double jump, as v1
    v.hint('double_jump', 1, 30, 7, 8)
    v.fill(15, 19, FLOOR, FLOOR + 2, '.')    # a 5-wide gully with spikes at the bottom
    v.fill(15, 19, FLOOR + 2, FLOOR + 2, '^')
    v.fill(20, 26, 32, 37)                   # the second log
    # Hollow trunk: walls 40 and 45, a doorway at the bottom left; a thick branch to the right at rows 24–25.
    v.fill(40, 40, 18, 35)
    v.fill(45, 45, 24, 37)
    v.fill(45, 62, 24, 25)
    v.hint('wall_jump', 36, 34, 4, 4)
    # Slide: the branch passes under a knot that leaves one open row (23) over 50–56.
    v.fill(50, 56, 17, 22)
    v.hint('slide', 46, 21, 4, 3)
    v.put(48, 21, 'L')
    v.fill(66, 68, 33, 33, '=')
    v.fill(70, 72, 29, 29, '=')
    v.put(71, 27, 'K')
    s3_end(v)
    v.path = [[7, 37], [9, 31], [14, 31], [20, 31], [26, 31], [27, 37], [42, 37], [46, 23], [57, 23], [62, 23], [63, 37],
              [99, 37], [100, 35], [103, 35], [104, 37], [106, 37]]
    return v


# ---------------------------------------------------------------- § 4 Old Grove
def s4_v2():
    """The tree-top skip runs below a rock arch; the hollow is entered at the far end and runs back under the road."""
    v = V(4)
    v.fill(30, 80, 20, 23)                   # the rock arch
    v.fill(26, 26, 27, 35); v.fill(31, 31, 27, 35)    # skip shaft between two trunks (inner 27–30)
    for x0, x1 in ((32, 37), (45, 51), (58, 64), (71, 76)):
        v.fill(x0, x1, 27, 27, '=')
    v.fill(88, 91, FLOOR, 43, '.')           # hollow entrance (4 wide)
    v.fill(20, 91, 44, 51, '.')
    v.put(84, 35, 'g')
    v.hint('dive_slam', 82, 34, 5, 4)
    for x in (17, 20, 23):
        v.put(x, 37, '3')
    v.put(40, 37, 'b'); v.put(46, 37, 'b'); v.put(66, 37, 'o')
    v.put(81, 51, 'r'); v.put(75, 51, 'b'); v.put(44, 51, 'B'); v.put(38, 51, 'C'); v.put(33, 51, 'Q'); v.put(24, 51, 's')
    v.path = [[7, 37], [87, 37], [92, 37], [103, 37]]
    return v


def s4_v3():
    """The skip is a ridge path over a stone ridge; the side path is a cave under the ridge, entered in the middle."""
    v = V(4)
    v.fill(34, 76, 29, 31)                   # the ridge
    v.fill(27, 27, 24, 35); v.fill(32, 32, 24, 35)    # climb onto it between two trunks (inner 28–31)
    for x0, x1 in ((36, 41), (48, 54), (60, 66), (70, 75)):
        v.fill(x0, x1, 26, 26, '=')
    v.fill(46, 49, FLOOR, 43, '.')           # cave entrance
    v.fill(14, 80, 44, 51, '.')
    v.put(42, 35, 'g')
    v.hint('dive_slam', 40, 34, 5, 4)
    for x in (12, 15, 18):
        v.put(x, 37, '3')
    v.put(34, 37, 'b'); v.put(40, 37, 'b'); v.put(66, 37, 'o')
    v.put(20, 51, 'r'); v.put(26, 51, 'b'); v.put(58, 51, 'B'); v.put(64, 51, 'C'); v.put(69, 51, 'Q'); v.put(76, 51, 's')
    v.path = [[7, 37], [45, 37], [50, 37], [103, 37]]
    return v


# ---------------------------------------------------------------- § 6 Forest Canopy
def s6_v2():
    """Rope bridges: plank bridges between four trunks over a spiked floor; drop through the last one to the clearing."""
    v = V(6)
    v.fill(5, 7, 33, 37)                     # a stump to climb on
    for x in (8, 30, 50, 70):
        v.fill(x, x + 2, 26, 37)
    for x0, x1 in ((11, 29), (33, 49), (53, 69)):
        v.fill(x0, x1, 26, 26, '=')
    v.fill(12, 28, 37, 37, '^')              # spikes under the first two bridges
    v.fill(34, 48, 37, 37, '^')
    v.fill(93, 98, 32, 37)                   # a rock past the clearing, the boar on top
    v.hint('drop_through', 55, 23, 7, 3)
    v.put(20, 22, 'L')
    v.put(24, 25, 'r'); v.put(38, 25, '6'); v.put(42, 25, '6'); v.put(66, 25, 'r')
    v.put(60, 35, 'K')
    v.put(84, 37, 'M'); v.put(96, 31, 'o')
    v.path = [[3, 37], [6, 32], [8, 25], [60, 25], [60, 37], [62, 37], [92, 37], [93, 31], [98, 31], [99, 37], [100, 37]]
    return v


def s6_v3():
    """Abandoned treehouse village: plank ladders, two treehouses, a rope bridge, the merchant's big treehouse floor."""
    v = V(6)
    v.fill(12, 24, 37, 37, '^')
    v.fill(8, 10, 35, 35, '='); v.fill(10, 12, 32, 32, '=')           # ladder up to treehouse 1
    v.fill(14, 26, 31, 31)                   # treehouse 1 (solid floor)
    v.fill(28, 30, 25, 25, '=')              # ladder rung
    v.fill(34, 50, 22, 22, '=')              # treehouse 2 (plank floor: drop through)
    v.fill(51, 69, 28, 28, '=')              # rope bridge
    v.fill(70, 90, 28, 29)                   # treehouse 3: the merchant's floor (21 solid tiles)
    v.fill(93, 98, 32, 37)                   # a rock past the village, the boar on top
    v.hint('drop_through', 40, 19, 7, 3)
    v.put(20, 27, 'L')
    v.put(24, 30, 'r'); v.put(40, 21, '6'); v.put(46, 21, '6'); v.put(60, 27, 'r')
    v.put(55, 35, 'K')
    v.put(80, 27, 'M'); v.put(96, 31, 'o')
    v.path = [[3, 37], [9, 34], [11, 31], [14, 30], [26, 30], [29, 24], [34, 21], [50, 21], [51, 27], [90, 27], [91, 37],
              [92, 37], [93, 31], [98, 31], [99, 37], [100, 37]]
    return v


# ---------------------------------------------------------------- § 7 Sealed Shrine
def shrine(v, x0, roof):
    """Blink-block shrine (21 blocks): roof x0..x0+11 at `roof`, left wall rows below it, right wall above the door."""
    v.fill(x0, x0 + 11, roof, roof, '@')
    v.fill(x0, x0, roof + 1, roof + 6, '@')
    v.fill(x0 + 11, x0 + 11, roof + 1, roof + 3, '@')
    v.objects.append({'type': 'timed_door', 'x': x0 + 11, 'y': roof + 4, 'w': 1, 'h': 3,
                      'props': {'id': 'td1', 'side': 'right', 'timeLimit': 120.0}})


def s7_v2():
    """The shrine at the top of a stair, on a high terrace over the road; a chest on each terrace."""
    v = V(7)
    v.ground(28, 35, 36)                     # the lower terrace
    v.fill(40, 56, 30, 30)                   # the shrine terrace, high over the road
    v.fill(57, 59, 32, 32, '='); v.fill(60, 62, 34, 34, '=')          # the stair (planks)
    shrine(v, 44, 23)
    v.put(10, 34, 'L')
    v.put(31, 35, 'C'); v.put(42, 29, 'C')
    v.put(17, 37, 'b'); v.put(34, 35, 'r')
    v.put(49, 29, 'T')
    v.put(68, 37, 'o'); v.put(72, 37, 'o'); v.put(76, 37, 'B')
    v.path = [[27, 37], [28, 35], [35, 35], [36, 37], [79, 37]]
    return v


def s7_v3():
    """A sunken shrine: plank floor over a pit; drop through to reach it, climb out by two steps."""
    v = V(7)
    v.fill(30, 49, FLOOR, 48, '.')
    v.fill(30, 49, FLOOR, FLOOR, '=')
    shrine(v, 32, 42)
    v.fill(45, 46, 46, 48); v.fill(47, 49, 42, 48)
    v.fill(54, 58, 34, 37)                   # a ledge for the archer
    v.put(5, 34, 'L')
    v.put(8, 37, 'C'); v.put(24, 37, 'C')
    v.put(17, 37, 'b'); v.put(56, 33, 'r')
    v.put(37, 48, 'T')
    v.put(64, 37, 'o'); v.put(68, 37, 'o'); v.put(74, 37, 'B')
    v.path = [[30, 37], [53, 37], [54, 33], [58, 33], [59, 37], [79, 37]]
    return v


def main():
    for sec, fns in ((2, (s2_v2, s2_v3)), (3, (s3_v2, s3_v3)), (4, (s4_v2, s4_v3)), (6, (s6_v2, s6_v3)), (7, (s7_v2, s7_v3))):
        for ver, fn in zip((2, 3), fns):
            fn().write(sec, ver)


main()
