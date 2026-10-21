"""ART8 effects (08 §11): the Dragon's breath cone per color, ice spikes, `dragon_shadow`, the Throne Beam tile. Atlas `vfx`."""
import math
import zlib

import numpy as np
from PIL import Image

from . import atlas as A
from . import palette as P
from . import raster as R

ATLAS = 'vfx'
BREATH = {'red': 'fx_fire', 'white': 'fx_ice', 'storm': 'fx_bolt', 'green': 'fx_poison'}
W, H = 240, 56


def _rng(s):
    return np.random.default_rng(zlib.crc32(s.encode()))


def breath(color, frame):
    """Breath cone 240 x 56, facing right, 4 frames at 16 fps (08 §11); the three boxes of 04 §13.1 sit inside it."""
    L = R.PartLayer(W, H)
    ramp = BREATH[color]
    g = _rng(f'breath_{color}_{frame}')
    outer = L.add_part('outer', P.ramp_ids(ramp), 1)
    mid = L.add_part('mid', P.ramp_ids(ramp), 0)
    core = L.add_part('core', P.ramp_ids(ramp), -1)
    cy = H / 2
    R.fill_polygon(L, [(0, cy - 3), (W, 1), (W, H - 1), (0, cy + 3)], outer)
    R.fill_polygon(L, [(0, cy - 2), (W, 8), (W, H - 8), (0, cy + 2)], mid)
    R.fill_polygon(L, [(0, cy - 1), (W * 0.7, cy - 8), (W * 0.7, cy + 8), (0, cy + 1)], core)
    if color == 'red':                                    # flame tongues along both edges
        for k in range(18):
            x = 14 + k * 12.5 + frame * 3
            hgt = 5 + (k * 7 + frame * 3) % 6
            for sd in (-1, 1):
                ey = cy + sd * (3 + (x / W) * (cy - 4))
                R.fill_polygon(L, [(x - 4, ey), (x + 2, ey + sd * hgt), (x + 5, ey)], mid if k % 2 else outer)
    elif color == 'white':                                # ice shards
        for k in range(16):
            x = 20 + k * 13 + frame * 2
            ey = cy + ((k % 2) * 2 - 1) * (4 + (x / W) * (cy - 6))
            R.fill_polygon(L, [(x, ey - 2), (x + 8, ey), (x, ey + 2)], core)
    elif color == 'storm':                                # a zigzag bolt through the cone
        y = cy
        for x in range(0, W - 8, 8):
            ny = cy + (int(g.integers(-1, 2))) * (3 + x / W * 20)
            R.line(L, (x, int(y)), (x + 8, int(ny)), core)
            R.line(L, (x, int(y) + 1), (x + 8, int(ny) + 1), core)
            y = ny
    else:                                                 # poison: bubbles
        for k in range(26):
            x = 10 + (k * 9.3 + frame * 5) % (W - 20)
            r = 2 + (k % 3)
            ey = cy + (int(g.integers(-100, 100)) / 100) * (2 + (x / W) * (cy - 6))
            R.ellipse(L, x, ey, r, r, core if k % 3 == 0 else mid)
    return R.auto_shade(L).to_image()


def ice_spike(frame):
    """Ice spikes 24 x 48 (3 frames at 24 fps): rising, full, shattering."""
    L = R.PartLayer(24, 48)
    ice = L.add_part('ice', P.ramp_ids('fx_ice'), 0)
    dark = L.add_part('dark', P.ramp_ids('fx_ice'), 1)
    hs = (22, 46, 40)[frame]
    R.fill_polygon(L, [(2, 47), (12, 47 - hs), (22, 47)], ice)
    R.fill_polygon(L, [(8, 47), (6, 47 - hs * 0.55), (12, 47)], dark)
    if frame == 2:
        for x, y in ((2, 30), (20, 26), (11, 12)):
            R.fill_rect(L, x, y, 2, 3, ice)
    return R.auto_shade(L).to_image()


def dragon_shadow():
    """`dragon_shadow` 160 x 64: an `ink` silhouette of the Dragon in flight (the game fades it to alpha 0.35)."""
    from .bosses import dragon as D
    img = D.draw_dragon(D.tables()['hover'][2])
    a = np.array(img)
    ys, xs = np.nonzero(a[:, :, 3] > 0)
    crop = img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    scale = min(160 / crop.width, 64 / crop.height)
    crop = crop.resize((max(1, int(crop.width * scale)), max(1, int(crop.height * scale))), Image.NEAREST)
    ca = np.array(crop)
    ink = np.array(P.RAMPS['ink'][0], np.uint8)
    ca[ca[:, :, 3] > 0, :3] = ink
    ca[:, :, 3] = np.where(ca[:, :, 3] > 0, 255, 0)
    out = Image.new('RGBA', (160, 64), (0, 0, 0, 0))
    out.alpha_composite(Image.fromarray(ca, 'RGBA'), ((160 - crop.width) // 2, (64 - crop.height) // 2))
    return out


def throne_beam(frame):
    """Throne Beam tile 16 x 16 (2 frames at 12 fps), repeated along the beam: a gold core in a violet glow."""
    c = R.Canvas(16, 16)
    go, mg = P.RAMPS['w_gold'], P.RAMPS['w_magic']
    for y in range(16):
        d = abs(y - 7.5)
        col = P.RAMPS['white'][0] if d < 1.6 else go[3] if d < 3.5 else go[2] if d < 5.5 else mg[2] if d < 7 else mg[1]
        for x in range(16):
            shift = 1 if ((x + frame * 4) // 4) % 2 and d > 4 else 0
            c.a[y, x] = P.sid(col if not shift else (mg[2] if d < 7 else mg[1]))
    return c.to_image()


def frames():
    fr = {}
    for color in BREATH:
        for i in range(4):
            fr[f'dragon_breath_{color}_{i:02d}'] = breath(color, i)
    for i in range(3):
        fr[f'ice_spike_{i:02d}'] = ice_spike(i)
    for i in range(2):
        fr[f'throne_beam_{i:02d}'] = throne_beam(i)
    fr['dragon_shadow_00'] = dragon_shadow()
    return fr


def anims():
    out = [A.anim(f'dragon_breath_{c}', ATLAS, 4, 'loop', 16) for c in BREATH]
    out += [A.anim('ice_spike', ATLAS, 3, 'once', 24), A.anim('throne_beam', ATLAS, 2, 'loop', 12),
            A.anim('dragon_shadow', ATLAS, 1, 'once')]
    return out
