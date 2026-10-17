#!/usr/bin/env python3
"""Lays out the Training Yard (docs/levels/training-yard.md) and writes levels-src/training_yard/ (chunk + manifest).

Tiles; rows grow downward. Floor surface row G. Each station is built from its own start column and returns its end.
Reach numbers (01 §10.4): running jump 93 px, dash-jump ~138 px, slide-jump ~115 px, air dash +60 px,
both jumps + ledge grab: ledge top up to 7 tiles.
Run: python3 levels-src/training_yard/gen_yard.py && python3 tools/build_levels.py training_yard
"""
import json
import os
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'levels-src', 'training_yard')
H = 40
WMAX = 600
G = 34                         # floor surface row

grid = [['#'] * WMAX for _ in range(H)]
objects = []
legend = {
    'P': {'type': 'player_start'},
    'D': {'type': 'enemy', 'enemy': 'training_dummy', 'facing': -1},
    'X': {'type': 'enemy', 'enemy': 'sparring_dummy', 'facing': -1},
    't': {'type': 'enemy', 'enemy': 'straw_target', 'facing': -1},
    'B': {'type': 'checklist_board'},
}


def fill(x0, y0, x1, y1, c='#'):
    for y in range(max(0, y0), min(H - 1, y1) + 1):
        for x in range(max(0, x0), min(WMAX - 1, x1) + 1):
            grid[y][x] = c


def ground(x0, x1, top):
    fill(x0, 0, x1, top - 1, '.')
    fill(x0, top, x1, H - 1, '#')


def put(x, y, c):
    grid[y][x] = c


def rect(type_, x, y, w, h, **props):
    objects.append({'type': type_, 'x': x, 'y': y, 'w': w, 'h': h, 'props': props})


def point(type_, x, y, **props):
    # Point objects in tiles; the builder anchors them (feet = bottom center of the tile).
    objects.append({'type': type_, 'x': x, 'y': y, 'props': props})


def pit(x0, x1, depth=3):
    """A pit with a respawn zone inside (06 §12.4)."""
    fill(x0, G, x1, G + depth - 1, '.')
    rect('respawn', x0, G + depth - 2, x1 - x0 + 1, 2)


def station(sid, x0, x1, text, check, goal=None, flag=None, top=4, floor=G):
    """Station zone (the whole station), its checkpoint at x0 on `floor`, its sign (hint zone with text), an optional goal."""
    rect('station', x0, top, x1 - x0 + 1, H - top - 1, id=sid, check=check)
    point('checkpoint', x0 + 1, floor - 1, station=sid)
    rect('hint', x0, floor - 8, min(8, x1 - x0 + 1), 8, text=text, station=sid)
    if goal:
        gx, gy, gw, gh = goal
        rect('station_goal', gx, gy, gw, gh, station=sid)
    fx, fy = flag if flag else (x1 - 1, floor - 1)
    point('station_flag', fx, fy, station=sid)


# ================================================================ Start: class statues
def start(x0):
    ground(x0, x0 + 13, G)
    put(x0 + 2, G - 1, 'P')
    for i, cls in enumerate(['swordsman', 'tank', 'archer', 'wizard']):
        point('class_statue', x0 + 4 + 2 * i, G - 1, cls=cls)
    rect('exit', x0, G - 6, 1, 6, to='back')
    return x0 + 13


# ================================================================ Part A — movement
def s1(x0):                                       # run and jump: two 2-tile steps, then a 3-tile gap over a shallow pit
    ground(x0, x0 + 24, G)
    ground(x0 + 5, x0 + 7, G - 2); ground(x0 + 8, x0 + 10, G - 4); ground(x0 + 11, x0 + 13, G - 2)
    pit(x0 + 16, x0 + 18, 2)
    station(1, x0, x0 + 24, 'A / D — move.   Space — jump', 'reach', goal=(x0 + 20, G - 4, 4, 4))
    return x0 + 24


def s2(x0):                                       # double jump: a ledge 6 tiles up
    ground(x0, x0 + 16, G)
    ground(x0 + 9, x0 + 16, G - 6)
    station(2, x0, x0 + 16, 'Space in the air — double jump', 'stand', goal=(x0 + 10, G - 9, 6, 3), flag=(x0 + 15, G - 7))
    return x0 + 16


def s3(x0):                                       # dash: an 8-tile gap with a safe pit; back down from the ledge
    ground(x0, x0 + 30, G - 6)
    pit_top = G - 6
    fill(x0 + 6, pit_top, x0 + 13, pit_top + 4, '.')
    rect('respawn', x0 + 6, pit_top + 3, 8, 2)
    ground(x0 + 18, x0 + 30, G)                   # step back down to the floor
    station(3, x0, x0 + 30, 'Shift — dash. Works in the air too', 'airDash', goal=(x0 + 14, pit_top - 4, 4, 4), floor=pit_top, flag=(x0 + 16, pit_top - 1))
    return x0 + 30


