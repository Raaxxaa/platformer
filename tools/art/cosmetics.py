"""ART10 Tasks 4-5: the 35 enemy accessories and the shop hats and capes (09 §3, §5), their icons and the cosmetics atlas.

Every accessory is a 32 × 32 image with its anchor (16, 16) on one of the player's attachment points (anims.json
`points`: head, back, neck, shoulder). Facing right, drawn in the enemy's own ramps. Capes and wings have three frames
(`_00` idle, `_01` run, `_02` air); floating extras have two (a 1 px bob); everything else has one."""
import math
import os

import numpy as np
from PIL import Image

from . import atlas as A
from . import palette as P
from . import raster as R

SIZE, AX, AY = 32, 16, 16
ATLAS = 'cosmetics'


class Shapes:
    """A list of shapes in anchor-relative coordinates (x right, y down), drawn back to front."""

    def __init__(self):
        self.items = []
        self.px = []
        self.holes = []

    def poly(self, ramp, pts, shift=0):
        self.items.append(('p', ramp, shift, pts))
        return self

    def ell(self, ramp, cx, cy, rx, ry, shift=0):
        self.items.append(('e', ramp, shift, (cx, cy, rx, ry)))
        return self

    def rect(self, ramp, x0, y0, w, h, shift=0):
        self.items.append(('r', ramp, shift, (x0, y0, w, h)))
        return self

    def line(self, ramp, p0, p1, width=2, shift=0):
        self.items.append(('l', ramp, shift, (p0, p1, width)))
        return self

    def dot(self, ramp, i, x, y):
        self.px.append((ramp, i, x, y))
        return self

    def hole(self, x0, y0, w, h):
        self.holes.append((x0, y0, w, h))
        return self


def render(sh, scale=1.0, size=SIZE, off=(AX, AY), outline=True):
    """Draw a Shapes list; `scale` and `off` let the icons reuse the same drawing at a smaller size."""
    L = R.PartLayer(size, size)
    ox, oy = off

    def tx(x):
        return ox + x * scale

    def ty(y):
        return oy + y * scale
    names = {}
    for kind, ramp, shift, a in sh.items:
        key = (ramp, shift)
        if key not in names:
            names[key] = L.add_part(f'{ramp}_{shift}_{len(names)}', P.ramp_ids(ramp), shift)
        part = names[key]
        if kind == 'p':
            R.fill_polygon(L, [(tx(x), ty(y)) for x, y in a], part)
        elif kind == 'e':
            cx, cy, rx, ry = a
            R.ellipse(L, tx(cx) - 0.5, ty(cy) - 0.5, max(rx * scale, 0.6), max(ry * scale, 0.6), part)
        elif kind == 'r':
            x0, y0, w, h = a
            xa, ya = int(round(tx(x0))), int(round(ty(y0)))
            R.fill_rect(L, xa, ya, max(1, int(round(tx(x0 + w))) - xa), max(1, int(round(ty(y0 + h))) - ya), part)
        elif kind == 'l':
            p0, p1, w = a
            R.capsule(L, (int(round(tx(p0[0]))), int(round(ty(p0[1])))), (int(round(tx(p1[0]))), int(round(ty(p1[1])))),
                      max(1.0, w * scale), part)
    c = R.auto_shade(L)
    for (x0, y0, w, h) in sh.holes:
        xa, ya = int(round(tx(x0))), int(round(ty(y0)))
        c.a[ya:ya + max(1, int(round(h * scale))), xa:xa + max(1, int(round(w * scale)))] = -1
    if outline:
        R.outline(c, P.INK)
    for ramp, i, x, y in sh.px:
        xi, yi = int(round(tx(x))), int(round(ty(y)))
        if 0 <= xi < size and 0 <= yi < size and (c.a[yi, xi] >= 0 or ramp == 'ink'):
            c.a[yi, xi] = P.sid(P.RAMPS[ramp][min(i, len(P.RAMPS[ramp]) - 1)])
    return c.to_image()


# --------------------------------------------------------------------------------------------------- head items
# the head is about 8 × 8 around (0, 0): top y = -4, front x = +4, back x = -4

def cap_poly(top=-6.0, back=-5.0, front=4.6, brow=-1.6):
    return [(back, 2.0), (back - 0.3, -3), (-2, top), (2, top), (front - 0.4, top + 2.4), (front, brow - 0.4),
            (1.5, brow - 0.8), (-1, -1.2), (-1.4, 2.4)]


