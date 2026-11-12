"""ART13b Round 2: one test scene per stage in the chosen look (docs/art/style_choice.md).

The look (from the user's references, Dead Cells / Owlboy / the green misty dragon): pixel art at today's pixel size
(640 x 360 inside, shown at 3x), deep background layers fading into a coloured fog, big light shafts, glowing lights
and particles with bloom, one bold colour mood per stage, dark framing silhouettes, and characters with dark outlines,
a rim light and glowing eyes so they read against anything. Only writes docs/art/ and tools/out/.
Run: python3 tools/art/stage_test.py [stage]"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from art.style_test_sketch import catmull, taper, spoly, ell, cap, poly, fbm, vnoise, _blur, _dilate  # noqa: E402

W, H = 640, 360
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16
BAY = BAYER[(YY.astype(int)) % 4, (XX.astype(int)) % 4]


def C(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255


# ============================================================================================== canvas helpers

def mask(shapes):
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    for s in shapes:
        d.polygon([(x, y) for x, y in s[1]], fill=255)
    return np.asarray(im) > 127


def fill(img, m, col, a=1.0):
    col = np.asarray(col, np.float32)
    if np.ndim(a) == 0:
        img[m] = img[m] * (1 - a) + col * a
    else:
        aa = (a * m)[..., None]
        img[:] = img * (1 - aa) + col * aa


def gradient(stops, steps=10):
    """A vertical sky in flat bands with dithered borders (pixel-art skies)."""
    ys = np.array([s[0] for s in stops], np.float32)
    t = np.clip(YY / H, 0, 1)
    tq = np.floor(t * steps + BAY) / steps
    out = np.zeros((H, W, 3), np.float32)
    for c in range(3):
        out[..., c] = np.interp(tq, ys, [C(s[1])[c] for s in stops])
    return out


def glow(img, x, y, r, col, k=1.0, p=2.0):
    d = np.hypot(XX - x, YY - y)
    g = np.clip(1 - d / r, 0, 1) ** p * k
    img += np.asarray(col, np.float32) * g[..., None]


def shafts(img, beams, col, slope=0.55, alpha=0.22):
    """Big soft light shafts falling at an angle, in three alpha steps with dithered edges."""
    acc = np.zeros((H, W), np.float32)
    for (x, wd, k) in beams:
        xb = x + (YY * slope)
        acc += np.clip(1 - np.abs(XX - xb) / wd, 0, 1) * k
    acc = np.clip(acc, 0, 1)
    q = np.floor(acc * 3 + BAY * 0.9) / 3
    img += np.asarray(col, np.float32) * (q * alpha)[..., None]


def motes(img, n, box, col, seed, glow_r=4, k=0.5):
    rng = np.random.default_rng(seed)
    x0, y0, x1, y1 = box
    for _ in range(n):
        x, y = int(rng.uniform(x0, x1)), int(rng.uniform(y0, y1))
        glow(img, x, y, glow_r, col, k * 0.6)
        if 0 <= x < W and 0 <= y < H:
            img[y, x] = np.minimum(1.2, np.asarray(col) * 1.2 + 0.25)


def sil(img, shapes, col, rim=None, rim_dir=(1, -1), tex=0.0, seed=0, dark=None):
    """A flat background silhouette, a 1 px rim of light on the side facing the light, optional 2-tone texture."""
    m = mask(shapes)
    fill(img, m, col)
    if tex:
        n = fbm(XX / 14, YY / 10, 3, seed)
        tm = m & (n + (BAY - 0.5) * 0.18 > 0.62)
        fill(img, tm, np.asarray(col) * 0.82 + (np.asarray(dark) * 0.18 if dark is not None else 0))
        tl = m & (n + (BAY - 0.5) * 0.18 < 0.34)
        fill(img, tl, np.asarray(col) * 1.08)
    if rim is not None:
        dx, dy = rim_dir
        nb = np.roll(np.roll(m, -dy, 0), -dx, 1)
        e = m & ~nb
        fill(img, e, rim, 0.85)
    return m


def fog(img, m, col, a):
    fill(img, m, col, a)


def ridge(x0, x1, base, amp, scale, seed, sharp=1.4, step=2):
    xs = np.arange(x0, x1 + step, step, dtype=np.float32)
    r = np.zeros_like(xs)
    a, f = 1.0, 1.0
    for o in range(4):
        r += a * (1 - np.abs(vnoise(xs / scale * f, np.full_like(xs, seed + o * 3.1), seed + o) * 2 - 1))
        a, f = a * 0.5, f * 2.1
    ys = base - amp * (r / 1.9) ** sharp
    pts = [(x0, H + 2)] + list(zip(xs.tolist(), ys.tolist())) + [(x1, H + 2)]
    return ('poly', tuple(pts))


def tree(x, base, h, w, lean=0.0, crown=None, roots=True, seed=0):
    """A big tree: trunk, flaring roots, a few branches, a crown of blobs. Returns a shape list."""
    rng = np.random.default_rng(seed)
    S = [taper([(x, base), (x + lean * h * 0.4, base - h * 0.5), (x + lean * h, base - h)], w, w * 0.45, 6)]
    if roots:
        for k in (-1, 1):
            S.append(taper([(x + k * w * 0.2, base - w * 0.6), (x + k * w * 0.9, base - w * 0.15), (x + k * w * 1.4, base + 2)],
                           w * 0.35, 2, 4))
    for k in range(3):
        y = base - h * (0.45 + k * 0.18)
        s = -1 if k % 2 else 1
        bx = x + lean * h * (0.45 + k * 0.18)
        S.append(taper([(bx, y), (bx + s * w * 1.2, y - w * 0.6), (bx + s * w * 2.2, y - w * 1.4)], w * 0.3, 2, 4))
    if crown:
        cx, cy = x + lean * h, base - h
        for _ in range(crown):
            S.append(ell(cx + rng.uniform(-w * 2.6, w * 2.6), cy + rng.uniform(-w * 1.2, w * 0.8),
                         rng.uniform(w * 1.0, w * 1.9), rng.uniform(w * 0.7, w * 1.2), 0, 16))
    return S


def vines(img, x0, x1, ytop, col, seed, n=14, maxlen=60, leaf=None):
    rng = np.random.default_rng(seed)
    for _ in range(n):
        x = int(rng.uniform(x0, x1))
        ln = int(rng.uniform(10, maxlen))
        y = int(ytop(x)) if callable(ytop) else int(ytop)
        for k in range(ln):
            xx = int(x + 1.5 * math.sin((y + k) / 9 + x))
            if 0 <= xx < W and 0 <= y + k < H:
                img[y + k, xx] = col
                if leaf is not None and k % 5 == 2 and xx + 1 < W:
                    img[y + k, xx + 1] = leaf


def grass(img, y_of_x, x0, x1, col, tip, seed, dens=0.6):
    rng = np.random.default_rng(seed)
    for x in range(int(x0), int(x1)):
        if rng.random() > dens:
            continue
        y = int(y_of_x(x))
        hgt = int(rng.integers(2, 6))
        for k in range(hgt):
            if 0 <= y - k < H:
                img[y - k, x] = tip if k == hgt - 1 else col


# ============================================================================================== characters

def humanoid(x, fy, h, face, col, pose='stand', extras=()):
    """A humanoid figure facing `face` (+1 right), feet at (x, fy), about h px tall. col: role -> hex."""
    u = h / 32

    def T(p):
        return (x + face * p[0] * u, fy + p[1] * u)

    def tp(sh):
        return ('poly', tuple(T(p) for p in sh[1]))
    P = []
    if pose == 'jump':
        legs = [((-1, -12), (-5.5, -7.5), (-3.5, -2.5)), ((1, -12), (6.5, -12), (6, -5.5))]
        arms = [((-0.5, -20), (4.5, -16.5), (10, -15.5)), ((1.6, -20), (7, -17.5), (11, -15.5))]
    elif pose == 'aim':
        legs = [((-1, -12), (-3, -6), (-4.5, -1)), ((1, -12), (3, -6), (4.5, -1))]
        arms = [((-0.5, -20), (5, -19), (10, -19)), ((1.6, -20), (5, -18), (6, -17))]
    elif pose == 'walk':
        legs = [((-1, -12), (-3.5, -6.5), (-5, -1)), ((1, -12), (3.5, -6), (3, -1))]
        arms = [((-0.5, -20), (-2.5, -15.5), (-2, -11.5)), ((1.6, -20), (5, -16), (8, -14))]
    else:
        legs = [((-1, -12), (-1.6, -6), (-2.2, -1)), ((1, -12), (1.8, -6), (2.4, -1))]
        arms = [((-0.5, -20), (-1.6, -15.5), (-1.2, -11.2)), ((1.6, -20), (3.2, -15.5), (4.2, -11.5))]
    lb, lf = legs
    ab, af = arms
    P += [(col['legs_dk'], tp(cap(lb[0], lb[1], 4.2))), (col['legs_dk'], tp(cap(lb[1], lb[2], 3.6))),
          (col['boot'], tp(ell(lb[2][0] - 0.4, lb[2][1] - 0.6, 2.6, 1.6)))]
    if 'cape' in col:
        P.append((col['cape'], tp(spoly((-1.5, -21), (-7, -16), (-8.5, -6), (-2, -9), n=3))))
    if 'scarf' in col:
        P.append((col['scarf'], tp(spoly((-1, -21), (-8, -24.5), (-14, -23), (-10, -20.5), (-2, -19), n=4))))
    P += [(col['arm_dk'], tp(cap(ab[0], ab[1], 3.2))), (col['hand'], tp(cap(ab[1], ab[2], 3))), (col['hand'], tp(ell(*ab[2], 1.8, 1.8)))]
    P += [(col['torso'], tp(spoly((-4.6, -21.6), (0, -22.4), (4.4, -21.2), (4.8, -16), (4.6, -11.2), (0, -10.6), (-4.2, -11), (-4.8, -16), n=3)))]
    if 'belt' in col:
        P.append((col['belt'], tp(poly((-4.4, -12.8), (4.6, -13), (4.6, -11.2), (-4.3, -11)))))
    if 'skirt' in col:
        P.append((col['skirt'], tp(spoly((-5, -13), (5, -13), (6.5, -5), (-6, -5), n=2))))
    P += [(col['legs'], tp(cap(lf[0], lf[1], 4.4))), (col['legs'], tp(cap(lf[1], lf[2], 3.8))),
          (col['boot'], tp(ell(lf[2][0] + 0.6, lf[2][1] - 0.6, 2.8, 1.7)))]
    P += [(col['head'], tp(ell(1.6, -26, 4.2, 4.6)))]
    if 'hair' in col:
        P.append((col['hair'], tp(poly((-2.6, -23.6), (-3.8, -30), (-1.2, -28.8), (-0.4, -32.4), (1.8, -29.4), (4.4, -31.4),
                                       (5.4, -28.4), (6.6, -27.2), (3.4, -27.4), (1, -26.2), (0.4, -23)))))
    for e in extras:
        P += [(c, tp(s)) for c, s in e]
    eye = col.get('eye', '#1a1420')
    P.append((eye, tp(ell(4.4, -25.8, 0.8, 0.9))))
    if 'scarf' in col:
        P.append((col['scarf'], tp(poly((-3.6, -21.8), (3.8, -21.6), (4, -19.8), (-3.4, -19.6)))))
    P += [(col['arm'], tp(cap(af[0], af[1], 3.4))), (col['hand'], tp(cap(af[1], af[2], 3))), (col['hand'], tp(ell(*af[2], 1.9, 1.9)))]
    return P, T


def hero(x, fy, face=1, pose='jump'):
    col = {'legs': '#3d5ea8', 'legs_dk': '#2c4480', 'boot': '#4e3424', 'arm': '#3d5ea8', 'arm_dk': '#2c4480',
           'hand': '#ecb48a', 'torso': '#8a5532', 'belt': '#3e281c', 'head': '#ecb48a', 'hair': '#6e4428',
           'scarf': '#40d2f2', 'eye': '#14101c'}
    P, T = humanoid(x, fy, 44, face, col, pose)
    # the Greatsword, raised and swinging
    hx, hy = 11.2, -15.2
    ang = math.radians(-58 if pose == 'jump' else -30)
    ux, uy = math.cos(ang), math.sin(ang)
    px, py = -uy, ux

    def at(a, n):
        return (hx + ux * a + px * n, hy + uy * a + py * n)
    sw = [('#5a3824', cap(at(-4, 0), at(1, 0), 1.6)), ('#e6be4a', ell(*at(-4.6, 0), 1.3, 1.3)),
          ('#e6be4a', poly(at(1, -3.4), at(2.4, -3.4), at(2.4, 3.4), at(1, 3.4))),
          ('#c6d0e0', poly(at(2.4, -1.7), at(18, -1.5), at(21, 0), at(18, 1.5), at(2.4, 1.7)))]
    P += [(c, ('poly', tuple(T(p) for p in s[1]))) for c, s in sw]
    return P


def humanoid_enemy(kind, x, fy, face=-1, h=40):
    if kind == 'archer':
        col = {'legs': '#5a3a2a', 'legs_dk': '#40281e', 'boot': '#2e2018', 'arm': '#a8443a', 'arm_dk': '#7c3028',
               'hand': '#d8a888', 'torso': '#a8443a', 'belt': '#2e2018', 'head': '#d8a888', 'cape': '#6e2224', 'eye': '#ffd060'}
        hood = [('#6e2224', spoly((-3, -30), (3.6, -30.2), (5.4, -24), (4.4, -20.6), (1.6, -22.4), (1.4, -27), (-3.2, -27.4), n=3))]
        bow = [('#9a6438', taper([(13, -27), (16, -19), (13, -11)], 1.6, 1.6)), ('#e8e0c8', cap((13, -27), (6, -19), 0.5)),
               ('#e8e0c8', cap((6, -19), (13, -11), 0.5)), ('#b07848', cap((4, -19), (18, -19), 0.7))]
        return humanoid(x, fy, h, face, col, 'aim', [hood, bow])[0]
    if kind == 'goblin':
        col = {'legs': '#4a3a2a', 'legs_dk': '#3a2c20', 'boot': '#2a2018', 'arm': '#6aa048', 'arm_dk': '#4e7c36',
               'hand': '#6aa048', 'torso': '#7a5a3a', 'belt': '#2a2018', 'head': '#6aa048', 'eye': '#ffe070'}
        helm = [('#9a8a5a', spoly((-3.6, -27), (-3, -31), (2, -32.4), (5.6, -30), (6, -27.4), n=3)),
                ('#fff4c0', ell(5.6, -29.4, 1.4, 1.2)), ('#6aa048', poly((-3.6, -26), (-8, -28), (-3.4, -24)))]
        pick = [('#6a4a2a', cap((4, -12), (12, -30), 1.4)), ('#a8b0c0', taper([(6, -32), (12, -31), (17, -27)], 2.4, 0.8))]
        return humanoid(x, fy, h * 0.75, face, col, 'walk', [helm, pick])[0]
    if kind == 'witch':
        col = {'legs': '#2a2236', 'legs_dk': '#201a2a', 'boot': '#1a1420', 'arm': '#3a2c4e', 'arm_dk': '#2a2036',
               'hand': '#8ab878', 'torso': '#3a2c4e', 'head': '#8ab878', 'skirt': '#2e2440', 'eye': '#c0ff60'}
        hat = [('#2a2036', spoly((-6, -28), (8, -28), (4, -31), (1, -38), (-4, -43), (-2, -36), (-3, -31), n=3)),
               ('#2a2036', ell(1, -28.4, 7.6, 1.4))]
        staff = [('#4a3424', cap((8, -1), (10, -36), 1.4)), ('#a0ff70', ell(10.4, -37.6, 2.4, 2.4))]
        return humanoid(x, fy, h, face, col, 'stand', [hat, staff])[0]
    if kind == 'soldier':
        col = {'legs': '#4a4a5a', 'legs_dk': '#3a3a48', 'boot': '#2a2a30', 'arm': '#8a92a8', 'arm_dk': '#6a7288',
               'hand': '#6a7288', 'torso': '#a83030', 'belt': '#2e2420', 'head': '#d8a888', 'eye': '#1a1420'}
        helm = [('#9aa2b8', spoly((-4.4, -24), (-4.6, -28.4), (-1, -31.4), (4, -31), (6, -28), (6, -25), n=3)),
                ('#9aa2b8', ell(1, -28, 7.4, 1.2))]
        spear = [('#6a4a2a', cap((6, -2), (9, -44), 1.2)), ('#c8d0e0', poly((8, -44), (10.4, -44), (9.6, -50)))]
        shield = [('#a83030', spoly((-1, -22), (9, -22), (9, -12), (4, -8), (-1, -12), n=2)), ('#e8c050', ell(4, -16, 1.6, 1.6))]
        return humanoid(x, fy, h, face, col, 'stand', [helm, spear, shield])[0]
    if kind == 'crossbow':
        col = {'legs': '#4a3a30', 'legs_dk': '#3a2c24', 'boot': '#2a2018', 'arm': '#5a6a3a', 'arm_dk': '#44522c',
               'hand': '#d8a888', 'torso': '#5a6a3a', 'belt': '#2e2420', 'head': '#d8a888', 'eye': '#1a1420'}
        cap_ = [('#3a4428', spoly((-4.4, -25), (-3, -30.6), (3, -31), (6.4, -27), (6, -25), n=3))]
        xb = [('#6a4a2a', cap((4, -19), (16, -19), 1.6)), ('#8a92a8', taper([(13, -24), (15, -19), (13, -14)], 1.4, 1.4))]
        return humanoid(x, fy, h, face, col, 'aim', [cap_, xb])[0]
    if kind == 'guard':
        col = {'legs': '#3a2a4a', 'legs_dk': '#2a1e36', 'boot': '#1e1626', 'arm': '#c8a040', 'arm_dk': '#9a7a30',
               'hand': '#9a7a30', 'torso': '#c8a040', 'belt': '#6a1a2a', 'head': '#c8a040', 'skirt': '#6a1a2a', 'eye': '#ff5040'}
        helm = [('#c8a040', spoly((-4.6, -22), (-5, -28.6), (-1, -32), (4, -31.4), (6.4, -28), (6.2, -22.4), n=3)),
                ('#1a1420', poly((1, -27), (6.4, -27), (6.4, -25.6), (1, -25.6))), ('#d8303a', spoly((-1, -32), (-3, -38), (-8, -36), (-7, -31), n=2))]
        halb = [('#4a3424', cap((7, -1), (9, -52), 1.4)), ('#c8d0e0', spoly((9, -52), (14, -48), (15, -42), (9, -44), n=2)),
                ('#c8d0e0', poly((8.4, -52), (9.6, -52), (9, -57)))]
        return humanoid(x, fy, h * 1.12, face, col, 'stand', [helm, halb])[0]
    raise ValueError(kind)


def quadruped(kind, x, fy, face=-1, s=1.0, leap=False):
    """Wolf, ram or boar: body, head, legs, tail. Returns parts."""
    def T(p):
        return (x + face * p[0] * s, fy + p[1] * s)

    def tp(sh):
        return ('poly', tuple(T(p) for p in sh[1]))
    if kind == 'wolf':
        fur, dk, belly, eye = '#7a86a8', '#545e7c', '#c0c6d6', '#ffd24a'
    elif kind == 'ram':
        fur, dk, belly, eye = '#e6dcc4', '#b4a88c', '#f4ecd8', '#ffb040'
    else:
        fur, dk, belly, eye = '#5a3a30', '#40281e', '#7a5a46', '#ff4030'
    P = []
    lift = -6 if leap else 0
    P += [(dk, tp(taper([(10, -12 + lift), (19, -17 + lift * 1.4), (22, -14 + lift)], 4, 1)))] if kind == 'wolf' else []
    legs_b = [((8, -9 + lift), (13, -4 + lift / 2), (16, -1 + lift / 3)), ((-6, -10 + lift), (-12, -6 + lift), (-17, -5 + lift))] if leap \
        else [((7, -9), (8, -4), (8.6, 0)), ((-6, -9), (-6.5, -4), (-7, 0))]
    for (a, b, c) in legs_b:
        P += [(dk, tp(cap(a, b, 3))), (dk, tp(cap(b, c, 2.4)))]
    body_r = (11, 5.6) if kind == 'wolf' else ((12, 7.4) if kind == 'ram' else (14, 8))
    P += [(fur, tp(ell(0, -11 + lift, *body_r, -8 if leap else 0, 20))), (belly, tp(ell(0, -8.6 + lift, body_r[0] * 0.7, 2.2, 0, 14)))]
    legs_f = [((5, -9 + lift), (10, -5 + lift / 2), (14, -2 + lift / 3)), ((-7, -11 + lift), (-14, -9 + lift), (-18, -9 + lift))] if leap \
        else [((5, -8), (5.6, -4), (6, 0)), ((-8, -8), (-8.6, -4), (-9, 0))]
    for (a, b, c) in legs_f:
        P += [(fur, tp(cap(a, b, 3.4))), (fur, tp(cap(b, c, 2.6)))]
    hy = -16 + lift if kind == 'wolf' else -14 + lift
    if kind == 'wolf':
        P += [(fur, tp(ell(-11, hy, 5, 4.2, -8, 16))), (fur, tp(poly((-14, hy - 2), (-21.5, hy - 1), (-22, hy + 1), (-14.5, hy + 3)))),
              (dk, tp(poly((-9, hy - 3.5), (-8, hy - 8.5), (-5.4, hy - 3))))]
    elif kind == 'ram':
        P += [(dk, tp(ell(-13, hy, 4.4, 4, -20, 14))), (dk, tp(poly((-15, hy), (-21, hy + 2), (-20, hy + 5), (-14, hy + 4))))]
        P += [('#c8b48a', tp(taper([(-11, hy - 3), (-7, hy - 8), (-3, hy - 6), (-4, hy - 1), (-8, hy)], 3.4, 1.4)))]
    else:
        P += [(fur, tp(ell(-14, hy + 2, 6, 5, 10, 16))), (dk, tp(poly((-18, hy + 1), (-24, hy + 3), (-23, hy + 7), (-17, hy + 6)))),
              ('#e8dcc0', tp(taper([(-20, hy + 6), (-23, hy + 2), (-22, hy - 1)], 1.6, 0.6)))]
    P += [(eye, tp(ell(-13 if kind != 'boar' else -16, hy - 1, 1.1, 0.8, 0, 10)))]
    return P


def spider(x, y, s=1.0):
    P = [('#d8d8e0', cap((x, -10), (x, y - 8 * s), 0.6))]                  # the silk thread
    for k in range(4):
        for side in (-1, 1):
            a = (k - 1.5) * 0.45
            kx, ky = x + side * (6 + k) * s, y - (5 - k * 2) * s
            fx, fy = x + side * (12 + k * 1.5) * s, y + (5 + k * 2) * s
            P += [('#2a2234', cap((x + side * 2 * s, y), (kx, ky - 4 * s), 1.6 * s)), ('#2a2234', cap((kx, ky - 4 * s), (fx, fy), 1.3 * s))]
    P += [('#3a2e4a', ell(x, y + 6 * s, 7 * s, 8 * s, 0, 18)), ('#4a3a5e', ell(x, y - 3 * s, 4.6 * s, 4 * s, 0, 14))]
    P += [('#d02a60', ell(x, y + 7 * s, 2.4 * s, 4 * s, 0, 10))]
    for dx in (-2, -0.7, 0.7, 2):
        P.append(('#ff5050', ell(x + dx * s, y - 4 * s, 0.7 * s, 0.7 * s, 0, 8)))
    return P


def cannon(x, fy, face=-1):
    def T(p):
        return (x + face * p[0], fy + p[1])
    return [('#3a2a20', ('poly', tuple(T(p) for p in ((-10, -2), (8, -2), (6, -9), (-8, -9))))),
            ('#4a4e5a', ('poly', tuple(T(p) for p in taper([(6, -12), (-6, -14), (-20, -17)], 10, 7)[1]))),
            ('#2a2a30', ('poly', tuple(T(p) for p in ell(-20, -17, 2.6, 3.4, 0, 10)[1]))),
            ('#5a3a28', ('poly', tuple(T(p) for p in ell(-4, -3, 4, 4, 0, 12)[1]))),
            ('#5a3a28', ('poly', tuple(T(p) for p in ell(6, -3, 4, 4, 0, 12)[1])))]


def actor(img, parts, key, amb, points=(), rim=None, steps=4, outline='#0e0a14', glow_hex=None, flash=None):
    """Draw a character: per-part normals, quantised light (key + ambient + point lights), rim light, 1 px outline."""
    xs = [p[0] for _c, s in parts for p in s[1]]
    ys = [p[1] for _c, s in parts for p in s[1]]
    x0, y0 = max(0, int(min(xs)) - 4), max(0, int(min(ys)) - 4)
    x1, y1 = min(W, int(max(xs)) + 5), min(H, int(max(ys)) + 5)
    if x1 <= x0 or y1 <= y0:
        return
    w, h = x1 - x0, y1 - y0
    ids = np.full((h, w), -1, np.int16)
    NX = np.zeros((h, w), np.float32)
    NY = np.zeros((h, w), np.float32)
    cols = []
    for c, s in parts:
        im = Image.new('L', (w, h), 0)
        ImageDraw.Draw(im).polygon([(px - x0, py - y0) for px, py in s[1]], fill=255)
        m = np.asarray(im) > 127
        if not m.any():
            continue
        yy, xx = np.nonzero(m)
        sz = min(yy.max() - yy.min() + 1, xx.max() - xx.min() + 1)
        b = _blur(m.astype(np.float32), float(np.clip(sz * 0.3, 0.8, 5)))
        gy, gx = np.gradient(b)
        k = float(np.clip(sz * 0.3, 0.8, 5)) * 2.4
        nx, ny = -gx * k, -gy * k
        ln = np.maximum(np.hypot(nx, ny), 1)
        cols.append(c)
        ids[m] = len(cols) - 1
        NX[m], NY[m] = (nx / ln)[m], (ny / ln)[m]
    occ = ids >= 0
    nz = np.sqrt(np.clip(1 - NX ** 2 - NY ** 2, 0, 1))
    kd = np.array(key['dir'], np.float32)
    kd = kd / np.linalg.norm(kd)
    diff = np.clip(NX * kd[0] + NY * kd[1] + nz * kd[2], 0, 1)
    L = np.asarray(amb, np.float32)[None, None] + np.asarray(key['col'], np.float32)[None, None] * diff[..., None]
    Xl, Yl = XX[y0:y1, x0:x1], YY[y0:y1, x0:x1]
    for (px, py, r, pc, pk) in points:
        vx, vy = px - Xl, py - Yl
        d = np.hypot(vx, vy) + 1e-3
        f = np.clip((NX * vx + NY * vy) / d * 0.7 + nz * 0.5, 0, 1) * np.clip(1 - d / r, 0, 1) ** 1.5 * pk
        L = L + np.asarray(pc, np.float32)[None, None] * f[..., None]
    rgb = np.zeros((h, w, 3), np.float32)
    for i, c in enumerate(cols):
        m = ids == i
        alb = C(c)
        if c in ('#ffd24a', '#ff5050', '#ffe070', '#c0ff60', '#a0ff70', '#ffd060', '#fff4c0', '#ff4030', '#ffb040', '#ff5040'):
            rgb[m] = np.minimum(1.0, alb * 1.15)                         # glowing eyes and lights
            continue
        lum = L.mean(axis=2)
        q = np.clip(np.round(lum / 1.3 * steps + (BAY[y0:y1, x0:x1] - 0.5) * 0.35), 1, steps) / steps * 1.3
        shade = L / (lum[..., None] + 1e-4) * q[..., None]
        dark = np.clip(1 - q / 0.55, 0, 1)[..., None]
        col = alb * shade * (1 - 0.3 * dark) + C(outline) * 0.6 * dark * 0.3 + np.asarray(amb) * 0.15 * dark
        rgb[m] = col[m]
    if rim is not None:                                               # rim light on the edge facing the main light
        dx = 1 if kd[0] > 0 else -1
        nb = np.roll(occ, -dx, 1)
        e = occ & ~nb
        up = occ & ~np.roll(occ, 1, 0)
        rgb[e] = rgb[e] * 0.35 + C(rim) * 0.75
        rgb[up & ~e] = rgb[up & ~e] * 0.6 + C(rim) * 0.45
    if flash is not None:                                             # the orange attack telegraph
        rgb[occ] = rgb[occ] * 0.45 + C(flash) * 0.6
    ring = _dilate(occ, 1) & ~occ
    rgb[ring] = C(outline if flash is None else '#ff7a1a')
    a = (occ | ring)
    sub = img[y0:y1, x0:x1]
    sub[a] = rgb[a]
    if glow_hex:
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        glow(img, cx, cy, max(w, h) * 0.9, C(glow_hex), 0.35)


def hud(img):
    """The pixel HUD: hearts and flasks top-left, weapon and two abilities top-right."""
    def box(x0, y0, x1, y1, c, edge='#c8a868'):
        img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * 0.25 + C(c) * 0.75
        img[y0, x0:x1] = img[y1 - 1, x0:x1] = C(edge)
        img[y0:y1, x0] = img[y0:y1, x1 - 1] = C(edge)
    box(8, 8, 190, 40, '#120e1a')
    img[13:22, 30:182] = C('#3c1420')
    img[13:22, 30:140] = C('#e0404a')
    img[13, 30:140] = C('#ff8a90')
    for (x, y) in ((14, 14), (19, 14), (13, 17), (20, 17), (15, 20), (18, 20), (16, 22), (17, 22)):
        pass
    m = mask([spoly((16, 21), (12, 16), (13, 12.5), (16.5, 14), (20, 12.5), (21, 16), n=3)])
    fill(img, m, C('#e0404a'))
    for i in range(3):
        mm = mask([ell(34 + i * 12, 31, 4, 4, 0, 12)])
        fill(img, mm, C('#f07090') if i < 2 else C('#3a2a3a'))
        img[25:28, 33 + i * 12:36 + i * 12] = C('#d8dce8')
    for i, x in enumerate((560, 586, 612)):
        box(x - 2, 8, x + 22, 32, '#120e1a')
    fill(img, mask([poly((562, 28), (576, 13), (578, 15), (564, 30))]), C('#d8e0ec'))
    fill(img, mask([poly((561, 25), (564, 28), (566, 26), (563, 23))]), C('#e6be4a'))
    fill(img, mask([poly((596, 29), (591, 20), (596, 11), (601, 20))]), C('#ff8a30'))
    fill(img, mask([poly((614, 14), (630, 14), (626, 19), (630, 25), (614, 25), (618, 19))]), C('#5ad8fa'))


# ============================================================================================== the five scenes

LIGHT_WARM = {'dir': (0.7, -0.5, 0.5), 'col': (1.05, 0.9, 0.62)}


def plains():
    """Stage 1, Plains & Forest: a meadow at the forest edge in the morning, a Wolf pack, a Bandit Archer, the Great
    Boar's den in the hillside behind."""
    img = gradient([(0, '#7ec2e8'), (0.45, '#cfe6c4'), (0.7, '#f6e6a8'), (1, '#f6e6a8')])
    glow(img, 470, 70, 260, C('#fff2b8'), 0.55, 1.6)
    # clouds
    for (cx, cy, s) in ((120, 60, 1.0), (360, 40, 0.8), (560, 90, 0.6)):
        sil(img, [ell(cx + dx * s, cy + dy * s, rx * s, ry * s, 0, 18) for dx, dy, rx, ry in
                  ((-26, 4, 20, 10), (0, -4, 26, 16), (26, 4, 20, 10), (0, 8, 44, 7))], C('#ffffff'), rim=C('#fff8d8'))
    # far hills and forest, three layers fading into the morning haze
    fogc = C('#d8ecd0')
    for i, (base, amp, sc, sd, col) in enumerate(((210, 60, 140, 3, '#9cc4a8'), (238, 48, 90, 7, '#78ac80'), (262, 30, 60, 11, '#5a9466'))):
        m = sil(img, [ridge(-4, W + 4, base, amp, sc, sd, 1.0)], C(col) * (1 - 0.35 * (2 - i) / 2) + fogc * 0.35 * (2 - i) / 2,
                rim=C('#e8f4c8'), rim_dir=(1, -1))
        rng = np.random.default_rng(sd)
        for k in range(7 + i * 4):
            x = rng.uniform(-20, W + 20)
            th = rng.uniform(40, 90) * (0.6 + 0.3 * i)
            tw = rng.uniform(3, 6) * (0.7 + 0.3 * i)
            cc = C(col) * (1 - 0.35 * (2 - i) / 2) + fogc * 0.35 * (2 - i) / 2
            sil(img, tree(x, base, th, tw, rng.uniform(-0.08, 0.08), crown=6, roots=False, seed=k + sd), cc * 0.9,
                rim=C('#eef6c8'), rim_dir=(1, -1))
    # the Great Boar's den: a dark cave mouth in the hillside, bones, two red eyes
    den = sil(img, [spoly((392, 262), (408, 222), (440, 206), (476, 214), (496, 246), (500, 266), n=5)], C('#4e6e4a'), rim=C('#c8e0a0'))
    sil(img, [spoly((416, 266), (424, 236), (446, 226), (468, 232), (480, 266), n=4)], C('#16120e'))
    for (ex, ey) in ((440, 248), (452, 248)):
        img[ey, ex] = C('#ff3a2a')
        glow(img, ex, ey, 6, C('#ff3a2a'), 0.5)
    for (bx, by) in ((404, 268), (488, 268)):
        fill(img, mask([cap((bx - 6, by), (bx + 6, by - 2), 2.4)]), C('#efe6cc'))
    # light shafts from the morning sun through the forest edge
    shafts(img, [(380, 26, 0.9), (300, 14, 0.6), (520, 34, 0.8), (200, 18, 0.5)], C('#fff6c8'), slope=-0.45, alpha=0.26)
    # foreground forest edge: big dark trees left and right framing the meadow
    for (x, h, w, lean, sd) in ((40, 300, 18, 0.05, 1), (600, 320, 20, -0.04, 2)):
        sil(img, tree(x, 300, h, w, lean, crown=10, seed=sd), C('#1e3020'), rim=C('#c8e090'), rim_dir=(1 if x < 300 else -1, -1),
            tex=1.0, seed=sd, dark=C('#0e1810'))
    canopy = [ell(x, rng_y, rx, ry, 0, 18) for x, rng_y, rx, ry in
              ((20, 10, 90, 40), (120, -6, 70, 30), (240, -14, 80, 26), (380, -16, 70, 24), (500, -8, 80, 30), (620, 12, 90, 44))]
    sil(img, canopy, C('#1a2c1a'), rim=C('#b8e080'), rim_dir=(0, 1), tex=1.0, seed=12, dark=C('#0c160c'))
    vines(img, 0, 640, lambda x: 20, C('#2a4426'), 13, 26, 60, C('#5a8a3a'))
    vines(img, 0, 120, 30, C('#2e4a28'), 3, 10, 70, C('#5a8a3a'))
    vines(img, 540, 640, 26, C('#2e4a28'), 4, 10, 70, C('#5a8a3a'))
    # the playfield: grass ground and a raised meadow ledge
    gy = lambda x: 300 - 6 * math.sin(x / 70) if x < 430 else 280
    ground = [('poly', tuple([(x, gy(x)) for x in range(-2, 430, 4)] + [(430, 280), (642, 280), (642, 362), (-2, 362)]))]
    sil(img, ground, C('#3a2a1e'), tex=1.0, seed=5, dark=C('#1a120c'))
    top = [('poly', tuple([(x, gy(x) - 1) for x in range(-2, 430, 4)] + [(430, 279), (642, 279), (642, 288)] +
                          [(x, gy(x) + 7) for x in range(430, -4, -4)]))]
    sil(img, top, C('#5aa03a'), rim=C('#c8f07a'), rim_dir=(0, -1))
    grass(img, lambda x: gy(x) - 1 if x < 430 else 279, 0, 640, C('#4a8a30'), C('#a8e060'), 9)
    for (x, y, c) in ((90, 296, '#ffe070'), (150, 300, '#ffffff'), (250, 295, '#ff9ab0'), (480, 279, '#ffe070'), (560, 279, '#ffffff')):
        img[y - 3, x] = C(c)
    # characters
    amb = (0.42, 0.46, 0.5)
    pts = [(470, 70, 900, (0.4, 0.35, 0.2), 0.4)]
    actor(img, humanoid_enemy('archer', 560, 279, -1), LIGHT_WARM, amb, pts, rim='#fff6c8')
    actor(img, quadruped('wolf', 330, 302, -1, 1.25), LIGHT_WARM, amb, pts, rim='#fff6c8')
    actor(img, quadruped('wolf', 380, 300, -1, 1.25), LIGHT_WARM, amb, pts, rim='#fff6c8')
    actor(img, quadruped('wolf', 248, 280, -1, 1.3, leap=True), LIGHT_WARM, amb, pts, rim='#fff6c8', flash='#ff8a2a')
    actor(img, hero(176, 262, 1), LIGHT_WARM, amb, pts, rim='#fff6c8')
    motes(img, 30, (0, 60, 640, 300), C('#fff6c8'), 7, 3, 0.4)
    # a framing leaf cluster in the near foreground corner
    sil(img, [ell(-10, 352, 60, 26, 0, 20), ell(40, 360, 40, 16, 0, 16)], C('#0e1a0e'))
    return img


