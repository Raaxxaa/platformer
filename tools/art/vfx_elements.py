"""ART6 effects, packed into the `vfx` atlas: element hits and statuses (08 §11 "Element status"), S-grade signature
effects (02 §13) and loot effects. No ink outline. Signature frames are white/grey only: the code tints them with the
weapon's element color (multiply, 08 §3.5), exactly like the smears."""
import math

import numpy as np

from . import atlas as A
from . import palette as P
from . import raster as R

ATLAS = 'vfx'
WHITE = P.sid((255, 255, 255))
GREY = P.sid((0xb0, 0xb0, 0xb0))
ELEMENTS = {'fire': 'fx_fire', 'ice': 'fx_ice', 'lightning': 'fx_bolt', 'poison': 'fx_poison', 'wind': 'fx_wind'}


def _c(ramp, i):
    return P.sid(P.RAMPS[ramp][i])


def _grid(w, h):
    ys, xs = np.mgrid[0:h, 0:w]
    return xs + 0.5, ys + 0.5


def _new(w, h):
    return np.full((h, w), -1, np.int16)


def _img(a):
    return R.Canvas(a.shape[1], a.shape[0], a.astype(np.int16)).to_image()


def _dot(a, x, y, col, r=0.0):
    h, w = a.shape
    xs, ys = _grid(w, h)
    m = (xs - x) ** 2 + (ys - y) ** 2 <= max(r, 0.5) ** 2 + 0.25
    a[m] = col


# --- element hits: a starburst in the element's colors, each with its own shape so they read apart at 1× ---------

def elem_hit(elem, frame):
    w = h = 16
    a = _new(w, h)
    xs, ys = _grid(w, h)
    ramp = ELEMENTS[elem]
    n = len(P.RAMPS[ramp])
    main, core = _c(ramp, n - 2), _c(ramp, n - 1)
    dark = _c(ramp, max(0, n - 3))
    t = (frame + 1) / 3
    d = np.sqrt((xs - 8) ** 2 + (ys - 8) ** 2)
    ang = np.arctan2(ys - 8, xs - 8)
    if elem == 'fire':                       # licking tongues rising up
        r = 3 + 4 * t
        tongue = (d < r) & (np.cos(ang * 3 + frame) > -0.2) | ((d < r + 2) & (ys < 8) & (np.abs(xs - 8) < 2 + t))
        a[tongue] = dark
        a[(d < r * 0.7)] = main
        a[d < max(1.0, 2.5 - frame)] = core
    elif elem == 'ice':                      # a 6-pointed crystal star
        r = 2.5 + 4.5 * t
        spoke = np.zeros_like(d, bool)
        for k in range(6):
            th = k * math.pi / 3
            spoke |= (np.abs((ang - th + math.pi) % (2 * math.pi) - math.pi) * d < 0.8) & (d < r)
        a[spoke] = _c(ramp, 0)
        a[spoke & (d < r * 0.5)] = _c(ramp, 1)
        a[d < 1.5] = _c(ramp, 2)
        if frame == 2:
            a[d < 1] = -1
    elif elem == 'lightning':                # jagged zigzag forks
        g = np.random.default_rng(3 + frame)
        for k in range(3):
            x, y = 8.0, 8.0
            th = g.uniform(0, 2 * math.pi)
            for _s in range(2 + frame):
                nx, ny = x + 3 * math.cos(th), y + 3 * math.sin(th)
                R_line(a, x, y, nx, ny, main)
                x, y = nx, ny
                th += g.uniform(-1.2, 1.2)
        a[d < 1.6] = main
    elif elem == 'poison':                   # a splash of round droplets
        g = np.random.default_rng(9)
        for k in range(6):
            th = 2 * math.pi * k / 6 + 0.3
            rr = 2 + 4 * t
            _dot(a, 8 + rr * math.cos(th), 8 + rr * math.sin(th), main, 1.3 - 0.3 * frame)
        _dot(a, 8, 8, dark, 2 - frame * 0.5)
        _dot(a, 7.5, 7.5, core, 0.6)
    elif elem == 'wind':                     # curling arcs
        for k in range(2):
            rr = 3 + 3 * t + k * 2
            arc = (np.abs(d - rr) < 0.7) & (((ang + k * math.pi + frame * 0.8) % (2 * math.pi)) < 2.2)
            a[arc] = _c(ramp, 2) if k == 0 else _c(ramp, 1)
        a[d < 1.2] = _c(ramp, 2)
    return _img(a)


