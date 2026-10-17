"""Every icon of the `ui` atlas (07 §3.4, 08 §8): weapons, abilities, stats, classes, elements, statuses,
Lucky Block and curse effects, HUD symbols and white tint frames."""
import math

import numpy as np
from PIL import Image

from . import palette as P
from . import raster as R

DIAG = (math.sqrt(0.5), -math.sqrt(0.5))       # 45°, pointing up-right


class Icon:
    def __init__(self, w=16, h=16):
        self.w, self.h = w, h
        self.L = R.PartLayer(w, h)
        self.after = []                             # (x, y, slot) pixels set after shading

    def part(self, name, ramp, shift=0):
        if name not in self.L.index:
            self.L.add_part(name, P.ramp_ids(ramp), shift)
        return name

    def poly(self, pts, part):
        R.fill_polygon(self.L, pts, part)

    def ell(self, cx, cy, rx, ry, part):
        R.ellipse(self.L, cx, cy, rx, ry, part)

    def rect(self, x, y, w, h, part):
        R.fill_rect(self.L, int(x), int(y), int(w), int(h), part)

    def line(self, p0, p1, width, part):
        if width <= 1:
            R.line(self.L, (int(round(p0[0])), int(round(p0[1]))), (int(round(p1[0])), int(round(p1[1]))), part)
            return
        (x0, y0), (x1, y1) = p0, p1
        dx, dy = x1 - x0, y1 - y0
        n = math.hypot(dx, dy) or 1
        px, py = -dy / n * width / 2, dx / n * width / 2
        self.poly([(x0 + px, y0 + py), (x1 + px, y1 + py), (x1 - px, y1 - py), (x0 - px, y0 - py)], part)

    def px(self, x, y, color):
        self.after.append((x, y, P.sid(color) if isinstance(color, tuple) else color))

    def done(self, outline=True):
        c = R.auto_shade(self.L)
        if outline:
            R.outline(c, P.INK)
        for x, y, s in self.after:
            if 0 <= x < self.w and 0 <= y < self.h:
                c.a[y, x] = s
        return c.to_image()


def C(ramp, i):
    return P.RAMPS[ramp][i]


UI = P.UI_COLORS
WHITE = (255, 255, 255)


# ------------------------------------------------------------------ weapons (16 × 16, 45°, up-right)

def _along(ic, segs, start=(2.6, 13.4), d=DIAG):
    ux, uy = d
    px, py = -uy, ux
    for k, (a, b, wd, ramp, shape) in enumerate(segs):
        part = ic.part(f's{k}', ramp)
        x0, y0 = start[0] + ux * a, start[1] + uy * a
        x1, y1 = start[0] + ux * b, start[1] + uy * b
        w0 = wd / 2
        w1 = 0.5 if shape == 'taper' else w0
        ic.poly([(x0 + px * w0, y0 + py * w0), (x1 + px * w1, y1 + py * w1),
                 (x1 - px * w1, y1 - py * w1), (x0 - px * w0, y0 - py * w0)], part)


def _pt(t, start=(2.6, 13.4), side=0.0):
    return (start[0] + DIAG[0] * t - DIAG[1] * side, start[1] + DIAG[1] * t + DIAG[0] * side)