def wolf_hood():
    s = Shapes().poly('en_slate', cap_poly(-5.8, -5.4, 4.8, -2.2))
    s.poly('en_slate', [(-3.8, -5.2), (-3.2, -9.5), (-0.6, -5.6)])
    s.poly('en_slate', [(0.4, -5.6), (1.8, -9.2), (3.2, -4.6)])
    s.poly('en_bone', [(-3, -6.2), (-2.9, -8.2), (-1.8, -6.2)], 1)
    s.rect('en_bone', 2, -4.2, 3, 1, 0)
    return s


def bandana():
    s = Shapes().poly('en_red', [(-4.6, -3.8), (4.8, -3.8), (5, -1.6), (-4.6, -1.6)])
    s.poly('en_red', [(-4.4, -3.4), (-8.5, -1.4), (-7.2, 0.8), (-4.4, -1.4)], 1)
    s.poly('en_red', [(-4.4, -3.0), (-7.6, -4.6), (-8.2, -2.6)], 1)
    return s


def feathered_cap():
    s = Shapes().poly('en_olive', cap_poly(-6.0, -5.0, 5.0, -1.8))
    s.rect('en_olive', -5, -3, 10, 1, 2)
    s.line('en_bone', (-1, -5.6), (-7, -11.5), 2)
    s.line('fx_fire', (-6, -10.4), (-8.4, -12.6), 2)
    return s


def boar_skull():
    s = Shapes().poly('en_bone', cap_poly(-6.2, -5.2, 5.0, -1.5))
    s.rect('en_bone', 1.5, -4.0, 4, 2, 2)
    s.line('en_bone', (3.4, -2.2), (6.0, 1.4), 2, 1)
    s.line('en_bone', (-1.4, -2.2), (-0.2, 1.2), 1.4, 1)
    s.dot('ink', 0, 3, -2.4).dot('ink', 0, 2, -2.4)
    s.dot('ink', 0, -3, -3.6).dot('ink', 0, -2, -3.6)
    return s


def miner_helmet():
    s = Shapes().poly('en_ochre', cap_poly(-6.4, -5.2, 5.0, -1.6))
    s.rect('en_ochre', -5.4, -2.6, 11, 1.4, 2)
    s.rect('w_gold', 4.4, -5.2, 3, 3)
    s.dot('fx_fire', 3, 6, -4).dot('fx_fire', 3, 6, -3.2)
    s.line('en_steel', (-4, -4.4), (4, -4.4), 1)
    return s


def ram_horns():
    s = Shapes()
    for sx in (1.0,):
        s.line('en_bone', (-1.5, -4), (-2.6, -7.2), 2.4)
        s.line('en_bone', (-2.6, -7.2), (-5.6, -8.2), 2.2)
        s.line('en_bone', (-5.6, -8.2), (-7.4, -5.8), 2.0)
        s.line('en_bone', (-7.4, -5.8), (-5.6, -3.8), 1.6)
        s.line('en_bone', (1.4, -4.2), (2.6, -7.4), 2.4, 1)
        s.line('en_bone', (2.6, -7.4), (5.6, -8.0), 2.0, 1)
        s.line('en_bone', (5.6, -8.0), (7.2, -5.6), 1.8, 1)
    s.rect('en_bone', -3.6, -4.6, 7, 1.6, 1)
    return s


def stone_crown():
    s = Shapes().rect('mt_rock', -4.6, -4.6, 9.4, 2.4)
    for x in (-4.4, -1.4, 1.6):
        s.rect('mt_rock', x, -8.2 + (1 if x == -1.4 else 0), 3, 4, 1)
    s.dot('mt_rock', 4, -3, -6).dot('mt_rock', 4, 0, -5).dot('mt_rock', 4, 3, -6)
    return s


def witch_hat():
    s = Shapes().ell('en_violet', 0, -3.2, 7.4, 1.6)
    s.poly('en_violet', [(-3.6, -3.2), (3.4, -3.2), (1.6, -8), (-1.2, -11.5), (-4.6, -13.2), (-5.6, -11.4), (-3.2, -9.6),
                         (-3.0, -6.4)])
    s.rect('en_ochre', -3.4, -5.2, 6.4, 1.4, 1)
    s.dot('en_gold', 3, 0, -4.6)
    return s


def circlet():
    s = Shapes().rect('en_magenta', -4.6, -3.8, 9.6, 1.8)
    for x in (-3.6, -1.2, 1.2, 3.6):
        s.rect('en_magenta', x - 0.5, -5.6, 1.6, 1.8, 1)
        s.dot('white', 0, x + 0.2, -5.4).dot('ink', 0, x + 0.2, -4.6)
    s.poly('en_magenta', [(-4.4, -3.4), (-6.6, -5.4), (-5.6, -2.4)], 1)
    return s


