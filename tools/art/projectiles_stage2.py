"""Stage 2 enemy projectiles and effects (04 §8, 08 §11). Drawn into the `projectiles` atlas, facing right."""
import math

from . import atlas as A
from . import palette as P
from . import raster as R

ATLAS = 'projectiles'


def _L(w, h):
    return R.PartLayer(w, h)


def _part(L, name, ramp, shift=0):
    if name not in L.index:
        L.add_part(name, P.ramp_ids(ramp), shift)
    return name


def _one(L, name, color):
    if name not in L.index:
        L.add_part(name, [P.sid(color)])
    return name


def _done(L):
    c = R.auto_shade(L)
    R.outline(c, P.INK)
    return c.to_image()


def bomb(frame):
    """Goblin Miner bomb 8 x 8 body + fuse spark (2 frames)."""
    L = _L(10, 12)
    b = _part(L, 'body', 'gray', 1)
    R.ellipse(L, 5, 7, 3.6, 3.6, b)
    fu = _one(L, 'fuse', P.RAMPS['en_ochre'][2])
    R.line(L, (5, 4), (6, 2), fu)
    sp = _one(L, 'spark', P.RAMPS['fx_fire'][3] if frame == 0 else P.RAMPS['fx_fire'][2])
    R.line(L, (7, 1), (7, 1), sp)
    if frame:
        R.line(L, (8, 0), (8, 0), sp)
    return _done(L)


def hex_bolt(frame):
    """Goblin Shaman Hex Bolt 10 x 10 magenta orb with a white core."""
    L = _L(14, 14)
    o = _part(L, 'orb', 'en_magenta')
    R.ellipse(L, 7, 7, 4.2 + 0.4 * frame, 4.2 + 0.4 * frame, o)
    c = _one(L, 'core', P.RAMPS['white'][0])
    R.ellipse(L, 7, 7, 1.5, 1.5, c)
    tl = _part(L, 'tail', 'en_magenta', 1)
    R.fill_polygon(L, [(0, 7), (4, 4.5 + frame), (4, 9.5 - frame)], tl)
    return _done(L)


def stone_spikes(frame):
    """64 x 24 row of rock spikes (frames 0-3): marker, rising, full, crumbling."""
    L = _L(64, 24)
    rock = _part(L, 'rock', 'en_ochre')
    tip = _part(L, 'tip', 'en_bone')
    hs = [0, 9, 18, 14][frame]
    for k in range(6):
        cx = 6 + k * 10
        if frame == 0:
            R.fill_rect(L, cx - 3, 22, 7, 1, _part(L, 'mark', 'en_ochre', 2))
            continue
        h = hs - (3 if k % 2 else 0) + (2 if k % 3 == 0 else 0)
        h = max(2, min(22, h))
        R.fill_polygon(L, [(cx - 4, 23), (cx, 23 - h), (cx + 4, 23)], rock)
        R.line(L, (cx, 23 - h), (cx, 23 - h + 1), tip)
        if frame == 3:
            R.line(L, (cx + 5, 21), (cx + 5, 22), tip)
    if frame:
        R.fill_rect(L, 0, 22, 64, 2, _part(L, 'base', 'en_ochre', 1))
    return _done(L)


def barrier(frame):
    """Stone Ward bubble 40 x 40: a dashed ring of ochre with bone glints, rotating."""
    L = _L(40, 40)
    a = _part(L, 'ring', 'en_ochre')
    b = _one(L, 'glint', P.RAMPS['en_bone'][3])
    for i in range(48):
        ang = 2 * math.pi * i / 48
        x, y = 20 + 18 * math.cos(ang), 20 + 18 * math.sin(ang)
        if (i + frame * 2) % 6 < 4:
            R.ellipse(L, round(x), round(y), 1.2, 1.2, a)
        if (i + frame * 2) % 12 == 0:
            R.line(L, (round(x), round(y)), (round(x), round(y)), b)
    return R.auto_shade(L).to_image()


def build_frames():
    fr = {}
    for i in range(2):
        fr[f'bomb_{i:02d}'] = bomb(i)
        fr[f'hex_bolt_{i:02d}'] = hex_bolt(i)
        fr[f'stone_ward_{i:02d}'] = barrier(i)
    for i in range(4):
        fr[f'stone_spikes_{i:02d}'] = stone_spikes(i)
    anims = [A.anim('bomb', ATLAS, 2, 'loop', 10), A.anim('hex_bolt', ATLAS, 2, 'loop', 12),
             A.anim('stone_ward', ATLAS, 2, 'loop', 4), A.anim('stone_spikes', ATLAS, 4, 'once', 12)]
    return fr, anims