def weapon_icon(wid):
    ic = Icon()
    if wid == 'greatsword':
        _along(ic, [(0, 2, 2.6, 'w_gold', 'rect'), (2, 5, 1.6, 'w_wood', 'rect'), (5, 6.6, 6.4, 'w_gold', 'rect'),
                    (6.6, 17.5, 3.2, 'w_steel', 'taper')])
    elif wid == 'katana':
        _along(ic, [(0, 5, 1.8, 'w_wood', 'rect'), (5, 6, 3.4, 'w_gold', 'rect'), (6, 17.5, 1.8, 'w_steel', 'taper')])
        ic.px(*map(round, _pt(14, side=-0.8)), C('w_steel', 3))
    elif wid == 'twin_daggers':
        _along(ic, [(0, 3, 1.6, 'w_wood', 'rect'), (3, 4, 4, 'w_gold', 'rect'), (4, 10, 2.2, 'w_steel', 'taper')],
               start=(3.0, 13.0))
        _along(ic, [(0, 3, 1.6, 'w_wood', 'rect'), (3, 4, 4, 'w_gold', 'rect'), (4, 10, 2.2, 'w_steel', 'taper')],
               start=(13.0, 13.0), d=(-DIAG[0], DIAG[1]))
    elif wid == 'spear':
        _along(ic, [(0, 12.5, 1.6, 'w_wood', 'rect'), (12.5, 13.5, 3.6, 'w_steel', 'rect'),
                    (13.5, 18, 3.6, 'w_steel', 'taper')])
    elif wid == 'javelin':
        _along(ic, [(1, 15, 1.2, 'w_wood', 'rect'), (6.5, 8.5, 2.6, 'w_gold', 'rect'),
                    (15, 18, 2.4, 'w_steel', 'taper')])
    elif wid == 'scythe':
        _along(ic, [(0, 17, 1.6, 'w_wood', 'rect')], start=(4.0, 14.0), d=(0.3, -0.954))
        b = ic.part('blade', 'w_steel')
        ic.poly([(8.6, 1.2), (1.2, 2.6), (1.4, 5.0), (4.0, 3.6), (8.8, 3.6)], b)
    elif wid == 'war_maul':
        _along(ic, [(0, 11, 1.6, 'w_wood', 'rect'), (10.5, 16.5, 7.2, 'w_steel', 'rect')])
    elif wid == 'giant_axe':
        _along(ic, [(0, 17.5, 1.6, 'w_wood', 'rect')])
        h = ic.part('head', 'w_steel')
        c0 = _pt(13)
        for side in (1, -1):
            ic.poly([_pt(10.5, side=side * 1), _pt(10, side=side * 5.2), _pt(16, side=side * 5.2),
                     _pt(15.5, side=side * 1)], h)
        del c0
    elif wid == 'flail':
        _along(ic, [(0, 6, 2.2, 'w_wood', 'rect'), (6, 7, 3, 'w_steel', 'rect')])
        ch = ic.part('chain', 'gray', -1)
        for t in (8, 9.5):
            x, y = _pt(t, side=0.6)
            ic.ell(x, y, 0.8, 0.8, ch)
        ball = ic.part('ball', 'w_steel')
        ic.ell(11.5, 4.5, 3.2, 3.2, ball)
        for (x, y) in ((11, 0.6), (15.4, 4), (11.5, 8.6), (7.6, 4.5)):
            ic.px(round(x), round(y), C('w_steel', 3))
    elif wid == 'iron_fists':
        g = ic.part('glove', 'w_steel')
        cuff = ic.part('cuff', 'w_gold', 1)
        ic.ell(8, 6.5, 6, 5, g)
        ic.rect(4, 10, 8, 5, cuff)
        for x in (5, 8, 11):
            ic.px(x, 3, C('w_steel', 1))
            ic.px(x, 4, C('w_steel', 1))
    elif wid == 'shield':
        s = ic.part('shield', 'w_steel')
        ic.poly([(2, 1.5), (14, 1.5), (14, 8), (8, 14.8), (2, 8)], s)
        boss = ic.part('boss', 'w_gold')
        ic.ell(7.5, 6.5, 2.2, 2.2, boss)
    elif wid == 'bow':
        b = ic.part('bow', 'w_wood', -1)
        for k in range(15):
            t = k / 14
            a = math.radians(-60 + 120 * t)
            x, y = 3 + 9 * math.cos(a) * 0.9, 7.5 + 7 * math.sin(a)
            ic.ell(x, y, 1.1, 1.1, b)
        st = ic.part('string', 'gray')
        ic.line((5.6, 1.6), (5.6, 13.4), 1, st)
    elif wid == 'crossbow':
        _along(ic, [(0, 14, 2.6, 'w_wood', 'rect'), (14, 17, 2.0, 'w_steel', 'taper')])
        limb = ic.part('limb', 'w_steel', 1)
        a, b = _pt(10, side=6), _pt(10, side=-6)
        ic.line(a, b, 1.8, limb)
    elif wid == 'hand_cannon':
        _along(ic, [(0, 4, 3, 'w_wood', 'rect'), (3, 15, 5, 'w_steel', 'rect'), (15, 16.5, 6.4, 'w_steel', 'rect')])
        x, y = _pt(16)
        ic.px(round(x), round(y), C('ink', 0))
    elif wid == 'throwing_knives':
        for k, (ang, st) in enumerate(((60, (4, 13)), (40, (3, 11)), (80, (6, 14)))):
            a = math.radians(ang)
            d = (math.cos(math.radians(90 - ang)) * 0 + math.sin(math.radians(ang)), -math.cos(math.radians(ang)))
            _along(ic, [(0, 2.5, 1.4, 'w_wood', 'rect'), (2.5, 9, 2.2, 'w_steel', 'taper')], start=st,
                   d=(math.sin(a), -math.cos(a)))
            del d
    elif wid == 'storm_hammer':
        _along(ic, [(0, 11, 1.8, 'w_wood', 'rect'), (10.5, 16.5, 6.4, 'w_gold', 'rect')])
        x, y = _pt(13.5)
        for dx, dy in ((0, -1), (0, 0), (1, 0), (1, 1)):
            ic.px(round(x) + dx, round(y) + dy, C('fx_bolt', 2))
    elif wid == 'staff':
        _along(ic, [(0, 14.5, 1.6, 'w_wood', 'rect')], start=(2.0, 14.0))
        orb = ic.part('orb', 'w_magic')
        ic.ell(12.2, 3.6, 2.8, 2.8, orb)
    elif wid == 'wand':
        _along(ic, [(0, 9, 1.4, 'w_wood', 'rect')], start=(3.5, 12.5))
        star = ic.part('star', 'w_gold', -1)
        cx, cy = 11.2, 4.6
        ic.poly([(cx + 3.6 * math.cos(math.radians(90 + 72 * k + (36 if j else 0))) * (1 if not j else 0.45),
                  cy - 3.6 * math.sin(math.radians(90 + 72 * k + (36 if j else 0))) * (1 if not j else 0.45))
                 for k in range(5) for j in (0, 1)], star)
    elif wid == 'spell_tome':
        cover = ic.part('cover', 'w_magic')
        pages = ic.part('pages', 'white')
        ic.rect(2, 3, 12, 11, cover)
        ic.rect(4, 4, 9, 8, pages)
        rune = ic.part('rune', 'w_gold')
        ic.ell(8.5, 8, 2, 2, rune)
    else:
        raise KeyError(wid)
    return ic.done()


