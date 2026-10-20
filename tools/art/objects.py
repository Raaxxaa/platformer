"""Stage 1 level objects (08 §8): arena door, timed door, guide arrows. Atlas `objects`."""
import numpy as np

from . import palette as P
from . import raster as R

ALLOWED = ['ink', 'white', 'gray', 'vl_wood', 'w_wood', 'w_steel', 'fx_poison', 'fx_heal']


def _piece(draw, outline_top, outline_bottom):
    """16 × 16 door piece. Ink only on the outer sides (and the top of a cap / bottom of a bottom piece),
    so stacked pieces join without seams."""
    L = R.PartLayer(16, 16)
    draw(L)
    c = R.auto_shade(L)
    a = c.a
    ink = P.INK
    op = a >= 0
    for y in range(16):
        xs = np.nonzero(op[y])[0]
        if len(xs):
            a[y, xs.min() - 1] = ink
            a[y, xs.max() + 1] = ink
    if outline_top:
        a[0, op[1]] = ink
    if outline_bottom:
        a[15, op[14]] = ink
    return c


def _part(L, name, ramp, shift=0):
    if name not in L.index:
        L.add_part(name, P.ramp_ids(ramp), shift)
    return name


def arena_door(kind):
    """Heavy wooden portcullis with iron bands."""
    def draw(L):
        back = _part(L, 'back', 'vl_wood', 2)
        wood = _part(L, 'wood', 'vl_wood')
        band = _part(L, 'band', 'w_steel', 1)
        top = 1 if kind == 'cap' else 0
        bot = 14 if kind == 'bottom' else 16
        R.fill_rect(L, 1, top, 14, bot - top, back)
        for x in (1, 5, 9, 12):                       # planks
            R.fill_rect(L, x, top, 3, bot - top, wood)
        if kind == 'cap':
            R.fill_rect(L, 1, 1, 14, 4, band)
        elif kind == 'mid':
            R.fill_rect(L, 1, 6, 14, 3, band)
        else:
            R.fill_rect(L, 1, 2, 14, 3, band)
            for x in (2, 6, 10, 14):                  # iron teeth at the bottom
                R.fill_rect(L, x, 13, 1, 3, band)
    c = _piece(draw, kind == 'cap', kind == 'bottom')
    if kind != 'bottom':
        for (y, x) in ((7, 3), (7, 11)) if kind == 'mid' else ((2, 3), (2, 11)):
            c.a[y, x] = P.sid(P.RAMPS['w_steel'][3])  # rivets
    return c


def timed_door(kind, state=None):
    """Stone door; the cap holds 3 lamps (pending dim green, open bright green, missed red)."""
    def draw(L):
        st = _part(L, 'stone', 'gray', -1)
        top = 1 if kind == 'cap' else 0
        bot = 15 if kind == 'bottom' else 16
        R.fill_rect(L, 1, top, 14, bot - top, st)
    c = _piece(draw, kind == 'cap', kind == 'bottom')
    mortar = P.sid(P.RAMPS['gray'][1])
    for y in (7, 15) if kind != 'cap' else (12,):
        for x in range(2, 14):
            if c.a[y, x] >= 0 and c.a[y, x] != P.INK:
                c.a[y, x] = mortar
    for x in (8,) if kind != 'cap' else ():
        for y in range(0, 7):
            c.a[y, x] = mortar
    if kind == 'cap':
        col = {'pending': ('fx_poison', 1, 1), 'open': ('fx_poison', 2, 3), 'missed': ('fx_heal', 1, 2)}[state]
        for lx in (3, 7, 11):
            for dy in range(3):
                for dx in range(3):
                    c.a[4 + dy, lx - 1 + dx] = P.INK if (dx in (0, 2) and dy in (0, 2)) else P.sid(
                        P.RAMPS[col[0]][col[1]])
            c.a[5, lx] = P.sid(P.RAMPS[col[0]][col[2]])
    return c


def _arrow_right():
    L = R.PartLayer(16, 16)
    wood = _part(L, 'wood', 'w_wood', -1)
    R.fill_rect(L, 2, 6, 7, 4, wood)
    R.fill_polygon(L, [(8.5, 2.5), (14.5, 8), (8.5, 13.5)], wood)
    c = R.auto_shade(L)
    R.outline(c, P.INK)
    return c


def _arrow_diag():
    L = R.PartLayer(16, 16)
    wood = _part(L, 'wood', 'w_wood', -1)
    # same arrow turned 45° counter-clockwise (pointing up-right)
    def rot(p):
        x, y = p[0] - 8, p[1] - 8
        a = np.radians(45)
        return (8 + x * np.cos(a) + y * np.sin(a), 8 - x * np.sin(a) + y * np.cos(a))
    shaft = [(2, 6), (9, 6), (9, 10), (2, 10)]
    head = [(8.5, 2.5), (14.5, 8), (8.5, 13.5)]
    R.fill_polygon(L, [rot(p) for p in shaft], wood)
    R.fill_polygon(L, [rot(p) for p in head], wood)
    c = R.auto_shade(L)
    R.outline(c, P.INK)
    return c


def arrows():
    right, diag = _arrow_right(), _arrow_diag()
    out = {}
    for i in range(8):
        base = right if i % 2 == 0 else diag
        k = i // 2
        img = base.to_image()
        out[f'guide_arrow_{i:02d}'] = img.rotate(90 * k) if k else img
    return out


def frames():
    fr = {}
    for kind in ('cap', 'mid', 'bottom'):
        fr[f'arena_door_{kind}_00'] = arena_door(kind).to_image()
    fr['timed_door_mid_00'] = timed_door('mid').to_image()
    fr['timed_door_bottom_00'] = timed_door('bottom').to_image()
    for st in ('pending', 'open', 'missed'):
        fr[f'timed_door_cap_{st}_00'] = timed_door('cap', st).to_image()
    fr.update(arrows())
    fr.update(stage2_frames())
    return fr


def minecart(frame):
    """Minecart 32 x 24 (08 §8): a wooden bucket with iron bands on two wheels; `roll` has 2 frames."""
    import math
    L = R.PartLayer(32, 24)
    wood = _part(L, 'wood', 'vl_wood')
    band = _part(L, 'band', 'gray', 1)
    wheel = _part(L, 'wheel', 'gray', 1)
    hub = _part(L, 'hub', 'gray')
    spoke = _part(L, 'spoke', 'gray', 2)
    plank = _part(L, 'plank', 'vl_wood', 2)
    R.fill_polygon(L, [(2, 4), (30, 4), (27, 18), (5, 18)], wood)
    R.fill_rect(L, 2, 4, 28, 2, band)               # rim
    R.fill_rect(L, 5, 15, 22, 2, band)              # lower band
    for x, d in ((10, -1), (16, 0), (22, 1)):       # planks
        R.line(L, (x, 7), (x + d, 14), plank)
    for cx in (9, 23):
        R.ellipse(L, cx, 19, 4.2, 4.2, wheel)
        R.ellipse(L, cx, 19, 1.4, 1.4, hub)
        for k in range(2):
            a = math.radians(frame * 45 + k * 90)
            R.line(L, (cx, 19), (round(cx + 3 * math.cos(a)), round(19 + 3 * math.sin(a))), spoke)
    c = R.auto_shade(L)
    R.outline(c, P.INK)
    return c


def stage2_frames():
    return {f'minecart_roll_{i:02d}': minecart(i).to_image() for i in range(2)}
