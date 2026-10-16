"""Items for Stage 1 (08 §8): Lucky Block, key chest, Greatsword icon and its glow overlay."""
import numpy as np
from PIL import Image

from . import palette as P
from . import raster as R

ICON_SIZE = 16
ALLOWED = ['ink', 'white', 'trim', 'w_gold', 'w_wood', 'w_steel']


def _layer(w, h):
    return R.PartLayer(w, h)


def _part(L, name, ramp, shift=0):
    if name not in L.index:
        L.add_part(name, P.ramp_ids(ramp), shift)
    return name


def _finish(L, outline=True):
    c = R.auto_shade(L)
    if outline:
        R.outline(c, P.INK)
    return c


QMARK = ['.###.',
         '#...#',
         '...#.',
         '..#..',
         '.....',
         '..#..']


def lucky_block(frame):
    L = _layer(16, 16)
    b = _part(L, 'block', 'w_gold')
    R.fill_rect(L, 1, 1, 14, 14, b)
    c = _finish(L)
    # rivets in the corners and a shine that sweeps across over the 4 frames
    for (x, y) in ((2, 2), (13, 2), (2, 13), (13, 13)):
        c.a[y, x] = P.sid(P.RAMPS['w_gold'][1])
    sx = 3 + frame * 3
    for k in range(3):
        x, y = sx + k, 3 + k
        if 2 <= x <= 13:
            c.a[y, x] = P.sid(P.RAMPS['w_gold'][3])
    for j, row in enumerate(QMARK):
        for i, ch in enumerate(row):
            if ch == '#':
                c.a[5 + j, 6 + i] = P.INK
    return c.to_image()


def chest(opened):
    L = _layer(24, 16)
    body = _part(L, 'body', 'w_wood')
    band = _part(L, 'band', 'w_gold')
    lock = _part(L, 'lock', 'w_gold', 1)
    R.fill_rect(L, 2, 7, 20, 8, body)
    if opened:
        inside = _part(L, 'inside', 'w_wood', 2)
        R.fill_rect(L, 3, 5, 18, 2, inside)
        lid = _part(L, 'lid', 'w_wood')
        R.fill_rect(L, 3, 1, 18, 4, lid)
        R.fill_rect(L, 3, 1, 2, 4, band)
        R.fill_rect(L, 19, 1, 2, 4, band)
        coin = _part(L, 'coin', 'w_gold', -1)
        R.fill_rect(L, 9, 6, 6, 1, coin)
    else:
        lid = _part(L, 'lid', 'w_wood')
        R.fill_rect(L, 2, 2, 20, 5, lid)
        R.fill_rect(L, 2, 2, 2, 13, band)
        R.fill_rect(L, 20, 2, 2, 13, band)
        R.fill_rect(L, 10, 5, 4, 5, lock)
    if opened:
        R.fill_rect(L, 2, 7, 2, 8, band)
        R.fill_rect(L, 20, 7, 2, 8, band)
    c = _finish(L)
    if not opened:
        c.a[7, 11] = P.INK          # keyhole
        c.a[8, 11] = P.INK
    return c.to_image()


def _icon_canvas():
    """Greatsword at 45°, pointing up-right (08 §8), 16 × 16 with an ink outline."""
    L = _layer(16, 16)
    blade = _part(L, 'blade', 'w_steel')
    guard = _part(L, 'guard', 'w_gold')
    grip = _part(L, 'grip', 'w_wood')
    pommel = _part(L, 'pommel', 'w_gold', 1)
    R.fill_polygon(L, [(5.5, 8.5), (12.5, 1.5), (14.5, 1.5), (14.5, 3.5), (7.5, 10.5)], blade)
    R.line(L, (3, 7), (8, 12), guard)
    R.line(L, (4, 7), (8, 11), guard)
    R.line(L, (2, 13), (5, 10), grip)
    R.line(L, (1, 14), (1, 14), pommel)
    R.line(L, (2, 14), (2, 14), pommel)
    c = _finish(L)
    c.a[2, 13] = P.sid(P.RAMPS['w_steel'][3])
    return c


def greatsword_icon():
    return _icon_canvas().to_image()


def glow_for(icon_canvas):
    """18 × 18: #ffffff ring just outside the icon's silhouette (08 §8)."""
    a = np.full((18, 18), -1, np.int16)
    a[1:17, 1:17] = icon_canvas.a
    c = R.Canvas(18, 18, a.copy())
    R.outline(c, P.sid(P.RAMPS['trim'][2]))
    ring = np.where((c.a >= 0) & (a < 0), c.a, -1).astype(np.int16)
    return R.Canvas(18, 18, ring).to_image()


def build_frames():
    fr = {f'lucky_block_idle_{i:02d}': lucky_block(i) for i in range(4)}
    fr['chest_key_closed_00'] = chest(False)
    fr['chest_key_open_00'] = chest(True)
    fr['glow_weapon_greatsword'] = glow_for(_icon_canvas())
    return fr


def build(assets, preview):
    import os
    from . import atlas as A
    fr = build_frames()
    allowed = P.allowed(ALLOWED)
    for n, img in fr.items():
        P.check_palette_lock(img, allowed, 'items', n)
    A.pack_atlas('items', fr, os.path.join(assets, 'atlases'))
    big = Image.new('RGBA', (160, 24), (0x78, 0xb1, 0x8b, 255))
    x = 2
    for n in sorted(fr):
        big.alpha_composite(fr[n], (x, 2))
        x += fr[n].width + 2
    big.alpha_composite(greatsword_icon(), (x, 2))
    big.resize((big.width * 6, big.height * 6), Image.NEAREST).save(os.path.join(preview, 'items_sheet.png'))
    return [A.anim('lucky_block_idle', 'items', 4, 'loop', 6),
            A.anim('chest_key_closed', 'items', 1, 'once'),
            A.anim('chest_key_open', 'items', 1, 'once')]