def kettle_helm():
    s = Shapes().poly('en_steel', [(-4.8, -1.8), (-4.6, -4), (-2.2, -6.4), (2.2, -6.4), (4.8, -4), (4.8, -1.8)])
    s.ell('en_steel', 0, -2.4, 8.2, 1.5, 1)
    s.rect('en_steel', -0.6, -6.8, 1.4, 1.6, 2)
    return s


def runed_hood():
    s = Shapes().poly('en_red', cap_poly(-6.0, -5.6, 4.8, -2.4))
    s.poly('en_red', [(-5, -2), (-8.6, 1.6), (-3, 3)], 1)
    for (x, y) in ((1, -4), (-1, -3.8), (3, -3.4), (-3, -3.4)):
        s.dot('fx_fire', 3, x, y)
    return s


def black_plume_helm():
    s = Shapes().poly('en_black', [(-4.8, 3), (-5, -3.4), (-2.4, -6.2), (2.4, -6.2), (5, -3.4), (5, 0), (1, 0.6), (-1.2, 3)])
    s.rect('ink', 0, -2.4, 5, 1.2)
    s.line('en_black', (-1, -6.2), (0, -7.4), 2)
    s.poly('en_red', [(-0.5, -6.6), (2, -9.6), (-2, -11), (-7, -8.6), (-8, -5), (-5, -7)], 0)
    return s


def plumed_hat():
    s = Shapes().poly('en_red', [(-4.6, -1.6), (-4.4, -4.2), (-1.8, -6.6), (2.4, -6.6), (4.8, -4), (5, -1.6)])
    s.ell('en_red', 0, -2.4, 7.6, 1.4, 1)
    s.rect('en_gold', -4.4, -4.2, 9, 1.2, 1)
    s.poly('en_bone', [(-2, -6.6), (-6, -11), (-9, -10.4), (-7, -7), (-4, -5)], 0)
    return s


def exec_hood():
    s = Shapes().ell('en_black', -0.2, -0.4, 5.1, 5.4)
    s.poly('en_black', [(-3, 3), (-6, 6.4), (2, 5.4)], 1)
    s.hole(1.0, -1.6, 3.2, 1.8)
    return s


def fallen_crown():
    s = Shapes().rect('en_gold', -4.2, -4.4, 8.8, 2.2)
    for x, h in ((-4.2, 3.6), (-1.6, 4.6), (1.0, 3.8), (3.4, 4.8)):
        s.poly('en_gold', [(x, -4.4), (x + 1.2, -4.4 - h), (x + 2.4, -4.4)], 0)
    s.dot('fx_heal', 2, -1, -3.2).dot('fx_heal', 2, 2, -3.2).dot('white', 0, 0, -8.6)
    return s


# --------------------------------------------------------------------------------------------------- shop hats

def straw_hat():
    s = Shapes().ell('w_gold', 0, -2.6, 8.8, 1.8, 1)
    s.poly('w_gold', [(-4, -2.8), (-3.6, -5.6), (-1.5, -7.2), (1.8, -7.2), (3.8, -5.6), (4, -2.8)])
    s.rect('en_red', -3.8, -4.4, 7.6, 1.2, 0)
    return s


def beret():
    s = Shapes().ell('en_magenta', -0.6, -4.2, 5.8, 2.6)
    s.poly('en_magenta', [(-5, -3), (5, -3), (4.4, -1.6), (-5, -1.6)], 1)
    s.line('en_bone', (-1, -5.6), (-6, -11), 2)
    s.line('fx_heal', (-5, -9.8), (-7.4, -12), 2)
    return s


def flower_crown():
    s = Shapes().line('pl_grass', (-4.4, -1.8), (-2, -5), 1.6).line('pl_grass', (-2, -5), (2, -5), 1.6)
    s.line('pl_grass', (2, -5), (4.6, -2.2), 1.6)
    for (x, y, c) in ((-3.6, -3.4, 'fx_heal'), (-0.6, -5.2, 'w_gold'), (2.6, -4.2, 'white'), (4.2, -2.4, 'fx_heal'),
                      (-4.8, -1.6, 'white')):
        s.ell(c, x, y, 1.5, 1.5, 0)
        s.dot('w_gold', 1, x, y)
    return s