def R_line(a, x0, y0, x1, y1, col):
    h, w = a.shape
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        y = y0 + (y1 - y0) * i / n
        xi, yi = int(x), int(y)
        if 0 <= xi < w and 0 <= yi < h:
            a[yi, xi] = col


# --- statuses (small, at the edges of the body: 08 Review focus 2) -----------------------------------------------

def burn_flame(frame):
    """Burn: a 6 × 8 flame, 3 at 12 fps."""
    a = _new(6, 8)
    xs, ys = _grid(6, 8)
    sway = [0, 0.6, -0.5][frame]
    body = ((xs - 3 - sway * (8 - ys) / 8) ** 2 / 4.5 + (ys - 5.5) ** 2 / 6.5) < 1
    tip = (np.abs(xs - 3 - sway * 1.5) < 0.9) & (ys > 0.8 + frame * 0.3) & (ys < 3)
    a[body | tip] = _c('fx_fire', 1)
    a[((xs - 3 - sway * 0.5) ** 2 / 2 + (ys - 5.8) ** 2 / 3) < 1] = _c('fx_fire', 2)
    a[((xs - 3) ** 2 + (ys - 6.3) ** 2) < 0.9] = _c('fx_fire', 3)
    return _img(a)


def chill_frost(frame):
    """Chill: a 5 × 5 frost sparkle that twinkles (a + then a ×), 3 frames."""
    a = _new(5, 5)
    c, hi = _c('fx_ice', 2), _c('fx_ice', 3)
    if frame == 0:
        a[2, 1:4] = c
        a[1:4, 2] = c
    elif frame == 1:
        a[2, :] = c
        a[:, 2] = c
        a[2, 2] = hi
    else:
        for i in (0, 4):
            a[i, i] = a[i, 4 - i] = c
        a[1, 1] = a[1, 3] = a[3, 1] = a[3, 3] = c
        a[2, 2] = hi
    return _img(a)


FREEZE_CORNER = 6


def freeze_block():
    """Freeze: a 24 × 24 9-slice ice frame (6 px corners). Edges repeat, the middle cell is clear so the frozen enemy
    shows through (the code tints it #8fdcff, 08 §5.3)."""
    w = h = 24
    c = FREEZE_CORNER
    prof = [_c('fx_ice', 0), _c('fx_ice', 1), _c('fx_ice', 2), _c('fx_ice', 3)]
    a = _new(w, h)
    for y in range(h):
        for x in range(w):
            dx, dy = min(x, w - 1 - x), min(y, h - 1 - y)
            cx, cy = x < c or x >= w - c, y < c or y >= h - c
            d = min(dx, dy) if (cx and cy) else (dx if cx else (dy if cy else None))
            if d is not None and d < len(prof):
                a[y, x] = prof[d]
    # frosty corner chips (corners only, so stretching never seams)
    for (x, y) in ((1, 1), (2, 1), (1, 2), (w - 2, 1), (w - 3, 1), (w - 2, 2), (1, h - 2), (w - 2, h - 2)):
        a[y, x] = _c('fx_ice', 3)
    return _img(a)


def _poly_mask(w, h, pts):
    xs, ys = _grid(w, h)
    inside = np.zeros((h, w), bool)
    n = len(pts)
    for i in range(n):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        cond = ((y0 > ys) != (y1 > ys)) & (xs < (x1 - x0) * (ys - y0) / (y1 - y0 + 1e-9) + x0)
        inside ^= cond
    return inside


def shard(k):
    a = _new(6, 6)
    g = np.random.default_rng(100 + k)
    m = 3 + k % 2
    pts = []
    for j in range(m):
        th = 2 * math.pi * j / m + g.uniform(-0.4, 0.4) + k
        rr = g.uniform(1.8, 3.0)
        pts.append((3 + rr * math.cos(th), 3 + rr * math.sin(th)))
    inside = _poly_mask(6, 6, pts)
    if inside.sum() < 4:
        inside[2:4, 2:4] = True
    a[inside] = _c('fx_ice', 2)
    xs, ys = _grid(6, 6)
    a[inside & (xs + ys < 5.5)] = _c('fx_ice', 3)
    a[inside & (xs + ys > 8)] = _c('fx_ice', 1)
    return _img(a)


