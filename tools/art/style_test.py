"""ART13 Part 1: the same test scene drawn in four candidate art styles (docs/plans/ART13-new-style-exploration.md).

A  HD pixel art      twice the pixel density (hero ~64 px), 5-step banded shading, rim light, soft glows
B  Dark and moody    current pixel size, dark limited palette, strong point lights, fog layers, glowing eyes
C  Bright cartoon    smooth anti-aliased shapes, thick dark outlines, flat colors with one shade
D  Painted storybook soft painted shading with brush texture, warm light, gentle darker outlines

One scene description (shapes in 640 x 360 logical units) is rendered by four style renderers. Nothing here touches
the game's assets: the images go to docs/art/ and tools/out/preview/. Run: python3 tools/art/style_test.py"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 640, 360

# ------------------------------------------------------------------------------------------------- shapes


def capsule(p0, p1, w):
    return ('cap', p0, p1, w)


def ell(cx, cy, rx, ry, rot=0.0):
    return ('ell', cx, cy, rx, ry, rot)


def poly(*pts):
    return ('poly', pts)


def arc_band(cx, cy, r0, r1, a0, a1, n=24):
    """A crescent band between radii r0 and r1 from angle a0 to a1 (degrees, 0 = right, 90 = down)."""
    outer = [(cx + r1 * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
              cy + r1 * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
    inner = [(cx + r0 * math.cos(math.radians(a1 - (a1 - a0) * i / n)),
              cy + r0 * math.sin(math.radians(a1 - (a1 - a0) * i / n))) for i in range(n + 1)]
    return ('poly', tuple(outer + inner))


def _ell_pts(cx, cy, rx, ry, rot, n=28):
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    return [(cx + rx * math.cos(2 * math.pi * k / n) * c - ry * math.sin(2 * math.pi * k / n) * s,
             cy + rx * math.cos(2 * math.pi * k / n) * s + ry * math.sin(2 * math.pi * k / n) * c) for k in range(n)]


def draw_shape(d, shape, tf):
    """Draw one shape filled with 255 on an 'L' ImageDraw; tf maps logical -> working pixels."""
    kind = shape[0]
    if kind == 'poly':
        d.polygon([tf(p) for p in shape[1]], fill=255)
    elif kind == 'ell':
        _, cx, cy, rx, ry, rot = shape
        d.polygon([tf(p) for p in _ell_pts(cx, cy, rx, ry, rot)], fill=255)
    elif kind == 'cap':
        _, p0, p1, w = shape
        r = w / 2
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        n = math.hypot(dx, dy) or 1
        px, py = -dy / n * r, dx / n * r
        d.polygon([tf((p0[0] + px, p0[1] + py)), tf((p1[0] + px, p1[1] + py)), tf((p1[0] - px, p1[1] - py)),
                   tf((p0[0] - px, p0[1] - py))], fill=255)
        for (x, y) in (p0, p1):
            d.polygon([tf(p) for p in _ell_pts(x, y, r, r, 0, 16)], fill=255)


def shape_bbox(shape):
    kind = shape[0]
    if kind == 'poly':
        xs, ys = [p[0] for p in shape[1]], [p[1] for p in shape[1]]
        return min(xs), min(ys), max(xs), max(ys)
    if kind == 'ell':
        _, cx, cy, rx, ry, _r = shape
        m = max(rx, ry)
        return cx - m, cy - m, cx + m, cy + m
    _, p0, p1, w = shape
    return min(p0[0], p1[0]) - w, min(p0[1], p1[1]) - w, max(p0[0], p1[0]) + w, max(p0[1], p1[1]) + w


# ------------------------------------------------------------------------------------------------- the scene
# Every object: a list of (role, shape) drawn back to front, in logical coordinates relative to its origin.

def hero():
    """Human hero in the leather set, mid-jump, swinging the Greatsword forward-down. Origin: feet."""
    P = []
    hipB, kneeB, footB = (-1, -12), (-5.5, -7.5), (-3.5, -2.5)
    hipF, kneeF, footF = (1, -12), (6.5, -12), (6, -5.5)
    P += [('cloth_dk', capsule(hipB, kneeB, 4.2)), ('cloth_dk', capsule(kneeB, footB, 3.6)),
          ('boot', poly((-6, -3.6), (-1.6, -3.6), (-1.2, -0.6), (-6.4, -0.8)))]
    P += [('scarf', poly((-1, -21), (-8, -24), (-13, -22), (-9, -20.5), (-2, -19)))]
    P += [('arm_back', capsule((-0.5, -20), (4.5, -16.5), 3.2)), ('skin_dk', capsule((4.5, -16.5), (10, -15.5), 3)),
          ('skin_dk', ell(10.4, -15.3, 1.8, 1.8))]
    P += [('leather', poly((-4.6, -21.6), (4.4, -21.2), (4.6, -11.2), (-4.2, -11)))]
    P += [('belt', poly((-4.4, -12.6), (4.6, -12.8), (4.6, -11.2), (-4.3, -11)))]
    P += [('buckle', ell(1.6, -11.9, 1.0, 0.9))]
    P += [('cloth', capsule(hipF, kneeF, 4.4)), ('cloth', capsule(kneeF, footF, 3.8)),
          ('boot', poly((4.0, -6.6), (8.6, -6.4), (8.8, -3.4), (3.6, -3.6)))]
    P += [('skin', ell(2.2, -26, 4.2, 4.6))]
    P += [('hair', poly((-2.6, -23.6), (-3.8, -30), (-1.2, -28.8), (-0.4, -32.4), (1.8, -29.4), (4.4, -31.4),
                        (5.4, -28.4), (6.6, -27.2), (3.4, -27.4), (1, -26.2), (0.4, -23)))]
    P += [('eye', ell(4.8, -25.6, 0.55, 0.9))]
    P += [('scarf', poly((-3.6, -21.8), (3.8, -21.6), (4, -19.8), (-3.4, -19.6)))]
    P += [('arm', capsule((1.6, -20), (7, -17.5), 3.4)), ('skin', capsule((7, -17.5), (11, -15.5), 3)),
          ('skin', ell(11.4, -15.2, 1.9, 1.9))]
    return P


def greatsword():
    """The blade from the hands (11, -15) swung forward and down. Origin: hero feet."""
    hx, hy = 11.2, -15.2
    ang = math.radians(22)
    ux, uy = math.cos(ang), math.sin(ang)
    px, py = -uy, ux
    L = 21

    def at(s, n):
        return (hx + ux * s + px * n, hy + uy * s + py * n)
    P = [('grip', capsule(at(-4, 0), at(1, 0), 1.6)), ('gold', ell(*at(-4.6, 0), 1.3, 1.3)),
         ('gold', poly(at(1, -3.4), at(2.4, -3.4), at(2.4, 3.4), at(1, 3.4)))]
    P += [('steel', poly(at(2.4, -1.7), at(L - 3, -1.5), at(L, 0), at(L - 3, 1.5), at(2.4, 1.7)))]
    P += [('steel_lt', poly(at(3, -0.3), at(L - 3.4, -0.25), at(L - 3.4, 0.3), at(3, 0.35)))]
    return P


def smear():
    """The swing smear: a crescent from over the head down to the front."""
    return [('smear', arc_band(9.5, -15, 19.5, 25, -120, 26, 30))]


def wolf():
    """A Wolf leaping left at the hero. Origin: under the body."""
    P = [('fur_dk', poly((10, -12), (19, -17), (21, -15), (11, -9.5))),                    # tail
         ('fur_dk', capsule((7, -9), (12, -4), 3)), ('fur_dk', capsule((12, -4), (16, -1), 2.6)),   # hind leg back
         ('fur_dk', capsule((-6, -11), (-13, -7), 3)), ('fur_dk', capsule((-13, -7), (-16, -6), 2.4))]  # front leg back
    P += [('fur', ell(0, -11, 11, 5.6, -12)), ('belly', ell(0, -8.6, 8, 2.4, -12))]
    P += [('fur', capsule((5, -10), (10, -5), 3.6)), ('fur', capsule((10, -5), (15, -3), 2.8))]          # hind leg
    P += [('fur', capsule((-7, -12), (-14, -10), 3.4)), ('fur', capsule((-14, -10), (-18, -10), 2.6))]   # front leg
    P += [('fur', ell(-11, -16.5, 5.2, 4.4, -8)),
          ('fur', poly((-14, -18.4), (-21.5, -17.2), (-22, -15.2), (-14.5, -13.6))),                    # snout
          ('fur_dk', poly((-9, -20), (-8, -25), (-5.4, -19.6))), ('fur_dk', poly((-12.5, -20), (-12.8, -24.4), (-10, -20.4))),
          ('nose', ell(-21.6, -16.6, 1.0, 0.9)), ('teeth', poly((-20.5, -15), (-15.5, -14.4), (-15.4, -13.6), (-20, -14.4))),
          ('eye_glow', ell(-13.2, -17.6, 1.0, 0.75))]
    return P


def archer():
    """A Bandit Archer on the ledge, aiming left. Origin: feet."""
    P = [('a_leather', capsule((1.2, -11), (2.6, -1.5), 3.6)), ('a_boot', poly((0.6, -3), (5, -3), (5, -0.4), (0.4, -0.4))),
         ('a_cloak', poly((1.4, -21), (6.4, -18), (7.6, -6), (2.4, -8)))]
    P += [('a_tunic', poly((-3.4, -21), (3.4, -21), (3.8, -9.6), (-3.6, -9.4))),
          ('a_leather', capsule((-1.6, -11), (-3.4, -1.5), 3.8)), ('a_boot', poly((-6, -3), (-1.6, -3), (-1.6, -0.4), (-6.4, -0.4))),
          ('a_belt', poly((-3.6, -12.6), (3.8, -12.6), (3.8, -11.2), (-3.6, -11.2)))]
    P += [('a_skin', ell(-0.4, -25.4, 3.8, 4.2)), ('a_hood', poly((-3, -30), (3.6, -29.6), (4.8, -24), (4.2, -20.6),
                                                              (1.6, -22.2), (1.4, -26.6), (-2.4, -27.4)))]
    P += [('a_mask', poly((-4.4, -24.8), (-0.6, -24.6), (-0.4, -22), (-3.8, -21.6))), ('eye', ell(-2.8, -26.2, 0.5, 0.8))]
    P += [('bow', arc_band(-10, -18, 8.2, 9.6, 125, 235, 16)), ('string', capsule((-14.8, -25.6), (-3.2, -18), 0.5)),
          ('string', capsule((-3.2, -18), (-14.8, -10.4), 0.5)),
          ('arrow', capsule((-17, -18), (-2.6, -18), 0.8)), ('steel', poly((-19.4, -18), (-16.8, -19.3), (-16.8, -16.7)))]
    P += [('a_tunic', capsule((0, -20), (-6, -18.4), 3.2)), ('a_skin', ell(-9.6, -18, 1.6, 1.6)),
          ('a_tunic', capsule((1, -20), (-2.6, -18.2), 3.0)), ('a_skin', ell(-2.8, -18, 1.5, 1.5))]
    return P


def lucky_block():
    """The Lucky Block (a gold "?" block), 16 x 16. Origin: top-left."""
    q = [(5.5, 4.6), (6.6, 3.4), (9.4, 3.4), (10.6, 4.6), (10.6, 7), (8.8, 8.4), (8.8, 9.8), (7.2, 9.8), (7.2, 7.8),
         (9, 6.4), (9, 5), (7, 5), (6.8, 6), (5.4, 6)]
    return [('block', poly((0, 0), (16, 0), (16, 16), (0, 16))), ('block_rim', poly((1, 1), (15, 1), (15, 2), (1, 2))),
            ('mark', poly(*q)), ('mark', poly((7.2, 11), (8.8, 11), (8.8, 12.6), (7.2, 12.6)))]


def key_chest():
    """A key chest, 22 x 16. Origin: bottom-left."""
    return [('wood', poly((0, -11), (22, -11), (22, 0), (0, 0))), ('wood_dk', poly((0, -16), (22, -16), (22, -11), (0, -11))),
            ('wood_lid', ell(11, -14.5, 11, 3.2)), ('gold', poly((0, -11.8), (22, -11.8), (22, -10), (0, -10))),
            ('gold', poly((2, -16.6), (4, -16.6), (4, 0), (2, 0))), ('gold', poly((18, -16.6), (20, -16.6), (20, 0), (18, 0))),
            ('lock', poly((9, -12.6), (13, -12.6), (13, -7.4), (9, -7.4))), ('keyhole', ell(11, -10.4, 0.7, 0.9))]


def terrain():
    """Ground, slope, the raised ledge, the one-way platform. Absolute coordinates."""
    gy, hy = 300, 262
    P = [('dirt', poly((-10, gy), (360, gy), (452, hy), (650, hy), (650, 370), (-10, 370)))]
    P += [('rock', poly((508, 196), (640, 196), (650, 270), (520, 266), (512, 230)))]           # archer's ledge rock
    P += [('stone', ell(70, 330, 12, 6)), ('stone', ell(250, 342, 16, 7)), ('stone', ell(560, 300, 14, 6)),
          ('stone', ell(420, 322, 10, 5)), ('stone', ell(600, 228, 8, 5))]
    P += [('grass', poly((-10, gy - 4), (360, gy - 4), (452, hy - 4), (650, hy - 4), (650, hy + 5), (452, hy + 5),
                         (360, gy + 5), (-10, gy + 5))),
          ('grass', poly((506, 192), (642, 192), (642, 199), (508, 200)))]
    for x in range(-6, 640, 9):                                                            # grass tufts
        base = gy - 4 if x < 360 else (hy - 4 if x > 452 else gy - 4 - (x - 360) * (gy - hy) / 92)
        P.append(('grass_lt', poly((x, base + 1), (x + 2.5, base - 4 - (x * 7 % 3)), (x + 5, base + 1))))
    for x in range(510, 640, 10):
        P.append(('grass_lt', poly((x, 193), (x + 2.5, 188 - (x * 5 % 3)), (x + 5, 193))))
    # the one-way platform: a plank on two posts
    P += [('wood_dk', capsule((152, 236), (152, 296), 4)), ('wood_dk', capsule((238, 236), (238, 296), 4)),
          ('plank', poly((140, 228), (250, 228), (250, 236), (140, 236))),
          ('plank_lt', poly((140, 228), (250, 228), (250, 230), (140, 230)))]
    return P


SCENE = {
    'terrain': (terrain(), (0, 0)),
    'chest': (key_chest(), (34, 300)),
    'block': (lucky_block(), (88, 186)),
    'archer': (archer(), (585, 192)),
    'smear': (smear(), (196, 206)),
    'hero': (hero(), (196, 206)),
    'sword': (greatsword(), (196, 206)),
    'wolf': (wolf(), (262, 226)),
}
ORDER = ['terrain', 'chest', 'block', 'archer', 'smear', 'hero', 'sword', 'wolf']
SPARK = (243, 197)           # where the sword meets the wolf
TORCH = (146, 226)           # style B's torch on the platform post


# ------------------------------------------------------------------------------------------------- style palettes

BASE = {
    'skin': (236, 182, 140), 'skin_dk': (206, 150, 112), 'hair': (112, 70, 42), 'eye': (24, 20, 30),
    'cloth': (70, 96, 160), 'cloth_dk': (52, 72, 126), 'arm': (70, 96, 160), 'arm_back': (52, 72, 126),
    'leather': (128, 82, 50), 'belt': (66, 42, 30), 'buckle': (232, 196, 90), 'boot': (82, 52, 36),
    'scarf': (66, 206, 240), 'grip': (90, 56, 36), 'gold': (232, 186, 70), 'steel': (176, 188, 206),
    'steel_lt': (236, 242, 250), 'smear': (255, 255, 255),
    'fur': (120, 128, 156), 'fur_dk': (86, 92, 118), 'belly': (190, 194, 206), 'nose': (30, 26, 36),
    'teeth': (240, 236, 222), 'eye_glow': (255, 214, 70),
    'a_leather': (96, 64, 44), 'a_boot': (60, 40, 30), 'a_cloak': (122, 40, 44), 'a_tunic': (170, 64, 56),
    'a_belt': (60, 40, 30), 'a_skin': (220, 168, 128), 'a_hood': (122, 40, 44), 'a_mask': (60, 50, 56),
    'bow': (150, 98, 54), 'string': (230, 224, 200), 'arrow': (170, 120, 70),
    'block': (240, 188, 52), 'block_rim': (255, 236, 150), 'mark': (255, 250, 230),
    'wood': (140, 92, 52), 'wood_dk': (100, 64, 38), 'wood_lid': (156, 104, 60), 'lock': (232, 186, 70),
    'keyhole': (30, 24, 30),
    'dirt': (128, 86, 56), 'rock': (118, 108, 104), 'stone': (150, 130, 112), 'grass': (92, 168, 70),
    'grass_lt': (128, 200, 86), 'plank': (164, 112, 64), 'plank_lt': (204, 152, 96),
}


def _mul(c, k):
    return tuple(max(0, min(255, int(round(v * k)))) for v in c)


def _mix(a, b, t):
    return tuple(int(round(x + (y - x) * t)) for x, y in zip(a, b))


def palette(style):
    p = dict(BASE)
    if style == 'B':
        cool = (40, 46, 78)
        for k, c in list(p.items()):
            p[k] = _mix(_mul(c, 0.62), cool, 0.35)
        p.update({'eye_glow': (255, 60, 40), 'scarf': (70, 170, 200), 'smear': (220, 228, 255),
                  'steel_lt': (210, 220, 240), 'block': (200, 150, 50), 'block_rim': (250, 210, 110), 'mark': (255, 236, 190)})
    elif style == 'C':
        p.update({'skin': (255, 196, 150), 'skin_dk': (240, 170, 126), 'hair': (150, 86, 40), 'cloth': (60, 120, 230),
                  'cloth_dk': (44, 96, 196), 'arm': (60, 120, 230), 'arm_back': (44, 96, 196), 'leather': (186, 112, 56),
                  'scarf': (40, 220, 255), 'fur': (130, 150, 210), 'fur_dk': (96, 112, 170), 'belly': (226, 232, 250),
                  'a_tunic': (230, 70, 70), 'a_cloak': (170, 40, 60), 'a_hood': (170, 40, 60), 'grass': (90, 200, 70),
                  'grass_lt': (150, 230, 90), 'dirt': (176, 112, 64), 'rock': (150, 140, 150), 'block': (255, 206, 40),
                  'wood': (190, 120, 60), 'plank': (210, 140, 70), 'eye_glow': (255, 230, 60)})
    elif style == 'D':
        warm = (255, 214, 160)
        for k, c in list(p.items()):
            p[k] = _mix(c, warm, 0.10)
        p.update({'cloth': (78, 98, 150), 'cloth_dk': (60, 76, 120), 'arm': (78, 98, 150), 'arm_back': (60, 76, 120),
                  'grass': (110, 160, 80), 'grass_lt': (150, 190, 100), 'dirt': (140, 98, 66)})
    return p


# ------------------------------------------------------------------------------------------------- rendering helpers

def blur(a, s):
    if s <= 0:
        return a
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(s))
    return np.asarray(im).astype(np.float32) / 255


def dilate(m, r):
    if r <= 0:
        return m
    k = int(r) * 2 + 1
    im = Image.fromarray((m * 255).astype(np.uint8), 'L').filter(ImageFilter.MaxFilter(k))
    return np.asarray(im) > 127


def light_field(mask, sigma, ldir=(-0.62, -0.78)):
    """0..1 lightness from a part's shape: edges facing the light (top-left) are bright, the far side dark."""
    b = blur(mask.astype(np.float32), sigma)
    gy, gx = np.gradient(b)
    k = sigma * 2.6
    nx, ny = -gx * k, -gy * k                       # outward normal, about unit length near the edge
    ln = np.sqrt(nx * nx + ny * ny)
    s = np.maximum(ln, 1.0)
    nx, ny = nx / s, ny / s
    t = 0.56 + 0.55 * (nx * ldir[0] + ny * ldir[1]) - 0.12 * (1 - b)
    return np.clip(t, 0, 1), nx, ny


