"""ART13b: detailed example scenes for the other four stages, in the look the user approved on the swamp
(docs/art/final_example_swamp_v2.png): many distance planes, each further one smaller and hazier; real light from one
sun or sky; a lot of small detail; a near-camera layer framing the screen; characters lit by the scene's light.

- Plains & Forest: peaceful, long fields, farms, a forest edge, a sunny morning.
- Caves & Mountains: a hike. Green, bright forest low down; higher up snowy firs; at the top bald, snowy peaks; a cave.
- Enemy Kingdom: a medieval city at sunset: timber-framed houses, a market street, rooftops, walls, the castle beyond.
- King's Castle: the great hall: stone arches going back into the dark, tall windows with light shafts, banners.

Light model: a surface's height field gives its normals; colour = albedo * (ambient sky light + sun light * N.L),
quantised to a few tones with a 4x4 Bayer dither, then mixed into the scene's haze by distance.
640 x 360 inside, shown at 3x. Only writes docs/art/. Run: python3 tools/art/final_stages.py [plains|mountains|city|castle]"""
import math
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from art.style_test_sketch import taper, spoly, ell, cap, poly, fbm, _blur, _dilate  # noqa: E402
from art.stage_test import (W, H, XX, YY, BAY, C, mask, fill, glow, shafts, actor, hud, hero, humanoid_enemy,  # noqa: E402
                            quadruped, cannon, phone, humanoid)
from art.final_swamp import mix, crooked, stubs  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'docs', 'art')

# the current scene's light (set by setup() at the start of every scene)
P = {}


def setup(sun, sun_col, amb, haze, light, haze_k=0.92):
    L = np.array(light, np.float32)
    P.update(sun=sun, sun_col=C(sun_col), amb=C(amb), haze=C(haze), L=L / np.linalg.norm(L), haze_k=haze_k)


def aerial(col, d, k=1.0):
    """Mix a colour into the haze by distance d (0 = the horizon, 1 = right in front)."""
    t = float(np.clip(1 - d, 0, 1)) ** 1.5 * P['haze_k'] * k
    return mix(col, P['haze'], t)


def tone(hf, tex=None, steps=5, lo=0.0):
    """Sun light on a height field: N.L, plus texture, quantised with a dither."""
    gy, gx = np.gradient(hf)
    ln = np.sqrt(gx * gx + gy * gy + 1)
    L = P['L']
    v = np.clip((-gx * L[0] - gy * L[1] + L[2]) / ln, 0, 1)
    if tex is not None:
        v = v + tex
    return np.clip(np.floor(np.clip(v, lo, 1.2) * steps + BAY * 0.9) / steps, 0, 1.2)


def lit(alb, q, d, amb_k=1.0, sun_k=1.0):
    """The colour of a surface with albedo alb lit to level q (0..1) at distance d."""
    alb = np.asarray(alb, np.float32)
    q = np.asarray(q, np.float32)
    c = alb * (P['amb'] * amb_k + P['sun_col'] * sun_k * q[..., None] if q.ndim else P['amb'] * amb_k + P['sun_col'] * sun_k * q)
    return aerial(np.clip(c, 0, 1.2), d)


def paint(img, m, hf, alb, d, tex=None, steps=5, lo=0.0, amb_k=1.0, sun_k=1.0):
    if not m.any():
        return
    q = tone(hf, tex, steps, lo)
    c = lit(alb, q, d, amb_k, sun_k)
    img[m] = c[m]


def face(img, m, alb, q, d):
    """A flat face (a wall, a roof plane) lit to a fixed level q, with a dither."""
    fill(img, m, lit(alb, q, d))


# ============================================================================================== shapes with volume

def domes(clumps, rough=0.5, seed=0):
    """Leafy masses / cloud puffs: a height field of overlapping domes (cx, cy, rx, ry, z). Returns mask and height."""
    hf = np.full((H, W), -1e3, np.float32)
    NX, NY = np.zeros((H, W), np.float32), np.zeros((H, W), np.float32)
    nz = fbm(XX / 2.6, YY / 2.6, 2, seed) - 0.5
    for (cx, cy, rx, ry, z) in clumps:
        x0, x1 = max(0, int(cx - rx - 2)), min(W, int(cx + rx + 3))
        y0, y1 = max(0, int(cy - ry - 2)), min(H, int(cy + ry + 3))
        if x1 <= x0 or y1 <= y0:
            continue
        X, Y = XX[y0:y1, x0:x1], YY[y0:y1, x0:x1]
        r2 = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 + nz[y0:y1, x0:x1] * rough
        h = np.where(r2 < 1, z + ry * np.sqrt(np.clip(1 - r2, 0, 1)), -1e3)
        win = h > hf[y0:y1, x0:x1]
        hf[y0:y1, x0:x1] = np.where(win, h, hf[y0:y1, x0:x1])
        NX[y0:y1, x0:x1] = np.where(win, (X - cx) / rx, NX[y0:y1, x0:x1])
        NY[y0:y1, x0:x1] = np.where(win, (Y - cy) / ry, NY[y0:y1, x0:x1])
    m = hf > -1e2
    _DN['nx'], _DN['ny'] = NX, NY
    return m, np.where(m, hf, 0)


_DN = {}


def cylinder(m, r):
    """A height field that makes a shape look round (trunks, branches, characters' limbs)."""
    return _blur(m.astype(np.float32), max(0.8, r)) * r * 2.2


# ---------------------------------------------------------------------------------------------- pixel-art kernels
# Hand-made pixel art is built from small readable clusters (leaves, needles, rock facets, cloud puffs), each lit as
# its own little shape, in a short colour ramp that shifts hue: shadows go cool and deep, highlights warm and bright.

_WC = {}


def worley(cell, seed, sx=1.0, sy=1.0):
    """Cellular noise: distance to the nearest and second-nearest cell point, the offset to the nearest (for a
    per-cell normal) and a per-cell random id."""
    key = (round(cell, 3), seed, sx, sy)
    if key in _WC:
        return _WC[key]
    X, Y = XX / (cell * sx), YY / (cell * sy)
    ix, iy = np.floor(X), np.floor(Y)
    F1 = np.full(X.shape, 9.0, np.float32)
    F2 = F1.copy()
    DX, DY, ID = np.zeros_like(F1), np.zeros_like(F1), np.zeros_like(F1)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            cx, cy = ix + ox, iy + oy
            h1 = np.modf(np.abs(np.sin(cx * 127.1 + cy * 311.7 + seed * 74.7) * 43758.5453))[0]
            h2 = np.modf(np.abs(np.sin(cx * 269.5 + cy * 183.3 + seed * 21.1) * 43758.5453))[0]
            dx, dy = X - (cx + 0.1 + 0.8 * h1), Y - (cy + 0.1 + 0.8 * h2)
            dist = np.sqrt(dx * dx + dy * dy)
            closer = dist < F1
            F2 = np.where(closer, F1, np.minimum(F2, dist))
            DX, DY = np.where(closer, dx, DX), np.where(closer, dy, DY)
            ID = np.where(closer, h1 * 0.7 + h2 * 0.3, ID)
            F1 = np.where(closer, dist, F1)
    _WC[key] = (F1, F2, DX, DY, ID)
    return _WC[key]


def make_ramp(base, n=7, deep=None, hi=None, hi_k=0.55):
    """A pixel-art colour ramp from deep shadow to highlight, hue-shifted: shadows toward the scene's cool ambient
    colour, highlights toward its warm sun colour."""
    base = np.asarray(base, np.float32)
    deep = P['amb'] * 0.16 if deep is None else np.asarray(deep, np.float32)
    hi = P['sun_col'] if hi is None else np.asarray(hi, np.float32)
    out = []
    for i in range(n):
        t = i / (n - 1)
        if t <= 0.55:
            c = mix(deep, base, (t / 0.55) ** 0.85)
        else:
            u = (t - 0.55) / 0.45
            c = mix(base * (1 + 0.35 * u), hi, u ** 1.4 * hi_k)
        out.append(np.clip(c, 0, 1))
    return np.array(out, np.float32)


def ramp_fill(img, m, t, ramp, d, dith=0.0):
    if not m.any():
        return
    n = len(ramp)
    idx = np.clip(np.floor((t + (BAY - 0.5) * dith) * n), 0, n - 1).astype(int)
    c = aerial(ramp[idx], d)
    img[m] = c[m]


def macro_light(hf):
    gy, gx = np.gradient(hf)
    ln = np.sqrt(gx * gx + gy * gy + 1)
    L = P['L']
    return np.clip((-gx * L[0] - gy * L[1] + L[2]) / ln, 0, 1)


def leaves(img, m, hf, base, d, seed, cell=3.0, contrast=1.0, edge=True, ramp=None, crown=None):
    """Foliage as many small leaf clusters: each cluster shaded as its own little dome (lit side, shadow side), dark
    gaps between clusters, deep shadow in the hollows of the crown, leaves sticking out along the silhouette."""
    ramp = make_ramp(base) if ramp is None else ramp
    F1, F2, DX, DY, ID = worley(cell, seed, 1.25, 0.85)
    cnx, cny = _DN.get('nx', np.zeros((H, W))), _DN.get('ny', np.zeros((H, W)))
    if edge:
        core = m & ~_dilate(~m, max(1, int(cell * 0.6)))
        out = _dilate(m, max(1, int(cell * 0.7)))
        m = core | (out & (F1 < 0.48 - 0.12 * (~m)))
    hs = _blur(np.where(m, hf, 0).astype(np.float32), 1.5) + _blur(m.astype(np.float32), 2.5) * 4
    macro = macro_light(hs)
    L = P['L']
    lx, ly = DX / 0.55, DY / 0.55
    lz = np.sqrt(np.clip(1 - lx * lx - ly * ly, 0, 1))
    local = np.clip(lx * L[0] + ly * L[1] + lz * L[2], 0, 1)
    # each clump lit as a dome: its own normal from its centre
    cnx, cny = _blur(cnx.astype(np.float32), 0.8), _blur(cny.astype(np.float32), 0.8)
    cnz = np.sqrt(np.clip(1 - cnx * cnx * 0.8 - cny * cny * 0.8, 0.05, 1))
    clump = np.clip((cnx * L[0] + cny * L[1] + cnz * L[2]) / np.sqrt(cnx * cnx + cny * cny + cnz * cnz), 0, 1)
    raw = np.where(m, hf, 0).astype(np.float32)
    ao = np.clip((_blur(raw, 2.5) - raw) / 3, 0, 1)                   # hollows and where one clump tucks under another
    t = 0.02 + clump * 0.62 + macro * 0.22 + (local - 0.55) * 0.32 * contrast - ao * 0.6 + (ID - 0.5) * 0.08
    if crown is not None:
        ccx, ccy, R = crown
        t = t + ((XX - ccx) / R * L[0] + (YY - ccy) / R * L[1]) * 0.22
    t = np.where((F2 - F1) < 0.08, t - 0.2 * contrast, t)
    ramp_fill(img, m, t, ramp, d)
    return m


def bark(img, tm, w, base, d, seed, birch=False):
    """Bark: round shading across the trunk, vertical plates with dark furrows, a bright edge on the sunny side."""
    if not tm.any():
        return
    ramp = make_ramp(base, 6, hi_k=0.4)
    hf = cylinder(tm, max(1.0, w))
    macro = macro_light(hf)
    F1, F2, DX, DY, ID = worley(max(1.5, w * 0.6), seed, 0.6, 3.2)
    t = 0.1 + macro * 0.75 + (ID - 0.5) * 0.15
    t = np.where((F2 - F1) < 0.12, t - 0.3, t)
    if birch:
        t = np.where((np.abs(F1 - 0.3) < 0.08) & (ID > 0.6), 0.05, t)
    ramp_fill(img, tm, t, ramp, d)


def crown_clumps(rng, cx, cy, R, n, s=0.42, flat=0.8):
    """Leaf clumps filling an oval crown: front ones bigger and higher (closer), the edges smaller and lumpy."""
    out = []
    for _ in range(n):
        a = rng.uniform(0, 2 * math.pi)
        r = R * math.sqrt(rng.uniform(0, 1))
        x, y = cx + math.cos(a) * r * 1.1, cy + math.sin(a) * r * flat
        rr = R * s * rng.uniform(0.6, 1.1) * (1.15 - 0.5 * r / R)
        out.append((x, y, rr * rng.uniform(1.0, 1.3), rr, (R - r) * 0.8 + rng.uniform(0, 3)))
    return out


def broadleaf(img, x, base, h, w, d, rng, leaf, bark=C('#5a4632'), kind='oak', tex_k=1.0, seed=0, fruit=None):
    """A sunlit leafy tree: a forked trunk with crooked limbs into a lumpy crown of leaf clumps, gaps where limbs and
    sky show through. kind: oak (wide), birch (pale, narrow), bush (no trunk), poplar (tall narrow)."""
    S, tips = [], []
    if kind == 'bush':
        cx, cy, R = x, base - h * 0.45, h * 0.6
    elif kind == 'poplar':
        cx, cy, R = x, base - h * 0.58, h * 0.24
    else:
        cx, cy, R = x + rng.normal(0, w), base - h * 0.64, h * (0.36 if kind == 'oak' else 0.26)
    if kind != 'bush':
        top = (cx + rng.normal(0, w * 0.5), cy)
        S.append(taper([(x - w * 0.9, base + 2), (x, base - h * 0.15), ((x + top[0]) / 2, base - h * 0.4), top], w * 1.8, w * 0.6, 4))
        for k in range(int(rng.integers(3, 6))):
            t = rng.uniform(0.35, 0.6)
            sd = rng.choice([-1, 1])
            crooked(S, x + (cx - x) * t, base - h * t * 0.9, -math.pi / 2 + sd * rng.uniform(0.4, 1.1), R * rng.uniform(0.6, 1.0),
                    w * 0.7, 1, rng, tips, 0.3)
        for k in range(2):                                              # root flare
            sd = (-1, 1)[k]
            S.append(taper([(x, base - w * 1.5), (x + sd * w * 1.6, base - 1), (x + sd * w * 2.6, base + 2)], w * 0.9, 1, 3))
    tm = mask(S) if S else np.zeros((H, W), bool)
    if tm.any():
        globals()['bark'](img, tm, w, C('#d8d4c8') if kind == 'birch' else bark, d, seed, kind == 'birch')
    n = {'oak': 26, 'birch': 16, 'bush': 12, 'poplar': 18}[kind]
    if kind == 'poplar':
        cl = crown_clumps(rng, cx, cy, R, n, 0.6, 3.2)
    else:
        cl = crown_clumps(rng, cx, cy, R, n, 0.45 if kind != 'bush' else 0.55, 0.78 if kind != 'bush' else 0.62)
    cl += [(tx + rng.normal(0, 2), ty + rng.normal(0, 2), R * 0.32, R * 0.27, rng.uniform(0, R * 0.4)) for tx, ty in tips]
    m, hf = domes(cl, 0.35, seed + 3)
    gaps = (fbm(XX / 5, YY / 5, 2, seed + 4) < 0.25) & ~_dilate(~m, 3)
    m &= ~gaps
    cell = float(np.clip(1.6 + d * 2.6 * (h / 120) ** 0.4, 1.4, 4.5))
    m = leaves(img, m, hf * 1.3, leaf, d, seed + 5, cell, 0.6 + 0.6 * d, crown=(cx, cy, R))
    if fruit is not None:
        fr = m & (fbm(XX / 1.3, YY / 1.3, 1, seed + 8) > 0.8) & (hf > np.percentile(hf[m], 40) if m.any() else m)
        fill(img, fr, aerial(C(fruit), d))
    return m | tm


def fir(img, x, base, h, w, d, rng, needle=C('#2e5a3a'), snow=0.0, seed=0, bare=0.0):
    """A conifer: a straight trunk and drooping tiers of needles, sun on one side; snow on the tiers' tops if snow>0."""
    S = [taper([(x, base + 2), (x + rng.normal(0, 0.5), base - h)], max(1.2, w * 0.18), 0.8, 2)]
    tm = mask(S)
    tiers = int(rng.integers(7, 12))
    shapes = []
    for k in range(tiers):
        t = k / tiers
        y = base - h * 0.12 - (h * 0.88) * t
        r = w * (1 - t * 0.85) * rng.uniform(0.85, 1.15)
        if rng.random() < bare * (1 - t):
            continue
        dy = h / tiers * 1.6
        pts = [(x + rng.normal(0, 0.4), y - dy)]
        for j in range(7):                                              # ragged, drooping lower edge
            u = -1 + j / 3
            pts.append((x + u * r, y + abs(u) * dy * 0.25 + rng.uniform(-1, 1.5) - (2 if j % 2 else 0)))
        shapes.append(('poly', [pts[0], (x - r * 1.05, y + dy * 0.28)] + pts[1:] + [(x + r * 1.05, y + dy * 0.28)]))
    m = mask(shapes) | mask([cap((x, base - h * 0.15), (x, base - h - 2), 0.7)])
    m = m & ~((fbm(XX / 1.5, YY / 1.5, 1, seed) > 0.78) & ~_dilate(~m, 1))
    # each tier is lit on its top and its sun side, built of small drooping needle clusters
    side = np.clip((XX - x) / max(w, 1), -1, 1) * np.sign(P['L'][0])
    tier_top = _blur(m.astype(np.float32), 1.2)
    F1, F2, DX, DY, ID = worley(max(1.2, 1.0 + d * 1.6), seed, 1.6, 0.7)
    top_lit = (m & ~np.roll(m, 2, 0)).astype(np.float32)
    t = 0.12 + 0.35 * (side * 0.5 + 0.5) + 0.3 * _blur(top_lit, 1.0) * 2 + (0.5 - DY / 0.6 * 0.5) * 0.25 + (ID - 0.5) * 0.15
    t = t - (1 - tier_top) * 0.2
    t = np.where((F2 - F1) < 0.1, t - 0.22, t)
    fill(img, tm & ~m, aerial(make_ramp(C('#4a3828'), 5)[1], d))
    ramp_fill(img, m, t, make_ramp(needle, 7, hi_k=0.45), d)
    if snow > 0:
        cap_ = m & ~np.roll(m, int(1 + 2 * snow), 0) & (fbm(XX / 2.5, YY / 2, 2, seed + 3) < 0.35 + snow * 0.5)
        sr = make_ramp(C('#e8eef8'), 5, deep=C('#4a5a8a'), hi=C('#ffffff'), hi_k=0.8)
        ramp_fill(img, cap_, 0.45 + 0.5 * (side * 0.5 + 0.5) + (ID - 0.5) * 0.2, sr, d)
    return m | tm


def clouds(img, items, seed, alb='#ffffff', d=0.05, flat_base=True):
    """Cumulus clouds: puffs as domes, flat-ish bottoms, sunlit tops, bluish undersides."""
    rng = np.random.default_rng(seed)
    for (cx, cy, wd, ht) in items:
        cl = []
        for _ in range(int(wd / 6) + 6):
            px = cx + rng.uniform(-wd / 2, wd / 2)
            r = ht * rng.uniform(0.35, 0.75) * (1 - abs(px - cx) / wd)
            cl.append((px, cy - r * 0.4 + rng.normal(0, ht * 0.08), r * 1.3, r, r))
        m, hf = domes(cl, 0.25, seed + int(cx))
        if flat_base:
            m &= YY < cy + ht * 0.12
        ramp = make_ramp(C(alb) * 0.88, 6, deep=mix(P['amb'], C(alb), 0.45), hi=C('#ffffff'), hi_k=0.9)
        F1, F2, DX, DY, ID = worley(max(3.0, ht * 0.28), seed + int(cx), 1.4, 1.0)
        macro = macro_light(hf * 0.7)
        L = P['L']
        lx, ly = DX / 0.6, DY / 0.6
        local = np.clip(lx * L[0] + ly * L[1] + np.sqrt(np.clip(1 - lx * lx - ly * ly, 0, 1)) * L[2], 0, 1)
        t = 0.2 + macro * 0.6 + (local - 0.5) * 0.35 - np.clip((YY - cy) / ht, 0, 1) * 0.3
        mm = m | (_dilate(m, 2) & (F1 < 0.35) & (YY < cy))
        ramp_fill(img, mm, t, ramp, d)


def ground_tex(seed, k=0.4):
    return (fbm(XX / 3, YY / 2, 3, seed) - 0.5) * k


def tufts(img, top, cols, seed, density=0.5, hmin=3, hmax=10, flowers=None):
    """Grass tufts of curved blades in three tones (dark root, mid, sunlit tip), seed heads and flowers."""
    rng = np.random.default_rng(seed)
    ys, xs = np.nonzero(top)
    if not len(xs):
        return
    dark, midc, tip = cols
    order = rng.permutation(len(xs))
    for i in order[:int(len(xs) * density / 3)]:
        bx, by = xs[i], ys[i]
        n = int(rng.integers(3, 8))
        base_h = rng.uniform(hmin, hmax)
        for b in range(n):
            hgt = base_h * rng.uniform(0.5, 1.1)
            spread = (b - n / 2) * rng.uniform(0.4, 1.0)
            curve = rng.uniform(-0.8, 0.8)
            steps = int(hgt) + 1
            for k in range(steps):
                t = k / max(1, steps - 1)
                x = int(round(bx + spread * t + curve * t * t * hgt * 0.4))
                y = int(round(by - k))
                if 0 <= x < W and 0 <= y < H:
                    img[y, x] = dark if t < 0.35 else (midc if t < 0.75 else tip)
        if flowers and rng.random() < 0.18:
            c = flowers[int(rng.integers(len(flowers)))]
            x, y = int(bx + rng.uniform(-2, 2)), int(by - base_h * rng.uniform(0.7, 1.2))
            if 1 <= x < W - 1 and 1 <= y < H - 1:
                img[y, x] = c
                if rng.random() < 0.5:
                    img[y, x - 1] = img[y, x + 1] = c * 0.85


def motes(img, n, box, col, seed, k=0.5):
    rng = np.random.default_rng(seed)
    x0, y0, x1, y1 = box
    for _ in range(n):
        x, y = int(rng.uniform(x0, x1)), int(rng.uniform(y0, y1))
        if 0 <= x < W and 0 <= y < H:
            img[y, x] = mix(img[y, x], col, k)


def sun_glow(img, x, y, r, col, k):
    dd = np.hypot(XX - x, YY - y)
    a = np.clip(1 - dd / r, 0, 1) ** 2 * k
    img[:] = img + C(col) * a[..., None]


def bloom(img, thr=0.78, r=5.0, k=0.45):
    """Light bleeding from the brightest spots (sky by the sun, lit windows, highlights), quantised so it stays pixel art."""
    lum = img.max(axis=2)
    b = np.clip(lum - thr, 0, None)[..., None] * img
    bb = np.dstack([_blur(b[..., i].astype(np.float32), r) for i in range(3)])
    bb = np.floor(bb * 24 + BAY[..., None] * 0.9) / 24
    img[:] = img + bb * k


def ground_shadow(img, x, y, rx, ry, k=0.35):
    """A soft dithered shadow on the ground, cast away from the sun."""
    sx = x - P['L'][0] * rx * 0.5
    dd = ((XX - sx) / rx) ** 2 + ((YY - y) / ry) ** 2
    a = np.clip(1 - dd, 0, 1) ** 0.7
    a = np.floor(a * 3 + BAY * 0.9) / 3 * k
    img[:] = img * (1 - a[..., None]) + (P['amb'] * 0.25) * a[..., None]


def grade(img, contrast=1.15, sat=1.12, pivot=0.42):
    """A final colour grade: more contrast around a mid pivot and a little more colour."""
    lum = img.mean(axis=2, keepdims=True)
    img[:] = np.clip(lum + (img - lum) * sat, 0, None)
    img[:] = np.clip(pivot + (img - pivot) * contrast, 0, 1.4)


def sun_band(img, y0, y1, col, k, m=None):
    """Low sunlight catching only the upper parts of the scene (roofs, upper floors), fading out toward the street."""
    a = np.clip((y1 - YY) / max(1, y1 - y0), 0, 1) * k
    if m is not None:
        a = a * m
    a = np.floor(a * 5 + BAY * 0.9) / 5
    img[:] = img + C(col)[None, None] * a[..., None] * img * 1.6


def vignette(img, k=0.35):
    v = np.hypot((XX - W / 2) / W, (YY - H / 2) / H)
    img *= (1 - np.clip(v - 0.3, 0, 1) * k * 2.2)[..., None]


def sky(stops):
    """A vertical sky gradient from (t, hex) stops, banded with a dither like pixel art."""
    img = np.zeros((H, W, 3), np.float32)
    t = YY / H
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        m = (t >= t0) & (t <= t1)
        u = np.clip((t - t0) / max(1e-6, t1 - t0), 0, 1)
        img[m] = mix(C(c0), C(c1), u[..., None])[m]
    return np.floor(img * 28 + BAY[..., None] * 0.9) / 28


def hills(y0, amp, scale, seed, oct_=3):
    """A rolling skyline y(x)."""
    return y0 - amp * fbm(XX[0] / scale, np.full(W, seed * 1.7), oct_, seed)


def land(img, ytop, alb, d, seed, k=1.0, tex=None, steps=5, lo=0.2, rough=6.0):
    """A band of land below the skyline ytop(x): rounded, lit from the sun, with a soft texture."""
    m = YY >= ytop[None, :]
    hf = -np.clip(YY - ytop[None, :], 0, 30) * 0.12 * k + fbm(XX / 18, YY / 10, 3, seed) * rough
    paint(img, m, hf, alb, d, ground_tex(seed, 0.25) if tex is None else tex, steps, lo)
    return m


