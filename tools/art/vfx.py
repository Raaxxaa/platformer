"""Stage 1 effect sprites (08 §11): hits, crit, stun stars, dust, muzzle, debris. No ink outline."""
import math
import os

import numpy as np

from . import atlas as A
from . import palette as P
from . import raster as R

ATLAS = 'vfx'
ALLOWED = ['white', 'trim', 'gray', 'fx_bolt', 'fx_fire', 'fx_ice', 'fx_heal', 'fx_dark', 'w_steel', 'w_gold', 'w_magic', 'fx_poison', 'fx_wind']
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


def ring(w, h, frame, frames, col, thick=1.0):
    """Expanding ellipse ring."""
    xs, ys = _grid(w, h)
    t = (frame + 1) / frames
    rx, ry = w / 2 * (0.4 + 0.6 * t) - 0.5, h / 2 * (0.4 + 0.6 * t) - 0.5
    d = np.sqrt(((xs - w / 2) / max(rx, 0.5)) ** 2 + ((ys - h / 2) / max(ry, 0.5)) ** 2)
    a = np.full((h, w), -1)
    a[(d <= 1) & (d >= 1 - thick / max(min(rx, ry), 1) - 0.12)] = col
    if frame == frames - 1:                       # last frame breaks up
        a[(xs.astype(int) + ys.astype(int)) % 2 == 0] = -1
    return _img(a)


def puffs(w, h, frame, frames, seed, cols, n=5, rise=0.0):
    g = np.random.default_rng(seed)
    a = np.full((h, w), -1)
    xs, ys = _grid(w, h)
    t = frame / max(frames - 1, 1)
    for k in range(n):
        cx = g.uniform(w * 0.2, w * 0.8)
        cy = g.uniform(h * 0.3, h * 0.8) - rise * t * h
        r = g.uniform(1.6, max(2.0, min(w, h) * 0.3)) * (1 - 0.5 * t)
        m = (xs - cx) ** 2 + (ys - cy) ** 2 < r * r
        a[m] = cols[0] if t < 0.6 else cols[1]
        a[m & ((xs - cx + 0.7) ** 2 + (ys - cy + 0.7) ** 2 < (r * 0.5) ** 2)] = cols[-1]
    return _img(a)