def mountains():
    """Stage 2, Caves & Mountains: the icy climb at dusk, a falling-rock warning, a Ram and a Goblin Miner, the cave
    labyrinth's torches."""
    img = gradient([(0, '#1a2650'), (0.5, '#4a6aa8'), (0.8, '#a8c8e8'), (1, '#c8dcf0')])
    glow(img, 140, 60, 180, C('#c8e4ff'), 0.35)
    fogc = C('#a8c4e4')
    for i, (base, amp, sc, sd, col) in enumerate(((200, 150, 120, 3, '#5a74a8'), (250, 120, 80, 7, '#3e5488'), (300, 80, 60, 11, '#2a3a68'))):
        m = sil(img, [ridge(-4, W + 4, base, amp, sc, sd, 1.6)], C(col) * (1 - 0.3 * (2 - i) / 2) + fogc * 0.3 * (2 - i) / 2)
        top = m & ~np.roll(m, 4 + i * 2, 0)
        fill(img, top & (YY < base - amp * 0.3), C('#e8f4ff') * (0.9 - i * 0.08))
    # snow falling
    motes(img, 70, (0, 0, 640, 360), C('#e8f4ff'), 2, 2, 0.25)
    # the cave labyrinth mouth on the right with torches
    sil(img, [spoly((470, 360), (480, 230), (530, 190), (600, 186), (650, 220), (650, 360), n=5)], C('#1e2440'), rim=C('#8ab0e0'),
        rim_dir=(-1, -1), tex=1.0, seed=4, dark=C('#0e1020'))
    sil(img, [spoly((520, 360), (526, 262), (556, 238), (590, 246), (604, 290), (606, 360), n=4)], C('#0c0a10'))
    for tx in (512, 616):
        fill(img, mask([cap((tx, 290), (tx, 270), 2.4)]), C('#4a3020'))
        fill(img, mask([ell(tx, 266, 2.6, 4.2, 0, 10)]), C('#ffb040'))
        img[266, tx] = C('#fff2a0')
        glow(img, tx, 266, 46, C('#ff9a3a'), 0.5)
    shafts(img, [(60, 30, 0.5), (200, 22, 0.4)], C('#c8e4ff'), slope=0.3, alpha=0.16)
    # the icy climb: stepped ledges with ice
    ledges = [((-2, 310), (230, 310)), ((180, 262), (330, 262)), ((300, 220), (460, 220))]
    for (a, b) in ledges:
        y = a[1]
        sil(img, [spoly((a[0], y), (b[0], y), (b[0] + 6, y + 20), (b[0] - 10, H + 2), (a[0], H + 2), n=2)], C('#2a2e48'),
            tex=1.0, seed=y, dark=C('#141626'))
        sil(img, [poly((a[0], y - 3), (b[0], y - 3), (b[0] + 2, y + 3), (a[0], y + 3))], C('#c8e4f4'), rim=C('#ffffff'), rim_dir=(0, -1))
        for k in range(int(a[0]) + 6, int(b[0]) - 4, 14):                # icicles under the ledge edge
            fill(img, mask([poly((k, y + 3), (k + 4, y + 3), (k + 2, y + 10 + (k % 7)))]), C('#a8d4ec'))
    # falling-rock warning: a crack and dust at the cliff top, a red marker and a shadow on the ledge below
    fill(img, mask([spoly((380, 120), (394, 112), (406, 120), (402, 132), (386, 134), n=3)]), C('#4a4e6a'))
    for k in range(6):
        img[136 + k * 6:138 + k * 6, 392:394] = C('#b8c0d8')
    fill(img, mask([ell(394, 218, 14, 3, 0, 14)]), C('#141626'), 0.6)
    fill(img, mask([poly((390, 180), (398, 180), (396, 198), (392, 198))]), C('#ff4a3a'))
    fill(img, mask([ell(394, 203, 2.4, 2.4, 0, 8)]), C('#ff4a3a'))
    glow(img, 394, 192, 24, C('#ff4a3a'), 0.4)
    # characters
    key = {'dir': (-0.6, -0.5, 0.6), 'col': (0.6, 0.72, 0.95)}
    amb = (0.3, 0.34, 0.5)
    pts = [(512, 266, 140, (1.0, 0.6, 0.25), 0.9), (616, 266, 140, (1.0, 0.6, 0.25), 0.9)]
    actor(img, quadruped('ram', 410, 220, -1, 1.35), key, amb, pts, rim='#e8f4ff')
    gob = humanoid_enemy('goblin', 250, 262, -1, 40)
    actor(img, gob, key, amb, pts, rim='#e8f4ff')
    # the miner's head-lamp beam
    beam = mask([poly((242, 238), (190, 228), (190, 252))])
    fill(img, beam, C('#fff4c0'), 0.25)
    actor(img, hero(120, 290, 1), key, amb, pts, rim='#e8f4ff')
    sil(img, [spoly((-20, 360), (-10, 300), (30, 280), (50, 320), (60, 360), n=4)], C('#0a0c16'))
    return img


