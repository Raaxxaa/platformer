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
    """64 x 24 row of rock spikes, 3 frames at 24 fps (08 §11): rising, full, crumbling."""
    L = _L(64, 24)
    rock = _part(L, 'rock', 'en_ochre')
    tip = _part(L, 'tip', 'en_bone')
    hs = [10, 20, 15][frame]
    for k in range(6):
        cx = 6 + k * 10
        h = hs - (3 if k % 2 else 0) + (2 if k % 3 == 0 else 0)
        h = max(2, min(22, h))
        R.fill_polygon(L, [(cx - 4, 23), (cx, 23 - h), (cx + 4, 23)], rock)
        R.line(L, (cx, 23 - h), (cx, 23 - h + 1), tip)
        if frame == 2:
            R.line(L, (cx + 5, 21), (cx + 5, 22), tip)
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


def potion(frame):
    """Swamp Witch potion 8 x 8: a round flask of green brew, tumbling (2 frames)."""
    L = _L(10, 10)
    gl = _part(L, 'glass', 'en_bone', 1)
    R.ellipse(L, 5, 6, 3.4, 3.4, gl)
    br = _part(L, 'brew', 'fx_poison')
    R.ellipse(L, 5, 6 + (1 if frame else 0), 2.4, 2.0, br)
    cork = _part(L, 'cork', 'en_ochre', 1)
    R.fill_rect(L, 4, 1 + (frame * 0), 2, 2, cork)
    return _done(L)


def puddle(frame):
    """Poison puddle 48 x 8 (2 frames at 6 fps): a flat pool with a few bubbles."""
    L = _L(48, 8)
    pd = _part(L, 'pool', 'fx_poison', 1)
    R.ellipse(L, 24, 5, 23, 2.6, pd)
    hi = _one(L, 'hi', P.RAMPS['fx_poison'][3])
    for x in (10, 22, 34):
        R.line(L, (x + frame * 2, 4), (x + frame * 2 + 2, 4), hi)
    bub = _one(L, 'bub', P.RAMPS['fx_poison'][2])
    for x in (16, 29, 40):
        R.line(L, (x - frame, 2 + frame), (x - frame, 2 + frame), bub)
    c = R.auto_shade(L)
    return c.to_image()


def toxic_cloud(frame):
    """Toxic cloud 64 x 48 (4 frames at 6 fps): billowing puffs of poison gas, drawn as a dithered mass."""
    L = _L(64, 48)
    g0 = _part(L, 'gas', 'fx_poison', 1)
    rng = [(32, 28, 22, 14), (20, 30, 14, 10), (44, 30, 14, 10), (30, 18, 12, 9), (40, 20, 10, 8)]
    for k, (cx, cy, rx, ry) in enumerate(rng):
        R.ellipse(L, cx, cy + int(round(2 * math.sin(frame * math.pi / 2 + k))), rx, ry, g0)
    c = R.auto_shade(L)
    a = c.a
    ys, xs = a.shape
    for y in range(ys):                                  # dither the rim so the cloud reads as vapour
        for x in range(xs):
            if a[y, x] >= 0 and (x + y + frame) % 2 == 0 and (
                    (y > 0 and a[y - 1, x] < 0) or (x > 0 and a[y, x - 1] < 0) or
                    (y + 1 < ys and a[y + 1, x] < 0) or (x + 1 < xs and a[y, x + 1] < 0)):
                a[y, x] = -1
    return c.to_image()


def bubble(frame):
    """Bubble 6 x 6 over a submerged Bog Zombie (3 frames: grow, hold, pop)."""
    c = R.Canvas(6, 6)
    w = P.RAMPS['sw_water']
    r = [1.6, 2.4, 2.8][frame]
    for y in range(6):
        for x in range(6):
            d = math.hypot(x - 2.5, y - 2.5)
            if r - 0.9 <= d <= r + 0.2 and not (frame == 2 and (x + y) % 2):
                c.a[y, x] = P.sid(w[3] if (x < 3 and y < 3) else w[2])
    return c.to_image()


def splash(frame):
    """Water splash 24 x 16 (5 frames at 20 fps), `sw_water`."""
    c = R.Canvas(24, 16)
    w = P.RAMPS['sw_water']
    for k in range(7):
        a = math.pi * (0.15 + 0.7 * k / 6)
        r = 2 + frame * 2.2
        x = 12 + math.cos(a) * r * 1.4
        y = 15 - math.sin(a) * r * (1.15 - frame * 0.1) + frame * frame * 0.35
        for dx, dy in ((0, 0), (1, 0)) if frame < 3 else ((0, 0),):
            xi, yi = round(x) + dx, round(y) + dy
            if 0 <= xi < 24 and 0 <= yi < 16:
                c.a[yi, xi] = P.sid(w[3] if frame < 3 else w[2])
    R.outline(c, P.INK)
    return c.to_image()


def ripple(frame):
    """Wading ripple 16 x 4 (2 frames at 8 fps)."""
    c = R.Canvas(16, 4)
    w = P.RAMPS['sw_water']
    for x in range(16):
        y = 1 + int(round(0.9 * math.sin((x + frame * 4) / 2.5)))
        c.a[y, x] = P.sid(w[3])
        if (x + frame) % 3 == 0:
            c.a[min(3, y + 1), x] = P.sid(w[2])
    return c.to_image()


def build_frames():
    fr = {}
    for i in range(2):
        fr[f'bomb_{i:02d}'] = bomb(i)
        fr[f'hex_bolt_{i:02d}'] = hex_bolt(i)
        fr[f'stone_ward_{i:02d}'] = barrier(i)
    for i in range(3):
        fr[f'stone_spikes_{i:02d}'] = stone_spikes(i)
    for i in range(2):
        fr[f'potion_{i:02d}'] = potion(i)
        fr[f'puddle_{i:02d}'] = puddle(i)
        fr[f'ripple_{i:02d}'] = ripple(i)
    for i in range(4):
        fr[f'toxic_cloud_{i:02d}'] = toxic_cloud(i)
    for i in range(3):
        fr[f'bubble_{i:02d}'] = bubble(i)
    for i in range(5):
        fr[f'splash_{i:02d}'] = splash(i)
    anims = [A.anim('potion', ATLAS, 2, 'loop', 10), A.anim('puddle', ATLAS, 2, 'loop', 6),
             A.anim('toxic_cloud', ATLAS, 4, 'loop', 6), A.anim('bubble', ATLAS, 3, 'once', 6),
             A.anim('splash', ATLAS, 5, 'once', 20), A.anim('ripple', ATLAS, 2, 'loop', 8),
             A.anim('bomb', ATLAS, 2, 'loop', 10), A.anim('hex_bolt', ATLAS, 2, 'loop', 12),
             A.anim('stone_ward', ATLAS, 2, 'loop', 4), A.anim('stone_spikes', ATLAS, 3, 'once', 24)]
    return fr, anims