def solid(w, h, col, shape='rect'):
    a = np.full((h, w), col)
    if shape == 'plus':
        a[:] = -1
        a[h // 2, :] = col
        a[:, w // 2] = col
    elif shape == 'disc':
        xs, ys = _grid(w, h)
        a[(xs - w / 2) ** 2 + (ys - h / 2) ** 2 > (w / 2) ** 2] = -1
    return _img(a)


def impact(w, h, frame, frames):
    """Dive impact: a dust burst hugging the floor and rubble kicked up in a V."""
    a = np.full((h, w), -1)
    xs, ys = _grid(w, h)
    t = (frame + 1) / frames
    cx = w / 2
    # dust: a low wide mound that spreads and thins
    rx, ry = w / 2 * (0.35 + 0.65 * t), 3 + 5 * (1 - t) * t * 4 / 1.0
    m = ((xs - cx) / rx) ** 2 + ((ys - h) / max(ry, 1)) ** 2 < 1
    a[m] = _c('gray', 4) if t < 0.5 else _c('gray', 3)
    a[m & (((xs - cx) / rx) ** 2 + ((ys - h) / max(ry, 1)) ** 2 < 0.35)] = WHITE
    # rubble: chunks flying out in a V
    for k in range(6):
        side = -1 if k % 2 else 1
        sp = 0.5 + 0.25 * (k // 2)
        x = cx + side * (w * 0.42 * sp * t)
        y = h - 2 - (h * 1.4 * sp) * t * (1 - t)
        for dx in (0, 1):
            for dy in (0, 1):
                xi, yi = int(x) + dx, int(y) + dy
                if 0 <= xi < w and 0 <= yi < h:
                    a[yi, xi] = _c('gray', 1)
    if frame >= frames - 2:
        a[((xs.astype(int) + ys.astype(int)) % 2 == 0) & (a != _c('gray', 1))] = -1
    return _img(a)


def explosion(size, frame):
    """Fire ball for frames 0–2, then a smoke puff with fading embers that breaks up (frames 3–5)."""
    xs, ys = _grid(size, size)
    t = (frame + 1) / 6
    c = size / 2
    d = np.sqrt((xs - c) ** 2 + (ys - c) ** 2)
    r = c * (0.35 + 0.6 * min(1, t * 1.5))
    ang = np.arctan2(ys - c, xs - c)
    edge = r * (1 + 0.12 * np.sin(ang * 7 + frame))
    body = d < edge
    a = np.full((size, size), -1)
    if frame <= 2:
        a[body] = _c('fx_fire', 2)
        a[body & (d < edge * 0.7)] = _c('fx_fire', 3)
        a[body & (d < edge * 0.35)] = WHITE
        a[body & (d > edge * 0.88)] = _c('fx_fire', 1)
        return _img(a)
    k = frame - 3                                   # 0, 1, 2: smoke
    a[body] = _c('gray', 3 - k)
    a[body & (d < edge * 0.6) & (ang > 0)] = _c('gray', 2 - min(k, 1))
    if k == 0:
        a[body & (d < edge * 0.3)] = _c('fx_fire', 2)
    if k >= 1:
        holes = ((xs.astype(int) // 2 + ys.astype(int) // 2) % (3 - k + 1) == 0)
        a[body & holes] = -1
    return _img(a)


def smoke_column(frame):
    a = np.full((48, 32), -1)
    xs, ys = _grid(32, 48)
    t = frame / 5
    for k in range(6):
        cy = 44 - k * 8 - t * 10
        r = 6 + k * 0.6 - abs(t - 0.4) * 4
        m = (xs - 16 - np.sin(k + frame) * 2) ** 2 + (ys - cy) ** 2 < r * r
        a[m] = _c('fx_dark', 1 if k % 2 else 2)
        a[m & ((xs - 14) ** 2 + (ys - cy + 2) ** 2 < (r * 0.4) ** 2)] = _c('fx_dark', 3)
    if frame >= 4:
        a[(xs.astype(int) + ys.astype(int)) % 2 == 0] = -1
    return _img(a)


def sparks(size, frame, frames, cols):
    return star_burst(size, frame, frames, 6, cols[0], cols[1], cols[2] if len(cols) > 2 else None)


def dive_bolt(frame, w=32, h=160):
    """A lightning bolt from the sky (zigzag, fx_bolt with a white core): hammer dive 32 × 160, Thunder Strike 24 × 160."""
    a = np.full((h, w), -1, np.int16)
    g = np.random.default_rng(31 + frame)
    xs = [w / 2]
    for _ in range(h // 10):
        xs.append(float(np.clip(xs[-1] + g.uniform(-w / 5, w / 5), 6, w - 6)))
    width = [3, 2.5, 2, 1][frame]
    X, Y = _grid(w, h)
    for i in range(len(xs) - 1):
        y0, y1 = i * 10, (i + 1) * 10
        m = (Y >= y0) & (Y < y1)
        cx = xs[i] + (xs[i + 1] - xs[i]) * (Y - y0) / 10
        d = np.abs(X - cx)
        a[m & (d < width + 1.5)] = np.where(a[m & (d < width + 1.5)] < 0, _c('fx_bolt', 1), a[m & (d < width + 1.5)])
        a[m & (d < width)] = _c('fx_bolt', 3)
        if frame < 3:
            a[m & (d < max(0.6, width - 1.5))] = WHITE
    return _img(a)


# ART5 Task 5 — ability effects (08 §11 "Abilities")
SHOCK_R = (56, 64, 72, 84, 96)


def slash_line(frame):
    """Blade Dash: a 96 × 6 slash line that thins and breaks up."""
    w, h = 96, 6
    xs, ys = _grid(w, h)
    a = np.full((h, w), -1)
    half = [1.4, 1.0, 0.7][frame] * (0.3 + 0.7 * np.sin(np.pi * xs / w))
    m = np.abs(ys - h / 2) < half
    a[m] = GREY
    a[m & (np.abs(ys - h / 2) < half * 0.5) & (xs > w * 0.35)] = WHITE
    if frame == 2:
        a[(xs.astype(int) // 4) % 3 == 0] = -1
    return _img(a)


def spin_smear(frame):
    """Whirlwind: a 48 × 32 flat spinning smear around the body (two arcs, rotating)."""
    w, h = 48, 32
    xs, ys = _grid(w, h)
    nx, ny = (xs - w / 2) / (w / 2 - 1), (ys - h / 2) / (h / 2 - 3)
    d = np.sqrt(nx ** 2 + ny ** 2)
    ang = (np.arctan2(ny, nx) - frame * np.pi / 2) % (2 * np.pi)
    a = np.full((h, w), -1)
    arc = (d < 1) & (d > 0.78) & ((ang % np.pi) < np.pi * 0.62)
    a[arc] = GREY
    a[arc & (d > 0.9) & ((ang % np.pi) > np.pi * 0.25)] = WHITE
    return _img(a)


def ground_shock(R, frame):
    """Shockwave: a 2R × 44 ground shock, an expanding dust arc riding the floor with flying chips."""
    w, h = 2 * R, 44
    xs, ys = _grid(w, h)
    t = (frame + 1) / 5
    rx, ry = R * (0.3 + 0.7 * t), 40 * (0.3 + 0.7 * t) * (1 - 0.3 * t)
    d = np.sqrt(((xs - R) / rx) ** 2 + ((ys - h) / ry) ** 2)
    a = np.full((h, w), -1)
    band = (d < 1) & (d > 1 - 5 / ry)
    a[band] = _c('gray', 3)
    a[band & (d > 1 - 2 / ry)] = WHITE
    if frame == 4:
        a[(xs.astype(int) + ys.astype(int)) % 2 == 0] = -1
    g = np.random.default_rng(R)
    for k in range(6):
        cx = R + (k - 2.5) / 2.5 * rx * 0.9
        cy = h - 4 - g.uniform(4, 14) * t
        a[(np.abs(xs - cx) < 1) & (np.abs(ys - cy) < 1)] = _c('gray', 2)
    return _img(a)


def speed_lines(frame):
    """Shoulder Charge: 32 × 16 speed lines trailing behind the player."""
    w, h = 32, 16
    a = np.full((h, w), -1)
    g = np.random.default_rng(5 + frame)
    for y in (2, 5, 8, 11, 14):
        x0 = int(g.uniform(0, 12))
        ln = int(g.uniform(10, 20))
        a[y, x0:min(w, x0 + ln)] = WHITE if y in (5, 11) else GREY
    return _img(a)


def rubble(frame):
    """Wall broken: 16 × 16 rubble chunks flying out and falling."""
    w = h = 16
    xs, ys = _grid(w, h)
    a = np.full((h, w), -1)
    for k in range(5):
        th = -math.pi / 2 + (k - 2) * 0.55
        dist = 2 + frame * 2.4
        cx, cy = 8 + dist * math.cos(th) * 1.2, 8 + dist * math.sin(th) + frame * frame * 0.6
        r = 2.0 - frame * 0.3
        m = (np.abs(xs - cx) < r) & (np.abs(ys - cy) < r)
        a[m] = _c('gray', 2)
        a[m & (xs < cx) & (ys < cy)] = _c('gray', 3)
    return _img(a)


def rain_arrow():
    """Arrow Rain: one 4 × 12 arrow falling (head down)."""
    a = np.full((12, 4), -1)
    a[0:3, 0] = a[0:3, 3] = _c('w_gold', 2)
    a[0:10, 1:3] = _c('w_steel', 1)
    a[2:9, 1] = _c('w_steel', 2)
    a[9:12, 1:3] = _c('w_steel', 3)
    a[11, 1:3] = WHITE
    return _img(a)


def blink_puff(frame):
    """Blink: a 24 × 32 puff of arcane sparkles (both ends of the jump)."""
    return puffs(24, 32, frame, 4, 77, [_c('w_magic', 2), _c('w_magic', 1), WHITE], n=6, rise=0.25)


def reticle(frame, ramp):
    """Hunter's Mark: a 16 × 16 reticle above the head, closing in and pulsing."""
    w = h = 16
    xs, ys = _grid(w, h)
    d = np.sqrt((xs - 8) ** 2 + (ys - 8) ** 2)
    r = 6.5 - (frame % 2) * 0.7
    a = np.full((h, w), -1)
    ring_ = (d < r + 0.5) & (d > r - 0.7)
    gap = (np.abs(xs - 8) < 1.6) | (np.abs(ys - 8) < 1.6)
    a[ring_ & ~gap] = _c(ramp, 2)
    for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
        tick = (np.abs((xs - 8) * dx + (ys - 8) * dy - (r - 0.5)) < 1.6) & (np.abs((xs - 8) * dy - (ys - 8) * dx) < 0.6)
        a[tick] = _c(ramp, 3)
    a[(np.abs(xs - 8) < 0.6) & (np.abs(ys - 8) < 0.6)] = WHITE
    return _img(a)


def link_ring(frame):
    """Link: a 32 × 32 w_gold ring that expands and breaks up."""
    return ring(32, 32, frame, 4, _c('w_gold', 2), thick=1.5)


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
    # ---- ART4 additions (08 §11)
    rush2 = P.sid(P.UI_COLORS['rush2'])
    for i in range(4):
        fr[f'ring_djump_{i:02d}'] = ring(20, 6, i, 4, WHITE)
        fr[f'dust_walljump_{i:02d}'] = puffs(12, 12, i, 4, 21, [_c('gray', 4), _c('gray', 3), _c('white', 0)])
        fr[f'rush_up_{i:02d}'] = ring(32, 32, i, 4, rush2, 2)
    fr['dust_wall_00'] = solid(2, 2, _c('gray', 4))
    fr['dust_slide_00'] = solid(2, 2, _c('gray', 3))
    fr['dive_trail_00'] = solid(2, 12, WHITE)
    fr['charge_glow_00'] = solid(3, 3, WHITE, 'plus')
    fr['flask_orb_00'] = solid(4, 4, _c('fx_heal', 2), 'disc')
    fr['heal_00'] = solid(5, 5, _c('fx_heal', 2), 'plus')
    for i in range(5):
        fr[f'dive_impact_{i:02d}'] = impact(48, 16, i, 5)
        fr[f'dive_impact_heavy_{i:02d}'] = impact(64, 16, i, 5)
    for i in range(3):
        fr[f'dive_bounce_{i:02d}'] = star_burst(16, i, 3, 4, WHITE, _c('w_gold', 3))
        fr[f'spike_spark_{i:02d}'] = star_burst(16, i, 3, 5, _c('fx_heal', 3), _c('fx_heal', 1))
        fr[f'guard_spark_{i:02d}'] = star_burst(16, i, 3, 6, WHITE, _c('w_steel', 2))
        fr[f'charge_full_{i:02d}'] = star_burst(12, i, 3, 4, WHITE, _c('fx_bolt', 3))
        fr[f'dash_refund_{i:02d}'] = ring(16, 16, i, 3, _c('fx_ice', 2), 1.5)
    for i in range(6):
        fr[f'explosion_s_{i:02d}'] = explosion(56, i)
        fr[f'explosion_l_{i:02d}'] = explosion(96, i)
        fr[f'spawn_in_{i:02d}'] = smoke_column(i)
    for i in range(2):
        a = np.full((6, 6), -1)
        a[1:5, 1:5] = _c('fx_dark', 2)
        a[2:4, 2:4] = _c('fx_dark', 3)
        if i:
            a[1, 1] = a[4, 4] = -1
        else:
            a[1, 4] = a[4, 1] = -1
        fr[f'curse_wisps_{i:02d}'] = _img(a)
    for i in range(4):
        fr[f'hammer_dive_bolt_{i:02d}'] = dive_bolt(i)
    for i in range(3):
        fr[f'blade_dash_{i:02d}'] = slash_line(i)
        fr[f'shoulder_lines_{i:02d}'] = speed_lines(i)
    for i in range(4):
        fr[f'whirlwind_{i:02d}'] = spin_smear(i)
        fr[f'thunder_{i:02d}'] = dive_bolt(i, 24, 160)
        fr[f'blink_puff_{i:02d}'] = blink_puff(i)
        fr[f'mark_{i:02d}'] = reticle(i, 'fx_fire')
        fr[f'mark_linked_{i:02d}'] = reticle(i, 'w_gold')
        fr[f'link_{i:02d}'] = link_ring(i)
        fr[f'wall_rubble_{i:02d}'] = rubble(i)
    for R_ in SHOCK_R:
        for i in range(5):
            fr[f'ab_shockwave_{R_}_{i:02d}'] = ground_shock(R_, i)
    fr['arrow_rain_00'] = rain_arrow()
    anims = [A.anim('blade_dash', ATLAS, 3, 'once', 24), A.anim('whirlwind', ATLAS, 4, 'loop', 24),
             A.anim('shoulder_lines', ATLAS, 3, 'loop', 24), A.anim('wall_rubble', ATLAS, 4, 'once', 20),
             A.anim('arrow_rain', ATLAS, 1, 'once'), A.anim('thunder', ATLAS, 4, 'once', 30),
             A.anim('blink_puff', ATLAS, 4, 'once', 24), A.anim('mark', ATLAS, 4, 'loop', 8),
             A.anim('mark_linked', ATLAS, 4, 'loop', 8), A.anim('link', ATLAS, 4, 'once', 24)]
    anims += [A.anim(f'ab_shockwave_{R_}', ATLAS, 5, 'once', 24) for R_ in SHOCK_R]
    from . import vfx_elements as EL
    fr.update(EL.frames())
    anims += EL.anims()
    anims += [A.anim('hammer_dive_bolt', ATLAS, 4, 'once', 30), A.anim('hit_spark', ATLAS, 3, 'once', 30), A.anim('hit_heavy', ATLAS, 4, 'once', 30),
             A.anim('crit_spark', ATLAS, 4, 'once', 30), A.anim('stun_stars', ATLAS, 4, 'loop', 10),
             A.anim('dust_land', ATLAS, 4, 'once', 20), A.anim('dust_jump', ATLAS, 4, 'once', 20),
             A.anim('muzzle', ATLAS, 2, 'once', 30), A.anim('debris', ATLAS, 4, 'once'),
             A.anim('ring_djump', ATLAS, 4, 'once', 24), A.anim('dust_walljump', ATLAS, 4, 'once', 20),
             A.anim('dust_wall', ATLAS, 1, 'once'), A.anim('dust_slide', ATLAS, 1, 'once'),
             A.anim('dive_trail', ATLAS, 1, 'once'), A.anim('dive_impact', ATLAS, 5, 'once', 24),
             A.anim('dive_impact_heavy', ATLAS, 5, 'once', 24), A.anim('dive_bounce', ATLAS, 3, 'once', 24),
             A.anim('spike_spark', ATLAS, 3, 'once', 24), A.anim('guard_spark', ATLAS, 3, 'once', 30),
             A.anim('charge_glow', ATLAS, 1, 'once'), A.anim('charge_full', ATLAS, 3, 'once', 24),
             A.anim('explosion_s', ATLAS, 6, 'once', 24), A.anim('explosion_l', ATLAS, 6, 'once', 24),
             A.anim('flask_orb', ATLAS, 1, 'once'), A.anim('heal', ATLAS, 1, 'once'),
             A.anim('rush_up', ATLAS, 4, 'once', 24), A.anim('dash_refund', ATLAS, 3, 'once', 24),
             A.anim('spawn_in', ATLAS, 6, 'once', 12), A.anim('curse_wisps', ATLAS, 2, 'loop', 6)]
    return fr, anims


def build(assets, preview):
    from .projectiles import sheet
    fr, anims = build_frames()
    for n, img in fr.items():
        P.check_palette_lock(img, P.allowed(ALLOWED) | {P.UI_COLORS['rush2']}, ATLAS, n)
    A.pack_atlas(ATLAS, fr, os.path.join(assets, 'atlases'))
    sheet(fr, os.path.join(preview, 'vfx_sheet.png'), scale=5)
    return anims