def swamps():
    """Stage 2, Dark Forest & Swamps: green fog over black water, a dark zone lit by fireflies, a Giant Spider hanging
    on its thread and a Swamp Witch on a stump."""
    img = gradient([(0, '#0e2420'), (0.5, '#2a5a48'), (1, '#4a8a6a')])
    fogc = C('#6ab08a')
    for i, (n, col, h0) in enumerate(((6, '#2e5e4a', 0.95), (5, '#1e4436', 0.95), (4, '#12302a', 1.0))):
        rng = np.random.default_rng(i + 3)
        for k in range(n):
            x = rng.uniform(0, W)
            sil(img, tree(x, 300, rng.uniform(220, 330) * h0, 10 + i * 5, rng.uniform(-0.08, 0.08), crown=0, seed=k + i * 10),
                C(col), rim=C('#8ad8a8') if i == 2 else None, rim_dir=(-1, -1))
        # a fog band in front of each layer
        f = np.clip(1 - np.abs(YY - (270 - i * 20)) / 60, 0, 1) * (0.3 - i * 0.06)
        img[:] = img * (1 - f[..., None]) + fogc * f[..., None]
    glow(img, 360, 220, 140, C('#9affc8'), 0.3)
    shafts(img, [(250, 20, 0.6), (420, 30, 0.6)], C('#b8ffd8'), slope=0.2, alpha=0.14)
    # hanging moss
    vines(img, 0, 640, 0, C('#2a5a3a'), 11, 36, 120, C('#4a8a5a'))
    # black water with a reflection band and lily pads
    water = YY > 300
    img[water] = img[water] * 0.25 + C('#0a1a18') * 0.75
    refl = water & (np.sin(XX / 5 + YY * 1.3) > 0.6)
    fill(img, refl, C('#2a6a52'), 0.5)
    for (x, y, r) in ((80, 324, 10), (210, 340, 14), (470, 330, 12), (580, 346, 10)):
        fill(img, mask([ell(x, y, r, r * 0.35, 0, 16)]), C('#2e6a3a'))
    # the dark zone on the left lit only by fireflies
    dz = np.clip(1 - np.hypot(XX - 90, YY - 200) / 160, 0, 1)
    img[:] = img * (1 - 0.6 * dz[..., None])
    rng = np.random.default_rng(5)
    for _ in range(26):
        fx, fy = rng.uniform(20, 200), rng.uniform(120, 290)
        glow(img, fx, fy, 14, C('#d8ff80'), 0.45)
        img[int(fy), int(fx)] = C('#f8ffc0')
    # boardwalk platform and a stump
    sil(img, [poly((-2, 296), (330, 296), (330, 304), (-2, 304))], C('#4a3a28'), rim=C('#a8d8a0'), rim_dir=(0, -1))
    for x in range(10, 330, 34):
        fill(img, mask([poly((x, 304), (x + 5, 304), (x + 5, 340), (x, 340))]), C('#2a2018'))
    sil(img, [spoly((430, 300), (438, 262), (470, 258), (480, 300), n=3)], C('#3a2e22'), rim=C('#a8d8a0'), rim_dir=(-1, -1))
    # characters
    key = {'dir': (0.2, -0.8, 0.5), 'col': (0.45, 0.75, 0.55)}
    amb = (0.18, 0.3, 0.26)
    pts = [(90, 200, 150, (0.8, 1.0, 0.5), 0.8), (460, 220, 120, (0.6, 1.0, 0.5), 0.7)]
    actor(img, humanoid_enemy('witch', 456, 260, -1, 40), key, amb, pts, rim='#b8ffd8', glow_hex='#a0ff70')
    glow(img, 466, 222, 30, C('#a0ff70'), 0.55)
    actor(img, spider(300, 170, 1.4), key, amb, pts, rim='#b8ffd8')
    actor(img, hero(170, 296, 1, 'walk'), key, amb, pts, rim='#d8ffe0')
    motes(img, 24, (220, 60, 640, 290), C('#b8ffd8'), 9, 3, 0.4)
    sil(img, [spoly((560, 362), (590, 300), (620, 250), (650, 240), (650, 362), n=4)], C('#06100c'))
    return img