WEAPONS = ['greatsword', 'katana', 'twin_daggers', 'spear', 'scythe', 'war_maul', 'iron_fists', 'giant_axe', 'flail',
           'shield', 'bow', 'crossbow', 'hand_cannon', 'javelin', 'throwing_knives', 'storm_hammer', 'staff', 'wand',
           'spell_tome']


# ------------------------------------------------------------------ abilities (class color symbols)

ABILITY_CLASS = {
    'blade_dash': 'swordsman', 'whirlwind': 'swordsman', 'blade_flurry': 'swordsman', 'riposte': 'swordsman',
    'shockwave': 'tank', 'shoulder_charge': 'tank', 'rage': 'tank', 'boulder_toss': 'tank',
    'arrow_rain': 'archer', 'turret': 'archer', 'grapple_arrow': 'archer', 'hunters_mark': 'archer',
    'thunder_strike': 'wizard', 'frost_burst': 'wizard', 'blink': 'wizard', 'time_slow': 'wizard',
    'vampire': 'neutral',
}
ABILITIES = list(ABILITY_CLASS)


def ability_icon(aid):
    ic = Icon()
    col = 'ui:class_' + ABILITY_CLASS[aid]
    m = ic.part('main', col)
    wht = ic.part('white', 'white')
    if aid == 'blade_dash':
        ic.line((2, 13), (14, 2), 2.6, m)
        ic.line((5, 13), (14, 5), 1.2, wht)
        for k in range(3):
            ic.line((1, 5 + k * 3), (5 - k, 5 + k * 3), 1, m)
    elif aid == 'whirlwind':
        for k in range(14):
            a = k * 0.5
            r = 1.5 + k * 0.42
            ic.ell(8 + r * math.cos(a), 8 + r * math.sin(a), 1.1, 1.1, m)
    elif aid == 'blade_flurry':
        for k, ang in enumerate((-40, 0, 40)):
            a = math.radians(ang)
            _x, _y = 8 + 6.5 * math.sin(a), 14 - 6.5 * math.cos(a)
            ic.line((8 + 1.5 * math.sin(a), 14 - 1.5 * math.cos(a)), (8 + 12 * math.sin(a), 14 - 12 * math.cos(a)),
                    2.2, m)
        ic.ell(8, 13.5, 1.6, 1.4, wht)
    elif aid == 'riposte':
        ic.poly([(3, 2), (13, 2), (13, 8), (8, 14), (3, 8)], m)
        ic.line((5, 9), (10, 4), 1.6, wht)
        ic.poly([(10.5, 2.8), (10.5, 6.2), (7.4, 3.2)], wht)
    elif aid == 'shockwave':
        ic.rect(1, 12, 14, 2, m)
        for r in (4, 7):
            for k in range(9):
                a = math.radians(180 + k * 22.5)
                ic.ell(8 + r * math.cos(a), 12 + r * math.sin(a), 0.9, 0.9, m if r == 7 else wht)
    elif aid == 'shoulder_charge':
        ic.poly([(1, 5), (9, 5), (9, 2), (15, 8), (9, 14), (9, 11), (1, 11)], m)
        ic.rect(3, 7, 6, 2, wht)
    elif aid == 'rage':
        ic.poly([(8, 1), (12, 6), (11, 3.5), (14, 9), (12, 14), (4, 14), (2, 9), (5, 4), (5, 7)], m)
        ic.ell(8, 11, 2.2, 2.6, wht)
    elif aid == 'boulder_toss':
        rock = ic.part('rock', 'gray', -1)
        ic.ell(10, 9.5, 4.5, 4, rock)
        for k in range(4):
            ic.ell(2 + k * 1.8, 12 - k * 2.4 + k * k * 0.3, 0.8, 0.8, m)
    elif aid == 'arrow_rain':
        for x0, y0 in ((3, 1), (8, 4), (13, 0)):
            ic.line((x0, y0), (x0, y0 + 8), 1, m)
            ic.poly([(x0 - 2.2, y0 + 7.5), (x0 + 3.2, y0 + 7.5), (x0 + 0.5, y0 + 11)], m)
        ic.rect(1, 14, 14, 1, wht)
    elif aid == 'turret':
        ic.rect(4, 6, 8, 5, m)
        ic.rect(11, 7, 4, 2, wht)
        ic.line((5, 11), (2, 15), 1, m)
        ic.line((11, 11), (14, 15), 1, m)
        ic.line((8, 11), (8, 15), 1, m)
    elif aid == 'grapple_arrow':
        ic.line((2, 14), (10, 6), 1, wht)
        ic.poly([(9, 3), (13, 2), (14, 7), (12, 5), (11, 7)], m)
        ic.poly([(9, 3), (11, 7), (8, 8)], m)
    elif aid == 'hunters_mark':
        ring = ic.part('ring', col)
        ic.ell(7.5, 7.5, 6, 6, ring)
        hole = np.zeros((16, 16), bool)
        ys, xs = np.mgrid[0:16, 0:16]
        hole = (xs - 7.5) ** 2 + (ys - 7.5) ** 2 < 16
        ic.L.ids[hole] = -1
        for (a, b) in (((7, 0), (7, 5)), ((7, 10), (7, 15)), ((0, 7), (5, 7)), ((10, 7), (15, 7))):
            ic.line(a, b, 1, m)
        ic.ell(7, 7, 0.9, 0.9, wht)
    elif aid == 'thunder_strike':
        ic.poly([(9, 0.5), (3, 8.5), (7.5, 8.5), (5, 15.5), (13, 6), (8.5, 6), (11, 0.5)], m)
        ic.line((8, 3), (6, 7), 1, wht)
    elif aid == 'frost_burst':
        for k in range(3):
            a = math.radians(90 + 60 * k)
            dx, dy = 6.5 * math.cos(a), 6.5 * math.sin(a)
            ic.line((7.5 - dx, 7.5 - dy), (7.5 + dx, 7.5 + dy), 1.6, m)
        ic.ell(7.5, 7.5, 1.6, 1.6, wht)
    elif aid == 'blink':
        for k in range(8):
            a = math.radians(45 * k)
            ic.ell(5 + 3.5 * math.cos(a), 8 + 3.5 * math.sin(a), 0.8, 0.8, m)
        ic.poly([(9, 6), (13, 6), (13, 3.5), (15.5, 8), (13, 12.5), (13, 10), (9, 10)], wht)
    elif aid == 'time_slow':
        ic.poly([(3, 1), (13, 1), (8.5, 7.5), (13, 14), (3, 14), (7.5, 7.5)], m)
        sand = ic.part('sand', 'white')
        ic.poly([(5.5, 13), (10.5, 13), (8, 10)], sand)
        ic.rect(2, 0, 12, 2, wht)
        ic.rect(2, 13, 12, 2, wht)
    elif aid == 'vampire':
        ic.poly([(2, 3), (14, 3), (14, 6), (2, 6)], m)
        ic.poly([(4, 5), (7, 5), (5.5, 12)], wht)
        ic.poly([(9, 5), (12, 5), (10.5, 12)], wht)
        drop = ic.part('drop', 'fx_heal')
        ic.ell(5.5, 13.5, 1.2, 1.5, drop)
    else:
        raise KeyError(aid)
    return ic.done()


