"""Parallax backgrounds (08 §10.1). Every shape repeats every 640 px, so the layers tile seamlessly."""
import math
import zlib

import numpy as np
from PIL import Image

from . import palette as P

W, H = 640, 360
ALLOWED = {0: ['pl_sky', 'pl_bg0'], 1: ['pl_bg1'], 2: ['pl_bg2']}
SKY = {'village_home': 'vh_sky', 'village_crossroads': 'vc_sky'}


def allowed_for(set_name, layer):
    if set_name == 'plains':
        return ALLOWED[layer]
    return {0: [SKY[set_name], 'pl_bg0', 'pl_bg1', 'vl_light'], 1: ['pl_bg0', 'pl_bg1', 'vl_light'],
            2: ['pl_bg2', 'vl_light']}[layer]


def _rng(asset_id):
    return np.random.default_rng(zlib.crc32(asset_id.encode()))


def _wrap(dx):
    """Circular distance in the 640 px period."""
    return (dx + W / 2) % W - W / 2


def _wave(x, terms):
    return sum(a * np.sin(2 * math.pi * k * x / W + ph) for k, a, ph in terms)


def _paint(img, mask, col):
    img[mask, :3] = col
    img[mask, 3] = 255


def _fill_below(img, xs, top, dark, light, rim=3):
    """Fill every column below `top` with `dark`; the top `rim` px in `light`, 2 px checker between."""
    h = img.shape[0]
    ys = np.arange(h)[:, None]
    t = np.round(top).astype(int)[None, :]
    below = ys >= t
    _paint(img, below, dark)
    _paint(img, below & (ys < t + rim), light)
    checker = ((ys + xs[None, :]) % 2 == 0)
    _paint(img, below & (ys >= t + rim) & (ys < t + rim + 2) & checker, light)


def render(set_name, layer, width=W):
    if set_name == 'swamps':
        return render_swamps(layer, width)
    if set_name in ('mountains', 'mountains_cave'):
        return render_mountains(set_name, layer, width)
    if set_name != 'plains':
        return render_village(set_name, layer, width)
    xs = np.arange(width)
    img = np.zeros((H, width, 4), np.uint8)
    ys = np.arange(H)[:, None]
    if layer == 0:
        sky = P.RAMPS['pl_sky']
        band = 44
        for i, col in enumerate(sky):
            _paint(img, np.broadcast_to((ys >= i * band), (H, width)), col)
        # a few flat clouds in the lightest band color
        g = _rng('bg_plains_0_clouds')
        for _ in range(5):
            cx, cy = g.integers(0, W), g.integers(40, 150)
            ln, th = g.integers(40, 90), g.integers(4, 8)
            dx = np.abs(_wrap(xs[None, :] - cx))
            body = (dx < ln / 2) & (np.abs(ys - cy) < th / 2 + 2 * np.cos(np.minimum(dx / ln * math.pi, math.pi / 2)))
            _paint(img, body, sky[5])
            _paint(img, body & (ys >= cy + th / 2 - 1), sky[4])
        top = 238 + _wave(xs, [(1, 14, 0.4), (3, 9, 1.9), (7, 4, 0.2)])
        _fill_below(img, xs, top, P.RAMPS['pl_bg0'][0], P.RAMPS['pl_bg0'][1], rim=2)
        return Image.fromarray(img, 'RGBA')
    if layer == 1:
        g = _rng('bg_plains_1_forest')
        top = np.full(width, 1e9)
        n = 26
        for k in range(n):
            cx = k * W / n + g.uniform(-6, 6)
            r = g.uniform(12, 22)
            cy = 272 + g.uniform(-10, 6)
            dx = np.abs(_wrap(xs - cx))
            cap = np.where(dx < r, cy - np.sqrt(np.maximum(r * r - dx * dx, 0)), 1e9)
            top = np.minimum(top, cap)
        top = np.minimum(top, 290 + _wave(xs, [(2, 4, 0.0)]))
        _fill_below(img, xs, top, P.RAMPS['pl_bg1'][0], P.RAMPS['pl_bg1'][1], rim=3)
        return Image.fromarray(img, 'RGBA')
    if layer == 2:
        dark, light = P.RAMPS['pl_bg2']
        g = _rng('bg_plains_2_trees')
        trees = [(k * W / 4 + g.uniform(-40, 40), g.uniform(46, 58)) for k in range(4)]
        # trunks
        for cx, r in trees:
            dx = _wrap(xs[None, :] - cx)
            tw = 4 + r / 8 + np.maximum(0, ys - 300) * 0.18
            _paint(img, (np.abs(dx) < tw) & (ys > 150), dark)
            _paint(img, (dx > -tw) & (dx < -tw + 2) & (ys > 150) & ((ys + xs[None, :]) % 2 == 0), light)
            for side, by in ((-1, 215), (1, 200)):          # two branches
                bdx = dx - side * (ys - by) * -0.9
                _paint(img, (np.abs(bdx) < 2.5) & (ys < by) & (ys > by - 26), dark)
        # canopies: clusters of discs, lit top-left
        for cx, r in trees:
            for j in range(12):
                ox, oy = g.uniform(-r, r), g.uniform(-r * 0.45, r * 0.35)
                rr = g.uniform(r * 0.35, r * 0.6)
                dx = _wrap(xs[None, :] - (cx + ox))
                dy = ys - (160 + oy)
                d = dx * dx + dy * dy
                _paint(img, d < rr * rr, dark)
                _paint(img, (d < rr * rr) & ~((dx - 2) ** 2 + (dy - 2) ** 2 < (rr - 1) ** 2) & (dx < 2) & (dy < 2),
                       light)
        # near ground strip
        top = 334 + _wave(xs, [(3, 3, 1.0), (8, 2, 0.5)])
        _fill_below(img, xs, top, dark, light, rim=2)
        return Image.fromarray(img, 'RGBA')
    raise ValueError(layer)