def poison_bubble(frame):
    """Poison: a 5 × 6 bubble rising and popping, 3 frames."""
    a = _new(5, 6)
    if frame < 2:
        y = 3.5 - frame
        _dot(a, 2.5, y, _c('fx_poison', 2), 1.8)
        _dot(a, 2.5, y, -1, 0.9) if frame == 1 else _dot(a, 2.5, y, _c('fx_poison', 1), 0.9)
        a[int(y) - 1, 1] = _c('fx_poison', 3)
    else:
        for (x, y) in ((0, 1), (4, 1), (1, 0), (3, 0), (0, 3), (4, 3)):
            a[y, x] = _c('fx_poison', 2)
    return _img(a)


def wind_gust(frame):
    """Wind: 3 gust lines 24 × 12 that curl at their front, 4 at 24 fps (drawn blowing right)."""
    a = _new(24, 12)
    for k, y in enumerate((2, 6, 10)):
        x0 = 2 + frame * 3 - k * 2
        ln = 10 + (k % 2) * 4 - frame
        for x in range(max(0, x0), min(23, x0 + ln)):
            a[y, x] = _c('fx_wind', 2) if x > x0 + ln // 2 else _c('fx_wind', 1)
        xe = min(23, x0 + ln)
        if 0 <= xe < 24 and y - 1 >= 0:
            a[y - 1, min(23, xe)] = _c('fx_wind', 2)
    return _img(a)


def chain_spark(frame):
    """Lightning chain ends: a 6 × 6 spark, 2 frames."""
    a = _new(6, 6)
    c, core = _c('fx_bolt', 2), _c('fx_bolt', 3)
    if frame == 0:
        a[2:4, :] = c
        a[:, 2:4] = c
    else:
        for i in range(6):
            a[i, i] = a[i, 5 - i] = c
    a[2:4, 2:4] = core
    return _img(a)


# --- S-grade signature effects (white/grey: tinted by the code with the weapon's element) -----------------------

def floor_wave(w, h, frame, crest=True):
    """Greatsword Ground Wave 16 × 20 / War Maul Quake 16 × 16: a travelling floor wave, 4 frames loop."""
    a = _new(w, h)
    xs, ys = _grid(w, h)
    ph = frame * math.pi / 2
    top = h - (h * 0.75) * (0.75 + 0.25 * np.sin(xs / w * math.pi * 2.0 + ph)) * np.sin(xs / w * math.pi)
    body = ys > top
    a[body] = GREY
    a[body & (ys < top + 2)] = WHITE
    if not crest:                          # Quake: rock chips instead of a crest
        a[(ys < top + 2) & ((xs.astype(int) + frame) % 4 == 0)] = -1
    return _img(a)


def phantom_edge(frame):
    """Katana Phantom Edge: a 32 × 12 slash line that bursts along the path (the code stretches it), 5 frames."""
    w, h = 32, 12
    a = _new(w, h)
    xs, ys = _grid(w, h)
    if frame < 2:
        half = [0.8, 1.4][frame]
        m = np.abs(ys - 6) < half
        a[m] = WHITE
    else:
        t = (frame - 1) / 3
        for k in range(8):
            cx = 2 + k * 4
            rr = 1.5 + 3.5 * t
            ring = np.abs(np.sqrt((xs - cx) ** 2 + (ys - 6) ** 2) - rr) < 0.6
            a[ring & ((xs.astype(int) + ys.astype(int) + k) % (1 + frame - 1) == 0)] = GREY if frame == 4 else WHITE
        a[np.abs(ys - 6) < 0.5] = GREY if frame < 4 else -1
    return _img(a)


