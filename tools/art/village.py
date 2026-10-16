"""Village buildings and props (08 §8, 06 §12). Atlas `objects`; every prop's bottom sits on the floor."""
import math
import os

import numpy as np

from . import atlas as A
from . import palette as P
from . import raster as R

ATLAS = 'objects'
ALLOWED = ['ink', 'white', 'trim', 'gray', 'npc', 'vl_wood', 'vl_plaster', 'vl_light',
           'w_steel', 'w_wood', 'w_gold', 'w_magic', 'fx_heal']
FLOOR_Y = 320                         # 06 §12.1: floor surface at row 20
INN_ORIGIN = (39 * 16, 160)           # top-left of the inn frame in the village map
INN_SIZE = (128, 160)
DOOR = (41, 16, 44, 20)               # tiles x 41–43, rows 16–19 (06 §12.2), as [x0, y0, x1, y1) in tiles


class Fig:
    def __init__(self, w, h):
        self.L = R.PartLayer(w, h)

    def part(self, name, ramp, shift=0):
        if name not in self.L.index:
            self.L.add_part(name, P.ramp_ids(ramp), shift)
        return name

    def rect(self, x, y, w, h, part):
        R.fill_rect(self.L, int(x), int(y), int(w), int(h), part)

    def done(self, outline=True):
        c = R.auto_shade(self.L)
        if outline:
            R.outline(c, P.INK)
        return c


def _img(c):
    return c.to_image()


def inn_door_world():
    x0, y0, x1, y1 = DOOR
    return x0 * 16, y0 * 16, x1 * 16, y1 * 16


# ------------------------------------------------------------------ buildings

