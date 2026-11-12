"""ART13b: one fully detailed example of the final look (the user asked to see how detailed the real game would be).

Stage 2, Dark Forest & Swamps, made dark, foggy and scary: seven depth layers of gnarled trees fading into a sickly
green fog, hanging moss everywhere, a rotting hut on stilts with one lit window, a hanging cage, eyes watching from the
dark, a broken boardwalk plank by plank with a lantern, reeds, lily pads, glowing mushrooms, black water reflecting
everything, cold moonlight shafts, fireflies and spores. The hero fights a Bog Zombie rising from the water (in its
orange attack flash) while a Giant Spider drops from above and a Swamp Witch casts from a root.
640 x 360 pixels inside, shown at 3x. Only writes docs/art/. Run: python3 tools/art/final_example.py"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from art.style_test_sketch import catmull, taper, spoly, ell, cap, poly, fbm, vnoise, _blur, _dilate  # noqa: E402
from art.stage_test import (W, H, XX, YY, BAY, C, mask, fill, gradient, glow, shafts, actor, hud, hero, humanoid,  # noqa: E402
                            phone)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WATER = 292                      # the water surface (reflections mirror around it)
FOG = C('#5e8a6e')


def mix(a, b, t):
    return np.asarray(a, np.float32) * (1 - t) + np.asarray(b, np.float32) * t


# ============================================================================================== trees and moss

def gnarled(x, base, h, w, seed, lean=0.0):
    """A twisted swamp tree: a wobbling trunk, arching roots into the water, crooked branches. Returns (shapes, moss
    anchors)."""
    rng = np.random.default_rng(seed)
    path = [(x, base + 4)]
    for k in range(1, 7):
        t = k / 6
        path.append((x + lean * h * t + rng.normal(0, w * 0.35) * (1 - t * 0.3), base - h * t))
    S = [taper(path, w, w * 0.32, 6)]
    for k in range(3):                                            # bulges and burls on the trunk
        t = rng.uniform(0.15, 0.6)
        j = int(t * 6)
        S.append(ell(path[j][0] + rng.uniform(-w * 0.3, w * 0.3), path[j][1], w * 0.55, w * 0.8, 0, 14))
    anchors = []
    for r in range(int(rng.integers(4, 7))):                      # mangrove roots arching into the water
        side = -1 if r % 2 else 1
        sx = x + side * rng.uniform(0, w * 0.4)
        sy = base - rng.uniform(w * 0.4, w * 2.2)
        ex = x + side * rng.uniform(w * 1.4, w * 4.0)
        mx = (sx + ex) / 2 + side * w * 0.3
        S.append(taper([(sx, sy), (mx, sy - rng.uniform(0, w * 0.8)), (ex, base + 6)], w * rng.uniform(0.22, 0.42), 2, 6))

    def branch(px, py, ang, ln, wd, depth):
        pts = [(px, py)]
        a = ang
        for k in range(4):
            a += rng.normal(0, 0.28)
            px, py = px + math.cos(a) * ln / 4, py + math.sin(a) * ln / 4
            pts.append((px, py))
        S.append(taper(pts, wd, max(1.2, wd * 0.35), 5))
        anchors.extend(pts[1:])
        if depth > 0:
            for _ in range(int(rng.integers(1, 3))):
                j = int(rng.integers(1, 4))
                branch(pts[j][0], pts[j][1], a + rng.choice([-1, 1]) * rng.uniform(0.4, 0.9), ln * 0.6, wd * 0.55, depth - 1)
    for k in range(int(rng.integers(2, 4))):
        t = rng.uniform(0.5, 0.95)
        j = min(6, int(t * 6))
        side = rng.choice([-1, 1])
        branch(path[j][0], path[j][1], -math.pi / 2 + side * rng.uniform(0.5, 1.1), h * rng.uniform(0.3, 0.5), w * 0.45, 2)
    return S, anchors


def moss(img, anchors, col, col2, seed, density=1.0, maxlen=40):
    """Spanish moss hanging from branches: ragged strands, 1-2 px wide, with clumps at the top."""
    rng = np.random.default_rng(seed)
    c1, c2 = np.asarray(col), np.asarray(col2)
    for (ax, ay) in anchors:
        if rng.random() > 0.55 * density:
            continue
        for s in range(int(rng.integers(2, 6))):
            x = ax + rng.uniform(-4, 4)
            y = ay + rng.uniform(-1, 2)
            ln = int(rng.uniform(6, maxlen))
            wd = 2 if rng.random() < 0.35 else 1
            for k in range(ln):
                xx = int(x + math.sin((k + seed) * 0.35 + s) * 0.9)
                yy = int(y + k)
                if 0 <= xx < W - 1 and 0 <= yy < H:
                    c = c2 if (k + s) % 7 == 0 else c1
                    img[yy, xx] = c
                    if wd == 2 and k < ln * 0.7:
                        img[yy, xx + 1] = c * 0.85
                    if rng.random() < 0.08 and xx + 2 < W:            # a stray tuft
                        img[yy, xx + 2] = c * 0.9


def bark(img, m, col, light=(-1, -1), seed=0, tones=(0.55, 0.78, 1.0, 1.22)):
    """Shade a tree mask: rounded light from one side, vertical bark grooves, knots, moss on top surfaces."""
    if not m.any():
        return
    b = _blur(m.astype(np.float32), 3.0)
    gy, gx = np.gradient(b)
    nx, ny = -gx * 7, -gy * 7
    lit = np.clip(0.55 + 0.6 * (nx * light[0] + ny * light[1]), 0, 1)
    groove = fbm(XX / 2.2 + fbm(XX / 30, YY / 30, 2, seed) * 4, YY / 16, 3, seed + 1)
    v = lit * 0.75 + (groove - 0.5) * 0.9
    q = np.clip(np.floor(v * len(tones) + (BAY - 0.5) * 0.6), 0, len(tones) - 1).astype(int)
    tonev = np.asarray(tones, np.float32)[q]
    c = np.asarray(col, np.float32)
    img[m] = (c[None, None] * tonev[..., None])[m]
    knots = m & (fbm(XX / 6, YY / 9, 2, seed + 7) > 0.78)
    img[knots] = c * 0.45
    top = m & ~np.roll(m, 1, 0)
    mossy = top & (fbm(XX / 5, YY / 5, 2, seed + 3) > 0.45)
    img[mossy] = C('#5e8a46') * (0.6 + 0.4 * tonev[mossy, None] if False else 0.8)


def tree_layer(img, items, col, fogt, seed, moss_col, light=(-1, -1), textured=True, moss_len=40, rim=None):
    """Draw a depth layer of trees: textured, then fogged by fogt, with moss."""
    allm = np.zeros((H, W), bool)
    anchors = []
    for k, (x, base, h, w, lean) in enumerate(items):
        S, an = gnarled(x, base, h, w, seed + k * 13, lean)
        allm |= mask(S)
        anchors += an
    c = mix(col, FOG, fogt)
    if textured:
        bark(img, allm, c, light, seed)
    else:
        fill(img, allm, c)
        tex = allm & (fbm(XX / 3, YY / 14, 2, seed) > 0.62)
        fill(img, tex, c * 0.88)
    if rim is not None:
        e = allm & ~np.roll(allm, 1, 1) & (YY < WATER)
        fill(img, e, mix(rim, FOG, fogt), 0.8)
    moss(img, anchors, mix(moss_col, FOG, fogt), mix(np.asarray(moss_col) * 1.3, FOG, fogt), seed, 1.0, moss_len)
    return allm


def fog_band(img, y, thick, col, a, seed, stretch=60):
    """A wispy band of fog: noise stretched sideways, in dithered steps."""
    n = fbm(XX / stretch, YY / 8, 4, seed)
    band = np.clip(1 - np.abs(YY - y) / thick, 0, 1)
    v = np.clip(band * (n * 1.4 - 0.2), 0, 1)
    q = np.floor(v * 4 + BAY * 0.95) / 4
    img[:] = img * (1 - (q * a)[..., None]) + np.asarray(col) * (q * a)[..., None]


# ============================================================================================== props

def hut(img, x, y, fogt):
    """A rotting hut on stilts, far away, with one lit window."""
    wood, dark = mix(C('#3a3426'), FOG, fogt), mix(C('#1e1a14'), FOG, fogt)
    for sx in (x + 4, x + 22, x + 40, x + 54):
        fill(img, mask([cap((sx, y + 28), (sx + (sx % 3 - 1) * 2, WATER + 4), 2.4)]), dark)
    body = mask([poly((x, y + 30), (x + 2, y + 6), (x + 58, y + 4), (x + 60, y + 30))])
    fill(img, body, wood)
    for k in range(6):
        fill(img, body & (np.abs(YY - (y + 8 + k * 4)) < 0.6), dark)
    roof = mask([poly((x - 6, y + 8), (x + 22, y - 18), (x + 34, y - 14), (x + 66, y + 6), (x + 60, y + 9), (x - 2, y + 11))])
    fill(img, roof, mix(C('#2c2a1c'), FOG, fogt))
    for k in range(8):
        xx = x - 2 + k * 8
        fill(img, roof & (np.abs(XX - xx - (YY - y) * 0.3) < 0.6), dark)
    fill(img, mask([poly((x + 40, y - 12), (x + 46, y - 12), (x + 47, y - 2), (x + 41, y - 2))]), dark)
    img[y + 12:y + 20, x + 12:x + 20] = C('#ffb84a')
    img[y + 16, x + 12:x + 20] = C('#7a4a1a')
    img[y + 12:y + 20, x + 16] = C('#7a4a1a')
    glow(img, x + 16, y + 16, 34, C('#ff9a3a'), 0.4)
    fill(img, mask([poly((x + 30, y + 30), (x + 30, y + 12), (x + 38, y + 12), (x + 38, y + 30))]), dark)
    # a rope bridge sagging from the porch
    for k in range(40):
        px = x + 60 + k * 2
        py = y + 22 + 6 * math.sin(math.pi * k / 40)
        if px < W:
            img[int(py), int(px)] = dark


def cage(img, x, y0, y1):
    """A hanging iron cage with a skeleton inside, swinging from a branch."""
    iron = C('#2a2a30')
    for yy in range(y0, y1):
        if (yy // 2) % 2 == 0:
            img[yy, x] = iron
    cx, cy = x, y1 + 12
    m_out = mask([ell(cx, cy, 9, 13, 0, 20)])
    bars = m_out & ((np.abs((XX - cx)) % 4 < 0.9) | (np.abs(YY - (cy - 4)) < 0.6) | (np.abs(YY - (cy + 6)) < 0.6))
    edge = m_out & ~_dilate(~m_out, 1) == False  # noqa: E712
    fill(img, mask([ell(cx, cy - 2, 2.4, 2.6, 0, 10)]), C('#d8d0b8'))          # skull
    img[cy - 2, cx - 1] = img[cy - 2, cx + 1] = C('#100c0c')
    fill(img, mask([cap((cx, cy + 1), (cx, cy + 7), 1.2)]), C('#c8c0a8'))     # spine and ribs
    for k in range(3):
        img[cy + 2 + k * 2, cx - 2:cx + 3] = C('#b8b098')
    fill(img, mask([cap((cx, cy + 1), (cx + 4, cy + 12), 0.8)]), C('#c8c0a8'))
    fill(img, bars, iron)
    fill(img, m_out & ~_dilate(m_out, 0) | (m_out & ~np.roll(m_out, 1, 0)), C('#4a4a54'))
    fill(img, mask([poly((cx - 10, cy + 12), (cx + 10, cy + 12), (cx + 9, cy + 14), (cx - 9, cy + 14))]), iron)


def boardwalk(img, x0, x1, y, broken=None):
    """The boardwalk: individual planks with gaps and nails, posts into the water, rope rails, moss."""
    rng = np.random.default_rng(31)
    x = x0
    while x < x1:
        w = int(rng.integers(5, 9))
        if broken and broken[0] <= x <= broken[1]:
            # broken planks dangle at an angle
            if rng.random() < 0.5:
                fill(img, mask([cap((x, y + 1), (x + 4, y + 14 + rng.uniform(0, 8)), 2.6)]), C('#3a2a1c'))
            x += w + 1
            continue
        tone = rng.uniform(0.8, 1.1)
        dy = int(rng.integers(-1, 2))
        img[y + dy - 2:y + 8, x:x + w] = C('#5a4028') * tone
        img[y + dy - 2, x:x + w] = C('#9a7a50') * tone                 # lit top edge
        img[y + dy - 1, x:x + w] = C('#7a5a3a') * tone
        img[y + 7, x:x + w] = C('#2a1c12')
        for gx in range(x + 1, x + w - 1, 3):                             # wood grain
            if rng.random() < 0.5:
                img[y + 2 + int(rng.integers(0, 4)), gx:gx + 2] = C('#4a3220') * tone
        if w > 5:
            img[y + 2, x + 1] = img[y + 2, x + w - 2] = C('#a8a8b0')    # nails
        if rng.random() < 0.3:
            img[y + dy, x + 1:x + 3] = C('#5e8a46')                    # moss on the plank
        x += w + 1
    img[y + 8:y + 13, x0:x1] = C('#2e2016')                             # the beam under the planks
    img[y + 8, x0:x1] = C('#4a3424')
    for px in range(x0 + 8, x1, 46):
        if broken and broken[0] - 6 <= px <= broken[1] + 6:
            continue
        fill(img, mask([poly((px, y - 14), (px + 5, y - 14), (px + 5, WATER + 12), (px, WATER + 12))]), C('#3a2a1c'))
        img[y - 14, px:px + 5] = C('#7a5a3a')
        for k in range(y - 12, WATER + 12, 3):
            img[k, px + 1] = C('#2a1c12')
        fill(img, mask([ell(px + 2.5, y - 4, 3.6, 1.6, 0, 10)]), C('#4e7a3a'))    # moss collar
    # rope rail sagging between posts
    for px in range(x0 + 8, x1 - 46, 46):
        if broken and broken[0] - 50 <= px <= broken[1]:
            continue
        for k in range(46):
            ry = y - 11 + 3 * math.sin(math.pi * k / 46)
            img[int(ry), px + 2 + k] = C('#8a7050')


def lantern(img, x, y):
    fill(img, mask([cap((x, y), (x, y - 26), 1.8)]), C('#3a2a1c'))
    fill(img, mask([cap((x, y - 26), (x + 8, y - 26), 1.4)]), C('#3a2a1c'))
    img[y - 25:y - 21, x + 8] = C('#2a2a30')
    lm = mask([poly((x + 5, y - 21), (x + 11, y - 21), (x + 12, y - 12), (x + 4, y - 12))])
    fill(img, lm, C('#ffcf6a'))
    img[y - 21, x + 4:x + 13] = C('#2a2a30')
    img[y - 12, x + 4:x + 13] = C('#2a2a30')
    img[y - 20:y - 12, x + 8] = C('#2a2a30')
    img[y - 17, x + 7:x + 10] = C('#fff8d0')
    glow(img, x + 8, y - 16, 70, C('#ff9a3a'), 0.55, 1.8)
    glow(img, x + 8, y - 16, 14, C('#fff0b0'), 0.6)


def reeds(img, x, base, n, seed, fogt=0.0):
    rng = np.random.default_rng(seed)
    for k in range(n):
        rx = x + rng.uniform(-10, 10)
        hgt = rng.uniform(14, 34)
        bend = rng.uniform(-4, 4)
        col = mix(C('#3e5a2a') * rng.uniform(0.8, 1.2), FOG, fogt)
        for j in range(int(hgt)):
            t = j / hgt
            xx = int(rx + bend * t * t)
            yy = int(base - j)
            if 0 <= xx < W and 0 <= yy < H:
                img[yy, xx] = col * (1.1 if j % 6 == 0 else 1.0)
        if rng.random() < 0.5:                                         # a cattail head
            xx, yy = int(rx + bend), int(base - hgt)
            img[max(0, yy - 4):yy, xx:xx + 2] = mix(C('#5a3a20'), FOG, fogt)


def lily(img, x, y, r, flower=False):
    m = mask([ell(x, y, r, r * 0.38, 0, 18)])
    notch = mask([poly((x, y), (x + r * 1.2, y - 1), (x + r * 1.2, y + 1.6))])
    m &= ~notch
    fill(img, m, C('#2e5a2e'))
    fill(img, m & ~np.roll(m, 1, 0), C('#5a8a46'))
    fill(img, m & (np.abs(XX - x) < 0.6), C('#22441e'))
    if flower:
        for (dx, dy, c) in ((0, -2, '#f0d0e0'), (-1, -1, '#e8b0c8'), (1, -1, '#e8b0c8'), (0, -1, '#fff4c0')):
            img[int(y + dy), int(x + dx)] = C(c)


def mushrooms(img, pts):
    for (x, y, s) in pts:
        fill(img, mask([cap((x, y), (x, y - 3 * s), 0.9 * s)]), C('#c8e8d8'))
        cm = mask([ell(x, y - 3 * s, 2.4 * s, 1.4 * s, 0, 10)])
        fill(img, cm, C('#4af0d0'))
        img[int(y - 3 * s - 1), int(x)] = C('#e0fff8')
        glow(img, x, y - 3 * s, 16 * s, C('#3ae0c0'), 0.35)


def eyes(img, pts):
    for (x, y, c) in pts:
        img[y, x] = img[y, x + 3] = C(c)
        glow(img, x + 1.5, y, 6, C(c), 0.35)


# ============================================================================================== characters

def spider(x, y, s=1.6):
    """The Giant Spider dropping on its thread: jointed hairy legs, a skull-marked abdomen, six red eyes, fangs."""
    P = [('#c8ccd4', cap((x, -10), (x, y - 9 * s), 0.6))]
    for k in range(4):
        for side in (-1, 1):
            a0 = (k - 1.5)
            kx, ky = x + side * (7 + k * 1.2) * s, y - (7 - k * 2.6) * s
            jx, jy = x + side * (13 + k * 1.4) * s, y - (2 - k * 2.2) * s
            fx, fy = x + side * (15 + k * 1.2) * s, y + (6 + k * 2.6) * s
            P += [('#241c2c', cap((x + side * 2 * s, y + a0 * 0.4 * s), (kx, ky), 1.9 * s)),
                  ('#2e2438', cap((kx, ky), (jx, jy), 1.6 * s)), ('#241c2c', cap((jx, jy), (fx, fy), 1.2 * s)),
                  ('#4a3a5a', ell(kx, ky, 1.3 * s, 1.3 * s, 0, 8))]
    P += [('#30263e', ell(x, y + 8 * s, 7.6 * s, 9 * s, 0, 22)), ('#3e3250', ell(x - 1 * s, y + 5 * s, 5 * s, 4 * s, 0, 14))]
    P += [('#c8bca8', ell(x, y + 9 * s, 3.4 * s, 3.8 * s, 0, 14)), ('#30263e', ell(x - 1.3 * s, y + 8.4 * s, 0.9 * s, 1 * s, 0, 8)),
          ('#30263e', ell(x + 1.3 * s, y + 8.4 * s, 0.9 * s, 1 * s, 0, 8)), ('#30263e', poly((x - 1.6 * s, y + 11.4 * s), (x + 1.6 * s, y + 11.4 * s), (x, y + 12.4 * s)))]
    P += [('#463a5a', ell(x, y - 3 * s, 4.8 * s, 4.2 * s, 0, 16))]
    for dx, dy in ((-2.2, -4.6), (-0.8, -5.4), (0.8, -5.4), (2.2, -4.6), (-1.4, -3.4), (1.4, -3.4)):
        P.append(('#ff5050', ell(x + dx * s, y + dy * s, 0.7 * s, 0.7 * s, 0, 8)))
    P += [('#d8d0c0', poly((x - 1.6 * s, y + 0.6 * s), (x - 0.6 * s, y + 0.6 * s), (x - 1.1 * s, y + 3 * s))),
          ('#d8d0c0', poly((x + 0.6 * s, y + 0.6 * s), (x + 1.6 * s, y + 0.6 * s), (x + 1.1 * s, y + 3 * s)))]
    return P


def witch(x, fy):
    """The Swamp Witch: hunched, a ragged cloak, long grey hair, a crooked hat, a skull staff burning green."""
    def T(p):
        return (x - p[0], fy + p[1])

    def tp(sh):
        return ('poly', tuple(T(p) for p in sh[1]))
    P = []
    hem = [(-9, -1), (-7, 1), (-5, -1), (-3, 1.5), (-1, -0.5), (1, 1.5), (3, -0.5), (5, 1), (7, -1), (9, 0.5)]
    P.append(('#241c30', tp(('poly', tuple([(-6, -30), (4, -32), (9, -18)] + hem[::-1] + [(-10, -14)])))))
    P.append(('#2e2440', tp(spoly((-4, -30), (5, -31), (7, -20), (5, -8), (-6, -8), (-7, -20), n=3))))
    for k in range(5):
        P.append(('#1a1424', tp(cap((-5 + k * 2.4, -20), (-6 + k * 2.6, -2), 0.6))))
    P.append(('#7aa86a', tp(ell(4, -32, 4.2, 4.6, 0, 16))))
    P.append(('#5a7a4a', tp(poly((6.5, -32), (10, -30), (7, -29.5)))))                      # crooked nose
    for k in range(6):
        P.append(('#a8a8b4', tp(cap((-1 + k * 1.2, -34), (-4 + k * 0.6, -18 + k), 0.9))))   # long grey hair
    P.append(('#c0ff60', tp(ell(5.4, -32.6, 0.9, 0.8, 0, 8))))
    P += [('#1e1828', tp(ell(3, -36, 9, 1.6, -6, 18))),
          ('#1e1828', tp(spoly((-2, -37), (8, -37), (6, -42), (3, -48), (-3, -52), (-1, -46), (-1, -41), n=3))),
          ('#3a2a4a', tp(poly((0, -40), (4, -40), (4, -38.6), (0, -38.6))))]
    P += [('#3a2a1c', tp(cap((12, 0), (14, -44), 1.6))), ('#d8d0b8', tp(ell(14, -46, 3, 3.2, 0, 12))),
          ('#100c10', tp(ell(13, -46.4, 0.8, 0.8, 0, 6))), ('#100c10', tp(ell(15, -46.4, 0.8, 0.8, 0, 6))),
          ('#a0ff70', tp(spoly((12, -48), (16, -48), (15, -53), (14, -57), (13, -52), n=3)))]
    P += [('#2e2440', tp(cap((4, -26), (12, -24), 2.6))), ('#7aa86a', tp(ell(13, -24, 1.6, 1.6, 0, 8)))]
    P += [('#2e2440', tp(cap((-2, -26), (-9, -30), 2.4))), ('#7aa86a', tp(ell(-10, -31, 1.7, 1.7, 0, 8)))]
    return P


def zombie(x, wl):
    """A Bog Zombie rising from the water: rotten, mossy, reaching for the hero; its lower body is under water."""
    def T(p):
        return (x - p[0], wl + p[1])

    def tp(sh):
        return ('poly', tuple(T(p) for p in sh[1]))
    P = [('#3e4e36', tp(spoly((-6, 2), (-6, -14), (-3, -20), (4, -21), (7, -14), (6, 2), n=3))),
         ('#2c3826', tp(poly((-6, -6), (6, -8), (6, -4), (-6, -2)))),
         ('#5a6a48', tp(cap((-3, -18), (-12, -24), 3))), ('#7a8a62', tp(ell(-13, -25, 2, 2, 0, 8))),
         ('#6a7a54', tp(ell(1, -26, 4.4, 4.8, 0, 16))), ('#4a5a3a', tp(poly((-2, -23), (4, -23), (3, -20), (-1, -20)))),
         ('#e8e0c0', tp(poly((-1, -22.6), (3, -22.6), (2.4, -21.6), (-0.4, -21.6)))),
         ('#ffd24a', tp(ell(2.6, -26.6, 0.9, 0.7, 0, 8))), ('#ffd24a', tp(ell(-0.4, -26.6, 0.9, 0.7, 0, 8))),
         ('#5a6a48', tp(cap((3, -18), (13, -21), 3))), ('#7a8a62', tp(ell(14, -21.4, 2.1, 2, 0, 8))),
         ('#4e7a3a', tp(spoly((-3, -30), (5, -30), (4, -27), (-2, -27), n=2)))]
    for k in range(4):
        P.append(('#4e7a3a', tp(cap((-4 + k * 2.6, -29), (-5 + k * 2.4, -20 + k * 2), 0.8))))
    return P


# ============================================================================================== the scene

def scene():
    img = gradient([(0, '#060c0c'), (0.35, '#13241e'), (0.62, '#2e4a3a'), (0.8, '#4a6a50'), (1, '#4a6a50')], steps=14)
    # the moon, half drowned in fog
    glow(img, 150, 54, 150, C('#b8e0c8'), 0.35, 1.5)
    mm = mask([ell(150, 54, 16, 16, 0, 28)])
    fill(img, mm, C('#d8ecd8'))
    fill(img, mm & (fbm(XX / 6, YY / 6, 2, 3) > 0.58), C('#b8d0bc'))
    fog_band(img, 60, 30, C('#3e6450'), 0.6, 2, 80)
    # layer 1: far trees, almost lost in the fog
    tree_layer(img, [(30, 300, 270, 9, 0.02), (130, 300, 300, 10, -0.05), (250, 300, 260, 8, 0.04), (360, 300, 320, 11, 0.0),
                     (470, 300, 280, 9, -0.03), (580, 300, 300, 10, 0.05)], C('#1e3a2e'), 0.62, 100, C('#2e4a3a'), textured=False)
    fog_band(img, 240, 80, C('#6a9a7a'), 0.55, 5, 70)
    # layer 2: the hut on stilts and a second tree line
    hut(img, 400, 196, 0.42)
    tree_layer(img, [(70, 300, 240, 11, 0.06), (210, 300, 280, 12, -0.04), (330, 300, 230, 10, 0.03), (560, 300, 260, 12, -0.06)],
               C('#16302a'), 0.42, 200, C('#2e4a36'), textured=False, rim=C('#9ad0b0'))
    eyes(img, [(176, 214, '#ff4a3a'), (300, 236, '#ffd24a'), (520, 228, '#ff4a3a')])
    shafts(img, [(120, 26, 0.9), (210, 16, 0.6), (40, 12, 0.5)], C('#c8f0d8'), slope=0.42, alpha=0.2)
    fog_band(img, 262, 60, C('#7aa888'), 0.5, 8, 50)
    # layer 3: big gnarled trees with bark, moss and roots into the water
    m3 = tree_layer(img, [(20, 300, 330, 18, 0.05), (300, 300, 340, 20, -0.03), (500, 300, 300, 17, 0.02)], C('#1a2a22'), 0.18, 300,
                    C('#4a6a40'), light=(-0.8, -0.6), moss_len=60, rim=C('#a8e0c0'))
    eyes(img, [(92, 252, '#ff4a3a'), (430, 246, '#ff4a3a')])
    cage(img, 104, 0, 120)
    mushrooms(img, [(286, 290, 1.3), (292, 291, 1.0), (512, 289, 1.1), (30, 290, 1.4), (38, 291, 1.0)])
    fog_band(img, 286, 26, C('#8ab89a'), 0.55, 11, 40)
    # the water: black, reflecting what is above it with ripples
    above = img.copy()
    wy = YY >= WATER
    src = np.clip(2 * WATER - YY, 0, H - 1).astype(int)
    rip = (np.sin(YY * 1.7 + XX * 0.05) * 1.5 + np.sin(YY * 0.6) * 1.0).astype(int)
    srcx = np.clip(XX.astype(int) + rip, 0, W - 1)
    refl = above[src, srcx]
    depth = np.clip((YY - WATER) / 70, 0, 1)
    water = refl * (0.42 - 0.18 * depth[..., None]) + C('#04100e') * (0.58 + 0.18 * depth[..., None])
    img[wy] = water[wy]
    lines = wy & (np.sin(XX / 7 + YY * 2.1) > 0.92) & (fbm(XX / 20, YY / 3, 2, 4) > 0.5)
    fill(img, lines, C('#4a7a64'), 0.6)
    img[WATER, :] = img[WATER, :] * 0.6 + C('#8ab89a') * 0.4
    # lily pads, reeds, a drowned branch
    for (x, y, r, f) in ((70, 318, 9, True), (120, 334, 7, False), (430, 312, 8, False), (560, 340, 11, True), (610, 318, 7, False),
                         (346, 352, 10, False), (200, 350, 8, True)):
        lily(img, x, y, r, f)
    reeds(img, 26, 300, 14, 3, 0.1)
    reeds(img, 452, 298, 10, 4, 0.15)
    reeds(img, 620, 306, 16, 5, 0.0)
    fill(img, mask([taper([(520, 352), (540, 320), (552, 300)], 4, 1.2)]), C('#1a1410'))
    fill(img, mask([taper([(540, 322), (560, 314), (566, 304)], 2, 0.8)]), C('#1a1410'))
    # the boardwalk with a broken section, and the lantern
    boardwalk(img, -4, 360, 278, broken=(232, 262))
    lantern(img, 330, 278)
    # a root the witch stands on (right side)
    rm = mask([taper([(470, 300), (500, 276), (560, 270), (600, 284), (640, 296)], 18, 10, 6)])
    bark(img, rm, C('#2a2a20'), (-0.5, -0.8), 41)
    fill(img, rm & ~np.roll(rm, 1, 0), C('#5e8a46'))
    mushrooms(img, [(520, 272, 1.2), (528, 273, 0.9), (590, 276, 1.1)])
    # characters
    key = {'dir': (-0.6, -0.6, 0.5), 'col': (0.42, 0.62, 0.5)}
    amb = (0.16, 0.24, 0.22)
    pts = [(338, 262, 150, (1.0, 0.62, 0.25), 1.0), (150, 54, 500, (0.4, 0.6, 0.5), 0.3), (553, 220, 120, (0.6, 1.0, 0.45), 0.9)]
    actor(img, witch(556, 272), key, amb, pts, rim='#c8ffd8')
    glow(img, 548, 222, 40, C('#90ff60'), 0.55)
    glow(img, 548, 222, 10, C('#e8ffc0'), 0.6)
    actor(img, spider(380, 150, 1.7), key, amb, pts, rim='#c8ffd8')
    actor(img, zombie(250, 300), key, amb, pts, rim='#ffd8a0', flash='#ff8a2a')
    glow(img, 250, 280, 34, C('#ff8a2a'), 0.25)
    for k in range(3):                                                    # ripples around the zombie
        r = 12 + k * 7
        rr = mask([ell(250, 301, r, r * 0.22, 0, 24)]) & ~mask([ell(250, 301, r - 1.4, r * 0.22 - 0.8, 0, 24)])
        fill(img, rr & (YY > 300), C('#7aa888'), 0.6 - k * 0.15)
    actor(img, hero(190, 262, 1), key, amb, pts, rim='#ffe0b0')
    # particles: fireflies, spores, a few falling leaves
    rng = np.random.default_rng(17)
    for _ in range(34):
        fx, fy = rng.uniform(0, W), rng.uniform(90, 300)
        glow(img, fx, fy, 9, C('#d8ff80'), 0.4)
        img[int(fy), int(fx)] = C('#f8ffc0')
    for _ in range(70):
        sx, sy = int(rng.uniform(0, W)), int(rng.uniform(0, 300))
        img[sy, sx] = img[sy, sx] * 0.5 + C('#c8e0c0') * 0.5
    # foreground framing: two huge dark trunks with roots, barely lit
    for (x, lean, sd) in ((-6, 0.04, 61), (634, -0.03, 62)):
        S, an = gnarled(x, 372, 420, 46, sd, lean)
        fm = mask(S)
        bark(img, fm, C('#141c16'), (1 if x < 300 else -1, -0.4), sd, tones=(0.45, 0.65, 0.85, 1.05))
        e = fm & ~np.roll(fm, -1 if x < 300 else 1, 1)
        fill(img, e, C('#3e6a50'), 0.7)
        moss(img, an, C('#1e3426'), C('#2e4a36'), sd, 1.2, 60)
    top_m = mask([ell(x, -10, rx, 30, 0, 20) for x, rx in ((40, 80), (180, 60), (320, 70), (470, 60), (620, 90))])
    fill(img, top_m, C('#060a08'))
    moss(img, [(x, 14 + 8 * math.sin(x)) for x in range(0, 640, 7)], C('#1a2e22'), C('#2e4a36'), 77, 1.4, 70)
    # vignette and final grade
    v = np.clip(np.hypot((XX - 320) / 360, (YY - 190) / 230) - 0.5, 0, 1)
    img[:] = img * (1 - 0.55 * v[..., None])
    img[:] = np.clip(img, 0, 1.2)
    hud(img)
    return img


def build():
    docs = os.path.join(ROOT, 'docs', 'art')
    img = scene()
    im = Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8), 'RGB')
    big = im.resize((W * 3, H * 3), Image.NEAREST)
    big.save(os.path.join(docs, 'final_example_swamp.png'))
    phone(big).save(os.path.join(docs, 'final_example_swamp_phone.png'))
    # close-ups at 6x: the fight in the middle, and the witch with the hut
    big.crop((140 * 3, 120 * 3, 420 * 3, 320 * 3)).resize((280 * 6, 200 * 6), Image.NEAREST).save(
        os.path.join(docs, 'final_example_swamp_closeup.png'))
    return big


if __name__ == '__main__':
    build()
