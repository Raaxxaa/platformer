"""Blob autotiling and the terrain tilesets (08 §9.1–9.3)."""
import zlib

import numpy as np
from PIL import Image

from . import palette as P

N, NE, E, SE, S, SW, W, NW = 1, 2, 4, 8, 16, 32, 64, 128
TILE = 16
COLS, ROWS = 16, 9
MARGIN, SPACING = 1, 2
ALLOWED = ['pl_soil', 'pl_grass', 'pl_wood', 'white']


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


def _c(ramp, i):
    return P.RAMPS[ramp][i]


def _soil(seed):
    """16 × 16 soil texture: base shade with a few darker pebbles and lighter grains."""
    g = rng(seed)
    t = np.zeros((TILE, TILE, 3), np.uint8)
    t[:, :] = _c('pl_soil', 2)
    for _ in range(5):
        x, y = g.integers(1, 14), g.integers(4, 14)
        t[y, x] = _c('pl_soil', 1)
        t[y, x + 1] = _c('pl_soil', 1)
        t[y - 1, x] = _c('pl_soil', 3)
    for _ in range(4):
        x, y = g.integers(0, 16), g.integers(3, 16)
        t[y, x] = _c('pl_soil', 3)
    return t


def draw_blob(set_name, mask, variant=0):
    m = reduce_mask(mask)
    t = _soil(f'tiles_{set_name}_{m}_{variant}')
    g = rng(f'tiles_{set_name}_{m}_{variant}_cap')
    if variant == 1:        # buried stone
        t[8:11, 5:10] = _c('pl_soil', 3)
        t[11, 6:10] = _c('pl_soil', 1)
        t[8, 6:9] = _c('pl_soil', 4)
    elif variant == 2:      # root
        for x in range(2, 14):
            y = 9 + int(round(1.5 * np.sin(x / 2.0)))
            t[y, x] = _c('pl_wood', 1)
        t[10, 13] = _c('pl_wood', 0)
    elif variant == 3:      # darker clump
        t[5:9, 9:13] = _c('pl_soil', 1)
        t[5, 10:12] = _c('pl_soil', 2)
    elif variant == 4:      # bone-white grains
        for (x, y) in ((3, 4), (4, 12), (11, 6), (12, 13), (7, 9)):
            t[y, x] = _c('pl_soil', 4)
    if not m & N:
        t[0, :] = _c('pl_grass', 3)                 # 1 px highlight
        t[1:3, :] = _c('pl_grass', 2)               # cap
        t[3, :] = _c('pl_grass', 1)
        for x in range(TILE):                       # ragged edge hanging into the soil
            d = int(g.integers(0, 3))
            if d:
                t[4:4 + d - 1, x] = _c('pl_grass', 1)
                t[3 + d - 1, x] = _c('pl_grass', 1)
            if g.integers(0, 4) == 0:
                t[1, x] = _c('pl_grass', 3)
    rim_soil, rim_grass = _c('pl_soil', 0), _c('pl_grass', 0)

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
                t[0, xs] = _c('pl_grass', 3)
                t[1:3, xs] = _c('pl_grass', 2)
                t[3, xs] = _c('pl_grass', 1)
                t[0:3, 2 if left else 13] = _c('pl_grass', 1)
                t[0:4, 3 if left else 12] = _c('pl_grass', 0)
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


def draw_oneway(kind):
    """kind: 'left', 'middle', 'right', 'single'. Only the top 6 px are filled (08 §9.3)."""
    a = _empty()
    for y in range(6):
        shade = {0: 2, 5: 0}.get(y, 1)
        for x in range(TILE):
            _put(a, y, x, _c('pl_wood', shade))
    for x in (3, 9, 14):                             # grain
        _put(a, 2, x, _c('pl_wood', 0))
        _put(a, 3, x - 1, _c('pl_wood', 0))
    for x in range(0, TILE, 2):                       # grass tufts on top
        _put(a, 0, x, _c('pl_grass', 3) if x % 4 == 0 else _c('pl_wood', 2))
    ends = {'left': (0,), 'right': (TILE - 1,), 'single': (0, TILE - 1), 'middle': ()}[kind]
    for x in ends:
        for y in range(6):
            _put(a, y, x, _c('pl_wood', 0))
        a[0, x, 3] = 0
        a[5, x, 3] = 0
    if kind != 'middle':                              # nails at the ends
        for x in ends:
            nx = 2 if x == 0 else TILE - 3
            _put(a, 2, nx, _c('pl_soil', 4))
    return a


def draw_spikes(direction):
    """Sharpened stakes; 'up' pointing up, others rotated."""
    a = _empty()
    for cx in (2, 6, 10, 14):
        for y in range(5, TILE):
            half = min(2, (y - 5) // 3)
            for x in range(cx - half - 1, cx + half + 1):
                if 0 <= x < TILE:
                    shade = 2 if x < cx - half else (0 if x == cx + half else 1)
                    _put(a, y, x, _c('pl_wood', shade))
        _put(a, 5, cx - 1, _c('pl_soil', 4))
        _put(a, 6, cx - 1, _c('pl_soil', 4))
    for x in range(TILE):
        _put(a, TILE - 1, x, _c('pl_soil', 0))
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


def tile_cells(set_name):
    """{(col, row): 16×16 RGBA array} for every drawn cell."""
    cells = {}
    for i, m in enumerate(BLOB_MASKS):
        cells[(i % COLS, i // COLS)] = draw_blob(set_name, m)
    for v in range(4):
        cells[(v, 3)] = draw_blob(set_name, 255, v + 1)
    for c, kind in zip(range(4, 8), ('left', 'middle', 'right', 'single')):
        cells[(c, 3)] = draw_oneway(kind)
    for c, d in zip(range(8, 12), ('up', 'right', 'down', 'left')):
        cells[(c, 3)] = draw_spikes(d)
    for v in range(8):
        cells[(8 + v, 7)] = top_deco(v)
        cells[(v, 8)] = hanging_deco(v)
    return cells


def used_cells():
    return sorted(tile_cells('plains'))


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
