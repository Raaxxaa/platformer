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


def all_frames():
    fr = dict(building_frames())
    fr.update(prop_frames()) if 'prop_frames' in globals() else None
    return fr


def build(assets, preview):
    from .projectiles import sheet
    fr = all_frames()
    for n, img in fr.items():
        P.check_palette_lock(img, P.allowed(ALLOWED), ATLAS, n)
    A.pack_atlas(ATLAS, fr, os.path.join(assets, 'atlases'))
    sheet({k: v for k, v in fr.items() if k != 'market_roof_00'}, os.path.join(preview, 'objects_sheet.png'), scale=3)
    return anims() if 'anims' in globals() else []