# ------------------------------------------------------------------ stats, elements, statuses, effects, HUD

def heart(ic, cx, cy, s, part):
    ic.ell(cx - s * 0.5, cy - s * 0.25, s * 0.55, s * 0.55, part)
    ic.ell(cx + s * 0.5, cy - s * 0.25, s * 0.55, s * 0.55, part)
    ic.poly([(cx - s * 1.05, cy - 0.1 * s), (cx + s * 1.05, cy - 0.1 * s), (cx, cy + s * 1.0)], part)


def drop(ic, cx, cy, s, part):
    ic.ell(cx, cy + s * 0.35, s * 0.65, s * 0.65, part)
    ic.poly([(cx - s * 0.6, cy + 0.2 * s), (cx + s * 0.6, cy + 0.2 * s), (cx, cy - s)], part)


def flame(ic, cx, cy, s, part, core=None):
    ic.poly([(cx, cy - s), (cx + s * 0.75, cy + s * 0.1), (cx + s * 0.5, cy + s * 0.8), (cx - s * 0.5, cy + s * 0.8),
             (cx - s * 0.75, cy + s * 0.1), (cx - s * 0.2, cy - s * 0.2)], part)
    if core:
        ic.ell(cx, cy + s * 0.35, s * 0.3, s * 0.35, core)