class Canvas:
    """Working canvas: logical units * U pixels, optionally limited to a logical region (for close-ups)."""

    def __init__(self, U, region=(0, 0, W, H)):
        self.U = U
        self.rx, self.ry, rw, rh = region[0], region[1], region[2] - region[0], region[3] - region[1]
        self.w, self.h = int(round(rw * U)), int(round(rh * U))
        self.img = np.zeros((self.h, self.w, 3), np.float32)

    def tf(self, ox, oy):
        return lambda p: ((p[0] + ox - self.rx) * self.U, (p[1] + oy - self.ry) * self.U)

    def masks(self, parts, origin):
        """Draw an object's parts: returns (ids array, role list) over the whole canvas; -1 = empty."""
        ids = np.full((self.h, self.w), -1, np.int16)
        roles = []
        tf = self.tf(*origin)
        for role, shape in parts:
            im = Image.new('L', (self.w, self.h), 0)
            draw_shape(ImageDraw.Draw(im), shape, tf)
            m = np.asarray(im) > 127
            if role not in roles:
                roles.append(role)
            ids[m] = roles.index(role)
        return ids, roles


def paste(dst, rgb, alpha):
    a = alpha[..., None]
    dst[:] = dst * (1 - a) + rgb * a


def gradient_v(h, w, top, bottom):
    t = np.linspace(0, 1, h)[:, None, None]
    return np.broadcast_to(np.array(top, np.float32) * (1 - t) + np.array(bottom, np.float32) * t, (h, w, 3)).copy()


