"""ART8: terrain tiles and parallax backgrounds of Stage 3 (kingdom, Rebel Camp) and Stage 4 (castle) (08 §3.7, §9, §10)."""
import math
import os

import numpy as np
from PIL import Image

from . import backgrounds as B
from . import palette as P
from . import tiles as T

TILE = 16
KG_ALLOWED = ['kg_stone', 'kg_roof', 'ink', 'white']
CS_ALLOWED = ['cs_stone', 'cs_trim', 'cs_carpet', 'ink', 'white']
BG_ALLOWED = {
    'kingdom': {0: ['kg_sky', 'kg_bg0'], 1: ['kg_bg1'], 2: ['kg_bg2']},
    'castle': {0: ['cs_sky', 'cs_bg0'], 1: ['cs_bg1'], 2: ['cs_bg2']},
    'village_rebel_camp': {0: ['rc_sky', 'kg_bg0', 'kg_bg1', 'vl_light', 'white'], 1: ['kg_bg0', 'kg_bg1', 'vl_light'],
                           2: ['kg_bg2', 'vl_light']},
}

_kg, _roof = P.RAMPS['kg_stone'], P.RAMPS['kg_roof']
T.THEMES['kingdom'] = {
    'brick': True, 'body': [_kg[0], _kg[0], _kg[0], _kg[1], _kg[2]],
    'cap': [_kg[1], _kg[2], _kg[3], _kg[4]],
    'wood': [_roof[0], _roof[1], _roof[2]], 'nail': _kg[4], 'tuft': _kg[4], 'spike': [_kg[2], _kg[3], _kg[4]]}
_cs, _trim, _car = P.RAMPS['cs_stone'], P.RAMPS['cs_trim'], P.RAMPS['cs_carpet']
T.THEMES['castle'] = {
    'brick': True, 'body': [_cs[0], _cs[0], _cs[1], _cs[2], _cs[3]],
    'cap': [_car[0], _car[1], _car[2], _trim[2]],
    'wood': [_trim[0], _trim[1], _trim[2]], 'nail': _trim[2], 'tuft': _trim[2], 'spike': [_cs[3], _cs[4], _trim[2]]}


def _empty():
    return np.zeros((TILE, TILE, 4), np.uint8)


def _px(a, x, y, col):
    if 0 <= x < TILE and 0 <= y < TILE:
        a[y, x, :3] = col
        a[y, x, 3] = 255


def _rect(a, x0, y0, x1, y1, col):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            _px(a, x, y, col)


# ---------------------------------------------------------------- body tiles (row 3, cols 12-15)

def cracked_wall(th):
    return T.draw_cracked_wall(th)