def kingdom():
    """Stage 3, Enemy Kingdom: town streets and rooftops at sunset, Soldiers, a Crossbowman, a cannon, the castle in the
    distance."""
    img = gradient([(0, '#3a2a5a'), (0.4, '#a8506a'), (0.7, '#f0905a'), (1, '#ffc87a')])
    glow(img, 470, 250, 300, C('#ffc070'), 0.45, 1.6)
    fogc = C('#e88a6a')
    # the castle far away on a hill
    sil(img, [ridge(-4, W + 4, 250, 30, 120, 3, 1.0)], C('#7a4a6a'))
    cx = 470
    castle = [poly((cx - 60, 250), (cx - 60, 200), (cx + 60, 200), (cx + 60, 250))]
    for (tx, th, tw) in ((-50, 90, 14), (-10, 130, 18), (30, 100, 14), (55, 70, 10)):
        castle += [poly((cx + tx - tw / 2, 250), (cx + tx - tw / 2, 250 - th), (cx + tx + tw / 2, 250 - th), (cx + tx + tw / 2, 250)),
                   poly((cx + tx - tw / 2 - 3, 250 - th), (cx + tx, 250 - th - tw * 1.4), (cx + tx + tw / 2 + 3, 250 - th))]
    sil(img, castle, C('#6a3a5a') * 0.85 + fogc * 0.15)
    for (wx, wy) in ((cx - 10, 150), (cx - 10, 170), (cx + 30, 180), (cx - 50, 190)):
        img[wy:wy + 3, wx:wx + 2] = C('#ffd27a')
    # rooftops, two layers
    rng = np.random.default_rng(3)
    for i, (base, col) in enumerate(((250, '#5a2e46'), (276, '#3a1e30'))):
        x = -10
        while x < W:
            w_ = rng.uniform(40, 80)
            h_ = rng.uniform(30, 60) + i * 10
            house = [poly((x, H), (x, base - h_ * 0.4), (x + w_, base - h_ * 0.4), (x + w_, H)),
                     poly((x - 4, base - h_ * 0.4), (x + w_ / 2, base - h_), (x + w_ + 4, base - h_ * 0.4))]
            sil(img, house, C(col), rim=C('#ffb87a'), rim_dir=(1, -1))
            for k in range(int(rng.integers(1, 4))):
                wx, wy = int(x + 8 + k * 14), int(base - h_ * 0.3 + 6)
                if 0 <= wx < W - 4:
                    img[wy:wy + 5, wx:wx + 4] = C('#ffcf6a')
                    glow(img, wx + 2, wy + 2, 10, C('#ffb040'), 0.25)
            x += w_ + rng.uniform(4, 16)
    shafts(img, [(300, 30, 0.6), (420, 40, 0.5)], C('#ffd8a0'), slope=-0.6, alpha=0.16)
    # the street and a rooftop ledge on the right
    sil(img, [poly((-2, 312), (642, 312), (642, 362), (-2, 362))], C('#2a1a24'), tex=1.0, seed=8, dark=C('#140c12'))
    for x in range(0, 640, 16):
        img[312:314, x:x + 14] = C('#6a4a4a')
    sil(img, [poly((470, 230), (642, 230), (642, 312), (470, 312))], C('#3e2232'), tex=1.0, seed=9, dark=C('#1e1018'))
    sil(img, [poly((462, 222), (642, 222), (642, 232), (462, 232))], C('#8a3a3a'), rim=C('#ffb87a'), rim_dir=(0, -1))
    # banners on a pole
    for bx in (140, 380):
        fill(img, mask([cap((bx, 312), (bx, 200), 2)]), C('#2a1a20'))
        fill(img, mask([poly((bx + 1, 204), (bx + 18, 206), (bx + 16, 236), (bx + 9, 230), (bx + 1, 238))]), C('#a8283a'))
        img[214:216, bx + 6:bx + 12] = C('#e8c050')
    key = {'dir': (0.7, -0.4, 0.55), 'col': (1.05, 0.72, 0.48)}
    amb = (0.34, 0.24, 0.36)
    pts = [(470, 250, 600, (0.6, 0.35, 0.15), 0.4)]
    actor(img, humanoid_enemy('soldier', 330, 312, -1, 40), key, amb, pts, rim='#ffd8a0')
    actor(img, humanoid_enemy('soldier', 400, 312, -1, 40), key, amb, pts, rim='#ffd8a0')
    actor(img, humanoid_enemy('crossbow', 560, 222, -1, 40), key, amb, pts, rim='#ffd8a0')
    actor(img, cannon(250, 312, -1), key, amb, pts, rim='#ffd8a0')
    img[294, 268] = C('#fff2a0')
    glow(img, 268, 294, 10, C('#ffb040'), 0.6)
    actor(img, hero(150, 296, 1), key, amb, pts, rim='#ffe8c0')
    motes(img, 20, (0, 100, 640, 300), C('#ffd8a0'), 3, 3, 0.35)
    return img