def s4_5(x0):                                     # wall-jump shaft (4 wide, 10 tall, rest ledge), then a ledge at the top
    ground(x0, x0 + 13, G)
    fill(x0 + 9, 0, x0 + 9, G - 4, '#')           # left wall; walk in under it (3 tiles open)
    ground(x0 + 14, x0 + 14, G - 10)             # right wall, 10 tall (open above)
    fill(x0 + 10, G - 6, x0 + 10, G - 6, '#')     # rest ledge halfway, on the left wall
    top = G - 10
    ground(x0 + 15, x0 + 23, top)                 # landing at the top of the shaft (station 5 starts on it)
    ground(x0 + 24, x0 + 32, top - 5)             # station 5: a ledge 5 tiles up (jump + grab)
    fill(x0 + 33, 0, x0 + 33, H - 1, '.')
    ground(x0 + 33, x0 + 40, top - 5)
    station(4, x0, x0 + 18, 'Jump on a wall — wall jump. Climb out the top', 'reach', goal=(x0 + 15, top - 4, 4, 4), flag=(x0 + 17, top - 1))
    station(5, x0 + 19, x0 + 40, 'Hold toward a ledge to grab it', 'ledgeGrab', flag=(x0 + 30, top - 6), floor=top)
    return x0 + 40, top - 5


def s6(x0, floor):                                # slide tunnel 7 long, then a 12-long crawlspace; back down to the floor
    ground(x0, x0 + 30, floor)
    fill(x0 + 6, 0, x0 + 12, floor - 2, '#')      # 1-tile-high tunnel
    fill(x0 + 13, 0, x0 + 24, floor - 2, '#')     # crawlspace (same height: crawl through)
    station(6, x0, x0 + 30, 'S + Shift — slide. Keep holding S to crawl', 'reach', goal=(x0 + 26, floor - 4, 4, 4), flag=(x0 + 29, floor - 1), floor=floor)
    return x0 + 30


def s7(x0, floor):                                # 4 one-way platforms down into a pit room
    ground(x0, x0 + 3, floor)
    room_floor = G
    ground(x0 + 4, x0 + 16, room_floor)
    for i, y in enumerate([floor, floor + 3, floor + 6, floor + 9]):
        if y < room_floor:
            fill(x0 + 4, y, x0 + 12, y, '=')
    fill(x0 + 13, 0, x0 + 16, room_floor - 1, '.')
    station(7, x0, x0 + 16, 'S + Space on a thin platform — drop through', 'dropThrough', top=floor - 8, floor=floor, flag=(x0 + 15, G - 1))
    return x0 + 16


def s8(x0):                                       # a platform 6 tiles above a dummy
    ground(x0, x0 + 16, G)
    fill(x0 + 4, G - 7, x0 + 9, G - 7, '=')
    fill(x0 + 2, G - 3, x0 + 3, G - 3, '=')       # steps up to it
    fill(x0 + 0, G - 5, x0 + 1, G - 5, '=')
    put(x0 + 7, G - 1, 'D')
    station(8, x0, x0 + 16, 'S + J in the air — dive slam', 'diveHit')
    return x0 + 16


# ================================================================ Part B — combat
def s9(x0):
    ground(x0, x0 + 14, G)
    put(x0 + 8, G - 1, 'D')
    station(9, x0, x0 + 14, 'J — attack. Land a whole combo', 'combo')
    return x0 + 14


def s10(x0):
    ground(x0, x0 + 16, G)
    point('item_stand', x0 + 5, G - 1, dynamic='kit_weapon2')
    put(x0 + 12, G - 1, 'D')
    station(10, x0, x0 + 16, 'E — pick up. K — attack with weapon 2', 'weapon2')
    return x0 + 16


def s11(x0):
    ground(x0, x0 + 18, G)
    put(x0 + 10, G - 1, 'X')
    station(11, x0, x0 + 18, 'Shift — dash through its swing (3 in a row)', 'dodge')
    return x0 + 18


def s12(x0):
    ground(x0, x0 + 12, G)
    station(12, x0, x0 + 12, 'Q — drink the flask', 'heal')
    return x0 + 12