MT_ALLOWED = {
    'mountains': {0: ['mt_sky', 'mt_bg0'], 1: ['mt_bg1'], 2: ['mt_bg2']},
    'mountains_cave': {0: ['mtc_sky', 'mtc_bg0'], 1: ['mtc_bg1'], 2: ['mtc_bg2']},
}


def _peaks(xs, g, n, base, hmin, hmax, wmin, wmax, jag=0.0):
    """Top edge (y per column) of n periodic triangular peaks."""
    top = np.full(len(xs), 1e9)
    for k in range(n):
        cx = k * W / n + g.uniform(-W / n / 4, W / n / 4)
        h, w = g.uniform(hmin, hmax), g.uniform(wmin, wmax)
        d = np.abs(_wrap(xs - cx))
        top = np.minimum(top, np.where(d < w, base - h * (1 - d / w), 1e9))
    top = np.minimum(top, base + 8)
    if jag:
        top = top + _wave(xs, [(23, jag, 0.3), (41, jag / 2, 1.7)])
    return top


def _hang(xs, g, n, hmin, hmax, wmin, wmax):
    """Bottom edge (y per column) of n periodic stalactites hanging from y = 0."""
    bot = np.zeros(len(xs))
    for k in range(n):
        cx = k * W / n + g.uniform(-W / n / 3, W / n / 3)
        h, w = g.uniform(hmin, hmax), g.uniform(wmin, wmax)
        d = np.abs(_wrap(xs - cx))
        bot = np.maximum(bot, np.where(d < w, h * np.clip(1 - d / w, 0, 1) ** 0.8, 0))
    return bot


SW_ALLOWED = {0: ['sw_sky', 'sw_bg0'], 1: ['sw_bg1'], 2: ['sw_bg2']}


def _disc(img, xs, cx, cy, r, col):
    y0, y1 = max(0, int(cy - r) - 1), min(img.shape[0], int(cy + r) + 2)
    if y1 <= y0:
        return
    ys = np.arange(y0, y1)[:, None]
    dx = _wrap(xs[None, :] - cx)
    sub = img[y0:y1]
    m = dx * dx + (ys - cy) ** 2 <= r * r
    sub[m, :3] = col
    sub[m, 3] = 255