def grade_actor(img, parts, key, amb, rim, d=0.9, flash=None, pts=(), glow_hex=None, outline='#141018'):
    """Draw a character lit by the scene, then mix in a touch of the scene's haze so it sits in the picture."""
    before = img.copy()
    actor(img, parts, key, amb, pts, rim=rim, outline=outline, flash=flash, glow_hex=glow_hex)
    ch = np.abs(img - before).sum(axis=2) > 0.01
    img[ch] = aerial(img[ch], d)


def framed(img, path, scale=3):
    out = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize((W * scale, H * scale), Image.NEAREST)
    out.save(path)
    return out


def near_bushes(img, seed, y, alb, xs, r=(14, 26)):
    """Leafy bushes right in front of the camera along the bottom edge, darker and bigger than anything else."""
    rng = np.random.default_rng(seed)
    cl = []
    for x in xs:
        rr = rng.uniform(*r)
        cl += crown_clumps(rng, x, y + rr * 0.3, rr, 9, 0.5, 0.6)
    m, hf = domes(cl, 0.4, seed)
    leaves(img, m, hf * 1.3, alb, 1.0, seed + 1, 5.0, 1.2, ramp=make_ramp(alb, 7, hi_k=0.3) * 0.8)



# ---------------------------------------------------------------------------------------------- atmosphere and props (round 5)

def haze_band(img, y, thick, a, col, seed, stretch=60, m=None):
    """A drifting band of mist or haze between two distance layers (as in the swamp), dithered into a few steps."""
    n = fbm(XX / stretch, YY / 6, 4, seed)
    band = np.clip(1 - np.abs(YY - y) / thick, 0, 1) ** 1.2
    v = np.clip(band * (0.35 + n), 0, 1)
    q = np.floor(v * 5 + BAY * 0.9) / 5 * a
    if m is not None:
        q = q * m
    img[:] = img * (1 - q[..., None]) + C(col) * q[..., None]


def light_shafts(img, beams, col, slope, alpha, y0=0, y1=H):
    """Soft light shafts at an angle: (x at y=0, width, strength) each, quantised in 3 steps."""
    acc = np.zeros((H, W), np.float32)
    for (x, wd, k) in beams:
        acc += np.clip(1 - np.abs(XX - (x + YY * slope)) / wd, 0, 1) * k
    acc *= (YY >= y0) & (YY < y1)
    q = np.floor(np.clip(acc, 0, 1) * 3 + BAY * 0.9) / 3
    img[:] = img + C(col) * (q * alpha)[..., None]


def bunting(img, x0, y0, x1, y1, sag, d, seed, cols=('#c83a3a', '#e8b040', '#3a6ac8', '#f0e8d8', '#4a9a5a'), glow_k=0.0, size=1.0):
    """A string of cloth flags strung across the street, sagging in the middle; backlit cloth glows a little."""
    rng = np.random.default_rng(seed)
    n = int(abs(x1 - x0) / (9 * size))
    pts = [(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)) for t in np.linspace(0, 1, n * 3 + 1)]
    fill(img, mask([taper(pts, 0.7 * size, 0.7 * size, len(pts) - 1)]), aerial(C('#2a2020'), d))
    for k in range(n):
        t = (k + 0.5) / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)
        sw = rng.uniform(-1, 1)
        f = mask([poly((x - 3 * size, y), (x + 3 * size, y), (x + sw * size, y + 7 * size))])
        c = C(cols[k % len(cols)])
        fill(img, f, aerial(c * (0.75 + glow_k), d))
        fill(img, f & ~np.roll(f, 1, 0), aerial(mix(c, C('#ffffff'), 0.4), d))


def hay_cart(img, x, base, s, d, seed):
    k = lambda v: v * s
    body = rect(x - k(20), base - k(14), x + k(18), base - k(7))
    ramp_fill(img, body, 0.4 + np.where(np.abs((YY - base + k(10)) % max(1, k(2.5))) < 0.6, -0.2, 0), make_ramp(C('#8a5a32'), 6), d)
    hay, hh = domes([(x - k(8), base - k(16), k(13), k(7), 0), (x + k(6), base - k(17), k(12), k(8), 1)], 0.5, seed)
    F1, F2, DX, DY, ID = worley(1.2, seed, 0.5, 2.0)
    ramp_fill(img, hay, 0.25 + macro_light(hh) * 0.6 + (ID - 0.5) * 0.25, make_ramp(C('#d8b048'), 6, hi_k=0.5), d)
    for wx in (x - k(12), x + k(10)):
        wm = mask([ell(wx, base - k(5), k(5.5), k(5.5), 0, 20)]) & ~mask([ell(wx, base - k(5), k(4.2), k(4.2), 0, 20)])
        fill(img, wm, aerial(C('#4a3020'), d))
        for j in range(6):
            a = j * math.pi / 3
            fill(img, mask([cap((wx, base - k(5)), (wx + math.cos(a) * k(4.5), base - k(5) + math.sin(a) * k(4.5)), 0.5)]), aerial(C('#5a3a24'), d))
    fill(img, mask([cap((x + k(18), base - k(9)), (x + k(34), base - k(4)), 0.8)]), aerial(C('#5a3a24'), d))


def lamp_post(img, x, base, h, d, lit_=True):
    fill(img, rect(x - 1, base - h, x + 1, base), aerial(C('#1e1a1c'), d))
    fill(img, rect(x - 3, base - 3, x + 3, base), aerial(C('#2a2426'), d))
    fill(img, mask([cap((x, base - h), (x + 6, base - h), 0.6)]), aerial(C('#1e1a1c'), d))
    lx, ly = x + 6, base - h + 2
    fill(img, mask([poly((lx - 3, ly), (lx + 3, ly), (lx + 2, ly + 7), (lx - 2, ly + 7))]), C('#ffd070') if lit_ else aerial(C('#3a3030'), d))
    fill(img, mask([poly((lx - 4, ly), (lx, ly - 3), (lx + 4, ly))]), aerial(C('#1e1a1c'), d))
    if lit_:
        glow(img, lx, ly + 3, 34, C('#ff9a40'), 0.5)


def sheep(img, x, y, s, d):
    b, hb = domes([(x, y - 3 * s, 4 * s, 3 * s, 0), (x - 2 * s, y - 4 * s, 2.5 * s, 2 * s, 1), (x + 2 * s, y - 4 * s, 2.5 * s, 2 * s, 1)], 0.6, int(x))
    ramp_fill(img, b, 0.4 + macro_light(hb) * 0.5, make_ramp(C('#f0ece0'), 5, hi_k=0.5), d)
    fill(img, mask([ell(x + 4.5 * s, y - 3.5 * s, 1.4 * s, 1.2 * s, 0, 8)]), aerial(C('#2a2420'), d))
    for lx in (x - 2 * s, x + 2 * s):
        fill(img, rect(lx, y - 1, lx + max(1, 0.6 * s), y + 1), aerial(C('#2a2420'), d))
    ground_shadow(img, x, y + 1, 5 * s, 1.2 * s, 0.25)


def backlit(img, before, k):
    """Everything drawn since `before` stands with the low sun behind it: its faces fall into cool shade (lit windows
    and lamps keep their glow), and a thin warm rim lights its edges against the sky."""
    ch = np.abs(img - before).sum(axis=2) > 0.12
    ch = ch & _dilate(_dilate(ch, 1) & ~np.roll(~ch, 0), 0)
    mx = img.max(axis=2)
    bright = (mx > 0.8) & (img[..., 0] > img[..., 2] + 0.2)
    sh = ch & ~bright
    img[sh] = img[sh] * np.array([k, k * 0.95, k * 1.12], np.float32)
    rim = ch & ~np.roll(ch, 1, 0)
    img[rim] = mix(img[rim], C('#ffc890'), 0.55)


def feet_shadows(img, pts, k=0.4):
    for (x, y, r) in pts:
        ground_shadow(img, x, y, r, max(1.5, r * 0.22), k)


# ============================================================================================== Plains & Forest

def farmhouse(img, x, base, s, d, roof='#b8a060', wall='#e8dcc0', beams='#5a3e2a', seed=0):
    """A small farmhouse: whitewashed timber-framed walls, a thatched roof, a chimney with smoke, a lit door."""
    k = lambda v: v * s
    wl = mask([poly((x - k(16), base), (x - k(16), base - k(12)), (x + k(16), base - k(12)), (x + k(16), base))])
    face(img, wl, C(wall), 0.85, d)
    side = mask([poly((x + k(16), base), (x + k(16), base - k(12)), (x + k(24), base - k(15)), (x + k(24), base - k(3)))])
    face(img, side, C(wall), 0.45, d)
    for bx in (-16, -6, 6, 16):
        fill(img, wl & (np.abs(XX - (x + k(bx))) < max(0.5, k(0.6))), lit(C(beams), 0.6, d))
    fill(img, wl & (np.abs(YY - (base - k(6))) < max(0.5, k(0.5))), lit(C(beams), 0.6, d))
    rf = mask([poly((x - k(19), base - k(11)), (x - k(4), base - k(24)), (x + k(4), base - k(26)), (x + k(27), base - k(14)),
                    (x + k(21), base - k(10)))])
    th = rf & (fbm(XX / 1.2, YY / 3, 2, seed) > 0.5)
    face(img, rf, C(roof), 0.75, d)
    fill(img, th, lit(C(roof), 1.0, d))
    fill(img, rf & ~np.roll(rf, -2, 0), lit(C(roof), 0.3, d))
    fill(img, mask([poly((x - k(3), base), (x - k(3), base - k(7)), (x + k(3), base - k(7)), (x + k(3), base))]), lit(C('#3a281c'), 0.5, d))
    for wx in (-11, 9):
        fill(img, mask([poly((x + k(wx), base - k(5)), (x + k(wx), base - k(9)), (x + k(wx + 3), base - k(9)), (x + k(wx + 3), base - k(5)))]),
             aerial(C('#3a3040'), d))
    fill(img, mask([poly((x + k(10), base - k(20)), (x + k(10), base - k(28)), (x + k(14), base - k(28)), (x + k(14), base - k(18)))]),
         lit(C('#8a7a6a'), 0.7, d))
    for j in range(6):
        glow(img, x + k(12) + j * k(3), base - k(31) - j * k(5), k(3 + j), aerial(C('#e8ecf0'), d) * 0.35, 0.4)


def barn(img, x, base, s, d, seed=0):
    k = lambda v: v * s
    body = mask([poly((x - k(18), base), (x - k(18), base - k(16)), (x, base - k(27)), (x + k(18), base - k(16)), (x + k(18), base))])
    face(img, body, C('#a8402e'), 0.8, d)
    for bx in range(-18, 19, 3):
        fill(img, body & (np.abs(XX - (x + k(bx))) < 0.5), lit(C('#7a2a1e'), 0.6, d))
    rf = mask([poly((x - k(21), base - k(15)), (x, base - k(29)), (x + k(21), base - k(15)), (x + k(19), base - k(14)),
                    (x, base - k(26)), (x - k(19), base - k(14)))])
    face(img, rf, C('#5a5048'), 0.9, d)
    door = mask([poly((x - k(6), base), (x - k(6), base - k(11)), (x + k(6), base - k(11)), (x + k(6), base))])
    face(img, door, C('#5a2a1e'), 0.5, d)
    fill(img, door & ((np.abs(XX - YY - (x - base)) < 0.6) | (np.abs(XX + YY - (x + base - k(11))) < 0.6)), lit(C('#e8dcc0'), 0.8, d))


def windmill(img, x, base, s, d, ang=0.4):
    """A tower windmill: a round whitewashed tower shaded like a cylinder, stone base, small windows, a door, a
    wooden cap, four lattice sails with cloth."""
    k = lambda v: v * s
    tw = mask([poly((x - k(8), base), (x - k(5), base - k(32)), (x + k(5), base - k(32)), (x + k(8), base))])
    u = np.clip((XX - x) / k(7), -1, 1) * np.sign(P['L'][0])
    t = 0.2 + np.sqrt(np.clip(1 - u * u, 0, 1)) * 0.35 + u * 0.3 + (fbm(XX / 2, YY / 2, 2, 7) - 0.5) * 0.1
    ramp_fill(img, tw, t, make_ramp(C('#e8dcc4'), 7, hi_k=0.6), d)
    sb = tw & (YY > base - k(5))
    ramp_fill(img, sb, t * 0.8, make_ramp(C('#9a8a78'), 6), d)
    fill(img, sb & (np.abs((YY - base) % max(1, k(2))) < 0.5), aerial(C('#4a3a30'), d))
    fill(img, rect(x - k(2), base - k(7), x + k(2), base), aerial(C('#4a2e1e'), d))
    for (wx, wy) in ((x - k(1), base - k(16)), (x + k(1), base - k(25))):
        fill(img, rect(wx - k(1.2), wy, wx + k(1.2), wy + k(3)), aerial(C('#2a2030'), d))
    capm = mask([spoly((x - k(7), base - k(31)), (x - k(5), base - k(37)), (x, base - k(40)), (x + k(5), base - k(37)), (x + k(7), base - k(31)), n=3)])
    ramp_fill(img, capm, 0.3 + np.clip((XX - x) / k(7), -1, 1) * 0.3 * np.sign(P['L'][0]), make_ramp(C('#7a4a32'), 6), d)
    hx, hy = x, base - k(33)
    for j in range(4):
        a = ang + j * math.pi / 2
        ex, ey = hx + math.cos(a) * k(28), hy + math.sin(a) * k(28)
        fill(img, mask([cap((hx, hy), (ex, ey), max(0.6, k(0.7)))]), aerial(C('#4a3424'), d))
        px, py = -math.sin(a), math.cos(a)
        a0 = (hx + math.cos(a) * k(7), hy + math.sin(a) * k(7))
        sail = mask([poly(a0, (ex, ey), (ex + px * k(6), ey + py * k(6)), (a0[0] + px * k(6), a0[1] + py * k(6)))])
        fill(img, sail, aerial(C('#f4ecd8') if j % 2 else C('#d8ccb4'), d))
        for q in range(1, 6):                                            # the lattice
            cx_, cy_ = hx + math.cos(a) * k(7 + q * 3.6), hy + math.sin(a) * k(7 + q * 3.6)
            fill(img, mask([cap((cx_, cy_), (cx_ + px * k(6), cy_ + py * k(6)), 0.4)]) & sail, aerial(C('#6a5038'), d))
        fill(img, mask([cap((a0[0] + px * k(6), a0[1] + py * k(6)), (ex + px * k(6), ey + py * k(6)), 0.4)]), aerial(C('#6a5038'), d))
    fill(img, mask([ell(hx, hy, k(1.4), k(1.4), 0, 8)]), aerial(C('#2a1a12'), d))