def stat_icon(sid):
    ic = Icon()
    if sid == 'vitality':
        heart(ic, 8, 8, 5, ic.part('h', 'fx_heal'))
    elif sid == 'might':
        g = ic.part('arm', 'skin' if False else 'w_gold')
        ic.ell(8, 9, 5.5, 4.5, g)
        ic.ell(5, 5, 2.5, 3, g)
        ic.rect(10, 11, 4, 4, g)
    elif sid == 'quickstep':
        b = ic.part('boot', 'w_wood')
        ic.poly([(4, 2), (9, 2), (9, 10), (14, 11), (14, 14), (4, 14)], b)
        w = ic.part('wing', 'white')
        ic.poly([(9, 4), (15, 2), (13, 5), (15, 5), (10, 8)], w)
    elif sid == 'focus':
        e = ic.part('eye', 'white')
        ic.ell(7.5, 8, 6.5, 4, e)
        i = ic.part('iris', 'fx_ice', 1)
        ic.ell(7.5, 8, 2.6, 2.6, i)
    elif sid == 'bloodthirst':
        drop(ic, 8, 8, 6, ic.part('d', 'fx_heal', 1))
    elif sid == 'precision':
        r = ic.part('r', 'fx_bolt', -1)
        for (a, b) in (((7, 1), (7, 13)), ((1, 7), (13, 7))):
            ic.line(a, b, 1, r)
        ic.ell(7, 7, 4.5, 4.5, ic.part('ring', 'w_gold'))
        ys, xs = np.mgrid[0:16, 0:16]
        ic.L.ids[((xs - 7) ** 2 + (ys - 7) ** 2 < 9) & (ic.L.ids == ic.L.index['ring'])] = -1
    elif sid == 'frenzy':
        a = ic.part('a', 'fx_fire', 1)
        for y0 in (2, 8):
            ic.poly([(2, y0), (8, y0 + 3), (2, y0 + 6)], a)
            ic.poly([(8, y0), (14, y0 + 3), (8, y0 + 6)], a)
    elif sid == 'iron_skin':
        s = ic.part('s', 'w_steel')
        ic.poly([(2, 3), (8, 1), (14, 3), (13, 10), (8, 15), (3, 10)], s)
        ic.line((8, 3), (8, 12), 1, ic.part('rib', 'w_steel', 1))
    elif sid == 'prospector':
        ic.line((3, 14), (12, 5), 1.8, ic.part('handle', 'w_wood'))
        ic.poly([(7, 2), (14, 1.5), (15, 8), (12, 5), (10, 4)], ic.part('pick', 'w_steel'))
        ic.ell(4.5, 5.5, 2.6, 2.6, ic.part('coin', 'w_gold', -1))
    elif sid == 'light_feet':
        f = ic.part('feather', 'white')
        ic.poly([(13, 1), (14, 4), (6, 13), (3, 14), (4, 11)], f)
        ic.line((3, 14), (12, 3), 1, ic.part('quill', 'gray', 1))
    elif sid == 'haggler':
        bag = ic.part('bag', 'w_wood', -1)
        ic.ell(8, 10, 5.5, 4.5, bag)
        ic.poly([(5, 6), (11, 6), (9, 3), (7, 3)], bag)
        ic.ell(8, 10, 2, 2, ic.part('coin', 'w_gold'))
    elif sid == 'lucky_charm':
        c = ic.part('clover', 'fx_poison')
        for (x, y) in ((5.5, 5), (10.5, 5), (5.5, 10), (10.5, 10)):
            ic.ell(x, y, 2.8, 2.8, c)
        ic.line((8, 8), (11, 15), 1, ic.part('stem', 'fx_poison', 1))
    else:
        raise KeyError(sid)
    return ic.done()