def blink_overlay(th):
    """Blink-block overlay: a pale outline with corner studs and a hollow centre (drawn over the block)."""
    a = _empty()
    c = th['body'][4]
    d = th['body'][1]
    for i in range(TILE):
        for (x, y) in ((i, 0), (i, 15), (0, i), (15, i)):
            _px(a, x, y, c if (i // 2) % 2 == 0 else d)
    for x, y in ((2, 2), (13, 2), (2, 13), (13, 13)):
        _px(a, x, y, c)
    return a


def collapsing(th, oneway):
    """Planks held by iron nails and cracked across the middle (08 §8: shakes, then falls)."""
    a = _empty()
    w = th['wood']
    rows = range(6) if oneway else range(16)
    for y in rows:
        for x in range(TILE):
            _px(a, x, y, w[1])
    for y in rows:
        if y % 5 == 0 or y == 5 and oneway:
            for x in range(TILE):
                _px(a, x, y, w[0])
    for x in (0, 5, 10, 15):                                   # plank gaps
        for y in rows:
            _px(a, x, y, w[0])
    for y in rows:
        _px(a, 2, y, w[2]) if y % 5 == 1 else None
    for x, y in ((2, 2), (7, 2), (12, 2)):
        _px(a, x, y, th['nail'])
    crack = [(8, 0), (7, 1), (8, 2), (9, 3), (8, 4), (7, 5)]
    for x, y in crack:
        if oneway or y < 6:
            _px(a, x, y, th['body'][0])
    return a


# ---------------------------------------------------------------- deco (row 7 cols 8-15, row 8 cols 0-7)

def top_deco_kg(v):
    a = _empty()
    k, r = _kg, _roof
    if v == 0:                                                  # rubble pile
        for (x, y, w_) in ((2, 15, 5), (4, 14, 3), (9, 15, 4), (10, 14, 2)):
            _rect(a, x, y, x + w_ - 1, y, k[3])
            _px(a, x, y, k[4])
    elif v == 1:                                                # barrel
        _rect(a, 5, 9, 11, 15, r[1])
        for y in (10, 14):
            _rect(a, 5, y, 11, y, k[2])
        _rect(a, 6, 9, 6, 15, r[2])
        _rect(a, 5, 9, 11, 9, r[0])
    elif v == 2:                                                # crate
        _rect(a, 3, 10, 12, 15, r[1])
        _rect(a, 3, 10, 12, 10, r[2])
        _rect(a, 3, 15, 12, 15, r[0])
        for i in range(6):
            _px(a, 3 + i, 10 + i, r[0])
            _px(a, 12 - i, 10 + i, r[0])
    elif v == 3:                                                # small stones
        for (x, w_) in ((3, 3), (9, 2)):
            _rect(a, x, 14, x + w_, 15, k[3])
            _px(a, x, 14, k[4])
    elif v == 4:                                                # broken pillar stub
        _rect(a, 5, 9, 10, 15, k[3])
        _rect(a, 5, 9, 6, 15, k[4])
        _rect(a, 9, 9, 10, 15, k[2])
        _rect(a, 4, 15, 11, 15, k[1])
        _rect(a, 8, 8, 10, 8, k[3])
    elif v == 5:                                                # sandbags
        for (x, y) in ((2, 14), (7, 14), (4, 12)):
            _rect(a, x, y, x + 4, y + 1, r[2])
            _rect(a, x, y + 1, x + 4, y + 1, r[1])
    elif v == 6:                                                # flat rubble
        for x in range(2, 14, 2):
            _px(a, x, 15, k[3])
            if x % 4 == 2:
                _px(a, x, 14, k[4])
    else:                                                       # banner pole with a red cloth
        _rect(a, 7, 4, 7, 15, k[2])
        _rect(a, 8, 4, 12, 9, r[1])
        _rect(a, 8, 4, 12, 4, r[2])
        _px(a, 12, 9, r[0])
        _px(a, 11, 10, r[1])
    return a


def hanging_deco_kg(v):
    a = _empty()
    k, r = _kg, _roof
    if v in (0, 1):                                             # chains
        for x0 in ((4, 11) if v == 0 else (7,)):
            for y in range(0, 9 + v * 4):
                _px(a, x0 + (1 if y % 2 else 0), y, k[4] if y % 2 else k[3])
    elif v in (2, 3):                                           # hanging banner strips
        x0 = 4 if v == 2 else 8
        _rect(a, x0, 0, x0 + 3, 9 - v, r[1])
        _rect(a, x0, 0, x0, 9 - v, r[2])
        _px(a, x0 + 1, 10 - v, r[1])
        _px(a, x0 + 2, 10 - v, r[0])
    elif v == 4:                                                # cobweb corner
        for i in range(6):
            _px(a, i, 0, k[4])
            _px(a, 0, i, k[4])
            _px(a, i, i // 2 + 1, k[3])
    elif v == 5:                                                # crumbling ceiling
        for x in range(1, 15, 2):
            for y in range(1 + (x % 3)):
                _px(a, x, y, k[2])
    elif v == 6:                                                # drip stones
        for x in (3, 7, 11):
            for y in range(2 + x % 3):
                _px(a, x, y, k[3] if y else k[4])
    else:                                                       # chain with a shackle
        for y in range(7):
            _px(a, 8, y, k[4] if y % 2 else k[3])
        _rect(a, 6, 7, 10, 8, k[3])
        _rect(a, 6, 9, 6, 11, k[3])
        _rect(a, 10, 9, 10, 11, k[3])
    return a


def top_deco_cs(v):
    a = _empty()
    c, t, r = _cs, _trim, _car
    if v == 0:                                                  # candle stand
        _rect(a, 7, 10, 8, 15, t[1])
        _rect(a, 5, 15, 10, 15, t[0])
        _rect(a, 6, 9, 9, 9, t[2])
        _rect(a, 7, 6, 8, 8, P.RAMPS['white'][0])
        _px(a, 7, 5, t[2])
    elif v == 1:                                                # urn
        _rect(a, 5, 11, 10, 15, t[1])
        _rect(a, 6, 9, 9, 10, t[1])
        _rect(a, 5, 11, 5, 15, t[2])
        _rect(a, 5, 9, 10, 9, t[2])
    elif v == 2:                                                # rubble
        for (x, w_) in ((2, 4), (9, 3)):
            _rect(a, x, 15, x + w_, 15, c[3])
            _px(a, x, 14, c[4])
    elif v == 3:                                                # armor stand
        _rect(a, 7, 6, 8, 15, c[3])
        _rect(a, 5, 6, 10, 9, c[4])
        _rect(a, 6, 3, 9, 5, c[4])
        _rect(a, 5, 15, 10, 15, c[2])
    elif v == 4:                                                # carpet roll
        _rect(a, 3, 12, 12, 15, r[1])
        _rect(a, 3, 12, 12, 12, r[2])
        _rect(a, 3, 13, 3, 15, t[2])
        _rect(a, 12, 13, 12, 15, t[2])
    elif v == 5:                                                # skull
        _rect(a, 6, 12, 9, 15, c[4])
        _px(a, 7, 13, c[0])
        _px(a, 9, 13, c[0])
    elif v == 6:                                                # gold coins
        for (x, y) in ((4, 15), (6, 15), (5, 14), (10, 15)):
            _px(a, x, y, t[2])
    else:                                                       # throne stub
        _rect(a, 4, 8, 11, 15, r[1])
        _rect(a, 4, 6, 5, 15, t[1])
        _rect(a, 10, 6, 11, 15, t[1])
        _rect(a, 4, 5, 5, 5, t[2])
        _rect(a, 10, 5, 11, 5, t[2])
    return a


def hanging_deco_cs(v):
    a = _empty()
    c, t, r = _cs, _trim, _car
    if v in (0, 1):                                             # chandelier on a chain
        for y in range(0, 5 + v * 2):
            _px(a, 8, y, t[1])
        y0 = 5 + v * 2
        _rect(a, 4, y0, 12, y0, t[2])
        for x in (4, 8, 12):
            _rect(a, x, y0 - 2, x, y0 - 1, P.RAMPS['white'][0])
    elif v in (2, 3):                                           # banners
        x0 = 3 if v == 2 else 9
        _rect(a, x0, 0, x0 + 4, 11 - v, r[1])
        _rect(a, x0, 0, x0 + 4, 0, t[2])
        _rect(a, x0 + 2, 4, x0 + 2, 6, t[2])
        _px(a, x0 + 2, 12 - v, r[0])
    elif v == 4:                                                # cobweb
        for i in range(7):
            _px(a, i, 0, c[4])
            _px(a, 0, i, c[4])
            _px(a, i, i // 2 + 1, c[3])
    elif v == 5:                                                # drip stones
        for x in (3, 7, 12):
            for y in range(2 + x % 3):
                _px(a, x, y, c[3])
    elif v == 6:                                                # chains
        for x0 in (4, 10):
            for y in range(0, 10):
                _px(a, x0 + (y % 2), y, c[4] if y % 2 else c[3])
    else:                                                       # trim molding
        _rect(a, 0, 0, 15, 1, t[1])
        for x in range(0, 16, 4):
            _px(a, x, 2, t[2])
    return a


def extra_cells(set_name, th):
    """Row 3 cols 12-15 (cracked wall, blink overlay, collapsing solid / one-way) and both deco rows."""
    cells = {(12, 3): cracked_wall(th), (13, 3): blink_overlay(th),
             (14, 3): collapsing(th, False), (15, 3): collapsing(th, True)}
    top, hang = (top_deco_kg, hanging_deco_kg) if set_name == 'kingdom' else (top_deco_cs, hanging_deco_cs)
    for v in range(8):
        cells[(8 + v, 7)] = top(v)
        cells[(v, 8)] = hang(v)
    return cells


# ---------------------------------------------------------------- backgrounds

W, H = B.W, B.H


def _castle_battlements(img, xs, x0, x1, ytop, col, step=10):
    """Crenellated wall top over [x0, x1) (periodic)."""
    for x in range(int(x0), int(x1), step * 2):
        B._box(img, xs, x % W, x % W + step, ytop - 6, ytop + 1, col)


def render_kingdom(layer, width=W):
    xs = np.arange(width)
    img = np.zeros((H, width, 4), np.uint8)
    ys = np.arange(H)[:, None]
    sky, c0, c1, c2 = P.RAMPS['kg_sky'], P.RAMPS['kg_bg0'], P.RAMPS['kg_bg1'], P.RAMPS['kg_bg2']
    g = B._rng(f'bg_kingdom_{layer}')
    if layer == 0:                                     # sky + a far city with towers
        for i, col in enumerate(sky):
            B._paint(img, np.broadcast_to((ys >= i * 60), (H, width)), col)
        for k in range(10):                            # distant towers with cone roofs
            cx = k * W / 10 + g.uniform(-14, 14)
            wd, hg = g.uniform(14, 26), g.uniform(60, 130)
            B._box(img, xs, (cx - wd / 2) % W, (cx - wd / 2) % W + wd, 292 - hg, 300, c0[0])
            B._tri(img, xs, cx, wd / 2 + 3, 293 - hg, 22 + wd * 0.4, c0[1])
        B._fill_below(img, xs, 298 + B._wave(xs, [(2, 4, 0.5), (6, 2, 1.0)]), c0[0], c0[1], rim=2)
        return Image.fromarray(img, 'RGBA')
    if layer == 1:                                     # curtain walls with crenellations and gate towers
        B._box(img, xs, 0, W, 292, 330, c1[0])
        B._box(img, xs, 0, W, 292, 295, c1[1])
        _castle_battlements(img, xs, 0, W, 292, c1[0])
        for k in range(5):
            cx = k * W / 5 + 40
            B._box(img, xs, cx % W, cx % W + 30, 240 + (k % 2) * 14, 296, c1[0])
            B._box(img, xs, cx % W, cx % W + 30, 240 + (k % 2) * 14, 243 + (k % 2) * 14, c1[1])
            _castle_battlements(img, xs, cx, cx + 30, 240 + (k % 2) * 14, c1[0], 6)
            B._box(img, xs, (cx + 13) % W, (cx + 13) % W + 4, 256 + (k % 2) * 14, 268 + (k % 2) * 14, c1[1])   # arrow slit
        return Image.fromarray(img, 'RGBA')
    dark, lit = c2                                     # layer 2: houses with steep roofs
    B._fill_below(img, xs, 338 + B._wave(xs, [(3, 2, 1.0), (8, 1.5, 0.5)]), dark, lit, rim=2)
    for k in range(7):
        cx = k * W / 7 + g.uniform(-14, 14)
        wd, hg = g.uniform(34, 52), g.uniform(34, 52)
        B._box(img, xs, (cx - wd / 2) % W, (cx - wd / 2) % W + wd, 340 - hg, 344, dark)
        B._tri(img, xs, cx, wd / 2 + 6, 341 - hg, 26, dark)
        B._box(img, xs, (cx - wd / 4) % W, (cx - wd / 4) % W + 5, 340 - hg + 8, 340 - hg + 15, lit)
        B._box(img, xs, (cx + wd / 8) % W, (cx + wd / 8) % W + 5, 340 - hg + 8, 340 - hg + 15, lit)
    return Image.fromarray(img, 'RGBA')


def _arch(img, xs, cx, half, y_base, y_top, col):
    """A stone arch opening (filled `col`) between y_top (apex) and y_base, periodic."""
    ys = np.arange(img.shape[0])[:, None]
    d = B._wrap(xs[None, :] - cx)
    r = half
    cy = y_top + r
    inside = (np.abs(d) < half) & (((ys >= cy) & (ys < y_base)) | ((ys < cy) & (d * d + (ys - cy) ** 2 < r * r) & (ys >= y_top)))
    B._paint(img, inside, col)


def render_castle(layer, width=W):
    xs = np.arange(width)
    img = np.zeros((H, width, 4), np.uint8)
    ys = np.arange(H)[:, None]
    sky, c0, c1, c2 = P.RAMPS['cs_sky'], P.RAMPS['cs_bg0'], P.RAMPS['cs_bg1'], P.RAMPS['cs_bg2']
    if layer == 0:                                     # hall wall with tall lit arched windows
        for i, col in enumerate(sky):
            B._paint(img, np.broadcast_to((ys >= i * 60), (H, width)), col)
        B._box(img, xs, 0, W, 60, H, c0[0])
        for k in range(8):
            cx = 40 + k * 80
            _arch(img, xs, cx, 14, 250, 110, c0[1])
            B._box(img, xs, cx - 1, cx + 1, 110, 250, c0[0])          # window mullion
            B._box(img, xs, cx - 14, cx + 14, 170, 172, c0[0])
        return Image.fromarray(img, 'RGBA')
    if layer == 1:                                     # arcade of round arches
        B._box(img, xs, 0, W, 40, H, c1[0])
        for k in range(5):
            cx = 64 + k * 128
            _arch(img, xs, cx, 46, 330, 130, c1[1])
            B._box(img, xs, cx - 46, cx - 40, 130, 330, c1[0])
        B._box(img, xs, 0, W, 130, 134, c1[0])
        for x in range(0, 640, 16):                                    # dentil frieze
            B._box(img, xs, x, x + 8, 134, 140, c1[1])
        return Image.fromarray(img, 'RGBA')
    dark, lit = c2                                     # layer 2: pillars with hanging banners
    B._fill_below(img, xs, np.full(width, 340.0), dark, lit, rim=2)
    for k in range(4):
        cx = 60 + k * 160
        B._box(img, xs, cx - 9, cx + 9, 20, 342, dark)
        B._box(img, xs, cx - 9, cx - 6, 20, 342, lit)
        B._box(img, xs, cx - 13, cx + 13, 14, 24, dark)
        B._box(img, xs, cx - 13, cx + 13, 330, 342, dark)
        B._box(img, xs, cx + 28, cx + 52, 40, 150, dark)                # banner
        B._tri(img, xs, cx + 40, 12, 176, 26, dark)
        B._box(img, xs, cx + 36, cx + 44, 70, 120, lit)
    return Image.fromarray(img, 'RGBA')


def render_rebel_camp(layer, width=W):
    """Rebel Camp (08 §3.7): a night camp in the kingdom's shadow: stars, far walls, tents with lit doors, a campfire."""
    xs = np.arange(width)
    img = np.zeros((H, width, 4), np.uint8)
    ys = np.arange(H)[:, None]
    c0, c1, c2 = P.RAMPS['kg_bg0'], P.RAMPS['kg_bg1'], P.RAMPS['kg_bg2']
    light = P.RAMPS['vl_light']
    g = B._rng(f'bg_rebel_{layer}')
    if layer == 0:
        for i, col in enumerate(P.RAMPS['rc_sky']):
            B._paint(img, np.broadcast_to((ys >= i * 44), (H, width)), col)
        for _ in range(60):                                            # stars
            sx, sy = int(g.integers(0, W)), int(g.integers(0, 170))
            img[sy, sx, :3] = P.RAMPS['white'][0]
            img[sy, sx, 3] = 255
        for k in range(6):                                             # the kingdom's walls far away
            cx = k * W / 6 + g.uniform(-14, 14)
            wd, hg = g.uniform(30, 46), g.uniform(26, 70)
            B._box(img, xs, (cx - wd / 2) % W, (cx - wd / 2) % W + wd, 262 - hg, 270, c0[0])
            _castle_battlements(img, xs, cx - wd / 2, cx + wd / 2, 262 - hg, c0[0], 5)
        B._fill_below(img, xs, 262 + B._wave(xs, [(2, 5, 0.6), (5, 3, 1.4)]), c0[0], c0[1], rim=2)
        return Image.fromarray(img, 'RGBA')
    if layer == 1:
        B._fill_below(img, xs, 300 + B._wave(xs, [(2, 3, 0.4), (5, 2, 1.3)]), c1[0], c1[1], rim=2)
        for k in range(7):                                             # tents with a lit doorway
            cx = k * W / 7 + g.uniform(-10, 10)
            wd = g.uniform(40, 56)
            B._tri(img, xs, cx, wd / 2, 302, 36, c1[0])
            B._tri(img, xs, cx - wd * 0.12, wd * 0.18, 302, 20, light[0])
            B._box(img, xs, (cx + wd / 2 - 2) % W, (cx + wd / 2) % W + 2, 258, 302, c1[1])        # tent pole
        return Image.fromarray(img, 'RGBA')
    dark, lit = c2
    B._fill_below(img, xs, 338 + B._wave(xs, [(3, 2, 1.0), (8, 1.5, 0.5)]), dark, lit, rim=2)
    for k in range(4):                                                 # watch posts with torches
        px = 70 + k * 160
        B._box(img, xs, px, px + 4, 262, 340, dark)
        B._box(img, xs, px - 6, px + 10, 258, 262, dark)
        B._box(img, xs, px - 4, px, 264, 270, light[1])
        B._box(img, xs, px - 3, px - 1, 265, 268, light[0])
    return Image.fromarray(img, 'RGBA')


def render(set_name, layer):
    return {'kingdom': render_kingdom, 'castle': render_castle, 'village_rebel_camp': render_rebel_camp}[set_name](layer)


# ---------------------------------------------------------------- build

DEMO_ROWS = ['..........................', '..........................', '..........................',
             '...............######.....', '..###....#.....######.....', '..###....#......####......',
             '.........#................', '..........................', '##########################',
             '##########################']


def build(assets, preview):
    os.makedirs(os.path.join(assets, 'tiles'), exist_ok=True)
    grid = np.array([[c == '#' for c in r] for r in DEMO_ROWS])
    for sn, allowed in (('kingdom', KG_ALLOWED), ('castle', CS_ALLOWED)):
        sheet = T.build_sheet(sn)
        P.check_palette_lock(sheet, P.allowed(allowed), f'tiles_{sn}')
        sheet.save(os.path.join(assets, 'tiles', f'tiles_{sn}.png'))
        sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(os.path.join(preview, f'tiles_{sn}_sheet.png'))
        layers = []
        for i in range(3):
            img = render(sn, i)
            P.check_palette_lock(img, P.allowed(BG_ALLOWED[sn][i]), f'bg_{sn}_{i}')
            img.save(os.path.join(assets, 'bg', f'bg_{sn}_{i}.png'))
            layers.append(img)
        stack = Image.new('RGBA', (640, 360))
        for lyr in layers:
            stack.alpha_composite(lyr)
        stack.resize((1280, 720), Image.NEAREST).save(os.path.join(preview, f'bg_{sn}_stack.png'))
        h, w = grid.shape
        idx = T.autotile(grid)
        scene = Image.new('RGBA', (w * 16, h * 16))
        for lyr in layers:
            scene.alpha_composite(lyr.crop((0, 360 - h * 16, w * 16, 360)))
        for y in range(h):
            for x in range(w):
                if idx[y, x] >= 0:
                    scene.alpha_composite(T.cell_image(sheet, idx[y, x]), (x * 16, y * 16))
        scene.resize((w * 48, h * 48), Image.NEAREST).save(os.path.join(preview, f'tiles_{sn}_demo.png'))
    st = Image.new('RGBA', (640, 360))
    for i in range(3):
        img = render('village_rebel_camp', i)
        P.check_palette_lock(img, P.allowed(BG_ALLOWED['village_rebel_camp'][i]), f'bg_village_rebel_camp_{i}')
        img.save(os.path.join(assets, 'bg', f'bg_village_rebel_camp_{i}.png'))
        st.alpha_composite(img)
    st.resize((1280, 720), Image.NEAREST).save(os.path.join(preview, 'bg_village_rebel_camp_stack.png'))
