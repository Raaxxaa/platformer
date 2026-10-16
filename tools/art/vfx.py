"""Stage 1 effect sprites (08 §11): hits, crit, stun stars, dust, muzzle, debris. No ink outline."""
import math
import os

import numpy as np

from . import atlas as A
from . import palette as P
from . import raster as R

ATLAS = 'vfx'
ALLOWED = ['white', 'trim', 'gray', 'fx_bolt', 'fx_fire']
WHITE = P.sid((255, 255, 255))           # pure #ffffff (trim light): tints exactly in code
GREY = P.sid((0xb0, 0xb0, 0xb0))


def _c(ramp, i):
    return P.sid(P.RAMPS[ramp][i])


def _grid(w, h):
    ys, xs = np.mgrid[0:h, 0:w]
    return xs + 0.5, ys + 0.5


def _img(a):
    return R.Canvas(a.shape[1], a.shape[0], a.astype(np.int16)).to_image()


def star_burst(size, frame, frames, rays, core_col, ray_col, tip_col=None):
    """White core with rays that grow and then break up."""
    w = h = size
    xs, ys = _grid(w, h)
    cx = cy = size / 2
    a = np.full((h, w), -1)
    t = (frame + 1) / frames
    r = size / 2 - 0.5
    ang = np.arctan2(ys - cy, xs - cx)
    d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    ray = np.zeros_like(d, bool)
    for k in range(rays):
        th = 2 * math.pi * k / rays + (0.3 if frame % 2 else 0)
        diff = np.abs((ang - th + math.pi) % (2 * math.pi) - math.pi)
        width = 0.9 / max(d.max(), 1)
        ray |= (diff * d < 0.9 + (1 - t)) & (d < r * min(1, 0.45 + t))
    hollow = d < r * (t - 0.35) if t > 0.6 else np.zeros_like(ray)
    a[ray & ~hollow] = ray_col
    core = d < max(0.0, size * 0.18 * (1.2 - t))
    a[core] = core_col
    if tip_col is not None:
        a[ray & ~hollow & (d > r * 0.7)] = tip_col
    return _img(a)


def stun_stars(frame):
    a = np.full((8, 16), -1)
    for k in range(3):
        th = 2 * math.pi * (k / 3 + frame / 4)
        x, y = 8 + 5.5 * math.cos(th), 4 + 2 * math.sin(th)
        xi, yi = int(round(x - 0.5)), int(round(y - 0.5))
        col = _c('fx_bolt', 2) if math.sin(th) > -0.3 else _c('fx_fire', 3)
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            if 0 <= xi + dx < 16 and 0 <= yi + dy < 8:
                a[yi + dy, xi + dx] = col
        if 0 <= xi < 16 and 0 <= yi < 8:
            a[yi, xi] = _c('fx_bolt', 3)
    return _img(a)


def dust(w, h, frame, seed):
    g = np.random.default_rng(seed)
    a = np.full((h, w), -1)
    xs, ys = _grid(w, h)
    t = frame / 3
    for k in range(5):
        side = -1 if k % 2 else 1
        cx = w / 2 + side * (2 + k * 1.2 + t * w * 0.28)
        cy = h - 2 - t * 2 - g.uniform(0, 1)
        r = (2.4 + g.uniform(0, 1)) * (1 - 0.55 * t)
        m = (xs - cx) ** 2 + ((ys - cy) * 1.3) ** 2 < r * r
        a[m] = _c('gray', 4) if frame < 2 else _c('gray', 3)
        hi = (xs - cx + 0.8) ** 2 + ((ys - cy + 0.8) * 1.3) ** 2 < (r * 0.5) ** 2
        a[m & hi] = _c('white', 0)
    return _img(a)


def muzzle(frame):
    a = np.full((8, 8), -1)
    xs, ys = _grid(8, 8)
    d = np.sqrt((xs - 2) ** 2 + (ys - 4) ** 2 * 2)
    r = 4.5 if frame == 0 else 3
    a[d < r] = _c('fx_fire', 3)
    a[d < r * 0.5] = WHITE
    return _img(a)


def debris(k):
    cols = [_c('gray', 1), _c('gray', 2), _c('gray', 3), WHITE]
    a = np.full((2, 2), cols[k])
    if k == 1:
        a[0, 1] = -1
    return _img(a)


def build_frames():
    fr = {}
    for i in range(3):
        fr[f'hit_spark_{i:02d}'] = star_burst(16, i, 3, 4, WHITE, GREY)
    for i in range(4):
        fr[f'hit_heavy_{i:02d}'] = star_burst(32, i, 4, 8, WHITE, GREY)
        fr[f'crit_spark_{i:02d}'] = star_burst(24, i, 4, 6, WHITE, _c('fx_bolt', 3), _c('fx_bolt', 2))
        fr[f'stun_stars_{i:02d}'] = stun_stars(i)
        fr[f'dust_land_{i:02d}'] = dust(24, 8, i, 11)
        fr[f'dust_jump_{i:02d}'] = dust(16, 8, i, 12)
        fr[f'debris_{i:02d}'] = debris(i)
    for i in range(2):
        fr[f'muzzle_{i:02d}'] = muzzle(i)
    anims = [A.anim('hit_spark', ATLAS, 3, 'once', 30), A.anim('hit_heavy', ATLAS, 4, 'once', 30),
             A.anim('crit_spark', ATLAS, 4, 'once', 30), A.anim('stun_stars', ATLAS, 4, 'loop', 10),
             A.anim('dust_land', ATLAS, 4, 'once', 20), A.anim('dust_jump', ATLAS, 4, 'once', 20),
             A.anim('muzzle', ATLAS, 2, 'once', 30), A.anim('debris', ATLAS, 4, 'once')]
    return fr, anims


def build(assets, preview):
    from .projectiles import sheet
    fr, anims = build_frames()
    for n, img in fr.items():
        P.check_palette_lock(img, P.allowed(ALLOWED), ATLAS, n)
    A.pack_atlas(ATLAS, fr, os.path.join(assets, 'atlases'))
    sheet(fr, os.path.join(preview, 'vfx_sheet.png'), scale=5)
    return anims