STATS = ['vitality', 'might', 'quickstep', 'focus', 'bloodthirst', 'precision', 'frenzy', 'iron_skin', 'prospector',
         'light_feet', 'haggler', 'lucky_charm']
CLASS_WEAPON = {'swordsman': 'greatsword', 'tank': 'shield', 'archer': 'bow', 'wizard': 'staff'}


def class_icon(cid):
    """The class's signature weapon (sword, shield, bow, staff) in w_* ramps, 08 §8."""
    return weapon_icon(CLASS_WEAPON[cid])


def element_icon(eid):
    ic = Icon(7, 7)
    if eid == 'fire':
        flame(ic, 3, 3, 2.6, ic.part('f', 'fx_fire', -1))
    elif eid == 'ice':
        i = ic.part('i', 'fx_ice', -1)
        ic.poly([(3, 0.5), (5.5, 3), (3, 5.5), (0.5, 3)], i)
    elif eid == 'lightning':
        ic.poly([(3.5, 0.2), (1, 3.4), (3, 3.4), (2.2, 5.8), (5.6, 2.4), (3.6, 2.4), (4.6, 0.2)],
                ic.part('l', 'fx_bolt', -1))
    elif eid == 'poison':
        drop(ic, 3, 3, 2.4, ic.part('p', 'fx_poison', -1))
    else:
        w = ic.part('w', 'fx_wind', -1)
        ic.rect(1, 1, 4, 1, w)
        ic.rect(0, 3, 5, 1, w)
        ic.rect(2, 5, 4, 1, w)
    return ic.done(outline=True)


def status_icon(sid):
    ic = Icon(8, 8)
    if sid == 'burning':
        flame(ic, 3.5, 3.4, 3, ic.part('f', 'fx_fire'), ic.part('c', 'fx_fire', -2))
    elif sid == 'poisoned':
        p = ic.part('p', 'fx_poison')
        ic.ell(2.5, 4.5, 1.8, 1.8, p)
        ic.ell(5, 2.5, 1.4, 1.4, p)
        ic.ell(5.2, 5.4, 1.1, 1.1, p)
    elif sid == 'chilled':
        i = ic.part('i', 'fx_ice', -1)
        ic.line((3.5, 0.5), (3.5, 6.5), 1, i)
        ic.line((0.5, 3.5), (6.5, 3.5), 1, i)
        ic.line((1.5, 1.5), (5.5, 5.5), 1, i)
        ic.line((5.5, 1.5), (1.5, 5.5), 1, i)
    else:   # rooted
        r = ic.part('r', 'w_wood')
        ic.line((1, 6), (3, 1), 1, r)
        ic.line((3, 6), (5, 2), 1, r)
        ic.line((5, 6), (6, 3), 1, r)
        ic.rect(0, 6, 7, 1, r)
    return ic.done()