def cottage(w, h, seed):
    f = Fig(w, h)
    g = np.random.default_rng(seed)
    wall = f.part('wall', 'vl_plaster')
    beam = f.part('beam', 'vl_wood', 1)
    roof = f.part('roof', 'w_gold', 1)
    eave = f.part('eave', 'w_gold', 2)
    win = f.part('win', 'vl_light')
    frame = f.part('frame', 'vl_wood')
    door = f.part('door', 'vl_wood', 1)
    chim = f.part('chim', 'gray', 1)
    wall_top = h * 0.45
    f.rect(2, wall_top, w - 4, h - wall_top - 1, wall)
    for x in (2, w // 2 - 1, w - 5):                                  # timber frame
        f.rect(x, wall_top, 3, h - wall_top - 1, beam)
    f.rect(2, wall_top + 2, w - 4, 2, beam)
    f.rect(int(w * 0.62), 3, 6, wall_top - 6, chim)
    R.fill_polygon(f.L, [(-0.5, wall_top + 2), (w / 2, 1), (w + 0.5, wall_top + 2)], roof)
    for k in range(3, int(wall_top), 5):                              # thatch lines
        xa = w / 2 - (k / wall_top) * w / 2 + 3
        xb = w / 2 + (k / wall_top) * w / 2 - 3
        R.line(f.L, (int(xa), k), (int(xb), k), eave)
    dw = 12
    f.rect(w * 0.25 - dw / 2, h - 22, dw, 21, door)
    f.rect(w * 0.25 - dw / 2, h - 22, dw, 2, frame)
    for wx in (w * 0.62, w * 0.82):
        f.rect(wx - 5, wall_top + 8, 10, 9, frame)
        f.rect(wx - 3, wall_top + 10, 6, 5, win)
    c = f.done()
    c.a[h - 12, int(w * 0.25 + 3)] = P.sid(P.RAMPS['w_gold'][2])          # door knob
    return c


def well():
    f = Fig(32, 40)
    stone = f.part('stone', 'gray', -1)
    post = f.part('post', 'vl_wood')
    roof = f.part('roof', 'vl_wood', 1)
    rope = f.part('rope', 'w_wood', -1)
    bucket = f.part('bucket', 'vl_wood', -1)
    f.rect(6, 6, 3, 22, post)
    f.rect(23, 6, 3, 22, post)
    R.fill_polygon(f.L, [(1, 9), (16, 1), (31, 9)], roof)
    R.line(f.L, (16, 8), (16, 20), rope)
    f.rect(14, 19, 5, 4, bucket)
    R.ellipse(f.L, 15.5, 31, 13, 7.5, stone)
    f.rect(3, 30, 26, 9, stone)
    c = f.done()
    for y in range(31, 39, 3):                                         # mortar lines
        for x in range(4, 28):
            if (x + (y // 3) * 3) % 7 == 0 and c.a[y, x] >= 0:
                c.a[y, x] = P.sid(P.RAMPS['gray'][1])
    return c


def market_roof():
    """Striped awning over the shop row (tiles 7–37) on three posts, 496 × 112."""
    w = (37 - 7 + 1) * 16
    h = 112
    f = Fig(w, h)
    post = f.part('post', 'vl_wood')
    a = f.part('stripe_a', 'vl_plaster')
    b = f.part('stripe_b', 'npc')
    ridge = f.part('ridge', 'vl_wood', 1)
    for px in (2, w // 2 - 1 + (24 * 16 + 8 - (7 * 16 + w // 2)), w - 6):
        f.rect(px, 14, 4, h - 15, post)
    f.rect(0, 4, w, 3, ridge)
    for x in range(0, w, 8):
        f.rect(x, 7, 8, 12, a if (x // 8) % 2 == 0 else b)
        # scalloped edge
        R.ellipse(f.L, x + 3.5, 19, 4, 2.6, a if (x // 8) % 2 == 0 else b)
    return f.done()


def inn():
    """Two-storey timber inn with a sign and warm windows; the door covers tiles 41–43, rows 16–19."""
    w, h = INN_SIZE
    f = Fig(w, h)
    wall = f.part('wall', 'vl_plaster')
    wall2 = f.part('wall_up', 'vl_plaster', 1)
    beam = f.part('beam', 'vl_wood', 1)
    roof = f.part('roof', 'vl_wood', 1)
    shingle = f.part('shingle', 'vl_wood', 2)
    win = f.part('win', 'vl_light')
    frame = f.part('frame', 'vl_wood')
    door = f.part('door', 'vl_wood')
    sign = f.part('sign', 'w_wood', -1)
    mug = f.part('mug', 'w_gold')
    # ground floor
    f.rect(4, 92, w - 8, h - 92, wall)
    # upper floor overhangs by 4 px
    f.rect(0, 48, w, 44, wall2)
    for x in (0, 30, 62, 94, w - 4):
        f.rect(x, 48, 4, 44, beam)
    f.rect(0, 48, w, 3, beam)
    f.rect(0, 88, w, 4, beam)
    for x in (4, w - 8):
        f.rect(x, 92, 4, h - 92, beam)
    # roof
    R.fill_polygon(f.L, [(-0.5, 50), (18, 8), (w - 18, 8), (w + 0.5, 50)], roof)
    for y in range(14, 48, 6):
        R.line(f.L, (int(18 - (y - 8) * 0.44) + 2, y), (int(w - 18 + (y - 8) * 0.44) - 3, y), shingle)
    chim = f.part('chim', 'gray', 1)
    f.rect(w - 34, 0, 10, 14, chim)
    # upper windows
    for wx in (12, 44, 76, 106):
        f.rect(wx - 1, 58, 14, 18, frame)
        f.rect(wx + 1, 60, 10, 14, win)
    # door: tiles 41–43 → frame x 32..80, rows 16–19 → frame y 96..160
    dx0, dy0 = 41 * 16 - INN_ORIGIN[0], 16 * 16 - INN_ORIGIN[1]
    f.rect(dx0, dy0, 48, h - dy0, frame)
    f.rect(dx0 + 3, dy0 + 4, 20, h - dy0 - 4, door)
    f.rect(dx0 + 25, dy0 + 4, 20, h - dy0 - 4, door)
    lit = f.part('door_light', 'vl_light')
    f.rect(dx0 + 8, dy0 + 10, 10, 8, lit)
    f.rect(dx0 + 30, dy0 + 10, 10, 8, lit)
    # ground floor window right of the door
    f.rect(92, 104, 22, 20, frame)
    f.rect(94, 106, 18, 16, win)
    # hanging sign with a mug, on a bracket left of the door
    f.rect(6, 96, 20, 3, beam)
    f.rect(8, 99, 16, 14, sign)
    f.rect(12, 102, 7, 8, mug)
    f.rect(19, 104, 2, 4, mug)
    c = f.done()
    return c


def building_frames():
    return {
        'cottage_a_00': _img(cottage(96, 72, 1)),
        'cottage_b_00': _img(cottage(80, 64, 2)),
        'well_00': _img(well()),
        'market_roof_00': _img(market_roof()),
        'inn_00': _img(inn()),
    }



# ------------------------------------------------------------------ interactable props (06 §12.2, §12.3)

LAYOUT = {
    'crossroads': [('shop_item_00', 9), ('shop_item_00', 12), ('shop_item_00', 15), ('ability_altar_idle_00', 19),
                   ('ability_altar_idle_00', 22), ('shop_flask_00', 26), ('shop_refill_idle_00', 29),
                   ('shop_key_00', 32), ('shop_reroll_00', 35)],
    'home': [('class_statue_swordsman_00', 9), ('class_statue_tank_00', 13), ('class_statue_archer_00', 17),
             ('class_statue_wizard_00', 21),
             ('mirror_spot_00', 25), ('training_dummy_idle_00', 28), ('unlocks_board_00', 34),
             ('seed_board_00', 37), ('gate_idle_00', 45.5)],
}


def shop_item():
    f = Fig(24, 16)
    wood = f.part('wood', 'vl_wood')
    cloth = f.part('cloth', 'npc', -1)
    trim = f.part('trim', 'w_gold')
    f.rect(6, 6, 12, 9, wood)
    f.rect(3, 14, 18, 2, wood)
    f.rect(2, 3, 20, 4, cloth)
    R.fill_polygon(f.L, [(2, 6.5), (5, 6.5), (3.5, 10)], cloth)
    R.fill_polygon(f.L, [(19, 6.5), (22, 6.5), (20.5, 10)], cloth)
    f.rect(2, 3, 20, 1, trim)
    return f.done()


def altar(frame):
    f = Fig(24, 24)
    stone = f.part('stone', 'gray', -1)
    top = f.part('top', 'gray')
    glow = f.part('glow', 'trim')
    f.rect(5, 10, 14, 12, stone)
    f.rect(3, 21, 18, 3, stone)
    f.rect(3, 8, 18, 3, top)
    # rune: a diamond with a cross, in tintable white
    R.fill_polygon(f.L, [(12, 12), (15.5, 16), (12, 20), (8.5, 16)], glow)
    c = f.done()
    hole = P.sid(P.RAMPS['gray'][1])
    for y, x in ((16, 11), (16, 12), (15, 12), (17, 12)):
        c.a[y, x] = hole
    if frame == 1:                       # glow above the altar (gentle 1 fps pulse)
        for x in range(6, 18):
            c.a[6, x] = P.sid((0xff, 0xff, 0xff)) if x % 3 else -1
        for x in range(8, 16, 2):
            c.a[4, x] = P.sid((0xb0, 0xb0, 0xb0))
    return c


def flask():
    f = Fig(16, 24)
    stand = f.part('stand', 'vl_wood')
    glass = f.part('glass', 'fx_heal')
    neck = f.part('neck', 'w_steel', -1)
    cork = f.part('cork', 'w_wood', -1)
    f.rect(2, 20, 12, 4, stand)
    R.ellipse(f.L, 7.5, 14, 5.6, 5.6, glass)
    f.rect(6, 4, 4, 5, neck)
    f.rect(5, 1, 6, 3, cork)
    c = f.done()
    c.a[11, 5] = P.WHITE
    c.a[12, 5] = P.WHITE
    return c


def cauldron(frame):
    f = Fig(24, 20)
    pot = f.part('pot', 'gray', 1)
    rim = f.part('rim', 'gray')
    brew = f.part('brew', 'fx_heal', -1)
    fire = f.part('fire', 'w_gold', -1)
    R.ellipse(f.L, 11.5, 12, 9.5, 6.5, pot)
    f.rect(2, 6, 20, 3, rim)
    f.rect(4, 6, 16, 2, brew)
    f.rect(4, 18, 3, 2, pot)
    f.rect(17, 18, 3, 2, pot)
    for i, x in enumerate((8, 11, 14)):
        hgt = 2 + (i + frame) % 3
        f.rect(x, 20 - hgt, 2, hgt, fire)
    c = f.done()
    light = P.sid(P.RAMPS['fx_heal'][3])
    for k in range(3):                    # bubbles rising, a frame apart
        y = 5 - ((frame + k * 2) % 4)
        x = 7 + k * 5
        if 0 <= y:
            c.a[y, x] = light
    return c


def key_board():
    f = Fig(16, 24)
    board = f.part('board', 'vl_wood')
    post = f.part('post', 'vl_wood', 1)
    hook = f.part('hook', 'w_steel')
    key = f.part('key', 'w_gold')
    f.rect(6, 12, 4, 12, post)
    f.rect(1, 1, 14, 12, board)
    f.rect(7, 3, 2, 2, hook)
    R.ellipse(f.L, 7.5, 7, 2.4, 2.4, key)
    f.rect(7, 9, 2, 3, key)
    f.rect(9, 10, 2, 1, key)
    c = f.done()
    c.a[7, 7] = P.sid(P.RAMPS['vl_wood'][1])
    return c


def reroll():
    f = Fig(16, 24)
    barrel = f.part('barrel', 'vl_wood')
    hoop = f.part('hoop', 'w_steel', 1)
    cup = f.part('cup', 'w_wood')
    die = f.part('die', 'white')
    R.ellipse(f.L, 7.5, 17, 6.6, 6.8, barrel)
    f.rect(1, 13, 14, 1, hoop)
    f.rect(1, 20, 14, 1, hoop)
    f.rect(2, 4, 6, 7, cup)
    f.rect(9, 6, 5, 5, die)
    c = f.done()
    for (y, x) in ((7, 10), (9, 12), (8, 11)):
        c.a[y, x] = P.INK
    return c


def statue(kind):
    """Gray stone hero on a plinth with gold details, 32 × 48."""
    from .rig import humanoid_fk
    f = Fig(32, 48)
    stone = f.part('stone', 'gray', -1)
    plinth = f.part('plinth', 'gray', 1)
    gold = f.part('gold', 'w_gold')
    poses = {
        'swordsman': {'armF': (160, 10), 'armB': (-20, 20), 'legF': (14, 6), 'legB': (-10, 2)},
        'tank': {'armF': (60, 40), 'armB': (20, 60), 'legF': (12, 4), 'legB': (-12, 4)},
        'archer': {'armF': (90, 0), 'armB': (80, 100), 'legF': (16, 4), 'legB': (-14, 2)},
        'wizard': {'armF': (40, 60), 'armB': (-10, 20), 'legF': (8, 4), 'legB': (-6, 2)},
    }
    pose = dict(poses[kind], lean=0, hipOffset=(0, 0))
    j = humanoid_fk(pose, feet=(15, 39))
    f.rect(3, 40, 26, 8, plinth)
    f.rect(2, 40, 28, 2, plinth)
    hx, hy = j['head']
    for side in 'BF':
        R.capsule(f.L, j['hip'], j['knee' + side], 4, stone)
        R.capsule(f.L, j['knee' + side], (j['foot' + side][0], j['foot' + side][1] - 1), 3, stone)
    cx, cy = j['chest']
    R.fill_polygon(f.L, [(cx - 3.5, cy), (cx + 4.5, cy), (j['hip'][0] + 4, j['hip'][1] + 2),
                         (j['hip'][0] - 3, j['hip'][1] + 2)], stone)
    R.ellipse(f.L, hx, hy, 3.6, 4, stone)
    for side in 'BF':
        R.capsule(f.L, j['shoulder' + side], j['elbow' + side], 3, stone)
        R.capsule(f.L, j['elbow' + side], j['hand' + side], 3, stone)
    hf = j['handF']
    if kind == 'swordsman':
        R.capsule(f.L, (hf[0], hf[1] - 1), (hf[0] + 1, max(1, hf[1] - 12)), 2.2, stone)
        R.line(f.L, (hf[0] - 2, hf[1]), (hf[0] + 2, hf[1]), gold)
    elif kind == 'tank':
        shield = f.part('shield', 'gray')
        R.ellipse(f.L, hf[0] + 1, hf[1] - 2, 4.5, 6, shield)
        R.ellipse(f.L, hf[0] + 1, hf[1] - 2, 1.4, 1.4, gold)
        hb = j['handB']
        R.line(f.L, (hb[0], hb[1]), (hb[0] - 3, hb[1] - 12), stone)
        f.rect(hb[0] - 6, hb[1] - 16, 7, 5, stone)
        f.rect(hb[0] - 6, hb[1] - 16, 7, 1, gold)
    elif kind == 'archer':
        bow = f.part('bow', 'gray', 1)
        for t in range(-7, 8):
            R.line(f.L, (hf[0] + 2 - int(abs(t) * 0.3), hf[1] + t), (hf[0] + 2 - int(abs(t) * 0.3), hf[1] + t), bow)
        R.line(f.L, (hf[0] - 1, hf[1] - 7), (j['handB'][0], j['handB'][1]), gold)
        R.line(f.L, (j['handB'][0], j['handB'][1]), (hf[0] - 1, hf[1] + 7), gold)
    elif kind == 'wizard':
        R.line(f.L, (hf[0] + 1, hf[1] + 6), (hf[0] + 1, hf[1] - 14), stone)
        R.ellipse(f.L, hf[0] + 1, hf[1] - 15, 1.6, 1.6, gold)
        R.fill_polygon(f.L, [(hx - 6, hy - 2.5), (hx + 6, hy - 2.5), (hx + 1, hy - 7), (hx - 2, hy - 12),
                             (hx - 3, hy - 6)], stone)
        R.fill_polygon(f.L, [(cx - 3.5, j['hip'][1]), (cx + 5, j['hip'][1]), (cx + 7, 38), (cx - 5, 38)], stone)
    c = f.done()
    for x in range(10, 22, 3):                                       # gold plate on the plinth
        c.a[44, x] = P.sid(P.RAMPS['w_gold'][2])
    return c


def unlocks_board():
    f = Fig(32, 32)
    post = f.part('post', 'vl_wood', 1)
    board = f.part('board', 'vl_wood')
    paper = f.part('paper', 'vl_plaster', -1)
    pin = f.part('pin', 'w_gold')
    f.rect(4, 18, 3, 14, post)
    f.rect(25, 18, 3, 14, post)
    f.rect(1, 2, 30, 20, board)
    f.rect(0, 1, 32, 2, post)
    for (x, y, w, h) in ((4, 6, 8, 10), (14, 5, 7, 8), (22, 7, 7, 11), (13, 14, 7, 6)):
        f.rect(x, y, w, h, paper)
        f.rect(x + w // 2, y, 1, 1, pin)
    c = f.done()
    lines = P.sid(P.RAMPS['vl_plaster'][0])
    for (x, y, w) in ((5, 9, 6), (5, 11, 5), (15, 8, 5), (23, 10, 5), (23, 12, 4), (14, 16, 5)):
        for k in range(w):
            if c.a[y, x + k] >= 0:
                c.a[y, x + k] = lines
    return c


def seed_board():
    f = Fig(24, 32)
    frame = f.part('frame', 'vl_wood')
    slate = f.part('slate', 'gray', 3)
    f.rect(2, 4, 20, 16, frame)
    f.rect(4, 6, 16, 12, slate)
    R.line(f.L, (5, 20), (2, 31), frame)
    R.line(f.L, (18, 20), (21, 31), frame)
    R.line(f.L, (11, 20), (11, 31), frame)
    c = f.done()
    chalk = P.sid(P.RAMPS['white'][0])
    for x in range(8, 16):                                          # a chalk die
        c.a[8, x] = chalk
        c.a[15, x] = chalk
    for y in range(8, 16):
        c.a[y, 8] = chalk
        c.a[y, 15] = chalk
    for (y, x) in ((10, 10), (12, 12), (13, 13), (10, 13), (13, 10)):
        c.a[y, x] = chalk
    return c


def gate(frame):
    f = Fig(32, 64)
    post = f.part('post', 'vl_wood')
    beam = f.part('beam', 'vl_wood', 1)
    plank = f.part('plank', 'vl_wood', -1)
    lamp = f.part('lamp', 'w_steel', 1)
    f.rect(1, 6, 5, 58, post)
    f.rect(26, 6, 5, 58, post)
    f.rect(0, 4, 32, 5, beam)
    for x in range(7, 25, 6):
        f.rect(x, 30, 5, 34, plank)
    f.rect(6, 36, 20, 3, beam)
    f.rect(6, 54, 20, 3, beam)
    f.rect(13, 10, 6, 2, lamp)
    f.rect(12, 12, 8, 9, lamp)
    c = f.done()
    lights = P.RAMPS['vl_light']
    on, off = P.sid(lights[1]), P.sid(lights[0])
    for y in range(14, 19):
        for x in range(14, 18):
            c.a[y, x] = on if frame == 0 or (x + y) % 2 else off
    return c


def loot_stand():
    f = Fig(16, 16)
    st = f.part('stone', 'gray', -1)
    f.rect(4, 6, 8, 8, st)
    f.rect(2, 13, 12, 3, st)
    f.rect(2, 4, 12, 3, st)
    return f.done()


def mirror_spot():
    f = Fig(24, 40)
    wood = f.part('wood', 'vl_wood')
    foot = f.part('foot', 'vl_wood', 1)
    R.ellipse(f.L, 11.5, 15, 10, 14, wood)
    c_hole = np.zeros((40, 24), bool)
    ys, xs = np.mgrid[0:40, 0:24]
    c_hole = ((xs + 0.5 - 12) / 7.2) ** 2 + ((ys + 0.5 - 15.5) / 11) ** 2 <= 1
    f.L.ids[c_hole] = -1                                           # empty frame: no glass yet
    f.rect(10, 28, 4, 9, foot)
    f.rect(5, 36, 14, 4, foot)
    return f.done()


def dummy(frame):
    """Straw training dummy on a post (08 §7.3), 48 × 48, anchor (24, 46)."""
    f = Fig(48, 48)
    post = f.part('post', 'vl_wood', 1)
    straw = f.part('straw', 'w_gold', 1)
    rope = f.part('rope', 'vl_wood')
    base = f.part('base', 'gray', 1)
    tilt = [0, -14, -6, 0][frame]
    import math as _m
    def rot(x, y):
        cx, cy = 24, 44
        a = _m.radians(tilt)
        dx, dy = x - cx, y - cy
        return (cx + dx * _m.cos(a) - dy * _m.sin(a), cy + dx * _m.sin(a) + dy * _m.cos(a))
    f.rect(17, 41, 14, 4, base)
    R.capsule(f.L, (24, 42), tuple(int(round(v)) for v in rot(24, 22)), 3, post)
    R.capsule(f.L, tuple(int(round(v)) for v in rot(14, 28)), tuple(int(round(v)) for v in rot(34, 28)), 3, post)
    hx, hy = rot(24, 22)
    R.ellipse(f.L, *rot(24, 31), 6, 7, straw)
    R.ellipse(f.L, hx, hy, 4.5, 4.5, straw)
    R.line(f.L, tuple(int(round(v)) for v in rot(19, 34)), tuple(int(round(v)) for v in rot(29, 34)), rope)
    R.line(f.L, tuple(int(round(v)) for v in rot(21, 25)), tuple(int(round(v)) for v in rot(27, 25)), rope)
    c = f.done()
    if frame:                                                     # straw bits flying off when hit
        for (x, y) in ((33, 20), (36, 24), (34, 30))[:frame + 1]:
            c.a[y, x] = P.sid(P.RAMPS['w_gold'][2])
    return c


def prop_frames():
    fr = {'shop_item_00': shop_item(), 'shop_flask_00': flask(), 'shop_key_00': key_board(),
          'shop_reroll_00': reroll(), 'unlocks_board_00': unlocks_board(), 'seed_board_00': seed_board(),
          'loot_stand_00': loot_stand(), 'mirror_spot_00': mirror_spot()}
    for i in range(2):
        fr[f'ability_altar_idle_{i:02d}'] = altar(i)
        fr[f'gate_idle_{i:02d}'] = gate(i)
    for i in range(4):
        fr[f'shop_refill_idle_{i:02d}'] = cauldron(i)
    for k in ('swordsman', 'tank', 'archer', 'wizard'):
        fr[f'class_statue_{k}_00'] = statue(k)
    return {k: _img(v) for k, v in fr.items()}


def dummy_frames():
    fr = {'training_dummy_idle_00': dummy(0)}
    for i in range(3):
        fr[f'training_dummy_hit_{i:02d}'] = dummy(i + 1)
    return {k: _img(v) for k, v in fr.items()}


# 08 §7.3: the dummy has only `idle` (1) and `hit` (3). Held out of anims.json for now: the game's enemy view
# expects every enemy with `<id>_idle` to also have stagger/death and errors on the dummy (docs/art/SPEC-GAPS-art.md #3).
DUMMY_ANIMS = [A.anim('training_dummy_idle', 'enemies_extra', 1, 'once'),
               A.anim('training_dummy_hit', 'enemies_extra', 3, 'once', 20)]


def anims():
    out = [A.anim('ability_altar_idle', ATLAS, 2, 'loop', 1), A.anim('gate_idle', ATLAS, 2, 'loop', 2),
           A.anim('shop_refill_idle', ATLAS, 4, 'loop', 6)]
    for k in ('shop_item', 'shop_flask', 'shop_key', 'shop_reroll', 'unlocks_board', 'seed_board', 'loot_stand',
              'mirror_spot', 'class_statue_swordsman', 'class_statue_tank', 'class_statue_archer',
              'class_statue_wizard', 'cottage_a', 'cottage_b', 'well', 'market_roof', 'inn'):
        out.append(A.anim(k, ATLAS, 1, 'once'))
    return out


def all_frames():
    fr = dict(building_frames())
    fr.update(prop_frames())
    return fr


def build(assets, preview):
    from .projectiles import sheet
    fr = all_frames()
    for n, img in fr.items():
        P.check_palette_lock(img, P.allowed(ALLOWED), ATLAS, n)
    A.pack_atlas(ATLAS, fr, os.path.join(assets, 'atlases'))
    sheet({k: v for k, v in fr.items() if k != 'market_roof_00'}, os.path.join(preview, 'objects_sheet.png'), scale=3)
    dummy = dummy_frames()
    for n, img in dummy.items():
        P.check_palette_lock(img, P.allowed(['ink', 'vl_wood', 'gray', 'w_gold']), 'enemies_extra', n)
    A.pack_atlas('enemies_extra', dummy, os.path.join(assets, 'atlases'))
    return anims()