def tricorn():
    s = Shapes().poly('en_black', [(-8.6, -2.6), (-4, -7.6), (0, -5.8), (4, -7.6), (8.6, -2.6), (4, -1.4), (-4, -1.4)])
    s.rect('w_gold', -8, -3.2, 16, 1, 0)
    s.dot('white', 0, 0, -4)
    return s


def top_hat():
    s = Shapes().ell('en_black', 0, -2.6, 6.6, 1.4)
    s.rect('en_black', -3.6, -11.4, 7.2, 9, 0)
    s.rect('en_red', -3.6, -5.2, 7.2, 1.8, 0)
    s.rect('en_black', -3.6, -11.8, 7.2, 1, 2)
    return s


# --------------------------------------------------------------------------------------------------- back items
# anchor = the back point (behind the shoulder blades); the body is at x > 0

def cape_pts(frame, length=15.0, width=7.0):
    """Idle hangs, run trails behind, air streams up and back."""
    bx, by = [(-width - 0.5, length), (-width - 6.5, length - 4.0), (-width - 6.0, length - 11.0)][frame]
    return [(1.2, -3.0), (-1.4, -4.0), (bx - 1.2, by - 4.5), (bx - 0.4, by), (bx + width * 0.9, by + 0.8),
            (bx + width * 1.7, by - 0.4), (1.8, length * (0.5 if frame == 0 else 0.4))]


def plain_cape(ramp, frame, trim=None, length=15.0, shift=0):
    pts = cape_pts(frame, length)
    s = Shapes().poly(ramp, pts, shift)
    if trim:
        s.line(trim, pts[3], pts[4], 1.4)
        s.line(trim, pts[4], pts[5], 1.4)
    return s, pts


