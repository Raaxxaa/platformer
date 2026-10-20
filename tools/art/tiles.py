"""Blob autotiling and the terrain tilesets (08 §9.1–9.3)."""
import math
import zlib

import numpy as np
from PIL import Image

from . import palette as P

N, NE, E, SE, S, SW, W, NW = 1, 2, 4, 8, 16, 32, 64, 128
TILE = 16
COLS, ROWS = 16, 9
MARGIN, SPACING = 1, 2
ALLOWED = ['pl_soil', 'pl_grass', 'pl_wood', 'white']
MT_ALLOWED = ['mt_rock', 'mt_snow', 'mt_ice', 'ink']


def _theme(body, cap, wood, nail, tuft):
    return {'body': P.RAMPS[body], 'cap': P.RAMPS[cap], 'wood': P.RAMPS[wood], 'nail': nail, 'tuft': tuft}


# body = 5 colors dark -> light; cap = 4 colors (side rim, ragged edge, cap, highlight); wood = one-way 3 colors
THEMES = {
    'plains': _theme('pl_soil', 'pl_grass', 'pl_wood', P.RAMPS['pl_soil'][4], P.RAMPS['pl_grass'][3]),
}
THEMES['mountains'] = {
    'body': [P.RAMPS['mt_rock'][i] for i in (0, 0, 1, 2, 3)],
    'cap': [P.RAMPS['mt_rock'][1], P.RAMPS['mt_snow'][0], P.RAMPS['mt_snow'][1], P.RAMPS['mt_snow'][2]],
    'wood': P.RAMPS['mt_rock'][1:4], 'nail': P.RAMPS['mt_snow'][2], 'tuft': P.RAMPS['mt_snow'][2],
    'spike': P.RAMPS['mt_rock'][2:5]}
_ice = P.RAMPS['mt_ice']
THEMES['ice'] = {'streaks': True, 'body': [_ice[0], _ice[0], _ice[1], _ice[2], _ice[3]], 'cap': [_ice[0], _ice[1], _ice[3], _ice[3]],
                 'wood': _ice[:3], 'nail': _ice[3], 'tuft': _ice[3]}


def reduce_mask(m):
    """Keep each diagonal bit only if both of its neighbouring cardinal bits are set (08 §9.2)."""
    out = m & (N | E | S | W)
    for d, a, b in ((NE, N, E), (SE, S, E), (SW, S, W), (NW, N, W)):
        if m & d and m & a and m & b:
            out |= d
    return out


BLOB_MASKS = sorted({reduce_mask(m) for m in range(256)})
BLOB_INDEX = {m: i for i, m in enumerate(BLOB_MASKS)}


def rng(asset_id):
    return np.random.default_rng(zlib.crc32(asset_id.encode()))


def _soil(seed, th):
    """16 × 16 soil texture: base shade with a few darker pebbles and lighter grains."""
    g = rng(seed)
    t = np.zeros((TILE, TILE, 3), np.uint8)
    body = th['body']
    t[:, :] = body[2]
    for _ in range(5):
        x, y = g.integers(1, 14), g.integers(4, 14)
        t[y, x] = th['body'][1]
        t[y, x + 1] = th['body'][1]
        t[y - 1, x] = th['body'][3]
    for _ in range(4):
        x, y = g.integers(0, 16), g.integers(3, 16)
        t[y, x] = th['body'][3]
    return t