def noise(h, w, seed, scale):
    rng = np.random.default_rng(seed)
    n = rng.random((max(2, h // scale + 2), max(2, w // scale + 2))).astype(np.float32)
    im = Image.fromarray((n * 255).astype(np.uint8), 'L').resize((w, h), Image.BICUBIC)
    return np.asarray(im).astype(np.float32) / 255


def hill_mask(cv, base, amp, freq, phase, seed=0):
    xs = (np.arange(cv.w) / cv.U + cv.rx)
    top = base - amp * (0.55 * np.sin(xs * freq + phase) + 0.3 * np.sin(xs * freq * 2.3 + phase * 1.7)
                        + 0.15 * np.sin(xs * freq * 5.1 + seed))
    ys = (np.arange(cv.h)[:, None] / cv.U + cv.ry)
    return ys >= top[None, :]


# ------------------------------------------------------------------------------------------------- object shading

def shade_object(style, cv, parts, origin, pal, extra=None):
    """Return (rgb, alpha) for one object in the given style."""
    ids, roles = cv.masks(parts, origin)
    occ = ids >= 0
    rgb = np.zeros((cv.h, cv.w, 3), np.float32)
    U = cv.U
    union = occ
    for i, role in enumerate(roles):
        m = ids == i
        if not m.any():
            continue
        c = np.array(pal[role], np.float32)
        if role in ('smear',):
            rgb[m] = c
            continue
        if style == 'A':
            t, nx, ny = light_field(m, 1.4 * U)
            steps = np.array([0.50, 0.68, 0.84, 1.0, 1.14])
            q = np.clip((t * 5).astype(int), 0, 4)
            shade = steps[q][..., None]
            cool = np.array([60, 70, 120], np.float32)
            col = c * shade + (cool - c * shade) * ((q == 0)[..., None] * 0.18)
            col = np.where((q == 4)[..., None], col * 0.9 + np.array([255, 240, 200], np.float32) * 0.1, col)
            # rim light from the sky on the back-right edge
            edge = m & ~dilate(~m, 0) if False else m & dilate(~m, max(1, int(U * 0.9)))
            rim = edge & (nx > 0.45)
            col = np.where(rim[..., None], col * 0.45 + np.array([170, 220, 255], np.float32) * 0.55, col)
            rgb[m] = col[m]
        elif style == 'B':
            t, nx, ny = light_field(m, 1.0 * U)
            steps = np.array([0.5, 0.8, 1.15])
            q = np.clip((t * 3).astype(int), 0, 2)
            col = c * steps[q][..., None]
            # two rim lights: cold moonlight on the back, warm torchlight on the front
            edge = m & dilate(~m, 1)
            col = np.where((edge & (nx > 0.35))[..., None], col * 0.3 + np.array([150, 170, 235], np.float32) * 0.7, col)
            col = np.where((edge & (nx < -0.35) & (ny < 0.3))[..., None], col * 0.4 + np.array([255, 170, 90], np.float32) * 0.6, col)
            rgb[m] = col[m]
        elif style == 'C':
            t, nx, ny = light_field(m, 1.3 * U, (-0.5, -0.86))
            sh = (t < 0.42)[..., None]
            col = np.where(sh, c * 0.74 + np.array([20, 10, 60], np.float32) * 0.08, c)
            if role in ('steel', 'steel_lt', 'gold', 'block', 'eye', 'nose', 'keyhole'):
                hi = (t > 0.88)[..., None]
                col = np.where(hi, c * 0.4 + 255 * 0.6, col)
            rgb[m] = col[m]
        elif style == 'D':
            t, nx, ny = light_field(m, 1.8 * U)
            warm = np.array([255, 222, 170], np.float32)
            cool = np.array([70, 70, 120], np.float32)
            col = c[None, None] * (0.66 + 0.48 * t[..., None])
            col = col + (warm - col) * (0.22 * t[..., None] ** 2) + (cool - col) * (0.2 * (1 - t[..., None]) ** 2)
            rgb[m] = col[m]
    alpha = occ.astype(np.float32)
    if style == 'A':
        # selective outline: a darker version of the part color, 1 HD pixel
        ring = dilate(occ, 1) & ~occ
        near = _nearest_color(rgb, occ, 1)
        rgb = np.where(ring[..., None], near * 0.32 + np.array([10, 8, 20], np.float32) * 0.68, rgb)
        alpha = np.maximum(alpha, ring)
    elif style == 'B':
        ring = dilate(occ, 1) & ~occ
        rgb = np.where(ring[..., None], np.array([8, 7, 14], np.float32), rgb)
        alpha = np.maximum(alpha, ring)
    elif style == 'C':
        # inner lines between parts, then a thick outline around the whole object
        pad = np.pad(ids, 1, constant_values=-1)
        inner = occ & ((pad[:-2, 1:-1] != ids) | (pad[1:-1, :-2] != ids)) & (pad[:-2, 1:-1] >= 0) & (pad[1:-1, :-2] >= 0)
        inner = dilate(inner, max(0, int(U * 0.18)))
        ink = np.array([34, 22, 46], np.float32)
        rgb = np.where(inner[..., None] & occ[..., None], ink, rgb)
        ring = dilate(occ, max(1, int(round(U * 0.55)))) & ~occ
        rgb = np.where(ring[..., None], ink, rgb)
        alpha = np.maximum(alpha, ring)
    elif style == 'D':
        tex = noise(cv.h, cv.w, 7, max(2, int(U * 1.2)))
        streak = np.asarray(Image.fromarray((tex * 255).astype(np.uint8), 'L').filter(
            ImageFilter.BoxBlur(max(1, int(U * 0.6))))).astype(np.float32) / 255
        rgb = rgb * (0.9 + 0.2 * streak[..., None])
        ring = dilate(occ, max(1, int(round(U * 0.35)))) & ~occ
        near = _nearest_color(rgb, occ, max(1, int(round(U * 0.35))))
        rgb = np.where(ring[..., None], near * 0.38 + np.array([40, 26, 30], np.float32) * 0.4, rgb)
        a2 = np.maximum(alpha, ring * 0.85)
        alpha = blur(a2, U * 0.12) * 0.6 + a2 * 0.4
    if extra:
        rgb, alpha = extra(rgb, alpha, ids, roles)
    return rgb, alpha


def _nearest_color(rgb, occ, r):
    """Spread the object's colors outward by r pixels (so an outline can be a darker version of what it touches)."""
    out = rgb.copy()
    m = occ.copy()
    for _ in range(max(1, r)):
        acc = np.zeros_like(out)
        cnt = np.zeros(m.shape, np.float32)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            sm = np.roll(m, (dy, dx), (0, 1))
            sc = np.roll(out, (dy, dx), (0, 1))
            acc += sc * sm[..., None]
            cnt += sm
        grow = (~m) & (cnt > 0)
        out[grow] = acc[grow] / cnt[grow][..., None]
        m = m | grow
    return out


# ------------------------------------------------------------------------------------------------- backgrounds

def background(style, cv):
    h, w, U = cv.h, cv.w, cv.U
    ys = (np.arange(h) / U + cv.ry)[:, None]
    if style == 'A':
        sky = gradient_v(h, w, (86, 150, 232), (196, 228, 246))
        bands = np.floor(((ys - cv.ry) / (H / 14))) / 14 if False else None
        cv.img[:] = _band(sky, 10)
        _sun(cv, (520, 70), 26, (255, 246, 210), 0.9)
        _clouds(cv, style)
        for (base, amp, f, ph, col) in ((215, 40, 0.012, 0.3, (130, 170, 210)), (245, 34, 0.02, 1.7, (96, 150, 120)),
                                        (272, 22, 0.035, 4.0, (74, 130, 84))):
            m = hill_mask(cv, base, amp, f, ph)
            t = np.clip((ys - (base - amp)) / (2 * amp + 40), 0, 1)
            colimg = np.array(col, np.float32)[None, None] * (1.06 - 0.25 * t[..., None])
            paste(cv.img, _band(np.broadcast_to(colimg, (h, w, 3)).copy(), 6), m.astype(np.float32))
    elif style == 'B':
        cv.img[:] = gradient_v(h, w, (12, 12, 30), (44, 34, 62))
        _sun(cv, (520, 64), 14, (210, 214, 230), 1.0, glow=(80, 90, 140))       # the moon
        rng = np.random.default_rng(3)
        for _ in range(60):
            x, y = rng.integers(0, w), rng.integers(0, int(h * 0.45))
            cv.img[y, x] = (180, 180, 210)
        for (base, amp, f, ph, col, fog) in ((210, 40, 0.012, 0.3, (30, 30, 56), 0.0), (244, 34, 0.02, 1.7, (24, 26, 44), 0.25),
                                             (274, 22, 0.035, 4.0, (18, 20, 34), 0.4)):
            m = hill_mask(cv, base, amp, f, ph)
            paste(cv.img, np.broadcast_to(np.array(col, np.float32), (h, w, 3)).copy(), m.astype(np.float32))
            fogband = np.clip(1 - np.abs(ys - (base + 6)) / 26, 0, 1) * 0.35
            paste(cv.img, np.broadcast_to(np.array((70, 64, 100), np.float32), (h, w, 3)).copy(),
                  np.broadcast_to(fogband, (h, w)).astype(np.float32))
        # dead trees silhouettes
        for x0 in (40, 330, 470):
            _tree(cv, x0, 262 if x0 > 400 else 298, (10, 10, 18))
    elif style == 'C':
        cv.img[:] = gradient_v(h, w, (70, 170, 255), (150, 220, 255))
        _sun(cv, (520, 66), 26, (255, 236, 110), 0.0)
        _clouds(cv, style)
        for (base, amp, f, ph, col) in ((222, 36, 0.012, 0.3, (120, 200, 120)), (252, 30, 0.02, 1.7, (80, 180, 90))):
            m = hill_mask(cv, base, amp, f, ph)
            paste(cv.img, np.broadcast_to(np.array(col, np.float32), (h, w, 3)).copy(), m.astype(np.float32))
            edge = dilate(m, max(1, int(U * 0.4))) & ~m
            paste(cv.img, np.broadcast_to(np.array((40, 90, 60), np.float32), (h, w, 3)).copy(), edge.astype(np.float32))
        for x0, y0 in ((60, 285), (300, 287), (480, 249), (600, 251)):
            _bush(cv, x0, y0)
    elif style == 'D':
        sky = gradient_v(h, w, (122, 160, 210), (250, 214, 168))
        n = _strokes(h, w, 11, U)
        cv.img[:] = sky * (0.97 + 0.045 * n[..., None])
        _sun(cv, (520, 76), 30, (255, 236, 190), 0.0, glow=(255, 210, 150))
        _clouds(cv, style)
        for i, (base, amp, f, ph, col) in enumerate(((208, 44, 0.011, 0.3, (150, 160, 190)), (240, 36, 0.019, 1.7, (122, 150, 140)),
                                                     (270, 24, 0.033, 4.0, (96, 136, 96)))):
            m = hill_mask(cv, base, amp, f, ph).astype(np.float32)
            m = blur(m, U * (1.2 - i * 0.35))
            tex = _strokes(h, w, 20 + i, U)
            t = np.clip((ys - (base - amp)) / (2 * amp + 30), 0, 1)
            colimg = np.array(col, np.float32)[None, None] * (1.04 - 0.22 * t[..., None]) * (0.95 + 0.09 * tex[..., None])
            paste(cv.img, colimg, m)
        for x0, y0 in ((52, 298), (476, 260), (612, 262)):
            _painted_tree(cv, x0, y0)


def _strokes(h, w, seed, U):
    """Brush-stroke texture: fine noise smeared sideways into short strokes."""
    n = noise(h, w, seed, max(1, int(U * 1.5)))
    im = Image.fromarray((n * 255).astype(np.uint8), 'L').filter(ImageFilter.BoxBlur(max(1, int(U * 2))))
    a = np.asarray(im).astype(np.float32) / 255
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8), 'L').resize((w // 4 or 1, h), Image.BILINEAR)
                   .resize((w, h), Image.BICUBIC)).astype(np.float32) / 255
    return (a - a.mean()) / (a.std() + 1e-6) * 0.5


def _band(img, n):
    """Posterize a smooth gradient into flat bands (pixel-art skies)."""
    return np.floor(img / 256 * n * 3) / (n * 3) * 256 + 256 / (n * 6)


def _sun(cv, c, r, col, ray, glow=None):
    U = cv.U
    ys, xs = np.mgrid[0:cv.h, 0:cv.w]
    d = np.hypot(xs / U + cv.rx - c[0], ys / U + cv.ry - c[1])
    if glow is not None:
        g = np.clip(1 - d / (r * 4), 0, 1) ** 2 * 0.6
        paste(cv.img, np.broadcast_to(np.array(glow, np.float32), cv.img.shape).copy(), g)
    paste(cv.img, np.broadcast_to(np.array(col, np.float32), cv.img.shape).copy(), (d <= r).astype(np.float32))
    if ray:
        g = np.clip(1 - d / (r * 3), 0, 1) ** 2 * 0.35 * ray
        paste(cv.img, np.broadcast_to(np.array(col, np.float32), cv.img.shape).copy(), g)


def _clouds(cv, style):
    U = cv.U
    for (cx, cy, s) in ((110, 60, 1.0), (300, 40, 0.8), (430, 96, 0.7)):
        parts = [('c', ell(cx + dx * s, cy + dy * s, rx * s, ry * s)) for dx, dy, rx, ry in
                 ((-16, 4, 14, 8), (0, -2, 16, 12), (16, 4, 13, 8), (0, 6, 26, 6))]
        ids, _r = cv.masks(parts, (0, 0))
        m = ids >= 0
        if style == 'A':
            t, nx, ny = light_field(m, 1.6 * U)
            col = np.where((t > 0.55)[..., None], np.array([255, 255, 255], np.float32), np.array([214, 228, 246], np.float32))
            paste(cv.img, col, m.astype(np.float32))
        elif style == 'C':
            ring = dilate(m, max(1, int(U * 0.4))) & ~m
            paste(cv.img, np.broadcast_to(np.array((60, 110, 170), np.float32), cv.img.shape).copy(), ring.astype(np.float32))
            t, nx, ny = light_field(m, 1.6 * U)
            col = np.where((t < 0.4)[..., None], np.array([210, 232, 255], np.float32), np.array([255, 255, 255], np.float32))
            paste(cv.img, col, m.astype(np.float32))
        elif style == 'D':
            a = blur(m.astype(np.float32), U * 2.2)
            paste(cv.img, np.broadcast_to(np.array((255, 244, 228), np.float32), cv.img.shape).copy(), a * 0.85)


def _tree(cv, x0, y0, col):
    parts = [('t', capsule((x0, y0), (x0 + 2, y0 - 44), 4)), ('t', capsule((x0 + 1, y0 - 26), (x0 - 12, y0 - 40), 2)),
             ('t', capsule((x0 + 2, y0 - 34), (x0 + 14, y0 - 46), 2)), ('t', capsule((x0 - 12, y0 - 40), (x0 - 16, y0 - 50), 1.4))]
    ids, _r = cv.masks(parts, (0, 0))
    paste(cv.img, np.broadcast_to(np.array(col, np.float32), cv.img.shape).copy(), (ids >= 0).astype(np.float32))


def _bush(cv, x0, y0):
    parts = [('b', ell(x0 + dx, y0 + dy, r, r)) for dx, dy, r in ((-8, -4, 7), (0, -8, 9), (9, -4, 7))]
    rgb, a = shade_object('C', cv, [('grass', s) for _r, s in parts], (0, 0), palette('C'))
    paste(cv.img, rgb, a)


def _painted_tree(cv, x0, y0):
    pal = {'trunk': (98, 70, 52), 'leaf': (88, 128, 78), 'leaf2': (116, 152, 86)}
    parts = [('trunk', capsule((x0, y0), (x0 + 1, y0 - 40), 5)),
             ('leaf', ell(x0 - 6, y0 - 44, 15, 12)), ('leaf', ell(x0 + 9, y0 - 48, 14, 12)), ('leaf2', ell(x0 + 1, y0 - 58, 13, 11))]
    rgb, a = shade_object('D', cv, parts, (0, 0), pal)
    paste(cv.img, rgb, a)


# ------------------------------------------------------------------------------------------------- effects, HUD

def glow(cv, c, r, col, strength):
    ys, xs = np.mgrid[0:cv.h, 0:cv.w]
    d = np.hypot(xs / cv.U + cv.rx - c[0], ys / cv.U + cv.ry - c[1])
    g = np.clip(1 - d / r, 0, 1) ** 2 * strength
    cv.img[:] = cv.img + np.array(col, np.float32)[None, None] * g[..., None]


def spark(style, cv):
    x, y = SPARK
    rays = []
    for k in range(8):
        a = math.radians(k * 45 + 10)
        ln = 9 if k % 2 == 0 else 5
        rays.append(('spark', poly((x + math.cos(a) * ln, y + math.sin(a) * ln),
                                   (x + math.cos(a + 0.35) * 1.6, y + math.sin(a + 0.35) * 1.6),
                                   (x + math.cos(a - 0.35) * 1.6, y + math.sin(a - 0.35) * 1.6))))
    rays.append(('core', ell(x, y, 2.6, 2.6)))
    pal = {'spark': (255, 226, 120), 'core': (255, 255, 240)}
    if style == 'B':
        pal['spark'] = (255, 200, 120)
    ids, roles = cv.masks(rays, (0, 0))
    m = ids >= 0
    col = np.zeros(cv.img.shape, np.float32)
    for i, r in enumerate(roles):
        col[ids == i] = pal[r]
    if style in ('A', 'B', 'D'):
        glow(cv, SPARK, 22, (255, 200, 110), 0.55)
    if style == 'C':
        ring = dilate(m, max(1, int(cv.U * 0.45))) & ~m
        paste(cv.img, np.broadcast_to(np.array((34, 22, 46), np.float32), cv.img.shape).copy(), ring.astype(np.float32))
    a = m.astype(np.float32)
    if style == 'D':
        a = blur(a, cv.U * 0.3) * 0.5 + a * 0.5
    paste(cv.img, col, a)


def telegraph(rgb, alpha, ids, roles, style):
    """The Wolf's attack telegraph: an orange flash over the whole body plus an orange halo (it must stay visible)."""
    orange = np.array([255, 140, 40], np.float32)
    body = alpha > 0.5
    rgb = np.where(body[..., None], rgb * 0.6 + orange * 0.4, rgb)
    return rgb, alpha


def hud(style, cv):
    """Health bar + heart and the flask at the top left; weapon and two ability boxes at the top right."""
    U = cv.U
    look = {'A': ((24, 20, 36), (232, 64, 74), (255, 214, 90), 2.0), 'B': ((22, 20, 34), (220, 40, 50), (230, 170, 80), 1.0),
            'C': ((40, 30, 70), (250, 70, 90), (255, 220, 60), 4.0), 'D': ((70, 52, 46), (196, 70, 66), (226, 184, 110), 3.0)}[style]
    panel, red, gold, rnd = look
    pal = dict(BASE)
    pal.update({'panel': panel, 'hp': red, 'hp_back': _mul(panel, 1.8), 'gold': gold, 'heart': red, 'flask': (240, 110, 140),
                'flask_glass': (200, 220, 240), 'slot': _mul(panel, 1.6), 'icon_steel': (200, 210, 225)})
    parts = [('panel', _rrect(6, 6, 190, 34, rnd)), ('hp_back', _rrect(26, 12, 150, 10, rnd / 2)),
             ('hp', _rrect(26, 12, 112, 10, rnd / 2)), ('heart', ell(16, 17, 6, 5.5)),
             ('flask_glass', ell(17, 31, 5, 4.6)), ('flask', ell(17, 32.4, 4, 3)), ('flask_glass', poly((15.6, 23), (18.4, 23), (18.4, 27), (15.6, 27))),
             ('flask_glass', ell(31, 31, 5, 4.6)), ('flask', ell(31, 32.4, 4, 3)), ('flask_glass', poly((29.6, 23), (32.4, 23), (32.4, 27), (29.6, 27)))]
    for i, x in enumerate((548, 576, 604)):
        parts += [('panel', _rrect(x - 2, 6, 30, 30, rnd)), ('slot', _rrect(x + 1, 9, 24, 24, rnd / 2))]
    parts += [('icon_steel', poly((556, 29), (572, 13), (574, 15), (558, 31))), ('gold', poly((553, 26), (557, 30), (560, 27), (556, 23))),
              ('scarf', poly((584, 14), (598, 14), (590, 30))), ('flask', ell(616, 21, 7, 7))]
    rgb, a = shade_object(style, cv, parts, (0, 0), pal)
    paste(cv.img, rgb, a)


def _rrect(x, y, w, h, r):
    if r <= 0.5:
        return poly((x, y), (x + w, y), (x + w, y + h), (x, y + h))
    pts = []
    for cx, cy, a0 in ((x + w - r, y + r, -90), (x + w - r, y + h - r, 0), (x + r, y + h - r, 90), (x + r, y + r, 180)):
        for k in range(7):
            a = math.radians(a0 + k * 15)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return ('poly', tuple(pts))


# ------------------------------------------------------------------------------------------------- the renderer

STYLES = {'A': dict(U=2, ss=1), 'B': dict(U=1, ss=1), 'C': dict(U=2, ss=2), 'D': dict(U=2, ss=2)}
CLOSEUP = (168, 160, 300, 236)          # hero + wolf, logical box


def render(style, scale=1, region=(0, 0, W, H)):
    """Render the scene; `scale` multiplies the style's pixel density (close-ups of the smooth styles)."""
    st = STYLES[style]
    U = st['U'] * st['ss'] * scale
    cv = Canvas(U, region)
    pal = palette(style)
    background(style, cv)
    for name in ORDER:
        parts, origin = SCENE[name]
        extra = (lambda r, a, i, ro: telegraph(r, a, i, ro, style)) if name == 'wolf' else None
        if name == 'smear':
            rgb, a = shade_object(style, cv, parts, origin, pal)
            a = a * (0.75 if style != 'C' else 0.9)
            if style == 'D':
                a = blur(a, U * 0.4)
            paste(cv.img, rgb, a)
            continue
        if name == 'wolf':
            # the telegraph halo: an orange glow behind the wolf
            ids, _r = cv.masks(parts, origin)
            halo = blur(dilate(ids >= 0, max(1, int(U * 1.6))).astype(np.float32), U * 1.2) * (0.6 if style == 'B' else 0.85)
            paste(cv.img, np.broadcast_to(np.array((255, 150, 40), np.float32), cv.img.shape).copy(), halo)
        rgb, a = shade_object(style, cv, parts, origin, pal, extra)
        if name == 'chest' and style == 'B':
            _moody_light(cv)                    # darkness and fog over the world, before the lit characters
        if name in ('hero', 'wolf', 'archer', 'chest') and style in ('A', 'C', 'D'):
            _ground_shadow(cv, name)
        paste(cv.img, rgb, a)
        if name == 'block':
            glow(cv, (96, 194), 26, (255, 210, 90), {'A': 0.35, 'B': 0.25, 'C': 0.0, 'D': 0.3}[style])
    spark(style, cv)
    if style == 'B':
        glow(cv, (262 - 13.2, 226 - 17.6), 7, (255, 40, 20), 1.4)          # the wolf's glowing eye
    if style == 'A':
        glow(cv, (230, 186), 30, (255, 255, 230), 0.12)                 # the smear's soft glow
    if style == 'D':
        _warm_grade(cv)
    hud(style, cv)
    out = np.clip(cv.img, 0, 255).astype(np.uint8)
    im = Image.fromarray(out, 'RGB')
    if st['ss'] > 1:
        im = im.resize((im.width // st['ss'], im.height // st['ss']), Image.LANCZOS)
    if style == 'B':
        im = im.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    return im


def _ground_shadow(cv, name):
    spots = {'hero': (196, 300, 9), 'wolf': (262, 300, 12), 'archer': (585, 196, 8), 'chest': (45, 300, 13)}
    x, y, r = spots[name]
    ys, xs = np.mgrid[0:cv.h, 0:cv.w]
    d = ((xs / cv.U + cv.rx - x) / r) ** 2 + ((ys / cv.U + cv.ry - y) / (r * 0.28)) ** 2
    a = np.clip(1 - d, 0, 1) * 0.35
    paste(cv.img, np.zeros(cv.img.shape, np.float32), a)


def _moody_light(cv):
    """B: darkness with pools of light: the torch, the Lucky Block and the spark; the wolf's eye glows red."""
    ys, xs = np.mgrid[0:cv.h, 0:cv.w]
    lx, ly = xs / cv.U + cv.rx, ys / cv.U + cv.ry
    light = np.full(lx.shape, 0.5, np.float32)
    for (x, y, r, k) in ((TORCH[0], TORCH[1] - 14, 110, 0.8), (96, 194, 40, 0.35), (520, 64, 200, 0.2)):
        light += np.clip(1 - np.hypot(lx - x, ly - y) / r, 0, 1) ** 1.6 * k
    warm = np.clip(1 - np.hypot(lx - TORCH[0], ly - (TORCH[1] - 14)) / 120, 0, 1) ** 2
    cv.img[:] = cv.img * np.clip(light, 0, 1.4)[..., None] + np.array([120, 66, 12], np.float32) * warm[..., None] * 0.55
    # the torch itself
    tx, ty = TORCH
    parts = [('pole', capsule((tx, ty + 4), (tx, ty - 10), 2.4)), ('fire', ell(tx, ty - 14, 3, 4.6)), ('core', ell(tx, ty - 13, 1.5, 2.4))]
    rgb, a = shade_object('B', cv, parts, (0, 0), {'pole': (60, 40, 30), 'fire': (255, 140, 40), 'core': (255, 236, 160)})
    paste(cv.img, rgb, a)
    glow(cv, (tx, ty - 14), 20, (255, 150, 50), 0.5)
    # the fog in front of the ground
    fog = np.clip(1 - np.abs(ly - 306) / 22, 0, 1) * 0.35
    paste(cv.img, np.broadcast_to(np.array((80, 74, 110), np.float32), cv.img.shape).copy(), fog)


def _warm_grade(cv):
    """D: a soft warm light from the upper right and a gentle vignette, plus paper grain."""
    ys, xs = np.mgrid[0:cv.h, 0:cv.w]
    lx, ly = xs / cv.U + cv.rx, ys / cv.U + cv.ry
    warm = np.clip(1 - np.hypot(lx - 520, ly - 76) / 420, 0, 1)
    cv.img[:] = cv.img * (0.9 + 0.16 * warm[..., None]) + np.array([30, 16, 0], np.float32) * warm[..., None] * 0.5
    vig = np.clip(np.hypot((lx - 320) / 360, (ly - 180) / 230) - 0.55, 0, 1)
    cv.img[:] = cv.img * (1 - 0.35 * vig[..., None])
    grain = noise(cv.h, cv.w, 99, 2)
    cv.img[:] = cv.img * (0.985 + 0.03 * grain[..., None])


# ------------------------------------------------------------------------------------------------- contrast check

def contrast_lines(style, im):
    """OKLab distance of the hero, the wolf (with its telegraph) and the archer from the background right behind them."""
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from art.contrast import oklab, dist, THRESHOLD
    bgim = render_background_only(style)
    k = im.width / W
    out = []
    for name in ('hero', 'wolf', 'archer'):
        parts, origin = SCENE[name]
        cv = Canvas(k)
        ids, _r = cv.masks(parts, origin)
        m = ids >= 0
        a = np.asarray(im).astype(np.float64)[m]
        ring = dilate(m, int(6 * k)) & ~m
        b = np.asarray(bgim).astype(np.float64)[ring]
        ma = np.array(oklab(a.T)).T.mean(axis=0)
        mb = np.array(oklab(b.T)).T.mean(axis=0)
        d = dist(ma, mb)
        out.append(f'{style} {name} vs background {d:.3f} {"PASS" if d >= THRESHOLD else "FAIL"}')
    return out


def render_background_only(style):
    st = STYLES[style]
    cv = Canvas(st['U'] * st['ss'])
    background(style, cv)
    rgb, a = shade_object(style, cv, *SCENE['terrain'], palette(style))
    paste(cv.img, rgb, a)
    if style == 'B':
        _moody_light(cv)
    if style == 'D':
        _warm_grade(cv)
    im = Image.fromarray(np.clip(cv.img, 0, 255).astype(np.uint8), 'RGB')
    if st['ss'] > 1:
        im = im.resize((im.width // st['ss'], im.height // st['ss']), Image.LANCZOS)
    return im


# ------------------------------------------------------------------------------------------------- outputs

NAMES = {'A': 'HD pixel art', 'B': 'Dark and moody', 'C': 'Bright cartoon', 'D': 'Painted storybook'}


def build(docs_dir, preview_dir):
    os.makedirs(docs_dir, exist_ok=True)
    os.makedirs(preview_dir, exist_ok=True)
    scenes, closeups, report = {}, {}, []
    x0, y0, x1, y1 = CLOSEUP
    for s in 'ABCD':
        im = render(s)
        if im.width < 2 * W:                               # B is drawn at the game's 640 x 360: show it at 2x
            im = im.resize((2 * W, 2 * H), Image.NEAREST)
        im.save(os.path.join(docs_dir, f'style_test_{s}.png'))
        scenes[s] = im
        # close-up of the hero and the wolf at 4x the game's pixels
        if s in ('C', 'D'):
            cu = render(s, 2, CLOSEUP)                      # smooth styles: drawn again at the close-up size
        else:
            cu = render(s, 1, CLOSEUP)
            cu = cu.resize(((x1 - x0) * 4, (y1 - y0) * 4), Image.NEAREST)
        cu = cu.resize(((x1 - x0) * 4, (y1 - y0) * 4), Image.LANCZOS if s in 'CD' else Image.NEAREST)
        cu.save(os.path.join(docs_dir, f'style_test_{s}_closeup.png'))
        closeups[s] = cu
        report += contrast_lines(s, render(s) if s != 'B' else render(s).resize((W, H)))
    compare(scenes, closeups, os.path.join(docs_dir, 'style_test_compare.png'))
    with open(os.path.join(docs_dir, 'style_test_contrast.txt'), 'w', newline='\n') as f:
        f.write('# ART13 style test: OKLab distance of each character from the background around it (FAIL below 0.15)\n')
        f.write('\n'.join(report) + '\n')
    return report


def compare(scenes, closeups, path):
    """All four side by side: the scenes 2 x 2, then the four close-ups in a row."""
    sw, sh = 960, 540
    cw = 480
    ch = int(closeups['A'].height * cw / closeups['A'].width)
    pad, lab = 12, 30
    out = Image.new('RGB', (2 * sw + 3 * pad, 2 * (sh + lab) + 3 * pad + ch + lab + pad), (24, 22, 32))
    d = ImageDraw.Draw(out)
    for i, s in enumerate('ABCD'):
        x = pad + (i % 2) * (sw + pad)
        y = pad + (i // 2) * (sh + lab + pad)
        d.text((x, y + 6), f'{s}  {NAMES[s]}', fill=(240, 236, 226))
        out.paste(scenes[s].resize((sw, sh), Image.LANCZOS if s in 'CD' else Image.NEAREST), (x, y + lab))
    y = pad + 2 * (sh + lab + pad)
    for i, s in enumerate('ABCD'):
        x = pad + i * (cw + 3)
        d.text((x, y + 6), f'{s} close-up', fill=(240, 236, 226))
        out.paste(closeups[s].resize((cw, ch), Image.LANCZOS if s in 'CD' else Image.NEAREST), (x, y + lab))
    out.save(path)


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    lines = build(os.path.join(root, 'docs', 'art'), os.path.join(root, 'tools', 'out', 'preview'))
    print('\n'.join(lines))