def _dead_tree(img, xs, g, cx, base, height, tw, col, light=None):
    """A dead tree: tapering trunk, bare forked branches; periodic in x."""
    for y in range(int(base - height), int(base) + 1):
        t = (y - (base - height)) / height
        r = max(1.0, tw * (0.25 + 0.75 * t))
        _disc(img, xs, cx + 2.5 * math.sin(y / 23.0 + cx), y, r, col)
    for k in range(4 + int(height > 150)):
        side = 1 if k % 2 == 0 else -1
        y0 = base - height * g.uniform(0.35, 0.9)
        ang = g.uniform(0.35, 1.0)
        ln = g.uniform(height * 0.18, height * 0.42)
        x, y, r = cx, y0, max(1.2, tw * 0.32)
        for s in range(int(ln)):
            x += side * math.cos(ang) * 1.0
            y -= math.sin(ang) * 1.0 + 0.1
            ang += g.uniform(-0.06, 0.1) * (1 if s % 9 else 3)
            _disc(img, xs, x, y, max(0.8, r * (1 - s / ln)), col)
            if s == int(ln * 0.55):                       # fork
                x2, y2, a2 = x, y, ang + 0.7
                for q in range(int(ln * 0.45)):
                    x2 += side * math.cos(a2)
                    y2 -= math.sin(a2)
                    _disc(img, xs, x2, y2, 0.9, col)


def _fog(img, xs, y, thick, col, phase=0.0):
    """A band of fog: a 2 px checker dither that thins out toward its edges."""
    ys = np.arange(img.shape[0])[:, None]
    center = y + 5 * np.sin(2 * math.pi * 2 * xs / W + phase)
    d = np.abs(ys - center[None, :])
    checker = (ys + xs[None, :]) % 2 == 0
    _paint(img, (d < thick / 2) & checker & ((d < thick / 4) | (xs[None, :] % 4 == 0)), col)


def render_swamps(layer, width=W):
    xs = np.arange(width)
    img = np.zeros((H, width, 4), np.uint8)
    ys = np.arange(H)[:, None]
    sky, c0, c1, c2 = (P.RAMPS['sw_sky'], P.RAMPS['sw_bg0'], P.RAMPS['sw_bg1'], P.RAMPS['sw_bg2'])
    g = _rng(f'bg_swamps_{layer}')
    if layer == 0:
        for i, col in enumerate(sky):
            _paint(img, np.broadcast_to((ys >= i * 60), (H, width)), col)
        for k in range(9):                                # far thin dead trees
            _dead_tree(img, xs, g, k * W / 9 + g.uniform(-18, 18), 300, g.uniform(150, 210), 3.0, c0[0])
        _fog(img, xs, 250, 26, c0[1], 0.4)
        _fill_below(img, xs, 302 + _wave(xs, [(2, 3, 0.4), (5, 2, 1.0)]), c0[0], c0[1], rim=2)
        return Image.fromarray(img, 'RGBA')
    if layer == 1:
        for k in range(6):
            _dead_tree(img, xs, g, k * W / 6 + g.uniform(-24, 24), 318, g.uniform(170, 250), 5.5, c1[0])
        _fog(img, xs, 296, 20, c1[1], 1.4)
        _fill_below(img, xs, 322 + _wave(xs, [(3, 3, 0.2), (7, 2, 0.9)]), c1[0], c1[1], rim=2)
        return Image.fromarray(img, 'RGBA')
    dark, lit = c2
    for k in range(3):
        cx = k * W / 3 + g.uniform(-30, 30)
        _dead_tree(img, xs, g, cx, 342, g.uniform(260, 330), 9.0, dark)
    _fog(img, xs, 316, 18, lit, 2.4)
    _fill_below(img, xs, 338 + _wave(xs, [(3, 2, 1.0), (8, 1.5, 0.5)]), dark, lit, rim=2)
    return Image.fromarray(img, 'RGBA')


