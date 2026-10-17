"""Items for Stage 1 (08 §8): Lucky Block, key chest, Greatsword icon and its glow overlay."""
import numpy as np
from PIL import Image

from . import palette as P
from . import raster as R

ICON_SIZE = 16
ALLOWED = ['ink', 'white', 'trim', 'w_gold', 'w_wood', 'w_steel', 'fx_dark', 'fx_ice', 'gray']


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


def glow_for_image(icon):
    """18 × 18 #ffffff ring just outside a 16 × 16 icon's silhouette (08 §8)."""
    a = np.zeros((18, 18), bool)
    a[1:17, 1:17] = np.array(icon)[:, :, 3] > 0
    pad = np.pad(a, 1)
    near = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    out = np.zeros((18, 18, 4), np.uint8)
    out[near & ~a] = (255, 255, 255, 255)
    return Image.fromarray(out, 'RGBA')


def chest_timed(opened):
    L = _layer(24, 16)
    body = _part(L, 'body', 'w_steel')
    lid = _part(L, 'lid', 'w_steel', -1)
    face = _part(L, 'face', 'white')
    R.fill_rect(L, 2, 7, 20, 8, body)
    if opened:
        R.fill_rect(L, 3, 5, 18, 2, _part(L, 'inside', 'w_steel', 3))
        R.fill_rect(L, 3, 1, 18, 4, lid)
    else:
        R.fill_rect(L, 2, 2, 20, 5, lid)
        R.ellipse(L, 11.5, 6.5, 3.6, 3.6, face)
    c = _finish(L)
    if not opened:                       # clock hands
        c.a[5, 11] = P.INK
        c.a[6, 11] = P.INK
        c.a[6, 12] = P.INK
    return c.to_image()


def chest_cursed(opened):
    L = _layer(24, 16)
    body = _part(L, 'body', 'fx_dark')
    lid = _part(L, 'lid', 'fx_dark', -1)
    skull = _part(L, 'skull', 'white')
    R.fill_rect(L, 2, 7, 20, 8, body)
    if opened:
        glow = _part(L, 'glow', 'fx_dark', -3)
        R.fill_rect(L, 3, 5, 18, 2, glow)
        R.fill_rect(L, 3, 1, 18, 4, lid)
    else:
        R.fill_rect(L, 2, 2, 20, 5, lid)
        R.ellipse(L, 11.5, 7, 3, 2.6, skull)
        R.fill_rect(L, 10, 9, 4, 2, skull)
    c = _finish(L)
    if not opened:
        c.a[7, 10] = P.INK
        c.a[7, 13] = P.INK
    return c.to_image()


def key_item():
    L = _layer(16, 16)
    k = _part(L, 'key', 'w_gold')
    R.ellipse(L, 5, 5, 3.4, 3.4, k)
    R.capsule(L, (7, 7), (12, 12), 2.2, k)
    R.fill_rect(L, 10, 12, 2, 2, k)
    R.fill_rect(L, 12, 10, 2, 2, k)
    c = _finish(L)
    c.a[5, 5] = P.INK
    return c.to_image()


def coin(frame):
    """8 × 8 coin turning: full, narrower, edge, narrower."""
    L = _layer(8, 8)
    k = _part(L, 'coin', 'w_gold')
    rx = [3.0, 2.0, 0.8, 2.0][frame]
    R.ellipse(L, 3.5, 3.5, rx, 3.0, k)
    return _finish(L).to_image()


def blueprint():
    L = _layer(16, 16)
    paper = _part(L, 'paper', 'fx_ice', 1)
    roll = _part(L, 'roll', 'fx_ice', 2)
    ribbon = _part(L, 'ribbon', 'w_gold')
    R.fill_rect(L, 3, 3, 10, 10, paper)
    R.fill_rect(L, 2, 2, 12, 2, roll)
    R.fill_rect(L, 2, 12, 12, 2, roll)
    R.fill_rect(L, 7, 2, 2, 12, ribbon)
    return _finish(L).to_image()


def beam():
    """2 × 40 #ffffff, thinning out upward with a 2 × 2 dither (code tints it, 08 §8)."""
    a = np.zeros((40, 2, 4), np.uint8)
    for y in range(40):
        density = (y + 1) / 40                     # 1 at the bottom
        for x in range(2):
            thresh = [0.2, 0.6, 0.8, 0.4][(y % 2) * 2 + x]
            if density > thresh:
                a[y, x] = (255, 255, 255, 255)
    return Image.fromarray(a, 'RGBA')


def build_frames():
    from . import icons as I
    fr = {f'lucky_block_idle_{i:02d}': lucky_block(i) for i in range(4)}
    fr['chest_key_closed_00'] = chest(False)
    fr['chest_key_open_00'] = chest(True)
    fr['chest_timed_closed_00'] = chest_timed(False)
    fr['chest_timed_open_00'] = chest_timed(True)
    fr['chest_cursed_closed_00'] = chest_cursed(False)
    fr['chest_cursed_open_00'] = chest_cursed(True)
    fr['key_00'] = key_item()
    for i in range(4):
        fr[f'coin_spin_{i:02d}'] = coin(i)
    fr['blueprint_00'] = blueprint()
    fr['beam_00'] = beam()
    for w in I.WEAPONS:
        fr[f'glow_weapon_{w}'] = glow_for_image(I.weapon_icon(w))
    for a in I.ABILITIES:
        fr[f'glow_ability_{a}'] = glow_for_image(I.ability_icon(a))
    return fr


def build(assets, preview):
    import os
    from . import atlas as A
    fr = build_frames()
    allowed = P.allowed(ALLOWED)
    for n, img in fr.items():
        P.check_palette_lock(img, allowed, 'items', n)
    A.pack_atlas('items', fr, os.path.join(assets, 'atlases'), strict=False)
    from .projectiles import sheet
    sheet({k: v for k, v in fr.items() if not k.startswith('glow_')}, os.path.join(preview, 'items_sheet.png'), 6)
    out = [A.anim('lucky_block_idle', 'items', 4, 'loop', 6), A.anim('coin_spin', 'items', 4, 'loop', 12)]
    for k in ('chest_key_closed', 'chest_key_open', 'chest_timed_closed', 'chest_timed_open', 'chest_cursed_closed',
              'chest_cursed_open', 'key', 'blueprint', 'beam'):
        out.append(A.anim(k, 'items', 1, 'once'))
    return out
