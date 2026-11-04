#!/usr/bin/env python3
"""Mountains §6, all three versions (M17; 06 §8.3, §8.9, §9.4; docs/levels/mountains.md "Section 6").

Icy peak path -> the Dragon's nest (the side arena, a cave in the summit, entered only from the peak path)
and, through a hole in the peak path, a cave labyrinth down to the §7 exit: tunnel A (the Lucky Block nook to the west,
a junction to the lower tunnel B), the merchant hall, the key chimney, and the drop to the exit tunnel.
The nest is sealed from the caves by at least 3 tiles of rock. No minecart.
Run: python3 levels-src/mountains/gen_s6.py && npm run levels
"""
import json
import math
import os

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 's6')
W, H = 130, 176
ENTRY, EXIT = [0, 92], [129, 144]
ARENA = (49, 68, 40, 20)
TORCHES = 15                       # inner rectangle: x, y, w, h (06 §9.4)


def build(P):
    g = [['.' for _ in range(W)] for _ in range(H)]

    def fill(x0, x1, y0, y1, c='#'):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                g[y][x] = c

    def carve(x0, x1, y0, y1):
        fill(x0, x1, y0, y1, '.')

    # The icy peak path: floors 92 (entry), 90, 88; ice on the upper steps.
    fill(0, 11, 92, H - 1)
    fill(12, 21, 90, H - 1); fill(12, 21, 90, 90, 'I')
    fill(22, 39, 88, H - 1); fill(22, 33, 88, 88, 'I')
    # The summit: rock round the nest, the mountain's shoulder to the right.
    fill(40, 95, 66, H - 1)
    fill(96, W - 1, 66, H - 1)
    ax, ay, aw, ah = ARENA
    carve(ax, ax + aw - 1, ay, ay + ah - 1)                       # the nest cave
    carve(40, ax - 1, ay + ah - 3, ay + ah - 1)                   # its one way in, 3 tiles tall at floor level
    fill(ax + aw // 2 - 4, ax + aw // 2 + 3, ay + ah - 6, ay + ah - 6, '=')   # the central one-way platform, 96 px up
    carve(ax + aw, ax + aw, ay + 4, ay + 11)                      # the wide opening on the far wall ...
    carve(ax + aw + 1, ax + aw + 6, ay - 1, ay + 11)              # ... onto a sealed sky alcove (ART12 paints the sky)

    # The labyrinth (rows >= 92; the nest floor is row 88, so >= 3 rock rows between them).
    a0, a1 = P['aRow'], P['aRow'] + 2
    h = P['hole']
    carve(h, h + 3, 88, 109)                                      # the hole in the peak path: a shaft down to tunnel B ...
    fill(h, h + 3, a1 + 1, a1 + 1, '=')                           # ... with a one-way floor at tunnel A (drop through for B)
    carve(P['nook'], P['shaft'] + 3, a0, a1)                      # tunnel A, from the Lucky Block nook (west) to the main shaft
    hx0, hx1 = P['hall']
    carve(hx0, hx1, 106, 112)                                     # the merchant hall (floor 113)
    carve(P['shaft'], P['shaft'] + 3, a1 + 1, 105)                # main shaft: tunnel A -> hall
    carve(min(P['bWest'], h - 6), hx0, 110, 112)                  # tunnel B (its west end past the shaft is a dead-end nook) -> the hall
    k = P['keyChimney']
    carve(k, k + 3, 96, 105)                                      # the key chimney (a hard wall-jump climb)
    carve(k - 4, k + 3, 94, 96)                                   # and the key's pocket at its top
    fill(k, k + 3, 109, 109, '=')                                 # a one-way step in the hall up to the chimney
    e = P['exitShaft']
    carve(e, e + 3, 113, 138)                                     # the drop from the hall to the exit tunnel
    carve(P['exitX0'], W - 1, 139, 143)                           # the exit tunnel (floor 144) into §7
    for r in (119, 127):                                          # two one-way ledges break the long drop
        fill(e, e + 1, r, r, '=') if r == 119 else fill(e + 2, e + 3, r, r, '=')

    path = [[0, 91], [11, 91], [12, 89], [21, 89], [22, 87], [h - 1, 87], [h + 1, a1], [P['shaft'] - 1, a1], [P['shaft'] + 1, 112],
            [e - 1, 112], [e + 1, 143], [129, 143]]
    return g, path


def objects(P, path):
    ax, ay, aw, ah = ARENA
    fl = ay + ah - 1                                              # standing row on the nest floor
    a1 = P['aRow'] + 2
    k = P['keyChimney']
    obs = [
        {'type': 'lucky_block', 'x': P['nook'] + 2, 'y': a1, 'props': {}},
        {'type': 'key', 'x': k - 3, 'y': 95, 'props': {}},
        {'type': 'merchant_spot', 'x': P['merchant'], 'y': 112, 'props': {}},
        {'type': 'dragon_warning', 'x': 3, 'y': 84, 'w': 1, 'h': 8, 'props': {}},
        {'type': 'arena', 'x': ax, 'y': ay, 'w': aw, 'h': ah, 'props': {'id': 'mountain_side', 'kind': 'side'}},
        {'type': 'enemy', 'x': P['miner'], 'y': a1, 'props': {'enemy': 'goblin_miner', 'facing': -1}},
        {'type': 'enemy', 'x': P['ram'], 'y': 112, 'props': {'enemy': 'ram', 'facing': -1}},
        {'type': 'enemy', 'x': 122, 'y': 141, 'props': {'enemy': 'bat_swarm', 'facing': -1}},
        {'type': 'guide_arrow', 'x': P['hole'] + 1, 'y': 85, 'props': {'angle': 90}},
        {'type': 'guide_arrow', 'x': P['hole'] + 5, 'y': a1 - 1, 'props': {'angle': 0}},
        {'type': 'guide_arrow', 'x': P['shaft'] - 2, 'y': a1 - 1, 'props': {'angle': 90}},
        {'type': 'guide_arrow', 'x': P['exitShaft'] - 2, 'y': 110, 'props': {'angle': 90}},
        {'type': 'guide_arrow', 'x': 126, 'y': 141, 'props': {'angle': 0}},
        {'type': 'guide_arrow', 'x': 8, 'y': 89, 'props': {'angle': 0}},
        # The nest, lived in even without the Dragon (decoration only; ART12 draws them).
        {'type': 'nest', 'x': ax + aw // 2, 'y': fl, 'props': {}},
        {'type': 'eggshells', 'x': ax + aw // 2 + 6, 'y': fl, 'props': {}},
        {'type': 'bones', 'x': ax + 6, 'y': fl, 'props': {}},
        {'type': 'scorch', 'x': ax + 12, 'y': fl, 'props': {}},
        {'type': 'coin_pile', 'x': ax + aw - 4, 'y': fl, 'props': {}},
    ]
    # Wall torches along the main route inside the mountain, at most 12 tiles apart (06 §8.9); other routes stay dark.
    # A fixed count keeps every version's object list the same (06 §8.7).
    pts = [[path[5][0], path[5][1]]] + [p for p in path[6:]]
    total = length(pts)
    for i in range(TORCHES):
        d, acc = (i + 0.5) * total / TORCHES, 0.0
        for a, b in zip(pts, pts[1:]):
            seg = math.hypot(b[0] - a[0], b[1] - a[1])
            if acc + seg >= d:
                t = (d - acc) / seg
                x, y = round(a[0] + (b[0] - a[0]) * t), round(a[1] + (b[1] - a[1]) * t)
                obs.append({'type': 'torch', 'x': x, 'y': y - 1 if a[1] == b[1] else y, 'props': {}})
                break
            acc += seg
    return obs


VERSIONS = {
    1: dict(hole=34, aRow=98, nook=26, junction=58, shaft=81, hall=(80, 115), bWest=46, keyChimney=106, exitShaft=112,
            exitX0=100, merchant=96, miner=50, ram=70),
    2: dict(hole=30, aRow=96, nook=24, junction=50, shaft=74, hall=(72, 112), bWest=40, keyChimney=100, exitShaft=106,
            exitX0=96, merchant=90, miner=44, ram=62),
    3: dict(hole=36, aRow=100, nook=28, junction=64, shaft=86, hall=(85, 120), bWest=52, keyChimney=112, exitShaft=116,
            exitX0=104, merchant=101, miner=56, ram=76),
}


def length(p):
    return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(p, p[1:]))


def main():
    base = None
    for ver, P in VERSIONS.items():
        g, path = build(P)
        obs = objects(P, path)
        with open(os.path.join(DIR, f'v{ver}.txt'), 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(''.join(r) for r in g) + '\n')
        with open(os.path.join(DIR, f'v{ver}.json'), 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'entry': ENTRY, 'exit': EXIT, 'objects': obs, 'mainPath': path}, f, indent=1)
            f.write('\n')
        base = base or length(path)
        print(f'mountains s6 v{ver}: path {length(path):.1f} / v1 {base:.1f} = {length(path) / base * 100:.1f}%, {sum(o["type"] == "torch" for o in obs)} torches')


if __name__ == '__main__':
    main()