def render_mountains(set_name, layer, width=W):
    cave = set_name == 'mountains_cave'
    xs = np.arange(width)
    img = np.zeros((H, width, 4), np.uint8)
    ys = np.arange(H)[:, None]
    pre = 'mtc' if cave else 'mt'
    sky, c0, c1, c2 = P.RAMPS[pre + '_sky'], P.RAMPS[pre + '_bg0'], P.RAMPS[pre + '_bg1'], P.RAMPS[pre + '_bg2']
    g = _rng(f'bg_{set_name}_{layer}')
    if layer == 0:
        for i, col in enumerate(sky):
            _paint(img, np.broadcast_to((ys >= i * 60), (H, width)), col)
        if cave:        # far stalactites and a floor line
            bot = _hang(xs, g, 9, 30, 80, 22, 40)
            _paint(img, ys < np.round(bot)[None, :], c0[0])
            _paint(img, (ys < np.round(bot)[None, :]) & (ys >= np.round(bot)[None, :] - 2), c0[1])
            _fill_below(img, xs, 300 + _wave(xs, [(2, 5, 0.4), (5, 3, 1.1)]), c0[0], c0[1], rim=2)
        else:           # snowy far peaks
            top = _peaks(xs, g, 5, 262, 90, 150, 70, 110, jag=1.5)
            _fill_below(img, xs, top, c0[1], c0[0], rim=1)
            # shade the right-facing flank of each peak in the darker color (light from the upper left)
            t = np.round(top).astype(int)[None, :]
            below = ys >= t
            slope = np.concatenate([top[1:], top[:1]]) - top
            _paint(img, below & (slope[None, :] < -0.2) & (ys < t + 40 + 0 * xs[None, :]), c0[0])
        return Image.fromarray(img, 'RGBA')
    if layer == 1:
        if cave:
            bot = np.round(_hang(xs, g, 12, 40, 110, 14, 30)).astype(int)[None, :]
            _paint(img, ys < bot, c1[0])
            _paint(img, (ys < bot) & (ys >= bot - 2), c1[1])
            _fill_below(img, xs, 316 + _wave(xs, [(3, 4, 0.2), (7, 2, 0.9)]), c1[0], c1[1], rim=2)
        else:           # rocky ridges
            top = _peaks(xs, g, 9, 296, 40, 80, 38, 60, jag=1.2)
            _fill_below(img, xs, top, c1[0], c1[1], rim=3)
        return Image.fromarray(img, 'RGBA')
    dark, lit = c2
    if cave:            # pillars floor to ceiling
        for k in range(5):
            cx = k * W / 5 + g.uniform(-24, 24)
            wd = g.uniform(8, 14)
            dx = _wrap(xs[None, :] - cx)
            body = np.abs(dx) < wd + 0.06 * np.abs(ys - 180)
            _paint(img, body, dark)
            _paint(img, body & (dx < -wd + 3 - 0.06 * np.abs(ys - 180)) & ((ys + xs[None, :]) % 2 == 0), lit)
        bot = np.round(_hang(xs, g, 7, 20, 50, 12, 24)).astype(int)[None, :]
        _paint(img, ys < bot, dark)
        _paint(img, (ys < bot) & (ys >= bot - 1), lit)
        _fill_below(img, xs, 336 + _wave(xs, [(3, 2, 1.0), (7, 1.5, 0.5)]), dark, lit, rim=2)
        return Image.fromarray(img, 'RGBA')
    # pines: stacked triangle tiers, trunks, a ground strip
    for k in range(9):
        cx = k * W / 9 + g.uniform(-14, 14)
        base = 330 + g.uniform(-4, 4)
        hgt = g.uniform(70, 110)
        tiers = 5
        for ti in range(tiers):
            ty = base - hgt * (ti + 1) / tiers
            half = (hgt / tiers) * 0.9 * (tiers - ti) / 1.6 + 3
            dx = np.abs(_wrap(xs[None, :] - cx))
            y0 = ty - hgt / tiers * 1.4
            mask = (dx < half * np.clip((ys - y0) / (hgt / tiers * 1.4 + 1), 0, 1)) & (ys >= y0) & (ys < ty + 4)
            _paint(img, mask, dark)
            _paint(img, mask & (_wrap(xs[None, :] - cx) < -half * 0.45 * np.clip((ys - y0) / 12, 0, 1)) & (ys < ty - 1)
                   & ((ys + xs[None, :]) % 2 == 0), lit)
        _paint(img, (np.abs(_wrap(xs[None, :] - cx)) < 2) & (ys >= base - 10) & (ys < base + 12), dark)
    _fill_below(img, xs, 338 + _wave(xs, [(3, 2, 1.0), (8, 1.5, 0.5)]), dark, lit, rim=2)
    return Image.fromarray(img, 'RGBA')