def draw_blob(set_name, mask, variant=0, theme=None):
    th = THEMES[theme or set_name]
    m = reduce_mask(mask)
    t = _soil(f'tiles_{set_name}_{m}_{variant}', th)
    g = rng(f'tiles_{set_name}_{m}_{variant}_cap')
    if th.get('streaks'):
        for _ in range(3):
            x0, y0 = int(g.integers(0, 11)), int(g.integers(1, 11))
            for d in range(4):
                t[y0 + d, x0 + d] = th['body'][3]
            t[y0 + 1, x0 + 2] = th['body'][4]
    if variant == 1:        # buried stone
        t[8:11, 5:10] = th['body'][3]
        t[11, 6:10] = th['body'][1]
        t[8, 6:9] = th['body'][4]
    elif variant == 2:      # root
        for x in range(2, 14):
            y = 9 + int(round(1.5 * np.sin(x / 2.0)))
            t[y, x] = th['wood'][1]
        t[10, 13] = th['wood'][0]
    elif variant == 3:      # darker clump
        t[5:9, 9:13] = th['body'][1]
        t[5, 10:12] = th['body'][2]
    elif variant == 4:      # bone-white grains
        for (x, y) in ((3, 4), (4, 12), (11, 6), (12, 13), (7, 9)):
            t[y, x] = th['body'][4]
    if not m & N:
        t[0, :] = th['cap'][3]                 # 1 px highlight
        t[1:3, :] = th['cap'][2]               # cap
        t[3, :] = th['cap'][1]
        for x in range(TILE):                       # ragged edge hanging into the soil
            d = int(g.integers(0, 3))
            if d:
                t[4:4 + d - 1, x] = th['cap'][1]
                t[3 + d - 1, x] = th['cap'][1]
            if g.integers(0, 4) == 0:
                t[1, x] = th['cap'][3]
    rim_soil, rim_grass = th['body'][0], th['cap'][0]

    def rim(sl_y, sl_x):
        t[sl_y, sl_x] = rim_soil

    if not m & W:
        rim(slice(0, TILE), 0)
        if not m & N:
            t[0:4, 0] = rim_grass
    if not m & E:
        rim(slice(0, TILE), TILE - 1)
        if not m & N:
            t[0:4, TILE - 1] = rim_grass
    if not m & S:
        rim(TILE - 1, slice(0, TILE))
    # inner corners: 3 × 3 notch that continues the neighbours' cap (top) or rim (bottom)
    for d, a_, b_, top, left in ((NE, N, E, True, False), (NW, N, W, True, True),
                                 (SE, S, E, False, False), (SW, S, W, False, True)):
        if m & a_ and m & b_ and not m & d:
            xs = slice(0, 3) if left else slice(13, 16)
            if top:
                t[0, xs] = th['cap'][3]
                t[1:3, xs] = th['cap'][2]
                t[3, xs] = th['cap'][1]
                t[0:3, 2 if left else 13] = th['cap'][1]
                t[0:4, 3 if left else 12] = th['cap'][0]
            else:
                t[15, xs] = rim_soil
                t[13:16, 2 if left else 13] = rim_soil
    a = np.full((TILE, TILE, 4), 255, np.uint8)
    a[:, :, :3] = t
    return a


def _empty():
    return np.zeros((TILE, TILE, 4), np.uint8)


def _put(a, y, x, col):
    a[y, x, :3] = col
    a[y, x, 3] = 255


def draw_oneway(kind, th):
    """kind: 'left', 'middle', 'right', 'single'. Only the top 6 px are filled (08 §9.3)."""
    a = _empty()
    for y in range(6):
        shade = {0: 2, 5: 0}.get(y, 1)
        for x in range(TILE):
            _put(a, y, x, th['wood'][shade])
    for x in (3, 9, 14):                             # grain
        _put(a, 2, x, th['wood'][0])
        _put(a, 3, x - 1, th['wood'][0])
    for x in range(0, TILE, 2):                       # grass tufts on top
        _put(a, 0, x, th['cap'][3] if x % 4 == 0 else th['wood'][2])
    ends = {'left': (0,), 'right': (TILE - 1,), 'single': (0, TILE - 1), 'middle': ()}[kind]
    for x in ends:
        for y in range(6):
            _put(a, y, x, th['wood'][0])
        a[0, x, 3] = 0
        a[5, x, 3] = 0
    if kind != 'middle':                              # nails at the ends
        for x in ends:
            nx = 2 if x == 0 else TILE - 3
            _put(a, 2, nx, th['body'][4])
    return a