def s13(x0):
    ground(x0, x0 + 26, G)
    put(x0 + 6, G - 1, 'D')
    point('item_stand', x0 + 12, G - 1, dynamic='kit_ability2')
    put(x0 + 20, G - 1, 'D')
    station(13, x0, x0 + 26, 'U / I — abilities. Use both within 3 s to link them', 'link')
    return x0 + 26


def s14(x0):
    ground(x0, x0 + 46, G)
    for i in range(6):
        put(x0 + 8 + 6 * i, G - 1, 't')
    station(14, x0, x0 + 46, "Keep moving and hitting — don't stop!", 'rush')
    return x0 + 46


# ================================================================ Part C — speed techniques
def s15(x0):
    ground(x0, x0 + 26, G)
    pit(x0 + 10, x0 + 17)
    station(15, x0, x0 + 26, 'Dash, then jump right away to keep the speed', 'dashJump', goal=(x0 + 18, G - 4, 4, 4))
    return x0 + 26


def s16(x0):
    ground(x0, x0 + 30, G)
    fill(x0 + 5, 0, x0 + 8, G - 2, '#')           # low wall: slide under it (a slide is ~6 tiles)
    pit(x0 + 11, x0 + 16)                         # the doc's 6-tile gap
    station(16, x0, x0 + 30, 'Jump out of a slide to keep its speed', 'slideJump', goal=(x0 + 17, G - 4, 4, 4))
    return x0 + 30


def s17(x0):
    ground(x0, x0 + 32, G)
    pit(x0 + 5, x0 + 24, 4)
    for i, d in enumerate([8, 14, 20]):           # straw targets on posts over the pit
        fill(x0 + d, G - 1, x0 + d, G + 3, '#')
        put(x0 + d, G - 2, 't')
    station(17, x0, x0 + 32, 'Dive slam a target to bounce off it', 'diveBounce', goal=(x0 + 25, G - 4, 4, 4))
    return x0 + 32


# ================================================================ Loot corner (M5): practice only, gone when you leave
def loot_corner(x0):
    ground(x0, x0 + 24, G)
    rect('hint', x0, G - 8, 8, 8, text='Hit Lucky Blocks with a weapon')
    point('lucky_block', x0 + 5, G - 4)
    rect('hint', x0 + 10, G - 8, 8, 8, text='Keys open key chests: pick 1 of 2 items')
    point('key', x0 + 12, G - 1)
    point('key_chest', x0 + 19, G - 1)
    return x0 + 24


# ================================================================ The end: board, armory, exit
ARMORY = [
    ('swordsman', ['greatsword', 'katana'], ['blade_dash', 'whirlwind']),
    ('tank', ['war_maul', 'iron_fists'], ['shockwave', 'shoulder_charge']),
    ('archer', ['bow', 'crossbow'], ['arrow_rain', 'hunters_mark']),
    ('wizard', ['storm_hammer', 'staff'], ['thunder_strike', 'blink']),
]


def end(x0):
    ground(x0, x0 + 66, G)
    put(x0 + 3, G - 1, 'B')
    x = x0 + 8
    for cls, weapons, abilities in ARMORY:
        point('armory_label', x + 1, G - 4, cls=cls)
        for wpn in weapons:
            point('item_stand', x, G - 1, weapon=wpn, cls=cls); x += 2
        for ab in abilities:
            point('item_stand', x, G - 1, ability=ab, cls=cls); x += 2
        x += 3
    point('item_stand', x, G - 1, ability='vampire', cls='neutral'); x += 4
    put(x + 2, G - 1, 'D')
    rect('exit', x0 + 66, G - 6, 1, 6, to='back')
    return x0 + 66


def main():
    x = start(0)
    x = s1(x + 1)
    x = s2(x + 1)
    x = s3(x + 1)
    x, f = s4_5(x + 1)
    x = s6(x + 1, f)
    x = s7(x + 1, f)
    x = s8(x + 1)
    for s in (s9, s10, s11, s12, s13, s14, s15, s16, s17):
        x = s(x + 1)
    x = loot_corner(x + 1)
    x = end(x + 1)
    W = x + 1                                     # SPEC-GAP: 06 §12.4 says about 300 tiles wide; all 17 stations and the loot corner need 514
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'yard.txt'), 'w') as f:
        f.write('\n'.join(''.join(r[:W]) for r in grid) + '\n')
    man = {'levelId': 'training_yard', 'kind': 'training', 'stage': 0, 'biome': 'plains', 'width': W, 'height': H,
           'chunks': [{'file': 'yard.txt', 'x': 0, 'y': 0}], 'legend': legend, 'objects': objects}
    with open(os.path.join(OUT, 'level.json'), 'w') as f:
        json.dump(man, f, indent=1)
        f.write('\n')
    print('width', W)


main()