def _box(img, xs, x0, x1, y0, y1, col):
    """Axis-aligned box repeated every 640 px (x0/x1 in the 0..640 period)."""
    ys = np.arange(img.shape[0])[:, None]
    dx = (xs[None, :] - x0) % W
    _paint(img, (dx < (x1 - x0)) & (ys >= y0) & (ys < y1), col)


def _tri(img, xs, cx, half, y_base, height, col):
    """Roof triangle centered on cx (periodic)."""
    ys = np.arange(img.shape[0])[:, None]
    d = np.abs(_wrap(xs[None, :] - cx))
    top = y_base - height * (1 - d / half)
    _paint(img, (d < half) & (ys >= top) & (ys < y_base), col)


def render_village(set_name, layer, width=W):
    xs = np.arange(width)
    img = np.zeros((H, width, 4), np.uint8)
    ys = np.arange(H)[:, None]
    bg0, bg1, bg2, light = P.RAMPS['pl_bg0'], P.RAMPS['pl_bg1'], P.RAMPS['pl_bg2'], P.RAMPS['vl_light']
    home = set_name == 'village_home'
    if layer == 0:
        sky = P.RAMPS[SKY[set_name]]
        for i, col in enumerate(sky):
            _paint(img, np.broadcast_to((ys >= i * 44), (H, width)), col)
        # low sun near the horizon (dawn on the right, sunset on the left)
        sx = 470 if home else 170
        dx = _wrap(xs[None, :] - sx)
        _paint(img, dx * dx + (ys - 214) ** 2 < 26 ** 2, light[1])
        _paint(img, (dx * dx + (ys - 214) ** 2 < 26 ** 2) & (dx * dx + (ys - 214) ** 2 >= 23 ** 2), light[0])
        if not home:
            # far left: mountain peaks; far right: a dark forest (the two roads lead there)
            for cx, hgt, half in ((90, 70, 60), (150, 95, 70), (215, 60, 50)):
                _tri(img, xs, cx, half, 250, hgt, bg0[1])
                _tri(img, xs, cx, half * 0.35, 250 - hgt * 0.65, hgt * 0.35, sky[5])
            for k in range(14):
                cx = 400 + k * 13
                _tri(img, xs, cx, 9, 252, 26 + (k * 7) % 11, bg1[0])
        top = 240 + _wave(xs, [(1, 10, 1.1), (3, 6, 0.3), (6, 3, 2.0)])
        _fill_below(img, xs, top, bg0[0], bg0[1], rim=2)
        if not home:
            # the crossroads: one road climbs the hills and forks, left to the mountains, right to the forest
            for x in range(width):
                d = _wrap(x - 320)
                ad = abs(d)
                if ad > 230:
                    continue
                y = 257 - ad * 0.05
                half = 3.0 - ad / 230 * 2.2
                y0, y1 = int(round(y - half / 2)), int(round(y + half / 2)) + 1
                img[y0:y1, x, :3] = sky[5]
                img[y0:y1, x, 3] = 255
            for y in range(257, 262):                      # the shared stem toward the viewer
                half = 1 + (y - 257) * 0.8
                m = np.abs(_wrap(xs - 320)) < half
                img[y, m, :3] = sky[5]
                img[y, m, 3] = 255
        return Image.fromarray(img, 'RGBA')
    if layer == 1:
        base = 300 + _wave(xs, [(2, 3, 0.4), (5, 2, 1.3)])
        _fill_below(img, xs, base, bg1[0], bg1[1], rim=2)
        g = _rng(f'bg_{set_name}_1')
        n = 7 if home else 9
        for k in range(n):
            cx = k * W / n + g.uniform(-12, 12)
            if home:
                wdt, hgt = g.uniform(40, 56), g.uniform(30, 40)
                _box(img, xs, (cx - wdt / 2) % W, (cx - wdt / 2) % W + wdt, 300 - hgt, 304, bg1[0])
                _tri(img, xs, cx, wdt / 2 + 6, 300 - hgt + 1, 22, bg1[1])
                # chimney and smoke
                chx = (cx + wdt / 4) % W
                _box(img, xs, chx, chx + 5, 300 - hgt - 18, 300 - hgt - 2, bg1[0])
                for j in range(4):
                    sx, sy, r = chx + 3 + j * 4, 300 - hgt - 24 - j * 9, 3 + j
                    dx = _wrap(xs[None, :] - sx)
                    _paint(img, dx * dx + (ys - sy) ** 2 < r * r, bg0[1])
                for wx in (cx - wdt / 4, cx + wdt / 6):
                    _box(img, xs, (wx - 3) % W, (wx - 3) % W + 6, 300 - hgt + 12, 300 - hgt + 19, light[0])
            else:
                # market street: stalls with striped awnings
                wdt = g.uniform(44, 60)
                x0 = (cx - wdt / 2) % W
                _box(img, xs, x0, x0 + wdt, 266, 304, bg1[0])
                for j in range(int(wdt // 8)):
                    _box(img, xs, (x0 + j * 8) % W, (x0 + j * 8) % W + 4, 260, 270, bg1[1])
                _box(img, xs, x0 - 3, x0 + wdt + 3, 258, 261, bg1[1])
                _box(img, xs, (x0 + 6) % W, (x0 + 6) % W + wdt - 12, 278, 284, light[0])
        return Image.fromarray(img, 'RGBA')
    if layer == 2:
        dark, lit = bg2
        top = 336 + _wave(xs, [(3, 2, 1.0), (7, 1.5, 0.5)])
        _fill_below(img, xs, top, dark, lit, rim=2)
        if home:
            # fence along the ground and a few round trees
            for k in range(40):
                px = k * 16
                _box(img, xs, px, px + 3, 316, 340, dark)
            _box(img, xs, 0, W, 322, 325, lit)
            _box(img, xs, 0, W, 331, 333, dark)
            g = _rng('bg_village_home_2')
            for cx in (60, 300, 520):
                cx += g.uniform(-20, 20)
                _box(img, xs, (cx - 4) % W, (cx - 4) % W + 8, 250, 340, dark)
                for j in range(6):
                    ox, oy, rr = g.uniform(-26, 26), g.uniform(-14, 10), g.uniform(14, 22)
                    dx = _wrap(xs[None, :] - (cx + ox))
                    dy = ys - (232 + oy)
                    d = dx * dx + dy * dy
                    _paint(img, d < rr * rr, dark)
                    _paint(img, (d < rr * rr) & ~((dx - 2) ** 2 + (dy - 2) ** 2 < (rr - 1) ** 2) & (dx < 2) & (dy < 2),
                           lit)
        else:
            # lantern posts with warm lamps
            for k in range(4):
                px = 40 + k * 160
                _box(img, xs, px, px + 4, 262, 340, dark)
                _box(img, xs, px - 6, px + 10, 258, 262, dark)
                _box(img, xs, px - 5, px + 1, 262, 272, dark)
                _box(img, xs, px - 4, px, 264, 270, light[1])
                _box(img, xs, px - 3, px - 1, 265, 268, light[0])
        return Image.fromarray(img, 'RGBA')
    raise ValueError(layer)