def castle():
    """Stage 4, King's Castle: spike floors, a swinging blade, Royal Guards, a glimpse of the throne room."""
    img = gradient([(0, '#120a1a'), (0.6, '#2a1430'), (1, '#3a1a3a')])
    # back wall: stone arches and pillars, with the throne room glowing through the big arch
    sil(img, [poly((-2, 0), (642, 0), (642, 300), (-2, 300))], C('#2a1a34'), tex=1.0, seed=2, dark=C('#140a1a'))
    arch = mask([spoly((380, 300), (380, 140), (420, 90), (470, 82), (520, 90), (560, 140), (560, 300), n=4)])
    room = gradient([(0, '#6a2a2a'), (0.5, '#c87a3a'), (1, '#f0c070')])
    img[arch] = room[arch]
    # the throne inside, far away
    fill(img, mask([poly((452, 300), (452, 200), (488, 200), (488, 300))]), C('#5a1a20'))
    fill(img, mask([poly((448, 210), (470, 170), (492, 210))]), C('#e8b040'))
    fill(img, mask([poly((456, 260), (484, 260), (484, 300), (456, 300))]), C('#8a2a30'))
    glow(img, 470, 200, 120, C('#ffc060'), 0.45)
    shafts(img, [(470, 40, 0.8)], C('#ffd890'), slope=0.0, alpha=0.18)
    for px in (40, 180, 320, 600):
        sil(img, [poly((px - 16, 300), (px - 16, 0), (px + 16, 0), (px + 16, 300))], C('#3e2a4a'), rim=C('#b07a8a'), rim_dir=(1, 0),
            tex=1.0, seed=px, dark=C('#1a0e22'))
        sil(img, [poly((px - 20, 300), (px - 20, 286), (px + 20, 286), (px + 20, 300)), poly((px - 20, 40), (px - 20, 30), (px + 20, 30), (px + 20, 40))],
            C('#4e3658'), rim=C('#c08a9a'), rim_dir=(0, -1))
    # banners and chandeliers
    for bx in (110, 250):
        fill(img, mask([poly((bx - 14, 30), (bx + 14, 30), (bx + 14, 150), (bx, 136), (bx - 14, 150))]), C('#7a1a2a'))
        fill(img, mask([ell(bx, 70, 6, 8, 0, 12)]), C('#e8b040'))
    for (cx_, cy_) in ((180, 60), (600, 70)):
        fill(img, mask([cap((cx_, 0), (cx_, cy_), 1)]), C('#3a2a20'))
        fill(img, mask([ell(cx_, cy_, 16, 3, 0, 12)]), C('#6a4a2a'))
        for k in (-12, -4, 4, 12):
            img[cy_ - 5:cy_ - 2, cx_ + k] = C('#ffe090')
            glow(img, cx_ + k, cy_ - 5, 22, C('#ffb050'), 0.35)
    # floor, the spike pit and the swinging blade
    sil(img, [poly((-2, 300), (642, 300), (642, 362), (-2, 362))], C('#3a2a3a'), tex=1.0, seed=6, dark=C('#1a121a'))
    for x in range(0, 640, 20):
        img[300:302, x:x + 18] = C('#6a4a5a')
    sil(img, [poly((200, 300), (300, 300), (300, 362), (200, 362))], C('#100810'))
    for x in range(202, 300, 8):
        fill(img, mask([poly((x, 312), (x + 6, 312), (x + 3, 300))]), C('#a8a0b8'))
        img[300, x + 3] = C('#ffffff')
    piv = (250, 0)
    tip = (250 + 70 * math.sin(0.5), 200 * math.cos(0.5))
    fill(img, mask([cap(piv, tip, 2)]), C('#4a3a4a'))
    blade = [spoly((tip[0] - 26, tip[1] - 6), (tip[0], tip[1] - 12), (tip[0] + 26, tip[1] - 6), (tip[0] + 16, tip[1] + 8), (tip[0], tip[1] + 12),
                   (tip[0] - 16, tip[1] + 8), n=3)]
    sil(img, blade, C('#a8b0c8'), rim=C('#ffffff'), rim_dir=(0, -1))
    # motion arc of the blade
    for k in range(1, 4):
        a = 0.5 - k * 0.14
        p = (250 + 200 * math.sin(a), 200 * math.cos(a))
        fill(img, mask([ell(p[0], p[1], 20 - k * 4, 3, -math.degrees(a), 12)]), C('#d8d8f0'), 0.25 - k * 0.06)
    key = {'dir': (0.6, -0.3, 0.6), 'col': (1.0, 0.7, 0.42)}
    amb = (0.3, 0.2, 0.34)
    pts = [(470, 200, 300, (1.0, 0.65, 0.3), 0.8), (180, 60, 200, (1.0, 0.7, 0.35), 0.5)]
    actor(img, humanoid_enemy('guard', 360, 300, -1, 42), key, amb, pts, rim='#ffd890')
    actor(img, humanoid_enemy('guard', 560, 300, -1, 42), key, amb, pts, rim='#ffd890')
    actor(img, hero(130, 300, 1, 'walk'), key, amb, pts, rim='#ffe0a8')
    motes(img, 20, (380, 80, 560, 300), C('#ffd890'), 5, 3, 0.4)
    sil(img, [spoly((-10, 362), (-6, 240), (14, 230), (26, 362), n=3)], C('#08040a'))
    return img