LUCKY = ['swift', 'golden_touch', 'firestarter', 'second_wind', 'overdrive', 'bloodrush', 'heavy', 'glass_bones',
         'leaky_pockets', 'jammed', 'dry_flask', 'butterfingers']
CURSES = ['one_hit', 'no_heal', 'heavy_feet', 'hunted']


def effect_icon(eid, curse=False):
    """10 × 10: Lucky Block effects in w_gold, curses in fx_dark (08 §8)."""
    ic = Icon(10, 10)
    g = ic.part('g', 'fx_dark' if curse else 'w_gold', -1 if not curse else -2)
    if eid == 'swift':
        ic.poly([(1, 4), (6, 1), (5, 4), (8, 3), (4, 8)], g)
    elif eid == 'golden_touch':
        ic.ell(4.5, 4.5, 3.6, 3.6, g)
        ic.rect(4, 2, 1, 5, ic.part('c', 'w_gold', 1))
    elif eid == 'firestarter':
        flame(ic, 4.5, 4.4, 3.6, g)
    elif eid == 'second_wind':
        heart(ic, 4.5, 4.6, 2.8, g)
    elif eid == 'overdrive':
        ic.poly([(5, 0.4), (1.5, 5), (4.2, 5), (3.2, 8.6), (8, 3.6), (5.4, 3.6), (6.6, 0.4)], g)
    elif eid == 'bloodrush':
        drop(ic, 4.5, 4.5, 3.6, g)
    elif eid == 'heavy':
        ic.poly([(2, 3), (7, 3), (8.5, 8.5), (0.5, 8.5)], g)
        ic.rect(3, 0, 3, 3, g)
    elif eid == 'glass_bones':
        ic.line((1, 8), (8, 1), 2, g)
        for (x, y) in ((1, 7), (2, 8), (7, 1), (8, 2)):
            ic.ell(x, y, 1, 1, g)
        ic.px(4, 5, P.INK)
        ic.px(5, 4, P.INK)
    elif eid == 'leaky_pockets':
        ic.ell(4.5, 3.5, 3.4, 3, g)
        ic.ell(3, 8, 1, 1, g)
        ic.ell(6.5, 8.5, 0.8, 0.8, g)
    elif eid == 'jammed':
        ic.rect(1, 4, 7, 5, g)
        ic.rect(2, 1, 1, 3, g)
        ic.rect(6, 1, 1, 3, g)
        ic.rect(2, 1, 5, 1, g)
    elif eid == 'dry_flask':
        ic.ell(4.5, 6, 3.4, 3, g)
        ic.rect(3, 0, 3, 3, g)
        ic.L.ids[5:8, 3:6] = -1
    elif eid == 'butterfingers':
        ic.line((1, 1), (6, 6), 1.6, g)
        ic.ell(7.5, 7.5, 1.6, 1.6, g)
    elif eid == 'one_hit':          # skull
        ic.ell(4.5, 4, 3.6, 3.4, g)
        ic.rect(3, 6, 4, 3, g)
        ic.px(3, 4, P.INK)
        ic.px(6, 4, P.INK)
    elif eid == 'no_heal':
        heart(ic, 4.5, 4.6, 2.8, g)
        ic.line((1, 1), (8, 8), 1, ic.part('x', 'fx_dark', 1))
    elif eid == 'heavy_feet':
        ic.poly([(1, 1), (4, 1), (4, 6), (8, 6), (8, 8.5), (1, 8.5)], g)
        ic.ell(7, 2.5, 1.6, 1.6, ic.part('ball', 'gray', 1))
    elif eid == 'hunted':
        ic.ell(4.5, 4.5, 4, 2.6, g)
        ic.ell(4.5, 4.5, 1.4, 1.4, ic.part('pupil', 'fx_dark', 2))
    else:
        raise KeyError(eid)
    return ic.done()