def thunderclap(frame):
    """Iron Fists Thunderclap: a 96 × 48 forward blast (cone of rings), 5 frames."""
    w, h = 96, 48
    a = _new(w, h)
    xs, ys = _grid(w, h)
    t = (frame + 1) / 5
    for k in range(3):
        rr = (14 + k * 14) * (0.4 + 0.6 * t)
        d = np.sqrt(((xs - 6) / 1.4) ** 2 + (ys - 24) ** 2)
        cone = np.abs(ys - 24) < (xs - 2) * 0.55
        ring = (np.abs(d - rr) < 1.4) & cone
        a[ring] = WHITE if k == 0 else GREY
    if frame < 2:
        a[(np.sqrt((xs - 6) ** 2 + (ys - 24) ** 2) < 5 - frame * 2)] = WHITE
    if frame == 4:
        a[(xs.astype(int) + ys.astype(int)) % 2 == 0] = -1
    return _img(a)


def tempest(frame):
    """Storm Hammer Tempest: a 24 × 24 storm cloud with a flicker underneath, 4 frames loop."""
    a = _new(24, 24)
    for (x, y, r) in ((8, 9, 5), (14, 7, 6), (19, 10, 4), (12, 12, 5)):
        _dot(a, x + (frame % 2) * 0.5, y, GREY, r)
    for (x, y, r) in ((9, 7, 2.5), (14, 5, 3)):
        _dot(a, x, y, WHITE, r)
    if frame in (1, 3):                    # a little bolt under the cloud
        xs = [12, 10, 13, 11]
        for i in range(3):
            R_line(a, xs[i], 16 + i * 2.5, xs[i + 1], 18.5 + i * 2.5, WHITE)
    return _img(a)


def singularity(frame):
    """Staff Singularity: a pull swirl around the orb, 128 × 128 (64 px radius), 4 frames loop."""
    w = h = 128
    a = _new(w, h)
    xs, ys = _grid(w, h)
    d = np.sqrt((xs - 64) ** 2 + (ys - 64) ** 2)
    ang = np.arctan2(ys - 64, xs - 64)
    for k in range(4):                     # 4 spiral arms, turning inward
        spiral = ((ang + d / 14 + frame * math.pi / 8 + k * math.pi / 2) % (2 * math.pi)) < 0.22
        a[spiral & (d < 62) & (d > 6)] = GREY if k % 2 else WHITE
    a[np.abs(d - 62) < 0.6] = GREY
    return _img(a)


# --- loot effects ------------------------------------------------------------------------------------------------

QMARK = ['.###.', '#...#', '...#.', '..#..', '.....', '..#..']


def lucky_break(frame):
    """The Lucky Block bursting into gold shards with a "?" pop, 24 × 24, 6 frames."""
    a = _new(24, 24)
    t = frame / 5
    for k in range(8):
        th = 2 * math.pi * k / 8 + 0.2
        dist = 3 + 9 * t
        x, y = 12 + dist * math.cos(th), 12 + dist * math.sin(th) + 6 * t * t
        if frame < 5:
            _dot(a, x, y, _c('w_gold', 2 if k % 2 else 1), 1.4 - 0.2 * frame)
    if 1 <= frame <= 4:                    # the "?" pops up
        oy = 9 - frame * 1.5
        for yy, row in enumerate(QMARK):
            for xx, ch in enumerate(row):
                if ch == '#':
                    a[int(oy) + yy, 10 + xx] = WHITE
    if frame == 0:
        _dot(a, 12, 12, WHITE, 4)
    if frame == 5:                         # last sparkles
        for (x, y) in ((4, 18), (20, 17), (12, 21)):
            a[y, x] = _c('w_gold', 2)
    return _img(a)


def chest_open(frame, cursed):
    """A light burst from the lid, 24 × 16, 4 frames: gold, or purple for the cursed chest."""
    ramp = 'fx_dark' if cursed else 'w_gold'
    a = _new(24, 16)
    xs, ys = _grid(24, 16)
    t = (frame + 1) / 4
    ang = np.arctan2(15 - ys, xs - 12)
    d = np.sqrt((xs - 12) ** 2 + (ys - 15) ** 2)
    rays = (np.abs(np.sin(ang * 5)) > 0.85) & (d < 4 + 11 * t) & (d > 2 + 6 * t)
    a[rays] = _c(ramp, 2)
    a[(d < 4 - frame) & (ys > 12)] = _c(ramp, len(P.RAMPS[ramp]) - 1)
    return _img(a)