STAGES = [('plains', 'Plains & Forest', plains), ('mountains', 'Caves & Mountains', mountains),
          ('swamps', 'Dark Forest & Swamps', swamps), ('kingdom', 'Enemy Kingdom', kingdom), ('castle', "King's Castle", castle)]


def render(fn):
    img = fn()
    hud(img)
    im = Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8), 'RGB')
    return im


def phone(im):
    out = Image.new('RGB', (844, 390), (0, 0, 0))
    out.paste(im.resize((693, 390), Image.LANCZOS), ((844 - 693) // 2, 0))
    return out


def build(only=None):
    from PIL import ImageFont
    docs = os.path.join(ROOT, 'docs', 'art')
    shots = []
    for sid, name, fn in STAGES:
        if only and sid != only:
            continue
        im = render(fn)
        big = im.resize((W * 3, H * 3), Image.NEAREST)
        big.save(os.path.join(docs, f'stage_test_{sid}.png'))
        phone(big).save(os.path.join(docs, f'stage_test_{sid}_phone.png'))
        shots.append((name, big))
        print('done', sid, flush=True)
    if only:
        return
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
    sw, sh, pad, lab = 960, 540, 16, 38
    out = Image.new('RGB', (2 * sw + 3 * pad, 3 * (sh + lab + pad) + pad), (16, 14, 22))
    d = ImageDraw.Draw(out)
    for i, (name, big) in enumerate(shots):
        x = pad + (i % 2) * (sw + pad)
        y = pad + (i // 2) * (sh + lab + pad)
        d.text((x, y + 4), name, font=font, fill=(240, 236, 226))
        out.paste(big.resize((sw, sh), Image.NEAREST), (x, y + lab))
    # the last cell: the references, for comparing the mood
    refs = [Image.open(os.path.join(docs, 'sketch', f'reference_{k:02d}.png')).convert('RGB') for k in (1, 2, 6, 4)]
    x, y = pad + sw + pad, pad + 2 * (sh + lab + pad)
    d.text((x, y + 4), 'Your references', font=font, fill=(240, 236, 226))
    for k, r in enumerate(refs):
        out.paste(r.resize((sw // 2 - 4, sh // 2 - 4), Image.LANCZOS), (x + (k % 2) * (sw // 2), y + lab + (k // 2) * (sh // 2)))
    out.save(os.path.join(docs, 'stage_test_compare.png'))


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else None)