def draw_spikes(direction, th):
    """Sharpened stakes; 'up' pointing up, others rotated."""
    a = _empty()
    for cx in (2, 6, 10, 14):
        for y in range(5, TILE):
            half = min(2, (y - 5) // 3)
            for x in range(cx - half - 1, cx + half + 1):
                if 0 <= x < TILE:
                    shade = 2 if x < cx - half else (0 if x == cx + half else 1)
                    _put(a, y, x, th.get('spike', th['wood'])[shade])
        _put(a, 5, cx - 1, th['nail'])
        _put(a, 6, cx - 1, th['nail'])
    for x in range(TILE):
        _put(a, TILE - 1, x, th['body'][0])
    k = {'up': 0, 'right': 3, 'down': 2, 'left': 1}[direction]
    return np.ascontiguousarray(np.rot90(a, k))


def _px(a, x, y, col):
    if 0 <= x < TILE and 0 <= y < TILE:
        a[y, x, :3] = col
        a[y, x, 3] = 255


def top_deco(v):
    """Plains top decorations (08 §9.1 row 7, cols 8–15), standing on the cell's bottom edge. No outline."""
    a = _empty()
    g = rng(f'deco_top_{v}')
    gr, so, wd = P.RAMPS['pl_grass'], P.RAMPS['pl_soil'], P.RAMPS['pl_wood']
    if v in (0, 1, 2):                                    # grass tufts
        for k in range(3 + v):
            x = int(g.integers(2, 14))
            h = int(g.integers(3, 7))
            for y in range(h):
                _px(a, x + (1 if y > h - 2 and k % 2 else 0), 15 - y, gr[2] if y < h - 1 else gr[3])
            _px(a, x - 1, 15, gr[1])
    elif v in (3, 4):                                     # flowers: white daisies / tan buttercups
        petal = P.RAMPS['white'][0] if v == 3 else so[4]
        for x0 in (4, 10) if v == 3 else (7,):
            for y in range(10, 16):
                _px(a, x0, y, gr[2])
            for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                _px(a, x0 + dx, 9 + dy, petal)
            _px(a, x0, 9, so[3] if v == 3 else wd[1])
    elif v == 5:                                          # small stones
        for (x, w, h) in ((3, 4, 3), (9, 3, 2)):
            for y in range(h):
                for dx in range(w):
                    _px(a, x + dx, 15 - y, so[3] if y == h - 1 else so[1])
    elif v == 6:                                          # mushrooms
        for x0, h in ((5, 4), (10, 3)):
            for y in range(h):
                _px(a, x0, 15 - y, so[4])
            for dx in (-2, -1, 0, 1, 2):
                _px(a, x0 + dx, 15 - h, wd[2] if abs(dx) < 2 else wd[1])
            for dx in (-1, 0, 1):
                _px(a, x0 + dx, 14 - h, wd[2])
    else:                                                 # a twig with a leaf
        for x in range(3, 13):
            _px(a, x, 15 - (x - 3) // 4, wd[1])
        _px(a, 9, 12, gr[3])
        _px(a, 10, 12, gr[2])
    return a


def hanging_deco(v):
    """Plains hanging decorations (08 §9.1 row 8, cols 0–7), hanging from the cell's top edge."""
    a = _empty()
    g = rng(f'deco_hang_{v}')
    gr, so = P.RAMPS['pl_grass'], P.RAMPS['pl_soil']
    if v in (0, 1, 2):                                    # roots
        for k in range(2 + v % 2):
            x = int(g.integers(2, 14))
            ln = int(g.integers(5, 11))
            for y in range(ln):
                _px(a, x + (y // 4) * (1 if k % 2 else -1), y, so[1] if y < ln - 2 else so[2])
    elif v in (3, 4, 5):                                  # vines with leaves
        for k in range(1 + v % 2):
            x = 4 + k * 7
            ln = 8 + v
            for y in range(ln):
                _px(a, x + (1 if (y // 3) % 2 else 0), y, gr[1])
                if y % 3 == 2:
                    _px(a, x + 2, y, gr[2])
                    _px(a, x - 1, y + 1, gr[3])
    else:                                                 # moss
        for x in range(1, 15):
            ln = 1 + int(g.integers(0, 3 + (v - 6) * 2))
            for y in range(ln):
                _px(a, x, y, gr[2] if y == 0 else gr[1])
    return a


def top_deco_mt(v):
    """Mountain top decorations (row 7, cols 8-15): snow drifts, rubble, ice crystals."""
    a = _empty()
    g = rng(f'deco_top_mt_{v}')
    rk, sn, ic = P.RAMPS['mt_rock'], P.RAMPS['mt_snow'], P.RAMPS['mt_ice']
    if v in (0, 1, 2):                                    # snow drifts
        for k in range(2):
            x0, w = int(g.integers(1, 9)) + k * 5, int(g.integers(5, 8))
            for dx in range(w):
                h = 1 + int(round(2.2 * math.sin(math.pi * (dx + 0.5) / w)))
                for y in range(h):
                    _px(a, x0 + dx, 15 - y, sn[2] if y == h - 1 else sn[1])
    elif v == 3:                                          # ice crystal
        for x0, h in ((5, 7), (9, 5)):
            for y in range(h):
                for dx in range(2 if y < h - 2 else 1):
                    _px(a, x0 + dx, 15 - y, ic[2] if dx == 0 else ic[1])
            _px(a, x0, 15 - h, ic[3])
    elif v in (4, 5):                                     # rubble
        for (x, w, h) in ((3, 4, 3), (9, 3, 2), (6, 2, 1)) if v == 4 else ((2, 5, 4), (9, 4, 2)):
            for y in range(h):
                for dx in range(w):
                    _px(a, x + dx, 15 - y, rk[3] if y == h - 1 else (rk[2] if dx < w - 1 else rk[1]))
    elif v == 6:                                          # pointed stone with a snow cap
        for y in range(8):
            half = 1 + y // 2
            for dx in range(-half, half + 1):
                col = rk[1] if dx >= half else (rk[3] if dx < -half + 1 else rk[2])
                _px(a, 8 + dx, 15 - y, col)
        for dx in range(-1, 2):
            _px(a, 8 + dx, 7, sn[2])
        _px(a, 8, 6, sn[1])
    else:                                                 # two small ice shards
        for x0, h in ((4, 4), (10, 6)):
            for y in range(h):
                _px(a, x0, 15 - y, ic[1])
                _px(a, x0 + 1, 15 - y, ic[0])
            _px(a, x0, 15 - h, ic[3])
    return a


def hanging_deco_mt(v):
    """Mountain hanging decorations (row 8, cols 0-7): stalactites and icicles."""
    a = _empty()
    g = rng(f'deco_hang_mt_{v}')
    rk, ic = P.RAMPS['mt_rock'], P.RAMPS['mt_ice']
    if v in (0, 1, 2):                                    # stalactites
        for x0 in (2 + v, 8 + v % 2, 13 - v):
            ln = int(g.integers(5, 11))
            for y in range(ln):
                half = max(0, (ln - y) // 3)
                for dx in range(-half, half + 1):
                    _px(a, x0 + dx, y, rk[3] if dx < 0 else (rk[1] if dx > 0 else rk[2]))
    elif v in (3, 4, 5):                                  # icicles
        for k in range(3):
            x0 = 2 + k * 5 + (v - 3)
            ln = int(g.integers(4, 9))
            for y in range(ln):
                _px(a, x0, y, ic[3] if y < ln - 1 else ic[2])
                if y < ln - 3:
                    _px(a, x0 + 1, y, ic[1])
    else:                                                 # frost drips along the ceiling
        for x in range(1, 15):
            ln = 1 + int(g.integers(0, 3 + (v - 6) * 2))
            for y in range(ln):
                _px(a, x, y, ic[2] if y == 0 else ic[1])
    return a


def draw_cracked_wall(th):
    """Lighter, speckled rock with dark cracks so it reads as breakable (row 3, col 12)."""
    t = np.zeros((TILE, TILE, 4), np.uint8)
    t[:, :, :3] = th['body'][3]
    t[:, :, 3] = 255
    g = rng('cracked_wall')
    for _ in range(14):
        t[g.integers(0, 16), g.integers(0, 16), :3] = th['body'][2]
    t[:, 0, :3] = t[:, 15, :3] = th['body'][0]
    t[0, :, :3] = t[15, :, :3] = th['body'][0]
    crack = [(7, 1), (7, 2), (8, 3), (8, 4), (7, 5), (6, 6), (6, 7), (7, 8), (8, 9), (9, 10), (9, 11), (8, 12),
             (8, 13), (7, 14)]
    for x, y in crack:
        t[y, x, :3] = th['body'][0]
        if y % 3 == 0:
            t[y, x - 1, :3] = th['body'][1]
    for x, y in ((5, 6), (4, 7), (10, 10), (11, 11)):                       # side branches
        t[y, x, :3] = th['body'][0]
    for x, y in ((8, 2), (9, 5), (6, 9)):
        t[y, x, :3] = th['body'][4]
    return t


def draw_rail(v):
    """Minecart rail piece standing on the cell's bottom edge (08 §9.5); v 1 has a rail joint."""
    a = _empty()
    rk = P.RAMPS['mt_rock']
    for x0 in (1, 9):                                     # sleepers every 8 px
        for x in range(x0, x0 + 3):
            _px(a, x, 14, rk[1])
            _px(a, x, 15, rk[0])
    for x in range(TILE):
        _px(a, x, 13, rk[4])
        _px(a, x, 12, rk[3] if v == 0 or x != 8 else rk[1])
    return a


def tile_cells(set_name):
    """{(col, row): 16×16 RGBA array} for every drawn cell."""
    th = THEMES[set_name]
    cells = {}
    for i, m in enumerate(BLOB_MASKS):
        cells[(i % COLS, i // COLS)] = draw_blob(set_name, m)
    for v in range(4):
        cells[(v, 3)] = draw_blob(set_name, 255, v + 1)
    for c, kind in zip(range(4, 8), ('left', 'middle', 'right', 'single')):
        cells[(c, 3)] = draw_oneway(kind, th)
    for c, d in zip(range(8, 12), ('up', 'right', 'down', 'left')):
        cells[(c, 3)] = draw_spikes(d, th)
    if set_name == 'mountains':
        cells[(12, 3)] = draw_cracked_wall(th)
        for i, m in enumerate(BLOB_MASKS):               # rows 4-6: ice blob tiles
            cells[(i % COLS, 4 + i // COLS)] = draw_blob('ice', m)
        cells[(8, 8)], cells[(9, 8)] = draw_rail(0), draw_rail(1)
    for v in range(8):
        if set_name == 'mountains':
            cells[(8 + v, 7)] = top_deco_mt(v)
            cells[(v, 8)] = hanging_deco_mt(v)
        else:
            cells[(8 + v, 7)] = top_deco(v)
            cells[(v, 8)] = hanging_deco(v)
    return cells


def used_cells(set_name='plains'):
    return sorted(tile_cells(set_name))


def build_sheet(set_name):
    w = MARGIN * 2 + COLS * TILE + (COLS - 1) * SPACING
    h = MARGIN * 2 + ROWS * TILE + (ROWS - 1) * SPACING
    sheet = np.zeros((h, w, 4), np.uint8)
    for (c, r), t in tile_cells(set_name).items():
        x, y = MARGIN + c * (TILE + SPACING), MARGIN + r * (TILE + SPACING)
        ext = np.pad(t, ((1, 1), (1, 1), (0, 0)), mode='edge')     # 1 px extrusion
        sheet[y - 1:y + TILE + 1, x - 1:x + TILE + 1] = ext
    return Image.fromarray(sheet, 'RGBA')


def autotile(grid):
    """grid: 2D bool array (True = solid). Returns blob index per solid cell (out of bounds = filled)."""
    h, w = grid.shape
    out = np.full((h, w), -1, int)
    dirs = ((0, -1, N), (1, -1, NE), (1, 0, E), (1, 1, SE), (0, 1, S), (-1, 1, SW), (-1, 0, W), (-1, -1, NW))
    for y in range(h):
        for x in range(w):
            if not grid[y, x]:
                continue
            m = 0
            for dx, dy, bit in dirs:
                xx, yy = x + dx, y + dy
                if not (0 <= xx < w and 0 <= yy < h) or grid[yy, xx]:
                    m |= bit
            out[y, x] = BLOB_INDEX[reduce_mask(m)]
    return out


def cell_image(sheet, index):
    c, r = index % COLS, index // COLS
    x, y = MARGIN + c * (TILE + SPACING), MARGIN + r * (TILE + SPACING)
    return sheet.crop((x, y, x + TILE, y + TILE))