def aura(frame, bad):
    """A thin ring rising around the player for the moment a Lucky Block result lands, 32 × 48, 6 frames."""
    ramp = 'fx_dark' if bad else 'w_gold'
    a = _new(32, 48)
    xs, ys = _grid(32, 48)
    t = frame / 5
    cy = 44 - 36 * t
    ring = np.abs(((xs - 16) / 13) ** 2 + ((ys - cy) / 3.5) ** 2 - 1) < 0.22
    a[ring] = _c(ramp, 2)
    a[ring & (ys > cy)] = _c(ramp, len(P.RAMPS[ramp]) - 1)
    if frame >= 4:
        a[(xs.astype(int) + ys.astype(int)) % 2 == 0] = -1
    for k in range(4):                     # a few motes rising with it
        x = 6 + k * 7
        y = int(cy - 4 - (k % 2) * 5)
        if 0 <= y < 48:
            a[y, x] = _c(ramp, 2)
    return _img(a)


SIGNATURES = {'sig_ground_wave': ((16, 20), 4, 'loop', 12), 'sig_phantom_edge': ((32, 12), 5, 'once', 24),
              'sig_quake': ((16, 16), 4, 'loop', 12), 'sig_thunderclap': ((96, 48), 5, 'once', 24),
              'sig_tempest': ((24, 24), 4, 'loop', 8), 'sig_singularity': ((128, 128), 4, 'loop', 12)}


def frames():
    fr = {}
    for e in ELEMENTS:
        for i in range(3):
            fr[f'hit_{e}_{i:02d}'] = elem_hit(e, i)
    for i in range(3):
        fr[f'burn_flame_{i:02d}'] = burn_flame(i)
        fr[f'chill_frost_{i:02d}'] = chill_frost(i)
        fr[f'poison_bubble_{i:02d}'] = poison_bubble(i)
    fr['freeze_block_00'] = freeze_block()
    for k in range(8):
        fr[f'shatter_shards_{k:02d}'] = shard(k)
    for i in range(4):
        fr[f'wind_gust_{i:02d}'] = wind_gust(i)
    for i in range(2):
        fr[f'chain_spark_{i:02d}'] = chain_spark(i)
    for i in range(4):
        fr[f'sig_ground_wave_{i:02d}'] = floor_wave(16, 20, i)
        fr[f'sig_quake_{i:02d}'] = floor_wave(16, 16, i, crest=False)
        fr[f'sig_tempest_{i:02d}'] = tempest(i)
        fr[f'sig_singularity_{i:02d}'] = singularity(i)
        fr[f'chest_open_{i:02d}'] = chest_open(i, False)
        fr[f'chest_open_cursed_{i:02d}'] = chest_open(i, True)
    for i in range(5):
        fr[f'sig_phantom_edge_{i:02d}'] = phantom_edge(i)
        fr[f'sig_thunderclap_{i:02d}'] = thunderclap(i)
    for i in range(6):
        fr[f'lucky_break_{i:02d}'] = lucky_break(i)
        fr[f'buff_aura_{i:02d}'] = aura(i, False)
        fr[f'debuff_aura_{i:02d}'] = aura(i, True)
    return fr


def anims():
    out = [A.anim(f'hit_{e}', ATLAS, 3, 'once', 30) for e in ELEMENTS]
    out += [A.anim('burn_flame', ATLAS, 3, 'loop', 12), A.anim('chill_frost', ATLAS, 3, 'loop', 8),
            A.anim('poison_bubble', ATLAS, 3, 'once', 8), A.anim('freeze_block', ATLAS, 1, 'once'),
            A.anim('shatter_shards', ATLAS, 8, 'once', 1), A.anim('wind_gust', ATLAS, 4, 'once', 24),
            A.anim('chain_spark', ATLAS, 2, 'loop', 20)]
    out += [A.anim(k, ATLAS, n, mode, fps) for k, (_s, n, mode, fps) in SIGNATURES.items()]
    out += [A.anim('lucky_break', ATLAS, 6, 'once', 24), A.anim('chest_open', ATLAS, 4, 'once', 20),
            A.anim('chest_open_cursed', ATLAS, 4, 'once', 20), A.anim('buff_aura', ATLAS, 6, 'once', 20),
            A.anim('debuff_aura', ATLAS, 6, 'once', 20)]
    return out