def bat_wings(frame):
    up = (0, -2, -7)[frame]
    s = Shapes().poly('en_violet', [(0.6, -3), (-7, -5 + up), (-12 + frame * -1, 0 + up), (-9.5, 1 + up), (-9, 7 + up // 2),
                                    (-6, 4), (-4.4, 10 + up // 2), (-2, 5), (0.4, 8)])
    s.line('en_violet', (0, -2), (-9, 0 + up), 1, 2)
    s.line('en_violet', (0, -1), (-8.6, 6 + up // 2), 1, 2)
    return s


def tattered_shroud(frame):
    s, pts = plain_cape('sw_moss', frame, length=14, shift=1)
    for k in range(1, 4):
        x, y = pts[3][0] + k * 2.1, pts[3][1]
        s.poly('sw_moss', [(x, y), (x + 1.1, y + 3.4), (x + 2, y)], 1)
    s.dot('sw_mud', 0, pts[3][0] + 2, pts[3][1] - 4).dot('sw_mud', 0, pts[3][0] + 4, pts[3][1] - 7)
    return s


def leafy_mantle(frame):
    s, pts = plain_cape('sw_moss', frame, length=11, shift=0)
    for k, (x, y) in enumerate((pts[3], pts[4], pts[5], (pts[2][0] + 1, pts[2][1] + 4), (pts[3][0] + 2, pts[3][1] - 4))):
        s.poly('pl_grass', [(x - 1.6, y), (x, y + 3.6), (x + 1.8, y), (x, y - 2)], 0 if k % 2 else 1)
    return s


def quiver(frame):
    s = Shapes().line('en_ochre', (-4.2, 9), (-2.0, -4), 4.4)
    s.rect('en_ochre', -5, -4.4, 5.6, 1.4, 2)
    for k, x in enumerate((-4.2, -2.6, -1.0)):
        s.line('en_bone', (x - 0.4, -4.4), (x + 0.4, -9.6 - (k % 2)), 1.2)
        s.dot('en_steel', 3, x + 0.4, -9.8 - (k % 2))
    return s


def knight_cape(frame):
    s, pts = plain_cape('en_steel', frame, trim='en_red', length=16)
    cx, cy = (pts[2][0] + pts[5][0]) / 2 + 1, pts[2][1] * 0.35 + pts[3][1] * 0.65
    s.rect('en_red', cx - 0.7, cy - 3, 1.6, 6.4, 0).rect('en_red', cx - 2.6, cy - 0.6, 5.6, 1.6, 0)
    return s


def stone_wings(frame):
    spread = (0, 3, 8)[frame]
    s = Shapes().poly('mt_rock', [(0.6, -3), (-5, -9 - spread), (-10, -6 - spread), (-12, -1 - spread // 2), (-9, 1),
                                  (-8, 6), (-5, 4), (-3, 8), (0, 4)])
    s.poly('mt_rock', [(-1, -2), (-6, -7 - spread), (-9, -3 - spread // 2)], 1)
    s.line('mt_rock', (0, -2), (-11, -1 - spread // 2), 1, 3)
    s.line('mt_rock', (0, 0), (-8, 6), 1, 3)
    return s


def dragon_cape(ramp):
    def draw(frame):
        s, pts = plain_cape(ramp, frame, length=16)
        px0, py0 = pts[3]
        for k in range(8):
            for j in range(3):
                x = px0 + 1.6 + k * 1.2 - (j % 2) * 0.6
                y = py0 - 2 - j * 3.4
                s.dot(ramp, 3 if (k + j) % 2 else 0, x, y)
        s.line(ramp, pts[3], pts[5], 1.4, 2)
        return s
    return draw


def patched_cape(frame):
    s, pts = plain_cape('p_leather', frame, length=15)
    x, y = pts[3]
    s.rect('en_red', x + 2, y - 8, 3, 3, 0).rect('en_olive', x + 5, y - 4, 3, 3, 0).rect('en_ochre', x + 1, y - 3.4, 2, 2, 0)
    for (a, b) in ((x + 2, y - 8), (x + 5, y - 4)):
        s.dot('ink', 0, a + 1, b + 1)
    return s


def starry_cape(frame):
    s, pts = plain_cape('p_cloth', frame, trim='w_gold', length=16)
    x, y = pts[3]
    for k, (dx, dy) in enumerate(((1.5, -3), (5, -7), (3, -11), (7, -2), (6.2, -10.4), (0.6, -8))):
        s.dot('white', 0, x + dx, y + dy)
        if k % 2 == 0:
            s.dot('fx_bolt', 2, x + dx + 1, y + dy)
    return s


def checkered_cape(frame):
    s, pts = plain_cape('white', frame, length=15)
    x, y = pts[3]
    for i in range(-1, 8):
        for j in range(0, 6):
            if (i + j) % 2 == 0:
                s.dot('en_black', 0, x + i * 1.6 + 1, y - 1 - j * 2.4)
    return s


def royal_cape(frame):
    s, pts = plain_cape('en_violet', frame, trim='w_gold', length=16)
    s.line('white', pts[0], (pts[0][0] - 1.5, pts[0][1] + 2.5), 1.6)
    return s


def gold_cape(frame):
    s, pts = plain_cape('w_gold', frame, trim='white', length=16)
    x, y = pts[3]
    s.dot('white', 0, x + 3, y - 8).dot('white', 0, x + 6, y - 3).dot('white', 0, x + 1, y - 4)
    return s


# --------------------------------------------------------------------------------------------------- extras

def tusk_necklace():
    s = Shapes().line('p_leather', (-3.4, -2.6), (0, 0.8), 1).line('p_leather', (0, 0.8), (3.4, -2.6), 1)
    for x, y in ((-2.0, -0.6), (0, 0.8), (2.0, -0.6)):
        s.poly('en_bone', [(x - 0.9, y), (x + 0.9, y), (x + 0.2, y + 3.4)], 0)
    return s


def spiked_pads():
    s = Shapes().ell('en_red', 0, 0, 3.6, 2.8)
    s.poly('en_bone', [(-2, -2), (-2.6, -6), (-0.8, -2.4)], 0).poly('en_bone', [(0, -2.6), (0.6, -6.6), (1.8, -2.4)], 0)
    s.poly('en_bone', [(2.4, -1), (5.6, -3.4), (3.6, 0.4)], 0)
    return s


def pebble_pauldrons():
    s = Shapes().ell('en_ochre', 0, 0, 3.8, 2.6)
    for (x, y, r, sh) in ((-2.4, -2.4, 1.8, 1), (1.2, -3.0, 1.6, 0), (3.2, -0.6, 1.5, 1), (-3, 0.4, 1.4, 0)):
        s.ell('en_ochre', x, y, r, r, sh)
    return s


def bead_mask():
    s = Shapes().poly('en_bone', [(0.6, -3.4), (4.6, -3), (4.8, 1.4), (3, 4), (0.8, 3)])
    s.hole(1.6, -1.6, 1.2, 1.6)
    s.dot('ink', 0, 2.2, -1).dot('ink', 0, 3.6, -1.2)
    for x in (1.0, 2.4, 3.8):
        s.dot('en_olive', 3, x, 4.6).dot('en_ochre', 2, x, 6.0)
    s.dot('fx_fire', 2, 2.6, -3.6)
    return s


def silk_scarf():
    s = Shapes().poly('en_ghost', [(-3.6, -1.6), (3.8, -1.6), (3.8, 0.8), (-3.6, 0.8)])
    s.poly('en_ghost', [(-3.2, 0.2), (-9, 3.6), (-7.2, 5.8), (-2, 1.8)], 1)
    s.line('en_ghost', (-2.4, 0.8), (-6.4, 4.2), 1, 3)
    return s


def tiny_spider(frame):
    s = Shapes()
    b = (0, 1)[frame]
    for k, dx in enumerate((-3, -1.2, 1.2, 3)):
        s.line('en_black', (0, -1 + b), (dx * 1.8, -4 + b + (k % 2)), 1)
        s.line('en_black', (0, -1 + b), (dx * 1.8, 2 + b - (k % 2)), 1)
    s.ell('en_black', 0, -1 + b, 2.4, 2)
    s.dot('en_magenta', 2, 1, -1.6 + b).dot('en_magenta', 2, 1, -0.6 + b)
    return s


def wisp_lantern(frame):
    b = (0, 1)[frame]
    s = Shapes().line('w_gold', (-3, -9 + b), (-3, -7 + b), 1)
    s.rect('w_gold', -5, -7 + b, 4, 1.2, 1).rect('w_gold', -5, -2.6 + b, 4, 1.2, 1)
    s.rect('en_glow', -4.4, -6 + b, 3, 3.4, 2)
    s.dot('white', 0, -3, -4.4 + b)
    return s


def spiked_collar():
    s = Shapes().poly('en_steel', [(-3.4, -1), (3.6, -1), (3.6, 1), (-3.4, 1)], 1)
    for x in (-2.6, -0.6, 1.4, 3.2):
        s.poly('en_steel', [(x - 0.7, -1), (x, -3.4), (x + 0.7, -1)], 0)
    return s


def star_scarf():
    s = Shapes().poly('fx_bolt', [(-3.6, -1.6), (3.8, -1.6), (3.8, 0.8), (-3.6, 0.8)], 0)
    s.poly('fx_bolt', [(-3.2, 0.2), (-9, 4), (-7, 6.2), (-2, 1.8)], 0)
    for (x, y) in ((-1, -0.4), (2, -0.4), (-5.8, 3.4)):
        s.dot('en_gold', 3, x, y)
    return s


def gauntlet_pauldron():
    s = Shapes().ell('en_black', 0, 0, 3.8, 2.8)
    s.rect('en_black', -2, 2, 4, 3, 1)
    s.dot('en_ghost', 2, 0, 0).dot('en_ghost', 3, 1, -1).dot('en_ghost', 2, -2, 4).dot('en_ghost', 1, 2, 4)
    s.poly('en_ghost', [(2, -2), (3.4, -6), (4.4, -2)], 0)
    return s


# id -> (slot, attachment point, frames, builder)
def _one(fn):
    return lambda frame: fn()


ACCESSORIES = {
    'acc_wolf': ('head', 'head', 1, _one(wolf_hood)), 'acc_bandit': ('head', 'head', 1, _one(bandana)),
    'acc_bandit_archer': ('head', 'head', 1, _one(feathered_cap)), 'acc_wild_boar': ('extra', 'neck', 1, _one(tusk_necklace)),
    'acc_bandit_brute': ('extra', 'shoulder', 1, _one(spiked_pads)), 'acc_great_boar': ('head', 'head', 1, _one(boar_skull)),
    'acc_bat_swarm': ('back', 'back', 3, bat_wings), 'acc_goblin_miner': ('head', 'head', 1, _one(miner_helmet)),
    'acc_rock_golem': ('extra', 'shoulder', 1, _one(pebble_pauldrons)), 'acc_ram': ('head', 'head', 1, _one(ram_horns)),
    'acc_goblin_shaman': ('extra', 'head', 1, _one(bead_mask)), 'acc_stone_colossus': ('head', 'head', 1, _one(stone_crown)),
    'acc_bog_zombie': ('back', 'back', 3, tattered_shroud), 'acc_giant_spider': ('extra', 'neck', 1, _one(silk_scarf)),
    'acc_spiderling': ('extra', 'shoulder', 2, tiny_spider), 'acc_wisp': ('extra', 'head', 2, wisp_lantern),
    'acc_swamp_witch': ('head', 'head', 1, _one(witch_hat)), 'acc_treant': ('back', 'back', 3, leafy_mantle),
    'acc_spider_queen': ('head', 'head', 1, _one(circlet)), 'acc_soldier': ('head', 'head', 1, _one(kettle_helm)),
    'acc_crossbowman': ('back', 'back', 1, quiver), 'acc_war_hound': ('extra', 'neck', 1, _one(spiked_collar)),
    'acc_battle_mage': ('head', 'head', 1, _one(runed_hood)), 'acc_knight': ('back', 'back', 3, knight_cape),
    'acc_black_knight': ('head', 'head', 1, _one(black_plume_helm)), 'acc_royal_guard': ('head', 'head', 1, _one(plumed_hat)),
    'acc_gargoyle': ('back', 'back', 3, stone_wings), 'acc_castle_mage': ('extra', 'neck', 1, _one(star_scarf)),
    'acc_living_armor': ('extra', 'shoulder', 1, _one(gauntlet_pauldron)),
    'acc_royal_executioner': ('head', 'head', 1, _one(exec_hood)), 'acc_enemy_king': ('head', 'head', 1, _one(fallen_crown)),
    'acc_dragon_red': ('back', 'back', 3, dragon_cape('dr_red')), 'acc_dragon_white': ('back', 'back', 3, dragon_cape('dr_white')),
    'acc_dragon_storm': ('back', 'back', 3, dragon_cape('dr_storm')), 'acc_dragon_green': ('back', 'back', 3, dragon_cape('dr_green')),
}
SHOP = {
    'hat_straw': ('head', 'head', 1, _one(straw_hat)), 'hat_beret': ('head', 'head', 1, _one(beret)),
    'hat_flower': ('head', 'head', 1, _one(flower_crown)), 'hat_tricorn': ('head', 'head', 1, _one(tricorn)),
    'hat_tophat': ('head', 'head', 1, _one(top_hat)),
    'cape_purple': ('back', 'back', 3, royal_cape), 'cape_patched': ('back', 'back', 3, patched_cape),
    'cape_starry': ('back', 'back', 3, starry_cape), 'cape_checkered': ('back', 'back', 3, checkered_cape),
    'cape_gold': ('back', 'back', 3, gold_cape),
}
ALL = {**ACCESSORIES, **SHOP}


def frames():
    out = {}
    for cid, (_slot, _pt, n, fn) in ALL.items():
        for i in range(n):
            out[f'{cid}_{i:02d}'] = render(fn(i))
    return out


import functools


@functools.lru_cache(maxsize=1)
def frames_cache():
    return frames()


def icon(cid):
    """A 16 × 16 icon: the first frame, shrunk to fit (re-drawn at a smaller scale so it stays crisp)."""
    _slot, _pt, _n, fn = ALL[cid]
    sh = fn(0)
    big = np.array(render(sh))[:, :, 3] > 0
    ys, xs = np.nonzero(big)
    x0, x1, y0, y1 = xs.min() - AX, xs.max() + 1 - AX, ys.min() - AY, ys.max() + 1 - AY
    w, h = x1 - x0, y1 - y0
    scale = min(1.0, 13.0 / max(w, h))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return render(sh, scale, 16, (8 - cx * scale + 0.0, 8 - cy * scale + 0.0))


# --------------------------------------------------------------------------------------------------- dyes (icons only)

def snap(rgb):
    """The closest palette color to `rgb` (the lock applies to icons too)."""
    best, bd = None, 1e18
    for c in P.COLORS:
        if c == (0x0d, 0x0b, 0x14):
            continue
        d = sum((a - b) ** 2 for a, b in zip(c, rgb))
        if d < bd:
            best, bd = c, d
    return best


def dye_icon(hexcode, hair=False):
    rgb = tuple(int(hexcode[i:i + 2], 16) for i in (1, 3, 5))
    base = snap(rgb)
    lite = snap(tuple(min(255, int(v * 1.35)) for v in rgb))
    dark = snap(tuple(int(v * 0.65) for v in rgb))
    ink, white = (0x0d, 0x0b, 0x14), (0xf8, 0xf6, 0xf0)
    glass = P.RAMPS['gray'][3]
    rows = ['.....oooo.......', '.....okko.......', '......oo........', '....oooooooo....', '...oggggggggo...',
            '..ogllbbbbbddgo.', '..ogllbbbbbddgo.', '..ogblbbbbbbdgo.', '..ogbbbbbbbbdgo.', '..ogbbbbbbbddgo.',
            '..ogbbbbbbdddgo.', '..ogbbbbbdddddo.', '...ogddddddddo..', '....oooooooooo..', '................',
            '................']
    cols = {'o': ink, 'g': glass, 'k': P.RAMPS['w_wood'][1], 'l': lite, 'b': base, 'd': dark}
    a = np.zeros((16, 16, 4), np.uint8)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in cols:
                a[y, x] = (*cols[ch], 255)
    if hair:                                         # a little comb on the label
        for x in (6, 8, 10):
            a[6, x] = (*white, 255)
    return Image.fromarray(a, 'RGBA')


def build_frames():
    fr = frames()
    icons = {f'icon_cos_{cid}': icon(cid) for cid in ALL}
    cc = P.COSMETIC_COLORS
    for name, hexc in cc['dye_shop'].items():
        icons[f'icon_cos_dye_{name}'] = dye_icon(hexc)
    for name, hexc in cc['hair_shop'].items():
        icons[f'icon_cos_hair_{name}'] = dye_icon(hexc, hair=True)
    return fr, icons


# --------------------------------------------------------------------------------------------------- wardrobe art

def tab_icons():
    """12 × 12 tab icons of the wardrobe: Body, Clothes, Accessories, Collection."""
    from .icons import Icon
    out = {}
    ic = Icon(12, 12)
    sk, hr = ic.part('s', 'skin'), ic.part('h', 'hair')
    ic.ell(6, 4.2, 2.6, 2.9, sk)
    ic.poly([(1.5, 11.5), (2.4, 8), (6, 7), (9.6, 8), (10.5, 11.5)], ic.part('c', 'p_cloth'))
    ic.poly([(3.2, 4), (3.4, 1.6), (6, 1), (8.6, 1.6), (8.8, 3.6), (6, 2.8)], hr)
    out['tab_body'] = ic.done()
    ic = Icon(12, 12)
    t = ic.part('t', 'p_cloth')
    ic.poly([(3.5, 1), (8.5, 1), (11.5, 4), (10, 6), (9, 5), (9, 11), (3, 11), (3, 5), (2, 6), (0.5, 4)], t)
    ic.rect(3, 6, 6, 1, ic.part('b', 'p_leather'))
    out['tab_clothes'] = ic.done()
    ic = Icon(12, 12)
    ic.ell(6, 8.2, 5.2, 1.4, ic.part('b', 'w_gold', 1))
    ic.poly([(3.2, 8), (3.6, 4), (6, 2.2), (8.4, 4), (8.8, 8)], ic.part('h', 'w_gold'))
    ic.rect(3.4, 5.4, 5.2, 1, ic.part('r', 'fx_heal'))
    out['tab_acc'] = ic.done()
    ic = Icon(12, 12)
    ic.rect(1, 2, 10, 8, ic.part('cover', 'p_leather'))
    ic.rect(2, 3, 8, 6, ic.part('pages', 'white'))
    ic.rect(5.6, 2, 0.9, 8, ic.part('spine', 'p_leather', 1))
    ic.rect(3, 4.4, 2, 1, ic.part('g', 'w_gold'))
    ic.rect(7, 4.4, 2, 1, ic.part('g', 'w_gold'))
    out['tab_collection'] = ic.done()
    return out


def build(assets, preview):
    import json
    fr, icons = build_frames()
    allowed = P.allowed(list(P.RAMPS)) | {tuple(c) for c in P.UI_COLORS.values()}
    for n, im in {**fr, **icons}.items():
        P.check_palette_lock(im, allowed, ATLAS, n)
    A.pack_atlas(ATLAS, fr, os.path.join(assets, 'atlases'))
    sheet_preview(fr, os.path.join(preview, 'cosmetics_sheet.png'))
    return []          # no anims.json entries: the manifest in look.json says how to pick each frame


def sheet_preview(fr, path, z=3):
    names = sorted(fr)
    cols = 12
    rows = (len(names) + cols - 1) // cols
    cv = Image.new('RGBA', (cols * 34 * z, rows * 34 * z), (0x78, 0xb1, 0x8b, 255))
    for i, n in enumerate(names):
        cv.alpha_composite(fr[n].resize((32 * z, 32 * z), Image.NEAREST), ((i % cols) * 34 * z, (i // cols) * 34 * z))
    cv.convert('RGB').save(path)


def manifest():
    return {cid: {'slot': slot, 'point': pt, 'frames': n, 'atlas': ATLAS, 'anchor': [AX, AY],
                  'frameRule': ('idle / run / air frame by the current anim' if n == 3 else
                                ('2-frame bob, 1 px' if n == 2 else 'single frame')),
                  'icon': f'icon_cos_{cid}'}
            for cid, (slot, pt, n, _f) in ALL.items()}