def hud_frames():
    out = {}
    for kind in ('full', 'empty', 'blocked'):
        ic = Icon(10, 12)
        if kind == 'blocked':        # overlay: a red slash across the flask
            x = ic.part('x', 'ui:bad')
            ic.line((1, 10), (8, 1), 1.6, x)
            out['hud_flask_blocked'] = ic.done()
            continue
        glass = ic.part('glass', 'fx_heal' if kind == 'full' else 'gray', 0 if kind == 'full' else -1)
        ic.ell(4.5, 7.5, 3.6, 3.4, glass)
        ic.rect(3, 1, 3, 4, ic.part('neck', 'w_steel', -1))
        ic.rect(3, 0, 3, 1, ic.part('cork', 'w_wood', -1))
        if kind == 'empty':
            ic.L.ids[6:10, 2:7] = -1
        out[f'hud_flask_{kind}'] = ic.done()
    ic = Icon(8, 8)
    ic.ell(3.5, 3.5, 2.8, 2.8, ic.part('coin', 'w_gold'))
    out['hud_coin'] = ic.done()
    ic = Icon(7, 10)
    k = ic.part('key', 'w_gold')
    ic.ell(3, 2.5, 2.2, 2.2, k)
    ic.rect(2, 4, 2, 5, k)
    ic.rect(4, 6, 1, 1, k)
    ic.rect(4, 8, 1, 1, k)
    ic.px(3, 2, P.INK)
    out['hud_key'] = ic.done()
    ic = Icon(8, 10)
    p = ic.part('pick', 'w_steel')
    ic.rect(3, 4, 1, 5, p)
    ic.rect(1, 1, 5, 3, ic.part('grip', 'w_wood', -1))
    ic.rect(4, 7, 2, 1, p)
    out['hud_lockpick'] = ic.done()
    ic = Icon(8, 7)
    l = ic.part('link', 'w_gold')
    ic.ell(2.2, 3, 1.6, 1.6, l)
    ic.ell(4.8, 3, 1.6, 1.6, l)
    out['hud_link'] = ic.done()
    ic = Icon(8, 8)
    b = ic.part('body', 'w_steel')
    ic.rect(1, 3, 6, 4, b)
    ic.rect(2, 1, 1, 2, b)
    ic.rect(5, 1, 1, 2, b)
    ic.rect(2, 1, 4, 1, b)
    out['hud_lock'] = ic.done()
    ic = Icon(12, 12)
    ic.poly([(1, 3.5), (6, 3.5), (6, 0.5), (11, 6), (6, 11.5), (6, 8.5), (1, 8.5)], ic.part('a', 'fx_fire', -1))
    out['hud_dragon_arrow'] = ic.done()
    return out


def tint_frames():
    """White shapes, no outline (07 tints them)."""
    out = {}
    shapes6 = {
        'swordsman': [(3, 0), (6, 3), (3, 6), (0, 3)],        # diamond
        'tank': [(0, 0), (6, 0), (6, 6), (0, 6)],              # square
        'archer': [(3, 0), (6, 6), (0, 6)],                    # triangle
        'wizard': None,                                        # circle
    }
    for cid, pts in shapes6.items():
        ic = Icon(6, 6)
        w = ic.part('w', 'trim', -2)
        if pts:
            ic.poly(pts, w)
        else:
            ic.ell(2.5, 2.5, 3, 3, w)
        out[f'class_{cid}'] = _flat_white(ic)
    for k in ('cross', 'circle', 'square', 'triangle'):
        ic = Icon(7, 7)
        w = ic.part('w', 'trim', -2)
        if k == 'cross':
            ic.line((0.5, 0.5), (6.5, 6.5), 1.6, w)
            ic.line((6.5, 0.5), (0.5, 6.5), 1.6, w)
        elif k == 'circle':
            ic.ell(3, 3, 3.4, 3.4, w)
            ys, xs = np.mgrid[0:7, 0:7]
            ic.L.ids[(xs - 3) ** 2 + (ys - 3) ** 2 < 2.5] = -1
        elif k == 'square':
            ic.rect(0, 0, 7, 7, w)
            ic.L.ids[2:5, 2:5] = -1
        else:
            ic.poly([(3.5, 0), (7, 7), (0, 7)], w)
            ic.L.ids[4:6, 3:4] = -1
        out[f'prompt_ps_{k}'] = _flat_white(ic)
    return out


def _flat_white(ic):
    a = np.zeros((ic.h, ic.w, 4), np.uint8)
    a[ic.L.ids >= 0] = (255, 255, 255, 255)
    return Image.fromarray(a, 'RGBA')