def fields(img, ytop, y_bot, d, seed, palette):
    """Patchwork farm fields over rolling land: slanted strips in crop colours with furrows, hedgerows on the borders."""
    rng = np.random.default_rng(seed)
    m = (YY >= ytop[None, :]) & (YY < y_bot)
    bounds = np.cumsum(rng.uniform(40, 110, 14)) - 60
    slant = rng.uniform(-0.8, 0.8, len(bounds))
    idx = np.zeros((H, W), np.int32)
    for i, (b, sl) in enumerate(zip(bounds, slant)):
        idx += (XX + (YY - y_bot) * sl > b).astype(np.int32)
    rows = np.clip(((YY - ytop[None, :]) / max(1, (y_bot - ytop.min())) * 3).astype(np.int32), 0, 3)
    cid = (idx * 3 + rows * 5 + seed) % len(palette)
    hf = -(YY - ytop[None, :]) * 0.08 + fbm(XX / 30, YY / 12, 3, seed) * 8
    q = tone(hf, None, 5, 0.3)
    for i, c in enumerate(palette):
        mm = m & (cid == i)
        alb = C(c)
        col = lit(alb, q, d)
        img[mm] = col[mm]
        furrow = mm & (np.sin((XX + (YY - y_bot) * slant[0] * 0.5) * 1.3 + YY * 3.1 * (i % 2)) > 0.6 + 0.3 * (i % 3 == 0))
        img[furrow] = lit(alb * 0.82, q, d)[furrow]
    # hedgerows: little rounded bushes along the field borders and between rows
    edge = m & ((idx != np.roll(idx, 1, 1)) | (rows != np.roll(rows, 1, 0)))
    ys, xs = np.nonzero(edge)
    cl = []
    for i in rng.permutation(len(xs))[:len(xs) // 2]:
        r = rng.uniform(1.2, 2.4) * (0.6 + d)
        cl.append((xs[i], ys[i] - r * 0.5, r * 1.2, r, rng.uniform(0, 1)))
    mm, hh = domes(cl, 0.3, seed + 5)
    paint(img, mm & m | mm & (YY < y_bot), hh * 1.2, C('#3e6a32'), d, (fbm(XX / 1.5, YY / 1.5, 1, seed) - 0.5) * 0.4, 4, 0.1)
    return m


def soil_ground(img, ytop, d, seed, grass='#5a9a3a', soil='#6a4a32', path=None):
    """The playfield ground seen from the side: a sunlit grassy lip, dark earth below with stones and roots."""
    m = YY >= ytop[None, :]
    dep = YY - ytop[None, :]
    hf = -np.clip(dep, 0, 6) * 0.6 + fbm(XX / 6, YY / 4, 3, seed) * 3
    paint(img, m & (dep > 4), hf - dep * 0.05, C(soil), d, ground_tex(seed, 0.5), 4, 0.15)
    stones = m & (dep > 8) & (fbm(XX / 5, YY / 4, 2, seed + 1) > 0.76)
    hs = _blur(stones.astype(np.float32), 1.5) * 4
    paint(img, stones, hs, C('#8a8478'), d, None, 4, 0.2)
    roots = m & (dep > 6) & (np.abs(fbm(XX / 14, YY / 6, 3, seed + 2) - 0.5) < 0.02)
    fill(img, roots, lit(C('#4a3424'), 0.3, d))
    lip = m & (dep <= 5 + 2 * fbm(XX / 5, YY, 1, seed + 3))
    paint(img, lip, hf, C(grass), d, ground_tex(seed + 4, 0.5), 5, 0.3)
    hang = m & (dep > 4) & (dep < 9) & (fbm(XX / 1.5, np.full_like(YY, 1.0), 1, seed + 5) > 0.55)
    fill(img, hang, lit(C(grass) * 0.7, 0.4, d))
    if path is not None:
        p0, p1 = path
        pm = lip & (XX > p0) & (XX < p1) & (fbm(XX / 4, YY / 2, 2, seed + 6) > 0.35)
        paint(img, pm, hf, C('#b89a6a'), d, ground_tex(seed + 7, 0.4), 4, 0.3)
    return m


def plains():
    setup(sun=(500, 64), sun_col='#fff0c8', amb='#5a76a8', haze='#b8d4e6', light=(0.6, -0.55, 0.6), haze_k=0.62)
    img = sky([(0, '#4e8ed0'), (0.32, '#8ec0e6'), (0.55, '#d8ead8'), (0.62, '#f6ecc8'), (1, '#f6ecc8')])
    sun_glow(img, *P['sun'], 220, '#fff4d0', 0.28)
    sun_glow(img, *P['sun'], 26, '#ffffff', 0.9)
    clouds(img, [(120, 70, 150, 34), (330, 48, 110, 24), (600, 100, 140, 30), (240, 132, 90, 16), (470, 150, 120, 14)], 3)
    # far mountains, then far fields, a farm on a hill, a windmill
    rng = np.random.default_rng(1)
    for (sx_, sy_, hh, sd) in ((230, 160, 70, 61), (340, 166, 60, 62), (470, 158, 70, 63), (590, 168, 55, 64)):
        ridge_mountain(img, (sx_, sy_), 214, hh, 0.02, sd, C('#7a8ab0'), snowline=172, arms=(150, 30, 95, 125, 60))
    hz = hills(212, 14, 60, 5)
    fields(img, hz, 240, 0.12, 11, ['#b8c060', '#88a850', '#d8c070', '#9ab858', '#c8b080', '#a8c060'])
    for (tx, h_) in ((60, 10), (88, 13), (200, 9), (380, 12), (560, 11), (604, 14)):
        broadleaf(img, tx, hz[tx] + 2, h_, 0.6, 0.14, rng, C('#3e6a32'), kind='oak', seed=tx)
    windmill(img, 470, int(hz[470]) + 2, 0.55, 0.15, 0.3)
    farmhouse(img, 420, int(hz[420]) + 3, 0.6, 0.15, seed=1)
    h2 = hills(236, 16, 80, 6)
    fields(img, h2, 290, 0.3, 13, ['#d8b860', '#7aa848', '#c89a58', '#b8c868', '#e0c878', '#8ab850'])
    # the farm in the middle distance: a barn, a farmhouse, a fence, haystacks, an orchard
    barn(img, 352, int(h2[352]) + 4, 0.9, 0.34)
    farmhouse(img, 300, int(h2[300]) + 4, 1.0, 0.34, seed=2)
    for hx in (396, 410, 424):
        m, hf_ = domes([(hx, h2[hx] + 1, 5, 4, 0)], 0.2, hx)
        paint(img, m & (YY < h2[hx] + 3), hf_, C('#e0c070'), 0.36, (fbm(XX / 1, YY / 2, 1, 3) - 0.5) * 0.4, 4, 0.2)
    for tx in range(440, 520, 13):
        broadleaf(img, tx, h2[tx] + 3, 16, 0.8, 0.36, rng, C('#4a7a34'), kind='oak', seed=tx, fruit='#d84030')
    for fx in range(250, 400, 6):
        y = int(h2[fx]) + 6
        fill(img, mask([cap((fx, y), (fx, y - 4), 0.5)]), lit(C('#7a5a3a'), 0.7, 0.36))
    fill(img, mask([cap((250, int(h2[250]) + 3), (400, int(h2[400]) + 3), 0.4)]), lit(C('#7a5a3a'), 0.7, 0.36))
    # the forest edge on the left, a copse on the right
    for (tx, b, h_, w, kd) in ((-8, 270, 150, 4.5, 'oak'), (30, 266, 120, 3.5, 'birch'), (62, 272, 160, 5, 'oak'), (110, 268, 110, 3.2, 'poplar'),
                               (140, 274, 130, 4.0, 'oak'), (186, 276, 90, 3, 'birch'), (214, 278, 60, 3, 'bush'),
                               (590, 270, 120, 3.6, 'oak'), (626, 266, 140, 4, 'poplar'), (548, 276, 70, 3, 'bush')):
        broadleaf(img, tx, b, h_, w, 0.55, rng, C('#3e7a34') if kd != 'birch' else C('#6a9a3a'), kind=kd, seed=tx + 100)
    keep = img.copy()
    shafts(img, [(250, 12, 1.0), (300, 18, 0.8), (350, 9, 1.0), (420, 14, 0.7)], C('#fff2c0'), -0.8, 0.16)
    lim = np.clip((YY - 110) / 60, 0, 1) * (XX < 260)
    img[:] = keep + (img - keep) * lim[..., None]
    for (tx, b, R) in ((-8, 270, 60), (62, 272, 64), (140, 274, 52), (590, 270, 50)):   # the trees' shadows on the grass
        ground_shadow(img, tx, b + 4, R, 6, 0.3)
    # the playfield: a meadow with a dirt path, a rock ledge on the right
    gy = 298 - 4 * fbm(XX[0] / 50, np.zeros(W), 2, 21)
    grass_far = YY >= (gy[None, :] - 18 + 6 * fbm(XX / 40, YY * 0, 2, 22))
    land(img, gy - 18 + 6 * fbm(XX[0] / 40, np.zeros(W), 2, 22), C('#6aa83e'), 0.6, 23, lo=0.35)
    tufts(img, grass_far & ~np.roll(grass_far, 1, 0), (lit(C('#3a6a28'), 0.4, 0.6), lit(C('#6aa83e'), 0.7, 0.6), lit(C('#a8d068'), 0.9, 0.6)),
          24, 1.0, 3, 7, [C('#ffffff'), C('#f0d040'), C('#e05a8a')])
    rock = mask([spoly((488, 300), (500, 270), (520, 258), (580, 254), (620, 262), (640, 280), (640, 300), n=4)])
    hr = cylinder(rock, 10) + fbm(XX / 7, YY / 5, 3, 31) * 10
    paint(img, rock, hr, C('#9a948a'), 0.75, (fbm(XX / 2, YY / 2, 2, 32) - 0.5) * 0.3, 5, 0.15)
    rtop = rock & ~np.roll(rock, 2, 0)
    fill(img, rtop, lit(C('#5a9a3a'), 0.9, 0.75))
    tufts(img, rock & ~np.roll(rock, 1, 0), (lit(C('#3a6a28'), 0.4, 0.75), lit(C('#6aa83e'), 0.7, 0.75), lit(C('#c8f080'), 1, 0.75)),
          33, 1.2, 3, 8)
    for fx in range(300, 480, 12):                                      # an old wooden fence across the meadow
        fy0 = int(gy[fx]) - 14
        fill(img, mask([cap((fx, fy0 + 14), (fx + 0.5, fy0), 1.0)]), lit(C('#6a4a2e'), 0.75, 0.72))
        fill(img, mask([cap((fx, fy0), (fx, fy0 - 1), 1.3)]), lit(C('#8a6a44'), 1.0, 0.72))
    for yy_ in (5, 10):
        fill(img, mask([cap((300, int(gy[300]) - 14 + yy_), (468, int(gy[468]) - 14 + yy_ + 1), 0.6)]), lit(C('#7a5a38'), 0.85, 0.72))
    g = soil_ground(img, gy, 0.85, 41, path=(150, 470))
    rng3 = np.random.default_rng(12)
    for _ in range(14):                                                   # stones and pebbles in the path and grass
        sx2 = int(rng3.uniform(150, 470))
        st = mask([ell(sx2, gy[sx2] + rng3.uniform(1, 4), rng3.uniform(1.5, 3.5), rng3.uniform(1, 2), 0, 10)])
        crag(img, st, C('#a8a092'), 0.85, sx2, 0.3, strata=False)
    tufts(img, g & ~np.roll(g, 1, 0), (lit(C('#3a6a28'), 0.35, 0.85), lit(C('#5a9a36'), 0.7, 0.85), lit(C('#9ac85a'), 0.95, 0.85)),
          42, 1.6, 3, 10, [C('#f4f0e0'), C('#f6d84a'), C('#e85a8a'), C('#8a9af0')])
    # characters
    key = {'dir': (0.6, -0.55, 0.6), 'col': (1.05, 0.95, 0.78)}
    amb = (0.42, 0.48, 0.6)
    grade_actor(img, humanoid_enemy('archer', 570, 255, -1), key, amb, '#fff6c8', 0.85)
    grade_actor(img, quadruped('wolf', 352, int(gy[352]) + 1, -1, 1.3), key, amb, '#fff6c8', 0.92)
    grade_actor(img, quadruped('wolf', 412, int(gy[412]) + 1, -1, 1.25), key, amb, '#fff6c8', 0.9)
    grade_actor(img, quadruped('wolf', 262, int(gy[262]) - 16, -1, 1.3, leap=True), key, amb, '#fff6c8', 0.95, flash='#ff8a2a')
    grade_actor(img, hero(180, int(gy[180]) - 22, 1), key, amb, '#fff6c8', 1.0)
    # near the camera: an oak trunk at the left edge, its leaves across the top, tall grass and flowers at the bottom
    rng2 = np.random.default_rng(77)
    trunk = mask([taper([(-6, 362), (6, 240), (2, 120), (-10, -10)], 26, 18, 6),
                  taper([(8, 150), (60, 90), (130, 40), (200, 20)], 10, 4, 5), taper([(4, 60), (80, 18), (150, -6)], 8, 3, 4),
                  taper([(660, 30), (630, 70), (606, 104)], 7, 2, 4), taper([(642, 52), (612, 50), (590, 70)], 3, 1.5, 3)])
    bark(img, trunk, 10, C('#4a3a2a') * 0.8, 1.0, 5)
    cl = crown_clumps(rng2, 120, 6, 120, 40, 0.3, 0.35) + crown_clumps(rng2, 660, -10, 60, 14, 0.35, 0.5)
    m, hf = domes(cl, 0.4, 81)
    m &= ~((fbm(XX / 6, YY / 6, 2, 82) < 0.25) & ~_dilate(~m, 3))
    leaves(img, m, hf * 1.3, C('#2e5a2a'), 1.0, 83, 5.0, 1.2, ramp=make_ramp(C('#2e5a2a'), 7, hi_k=0.35) * 0.85)
    edge = (YY > 352 - 14 * fbm(XX / 26, YY * 0, 2, 90))
    paint(img, edge, -(YY - 340) * 0.2 + fbm(XX / 5, YY / 3, 2, 92) * 4, C('#3a5a28'), 1.0, None, 4, 0.0, 0.6, 0.5)
    tufts(img, edge & ~np.roll(edge, 1, 0), (C('#1a2a14'), C('#2e4a22'), C('#4e7a32')), 91, 2.6, 10, 34, [C('#f0e6a0'), C('#e86a8a')])
    for (fx, fy_) in ((70, 318), (590, 324), (612, 330)):                 # big near flowers (daisies)
        for j in range(5):
            a = j * 2 * math.pi / 5
            fill(img, mask([ell(fx + math.cos(a) * 3, fy_ + math.sin(a) * 3, 2.2, 1.4, math.degrees(a), 8)]), C('#f4f0e4'))
        fill(img, mask([ell(fx, fy_, 1.6, 1.6, 0, 8)]), C('#f0c040'))
        fill(img, mask([cap((fx, fy_ + 3), (fx - 2, 362), 0.6)]), C('#2e4a22'))
    motes(img, 90, (40, 40, 300, 260), C('#fff8d8'), 5, 0.7)
    for (bx, by, c) in ((300, 230, '#f6f0a0'), (318, 222, '#ffffff'), (440, 200, '#f0a040')):  # butterflies
        img[by, bx - 1] = img[by, bx + 1] = C(c)
        img[by + 1, bx] = C('#3a2a1a')
    for (bx, by) in ((300, 120), (312, 116), (322, 124), (380, 96)):                        # birds
        img[by, bx - 2:bx] = C('#3a4050')
        img[by - 1, bx - 3] = img[by - 1, bx + 1] = C('#3a4050')
        img[by, bx + 1] = C('#3a4050')
    grade(img)
    bloom(img, 0.95, 5, 0.5)
    vignette(img, 0.2)
    hud(img)
    return img


# ============================================================================================== Caves & Mountains

def ridged(x, y, oct_, seed):
    return 1 - np.abs(2 * fbm(x, y, oct_, seed) - 1)


def crag(img, m, alb, d, seed, scale=1.0, snowline=None, snow_k=0.5, strata=True):
    """Bare rock as hand-pixelled facets: the big shape is lit from the sun; it is broken into angular facets, each
    tilted its own way and lit flat, with a bright edge where a facet catches the light and a dark crack under it.
    Snow lies on the facets that face up, above the snowline."""
    if not m.any():
        return
    big = _blur(m.astype(np.float32), 36 * scale) * 200 * scale + _blur(m.astype(np.float32), 8 * scale) * 24 * scale
    warp = fbm(XX / 40, YY / 40, 2, seed + 7) * 3
    g = ridged(XX / (12 * scale) + warp, YY / (80 * scale), 3, seed)          # ribs and gullies running down the slope
    hf = big + g * 5 * scale + fbm(XX / (10 * scale), YY / (7 * scale), 3, seed + 8) * 14 * scale
    macro = macro_light(hf)
    L = P['L']
    cell = max(2.5, 7.0 * scale * (0.5 + d * 0.7))
    F1, F2, DX, DY, ID = worley(cell, seed, 1.5, 0.8)
    nx = (np.modf(ID * 7.13)[0] - 0.5) * 1.3
    ny = (np.modf(ID * 3.71)[0] - 0.5) * 1.1 - 0.15
    nz = np.sqrt(np.clip(1 - nx * nx * 0.5 - ny * ny * 0.5, 0.2, 1))
    facet = np.clip((nx * L[0] + ny * L[1] + nz * L[2]) / np.sqrt(nx * nx + ny * ny + nz * nz), 0, 1)
    t = 0.0 + macro * 0.8 + (facet - 0.55) * 0.4
    if strata:
        t = t - np.where(np.sin((YY * 0.8 + XX * 0.15 + fbm(XX / 30, YY / 30, 2, seed + 3) * 24) * 0.7) > 0.95, 0.12, 0)
    edge = (F2 - F1) < 0.07
    lit_edge = edge & ((DX * L[0] + DY * L[1]) > 0)
    t = np.where(edge & ~lit_edge, t - 0.3, t)
    t = np.where(lit_edge, t + 0.18, t)
    ramp = make_ramp(alb, 7, hi_k=0.5)
    ramp_fill(img, m, t, ramp, d)
    if snowline is not None:
        sl = snowline + (fbm(XX / 30, YY * 0, 3, seed + 5) - 0.5) * 50
        blot = fbm(XX / 9, YY / 6, 3, seed + 6)
        gully = (1 - g) + (blot - 0.5) * 0.5                                   # snow fills the gullies, ribs stay bare
        depth_k = np.clip((sl - YY) / 80, 0, 1)
        snow = m & (YY < sl + 50) & (gully + depth_k * snow_k * 0.8 > 0.62 + np.clip((YY - sl) / 50, 0, 1) * 0.3)
        sr = make_ramp(C('#e4ecf8'), 6, deep=C('#2a3a6a'), hi=C('#ffffff'), hi_k=0.9)
        ramp_fill(img, snow, 0.12 + macro * 0.85 + (facet - 0.5) * 0.15, sr, d)
        under = m & ~snow & np.roll(snow, 1, 0)
        fill(img, under, aerial(ramp[0], d))


def ridge_mountain(img, summit, base_y, height, d, seed, alb, snowline=None, arms=(150, 30, 100), spread=1.0):
    """A mountain built from its ridges: sharp crests branching down from the summit, faces between them lit or in
    shadow depending on which way they turn, snow gathered in the gullies and on the high faces."""
    rng = np.random.default_rng(seed)
    segs = []

    def grow(x, y, h, ang, ln, depth):
        for k in range(5):
            ang = float(np.clip(ang + rng.normal(0, 0.18), 0.35, math.pi - 0.35))   # ridges always run downhill
            nx, ny = x + math.cos(ang) * ln / 5, y + math.sin(ang) * ln / 5
            nh = h + ln / 5 * rng.uniform(0.12, 0.22)                   # the ridge's flanks widen as it runs down
            segs.append((x, y, h, nx, ny, nh))
            if depth > 0 and rng.random() < 0.55:
                grow(nx, ny, nh, ang + rng.choice([-1, 1]) * rng.uniform(0.5, 0.9), ln * rng.uniform(0.35, 0.55), depth - 1)
            x, y, h = nx, ny, nh
    sx, sy = summit
    for a in arms:
        grow(sx, sy, 2.0, math.radians(a + rng.normal(0, 6)), height * spread * rng.uniform(0.9, 1.3), 2)
    hf = np.full((H, W), -1e3, np.float32)
    for (x0, y0, h0, x1, y1, h1) in segs:
        vx, vy = x1 - x0, y1 - y0
        L2 = vx * vx + vy * vy + 1e-6
        t = np.clip(((XX - x0) * vx + (YY - y0) * vy) / L2, 0, 1)
        dist = np.hypot(XX - x0 - t * vx, YY - y0 - t * vy)
        hf = np.maximum(hf, h0 + (h1 - h0) * t - dist * 1.0)
    hf = hf + fbm(XX / 14, YY / 14, 3, seed) * 3
    m = np.maximum.accumulate(hf > 0, axis=0) & (YY < base_y)          # solid below its outline
    gy, gx = np.gradient(hf)
    Lv = P['L']
    nrm = np.sqrt(gx * gx + gy * gy + 0.6)
    face_l = np.clip((-gx * Lv[0] - gy * Lv[1] + 0.6 * Lv[2]) / nrm, 0, 1)
    F1, F2, DX, DY, ID = worley(max(2.0, 5 * (0.4 + d)), seed, 1.6, 0.8)
    t = 0.05 + face_l * 0.85 + (ID - 0.5) * 0.12
    crest = np.abs(_blur(hf, 1.0) - hf) > 0.6
    t = np.where(((F2 - F1) < 0.05) & (d > 0.15), t - 0.1, t)
    ramp = make_ramp(alb, 7, hi_k=0.45)
    ramp_fill(img, m, t, ramp, d)
    if snowline is not None:
        conc = _blur(hf, 3) - hf                                        # gullies are concave
        sl = snowline + (fbm(XX / 25, YY * 0, 3, seed + 5) - 0.5) * 40
        hi = np.clip((sl - YY) / 60, 0, 1)
        snow = m & (YY < sl + 30) & ((conc > 0.6 - hi * 1.2) | ((hi > 0.5) & (fbm(XX / 10, YY / 10, 2, seed + 6) > 0.4)))
        sr = make_ramp(C('#e4ecf8'), 6, deep=C('#2a3a6a'), hi=C('#ffffff'), hi_k=0.9)
        ramp_fill(img, snow, 0.1 + face_l * 0.9, sr, d)
    return m


def bat(x, y, s=1.0, up=True):
    wy = -6 if up else 4
    P = [('#3a2e3a', ('poly', [(x - 2 * s, y), (x - 8 * s, y + wy * s), (x - 13 * s, y + (wy + 2) * s), (x - 11 * s, y + 3 * s),
                               (x - 7 * s, y + 2 * s), (x - 4 * s, y + 4 * s)])),
         ('#3a2e3a', ('poly', [(x + 2 * s, y), (x + 8 * s, y + wy * s), (x + 13 * s, y + (wy + 2) * s), (x + 11 * s, y + 3 * s),
                               (x + 7 * s, y + 2 * s), (x + 4 * s, y + 4 * s)])),
         ('#4a3a4a', ell(x, y + 1 * s, 3 * s, 3.4 * s, 0, 12)), ('#4a3a4a', poly((x - 2.5 * s, y - 1.5 * s), (x - 1.5 * s, y - 5 * s), (x - 0.5 * s, y - 2 * s))),
         ('#4a3a4a', poly((x + 2.5 * s, y - 1.5 * s), (x + 1.5 * s, y - 5 * s), (x + 0.5 * s, y - 2 * s))),
         ('#ff5050', ell(x - 1.2 * s, y, 0.7 * s, 0.7 * s, 0, 6)), ('#ff5050', ell(x + 1.2 * s, y, 0.7 * s, 0.7 * s, 0, 6))]
    return P


def waterfall(img, x, y0, y1, w, d, seed):
    m = (np.abs(XX - x - fbm(XX * 0, YY / 30, 2, seed) * 4) < w) & (YY > y0) & (YY < y1)
    streak = fbm(XX / 1.2, YY / 9 - 0, 2, seed + 1)
    fill(img, m, aerial(C('#cfe6f0'), d))
    fill(img, m & (streak > 0.55), aerial(C('#ffffff'), d))
    fill(img, m & (streak < 0.35), aerial(C('#8ab0c8'), d))
    for k in range(6):
        glow(img, x + (k - 2.5) * w * 0.8, y1, w * 2.5, aerial(C('#ffffff'), d) * 0.5, 0.4)


def mountains():
    setup(sun=(120, 30), sun_col='#fffaf0', amb='#4a62c8', haze='#a8ccf4', light=(-0.6, -0.55, 0.6), haze_k=0.62)
    img = sky([(0, '#1648c8'), (0.3, '#2a72e0'), (0.55, '#6aacf0'), (1, '#b8dcf8')])
    rng = np.random.default_rng(3)
    small_clouds(img, 6, (240, 20, 420, 70), 16, 0.1)
    cumulus(img, 150, 176, 230, 130, 17, 0.08)
    cumulus(img, 590, 150, 170, 100, 18, 0.08, lean=0.1)
    # far range, then the great bald peak with its snowfield, clouds wrapped around its shoulders
    for (sx_, sy_, hh, sd) in ((30, 120, 120, 51), (190, 116, 120, 52), (560, 110, 130, 53), (660, 130, 100, 54)):
        ridge_mountain(img, (sx_, sy_), 230, hh, 0.05, sd, C('#5a74c0'), snowline=185, arms=(150, 30, 95, 125, 60))
    mist_band = np.clip(1 - np.abs(YY - 214) / 14, 0, 1) * (0.5 + fbm(XX / 50, YY / 8, 3, 9) * 0.6)
    a = np.floor(np.clip(mist_band, 0, 1) * 5 + BAY * 0.9) / 5 * 0.7
    img[:] = img * (1 - a[..., None]) + C('#e8f0fc') * a[..., None]
    ridge_mountain(img, (372, 34), 236, 230, 0.2, 8, C('#5a6cb0'), snowline=175, arms=(140, 40, 92, 118, 66), spread=1.0)
    a = np.floor(np.clip(np.clip(1 - np.abs(YY - 222) / 16, 0, 1) * (0.4 + fbm(XX / 40, YY / 8, 3, 10) * 0.7), 0, 1) * 5 + BAY * 0.9) / 5 * 0.75
    img[:] = img * (1 - a[..., None]) + C('#eef4fe') * a[..., None]
    # forested ridges climbing toward the peak: snowy firs high up, green firs lower
    for (y0, amp, d, seed, snow, dens) in ((200, 26, 0.3, 11, 0.25, 0.05), (222, 30, 0.42, 12, 0.35, 0.07), (240, 22, 0.55, 13, 0.0, 0.08)):
        r = hills(y0, amp, 70, seed, 3)
        rm = YY >= r[None, :]
        alb = C('#6ab848') if snow < 0.2 else C('#8ab07a')
        F1, F2, DX, DY, ID = worley(2.0, seed, 1.5, 0.7)
        ramp_fill(img, rm, 0.35 + fbm(XX / 40, YY / 10, 3, seed) * 0.5 + (0.5 - DY) * 0.15 - np.clip(YY - r[None, :], 0, 30) / 30 * 0.2,
                  make_ramp(alb, 7, hi_k=0.55), d)
        patch = fbm(XX / 45, np.full_like(XX, seed * 3.0), 3, seed + 1)[0]
        xs = np.arange(-6, W + 6, max(2, int(3 + d * 6)))
        for x in xs:
            if patch[int(np.clip(x, 0, W - 1))] > 0.45 and rng.random() < 0.9:
                xi = int(np.clip(x, 0, W - 1))
                hh = rng.uniform(10, 18) * (0.6 + d)
                fir(img, x + rng.uniform(-2, 2), r[xi] + rng.uniform(2, 10), hh, hh * 0.3, d, rng,
                    C('#2e5a3a') if snow < 0.5 else C('#3a5a4a'), snow, seed + int(x))
        if d < 0.5:
            mist_ = (np.clip(1 - np.abs(YY - (r[None, :] + 14)) / 10, 0, 1) * (fbm(XX / 40, YY / 6, 3, seed) > 0.45))
            a = np.floor(mist_ * 4 + BAY * 0.9) / 4 * 0.35
            img[:] = img * (1 - a[..., None]) + P['haze'] * a[..., None]
    stream = (np.abs(XX - (240 + 90 * np.sin((YY - 240) / 9.0) + (YY - 240) * 2.2)) < 1.5 + (YY - 240) * 0.15) & (YY > 244) & (YY < 262)
    fill(img, stream, aerial(C('#9ad0f0'), 0.5))                          # a stream winding down the valley
    fill(img, stream & (fbm(XX / 2, YY, 1, 3) > 0.6), aerial(C('#ffffff'), 0.5))
    # the cliff with the mine cave on the right
    cliff = mask([spoly((420, 300), (430, 240), (452, 196), (490, 170), (560, 156), (640, 150), (660, 160), (660, 300), n=4)])
    crag(img, cliff, C('#8a8a98'), 0.62, 31, 0.8)
    top = cliff & ~np.roll(cliff, 3, 0)
    fill(img, top, lit(C('#5a9a3a'), 0.9, 0.62))
    tufts(img, cliff & ~np.roll(cliff, 1, 0), (lit(C('#3a6a28'), 0.4, 0.62), lit(C('#5a9a36'), 0.7, 0.62), lit(C('#a8d068'), 0.95, 0.62)),
          32, 1.5, 2, 6)
    for (tx, h_) in ((470, 50), (520, 66), (600, 72), (632, 58)):
        fir(img, tx, int(np.argmax(cliff[:, tx])) + 6, h_, h_ * 0.28, 0.62, rng, C('#2e6a3a'), 0, tx)
    cave = mask([spoly((500, 262), (504, 236), (520, 222), (540, 220), (556, 232), (560, 262), n=4)])
    fill(img, cave, C('#140e10'))
    glow(img, 530, 250, 30, C('#ff9a40'), 0.5)
    for bx in (500, 558):                                               # timber frame
        fill(img, mask([cap((bx, 262), (bx + (2 if bx < 530 else -2), 226), 2)]), lit(C('#6a4a2e'), 0.8, 0.65))
    fill(img, mask([cap((496, 226), (564, 226), 2.2)]), lit(C('#6a4a2e'), 0.9, 0.65))
    for k in range(9):                                                  # minecart rails into the cave
        x = 470 + k * 10
        fill(img, mask([cap((x, 262), (x + 4, 262), 1)]), lit(C('#5a3a24'), 0.7, 0.7))
    fill(img, mask([cap((462, 260), (560, 260), 0.5)]), lit(C('#6a6a70'), 0.8, 0.7))
    cart = mask([poly((470, 258), (468, 246), (492, 246), (490, 258))])
    face(img, cart, C('#6a6058'), 0.7, 0.7)
    fill(img, mask([ell(474, 259, 2.6, 2.6, 0, 8), ell(486, 259, 2.6, 2.6, 0, 8)]), lit(C('#2a2428'), 0.5, 0.7))
    m, hf = domes([(476, 245, 5, 3, 0), (484, 244, 5, 3.5, 0)], 0.4, 3)
    paint(img, m, hf, C('#c8a070'), 0.7, (fbm(XX, YY, 1, 4) - 0.5) * 0.5, 4, 0.2)                      # ore in the cart
    fill(img, mask([cap((566, 238), (566, 230), 0.6)]), lit(C('#3a2a1e'), 0.6, 0.7))
    img[231:235, 565:568] = C('#ffd070')
    glow(img, 566, 233, 16, C('#ff9a40'), 0.5)
    # the bright green lower forest on the left
    for (tx, b, h_, w, kd) in ((-6, 286, 130, 4.4, 'oak'), (40, 280, 96, 3.2, 'birch'), (84, 288, 150, 5, 'oak'), (300, 290, 80, 3, 'bush'),
                               (360, 290, 70, 3, 'birch')):
        broadleaf(img, tx, b, h_, w, 0.72, rng, C('#4a8a34') if kd != 'birch' else C('#7aaa3a'), kind=kd, seed=tx + 200)
    for (tx, h_) in ((128, 140), (180, 110), (230, 150), (396, 120)):
        fir(img, tx, 292, h_, h_ * 0.24, 0.74, rng, C('#2e6a3a'), 0, tx + 300)
    # the trail: rising ground with stone steps
    gy = 312 - (np.clip(XX[0] - 180, 0, 300) * 0.06) - 4 * fbm(XX[0] / 40, np.zeros(W), 2, 41)
    g = YY >= gy[None, :]
    F1, F2, DX, DY, ID = worley(2.4, 42, 1.3, 0.8)
    gt = 0.62 - np.clip(YY - gy[None, :], 0, 50) / 50 * 0.45 + (0.5 - DY) * 0.25 + (ID - 0.5) * 0.15 + (fbm(XX / 30, YY / 10, 2, 44) - 0.5) * 0.3
    ramp_fill(img, g, gt, make_ramp(C('#5ab43a'), 7, hi_k=0.55), 0.88)
    pathc = 300 + 120 * np.sin((YY - 300) / 22.0)                                     # a dirt path winding down toward us
    path = g & (np.abs(XX - pathc) < 6 + (YY - gy[None, :]) * 0.6) & (fbm(XX / 5, YY / 3, 2, 43) > 0.25)
    path |= g & (YY < gy[None, :] + 6) & (fbm(XX / 5, YY / 3, 2, 45) > 0.3)
    ramp_fill(img, path, 0.45 + (fbm(XX / 3, YY / 2, 2, 46) - 0.5) * 0.5, make_ramp(C('#d0b080'), 6, hi_k=0.45), 0.88)
    rng4 = np.random.default_rng(47)
    for _ in range(260):                                                              # wildflowers in the meadow
        fx, fy_ = int(rng4.uniform(0, W)), int(rng4.uniform(gy.min() + 4, 352))
        if g[fy_, fx] and not path[fy_, fx]:
            img[fy_, fx] = C(rng4.choice(['#ffffff', '#ffffff', '#f6d84a', '#e84a5a', '#8a9af8']))
    for (bx, by, r_) in ((60, 330, 16), (430, 326, 12), (500, 344, 22), (250, 340, 9)):    # boulders in the grass
        bm = mask([spoly((bx - r_, by + 3), (bx - r_ * 0.8, by - r_ * 0.6), (bx - r_ * 0.1, by - r_), (bx + r_ * 0.7, by - r_ * 0.7),
                         (bx + r_, by + 3), n=2)])
        crag(img, bm, C('#9aa0b4'), 0.9, bx, 0.4, strata=False)
    for k in range(8):
        sx = 200 + k * 30
        st = mask([poly((sx, gy[sx] + 1), (sx + 14, gy[sx + 14] + 1), (sx + 14, gy[sx + 14] + 5), (sx, gy[sx] + 5))])
        paint(img, st, cylinder(st, 3), C('#a49a8a'), 0.88, None, 4, 0.3)
    tufts(img, g & ~np.roll(g, 1, 0), (lit(C('#3a6a28'), 0.35, 0.88), lit(C('#5a9a36'), 0.7, 0.88), lit(C('#9ac85a'), 0.95, 0.88)),
          43, 1.4, 3, 9, [C('#f4f0e0'), C('#8a9af0'), C('#f6d84a')])
    sp = int(gy[120])
    fill(img, mask([cap((120, sp + 2), (120, sp - 26), 1.4)]), lit(C('#6a4a2e'), 0.8, 0.88))
    for (yy_, dx, txt) in ((sp - 24, 1, 0), (sp - 16, -1, 1)):
        bd = mask([poly((120, yy_), (120 + dx * 20, yy_), (120 + dx * 24, yy_ + 3), (120 + dx * 20, yy_ + 6), (120, yy_ + 6))])
        face(img, bd, C('#9a7448'), 0.85 if dx > 0 else 0.6, 0.88)
        fill(img, bd & (np.abs(YY - yy_ - 3) < 0.6) & (np.sin(XX * 1.7) > 0), lit(C('#3a2818'), 0.5, 0.88))
    rock = mask([spoly((300, 300), (306, 276), (330, 268), (360, 272), (372, 300), n=4)])
    crag(img, rock, C('#9aa0b4'), 0.85, 51, 0.5)
    fill(img, rock & ~np.roll(rock, 2, 0), lit(C('#5a9a3a'), 0.9, 0.85))
    for k in range(40):                                                   # grass and roots hanging over the cliff's edge
        rx_ = 432 + k * 5
        top_y = int(np.argmax(cliff[:, min(rx_, W - 1)]))
        ln_ = 3 + (k * 7) % 9
        fill(img, mask([cap((rx_, top_y + 2), (rx_ + (k % 3 - 1), top_y + 2 + ln_), 0.5)]), aerial(C('#3a6a28') if k % 3 else C('#5a3a24'), 0.62))
    keep = img.copy()
    light_shafts(img, [(120, 14, 1.0), (170, 22, 0.7), (230, 10, 0.9)], '#fffaf0', 0.55, 0.12, 40, 300)
    img[:] = np.where((XX < 420)[..., None], img, keep)
    for (bx, by) in ((520, 70), (532, 64), (546, 72)):                     # eagles circling
        img[by, bx - 3:bx] = C('#2a2a3a')
        img[by - 1, bx - 4] = img[by - 1, bx + 1] = C('#2a2a3a')
        img[by, bx + 1:bx + 3] = C('#2a2a3a')
    feet_shadows(img, [(176, int(gy[176]) + 1, 10), (590, 263, 10)], 0.35)
    # characters: the hero on the trail, a ram on the rock, a goblin miner at the cave, bats coming out of it
    key = {'dir': (-0.6, -0.55, 0.6), 'col': (1.05, 1.0, 0.9)}
    amb = (0.44, 0.52, 0.68)
    grade_actor(img, quadruped('ram', 340, 268, 1, 1.35), key, amb, '#ffffff', 0.88)
    grade_actor(img, humanoid_enemy('goblin', 590, 262, -1, 40), key, amb, '#fff4d8', 0.8)
    for (bx, by, up) in ((520, 206, True), (548, 190, False), (500, 186, True)):
        grade_actor(img, bat(bx, by, 1.2, up), key, amb, '#d8e0ff', 0.8)
    grade_actor(img, hero(176, int(gy[176]) - 1, 1, 'walk'), key, amb, '#fff6e0', 1.0)
    # near the camera: fir boughs top right, a mossy boulder and ferns at the bottom
    for (x0, y0, x1, y1) in ((660, 10, 520, 40), (660, 60, 560, 84)):
        S = [taper([(x0, y0), (x1, y1)], 4, 1.5, 3)]
        n_ = 14
        for j in range(n_):
            t = j / n_
            bx, by = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            S.append(taper([(bx, by), (bx - 6, by + 10 + 4 * (1 - t))], 3, 0.8, 2))
            S.append(taper([(bx, by), (bx + 4, by + 12 + 3 * (1 - t))], 3, 0.8, 2))
        m = mask(S)
        m = m | (_dilate(m, 2) & (fbm(XX / 1.2, YY / 1.2, 1, x1) > 0.45))
        paint(img, m, cylinder(m, 3), C('#1e4a2a'), 1.0, (fbm(XX / 1.3, YY / 2, 2, 5) - 0.5) * 0.6, 4, 0.0, 0.7, 0.7)
    boulder = mask([spoly((-10, 362), (-6, 320), (30, 306), (70, 316), (90, 362), n=4)])
    crag(img, boulder, C('#7a80a0'), 1.0, 61, 0.6, strata=False)
    fill(img, boulder & ~np.roll(boulder, 4, 0) & (fbm(XX / 3, YY / 3, 2, 62) > 0.35), aerial(C('#4a8a2a'), 1.0))
    band = YY > 350 + 5 * fbm(XX / 20, YY * 0, 2, 63)
    tufts(img, band & ~np.roll(band, 1, 0), (C('#1e4a1a'), C('#3a8a2a'), C('#8ad050')), 64, 3.0, 10, 30, [C('#ffffff'), C('#f6d84a')])
    for (fx, fy_) in ((560, 362), (600, 362), (630, 362), (300, 362), (340, 364)):  # ferns
        for j in range(9):
            a = math.radians(-160 + j * 17)
            ln = 30 + 10 * math.sin(j)
            S = [taper([(fx, fy_), (fx + math.cos(a) * ln * 0.6, fy_ + math.sin(a) * ln * 0.7), (fx + math.cos(a) * ln, fy_ + math.sin(a) * ln * 0.6 + 6)], 2, 0.6, 3)]
            m = mask(S)
            m = m | (_dilate(m, 2) & (np.sin((XX + YY) * 1.6) > 0.1))
            paint(img, m, cylinder(m, 2), C('#2e5a2a'), 1.0, None, 4, 0.1, 0.7, 0.6)
    tr = mask([taper([(-14, 362), (-4, 200), (2, -10)], 30, 22, 4)])        # a fir trunk right at the left edge of the camera
    bark(img, tr, 12, C('#4a3828') * 0.7, 1.0, 91)
    for (y0_, y1_) in ((40, 70), (110, 136), (190, 210)):                 # drooping boughs off the trunk
        S = [taper([(4, y0_), (60, y0_ + 12), (100, y1_ + 14)], 3, 1, 4)]
        for j in range(16):
            t = j / 16
            bx_, by_ = 4 + 96 * t, y0_ + (y1_ + 14 - y0_) * t ** 1.3
            S.append(taper([(bx_, by_), (bx_ - 5, by_ + 9 - 4 * t)], 2.6, 0.7, 2))
            S.append(taper([(bx_, by_), (bx_ + 4, by_ + 10 - 4 * t)], 2.6, 0.7, 2))
        bm = mask(S)
        bm = bm | (_dilate(bm, 2) & (fbm(XX / 1.2, YY / 1.2, 1, y0_) > 0.45))
        ramp_fill(img, bm, 0.15 + (fbm(XX / 1.3, YY / 2, 2, y0_) - 0.5) * 0.4 + np.where(bm & ~np.roll(bm, 2, 0), 0.3, 0),
                  make_ramp(C('#1e4a2a'), 6, hi_k=0.3) * 0.75, 1.0)
    motes(img, 60, (0, 120, 640, 300), C('#ffffff'), 8, 0.5)
    grade(img, 1.14, 1.05)
    bloom(img, 0.95, 5, 0.4)
    vignette(img, 0.2)
    hud(img)
    return img


# ============================================================================================== Enemy Kingdom

def rect(x0, y0, x1, y1):
    return mask([poly((x0, y0), (x1, y0), (x1, y1), (x0, y1))])


def window(img, x, y, w, h, d, lit_k, rng, shutters=True, arch=False, box=None):
    """A small window: a frame, glass (dark, or warm-lit from inside), a cross bar, sometimes open shutters."""
    fr = rect(x - 1, y - 1, x + w + 1, y + h + 1)
    fill(img, fr, lit(C('#3a2818'), 0.4, d))
    gl = rect(x, y, x + w, y + h)
    if arch:
        gl = gl & ~((YY < y + 2) & (np.abs(XX - x - w / 2) > w / 2 - 1))
    if lit_k > 0:
        fill(img, gl, aerial(mix(C('#ffb050'), C('#ffe8a0'), 0.3), d * 0.5 + 0.5))
        fill(img, gl & (YY > y + h * 0.6), aerial(C('#ff9a3a'), d * 0.5 + 0.5))
        glow(img, x + w / 2, y + h / 2, w * 3, aerial(C('#ff9a3a'), d), 0.25 * lit_k)
    else:
        fill(img, gl, lit(C('#2a3040'), 0.5, d))
        fill(img, gl & (XX - x + (YY - y) < 2), lit(C('#8aa0c0'), 0.8, d))
    fill(img, gl & ((np.abs(XX - (x + w / 2)) < 0.5) | (np.abs(YY - (y + h / 2)) < 0.5)), lit(C('#3a2818'), 0.4, d))
    if box is None:
        box = rng.random() < 0.35
    x, y, w, h = int(x), int(y), int(w), int(h)
    if box and w >= 3:                                                   # a flower box under the window
        fill(img, rect(x - 1, y + h + 1, x + w + 1, y + h + 3), lit(C('#6a4428'), 0.6, d))
        for k in range(w + 2):
            c = C(['#d83a4a', '#f0c040', '#e86aa0', '#ffffff'][int(rng.integers(4))])
            yy_ = y + h + int(rng.integers(-1, 1))
            if 0 <= yy_ < H and 0 <= x - 1 + k < W:
                img[yy_, x - 1 + k] = aerial(C('#3a6a2a') if k % 2 else c, d)
    if shutters and rng.random() < 0.5:
        sc = C(rng.choice(['#4a6a8a', '#6a8a4a', '#8a4a3a', '#5a4a3a']))
        face(img, rect(x - 1 - w // 2, y - 1, x - 1, y + h + 1), sc, 0.6, d)
        face(img, rect(x + w + 1, y - 1, x + w + 1 + w // 2, y + h + 1), sc, 0.85, d)


def house(img, x, base, w, floors, d, seed, fh=24, roof='gable', wall=None, rooftile=None, shop=False, lights=0.5, wq=0.62, stonework=False):
    """A timber-framed town house: a stone ground floor, plastered upper floors that jut out over the street, dark oak
    beams and braces, windows (some lit), a steep tiled roof with a chimney. Lit by the low sun from the right."""
    rng = np.random.default_rng(seed)
    wall = C(wall or rng.choice(['#e8d8b8', '#e0c890', '#d8b8a0', '#c8c8b8', '#e8dcc8', '#d0a878']))
    rooftile = C(rooftile or rng.choice(['#8a3a2a', '#6a3a30', '#4a4a58', '#7a4a32', '#5a3a3a']))
    beam = C('#3e2a1e')
    y = base
    x0, x1 = x, x + w
    # ground floor in stone
    gf = rect(x0, y - fh, x1, y)
    q = tone(_blur(gf.astype(np.float32), 2) * 4, (fbm(XX / 2, YY / 2, 2, seed) - 0.5) * 0.2, 4, 0.35)
    stone = lit(C('#a89a88'), q * wq * 1.1, d)
    img[gf] = stone[gf]
    joints = gf & ((np.abs(((YY - y) % 5)) < 0.6) | (np.abs(((XX - x0 + 4 * ((YY - y) // 5 % 2)) % 9)) < 0.6))
    fill(img, joints, lit(C('#6a5e50'), 0.4, d))
    if shop:
        dx = x0 + w * 0.12
        door = rect(dx, y - fh * 0.75, dx + w * 0.22, y)
        door &= ~((YY < y - fh * 0.75 + 3) & (np.abs(XX - (dx + w * 0.11)) > w * 0.11 - 2))
        face(img, door, C('#5a3a22'), 0.5, d)
        fill(img, door & (np.abs(XX - (dx + w * 0.11)) < 0.5), lit(C('#2a1a10'), 0.3, d))
        sx = x0 + w * 0.45
        fill(img, rect(sx, y - fh * 0.7, x1 - w * 0.1, y - fh * 0.2), aerial(C('#ffb860'), d))
        glow(img, (sx + x1) / 2, y - fh * 0.45, w * 0.6, aerial(C('#ff9a40'), d), 0.4 * lights * 2)
        for k in range(int((x1 - w * 0.1 - sx) // 5)):
            fill(img, rect(sx + k * 5 + 1, y - fh * 0.62, sx + k * 5 + 3, y - fh * 0.5), aerial(C(rng.choice(['#c84a3a', '#e8b040', '#6a9a3a'])), d))
        aw = mask([poly((sx - 3, y - fh * 0.78), (x1 - w * 0.06, y - fh * 0.78), (x1 - w * 0.02, y - fh * 0.6), (sx - 7, y - fh * 0.6))])
        stripes = np.sin((XX - sx) * 0.9) > 0
        ac = C(rng.choice(['#b83a3a', '#3a6a9a', '#3a8a5a', '#c8a03a']))
        fill(img, aw & stripes, lit(ac, 0.75, d))
        fill(img, aw & ~stripes, lit(C('#efe6d0'), 0.75, d))
        fill(img, aw & ~np.roll(aw, -1, 0), lit(ac * 0.6, 0.4, d))
        if d > 0.7:                                                        # a hanging sign on an iron bracket
            sx2 = x1 - 2
            fill(img, mask([cap((sx2, y - fh - 4), (sx2 + 12, y - fh - 4), 0.6)]), lit(C('#1a1414'), 0.4, d))
            sg = rect(sx2 + 3, y - fh - 3, sx2 + 12, y - fh + 5)
            face(img, sg, C('#7a5032'), 0.7, d)
            fill(img, sg & ~_dilate(~sg, 0) & (~np.roll(sg, 1, 0) | ~np.roll(sg, -1, 0) | ~np.roll(sg, 1, 1) | ~np.roll(sg, -1, 1)), lit(C('#3a2414'), 0.4, d))
            sym = rng.choice(['#e8c050', '#c8d0e0', '#d84a3a'])
            fill(img, mask([ell(sx2 + 7.5, y - fh + 1, 2.2, 2.2, 0, 10)]), lit(C(sym), 0.9, d))
    else:
        dx = x0 + w * rng.uniform(0.2, 0.6)
        door = rect(dx, y - fh * 0.8, dx + max(5, w * 0.16), y)
        face(img, door, C('#4a3020'), 0.5, d)
        window(img, int(x0 + w * 0.1), int(y - fh * 0.7), max(3, int(w * 0.1)), max(4, int(fh * 0.3)), d, 0, rng, False)
    y -= fh
    # upper floors, each jutting out a little more
    for f in range(floors - 1):
        jut = 2 * (f + 1)
        a, b = x0 - jut, x1 + jut
        fl = rect(a, y - fh, b, y)
        if stonework:                                                  # a stone house: cut blocks, tall windows
            blocks(img, fl, C('#b4aea2'), d, seed + f, 7, 4, wq * 0.8, 0.25, np.clip((XX - b + 6) / 6, 0, 1))
            nwin = max(1, int((b - a) / 15))
            for i in range(nwin):
                cxw = a + (b - a) * (i + 0.5) / nwin
                window(img, int(cxw - 2), int(y - fh * 0.78), 4, max(5, int(fh * 0.55)), d, 1 if rng.random() < lights else 0, rng, False)
            fill(img, rect(a - 1, y, b + 1, y + 2), lit(C('#5a5048'), 0.3, d))
            y -= fh
            continue
        fill(img, fl, lit(wall, wq, d))
        fill(img, fl & (fbm(XX / 3, YY / 3, 2, seed + f) > 0.66), lit(wall * 0.9, wq * 0.85, d))
        bricks = fl & (fbm(XX / 5, YY / 4, 2, seed + f + 50) > 0.74)               # plaster fallen off, bricks showing
        fill(img, bricks, lit(C('#9a4a32'), wq * 1.1, d))
        fill(img, bricks & ((np.abs(YY % 2) < 0.6) | (np.abs((XX + 2 * (YY // 2 % 2)) % 4) < 0.6)), lit(C('#5a3424'), wq, d))
        crack = fl & (np.abs(fbm(XX / 6, YY / 3, 3, seed + f + 60) - 0.5) < 0.012)
        fill(img, crack, lit(wall * 0.55, wq, d))
        for bx in np.linspace(a, b, max(3, int(w / 11)) + 1):
            fill(img, fl & (np.abs(XX - bx) < 1), lit(beam, 0.5, d))
        fill(img, fl & ((np.abs(YY - (y - 1)) < 1.2) | (np.abs(YY - (y - fh + 1)) < 1)), lit(beam, 0.5, d))
        cells = np.linspace(a, b, max(3, int(w / 11)) + 1)
        for i in range(len(cells) - 1):
            ca, cb = cells[i], cells[i + 1]
            if (i + f) % 2 == 0:
                if rng.random() < 0.5:
                    fill(img, fl & (np.abs((XX - ca) / (cb - ca) * fh - (y - YY)) < 1.1), lit(beam, 0.5, d))
                else:
                    fill(img, fl & (np.abs((cb - XX) / (cb - ca) * fh - (y - YY)) < 1.1), lit(beam, 0.5, d))
            else:
                ww = max(3, int((cb - ca) * 0.5))
                window(img, int((ca + cb) / 2 - ww / 2), int(y - fh * 0.75), ww, max(4, int(fh * 0.45)), d,
                       1 if rng.random() < lights else 0, rng)
        fill(img, rect(a - 1, y, b + 1, y + 2), lit(beam * 0.7, 0.3, d))            # shadow under the jetty
        fill(img, fl & (XX > b - 2), lit(wall, 1.0, d))                              # sun on the right edge
        y -= fh
    jut = 2 * floors
    a, b = x0 - jut, x1 + jut
    # the roof
    if roof == 'gable':
        top = y - (b - a) * 0.75
        rf = mask([poly((a - 3, y + 1), ((a + b) / 2, top), (b + 3, y + 1))])
        lt = rf & (XX > (a + b) / 2)
        q = 0.85 if True else 0.6
        fill(img, rf, lit(rooftile, wq * 0.7, d))
        fill(img, lt, lit(rooftile, q, d))
        rowi = np.floor((YY - y) / 3)
        u = ((XX + (rowi % 2) * 1.5) % 3) / 3
        tile_edge = (np.abs(((YY - y) % 3)) < 0.7) | ((np.abs(u - 0.5) > 0.4) & (((YY - y) % 3) < 1.6))
        fill(img, rf & tile_edge, lit(rooftile * 0.55, 0.3, d))
        fill(img, lt & ~tile_edge & (((YY - y) % 3) > 1.8), lit(rooftile * 1.2, 1.0, d))
        fill(img, rf & (fbm(XX / 3, YY / 3, 2, seed + 9) > 0.72), lit(C('#5a6a3a'), 0.6, d))         # moss
        edge_r = rf & ~np.roll(rf, -1, 1) & (XX > (a + b) / 2)
        fill(img, _dilate(edge_r, 0) , lit(C('#ffd8a0'), 1.2, d))                                      # sun on the eave
        fill(img, rf & (np.abs(YY - (y + 0.5)) < 1), lit(C('#3a2a20'), 0.4, d))                         # gutter
        gab = mask([poly((a + 3, y), ((a + b) / 2, top + 6), (b - 3, y))])
        fill(img, gab, lit(wall, wq, d))
        fill(img, gab & ((np.abs(XX - (a + b) / 2) < 1) | (np.abs(YY - (y - 1)) < 1)), lit(beam, 0.5, d))
        window(img, int((a + b) / 2 - 2), int(y - (b - a) * 0.3), 4, 5, d, 1 if rng.random() < lights else 0, rng, False)
        ridge_y = top
    else:
        top = y - fh * 0.9
        rf = mask([poly((a - 4, y + 1), (a + 6, top), (b - 6, top), (b + 4, y + 1))])
        fill(img, rf, lit(rooftile, 0.6, d))
        fill(img, rf & (np.abs(((YY - y) % 3)) < 0.7), lit(rooftile * 0.7, 0.35, d))
        fill(img, rf & (XX > b - 8), lit(rooftile, 0.9, d))
        for k in range(int((b - a) // 22)):                                      # dormers
            dxx = a + 12 + k * 22
            dm = rect(dxx, top + 3, dxx + 7, y - 2)
            fill(img, dm, lit(wall, 0.6, d))
            fill(img, mask([poly((dxx - 2, top + 4), (dxx + 3.5, top - 2), (dxx + 9, top + 4))]), lit(rooftile, 0.8, d))
            window(img, dxx + 2, int(top + 5), 3, 4, d, 1 if rng.random() < lights else 0, rng, False)
        ridge_y = top
    cx = int(a + (b - a) * rng.uniform(0.6, 0.85))
    ch = rect(cx, ridge_y + (b - a) * 0.15 - 12, cx + 5, y - 4) & ~rf | rect(cx, ridge_y + (b - a) * 0.15 - 12, cx + 5, ridge_y + (b - a) * 0.2)
    face(img, ch, C('#8a6a5a'), 0.7, d)
    fill(img, ch & (XX > cx + 3), lit(C('#8a6a5a'), 1.0, d))
    for j in range(5):
        glow(img, cx + 3 - j * 3, ridge_y + (b - a) * 0.15 - 16 - j * 6, 3 + j * 1.5, aerial(C('#a8a0a8'), d) * 0.4, 0.4)
    return ridge_y


def cobbles(img, y0, y1, d, seed, x0=0, x1=W):
    """A cobbled street: rows of rounded stones, each lit on its sunny side, dark gaps between."""
    rng = np.random.default_rng(seed)
    fill(img, rect(x0, y0, x1, y1), lit(C('#4a3a34'), 0.3, d))
    cl = []
    y = y0 + 2
    row = 0
    while y < y1 + 4:
        sz = 2.2 + (y - y0) * 0.05
        x = -sz + (row % 2) * sz
        while x < W + sz:
            cl.append((x + rng.normal(0, 0.4), y + rng.normal(0, 0.3), sz * rng.uniform(0.9, 1.15), sz * 0.6, 0))
            x += sz * 2.1
        y += sz * 1.15
        row += 1
    m, hf = domes(cl, 0.1, seed)
    m &= (YY >= y0) & (XX >= x0) & (XX < x1)
    nx, ny = _DN['nx'], _DN['ny']
    L = P['L']
    nz = np.sqrt(np.clip(1 - nx * nx * 0.7 - ny * ny * 0.7, 0.05, 1))
    t = 0.1 + np.clip((nx * L[0] + ny * L[1] * 0.3 + nz * 0.6), 0, 1) * 0.38 + (fbm(XX / 3, YY / 3, 2, seed) - 0.5) * 0.2
    ramp = make_ramp(C('#6a5e5a'), 6, hi_k=0.35)
    ramp_fill(img, m, t, ramp, d)


def castle_far(img, x, base, s, d, seed):
    """The King's castle on its hill far away: a curtain wall, round towers shaded like cylinders with slate cone
    roofs, the great keep, little windows, flags."""
    rng = np.random.default_rng(seed)
    hill = mask([spoly((x - 160 * s, base + 30), (x - 90 * s, base - 4), (x, base - 14 * s), (x + 100 * s, base - 2), (x + 170 * s, base + 30), n=4)])
    ramp_fill(img, hill, 0.45 + fbm(XX / 20, YY / 8, 2, seed) * 0.3, make_ramp(C('#5a9a4a'), 6), d)
    k = lambda v: v * s
    stone = C('#c0b8ac')
    wall = rect(x - k(70), base - k(40), x + k(70), base - k(8))
    blocks(img, wall, stone, d, seed, 6, 4, 0.55, 0.0, None)
    for cx in np.arange(x - k(70), x + k(70), k(6)):
        face(img, rect(cx, base - k(44), cx + k(3), base - k(40)), stone, 0.6, d)
    L = P['L']
    for (tx, th, tw) in ((-70, 70, 12), (-30, 90, 10), (0, 120, 22), (34, 100, 11), (72, 66, 13)):
        tx = x + k(tx)
        tower = rect(tx - k(tw / 2), base - k(th), tx + k(tw / 2), base - k(8))
        u = np.clip((XX - tx) / k(tw / 2), -1, 1) * np.sign(L[0])
        t = 0.25 + np.sqrt(np.clip(1 - u * u, 0, 1)) * 0.3 + u * 0.3 + np.where(np.abs((YY - base) % 4) < 0.6, -0.1, 0)
        ramp_fill(img, tower, t, make_ramp(stone, 6, hi_k=0.5), d)
        rf = mask([poly((tx - k(tw / 2 + 2), base - k(th)), (tx, base - k(th + tw * 1.6)), (tx + k(tw / 2 + 2), base - k(th)))])
        ramp_fill(img, rf, 0.3 + np.clip((XX - tx) / k(tw / 2), -1, 1) * 0.35 * np.sign(L[0]), make_ramp(C('#4a5a8a'), 6, hi_k=0.5), d)
        fill(img, mask([cap((tx, base - k(th + tw * 1.6)), (tx, base - k(th + tw * 1.6 + 10)), 0.5)]), aerial(C('#2a2028'), d))
        fill(img, mask([poly((tx, base - k(th + tw * 1.6 + 10)), (tx + k(8), base - k(th + tw * 1.6 + 8)), (tx, base - k(th + tw * 1.6 + 6)))]),
             aerial(C('#c82a2a'), d))
        for j in range(int(th / 18)):
            if rng.random() < 0.6:
                wy = int(base - k(th) + k(10 + j * 16))
                fill(img, rect(tx - 1, wy, tx + 1, wy + max(1, int(k(4)))), aerial(C('#2a2a40'), d))


def city():
    setup(sun=(560, 196), sun_col='#ffb878', amb='#5a5a90', haze='#d88a80', light=(0.8, 0.35, 0.5), haze_k=0.6)
    img = sky([(0, '#2a2a5a'), (0.25, '#5a4a7a'), (0.45, '#b8687a'), (0.58, '#f0a070'), (0.7, '#ffd08a'), (1, '#ffd08a')])
    sun_glow(img, *P['sun'], 300, '#ffb070', 0.5)
    sun_glow(img, *P['sun'], 22, '#fff4d0', 1.0)
    rng = np.random.default_rng(5)
    # sunset clouds, lit from below and from the sun's side
    clouds(img, [(110, 70, 200, 22), (420, 96, 260, 20), (620, 150, 120, 12), (250, 150, 160, 12)], 4, alb='#e0a0a8', d=0.3)
    # the castle on its hill, far away, and the city walls in front of it
    before = img.copy()
    castle_far(img, 200, 190, 1.0, 0.12, 3)
    ch = np.abs(img - before).sum(axis=2) > 0.01
    rimc = ch & ~np.roll(ch, -1, 1)
    img[ch] = mix(img[ch], C('#6a4a6e'), 0.6)
    img[rimc] = mix(img[rimc], C('#ffd0a0'), 0.7)
    for (bx, by) in ((470, 120), (480, 114), (492, 122), (430, 140), (442, 136)):                  # birds against the sunset
        img[by, bx - 2:bx] = C('#3a2030')
        img[by - 1, bx - 3] = img[by - 1, bx + 1] = C('#3a2030')
    haze_band(img, 196, 22, 0.55, '#f0a088', 31, 50)
    walls = rect(-10, 196, 660, 214)
    face(img, walls, C('#8a7a7a'), 0.25, 0.2)
    for cx in range(-10, 660, 6):
        face(img, rect(cx, 192, cx + 3, 196), C('#8a7a7a'), 0.5, 0.2)
    for tx in (40, 300, 470, 610):
        face(img, rect(tx - 8, 176, tx + 8, 214), C('#8a7a7a'), 0.25, 0.2)
        fill(img, rect(tx + 3, 176, tx + 8, 214), lit(C('#8a7a7a'), 0.9, 0.2))
        for cx in range(tx - 8, tx + 8, 5):
            face(img, rect(cx, 171, cx + 3, 176), C('#8a7a7a'), 0.55, 0.2)
        fill(img, mask([cap((tx, 171), (tx, 160), 0.5)]), aerial(C('#2a2028'), 0.2))
        fill(img, mask([poly((tx, 160), (tx + 9, 163), (tx, 166))]), aerial(C('#c82a2a'), 0.3))
    haze_band(img, 218, 14, 0.45, '#f0a088', 32, 50)
    # far rooftops, a cathedral with a spire and a rose window
    for k in range(26):
        hx = -20 + k * 26 + rng.uniform(-6, 6)
        house(img, hx, 236, rng.uniform(16, 24), int(rng.integers(2, 4)), 0.26, 100 + k, fh=10, roof=rng.choice(['gable', 'hip']), lights=0.5, wq=0.45)
    cx = 330
    cat = rect(cx - 30, 120, cx + 30, 236)
    face(img, cat, C('#b0a090'), 0.25, 0.32)
    fill(img, cat & (XX > cx + 14), lit(C('#b0a090'), 0.7, 0.32))
    fill(img, cat & (XX > cx + 28), lit(C('#ffd0a0'), 1.1, 0.32))
    blocks(img, cat & (XX <= cx + 14) & ~mask([ell(cx, 146, 15, 15, 0, 24)]), C('#b0a090'), 0.32, 77, 8, 5, 0.22, 0.0, None)
    fill(img, mask([poly((cx - 34, 122), (cx, 92), (cx + 34, 122))]), lit(C('#4a4a5a'), 0.7, 0.32))
    sp = mask([poly((cx - 8, 92), (cx, 20), (cx + 8, 92))])
    face(img, sp, C('#4a4a5a'), 0.22, 0.32)
    fill(img, sp & (XX > cx), lit(C('#4a4a5a'), 0.95, 0.32))
    fill(img, mask([cap((cx, 20), (cx, 10), 0.6), cap((cx - 3, 14), (cx + 3, 14), 0.6)]), aerial(C('#e8c060'), 0.4))
    rose = mask([ell(cx, 146, 13, 13, 0, 24)])
    fill(img, rose, aerial(C('#3a2a4a'), 0.32))
    for j in range(8):
        a = j * math.pi / 4
        fill(img, rose & mask([cap((cx, 146), (cx + math.cos(a) * 12, 146 + math.sin(a) * 12), 1.6)]), aerial(C('#ffb050'), 0.4))
    fill(img, mask([ell(cx, 146, 3.5, 3.5, 0, 12)]), aerial(C('#ff6a4a'), 0.4))
    glow(img, cx, 146, 26, C('#ff9a40'), 0.3)
    for k in range(3):
        wx = cx - 22 + k * 18
        fill(img, rect(wx, 176, wx + 7, 214) & ~((YY < 180) & (np.abs(XX - wx - 3.5) > 2.5)), aerial(C('#ffb050'), 0.4))
    # the middle row of houses
    before = img.copy()
    for k in range(9):
        hx = -30 + k * 76 + rng.uniform(-8, 8)
        house(img, hx, 262, rng.uniform(34, 46), int(rng.integers(3, 5)), 0.5, 200 + k, fh=16, roof=rng.choice(['gable', 'hip']), lights=0.45, wq=0.32)
    backlit(img, before, 0.78)
    # a gap of evening haze between the rows
    a = (np.clip(1 - np.abs(YY - 250) / 30, 0, 1) * 0.35)
    a = np.floor(a * 6 + BAY * 0.9) / 6
    img[:] = img * (1 - a[..., None]) + P['haze'] * a[..., None]
    # the street: front houses with shops, the rooftop route, a side street opening in the middle
    street = 304
    xs = [(-14, 58, 4, True), (48, 62, 3, False), (114, 54, 4, True), (178, 66, 3, True), (380, 60, 4, False), (446, 58, 3, True),
          (508, 70, 4, True), (582, 64, 3, False)]
    tops = {}
    before_f = img.copy()
    for i, (hx, w, fl, shop) in enumerate(xs):
        tops[hx] = house(img, hx, street - 4, w, fl, 0.84, 300 + i, fh=24, roof='gable' if i % 3 else 'hip', shop=shop, lights=0.45, wq=0.22)
    backlit(img, before_f, 0.62)
    sun_band(img, 120, 250, '#ff9a50', 0.22)
    # the side street: an arch and a lantern, the far street receding
    fill(img, rect(250, 190, 372, 300), lit(C('#6a5060'), 0.3, 0.5))
    for (hx, w, fl, sd) in ((262, 26, 5, 7), (292, 30, 5, 8), (326, 34, 4, 9)):
        house(img, hx, 286, w, fl, 0.6, 400 + sd, fh=15, roof='gable', shop=sd == 8, lights=0.7, wq=0.28)
    arch = rect(254, 196, 370, 214) | rect(254, 196, 268, 300) | rect(356, 196, 370, 300)
    arch &= ~(mask([ell(312, 228, 44, 30, 0, 30)]) & (YY > 214))
    q = tone(_blur(arch.astype(np.float32), 3) * 6, (fbm(XX / 2, YY / 2, 2, 9) - 0.5) * 0.2, 4, 0.3)
    img[arch] = lit(C('#a89a88'), q, 0.7)[arch]
    fill(img, arch & ((np.abs((YY - 196) % 6) < 0.6) | (np.abs(((XX - 254 + 5 * ((YY - 196) // 6 % 2)) % 10)) < 0.6)), lit(C('#6a5e50'), 0.4, 0.7))
    cobbles(img, 284, 300, 0.6, 2, 268, 356)
    for (lx, ly) in ((262, 232), (362, 232)):
        fill(img, mask([cap((lx, ly - 8), (lx, ly), 0.6)]), lit(C('#2a2020'), 0.4, 0.75))
        fill(img, rect(lx - 2, ly, lx + 2, ly + 5), C('#ffd070'))
        glow(img, lx, ly + 2, 30, C('#ff9a40'), 0.5)
    # banners of the enemy kingdom
    for bx in (150, 470, 560):
        by = street - 4 - 24 * 2 + 2
        bn = mask([poly((bx, by), (bx + 12, by), (bx + 12, by + 24), (bx + 6, by + 20), (bx, by + 24))])
        q = tone(_blur(bn.astype(np.float32), 2) * 3 + np.sin(YY / 3) * 0.6, None, 4, 0.2)
        img[bn] = lit(C('#a01a22'), q, 0.86)[bn]
        emb = mask([poly((bx + 6, by + 5), (bx + 9, by + 9), (bx + 6, by + 14), (bx + 3, by + 9))])
        fill(img, emb, lit(C('#1a1418'), 0.4, 0.86))
        fill(img, mask([cap((bx - 2, by), (bx + 14, by), 0.7)]), lit(C('#c8a040'), 0.8, 0.86))
    cobbles(img, street - 4, H, 0.9, 7)
    for (px, pk) in ((40, 0.5), (150, 0.5), (220, 0.4), (470, 0.5), (540, 0.5), (50, 0.6)):
        dd = np.hypot((XX - px) / 2.2, (YY - street - 6))
        a = np.clip(1 - dd / 24, 0, 1) * pk * (YY > street - 4)
        a = np.floor(a * 4 + BAY * 0.9) / 4
        img[:] = img + C('#ff9a40')[None, None] * (a * 0.35)[..., None]
    shade = np.clip((YY - 320) / 40, 0, 1) * 0.45
    img[:] = img * (1 - shade[..., None])
    pud = mask([spoly((250, 334), (290, 328), (360, 330), (400, 338), (350, 346), (270, 344), n=4)])
    pud &= fbm(XX / 6, YY / 3, 2, 12) > 0.3
    src = np.clip(2 * 300 - YY - 60, 0, H - 1).astype(int)
    refl = img[src, XX.astype(int)] * 0.7
    img[pud] = refl[pud]
    fill(img, pud & (np.sin(XX / 3 + YY * 2) > 0.85), C('#ffc890'), 0.4)
    # props on the street: barrels, crates, a market stall with fruit
    for (bx, by) in ((96, street), (104, street - 1), (470, street)):
        b_ = mask([ell(bx, by - 6, 4.5, 6.5, 0, 16)])
        paint(img, b_, cylinder(b_, 4), C('#8a5a32'), 0.9, np.where(np.abs(np.abs(YY - (by - 6)) - 3.5) < 0.6, -0.4, 0), 4, 0.2)
    for (bx, by) in ((520, street), (530, street - 9)):
        cr = rect(bx, by - 9, bx + 10, by)
        face(img, cr, C('#a07848'), 0.7, 0.9)
        fill(img, cr & ((np.abs(XX - bx - 5) < 0.5) | (np.abs(YY - by + 4.5) < 0.5) | (XX > bx + 8)), lit(C('#6a4a2a'), 0.5, 0.9))
    # light from the low sun streaming down the side street through the arch onto the cobbles
    keep = img.copy()
    light_shafts(img, [(312 - 290 * 0.25, 30, 1.0)], '#ffc890', 0.25, 0.22, 214, 360)
    lim = mask([poly((268, 214), (356, 214), (420, 360), (240, 360))])
    img[~lim] = keep[~lim]
    for (pg_x, pg_y) in ((160, 186), (168, 187), (430, 178)):                                     # pigeons on a ridge
        fill(img, mask([ell(pg_x, pg_y, 2.2, 1.4, 0, 8)]), C('#3a3038'))
        img[pg_y - 1, pg_x + 2] = C('#3a3038')
    bunting(img, 250, 226, 372, 226, 10, 0.6, 5, glow_k=0.25)                                  # flags across the side street
    for (lx_, c_) in ((276, '#e8e0d0'), (290, '#8a3a3a'), (304, '#5a7a9a'), (330, '#e8e0d0'), (346, '#c8a040')):   # laundry
        fill(img, rect(lx_, 247, lx_ + 8, 258), aerial(C(c_) * 0.8, 0.6))
    fill(img, mask([cap((262, 246), (362, 246), 0.5)]), aerial(C('#2a2020'), 0.6))
    hay_cart(img, 520, street + 6, 1.1, 0.88, 61)
    lamp_post(img, 236, street + 8, 40, 0.9)
    lamp_post(img, 470, street + 8, 40, 0.9)
    feet_shadows(img, [(176, street + 6, 12), (290, street + 4, 16), (362, street + 4, 10), (422, street + 4, 10), (600, street + 6, 18)], 0.5)
    # characters: soldiers with shields on the street, a crossbowman on the roofs, the hero, a cannon on the wall
    key = {'dir': (0.8, -0.3, 0.5), 'col': (1.1, 0.78, 0.55)}
    amb = (0.36, 0.34, 0.55)
    grade_actor(img, humanoid_enemy('crossbow', 545, int(tops[508]) + 4, -1, 40), key, amb, '#ffc890', 0.85)
    grade_actor(img, cannon(600, street + 4, -1), key, amb, '#ffc890', 0.9)
    grade_actor(img, humanoid_enemy('soldier', 360, street + 2, -1, 40), key, amb, '#ffc890', 0.9)
    grade_actor(img, humanoid_enemy('soldier', 420, street + 2, -1, 40), key, amb, '#ffc890', 0.9)
    grade_actor(img, quadruped('wolf', 290, street + 2, -1, 1.2), key, amb, '#ffc890', 0.9, flash='#ff8a2a')
    grade_actor(img, hero(170, street - 20, 1), key, amb, '#ffd8a0', 1.0)
    # near the camera: a hanging shop sign and a lantern bracket at the top, laundry on a line, a barrel corner
    fill(img, mask([cap((640, 40), (590, 40), 1.6), cap((640, 52), (600, 40), 1)]), C('#1e1614'))
    sg = mask([poly((598, 44), (626, 44), (626, 66), (598, 66))])
    face(img, sg, C('#7a5032'), 0.7, 1.0)
    fill(img, mask([ell(612, 55, 6, 6, 0, 12)]), lit(C('#d8a840'), 0.9, 1.0))
    fill(img, sg & ~_dilate(~sg, 1) & ~sg | (sg & ~np.roll(sg, 1, 1)), C('#2a1a12'))
    corner = rect(-10, -10, 34, H)
    fill(img, corner, C('#2a1e22'))
    for yy_ in range(-10, H, 40):
        fill(img, corner & (np.abs(YY - yy_) < 2), C('#160e10'))
        fill(img, corner & (np.abs((XX + 10) - (YY - yy_) * 1.1) < 1.5) & (YY > yy_) & (YY < yy_ + 40), C('#160e10'))
    fill(img, corner & (XX > 31), C('#6a3a2a'))
    fill(img, mask([cap((34, 150), (52, 150), 1.2), cap((50, 150), (50, 158), 0.5)]), C('#160e10'))
    fill(img, rect(47, 158, 54, 168), C('#ffd070'))
    fill(img, rect(46, 157, 55, 158) | rect(46, 168, 55, 169), C('#160e10'))
    glow(img, 50, 163, 60, C('#ff9a40'), 0.45)
    near = mask([ell(-6, 370, 40, 46, 0, 24)])
    paint(img, near, cylinder(near, 16), C('#5a3a22'), 1.0, np.where(np.abs(np.abs(YY - 340) - 10) < 1.2, -0.5, 0), 4, 0.0, 0.7, 0.6)
    bunting(img, 30, 70, 660, 96, 50, 1.0, 9, glow_k=-0.25, size=2.2)                                      # flags right in front of the camera
    nb = mask([ell(606, 356, 44, 30, 0, 30), ell(556, 370, 26, 24, 0, 24)])                        # dark barrel and sacks close to the lens
    fill(img, nb, C('#140c0a'))
    fill(img, nb & ~np.roll(nb, 2, 0), C('#5a3424'))
    fill(img, mask([ell(606, 356, 44, 30, 0, 30)]) & (np.abs(np.abs(XX - 606) - 26) < 2), C('#0a0606'))
    motes(img, 80, (0, 150, 640, 300), C('#ffd8a0'), 6, 0.6)
    grade(img, 1.18, 1.1)
    bloom(img, 0.75)
    vignette(img, 0.25)
    hud(img)
    return img


# ============================================================================================== King's Castle

def gothic(cx, top, a, bottom):
    """A pointed (gothic) arch opening: half-width a, apex at y=top, down to bottom."""
    ys = top + math.sqrt(3) * a
    c1 = (XX - (cx - a)) ** 2 + (YY - ys) ** 2 < (2 * a) ** 2
    c2 = (XX - (cx + a)) ** 2 + (YY - ys) ** 2 < (2 * a) ** 2
    return ((c1 & c2 & (YY < ys)) | ((np.abs(XX - cx) < a) & (YY >= ys) & (YY < bottom))) & (YY >= top)


def blocks(img, m, alb, d, seed, bw=12, bh=6, q0=0.35, qk=0.5, light=None):
    """Cut stone masonry: staggered blocks, each a little different in tone, mortar lines, chipped edges."""
    if not m.any():
        return
    row = np.floor(YY / bh)
    col = np.floor((XX + (row % 2) * bw / 2) / bw)
    rnd = (np.sin(row * 12.9898 + col * 78.233 + seed) * 43758.5453) % 1
    q = q0 + (rnd - 0.5) * 0.18 + (fbm(XX / 3, YY / 3, 2, seed) - 0.5) * 0.12
    if light is not None:
        q = q + light * qk
    q = np.floor(np.clip(q, 0, 1.2) * 6 + BAY * 0.9) / 6
    c = lit(alb, q, d)
    img[m] = c[m]
    mort = m & ((np.abs(YY - row * bh) < 0.6) | (np.abs((XX + (row % 2) * bw / 2) - col * bw) < 0.6))
    fill(img, mort, lit(alb * 0.45, q0 * 0.5, d))
    top = m & (np.abs(YY - row * bh - 1) < 0.6) & ~mort
    fill(img, top, lit(alb * 1.15, q0 + 0.1, d), 0.5)


def stained(img, cx, top, a, bottom, d, seed):
    """A tall stained-glass window: stone tracery, coloured panes glowing with daylight, lead lines."""
    rng = np.random.default_rng(seed)
    win = gothic(cx, top, a, bottom)
    frame = _dilate(win, 2) & ~win
    fill(img, frame, lit(C('#6a5a58'), 0.5, d))
    pal = [C('#2a4aa8')] * 5 + [C('#3a6ad0')] * 3 + [C('#a82a3a')] * 2 + [C('#d8a040'), C('#3a8a5a')]
    pw, ph = 5, 7
    cell = (np.floor((XX - cx) / pw) * 7 + np.floor((YY + np.floor((XX - cx) / pw) * 3) / ph) * 13).astype(int)
    idx = (np.abs(cell) * 2654435761 + seed) % len(pal)
    glass = np.zeros((H, W, 3), np.float32)
    for i, c in enumerate(pal):
        glass[idx == i] = c
    band = np.abs(XX - cx) < a * 0.35                                    # a red-and-gold central figure band
    glass[band & (idx % 3 == 0)] = C('#c83a3a')
    glass[band & (idx % 3 == 1)] = C('#e8b848')
    bright = 0.6 + 0.3 * np.clip(1 - (YY - top) / max(1, bottom - top), 0, 1)
    glass = glass * bright[..., None] + 0.08
    img[win] = glass[win]
    lead = win & ((np.abs(((XX - cx) % pw)) < 0.6) | (np.abs(((YY + np.floor((XX - cx) / pw) * 3) % ph)) < 0.6))
    fill(img, lead, C('#140e14'), 0.85)
    tr = win & ((np.abs(XX - cx) < 1) | (np.abs(YY - (top + (bottom - top) * 0.55)) < 1))
    fill(img, tr, lit(C('#8a7a70'), 0.6, d))
    rcx, rcy, rr = cx, top + a * 1.9, a * 0.62
    rose = mask([ell(rcx, rcy, rr, rr, 0, 20)])
    fill(img, rose, C('#1a1218'))
    for k in range(8):
        an = k * math.pi / 4
        pet = mask([ell(rcx + math.cos(an) * rr * 0.55, rcy + math.sin(an) * rr * 0.55, rr * 0.38, rr * 0.2, math.degrees(an), 12)])
        fill(img, pet, C('#c83a4a') if k % 2 else C('#3a6ad0'))
    fill(img, mask([ell(rcx, rcy, rr * 0.25, rr * 0.25, 0, 12)]), C('#f0c050'))
    glow(img, cx, (top + bottom) / 2, a * 4, C('#a8c8ff'), 0.25)
    return win


def pillar(img, x, top, base, w, d, seed, torch=None):
    """A round stone column: a base, a capital, a shaft shaded round, lit by daylight from the windows and a torch."""
    sh = rect(x - w, top + 8, x + w, base - 6)
    u = np.clip((XX - x) / w, -1, 1)
    lightk = np.sqrt(np.clip(1 - u * u, 0, 1)) * (0.55 - 0.3 * u) - 0.05
    if torch is not None:
        tx, ty = torch
        dd = np.hypot(XX - tx, YY - ty)
        lightk = lightk + np.clip(1 - dd / 90, 0, 1) * np.clip(u * np.sign(tx - x) + 0.3, 0, 1) * 0.9
    flute = np.where(np.abs(np.sin(u * 6)) < 0.25, -0.12, 0)
    blocks(img, sh, C('#a89488'), d, seed, bw=400, bh=11, q0=0.12, qk=1.0, light=lightk + flute)
    for (yy_, hh, ww) in ((top, 8, w + 4), (base - 6, 6, w + 5)):
        cp = rect(x - ww, yy_, x + ww, yy_ + hh)
        blocks(img, cp, C('#b8a498'), d, seed + 1, bw=400, bh=3, q0=0.2, qk=0.9, light=lightk)
    if torch is not None:
        tx, ty = torch
        fill(img, mask([cap((x + np.sign(tx - x) * w, ty + 6), (tx, ty + 2), 0.8)]), lit(C('#2a2020'), 0.3, d))
        fill(img, mask([poly((tx - 2, ty), (tx + 2, ty), (tx + 1, ty + 5), (tx - 1, ty + 5))]), lit(C('#4a3a2a'), 0.5, d))
        fl = mask([spoly((tx - 2.5, ty), (tx, ty - 8), (tx + 2.5, ty), n=2)])
        fill(img, fl, C('#ffb040'))
        fill(img, mask([spoly((tx - 1.2, ty), (tx, ty - 4.5), (tx + 1.2, ty), n=2)]), C('#fff0b0'))
        glow(img, tx, ty - 3, 70, C('#ff8a30'), 0.55)


def gargoyle(x, y, s=1.0, face=1):
    def T(p):
        return (x + face * p[0] * s, y + p[1] * s)

    def tp(sh):
        return ('poly', tuple(T(p) for p in sh[1]))
    st, dk = '#7a7478', '#5a5458'
    P = [(dk, tp(spoly((-4, -14), (-16, -26), (-20, -12), (-14, -4), (-6, -6), n=3))),               # folded wing
         (st, tp(ell(-2, -8, 9, 7, -10, 18))),                                                       # body
         (dk, tp(cap((-8, -4), (-10, 0), 2.4))), (dk, tp(cap((4, -4), (6, 0), 2.4))),                # legs
         (st, tp(cap((5, -10), (9, -2), 2))),                                                        # arm
         (st, tp(ell(7, -16, 5, 4.4, 0, 14))),                                                       # head
         (dk, tp(poly((4, -19), (1, -26), (6, -20)))), (dk, tp(poly((8, -20), (10, -27), (10, -19)))),  # horns
         (st, tp(poly((10, -16), (15, -14), (11, -12)))),                                            # snout
         ('#ff5040', tp(ell(9, -17, 1, 0.8, 0, 8))), (dk, tp(taper([(-10, -6), (-16, 0), (-12, 4)], 1.6, 0.6)))]
    return P


def castle():
    setup(sun=(320, -40), sun_col='#c8d8ff', amb='#4a3048', haze='#2a1a2a', light=(-0.3, -0.6, 0.6), haze_k=0.6)
    img = np.zeros((H, W, 3), np.float32) + C('#1a1018')
    rng = np.random.default_rng(9)
    floor_y = 300
    # the back wall in shadow, tall stained-glass windows, banners between them
    back = rect(0, 0, W, floor_y)
    wl = np.clip(1 - np.abs(XX - 320) / 420, 0, 1) * 0.15
    blocks(img, back, C('#6a5a62'), 0.3, 1, 14, 7, 0.16, 1.0, wl)
    wins = []
    for wx in (96, 232, 408, 544):
        wins.append(stained(img, wx, 34, 20, 210, 0.3, wx))
        fill(img, rect(wx - 26, 210, wx + 26, 216), lit(C('#7a6a68'), 0.5, 0.3))
    for bx in (164, 476):
        bn = mask([poly((bx - 14, 40), (bx + 14, 40), (bx + 14, 190), (bx, 176), (bx - 14, 190))])
        q = tone(_blur(bn.astype(np.float32), 3) * 4 + np.sin(XX / 2.5) * 0.4, None, 4, 0.1) * 0.6
        img[bn] = lit(C('#a01a28'), q, 0.35)[bn]
        fill(img, bn & (np.abs(np.abs(XX - bx) - 12) < 1), lit(C('#e8b040'), 0.6, 0.35))
        crown = mask([poly((bx - 8, 90), (bx - 8, 80), (bx - 4, 85), (bx, 76), (bx + 4, 85), (bx + 8, 80), (bx + 8, 90))])
        fill(img, crown, lit(C('#e8c050'), 0.8, 0.35))
        fill(img, mask([cap((bx - 18, 40), (bx + 18, 40), 1.2)]), lit(C('#c8a040'), 0.7, 0.35))
    # wear on the old wall: cracks, damp stains, moss low down
    back = back & ~_dilate(wins[0] | wins[1] | wins[2] | wins[3], 2)
    crack = back & (np.abs(fbm(XX / 8, YY / 4, 3, 71) - 0.5) < 0.01)
    fill(img, crack, lit(C('#1a1018'), 0.2, 0.3))
    stain = back & (fbm(XX / 12, YY / 30, 3, 72) > 0.66) & (YY > 120)
    fill(img, stain, C('#000000'), 0.18)
    moss_w = back & (YY > floor_y - 30) & (fbm(XX / 4, YY / 3, 3, 73) > 0.62)
    fill(img, moss_w, lit(C('#3a4a2a'), 0.4, 0.3), 0.7)
    # shields with crossed swords between the windows
    for (sx_, sy_) in ((164, 236), (476, 236)):
        for sgn in (-1, 1):
            fill(img, mask([cap((sx_ - 16 * sgn, sy_ - 14), (sx_ + 16 * sgn, sy_ + 16), 1.0)]), lit(C('#c8d0e0'), 0.7, 0.35))
            fill(img, mask([cap((sx_ - 16 * sgn, sy_ - 14), (sx_ - 12 * sgn, sy_ - 10), 1.6)]), lit(C('#c8a040'), 0.7, 0.35))
        sh_ = mask([spoly((sx_ - 9, sy_ - 9), (sx_ + 9, sy_ - 9), (sx_ + 9, sy_ + 3), (sx_, sy_ + 12), (sx_ - 9, sy_ + 3), n=2)])
        fill(img, sh_, lit(C('#7a1420'), 0.6, 0.35))
        fill(img, sh_ & (np.abs(XX - sx_) < 1.5), lit(C('#e0b040'), 0.8, 0.35))
        fill(img, sh_ & (np.abs(YY - sy_ + 2) < 1.2), lit(C('#e0b040'), 0.8, 0.35))
        fill(img, sh_ & ~_dilate(~sh_, 1), lit(C('#e0b040'), 0.6, 0.35))
    # cobwebs in the upper corners of the window bays
    for (wx_, wy_, sg) in ((70, 216, 1), (570, 216, -1), (258, 60, -1)):
        for k in range(5):
            a = math.radians(-90 + k * 22) if sg > 0 else math.radians(-90 - k * 22)
            fill(img, mask([cap((wx_, wy_ - 40), (wx_ + math.cos(a + math.pi / 2) * 18 * sg, wy_ - 40 + math.sin(a + math.pi / 2) * 18), 0.4)]),
                 C('#c8c0c8'), 0.25)
        for r_ in (6, 11, 16):
            arc = (np.abs(np.hypot(XX - wx_, YY - (wy_ - 40)) - r_) < 0.5) & ((XX - wx_) * sg > 0) & (YY > wy_ - 40)
            fill(img, arc, C('#c8c0c8'), 0.2)
    # the throne on its dais at the far end, under a great canopy, with candles
    cx = 320
    fill(img, mask([poly((cx - 34, 40), (cx + 34, 40), (cx + 40, 60), (cx - 40, 60))]), lit(C('#801820'), 0.5, 0.35))
    cur = mask([poly((cx - 34, 58), (cx - 26, 58), (cx - 30, 230), (cx - 42, 230))]) | mask([poly((cx + 26, 58), (cx + 34, 58), (cx + 42, 230), (cx + 30, 230))])
    q = tone(np.sin(XX / 1.8) * 1.2, None, 4, 0.1) * 0.5
    img[cur] = lit(C('#901a26'), q, 0.35)[cur]
    for k in range(4):
        st_ = rect(cx - 70 + k * 8, floor_y - 40 + k * 10 - 30, cx + 70 - k * 8, floor_y - 30 + k * 10 - 30)
        blocks(img, st_, C('#8a7a78'), 0.38, 5 + k, 400, 10, 0.3, 0.5, None)
        fill(img, st_ & (np.abs(YY - (floor_y - 40 + k * 10 - 30)) < 1), lit(C('#b0a098'), 0.6, 0.38))
    carpet = mask([poly((cx - 16, 230), (cx + 16, 230), (cx + 20, floor_y - 30), (cx - 20, floor_y - 30))])
    fill(img, carpet, lit(C('#a01a28'), 0.5, 0.4))
    fill(img, carpet & (np.abs(np.abs(XX - cx) - 14 - (YY - 230) * 0.1) < 1), lit(C('#e0b040'), 0.7, 0.4))
    th = mask([poly((cx - 16, 230), (cx - 16, 150), (cx - 10, 136), (cx - 6, 146), (cx, 126), (cx + 6, 146), (cx + 10, 136), (cx + 16, 150), (cx + 16, 230))])
    paint(img, th, cylinder(th, 6), C('#d8a840'), 0.4, None, 5, 0.2)
    fill(img, mask([poly((cx - 10, 150), (cx + 10, 150), (cx + 10, 206), (cx - 10, 206))]), lit(C('#6a1018'), 0.6, 0.4))
    fill(img, mask([ell(cx, 128, 2.4, 2.4, 0, 10)]), C('#ff5050'))
    glow(img, cx, 180, 70, C('#ffb050'), 0.25)
    for (kx, ky) in ((cx - 54, 196), (cx + 54, 196)):
        fill(img, rect(kx - 2, ky, kx + 2, ky + 36), lit(C('#c8a040'), 0.6, 0.4))
        for j in (-6, 0, 6):
            fill(img, rect(kx + j - 1, ky - 8, kx + j + 1, ky), C('#efe6d0'))
            img[ky - 10:ky - 8, kx + j] = C('#ffd070')
        fill(img, rect(kx - 8, ky, kx + 8, ky + 2), lit(C('#c8a040'), 0.7, 0.4))
        glow(img, kx, ky - 10, 26, C('#ff9a40'), 0.5)
    # light shafts from the windows falling across the hall to the floor
    keep = img.copy()
    acc = np.zeros((H, W), np.float32)
    for wx in (96, 232, 408, 544):
        xb = wx + (YY - 120) * 0.45
        acc += np.clip(1 - np.abs(XX - xb) / (20 + (YY - 34) * 0.06), 0, 1) * (YY > 40)
    acc = np.clip(acc, 0, 1)
    q = np.floor(acc * 4 + BAY * 0.9) / 4
    img[:] = keep + C('#b8c8ff')[None, None] * (q * 0.2)[..., None]
    # the middle colonnade: columns with pointed arches between them, a gargoyle on a ledge, chandeliers
    for (px, seed_) in ((30, 21), (200, 22), (440, 23), (610, 24)):
        pillar(img, px, 20, floor_y, 13, 0.55, seed_, torch=(px + 22, 150) if px < 320 else (px - 22, 150))
    arch_m = rect(0, 0, W, 34)
    for (a0, a1) in ((30, 200), (440, 610)):
        arch_m |= rect(a0, 0, a1, 70) & ~gothic((a0 + a1) / 2, 30, (a1 - a0) / 2 - 13, 200)
    arch_m &= YY < 70
    blocks(img, arch_m, C('#9a8a82'), 0.55, 31, 12, 6, 0.3, 0.5, None)
    for (a0, a1) in ((30, 200), (440, 610)):
        g = gothic((a0 + a1) / 2, 30, (a1 - a0) / 2 - 13, 200)
        edge = g & ~np.roll(g, 2, 0) & (YY < 70)
        fill(img, _dilate(edge, 2) & arch_m, lit(C('#c8b4a8'), 0.7, 0.55))
    for (chx, chy) in ((115, 100), (525, 100)):
        fill(img, mask([cap((chx, 0), (chx, chy - 6), 0.6)]), lit(C('#3a3030'), 0.3, 0.6))
        ring = mask([ell(chx, chy, 22, 4, 0, 30)]) & ~mask([ell(chx, chy, 19, 2.4, 0, 30)])
        fill(img, ring, lit(C('#c8a040'), 0.6, 0.6))
        for j in range(9):
            a = j / 9 * 2 * math.pi
            px_, py_ = chx + math.cos(a) * 21, chy + math.sin(a) * 3.6
            fill(img, rect(px_ - 0.5, py_ - 5, px_ + 1, py_), C('#efe6d0'))
            img[int(py_ - 7):int(py_ - 5), int(px_)] = C('#ffd070')
        glow(img, chx, chy - 6, 60, C('#ff9a40'), 0.45)
    # the floor: polished stone slabs that mirror the windows and lights; a pit of spikes; a swinging blade
    fl = rect(0, floor_y, W, H)
    src = np.clip(2 * floor_y - YY, 0, H - 1).astype(int)
    refl = img[src, XX.astype(int)]
    blocks(img, fl, C('#5a4a52'), 0.85, 41, 32, 12, 0.22, 0.5, None)
    k_ = np.clip(0.5 - (YY - floor_y) / 140, 0, 0.5)[..., None]
    img[fl] = (img * (1 - k_) + refl * k_)[fl]
    lip = rect(0, floor_y, W, floor_y + 3)
    fill(img, lip, lit(C('#a8988e'), 0.7, 0.85))
    run = rect(0, floor_y + 4, W, floor_y + 14)                          # a long red runner on the floor
    fill(img, run, lit(C('#7a1420'), 0.5, 0.85))
    fill(img, run & ((np.abs(YY - floor_y - 5) < 0.6) | (np.abs(YY - floor_y - 13) < 0.6)), lit(C('#e0b040'), 0.6, 0.85))
    fill(img, run & (np.sin(XX / 2.2) > 0.8) & (np.abs(YY - floor_y - 9) < 1.5), lit(C('#a0303a'), 0.7, 0.85))
    for (bx_, by_) in ((362, floor_y - 2), (446, floor_y - 1)):            # bones by the spikes
        fill(img, mask([ell(bx_, by_ - 2, 3, 2.6, 0, 12)]), lit(C('#e8e0c8'), 0.7, 0.9))
        img[by_ - 3, bx_ - 1] = img[by_ - 3, bx_ + 1] = C('#1a1014')
        fill(img, mask([cap((bx_ + 4, by_), (bx_ + 12, by_ - 1), 0.8)]), lit(C('#e8e0c8'), 0.6, 0.9))
    for k in range(16):                                                 # the spike pit
        sx = 372 + k * 4
        fill(img, mask([poly((sx, floor_y + 1), (sx + 2, floor_y - 9 - (k % 3)), (sx + 4, floor_y + 1))]), lit(C('#b8c0d0'), 0.8, 0.9))
        img[floor_y - 9 - (k % 3), sx + 2] = C('#ffffff')
    fill(img, rect(370, floor_y, 438, floor_y + 6), C('#140c10'))
    px_, py_ = 300, 0                                                   # the pendulum blade, mid-swing
    ang = math.radians(24)
    bx, by = px_ + math.sin(ang) * 150, py_ + math.cos(ang) * 150
    fill(img, mask([cap((px_, py_), (bx, by), 1.2)]), lit(C('#4a4040'), 0.5, 0.8))
    blade = mask([spoly((bx - 30 * math.cos(ang), by + 30 * math.sin(ang) - 4), (bx + 6 * math.sin(ang), by + 20 * math.cos(ang)),
                        (bx + 30 * math.cos(ang), by - 30 * math.sin(ang) - 4), (bx, by + 4), n=4)])
    paint(img, blade, cylinder(blade, 4), C('#c8d0e0'), 0.85, None, 5, 0.3)
    for j in range(1, 5):                                               # motion trail
        a2 = ang + math.radians(5 * j)
        tb = mask([cap((px_ + math.sin(a2) * 150 - 18, py_ + math.cos(a2) * 150), (px_ + math.sin(a2) * 150 + 18, py_ + math.cos(a2) * 150 - 6), 2)])
        fill(img, tb & ~blade, C('#c8d0e0'), 0.25 / j)
    # torch light pooling on the floor, cold mist creeping along it, dust drifting in the window light
    for (tx_, ty_) in ((52, floor_y + 6), (222, floor_y + 6), (418, floor_y + 6), (588, floor_y + 6)):
        dd = np.hypot((XX - tx_) / 2.6, YY - ty_)
        a = np.floor(np.clip(1 - dd / 22, 0, 1) * 4 + BAY * 0.9) / 4 * 0.35 * (YY > floor_y)
        img[:] = img + C('#ff9a40') * a[..., None]
    for wx in (96, 232, 408, 544):                                        # stained-glass colours spilling onto the floor
        strip = img[60:200, wx - 18:wx + 18].mean(axis=0)
        for xx in range(36):
            c = strip[xx] / max(1e-3, strip[xx].max())
            for yy in range(floor_y + 2, floor_y + 24):
                x_ = wx - 18 + xx + int((yy - floor_y) * 1.6) + 20
                if 0 <= x_ < W and (BAY[yy, x_] < 0.55):
                    img[yy, x_] = img[yy, x_] + c * 0.28
    haze_band(img, floor_y - 4, 16, 0.4, '#8a7a98', 33, 40)
    haze_band(img, 212, 30, 0.18, '#6a5a78', 34, 70)
    rng5 = np.random.default_rng(35)
    for _ in range(200):
        x_, y_ = int(rng5.uniform(0, W)), int(rng5.uniform(40, floor_y))
        if acc[y_, x_] > 0.3:
            img[y_, x_] = mix(img[y_, x_], C('#e8eeff'), 0.8)
    for (bx_, by_) in ((330, floor_y + 20), (520, floor_y + 22), (120, floor_y + 18)):           # cracked tiles, rubble
        cr_ = (np.abs(fbm(XX / 6, YY / 3, 3, bx_) - 0.5) < 0.02) & (np.hypot(XX - bx_, (YY - by_) * 2) < 26) & (YY > floor_y + 3)
        fill(img, cr_, C('#0e080c'))
        for j in range(5):
            rx_, ry_ = bx_ + rng5.uniform(-14, 14), by_ + rng5.uniform(-3, 3)
            fill(img, mask([ell(rx_, ry_, rng5.uniform(1, 2.4), rng5.uniform(0.8, 1.6), 0, 8)]), lit(C('#8a7a7a'), 0.5, 0.9))
    for (cx_, cy_) in ((100, floor_y), (540, floor_y)):                                          # tall floor candelabras, dripping wax
        fill(img, rect(cx_ - 1, cy_ - 46, cx_ + 1, cy_), lit(C('#c8a040'), 0.6, 0.8))
        fill(img, mask([poly((cx_ - 6, cy_), (cx_ + 6, cy_), (cx_ + 2, cy_ - 4), (cx_ - 2, cy_ - 4))]), lit(C('#c8a040'), 0.6, 0.8))
        fill(img, mask([cap((cx_ - 9, cy_ - 46), (cx_ + 9, cy_ - 46), 1.0)]), lit(C('#c8a040'), 0.7, 0.8))
        for j in (-8, 0, 8):
            fill(img, rect(cx_ + j - 1, cy_ - 56 + (j == 0) * -3, cx_ + j + 2, cy_ - 46), C('#efe6d0'))
            img[cy_ - 50 + (j == 0) * -3, cx_ + j + 1] = C('#d8cbb0')
            img[cy_ - 59 + (j == 0) * -3:cy_ - 56 + (j == 0) * -3, cx_ + j] = C('#ffd070')
            glow(img, cx_ + j, cy_ - 58, 16, C('#ff9a40'), 0.45)
    feet_shadows(img, [(150, floor_y + 2, 12), (488, floor_y + 2, 12), (572, floor_y + 2, 12)], 0.5)
    # characters: royal guards with halberds, the gargoyle waking up, the hero
    key = {'dir': (-0.3, -0.6, 0.6), 'col': (0.8, 0.85, 1.05)}
    amb = (0.42, 0.3, 0.4)
    pts = [(222, 150, 80, (1.2, 0.6, 0.25), 1.0), (418, 150, 80, (1.2, 0.6, 0.25), 1.0)]
    led = mask([poly((418, 112), (462, 112), (456, 120), (424, 120))])
    blocks(img, led, C('#a89488'), 0.6, 61, 400, 4, 0.3, 0.5, None)
    grade_actor(img, gargoyle(442, 112, 1.3, -1), key, amb, '#d8e0ff', 0.65, pts=pts)
    grade_actor(img, humanoid_enemy('guard', 488, floor_y, -1, 42), key, amb, '#ffd890', 0.85, pts=pts)
    grade_actor(img, humanoid_enemy('guard', 572, floor_y, -1, 42), key, amb, '#ffd890', 0.85, pts=pts)
    grade_actor(img, hero(150, floor_y - 24, 1), key, amb, '#ffe0a8', 1.0, pts=pts)
    # near the camera: a great column on the left, a heavy red curtain and a hanging chain on the right
    near = rect(-10, -10, 26, H)
    blocks(img, near, C('#4a3e44'), 1.0, 51, 37, 14, 0.15, 0.6, np.clip((XX - 10) / 16, 0, 1) * 0.4)
    cur = mask([spoly((600, -10), (660, -10), (660, 260), (640, 230), (622, 120), (606, 30), n=4)])
    q = tone(np.sin(XX / 2.2 + YY / 30) * 1.4, None, 4, 0.05) * 0.55
    img[cur] = lit(C('#7a1420'), q, 1.0)[cur]
    fill(img, cur & ~np.roll(cur, -2, 1), lit(C('#e0b040'), 0.6, 1.0))
    tie = mask([ell(632, 150, 10, 3, -20, 16)])
    fill(img, tie & cur, lit(C('#d8a840'), 0.8, 1.0))
    for j in range(14):
        cy_ = j * 9
        fill(img, mask([ell(586, cy_, 2, 3.4, 0, 10)]) & ~mask([ell(586, cy_, 0.8, 1.8, 0, 8)]), lit(C('#5a5050'), 0.6, 1.0))
    vault = rect(-10, -10, 660, 14) | (mask([ell(320, 14, 340, 40, 0, 60)]) == False) & (YY < 40)   # a dark vault rib framing the top
    vault &= YY < 40
    fill(img, vault, C('#120a10'))
    fill(img, vault & ~np.roll(vault, -1, 0) & (YY > 10), C('#4a3442'))
    for (cwx, cwy, sg) in ((40, 30, 1), (600, 30, -1)):                                            # cobwebs in the corners of the vault
        for k in range(6):
            a = math.radians(k * 18)
            fill(img, mask([cap((cwx - sg * 20, cwy - 20), (cwx - sg * 20 + sg * math.cos(a) * 40, cwy - 20 + math.sin(a) * 40), 0.35)]), C('#c8c0d0'), 0.35)
        for r_ in (10, 20, 30):
            arc_ = (np.abs(np.hypot(XX - cwx + sg * 20, YY - cwy + 20) - r_) < 0.5) & ((XX - cwx + sg * 20) * sg > 0) & (YY > cwy - 20)
            fill(img, arc_, C('#c8c0d0'), 0.3)
    rail = rect(-10, 326, 660, 332)                                     # a dark stone balustrade right in front of the camera
    for k in range(-1, 32):
        bx = k * 22 + 6
        rail |= mask([spoly((bx - 4, 362), (bx - 3, 350), (bx - 6, 342), (bx - 2, 334), (bx + 2, 334), (bx + 6, 342), (bx + 3, 350), (bx + 4, 362), n=3)])
    u = (XX % 22 - 6) / 6
    qk = np.clip(0.25 - 0.2 * u, 0, 0.6) * 0.5
    fill(img, rail, C('#140c12'))
    fill(img, rail & ~np.roll(rail, 1, 0), C('#5a4048'))
    fill(img, rail & (np.abs(XX % 22 - 4) < 1.2) & (YY > 334), C('#3a2830'))
    motes(img, 120, (60, 40, 600, 300), C('#d8e0ff'), 7, 0.5)
    grade(img, 1.2, 1.1, 0.35)
    bloom(img, 0.7, 6, 0.6)
    vignette(img, 0.35)
    hud(img)
    return img


# ============================================================================================== round 4 (the user's stage references)

CLOUD_RAMP = ['#4a5aa8', '#6a7cc4', '#90a2d8', '#b8c6ea', '#dce4f6', '#f2f6fe', '#ffffff', '#ffffff']


def cumulus(img, cx, base, w, h, seed, d=0.1, ramp=None, flat=True, lean=0.0):
    """A towering cumulus cloud: many round puffs piled wide at the bottom and narrower at the top, each puff lit as
    its own dome (white where the sun hits, lavender-blue in its shade), a flat shadowed base, a bright silver edge."""
    rng = np.random.default_rng(seed)
    ramp = np.array([C(c) for c in (ramp or CLOUD_RAMP)], np.float32)
    puffs = []
    n = int(w * h / 140) + 18
    for _ in range(n):
        t = rng.uniform(0, 1) ** 0.75
        half = w / 2 * (1 - 0.62 * t ** 1.2) * (1 + 0.12 * math.sin(t * 9 + seed))
        x = cx + lean * t * h + rng.uniform(-half, half)
        y = base - t * h
        r = w * rng.uniform(0.07, 0.17) * (1 - 0.3 * t)
        puffs.append((x, y, r * rng.uniform(1.0, 1.25), r, r * 0.6 + (1 - abs(x - cx) / (w / 2 + 1)) * h * 0.15 + rng.uniform(0, r)))
    m, hf = domes(puffs, 0.15, seed)
    if flat:
        m &= YY < base + 2 + 2 * fbm(XX / 9, YY * 0, 2, seed)
    nx, ny = _blur(_DN['nx'].astype(np.float32), 2.2), _blur(_DN['ny'].astype(np.float32), 2.2)
    L = P['L']
    nz = np.sqrt(np.clip(1 - nx * nx * 0.8 - ny * ny * 0.8, 0.05, 1))
    puff = np.clip((nx * L[0] + ny * L[1] + nz * L[2] * 0.7) / np.sqrt(nx * nx + ny * ny + nz * nz), 0, 1)
    puff = puff * 0.6 + macro_light(_blur(np.where(m, hf, 0).astype(np.float32), 3.0) * 0.6) * 0.4
    up = np.clip((base - YY) / max(1.0, h), 0, 1)
    side = np.clip((XX - cx) / (w / 2 + 1) * np.sign(L[0]), -1, 1)
    raw = np.where(m, hf, 0).astype(np.float32)
    ao = np.clip((_blur(raw, 2.0) - raw) / 3, 0, 1) * 0.6
    shadow_side = np.clip(0.6 - puff, 0, 1)
    t = 0.2 + puff * 0.5 + up * 0.3 + side * 0.14 - ao * 0.5 * shadow_side - np.clip((YY - base + h * 0.22) / (h * 0.22 + 1), 0, 1) * 0.3
    t = t + (fbm(XX / 3, YY / 3, 2, seed + 1) - 0.5) * 0.08
    idx = np.clip(np.floor(t * len(ramp)), 0, len(ramp) - 1).astype(int)
    c = aerial(ramp[idx], d)
    img[m] = c[m]
    rim = m & ~np.roll(m, int(np.sign(-L[0]) or 1), 1) | (m & ~np.roll(m, 1, 0) & (up > 0.3))
    fill(img, rim & (side > -0.3), aerial(C('#ffffff'), d))
    return m


def small_clouds(img, n, box, seed, d=0.1):
    rng = np.random.default_rng(seed)
    x0, y0, x1, y1 = box
    for i in range(n):
        w = rng.uniform(14, 46)
        cumulus(img, rng.uniform(x0, x1), rng.uniform(y0, y1), w, w * rng.uniform(0.18, 0.3), seed * 31 + i, d)


WHEAT = ['#5a3a14', '#8a5a1c', '#b47e28', '#d6a234', '#ecc04a', '#f8da70', '#fff0a8']


def wheat_field(img, m, d, seed, scale=1.0):
    """A wheat field rolling in the wind: big brighter and darker bands where the wind bends the stalks, and fine
    vertical stalk texture with lit ear tops."""
    ramp = np.array([C(c) for c in WHEAT], np.float32)
    wave = fbm(XX / (60 * scale) + YY / (14 * scale), YY / (9 * scale), 3, seed)
    F1, F2, DX, DY, ID = worley(max(1.0, 1.4 * scale * (0.4 + d)), seed, 0.45, 2.4)
    t = 0.1 + wave * 0.75 + (0.5 - DY / 0.7 * 0.5) * 0.25 + (ID - 0.5) * 0.12
    t = np.where((F2 - F1) < 0.08, t - 0.18, t)
    ramp_fill(img, m, t, ramp, d)


def wheat_stalks(img, y0, y1, x0, x1, n, seed, h=(18, 40), d=1.0, wind=0.25):
    """Single wheat stalks right in front of the camera: a thin curved stem, a long ear of grains, a few awns."""
    rng = np.random.default_rng(seed)
    ramp = np.array([C(c) for c in WHEAT], np.float32)
    for _ in range(n):
        bx, by = rng.uniform(x0, x1), rng.uniform(y0, y1)
        hh = rng.uniform(*h)
        lean = wind + rng.normal(0, 0.12)
        pts = [(bx + lean * hh * (k / 6) ** 1.6, by - hh * k / 6) for k in range(7)]
        tone_ = rng.uniform(0.3, 0.75)
        fill(img, mask([taper(pts, 1.0, 0.7, 6)]), aerial(ramp[int(tone_ * 4)], d))
        ex, ey = pts[-1]
        el = hh * rng.uniform(0.22, 0.32)
        for k in range(int(el / 1.6)):                                   # the grains of the ear, in pairs
            gx, gy = ex + lean * k * 1.2, ey - k * 1.6
            for sgn in (-1, 1):
                g = mask([ell(gx + sgn * 1.1, gy, 1.3, 0.9, -30 * sgn, 6)])
                fill(img, g, aerial(ramp[min(6, int(tone_ * 6) + (1 if sgn > 0 else 0))], d))
            if rng.random() < 0.4:
                fill(img, mask([cap((gx, gy), (gx + lean * 3 + sgn * 2, gy - 4), 0.3)]), aerial(ramp[5], d), 0.7)


def cornflowers(img, pts, d=1.0):
    for (x, y) in pts:
        for k in range(6):
            a = k * math.pi / 3
            fill(img, mask([ell(x + math.cos(a) * 3.2, y + math.sin(a) * 3.2, 2.4, 1.3, math.degrees(a), 6)]),
                 aerial(C('#3a6ae8') if k % 2 else C('#5a8af8'), d))
        img[int(y), int(x)] = aerial(C('#1a2a6a'), d)
        fill(img, mask([cap((x, y + 2), (x - 1, y + 16), 0.5)]), aerial(C('#3a6a2a'), d))


def treeline(img, ybase, hgt, x0, x1, d, seed, base=C('#2e6a3a')):
    """A band of distant trees: a row of round crowns, lit on top, with darker gaps."""
    rng = np.random.default_rng(seed)
    cl = []
    x = x0
    while x < x1:
        r = rng.uniform(0.35, 0.7) * hgt
        cl.append((x, ybase - r * rng.uniform(0.6, 1.2), r * 1.1, r, rng.uniform(0, r)))
        x += r * rng.uniform(0.9, 1.4)
    m, hf = domes(cl, 0.3, seed)
    m |= (YY >= ybase - hgt * 0.4) & (YY < ybase + 2) & (XX >= x0) & (XX < x1)
    leaves(img, m, hf, base, d, seed + 1, max(1.2, 1.4 + d * 2), 0.8)


def plains4():
    setup(sun=(520, 40), sun_col='#fff6d8', amb='#4a6ad0', haze='#a8cef4', light=(0.55, -0.6, 0.6), haze_k=0.6)
    img = sky([(0, '#1648c8'), (0.3, '#2a72e0'), (0.55, '#62a8f0'), (0.68, '#a8d4f6'), (1, '#a8d4f6')])
    # huge towering clouds and small fair-weather ones
    small_clouds(img, 7, (200, 30, 330, 110), 14, 0.1)
    small_clouds(img, 4, (560, 40, 640, 120), 15, 0.1)
    cumulus(img, 470, 196, 250, 180, 11, 0.12, lean=-0.1)
    cumulus(img, 120, 186, 170, 92, 12, 0.1)
    cumulus(img, 300, 198, 120, 44, 13, 0.08)
    rng = np.random.default_rng(1)
    # far blue hills, a line of trees, a farm, golden fields rolling toward us
    hz = hills(214, 14, 90, 5)
    land(img, hz, C('#6a9ad8'), 0.05, 5, lo=0.4, rough=3)
    haze_band(img, 216, 12, 0.5, '#d8ecfa', 41, 80)
    treeline(img, 224, 12, -10, 660, 0.18, 21, C('#2e6a4a'))
    haze_band(img, 228, 8, 0.35, '#d8ecfa', 42, 80)
    farmhouse(img, 300, 226, 0.7, 0.22, roof='#b84a32', seed=3)
    barn(img, 336, 226, 0.6, 0.22)
    r1 = hills(230, 6, 60, 31)
    m1 = (YY >= r1[None, :]) & (YY < 252)
    wheat_field(img, m1, 0.3, 31, 0.7)
    r2 = hills(250, 8, 70, 32)
    m2 = (YY >= r2[None, :]) & (YY < 262)
    ramp_g = make_ramp(C('#6ab040'), 6, hi_k=0.5)
    F1, F2, DX, DY, ID = worley(1.6, 33, 1.4, 0.7)
    ramp_fill(img, m2, 0.3 + fbm(XX / 30, YY / 6, 3, 33) * 0.45 + (0.5 - DY) * 0.2 + (ID - 0.5) * 0.1, ramp_g, 0.4)
    windmill(img, 410, int(r2[410]) + 4, 1.4, 0.5, 0.5)
    for (hx, hy) in ((250, 244), (268, 246), (470, 242), (560, 248), (590, 246)):           # hay bales in the cut field
        bm, bh = domes([(hx, hy - 2, 4, 3, 0)], 0.2, hx)
        bm &= YY < hy + 1
        F1, F2, DX, DY, ID = worley(0.9, hx, 0.4, 2.0)
        ramp_fill(img, bm, 0.2 + macro_light(bh) * 0.7 + (ID - 0.5) * 0.2, make_ramp(C('#d8b048'), 6, hi_k=0.5), 0.4)
        ground_shadow(img, hx + 2, hy + 1, 5, 1.2, 0.35)
    for (sx_, sy_) in ((150, 257), (160, 258), (176, 256), (600, 258), (612, 259)):         # sheep grazing on the green strip
        sheep(img, sx_, sy_, 0.9, 0.42)
    r3 = hills(262, 6, 80, 34)
    m3 = (YY >= r3[None, :]) & (YY < 300)
    wheat_field(img, m3, 0.6, 34, 1.0)
    # the forest edge on the left, a copse on the right
    for (tx, b, h_, w, kd) in ((-8, 274, 160, 4.5, 'oak'), (34, 270, 120, 3.5, 'birch'), (70, 276, 150, 5, 'oak'), (120, 274, 100, 3.2, 'poplar'),
                               (156, 280, 110, 4.0, 'oak'), (196, 282, 60, 3, 'bush'), (604, 272, 130, 4, 'oak'), (640, 268, 150, 4, 'poplar')):
        broadleaf(img, tx, b, h_, w, 0.62, rng, C('#3e8a34') if kd != 'birch' else C('#7aaa3a'), kind=kd, seed=tx + 100)
    for (tx, b, R) in ((-8, 276, 60), (70, 278, 64), (156, 282, 52), (604, 274, 50)):
        ground_shadow(img, tx, b + 6, R, 6, 0.3)
    # the playfield: a meadow with a dirt path; a mossy rock for the archer
    gy = 300 - 4 * fbm(XX[0] / 50, np.zeros(W), 2, 21)
    rock = mask([spoly((470, 302), (482, 272), (504, 260), (560, 256), (600, 264), (620, 290), (620, 302), n=4)])
    crag(img, rock, C('#a0a2a8'), 0.8, 31, 0.6, strata=False)
    fill(img, rock & ~np.roll(rock, 2, 0) & (fbm(XX / 3, YY / 3, 2, 32) > 0.3), aerial(C('#6ab040'), 0.8))
    g = YY >= gy[None, :]
    F1, F2, DX, DY, ID = worley(2.2, 41, 1.2, 0.8)
    gt = 0.55 - np.clip(YY - gy[None, :], 0, 12) / 12 * 0.35 + (0.5 - DY) * 0.25 + (ID - 0.5) * 0.15
    ramp_fill(img, g, gt, make_ramp(C('#5aa83a'), 7, hi_k=0.5), 0.86)
    path = g & (YY < gy[None, :] + 9) & (XX > 140) & (XX < 470) & (fbm(XX / 5, YY / 3, 2, 43) > 0.3) & (YY > gy[None, :] + 2)
    ramp_fill(img, path, 0.45 + (fbm(XX / 3, YY / 2, 2, 44) - 0.5) * 0.5, make_ramp(C('#c8a470'), 6, hi_k=0.4), 0.86)
    wheat_field(img, g & (YY > gy[None, :] + 12 + 3 * fbm(XX / 12, YY * 0, 2, 45)), 0.88, 46, 1.2)
    tufts(img, g & ~np.roll(g, 1, 0), (aerial(C('#2e6a28'), 0.86), aerial(C('#5aa83a'), 0.86), aerial(C('#b8e070'), 0.86)),
          42, 1.6, 3, 10, [C('#f4f0e0'), C('#4a7af0'), C('#f6d84a')])
    keep = img.copy()                                                    # sun shafts through the forest edge
    light_shafts(img, [(-40, 10, 1.0), (10, 16, 0.8), (60, 8, 1.0), (110, 12, 0.7)], '#fff4c8', 0.75, 0.14, 120, 300)
    lim = (XX < 240)[..., None]
    img[:] = np.where(lim, img, keep)
    feet_shadows(img, [(180, int(gy[180]) + 1, 10), (352, int(gy[352]) + 2, 14), (412, int(gy[412]) + 2, 14), (262, int(gy[262]) + 1, 12)], 0.35)
    # characters
    key = {'dir': (0.55, -0.6, 0.6), 'col': (1.1, 1.0, 0.85)}
    amb = (0.4, 0.48, 0.68)
    grade_actor(img, humanoid_enemy('archer', 540, 257, -1), key, amb, '#fff6c8', 0.85)
    grade_actor(img, quadruped('wolf', 352, int(gy[352]) + 1, -1, 1.3), key, amb, '#fff6c8', 0.92)
    grade_actor(img, quadruped('wolf', 412, int(gy[412]) + 1, -1, 1.25), key, amb, '#fff6c8', 0.9)
    grade_actor(img, quadruped('wolf', 262, int(gy[262]) - 16, -1, 1.3, leap=True), key, amb, '#fff6c8', 0.95, flash='#ff8a2a')
    grade_actor(img, hero(180, int(gy[180]) - 22, 1), key, amb, '#fff6c8', 1.0)
    # right in front of the camera: golden wheat and blue cornflowers, a leafy bough at the top left
    wheat_stalks(img, 318, 340, -10, 660, 90, 52, (14, 26), 0.92, 0.3)
    wheat_stalks(img, 344, 368, -10, 660, 110, 51, (24, 50), 1.0, 0.3)
    dk = np.clip((YY - 320) / 40, 0, 1) * 0.35                            # the near wheat in a little shade
    img[:] = img * (1 - dk[..., None] * (YY > 312)[..., None])
    cornflowers(img, [(40, 334), (96, 340), (230, 338), (300, 344), (520, 336), (570, 342), (612, 332), (160, 350), (440, 352)], 1.0)
    rng2 = np.random.default_rng(77)
    trunk = mask([taper([(-30, 40), (40, 14), (110, -6)], 9, 4, 4), taper([(20, 22), (60, 40), (90, 44)], 3, 1.5, 3)])
    bark(img, trunk, 6, C('#4a3a2a') * 0.8, 1.0, 5)
    cl = crown_clumps(rng2, 60, 10, 70, 26, 0.32, 0.4)
    m, hf = domes(cl, 0.4, 81)
    m &= ~((fbm(XX / 6, YY / 6, 2, 82) < 0.25) & ~_dilate(~m, 3))
    leaves(img, m, hf * 1.3, C('#2e6a2a'), 1.0, 83, 5.0, 1.2, ramp=make_ramp(C('#2e6a2a'), 7, hi_k=0.4) * 0.9)
    for (bx, by) in ((300, 96), (312, 90), (322, 98), (334, 92), (346, 99)):         # a flock of birds
        img[by, bx - 2:bx] = C('#ffffff')
        img[by - 1, bx - 3] = img[by - 1, bx + 1] = C('#ffffff')
    motes(img, 50, (40, 150, 640, 300), C('#fff8d8'), 5, 0.6)
    grade(img, 1.14, 1.05)
    bloom(img, 0.95, 5, 0.4)
    vignette(img, 0.15)
    hud(img)
    return img


def ivy(img, x, y0, y1, w, d, seed):
    """Ivy climbing a wall: dense at the bottom, thinning out upward, small leaf clusters."""
    rng = np.random.default_rng(seed)
    cl = []
    for _ in range(int((y1 - y0) * w / 18) + 6):
        t = rng.uniform(0, 1) ** 1.6
        yy_ = y1 - t * (y1 - y0)
        r = rng.uniform(1.8, 3.6) * (1 - 0.4 * t)
        cl.append((x + rng.normal(0, w * (0.5 - 0.3 * t)), yy_, r * 1.2, r, rng.uniform(0, 2)))
    m, hf = domes(cl, 0.4, seed)
    leaves(img, m, hf, C('#3a8a32'), d, seed + 1, 1.6, 1.0)


def stall(img, x, base, w, d, seed, col='#c83a3a'):
    """A market stall: two posts, a sloping striped awning with a scalloped edge, a counter with baskets and crates of
    apples, oranges and cabbages, a shadow underneath."""
    rng = np.random.default_rng(seed)
    top = base - 26
    for px in (x + 1, x + w - 2):
        fill(img, rect(px - 1, top, px + 1, base), aerial(C('#5a3a22'), d))
    under = rect(x, top + 6, x + w, base)
    fill(img, under, C('#000000'), 0.35)
    aw = mask([poly((x - 4, top + 8), (x + 3, top - 2), (x + w - 3, top - 2), (x + w + 4, top + 8))])
    scal = (YY > top + 7) & (YY < top + 10) & (np.abs(((XX - x) % 6) - 3) < 2.4 - (YY - top - 7))
    aw |= scal & (XX > x - 4) & (XX < x + w + 4)
    stripe = ((XX - x + (YY - top) * 0.3) // 4) % 2 == 0
    t = 0.45 + (top + 8 - YY) / 10 * 0.35
    ramp_fill(img, aw & stripe, t, make_ramp(C(col), 6, hi_k=0.5), d)
    ramp_fill(img, aw & ~stripe, t, make_ramp(C('#f0e6d0'), 6, hi_k=0.5), d)
    ct = rect(x - 1, base - 10, x + w + 1, base)
    fill(img, ct, aerial(C('#7a5232'), d))
    fill(img, rect(x - 1, base - 10, x + w + 1, base - 9), aerial(C('#a87a4a'), d))
    fill(img, ct & (np.abs((XX - x) % 7) < 0.6), aerial(C('#4a3020'), d))
    for k in range(int(w // 8)):
        bx = x + 3 + k * 8
        kind = rng.integers(3)
        cols = [('#d83a2a', '#ff6a4a'), ('#f08a1a', '#ffb84a'), ('#6aa83a', '#9ad85a')][kind]
        for j in range(7):
            gx, gy = bx + (j % 4) * 1.6 + rng.uniform(-0.4, 0.4), base - 11 - (j // 4) * 1.8
            fill(img, mask([ell(gx, gy, 1.3, 1.2, 0, 6)]), aerial(C(cols[0]), d))
            img[int(gy - 0.6), int(gx)] = aerial(C(cols[1]), d)


def city4():
    setup(sun=(560, 40), sun_col='#fff2d4', amb='#5a6ab8', haze='#b0d0f0', light=(0.6, -0.6, 0.55), haze_k=0.55)
    img = sky([(0, '#1a5ad0'), (0.3, '#3a86e4'), (0.6, '#8ac4f0'), (1, '#c8e4f8')])
    rng = np.random.default_rng(5)
    small_clouds(img, 6, (60, 20, 300, 80), 21, 0.1)
    cumulus(img, 520, 150, 220, 120, 22, 0.1)
    cumulus(img, 120, 120, 140, 60, 23, 0.1)
    # the King's castle far away in the haze, its hill, the city walls
    castle_far(img, 200, 196, 1.0, 0.25, 3)
    walls = rect(-10, 200, 660, 216)
    blocks(img, walls, C('#b0a89c'), 0.25, 9, 7, 4, 0.55, 0.0, None)
    for cx in range(-10, 660, 6):
        face(img, rect(cx, 196, cx + 3, 200), C('#b0a89c'), 0.6, 0.25)
    # trees growing behind the roofs
    for (tx, h_) in ((20, 80), (90, 66), (440, 90), (520, 74), (600, 86)):
        broadleaf(img, tx, 246, h_, 3.0, 0.4, rng, C('#4a9a34'), kind='oak', seed=tx + 900)
    # far rooftops and the cathedral
    for k in range(26):
        hx = -20 + k * 26 + rng.uniform(-6, 6)
        house(img, hx, 240, rng.uniform(16, 24), int(rng.integers(2, 4)), 0.3, 100 + k, fh=10, roof=rng.choice(['gable', 'hip']),
              lights=0.05, wq=0.62, stonework=rng.random() < 0.3)
    cx = 330
    cat = rect(cx - 30, 120, cx + 30, 240)
    blocks(img, cat, C('#c8c0b0'), 0.32, 77, 8, 5, 0.5, 0.45, np.clip((XX - cx) / 30, -1, 1))
    roofc = mask([poly((cx - 34, 122), (cx, 92), (cx + 34, 122))])
    fill(img, roofc, lit(C('#4a5a7a'), 0.5, 0.32))
    fill(img, roofc & (XX > cx), lit(C('#4a5a7a'), 0.95, 0.32))
    sp = mask([poly((cx - 8, 92), (cx, 20), (cx + 8, 92))])
    face(img, sp, C('#4a5a7a'), 0.5, 0.32)
    fill(img, sp & (XX > cx), lit(C('#5a6a8a'), 1.0, 0.32))
    fill(img, mask([cap((cx, 20), (cx, 10), 0.6), cap((cx - 3, 14), (cx + 3, 14), 0.6)]), aerial(C('#e8c060'), 0.4))
    rose = mask([ell(cx, 146, 13, 13, 0, 24)])
    fill(img, rose, aerial(C('#2a3050'), 0.32))
    for j in range(8):
        a = j * math.pi / 4
        fill(img, rose & mask([cap((cx, 146), (cx + math.cos(a) * 12, 146 + math.sin(a) * 12), 1.2)]), aerial(C('#b8b0a0'), 0.32))
    for k in range(3):
        wx = cx - 22 + k * 18
        fill(img, rect(wx, 176, wx + 7, 220) & ~((YY < 180) & (np.abs(XX - wx - 3.5) > 2.5)), aerial(C('#2a3050'), 0.32))
    # the middle row of houses, some of stone
    for k in range(9):
        hx = -30 + k * 76 + rng.uniform(-8, 8)
        house(img, hx, 264, rng.uniform(34, 46), int(rng.integers(3, 5)), 0.5, 200 + k, fh=16, roof=rng.choice(['gable', 'hip']),
              lights=0.05, wq=0.66, stonework=k % 3 == 1)
    a = np.floor(np.clip(1 - np.abs(YY - 254) / 30, 0, 1) * 0.3 * 6 + BAY * 0.9) / 6
    img[:] = img * (1 - a[..., None]) + P['haze'] * a[..., None]
    # the market street: front houses (timber and stone), a gate into a side street, ivy, stalls
    street = 304
    xs = [(-14, 58, 4, True, False), (48, 62, 3, False, True), (114, 54, 4, True, False), (178, 66, 3, True, False),
          (380, 60, 4, False, True), (446, 58, 3, True, False), (508, 70, 4, True, False), (582, 64, 3, False, False)]
    tops = {}
    for i, (hx, w, fl, shop, stone) in enumerate(xs):
        tops[hx] = house(img, hx, street - 4, w, fl, 0.84, 300 + i, fh=24, roof='gable' if i % 3 else 'hip', shop=shop,
                         lights=0.05, wq=0.72, stonework=stone)
    fill(img, rect(250, 190, 372, 300), lit(C('#8a8aa0'), 0.35, 0.5))
    for (hx, w, fl, sd) in ((262, 26, 5, 7), (292, 30, 5, 8), (326, 34, 4, 9)):
        house(img, hx, 286, w, fl, 0.6, 400 + sd, fh=15, roof='gable', shop=sd == 8, lights=0.05, wq=0.6)
    arch = rect(254, 196, 370, 214) | rect(254, 196, 268, 300) | rect(356, 196, 370, 300)
    arch &= ~(mask([ell(312, 228, 44, 30, 0, 30)]) & (YY > 214))
    blocks(img, arch, C('#b8b0a0'), 0.72, 9, 9, 6, 0.55, 0.4, np.clip((XX - 340) / 30, 0, 1))
    cobbles(img, 284, 300, 0.6, 2, 268, 356)
    for (ix, i0, i1, iw, sd) in ((60, 200, 300, 14, 1), (400, 190, 300, 12, 2), (30, 230, 300, 8, 3), (600, 220, 300, 10, 4)):
        ivy(img, ix, i0, i1, iw, 0.85, 700 + sd)
    for bx in (150, 470, 560):                                          # banners of the enemy kingdom
        by = street - 4 - 24 * 2 + 2
        bn = mask([poly((bx, by), (bx + 12, by), (bx + 12, by + 24), (bx + 6, by + 20), (bx, by + 24))])
        q = tone(_blur(bn.astype(np.float32), 2) * 3 + np.sin(YY / 3) * 0.6, None, 4, 0.2)
        img[bn] = lit(C('#a01a22'), q, 0.86)[bn]
        emb = mask([poly((bx + 6, by + 5), (bx + 9, by + 9), (bx + 6, by + 14), (bx + 3, by + 9))])
        fill(img, emb, lit(C('#1a1418'), 0.4, 0.86))
        fill(img, mask([cap((bx - 2, by), (bx + 14, by), 0.7)]), lit(C('#c8a040'), 0.8, 0.86))
    # the cobbled street in sun, with the houses' shadow along its back edge
    cl_ = YY >= street - 4
    fill(img, cl_, C('#000000'))
    cobbles(img, street - 4, H, 0.9, 7)
    ramp_s = make_ramp(C('#d0bc98'), 7, hi_k=0.45)
    sc = 3.0 + np.clip(YY - street, 0, 60) / 60 * 3.0                       # stones get bigger toward the camera
    F1, F2, DX, DY, ID = worley(4.5, 71, 1.6, 0.8)
    nrm = np.clip(F1 / 0.55, 0, 1)
    t = 0.55 - nrm * 0.15 + (-DY - DX * 0.3) * 0.35 + (ID - 0.5) * 0.18
    t = np.where((F2 - F1) < 0.06, 0.15, t)
    ramp_fill(img, cl_, t, ramp_s, 0.9)
    moss_s = cl_ & ((F2 - F1) < 0.09) & (fbm(XX / 8, YY / 5, 2, 73) > 0.62)
    fill(img, moss_s, aerial(C('#6a9a3a'), 0.9))
    sh = cl_ & (YY < street + 6 + 4 * fbm(XX / 20, YY * 0, 2, 72))
    img[sh] = img[sh] * np.array([0.55, 0.6, 0.8], np.float32)
    for (sx_, sw, sc) in ((60, 34, '#c83a3a'), (440, 30, '#3a6ac8'), (520, 36, '#e0a030')):
        stall(img, sx_, street + 6, sw, 0.92, sx_, sc)
    for (bx, by) in ((100, street + 6), (108, street + 5), (476, street + 6)):
        b_ = mask([ell(bx, by - 6, 4.5, 6.5, 0, 16)])
        ramp_fill(img, b_, 0.2 + np.clip((XX - bx) / 4.5, -1, 1) * 0.3 + 0.25 - np.where(np.abs(np.abs(YY - (by - 6)) - 3.5) < 0.6, 0.3, 0),
                  make_ramp(C('#a06a3a'), 6), 0.9)
    for (fx, fy_) in ((240, street + 8), (380, street + 10)):                 # flower pots
        fill(img, mask([poly((fx - 4, fy_), (fx + 4, fy_), (fx + 3, fy_ - 6), (fx - 3, fy_ - 6))]), aerial(C('#b8603a'), 0.9))
        for j in range(10):
            img[int(fy_ - 7 - j % 3), int(fx - 4 + j)] = C(['#e83a4a', '#3a8a2a', '#ffd040', '#3a8a2a'][j % 4])
    # characters
    key = {'dir': (0.6, -0.6, 0.55), 'col': (1.1, 1.0, 0.85)}
    amb = (0.42, 0.46, 0.66)
    grade_actor(img, humanoid_enemy('crossbow', 545, int(tops[508]) + 4, -1, 40), key, amb, '#fff6d8', 0.85)
    grade_actor(img, cannon(610, street + 4, -1), key, amb, '#fff6d8', 0.9)
    for (cx_, cy_) in ((360, street + 3), (420, street + 3), (290, street + 3), (170, street + 3)):
        ground_shadow(img, cx_ - 6, cy_, 12, 2.5, 0.5)
    grade_actor(img, humanoid_enemy('soldier', 360, street + 2, -1, 40), key, amb, '#fff6d8', 0.9)
    grade_actor(img, humanoid_enemy('soldier', 420, street + 2, -1, 40), key, amb, '#fff6d8', 0.9)
    grade_actor(img, quadruped('wolf', 290, street + 2, -1, 1.2), key, amb, '#fff6d8', 0.9, flash='#ff8a2a')
    grade_actor(img, hero(170, street - 20, 1), key, amb, '#fff6d8', 1.0)
    # near the camera: a hanging sign top right, a timber corner at the left edge with ivy
    fill(img, mask([cap((640, 40), (590, 40), 1.6), cap((640, 52), (600, 40), 1)]), C('#2a1e18'))
    sg = mask([poly((598, 44), (626, 44), (626, 66), (598, 66))])
    face(img, sg, C('#8a5a32'), 0.8, 1.0)
    fill(img, mask([ell(612, 55, 6, 6, 0, 12)]), lit(C('#e8b840'), 1.0, 1.0))
    corner = rect(-10, -10, 34, H)
    blocks(img, corner, C('#8a7a6a'), 1.0, 81, 12, 8, 0.25, 0.4, np.clip((XX - 20) / 14, 0, 1))
    ivy(img, 22, 120, 360, 16, 1.0, 82)
    grade(img, 1.1, 1.12)
    bloom(img, 0.95, 5, 0.35)
    vignette(img, 0.15)
    hud(img)
    return img


GOLD = ['#2a1808', '#5a3810', '#8a5a18', '#c08a26', '#e4b23a', '#f8d860', '#fff2a8', '#ffffff']


def gold_fill(img, m, d, t):
    ramp_fill(img, m, t, np.array([C(c) for c in GOLD], np.float32), d)


def scroll_shapes(S, x, y, r, sgn, flip=1, turns=1.4):
    """One rococo C-scroll: a curling stem that winds into a spiral."""
    n = 14
    pts = []
    for k in range(n + 1):
        u = k / n
        a = u * turns * 2 * math.pi
        rr = r * (1 - u * 0.75)
        pts.append((x + sgn * math.cos(a) * rr, y + flip * math.sin(a) * rr))
    S.append(taper(pts, max(1.2, r * 0.48), 0.8, n))


def gold_relief(img, m, d):
    """Shade a gold relief: rounded, lit from the windows, with a bright top edge and a dark lower edge."""
    hf = cylinder(m, 1.2)
    t = 0.2 + macro_light(hf * 2.5) * 0.7
    t = np.where(m & ~np.roll(m, 1, 0), 0.95, t)
    t = np.where(m & ~np.roll(m, -1, 0), 0.15, t)
    gold_fill(img, m, d, t)


def gilt(img, m, d, seed, scale=6.0, dens=3):
    """Gilded scrollwork: pairs of C-scrolls facing each other with a leaf between, repeated across mask m."""
    ys, xs = np.nonzero(m)
    if not len(xs):
        return
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    rng = np.random.default_rng(seed)
    S = []
    sp = max(6.0, scale * 4)
    r = max(1.5, min(scale * 1.1, (y1 - y0) * 0.32))
    yy_ = (y0 + y1) / 2
    rows = max(1, int((y1 - y0) / (r * 3.2)))
    for ri in range(rows):
        yc = y0 + (y1 - y0) * (ri + 0.5) / rows
        x = x0 + sp / 2 + (ri % 2) * sp / 2
        while x < x1:
            scroll_shapes(S, x - r * 1.1, yc, r, -1, 1)
            scroll_shapes(S, x + r * 1.1, yc, r, 1, 1)
            S.append(('poly', [(x, yc - r * 1.4), (x + r * 0.5, yc), (x, yc + r * 0.6), (x - r * 0.5, yc)]))
            x += sp
    om = mask(S) & m
    gold_relief(img, om, d)


def frame_gold(img, x0, y0, x1, y1, d, wdt=3):
    outer = rect(x0 - wdt, y0 - wdt, x1 + wdt, y1 + wdt) & ~rect(x0, y0, x1, y1)
    t = 0.4 + np.where(YY < y0, 0.35, 0) + np.where(XX < x0, 0.2, 0) - np.where(YY > y1, 0.2, 0)
    t = t + np.where(np.abs(((XX + YY) % 4) - 2) < 0.6, 0.15, 0)
    gold_fill(img, outer, d, t)


def fresco(img, m, d, seed, kind='sky'):
    """A painting: kind 'sky' (a ceiling fresco: a soft sky, sunlit clouds, robed figures floating) or 'land' (a
    landscape in a frame: sky, hills, a tree, a little castle)."""
    ys, xs = np.nonzero(m)
    if not len(xs):
        return
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    rng = np.random.default_rng(seed)
    tt = np.clip((YY - y0) / max(1, y1 - y0), 0, 1)
    base = mix(C('#8ab8e8'), C('#f4dcb8'), tt[..., None])
    img[m] = aerial(base, d)[m]
    keep = img.copy()
    if kind == 'sky':
        for k in range(4):
            cumulus(img, rng.uniform(x0, x1), rng.uniform(y0 + (y1 - y0) * 0.5, y1), (x1 - x0) * rng.uniform(0.15, 0.3),
                    (y1 - y0) * rng.uniform(0.3, 0.5), seed + k, d, flat=False)
        cx0, cy0 = (x0 + x1) / 2, y0 + (y1 - y0) * 0.35                  # heavenly light: golden rays from the centre
        ang = np.arctan2(YY - cy0, XX - cx0)
        rays = m & (np.sin(ang * 14) > 0.6) & (np.hypot(XX - cx0, (YY - cy0) * 2) < (y1 - y0) * 1.4)
        fill(img, rays, aerial(C('#fff0b8'), d), 0.45)
        glow(img, cx0, cy0, (y1 - y0) * 0.8, C('#fff4c8'), 0.5)
        for k in range(0):                                               # (no figures: they read as fruit at this size)
            fx, fy = rng.uniform(x0 + 10, x1 - 10), rng.uniform(y0 + 6, y1 - 6)
            col = C(rng.choice(['#c83a3a', '#3a5ac8', '#e8b040', '#4a9a5a', '#f0e8e0']))
            robe = mask([ell(fx, fy, rng.uniform(3, 5), rng.uniform(5, 8), rng.uniform(-50, 50), 12)])
            ramp_fill(img, robe, 0.4 + np.clip((fx - XX) / 5, -1, 1) * 0.2 + np.clip((fy - YY) / 6, -1, 1) * 0.15,
                      make_ramp(col, 6, hi_k=0.5), d)
            fill(img, mask([ell(fx + rng.uniform(-2, 2), fy - 7, 1.8, 1.8, 0, 8)]), aerial(C('#f0c8a0'), d))
            if rng.random() < 0.5:                                      # wings
                fill(img, mask([ell(fx - 4, fy - 4, 3, 1.4, -30, 8), ell(fx + 4, fy - 4, 3, 1.4, 30, 8)]), aerial(C('#fff8f0'), d))
    else:
        hz = y0 + (y1 - y0) * 0.55
        hill = (YY > hz - 6 * fbm(XX / 12, YY * 0, 2, seed)) & m
        ramp_fill(img, hill, 0.4 + (fbm(XX / 6, YY / 4, 2, seed + 1) - 0.5) * 0.4 + (hz + 10 - YY) / 30, make_ramp(C('#5a8a3a'), 6), d)
        tx = rng.uniform(x0 + 8, x1 - 8)
        tr = mask([ell(tx, hz - 6, 6, 7, 0, 14)]) & m
        ramp_fill(img, tr, 0.35 + np.clip((tx - XX) / 6, -1, 1) * 0.25, make_ramp(C('#3a6a2a'), 6), d)
        fill(img, rect(tx - 0.6, hz - 1, tx + 0.6, hz + 6) & m, aerial(C('#4a3020'), d))
        cx_ = x1 - (x1 - x0) * 0.3
        fill(img, (rect(cx_ - 4, hz - 10, cx_ + 4, hz) | rect(cx_ - 2, hz - 14, cx_ + 2, hz)) & m, aerial(C('#c8c0b0'), d))
    img[~m] = keep[~m]
    sh = m & (fbm(XX / 2, YY / 2, 1, seed + 9) > 0.7)                    # old varnish, brush texture
    img[sh] = img[sh] * 0.94


def round_window(img, cx, top, a, bottom, d, seed):
    """A tall round-arched window: a white stone frame, a grid of small panes, bright daylight with a hint of the
    garden outside, a gilded keystone."""
    win = (((XX - cx) ** 2 + (YY - top - a) ** 2 < a * a) & (YY < top + a)) | ((np.abs(XX - cx) < a) & (YY >= top + a) & (YY < bottom))
    frame = _dilate(win, 3) & ~win
    ramp_fill(img, frame, 0.55 + np.where(XX < cx, 0.15, -0.05), make_ramp(C('#e8e0d0'), 6, hi_k=0.6), d)
    sky_ = mix(C('#d8ecff'), C('#ffffff'), np.clip((YY - top) / (bottom - top), 0, 1)[..., None])
    img[win] = sky_[win]
    garden = win & (YY > bottom - (bottom - top) * 0.28 + 6 * fbm(XX / 10, YY * 0, 2, seed))
    fill(img, garden, C('#a8d0a0'))
    fill(img, garden & (fbm(XX / 3, YY / 3, 2, seed + 1) > 0.55), C('#c8e4b8'))
    grid = win & ((np.abs(((XX - cx + a) % 6)) < 0.7) | (np.abs(((YY - top) % 8)) < 0.7) | (np.abs(XX - cx) < 1.2))
    fill(img, grid, C('#c8b8a0'))
    fill(img, mask([poly((cx - 4, top - 4), (cx + 4, top - 4), (cx + 3, top + 4), (cx - 3, top + 4))]), aerial(C('#e4b23a'), d))
    glow(img, cx, (top + bottom) / 2, a * 3.5, C('#fff4d8'), 0.35)
    return win


def chandelier(img, x, y, s, d, seed):
    """A gilded crystal chandelier: a chain, tiers of gold arms holding candles, strings of crystal drops."""
    rng = np.random.default_rng(seed)
    fill(img, mask([cap((x, -5), (x, y - 26 * s), 0.7)]), aerial(C('#8a6a2a'), d))
    for (ty, rx, n) in ((y - 18 * s, 10 * s, 6), (y - 6 * s, 18 * s, 9), (y + 4 * s, 24 * s, 11)):
        ring = mask([ell(x, ty, rx, rx * 0.22, 0, 24)]) & ~mask([ell(x, ty, rx - 1.6, rx * 0.22 - 1.2, 0, 24)])
        gold_relief(img, ring | _dilate(ring, 0), d)
        for j in range(n):
            a = j / n * 2 * math.pi
            px, py = x + math.cos(a) * rx, ty + math.sin(a) * rx * 0.22
            fill(img, rect(px - 0.5, py - 5 * s, px + 1, py), aerial(C('#f4ecd8'), d))
            img[int(py - 5 * s - 2):int(py - 5 * s), int(px)] = C('#ffe080')
            glow(img, px, py - 5 * s - 1, 4 * s, C('#ffb040'), 0.25)
        for j in range(n * 2):                                              # crystal drops
            a = rng.uniform(0, 2 * math.pi)
            px, py = x + math.cos(a) * rx * rng.uniform(0.6, 1.0), ty + rx * 0.22 + rng.uniform(1, 6 * s)
            if 0 <= int(py) < H and 0 <= int(px) < W:
                img[int(py), int(px)] = C(rng.choice(['#ffffff', '#c8f0ff', '#fff4c0']))
    body = mask([spoly((x - 2.5 * s, y - 24 * s), (x + 2.5 * s, y - 24 * s), (x + 2 * s, y + 8 * s), (x, y + 13 * s), (x - 2 * s, y + 8 * s), n=3)])
    gold_relief(img, body, d)
    glow(img, x, y - 4 * s, 40 * s, C('#ffc060'), 0.18)


def marble_column(img, x, top, base, w, d, seed, col='#9a3a3a'):
    """A polished marble column with veins, a gilded capital and base."""
    sh = rect(x - w, top + 10, x + w, base - 8)
    u = np.clip((XX - x) / w, -1, 1)
    t = 0.2 + np.sqrt(np.clip(1 - u * u, 0, 1)) * 0.45 - u * 0.15 + (fbm(XX / 3, YY / 12, 3, seed) - 0.5) * 0.3
    t = np.where(np.abs(np.abs(u) - 0.55) < 0.06, t + 0.35, t)                                  # the polished highlight
    ramp_fill(img, sh, t, make_ramp(C(col), 7, hi_k=0.6), d)
    vein = sh & (np.abs(fbm(XX / 4, YY / 10, 3, seed + 1) - 0.5) < 0.015)
    fill(img, vein, aerial(C('#f0e0d0'), d), 0.6)
    for (yy_, hh, ww) in ((top, 10, w + 5), (base - 8, 8, w + 4)):
        cp = mask([poly((x - ww, yy_ + hh), (x - ww + 2, yy_), (x + ww - 2, yy_), (x + ww, yy_ + hh))])
        gold_fill(img, cp, d, 0.45 + np.clip((x - XX) / ww, -1, 1) * 0.2 + np.where(np.abs((YY - yy_) % 3) < 0.6, -0.15, 0.1))


def castle4():
    setup(sun=(320, -40), sun_col='#fff2d8', amb='#a8806a', haze='#e8d0b0', light=(-0.25, -0.5, 0.8), haze_k=0.5)
    img = np.zeros((H, W, 3), np.float32) + C('#e8dcc0')
    floor_y = 300
    # the back wall: pale green panels between gilded pilasters, tall bright windows, paintings in gold frames
    wall = rect(0, 70, W, floor_y)
    ramp_fill(img, wall, 0.48 + (fbm(XX / 20, YY / 20, 2, 1) - 0.5) * 0.1 - np.clip((YY - 160) / 140, 0, 1) * 0.2,
              make_ramp(C('#a8b498'), 7, hi_k=0.4), 0.35)
    lat = rect(0, 100, W, 248)                                            # gilded trellis on the wall panels
    lat_lines = (np.abs(((XX + YY) % 10) - 5) < 0.6) | (np.abs(((XX - YY) % 10) - 5) < 0.6)
    gold_fill(img, lat & lat_lines, 0.35, 0.45 + np.where(((XX + YY) % 10) < 5, 0.15, -0.1))
    knots = lat & (np.abs(((XX + YY) % 10) - 5) < 1.2) & (np.abs(((XX - YY) % 10) - 5) < 1.2)
    gold_fill(img, knots, 0.35, 0.85)
    for px_ in range(0, W + 1, 80):                                     # pilasters
        pl = rect(px_ - 7, 74, px_ + 7, floor_y)
        ramp_fill(img, pl, 0.5 + np.clip((px_ - XX) / 7, -1, 1) * 0.15, make_ramp(C('#e8e0c8'), 6, hi_k=0.5), 0.35)
        fill(img, pl & (np.abs(np.abs(XX - px_) - 4) < 0.7), aerial(C('#e4b23a'), 0.35))
        gilt(img, rect(px_ - 10, 76, px_ + 10, 90), 0.35, px_, 2, 1)
    for wx in (160, 320, 480):
        round_window(img, wx, 96, 26, 268, 0.35, wx)
        gilt(img, rect(wx - 40, 76, wx + 40, 94), 0.35, wx + 1, 3.6, 1)
    for (fx, fy0, fx1, fy1, sd) in ((60, 120, 100, 200, 41), (220 + 160, 300, 0, 0, 0)):
        if fx1 == 0:
            continue
        frame_gold(img, fx - 20 + 20, fy0, fx1 + 0, fy1, 0.35, 3)
    for (fx0, fx1, sd) in ((54, 106, 41), (214, 266, 42), (374, 426, 43), (534, 586, 44)):  # paintings in gold frames
        fresco(img, rect(fx0, 128, fx1, 196), 0.4, sd, 'land')
        frame_gold(img, fx0, 128, fx1, 196, 0.35, 3)
    dado = rect(0, 250, W, floor_y)                                      # wainscot with gilded panels
    ramp_fill(img, dado, 0.5 + np.where(np.abs(YY - 252) < 1.5, 0.3, 0), make_ramp(C('#d8ccb0'), 6, hi_k=0.5), 0.4)
    for k in range(0, W, 40):
        frame_gold(img, k + 6, 258, k + 34, 292, 0.4, 1)
    # the ceiling: a painted fresco in a gilded cartouche, stucco scrolls, a deep cornice
    ceil = rect(0, 0, W, 70)
    ramp_fill(img, ceil, 0.6 + (fbm(XX / 10, YY / 10, 2, 5) - 0.5) * 0.15, make_ramp(C('#efe2c4'), 6, hi_k=0.5), 0.4)
    fr = mask([ell(320, 26, 190, 40, 0, 60)])
    fresco(img, fr, 0.4, 7)
    ring = _dilate(fr, 4) & ~fr
    gold_fill(img, ring, 0.4, 0.5 + np.where(YY < 26, 0.25, -0.05))
    gilt(img, rect(0, 4, W, 22) & ~_dilate(fr, 5), 0.4, 8, 3, 2)
    gilt(img, rect(0, 40, W, 60) & ~_dilate(fr, 5), 0.4, 18, 3, 2)
    for (ox, oy, sg) in ((110, 26, 1), (530, 26, -1), (40, 30, 1), (600, 30, -1)):         # big stucco scroll clusters
        S = []
        for k in range(3):
            scroll_shapes(S, ox + sg * k * 14, oy - 8 + k * 6, 7 - k, sg, 1 if k % 2 else -1, 1.3)
        S.append(taper([(ox - sg * 6, oy + 14), (ox + sg * 10, oy), (ox + sg * 30, oy - 12)], 3.5, 1, 6))
        gold_relief(img, mask(S), 0.4)
    for rx in (210, 430):                                                 # rosettes
        for k in range(8):
            a = k * math.pi / 4
            gold_relief(img, mask([ell(rx + math.cos(a) * 5, 12 + math.sin(a) * 3, 3, 1.6, math.degrees(a), 8)]), 0.4)
    corn = rect(0, 62, W, 74)
    ramp_fill(img, corn, 0.4 + np.where(np.abs(((YY - 62) % 4)) < 1, 0.35, 0), make_ramp(C('#e8d8b0'), 6, hi_k=0.5), 0.4)
    gilt(img, rect(0, 63, W, 74), 0.4, 9, 2.6, 1)
    # the throne under a red canopy, between the middle windows
    cx = 320
    fill(img, mask([poly((cx - 30, 150), (cx + 30, 150), (cx + 36, 166), (cx - 36, 166))]), aerial(C('#b01a28'), 0.45))
    gold_relief(img, mask([poly((cx - 36, 164), (cx + 36, 164), (cx + 36, 167), (cx - 36, 167))]), 0.45)
    for k in range(4):
        st_ = rect(cx - 60 + k * 8, 270 + k * 8 - 30, cx + 60 - k * 8, 278 + k * 8 - 30)
        ramp_fill(img, st_, 0.5 + np.where(np.abs(YY - (270 + k * 8 - 30)) < 1, 0.3, 0), make_ramp(C('#e0d0c0'), 6), 0.45)
    th = mask([poly((cx - 16, 240), (cx - 16, 176), (cx - 10, 162), (cx - 6, 172), (cx, 152), (cx + 6, 172), (cx + 10, 162), (cx + 16, 176), (cx + 16, 240))])
    gold_relief(img, th, 0.45)
    fill(img, mask([poly((cx - 10, 178), (cx + 10, 178), (cx + 10, 224), (cx - 10, 224))]), aerial(C('#9a1420'), 0.45))
    # the arcade in front: marble columns with round arches and an upper gallery with a balustrade
    for (px_, col) in ((40, '#9a3a3a'), (200, '#3a7a6a'), (440, '#3a7a6a'), (600, '#9a3a3a')):
        marble_column(img, px_, 104, floor_y, 10, 0.62, px_, col)
    arc = rect(0, 70, W, 104)
    for (a0, a1) in ((40, 200), (440, 600)):
        arc &= ~(((XX - (a0 + a1) / 2) ** 2 / ((a1 - a0) / 2 - 10) ** 2 + (YY - 104) ** 2 / 26 ** 2 < 1) & (YY > 78))
    arc &= ~rect(200, 70, 440, 104)
    ramp_fill(img, arc, 0.55 + (fbm(XX / 6, YY / 6, 2, 13) - 0.5) * 0.1, make_ramp(C('#e8dcc0'), 6, hi_k=0.5), 0.62)
    gilt(img, arc & (YY < 92), 0.62, 14, 3.4, 1)
    bal = rect(200, 98, 440, 106)
    gold_fill(img, bal, 0.62, 0.55)
    for k in range(204, 440, 7):
        fill(img, mask([spoly((k, 106), (k - 2, 112), (k, 118), (k + 2, 112), n=2)]) | rect(k - 1, 106, k + 1, 120), aerial(C('#e8dcc0'), 0.62))
    gold_fill(img, rect(200, 120, 440, 123), 0.62, 0.45)
    # the floor: polished marble in a diamond pattern, mirroring the windows; sunlight falling across it
    fl = rect(0, floor_y, W, H)
    src = np.clip(2 * floor_y - YY, 0, H - 1).astype(int)
    refl = img[src, XX.astype(int)].copy()
    u = (XX - 320) / (1 + (YY - floor_y) * 0.06)
    dia = ((np.floor((u + (YY - floor_y) * 1.6) / 14) + np.floor((u - (YY - floor_y) * 1.6) / 14)) % 2) == 0
    ramp_fill(img, fl & dia, 0.6 + (fbm(XX / 5, YY / 3, 2, 21) - 0.5) * 0.2, make_ramp(C('#e8e0d0'), 6, hi_k=0.5), 0.9)
    ramp_fill(img, fl & ~dia, 0.45 + (fbm(XX / 5, YY / 3, 2, 22) - 0.5) * 0.2, make_ramp(C('#4a8a8a'), 6, hi_k=0.5), 0.9)
    k_ = np.clip(0.45 - (YY - floor_y) / 120, 0, 0.45)[..., None]
    img[fl] = (img * (1 - k_) + refl * k_)[fl]
    for wx in (160, 320, 480):                                          # sun patches through the windows
        patch = fl & (np.abs(XX - wx - (YY - floor_y) * 0.9 - 30) < 18 + (YY - floor_y) * 0.25) & (YY < floor_y + 50)
        grid_ = (np.abs(((XX - (YY - floor_y) * 0.9) % 9)) < 0.8) | (np.abs(((YY - floor_y) % 10)) < 0.8)
        a = 0.35 * (1 - (YY - floor_y) / 60)
        img[patch & ~grid_] = (img + C('#fff0c8') * a[..., None])[patch & ~grid_]
    run = rect(0, floor_y + 4, W, floor_y + 14)
    fill(img, run, aerial(C('#a01a28'), 0.9))
    fill(img, run & ((np.abs(YY - floor_y - 5) < 0.6) | (np.abs(YY - floor_y - 13) < 0.6)), aerial(C('#e4b23a'), 0.9))
    gold_fill(img, rect(0, floor_y, W, floor_y + 2), 0.9, 0.6)
    # dust in the window light, shafts
    acc = np.zeros((H, W), np.float32)
    for wx in (160, 320, 480):
        xb = wx + (YY - 180) * 0.6
        acc += np.clip(1 - np.abs(XX - xb) / (18 + (YY - 96) * 0.05), 0, 1) * (YY > 100)
    q = np.floor(np.clip(acc, 0, 1) * 4 + BAY * 0.9) / 4
    img[:] = img + C('#fff4d8')[None, None] * (q * 0.16)[..., None]
    chandelier(img, 120, 150, 1.4, 0.7, 1)
    chandelier(img, 520, 150, 1.4, 0.7, 2)
    # traps: a spike strip and a swinging blade
    for k in range(16):
        sx_ = 372 + k * 4
        fill(img, mask([poly((sx_, floor_y + 1), (sx_ + 2, floor_y - 9 - (k % 3)), (sx_ + 4, floor_y + 1))]), aerial(C('#c8d0e0'), 0.9))
        img[floor_y - 9 - (k % 3), sx_ + 2] = C('#ffffff')
    fill(img, rect(370, floor_y, 438, floor_y + 6), C('#2a1a1a'))
    ang = math.radians(24)
    bx, by = 300 + math.sin(ang) * 150, math.cos(ang) * 150
    fill(img, mask([cap((300, 0), (bx, by), 1.2)]), aerial(C('#6a5a40'), 0.8))
    blade = mask([spoly((bx - 30 * math.cos(ang), by + 30 * math.sin(ang) - 4), (bx + 6 * math.sin(ang), by + 20 * math.cos(ang)),
                        (bx + 30 * math.cos(ang), by - 30 * math.sin(ang) - 4), (bx, by + 4), n=4)])
    ramp_fill(img, blade, 0.4 + np.clip((by - YY) / 14, -1, 1) * 0.3, make_ramp(C('#c8d0e0'), 6, hi_k=0.7), 0.85)
    # characters: royal guards, a gargoyle statue on a pedestal waking up, the hero
    key = {'dir': (-0.25, -0.5, 0.8), 'col': (1.05, 1.0, 0.9)}
    amb = (0.62, 0.52, 0.46)
    ped = rect(422, 236, 462, floor_y)
    ramp_fill(img, ped, 0.5 + np.clip((442 - XX) / 20, -1, 1) * 0.2, make_ramp(C('#e0d4c0'), 6), 0.85)
    gold_fill(img, rect(420, 234, 464, 238), 0.85, 0.6)
    grade_actor(img, gargoyle(442, 234, 1.3, -1), key, amb, '#fff4d8', 0.85)
    for (cx_, cy_) in ((488, floor_y), (572, floor_y)):
        ground_shadow(img, cx_ + 4, cy_ + 1, 12, 2.5, 0.4)
    grade_actor(img, humanoid_enemy('guard', 488, floor_y, -1, 42), key, amb, '#fff4d8', 0.9)
    grade_actor(img, humanoid_enemy('guard', 572, floor_y, -1, 42), key, amb, '#fff4d8', 0.9)
    grade_actor(img, hero(150, floor_y - 24, 1), key, amb, '#fff4d8', 1.0)
    # near the camera: a red marble column with gold at the left edge, a red velvet curtain with tassels at the right
    marble_column(img, 6, -20, H + 20, 22, 1.0, 51, '#8a2a2a')
    cur = mask([spoly((598, -10), (660, -10), (660, 270), (642, 236), (626, 130), (606, 30), n=4)])
    t = 0.3 + np.sin(XX / 2.4 + YY / 40) * 0.25 + (fbm(XX / 3, YY / 20, 2, 52) - 0.5) * 0.15
    ramp_fill(img, cur, t, make_ramp(C('#a01a28'), 7, hi_k=0.45), 1.0)
    gold_fill(img, cur & ~np.roll(cur, -2, 1), 1.0, 0.6)
    tie = mask([ell(632, 160, 12, 4, -20, 16)])
    gold_fill(img, tie & cur, 1.0, 0.55 + np.where(YY < 160, 0.2, 0))
    tas = mask([spoly((622, 162), (626, 162), (628, 182), (620, 182), n=2)])
    gold_fill(img, tas, 1.0, 0.5 + np.clip((624 - XX) / 4, -1, 1) * 0.2)
    motes(img, 120, (60, 100, 600, 300), C('#fff8e0'), 7, 0.6)
    grade(img, 1.18, 1.1, 0.5)
    bloom(img, 0.95, 5, 0.3)
    vignette(img, 0.22)
    hud(img)
    return img


SCENES = {'plains': plains4, 'mountains': mountains, 'city': city, 'castle': castle}


def build(only=None):
    for name, fn in SCENES.items():
        if only and name not in only:
            continue
        img = fn()
        big = framed(img, os.path.join(OUT, f'final_example_{name}.png'))
        ph = phone(big)
        ph.save(os.path.join(OUT, f'final_example_{name}_phone.png'))
        print('wrote', name)


def overview():
    """All five stages side by side (the swamp from final_swamp.py), labelled, for comparing the look."""
    from PIL import ImageDraw, ImageFont
    items = [('final_example_plains.png', 'Plains & Forest'), ('final_example_mountains.png', 'Caves & Mountains'),
             ('final_example_swamp_v2.png', 'Dark Forest & Swamps'), ('final_example_city.png', 'Enemy Kingdom'),
             ('final_example_castle.png', "King's Castle")]
    tw, th, pad, lab = 960, 540, 16, 40
    sheet = Image.new('RGB', (tw * 2 + pad * 3, (th + lab) * 3 + pad * 4), (16, 14, 20))
    try:
        font = ImageFont.truetype('DejaVuSans-Bold.ttf', 28)
    except OSError:
        font = ImageFont.load_default()
    dr = ImageDraw.Draw(sheet)
    for i, (fn, name) in enumerate(items):
        path = os.path.join(OUT, fn)
        if not os.path.exists(path):
            continue
        im = Image.open(path).convert('RGB').resize((tw, th), Image.LANCZOS)
        cx, cy = i % 2, i // 2
        x, y = pad + cx * (tw + pad), pad + cy * (th + lab + pad)
        if i == 4:
            x = (sheet.width - tw) // 2
        dr.text((x, y + 4), f'{["1", "2a", "2b", "3", "4"][i]}. {name}', fill=(232, 220, 190), font=font)
        sheet.paste(im, (x, y + lab))
    sheet.save(os.path.join(OUT, 'final_examples_all.png'))


if __name__ == '__main__':
    build(sys.argv[1:] or None)
    overview()
