"""ART13b Round 1: the Dragon fight in its summit nest, drawn from the user's sketch (docs/art/sketch/), in 4 versions.

A  Fine pixel        1280 x 720 inside, hero ~64 px, banded shading, soft lights, limited palette
B  Tiny pixel (HD-2D) 1920 x 1080 inside, hero ~110 px, textures, dithered shading, glow, fog, light rays
C  Realistic painted  smooth, anti-aliased, continuous light, painted textures, no visible pixels
D  Mix               C's painted background with B's tiny-pixel characters and effects in front

The Dragon follows the sketch: a long angular skull facing right, a heavy brow ridge over a small fierce eye, long
horns swept back with a lift at the tip, a frill of blades behind the jaw, a spiky crest down an S-curved neck, an open
jaw with fangs and a forked tongue, and long barbels hanging from the chin. Only writes docs/art/ and tools/out/.
Run: python3 tools/art/style_test_sketch.py"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 1080
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

# ================================================================================================ geometry helpers


def catmull(pts, n=8):
    """A smooth curve through the points."""
    if len(pts) < 3:
        return list(pts)
    p = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(pts[-1])
    return out


def taper(pts, w0, w1, n=8, ease=1.0):
    """A filled band along a smooth centre line, w0 wide at the start, w1 at the end."""
    c = catmull(pts, n)
    left, right = [], []
    for i, (x, y) in enumerate(c):
        a = c[max(0, i - 1)]
        b = c[min(len(c) - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy) or 1
        t = (i / (len(c) - 1)) ** ease
        w = (w0 + (w1 - w0) * t) / 2
        left.append((x - dy / ln * w, y + dx / ln * w))
        right.append((x + dy / ln * w, y - dx / ln * w))
    return ('poly', tuple(left + right[::-1]))


def poly(*pts):
    return ('poly', tuple(pts))


def spoly(*pts, n=6):
    """A smooth closed outline through the points."""
    c = catmull(list(pts) + [pts[0]], n)
    return ('poly', tuple(c))


def ell(cx, cy, rx, ry, rot=0.0, n=36):
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    return ('poly', tuple((cx + rx * math.cos(2 * math.pi * k / n) * c - ry * math.sin(2 * math.pi * k / n) * s,
                           cy + rx * math.cos(2 * math.pi * k / n) * s + ry * math.sin(2 * math.pi * k / n) * c)
                          for k in range(n)))


def cap(p0, p1, w):
    return taper([p0, p1], w, w, 2)


def xf(shape, fn):
    return ('poly', tuple(fn(p) for p in shape[1]))


def bbox(shapes):
    xs = [p[0] for s in shapes for p in s[1]]
    ys = [p[1] for s in shapes for p in s[1]]
    return min(xs), min(ys), max(xs), max(ys)


# ================================================================================================ noise

def _hash(ix, iy, seed):
    h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def vnoise(x, y, seed=0):
    ix, iy = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    fx, fy = x - ix, y - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = _hash(ix, iy, seed), _hash(ix + 1, iy, seed)
    c, d = _hash(ix, iy + 1, seed), _hash(ix + 1, iy + 1, seed)
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy


def fbm(x, y, oct=4, seed=0):
    v, amp, tot = 0.0, 1.0, 0.0
    for o in range(oct):
        v = v + vnoise(x, y, seed + o * 17) * amp
        tot += amp
        x, y, amp = x * 2.03, y * 2.03, amp * 0.5
    return v / tot


# ================================================================================================ the scene

DRAGON_HEAD = (700, 404)          # the back of the skull; the head faces right
MOUTH = (1046, 452)               # where the fire comes from
HERO = (1440, 668)                # the hero's feet, mid-jump, facing left


def head_xf(p):
    return (DRAGON_HEAD[0] + p[0], DRAGON_HEAD[1] + p[1])


def dragon():
    """The Dragon from the sketch. Returns parts (role, shape) back to front and ink strokes (points, width)."""
    T = head_xf
    P, S = [], []
    # wing: half folded, rising behind the body; arm bone to the wrist, fingers fanning down to a scalloped edge
    sh, wr = (360, 640), (200, 250)
    tips = [(-70, 300), (-40, 560), (110, 700)]
    P.append(('membrane', spoly(sh, (300, 420), wr, tips[0], (-6, 400), tips[1], (60, 580), tips[2], (240, 720), n=4)))
    P.append(('wingbone', taper([sh, (300, 420), wr], 40, 24)))
    for t in tips:
        P.append(('wingbone', taper([wr, ((wr[0] + t[0]) / 2 + 10, (wr[1] + t[1]) / 2), t], 18, 5)))
        S.append(([wr, ((wr[0] + t[0]) / 2 + 10, (wr[1] + t[1]) / 2), t], 2))
    P.append(('claw', taper([wr, (190, 220), (170, 200)], 16, 2)))
    # the body and the back leg, low and behind the nest
    P.append(('scale_dk', ell(230, 820, 330, 190, -8)))
    P.append(('scale_dk', ell(250, 790, 300, 170, -8)))
    P.append(('belly', taper([(420, 700), (500, 800), (520, 900)], 120, 150)))
    # the neck: an S-curve up from the chest to the back of the skull (sketch 2)
    neck_c = [(470, 760), (540, 640), (560, 540), (620, 460), T((10, 20))]
    P.append(('scale', taper(neck_c, 190, 104, 10)))
    P.append(('belly', taper([(560, 760), (610, 640), (630, 560), (676, 488), T((40, 44))], 74, 46, 10)))
    for i in range(1, 8):                                           # throat plates (lines across the belly band)
        t = i / 8
        c = catmull([(560, 760), (610, 640), (630, 560), (676, 488), T((40, 44))], 6)
        j = int(t * (len(c) - 1))
        x, y = c[j]
        S.append(([(x - 30, y - 6), (x + 32, y + 8)], 2))
    # the crest: a row of back-swept blades down the neck and over the skull (sketches 1 and 3)
    crest = catmull([(430, 690), (470, 590), (510, 500), (580, 420), T((-6, -36)), T((40, -66))], 5)
    for i in range(0, len(crest) - 1, 3):
        x, y = crest[i]
        nx, ny = crest[min(len(crest) - 1, i + 1)]
        ang = math.atan2(ny - y, nx - x) - math.pi / 2 - 0.55
        ln = 54 - i * 0.6
        tip = (x + math.cos(ang) * ln, y + math.sin(ang) * ln)
        P.append(('spike', poly((x - 12, y + 8), tip, (x + 14, y - 2))))
    # front leg gripping the nest rim
    P.append(('scale', ell(520, 790, 80, 70, 20)))
    P.append(('scale', taper([(540, 800), (600, 850), (640, 880)], 84, 58)))
    P.append(('scale_dk', spoly((610, 860), (690, 858), (722, 884), (700, 904), (626, 900), n=4)))
    for k in range(4):
        bx = 650 + k * 20
        P.append(('claw', taper([(bx, 892), (bx + 14, 906), (bx + 18, 926)], 14, 2)))
    # far horn (darker), behind the skull
    P.append(('horn_dk', taper([T((30, -50)), T((-40, -96)), T((-140, -124)), T((-220, -128)), T((-262, -150))], 30, 3, 8)))
    # jaw frill: blades behind the jaw, sweeping back (sketch 3)
    for (a, b, w) in (((20, 40), (-90, 86), 30), ((0, 18), (-110, 34), 26), ((26, 62), (-50, 118), 22)):
        P.append(('frill', taper([T(a), T(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 6)), T(b)], w, 3)))
    # lower jaw, open (fire telegraph)
    P.append(('scale', spoly(T((40, 42)), T((130, 40)), T((220, 66)), T((300, 98)), T((322, 108)), T((300, 122)),
                             T((200, 104)), T((110, 82)), T((48, 66)), n=5)))
    # the mouth: a glowing maw between the jaws
    P.append(('maw', poly(T((120, 32)), T((240, 22)), T((336, 16)), T((304, 94)), T((210, 64)), T((130, 44)))))
    # forked tongue curling out (sketch 3)
    P.append(('tongue', taper([T((150, 54)), T((250, 72)), T((330, 84)), T((372, 104))], 16, 6)))
    P.append(('tongue', taper([T((366, 100)), T((392, 96)), T((410, 84))], 6, 2)))
    P.append(('tongue', taper([T((366, 102)), T((388, 120)), T((404, 134))], 6, 2)))
    # teeth
    for i, x in enumerate(range(150, 336, 22)):
        ln = 22 if i in (2, 6) else 13
        y0 = 28 - (x - 150) * 0.08
        P.append(('tooth', poly(T((x - 5, y0)), T((x + 6, y0)), T((x + 2, y0 + ln)))))
    for i, x in enumerate(range(160, 310, 24)):
        ln = 18 if i == 3 else 11
        y0 = 68 + (x - 160) * 0.24
        P.append(('tooth', poly(T((x - 5, y0)), T((x + 6, y0 - 1)), T((x + 1, y0 - ln)))))
    # the skull: long and angular, a bump at the brow, a dip at the bridge, a hooked snout (sketches 2 and 3)
    P.append(('scale', spoly(T((-34, -26)), T((30, -60)), T((120, -66)), T((180, -58)), T((230, -40)), T((300, -32)),
                             T((338, -18)), T((350, 4)), T((336, 18)), T((240, 24)), T((130, 34)), T((40, 44)),
                             T((-20, 26)), n=5)))
    P.append(('scale_lt', spoly(T((40, -52)), T((150, -60)), T((240, -38)), T((320, -26)), T((300, -16)), T((150, -38)),
                                T((60, -36)), n=5)))
    # brow ridge over the eye, the eye, the nostril
    P.append(('brow', poly(T((96, -60)), T((206, -64)), T((196, -40)), T((150, -32)), T((104, -40)))))
    P.append(('eye', ell(*T((160, -26)), 15, 7, -10)))
    P.append(('pupil', ell(*T((164, -26)), 3, 6.5, 0)))
    P.append(('nostril', ell(*T((322, -6)), 9, 5, -20)))
    # near horn: long, swept back, lifting at the tip (sketch 2)
    P.append(('horn', taper([T((54, -52)), T((-20, -110)), T((-120, -150)), T((-210, -158)), T((-268, -194))], 40, 3, 10)))
    # barbels: long whiskers hanging from the chin (sketch 2)
    for (a, b, c) in (((250, 112), (262, 190), (300, 262)), ((210, 100), (210, 186), (232, 248))):
        P.append(('barbel', taper([T(a), T(b), T(c)], 8, 2)))
    # ink strokes from the sketch: brow lines, jaw and cheek lines, nose curl, scale arcs on the skull, horn ridges
    S += [([T((70, -34)), T((110, -20)), T((140, -4))], 3), ([T((200, -20)), T((250, -12)), T((290, -6))], 2),
          ([T((300, -24)), T((318, -32)), T((330, -24))], 2), ([T((30, 8)), T((80, 18)), T((120, 30))], 3),
          ([T((60, 60)), T((120, 78))], 2), ([T((-10, 0)), T((20, -18)), T((60, -24))], 2)]
    for k in range(5):
        x = 30 + k * 34
        S.append(([T((x, -42)), T((x + 14, -50)), T((x + 26, -44))], 2))
    for k in range(6):
        t = 0.15 + k * 0.13
        c = catmull([T((54, -52)), T((-20, -110)), T((-120, -150)), T((-210, -158)), T((-268, -194))], 8)
        j = int(t * (len(c) - 1))
        x, y = c[j]
        S.append(([(x - 8, y - 12 + k), (x + 6, y + 12 - k)], 2))
    return P, S


def hero():
    """The hero (human, leather set) mid-jump, facing left, swinging the Greatsword at the Dragon's head."""
    s = 3.3
    hx, hy = HERO

    def T(p):
        return (hx - p[0] * s, hy + p[1] * s)       # mirrored: facing left

    def tp(shape):
        return xf(shape, T)
    P = []
    hipB, kneeB, footB = (-1, -12), (-5.5, -7.5), (-3.5, -2.5)
    hipF, kneeF, footF = (1, -12), (6.5, -12), (6, -5.5)
    P += [('cloth_dk', tp(cap(hipB, kneeB, 4.2))), ('cloth_dk', tp(cap(kneeB, footB, 3.6))),
          ('boot', tp(poly((-6, -3.6), (-1.6, -3.6), (-1.2, -0.6), (-6.4, -0.8))))]
    P += [('scarf', tp(spoly((-1, -21), (-8, -24.5), (-14, -23), (-10, -20.5), (-2, -19), n=4)))]
    P += [('cloth_dk', tp(cap((-0.5, -20), (4.5, -16.5), 3.2))), ('skin_dk', tp(cap((4.5, -16.5), (10, -15.5), 3))),
          ('skin_dk', tp(ell(10.4, -15.3, 1.8, 1.8)))]
    P += [('leather', tp(spoly((-4.6, -21.6), (0, -22.2), (4.4, -21.2), (4.8, -16), (4.6, -11.2), (0, -10.8), (-4.2, -11), (-4.8, -16), n=3)))]
    P += [('belt', tp(poly((-4.4, -12.8), (4.6, -13), (4.6, -11.2), (-4.3, -11)))), ('gold', tp(ell(1.6, -12, 1.0, 0.9)))]
    P += [('cloth', tp(cap(hipF, kneeF, 4.4))), ('cloth', tp(cap(kneeF, footF, 3.8))),
          ('boot', tp(poly((4.0, -6.6), (8.6, -6.4), (8.8, -3.4), (3.6, -3.6))))]
    P += [('skin', tp(ell(2.2, -26, 4.2, 4.6)))]
    P += [('hair', tp(poly((-2.6, -23.6), (-3.8, -30), (-1.2, -28.8), (-0.4, -32.4), (1.8, -29.4), (4.4, -31.4),
                           (5.4, -28.4), (6.6, -27.2), (3.4, -27.4), (1, -26.2), (0.4, -23))))]
    P += [('eye', tp(ell(4.8, -25.6, 0.5, 0.9)))]
    P += [('scarf', tp(poly((-3.6, -21.8), (3.8, -21.6), (4, -19.8), (-3.4, -19.6))))]
    P += [('cloth', tp(cap((1.6, -20), (7, -17.5), 3.4))), ('skin', tp(cap((7, -17.5), (11, -15.5), 3))),
          ('skin', tp(ell(11.4, -15.2, 1.9, 1.9)))]
    # the Greatsword, raised over the shoulder and coming down at the head
    hxp, hyp = 11.2, -15.2
    ang = math.radians(-58)
    ux, uy = math.cos(ang), math.sin(ang)
    px, py = -uy, ux
    L = 21

    def at(a, n):
        return (hxp + ux * a + px * n, hyp + uy * a + py * n)
    P += [('grip', tp(cap(at(-4, 0), at(1, 0), 1.6))), ('gold', tp(ell(*at(-4.6, 0), 1.3, 1.3))),
          ('gold', tp(poly(at(1, -3.4), at(2.4, -3.4), at(2.4, 3.4), at(1, 3.4)))),
          ('steel', tp(poly(at(2.4, -1.7), at(L - 3, -1.5), at(L, 0), at(L - 3, 1.5), at(2.4, 1.7)))),
          ('steel_lt', tp(poly(at(3, -0.3), at(L - 3.4, -0.25), at(L - 3.4, 0.3), at(3, 0.35))))]
    smear = []
    cx, cy = T((9, -15))
    r0, r1 = 19.5 * s, 25.5 * s
    a0, a1 = 180 + 30, 180 + 160              # from over the head, down in front (mirrored)
    outer = [(cx + r1 * math.cos(math.radians(a0 + (a1 - a0) * i / 30)), cy + r1 * math.sin(math.radians(a0 + (a1 - a0) * i / 30)))
             for i in range(31)]
    inner = [(cx + r0 * math.cos(math.radians(a1 - (a1 - a0) * i / 30)), cy + r0 * math.sin(math.radians(a1 - (a1 - a0) * i / 30)))
             for i in range(31)]
    smear.append(('smear', ('poly', tuple(outer + inner))))
    return P, smear


def nest():
    """Sticks, bones and a little gold around the Dragon's chest (the nest on the summit)."""
    rng = np.random.default_rng(5)
    back, front = [], []
    for i in range(170):
        x = rng.uniform(-20, 960)
        rim = 930 - 70 * math.exp(-((x - 430) / 380) ** 2)          # a mound, highest around the Dragon's chest
        y = rim + rng.uniform(-40, 40)
        a = rng.uniform(-0.7, 0.7)
        ln = rng.uniform(80, 190)
        p0, p1 = (x - math.cos(a) * ln / 2, y - math.sin(a) * ln / 2), (x + math.cos(a) * ln / 2, y + math.sin(a) * ln / 2)
        (front if y > rim + 4 else back).append(('stick' if i % 4 else 'stick_dk', cap(p0, p1, rng.uniform(11, 22))))
    for (x, y) in ((200, 934), (760, 930), (520, 950)):
        front.append(('bone', cap((x - 36, y), (x + 36, y - 8), 12)))
        front.append(('bone', ell(x - 38, y, 9, 9)))
        front.append(('bone', ell(x + 38, y - 8, 9, 9)))
    front.append(('bone', spoly((860, 940), (900, 922), (936, 934), (930, 960), (880, 964), n=4)))      # an old skull
    front.append(('socket', ell(898, 938, 8, 7)))
    for k in range(14):
        x, y = 600 + rng.uniform(-60, 120), 952 + rng.uniform(-14, 6)
        front.append(('gold', ell(x, y, 9, 5, rng.uniform(-20, 20))))
    return back, front


def outcrop():
    """The rock the hero jumped from, under the fire's path."""
    return [('rock', spoly((1290, 1080), (1300, 860), (1350, 790), (1440, 770), (1540, 784), (1600, 840), (1640, 1080), n=5)),
            ('rock_top', spoly((1310, 812), (1360, 784), (1450, 772), (1540, 786), (1590, 816), (1450, 806), n=5))]


# ================================================================================================ palette and light

ALB = {
    'scale': (138, 34, 32), 'scale_dk': (96, 24, 26), 'scale_lt': (164, 48, 40), 'belly': (196, 150, 100),
    'spike': (70, 32, 30), 'frill': (110, 30, 32), 'horn': (220, 206, 176), 'horn_dk': (150, 132, 112), 'claw': (36, 30, 30),
    'brow': (110, 28, 28), 'eye': (255, 214, 90), 'pupil': (20, 10, 10), 'nostril': (30, 10, 12), 'tooth': (236, 228, 206),
    'tongue': (150, 40, 60), 'maw': (255, 180, 70), 'membrane': (70, 22, 28), 'wingbone': (120, 36, 34),
    'barbel': (120, 36, 34),
    'skin': (236, 182, 140), 'skin_dk': (206, 150, 112), 'hair': (112, 70, 42), 'eye_h': (20, 16, 26),
    'cloth': (60, 96, 176), 'cloth_dk': (44, 70, 136), 'leather': (128, 82, 50), 'belt': (66, 42, 30), 'boot': (80, 52, 36),
    'scarf': (60, 206, 240), 'grip': (90, 56, 36), 'gold': (236, 190, 70), 'steel': (184, 196, 214), 'steel_lt': (240, 244, 252),
    'smear': (255, 255, 255),
    'stick': (112, 82, 56), 'stick_dk': (84, 60, 42), 'bone': (220, 210, 186), 'socket': (40, 30, 30),
    'rock': (76, 66, 70), 'rock_top': (112, 96, 90),
}
ALB['eye'] = (255, 214, 90)
EMISSIVE = {'eye': 1.0, 'maw': 1.0}
TEX = {'scale': 'scales', 'scale_dk': 'scales', 'scale_lt': 'scales', 'belly': 'plates', 'membrane': 'veins',
       'stick': 'wood', 'stick_dk': 'wood', 'rock': 'rock', 'rock_top': 'rock', 'horn': 'horn', 'horn_dk': 'horn',
       'spike': 'horn', 'frill': 'horn'}
SPEC = {'steel': 0.9, 'steel_lt': 0.9, 'gold': 0.6, 'scale': 0.25, 'scale_lt': 0.25, 'tooth': 0.3, 'eye': 0.0, 'claw': 0.4,
        'horn': 0.2}

KEY = np.array([255, 178, 120], np.float32) / 255 * 1.05     # sunset through the cave mouth (upper right)
KEYD = np.array([0.6, -0.42, 0.68], np.float32)
AMB = np.array([70, 76, 120], np.float32) / 255 * 0.55
FIRE = np.array([255, 130, 40], np.float32) / 255


def lighting(nx, ny, X, Y, role):
    nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
    kd = KEYD / np.linalg.norm(KEYD)
    diff = np.clip(nx * kd[0] + ny * kd[1] + nz * kd[2], 0, 1)
    sun = 0.35 + 0.65 * np.clip((X - 380) / 1100, 0, 1)                   # deeper in the cave is darker
    vx, vy, vz = MOUTH[0] - X, MOUTH[1] - Y, 90.0
    d = np.sqrt(vx * vx + vy * vy + vz * vz)
    fdot = np.clip((nx * vx + ny * vy + nz * vz) / d, 0, 1)
    fire = fdot / (1 + (d / 380) ** 2) * 1.5
    rim = np.clip(nx * 0.82 - ny * 0.4, 0, 1) ** 2 * (1 - nz) * sun
    sky = np.clip(-ny, 0, 1) * 0.25
    L = (AMB[None, None] * (1 + sky[..., None]) + KEY[None, None] * (diff * sun)[..., None]
         + FIRE[None, None] * fire[..., None] + KEY[None, None] * rim[..., None] * 0.9)
    spec_h = np.clip(nx * kd[0] + ny * kd[1] + nz * kd[2], 0, 1) ** 24 * sun
    return L, spec_h


def texture(kind, X, Y, scale):
    if kind == 'scales':
        s = 11.0
        jx, jy = (fbm(X / 50, Y / 50, 2, 31) - 0.5) * 9, (fbm(X / 50, Y / 50, 2, 37) - 0.5) * 9
        v = (Y + jy) / (s * 0.62)
        u = (X + jx) / s + 0.5 * (np.floor(v) % 2)
        fu, fv = u - np.floor(u) - 0.5, v - np.floor(v)
        d = np.sqrt(fu * fu + (fv * 0.95) ** 2)
        edge = np.clip(1 - np.abs(d - 0.5) / 0.14, 0, 1)
        top = np.clip(0.55 - fv, 0, 1)
        return (0.92 - 0.22 * edge + 0.14 * top) * (0.85 + 0.3 * fbm(X / 90, Y / 90, 3, 41))
    if kind == 'plates':
        f = (Y / 26) % 1.0
        return 0.92 - 0.25 * np.clip(1 - np.abs(f - 0.0) / 0.08, 0, 1) - 0.25 * np.clip(1 - np.abs(f - 1) / 0.08, 0, 1) \
            + 0.06 * (fbm(X / 30, Y / 30, 3, 5) - 0.5)
    if kind == 'veins':
        n = fbm(X / 60, Y / 60, 3, 9)
        return 0.82 + 0.3 * n
    if kind == 'wood':
        g = np.sin((X * 0.12 + fbm(X / 40, Y / 40, 2, 4) * 6))
        return 0.85 + 0.12 * g + 0.1 * (vnoise(X / 5, Y / 5, 6) - 0.5)
    if kind == 'rock':
        n = fbm(X / 70, Y / 70, 5, 11)
        strata = np.sin((Y + fbm(X / 200, Y / 200, 3, 15) * 120) / 22) * 0.5 + 0.5
        cr = np.clip(1 - np.abs(fbm(X / 160, Y / 60, 4, 13) - 0.5) / 0.012, 0, 1)
        return 0.66 + 0.55 * n + 0.14 * strata - 0.25 * cr
    if kind == 'horn':
        return 0.86 + 0.18 * np.sin((X + Y) * 0.16) * 0.5 + 0.1 * (vnoise(X / 8, Y / 30, 2) - 0.5)
    return 1.0


# ================================================================================================ styles

STY = {
    'A': dict(k=2 / 3, ss=1, pixel=True, steps=6, dither=0.0, outline=1, palette=0),
    'B': dict(k=1.0, ss=1, pixel=True, steps=9, dither=0.55, outline=1, palette=0),
    'C': dict(k=1.0, ss=2, pixel=False),
    'D': dict(k=1.0, ss=2, pixel=False),                 # background; its characters come from B
}
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16 - 0.5


class View:
    """Design coordinates (1920 x 1080) -> working pixels, for a region of the scene."""

    def __init__(self, K, region=(0, 0, W, H)):
        self.K = K
        self.x0, self.y0 = region[0], region[1]
        self.w = int(round((region[2] - region[0]) * K))
        self.h = int(round((region[3] - region[1]) * K))

    def grid(self, ox=0, oy=0, w=None, h=None):
        w = self.w if w is None else w
        h = self.h if h is None else h
        xs = (np.arange(w, dtype=np.float32) + ox + 0.5) / self.K + self.x0
        ys = (np.arange(h, dtype=np.float32) + oy + 0.5) / self.K + self.y0
        return np.meshgrid(xs, ys)

    def to(self, p):
        return ((p[0] - self.x0) * self.K, (p[1] - self.y0) * self.K)


def _mask(view, shape, ox, oy, w, h):
    im = Image.new('L', (w, h), 0)
    ImageDraw.Draw(im).polygon([((x - ox), (y - oy)) for x, y in (view.to(p) for p in shape[1])], fill=255)
    return np.asarray(im) > 127


def _box(a, r, axis):
    if r < 1:
        return a
    pad = [(0, 0), (0, 0)]
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode='edge'), axis=axis)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return (hi - lo) / (2 * r + 1)


def _blur(a, s):
    """Gaussian-like blur in float (three box passes), so smooth shading has no 8-bit banding."""
    a = a.astype(np.float32)
    if s <= 0.3:
        return a
    r = max(1, int(round(s * 0.93)))
    for _ in range(3):
        a = _box(_box(a, r, 0), r, 1)
    return a


def _dilate(m, r):
    if r <= 0:
        return m
    im = Image.fromarray((m * 255).astype(np.uint8), 'L').filter(ImageFilter.MaxFilter(int(r) * 2 + 1))
    return np.asarray(im) > 127


def render_object(view, parts, strokes, st, glow_roles=(), telegraph=False, outline=True):
    """Shade a group of parts into an RGBA patch (working pixels). Returns (rgb, alpha, ox, oy)."""
    x0, y0, x1, y1 = bbox([s for _r, s in parts])
    m = 40
    a0, b0 = view.to((x0 - m, y0 - m))
    a1, b1 = view.to((x1 + m, y1 + m))
    ox, oy = max(0, int(a0)), max(0, int(b0))
    w, h = min(view.w, int(a1) + 1) - ox, min(view.h, int(b1) + 1) - oy
    if w <= 2 or h <= 2:
        return None
    ids = np.full((h, w), -1, np.int16)
    NX = np.zeros((h, w), np.float32)
    NY = np.zeros((h, w), np.float32)
    roles = []
    for role, shape in parts:
        mk = _mask(view, shape, ox, oy, w, h)
        if not mk.any():
            continue
        ys, xs = np.nonzero(mk)
        py0, py1, px0, px1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        sz = min(py1 - py0, px1 - px0)
        sig = float(np.clip(sz * 0.24, 1.2, 70 * view.K))
        pad = int(sig * 2.5) + 2
        qy0, qy1, qx0, qx1 = max(0, py0 - pad), min(h, py1 + pad), max(0, px0 - pad), min(w, px1 + pad)
        sub = mk[qy0:qy1, qx0:qx1]
        b = _blur(sub.astype(np.float32), sig)
        gy, gx = np.gradient(b)
        kk = sig * 2.4
        nx, ny = -gx * kk, -gy * kk
        ln = np.maximum(np.sqrt(nx * nx + ny * ny), 1.0)
        nx, ny = nx / ln, ny / ln
        if role not in roles:
            roles.append(role)
        ri = roles.index(role)
        sl = (slice(qy0, qy1), slice(qx0, qx1))
        ids[sl][sub] = ri
        NX[sl][sub] = nx[sub]
        NY[sl][sub] = ny[sub]
    occ = ids >= 0
    if not occ.any():
        return None
    X, Y = view.grid(ox, oy, w, h)
    L, spec = lighting(NX, NY, X, Y, None)
    rgb = np.zeros((h, w, 3), np.float32)
    for ri, role in enumerate(roles):
        mk = ids == ri
        alb = np.array(ALB[role], np.float32) / 255
        if role in EMISSIVE or role == 'smear':
            col = np.broadcast_to(alb, (h, w, 3)).copy()
            if role == 'maw':                                          # hotter towards the throat
                t = np.clip((X - (DRAGON_HEAD[0] + 120)) / 220, 0, 1)
                col = np.array([255, 250, 200], np.float32)[None, None] / 255 * (1 - t[..., None]) + col * t[..., None]
            rgb[mk] = col[mk]
            continue
        tex = texture(TEX.get(role), X, Y, view.K) if role in TEX else 1.0
        c = alb[None, None] * (tex[..., None] if isinstance(tex, np.ndarray) else tex) * L
        c = c + spec[..., None] * SPEC.get(role, 0.05)
        rgb[mk] = c[mk]
    if telegraph:                                                    # the fire telegraph: an orange flash on the head
        hx, hy = DRAGON_HEAD
        near = np.clip(1 - np.hypot(X - (hx + 170), Y - (hy + 20)) / 320, 0, 1)
        rgb = rgb + (np.array([1.0, 0.45, 0.1], np.float32)[None, None] * (0.32 * near)[..., None]) * occ[..., None]
    rgb = np.clip(rgb, 0, 1.6)
    alpha = occ.astype(np.float32)
    if st['pixel']:
        lum = rgb.mean(axis=2, keepdims=True) + 1e-4
        n = st['steps']
        v = np.clip(lum, 0, 1.4) / 1.4 * n
        if st['dither']:
            by = BAYER[(np.arange(h)[:, None] + oy) % 4, (np.arange(w)[None, :] + ox) % 4][..., None]
            v = v + by * st['dither']
        q = np.clip(np.round(v), 0.6, n) / n * 1.4
        rgb = rgb / lum * q
        cool = np.array([0.18, 0.16, 0.34], np.float32)
        dark = np.clip(1 - q / 0.5, 0, 1)
        rgb = rgb * (1 - 0.25 * dark) + cool[None, None] * 0.25 * dark
    # ink strokes (the sketch's pen lines)
    if strokes:
        sm = Image.new('L', (w, h), 0)
        d = ImageDraw.Draw(sm)
        for pts, wd in strokes:
            c = [(x - ox, y - oy) for x, y in (view.to(p) for p in catmull(pts, 6))]
            d.line(c, fill=255, width=max(1, int(round(wd * view.K * (0.6 if st['pixel'] else 0.9)))), joint='curve')
        smk = (np.asarray(sm) > 127) & occ
        ink = np.array([0.12, 0.04, 0.05], np.float32)
        k = 0.85 if st['pixel'] else 0.6
        rgb[smk] = rgb[smk] * (1 - k) + ink * k
    if outline:
        if st['pixel']:
            ring = _dilate(occ, st['outline']) & ~occ
            near = _spread(rgb, occ)
            rgb = np.where(ring[..., None], near * 0.3 + np.array([0.05, 0.03, 0.07], np.float32) * 0.7, rgb)
            alpha = np.maximum(alpha, ring)
        else:
            edge = occ & _dilate(~occ, max(1, int(view.K * 1.2)))
            rgb = np.where(edge[..., None], rgb * 0.62, rgb)
    return rgb, alpha, ox, oy


def _spread(rgb, occ):
    out = rgb.copy()
    acc = np.zeros_like(rgb)
    cnt = np.zeros(occ.shape, np.float32)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        acc += np.roll(rgb * occ[..., None], (dy, dx), (0, 1))
        cnt += np.roll(occ, (dy, dx), (0, 1))
    grow = (~occ) & (cnt > 0)
    out[grow] = acc[grow] / cnt[grow][..., None]
    return out


def composite(img, patch, opacity=1.0):
    if patch is None:
        return
    rgb, a, ox, oy = patch
    h, w = a.shape
    sl = (slice(oy, oy + h), slice(ox, ox + w))
    dst = img[sl]
    al = (a * opacity)[..., None]
    img[sl] = dst * (1 - al) + rgb * al


def add_light(img, view, cx, cy, r, col, k, falloff=2.0):
    X, Y = view.grid()
    d = np.hypot(X - cx, Y - cy)
    g = np.clip(1 - d / r, 0, 1) ** falloff * k
    img += np.array(col, np.float32)[None, None] / 255 * g[..., None]


# ================================================================================================ background

OPEN = [(860, 1080), (900, 760), (840, 560), (930, 330), (1080, 150), (1340, 70), (1640, 90), (1860, 220), (1940, 420),
        (1940, 1080)]


def background(view, st, painted):
    """Sky and peaks seen through the cave mouth, the cave rock, the floor ledge."""
    X, Y = view.grid()
    h, w = view.h, view.w
    img = np.zeros((h, w, 3), np.float32)
    # sky: a sunset, deep blue high up, orange at the horizon
    t = np.clip((Y - 60) / 700, 0, 1)
    top, mid, low = np.array([0.16, 0.18, 0.38]), np.array([0.66, 0.42, 0.46]), np.array([1.0, 0.66, 0.36])
    sky = np.where((t < 0.6)[..., None], top + (mid - top) * (t / 0.6)[..., None], mid + (low - mid) * ((t - 0.6) / 0.4)[..., None])
    img[:] = sky
    sun = np.hypot(X - 1520, Y - 640)
    img += np.array([1.0, 0.72, 0.4])[None, None] * (np.clip(1 - sun / 520, 0, 1) ** 2.2 * 0.7)[..., None]
    img = np.where((sun < 62)[..., None], np.array([1.0, 0.93, 0.74]), img)
    # clouds: long sunset streaks
    cl = fbm(X / 260, Y / 40, 4, 21)
    cm = np.clip((cl - 0.55) * 4, 0, 1) * np.clip(1 - np.abs(Y - 380) / 260, 0, 1)
    ccol = np.array([1.0, 0.62, 0.48])[None, None] * (0.7 + 0.5 * np.clip((Y - 200) / 400, 0, 1))[..., None]
    img = img * (1 - cm[..., None] * 0.8) + ccol * cm[..., None] * 0.8
    # distant peaks, three layers in haze, jagged, with snow on the tops
    xs = X[0]
    for i, (base, amp, sc, sd, col, haze) in enumerate(((760, 330, 360, 3, (0.40, 0.32, 0.46), 0.55),
                                                        (840, 260, 240, 7, (0.28, 0.21, 0.32), 0.35),
                                                        (930, 190, 170, 11, (0.17, 0.13, 0.20), 0.15))):
        r = np.zeros_like(xs)
        a, f = 1.0, 1.0
        for o in range(5):
            r += a * (1 - np.abs(vnoise(xs / sc * f, np.full_like(xs, sd + o * 3.1), sd + o) * 2 - 1))
            a, f = a * 0.5, f * 2.1
        ridge = base - amp * (r / 1.9) ** 1.6
        m = Y >= ridge[None, :]
        depth = Y - ridge[None, :]
        sm = np.convolve(ridge, np.ones(41) / 41, mode='same')
        g = np.gradient(sm)
        lit = 0.5 + (np.clip(0.5 - g * 3.0, 0, 1)[None, :] - 0.5) * np.exp(-np.clip(Y - ridge[None, :], 0, None) / 160)
        lightside = lit > 0.5
        c = np.array(col)[None, None] * (1 + 0.35 * lit[..., None]) * (0.9 + 0.2 * fbm(X / 30, Y / 30, 3, sd)[..., None])
        c = c * (1 - haze) + np.array([0.86, 0.56, 0.5])[None, None] * haze * np.clip(1 - depth / 600, 0.3, 1)[..., None]
        img = np.where(m[..., None], c, img)
        snow = m & (depth < 18 + 60 * np.clip((base - sm[None, :]) / amp - 0.35, 0, 1) * (0.6 + 0.4 * fbm(X / 25, Y / 9, 2, sd))) \
            & (sm[None, :] < base - amp * 0.32)
        sc_ = np.array([0.62, 0.56, 0.72]) + (np.array([1.0, 0.86, 0.74]) - np.array([0.62, 0.56, 0.72])) * lit[..., None]
        img = np.where(snow[..., None], sc_ * (1 - haze * 0.5) + np.array([0.86, 0.56, 0.5]) * haze * 0.5, img)
    # the cave: rock everywhere outside the mouth
    cave = Image.new('L', (w, h), 255)
    ImageDraw.Draw(cave).polygon([view.to(p) for p in catmull(OPEN, 6)], fill=0)
    cm = np.asarray(cave) > 127
    # stalactites hanging from the top of the mouth
    stal = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(stal)
    rng = np.random.default_rng(4)
    x = 960
    while x < 1880:
        yt = 110 + 170 * ((x - 1350) / 620) ** 2
        wd = rng.uniform(10, 34)
        ln = rng.uniform(20, 70) + wd * rng.uniform(1.0, 3.2)
        tip = x + rng.uniform(-6, 6)
        d.polygon([view.to(p) for p in catmull([(x - wd, yt - 40), (x - wd * 0.7, yt + ln * 0.3), (tip - 2, yt + ln),
                                                 (tip + 2, yt + ln), (x + wd * 0.6, yt + ln * 0.35), (x + wd, yt - 40)], 4)],
                  fill=255)
        x += wd * 2 + rng.uniform(4, 60)
    cm = cm | (np.asarray(stal) > 127)
    # rock shading: dark basalt, lit along the edge of the mouth by the sunset
    edge = _blur((~cm).astype(np.float32), 46 * view.K)
    tex = texture('rock', X, Y, view.K)
    rock = np.array([0.24, 0.21, 0.24])[None, None] * tex[..., None]
    rock = rock * (0.55 + 1.6 * edge[..., None] * np.array([1.0, 0.78, 0.6])[None, None])
    fire = np.clip(1 - np.hypot(X - MOUTH[0], Y - MOUTH[1]) / 700, 0, 1) ** 2
    rock = rock + np.array([0.5, 0.2, 0.06])[None, None] * fire[..., None] * 0.18
    rock = rock * np.array([0.82, 0.86, 1.08])[None, None]          # cool shadowed rock, so the red Dragon stands out
    img = np.where(cm[..., None], rock, img)
    # the floor ledge
    fl = Image.new('L', (w, h), 0)
    ImageDraw.Draw(fl).polygon([view.to(p) for p in catmull([(-20, 1080), (-20, 920), (300, 930), (700, 940), (1000, 930),
                                                             (1300, 950), (1700, 940), (1940, 930), (1940, 1080)], 6)], fill=255)
    fm = np.asarray(fl) > 127
    lip = fm & ~(np.roll(fm, int(10 * view.K), axis=0))
    ftex = texture('rock', X * 1.3, Y * 1.3, view.K)
    floor = np.array([0.2, 0.16, 0.17])[None, None] * ftex[..., None] * (0.6 + 0.7 * np.clip((X - 300) / 1400, 0, 1))[..., None]
    floor = floor + np.array([0.6, 0.24, 0.07])[None, None] * fire[..., None] * 0.7
    img = np.where(fm[..., None], floor, img)
    img = np.where(lip[..., None], img * 1.25 + np.array([0.16, 0.08, 0.03]), img)
    if st['pixel']:
        img = _posterize(img, view, st, 0)
    return img


def _posterize(img, view, st, oy):
    lum = img.mean(axis=2, keepdims=True) + 1e-4
    n = st['steps'] + 3
    v = lum / 1.4 * n
    if st['dither']:
        h, w = lum.shape[:2]
        v = v + BAYER[np.arange(h)[:, None] % 4, np.arange(w)[None, :] % 4][..., None] * st['dither']
    q = np.clip(np.round(v), 0, n) / n * 1.4
    return img / lum * q


def light_rays(img, view, st):
    """Shafts of sunset light falling from the mouth into the cave, and floating dust."""
    X, Y = view.grid()
    acc = np.zeros(X.shape, np.float32)
    for (x, wd, k) in ((1180, 90, 0.5), (1400, 140, 0.4), (1650, 70, 0.45), (980, 60, 0.3)):
        # beams fall down-left: x shifts by -0.45 per y
        xb = x - (Y - 120) * 0.45
        acc += np.clip(1 - np.abs(X - xb) / wd, 0, 1) ** 1.5 * k * np.clip((Y - 120) / 300, 0, 1) * np.clip((1000 - Y) / 500, 0, 1)
    if st.get('pixel') and st['k'] < 1:
        acc = np.round(acc * 4) / 4
    img += np.array([1.0, 0.72, 0.45])[None, None] * acc[..., None] * 0.35
    rng = np.random.default_rng(8)
    for _ in range(60):
        x, y = rng.uniform(900, 1900), rng.uniform(250, 1000)
        r = rng.uniform(1.2, 3.0)
        add_light(img, view, x, y, r * 2.4, (255, 220, 170), 0.5, 1.0)


def fire_effects(img, view, st):
    """The fire breath telegraph: a hot glow in the mouth, embers and a warning streak where the fire will land."""
    add_light(img, view, MOUTH[0] - 40, MOUTH[1], 260, (255, 120, 30), 0.55, 2.0)
    add_light(img, view, MOUTH[0] - 40, MOUTH[1] - 4, 90, (255, 220, 140), 0.6, 2.0)
    rng = np.random.default_rng(12)
    for _ in range(46):
        x = MOUTH[0] + rng.uniform(-40, 220)
        y = MOUTH[1] + rng.uniform(-80, 140) - (x - MOUTH[0]) * 0.1
        add_light(img, view, x, y, rng.uniform(5, 11), (255, 160, 60), rng.uniform(0.6, 1.1), 1.0)
    # where the breath will land: a flickering orange streak along the outcrop and the floor
    X, Y = view.grid()
    for (x0, x1, y) in ((1300, 1600, 790), (1150, 1700, 944)):
        tongue = 14 + 20 * np.sin(X / 23) ** 2 * fbm(X / 30, np.full_like(X, 3.0), 2, 3)
        band = np.clip(1 - np.clip(y - Y, 0, None) / tongue, 0, 1) * (Y <= y + 4) * (Y > y - 60) * ((X > x0) & (X < x1))
        img += np.array([1.0, 0.45, 0.1])[None, None] * band[..., None] * 0.55


# ================================================================================================ HUD

def hud(img, view, st):
    """Hearts and flasks top-left, weapon + abilities top-right, the boss bar at the bottom."""
    w, h = view.w, view.h
    im = Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    K = view.K
    pix = st['pixel']

    def R(x0, y0, x1, y1, fill, r=8, outline=None, width=2):
        box = [view.to((x0, y0)), view.to((x1, y1))]
        if pix:
            d.rectangle(box, fill=fill, outline=outline, width=max(1, int(width * K)))
        else:
            d.rounded_rectangle(box, radius=r * K, fill=fill, outline=outline, width=max(1, int(width * K)))
    R(30, 28, 560, 120, (18, 14, 26, 200), 14, (200, 170, 110, 255), 3)
    R(100, 46, 540, 76, (60, 20, 30, 255), 6)
    R(100, 46, 430, 76, (226, 60, 70, 255), 6)
    d.ellipse([view.to((48, 40)), view.to((88, 80))], fill=(226, 60, 70, 255))
    for i in range(3):
        x = 104 + i * 42
        d.ellipse([view.to((x, 84)), view.to((x + 28, 112))], fill=(240, 110, 140, 255) if i < 2 else (70, 50, 70, 255),
                  outline=(230, 230, 240, 255), width=max(1, int(2 * K)))
    for i, x in enumerate((1640, 1730, 1820)):
        R(x - 6, 28, x + 76, 110, (18, 14, 26, 210), 12, (200, 170, 110, 255), 3)
    # icons: the Greatsword, a fire ability, a dash ability
    d.polygon([view.to(p) for p in ((1650, 96), (1700, 44), (1708, 52), (1658, 104))], fill=(210, 220, 236, 255))
    d.polygon([view.to(p) for p in ((1646, 88), (1660, 102), (1668, 94), (1654, 80))], fill=(236, 190, 70, 255))
    d.polygon([view.to(p) for p in ((1768, 100), (1750, 70), (1768, 40), (1786, 70))], fill=(255, 140, 50, 255))
    d.polygon([view.to(p) for p in ((1828, 56), (1880, 56), (1868, 70), (1880, 84), (1828, 84), (1840, 70))], fill=(90, 220, 250, 255))
    # boss bar
    R(560, 1000, 1360, 1036, (18, 14, 26, 220), 10, (200, 170, 110, 255), 3)
    R(570, 1008, 1100, 1028, (200, 40, 40, 255), 6)
    try:
        f = ImageFont.truetype(FONT, max(10, int(26 * K)))
        d.text(view.to((960, 984)), 'THE RED DRAGON', font=f, fill=(250, 230, 200, 255), anchor='ms',
               stroke_width=max(1, int(3 * K)), stroke_fill=(20, 10, 10, 255))
    except OSError:
        pass
    im.alpha_composite(ov)
    return np.asarray(im.convert('RGB')).astype(np.float32) / 255


# ================================================================================================ the renderer

def render(style, scale=1.0, region=(0, 0, W, H)):
    st = STY[style]
    if style == 'D':
        bgv = View(st['k'] * st['ss'] * scale, region)
        bg = background(bgv, STY['C'], True)
        light_rays(bg, bgv, STY['C'])
        bgim = _to_img(bg, STY['C']['ss'])
        # characters and effects from B, drawn at B's pixels then placed on the painted background
        chv = View(STY['B']['k'] * scale, region)
        base = np.asarray(bgim.resize((chv.w, chv.h), Image.LANCZOS)).astype(np.float32) / 255
        img = _actors(base, chv, STY['B'])
        img = hud(img, chv, STY['C'])
        return _to_img(img, 1)
    view = View(st['k'] * st['ss'] * scale, region)
    img = background(view, st, style == 'C')
    light_rays(img, view, st)
    img = _actors(img, view, st)
    img = hud(img, view, st)
    out = _to_img(img, st['ss'])
    if st.get('palette'):
        out = out.quantize(colors=st['palette'], method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    return out


def _actors(img, view, st):
    dparts, dstrokes = dragon()
    back, front = nest()
    hparts, smear = hero()
    composite(img, render_object(view, back, None, st, outline=False))
    composite(img, render_object(view, dparts, dstrokes, st, telegraph=True))
    composite(img, render_object(view, front, None, st))
    composite(img, render_object(view, outcrop(), None, st))
    fire_effects(img, view, st)
    sm = render_object(view, smear, None, st, outline=False)
    if sm is not None:
        rgb, a, ox, oy = sm
        a = _blur(a, 1.5 * view.K) * 0.8 if not st['pixel'] else a * 0.75
        composite(img, (rgb, a, ox, oy))
    composite(img, render_object(view, hparts, None, st))
    # the hit-free moment: a cool rim around the hero so it reads against the warm scene
    return np.clip(img, 0, 1)


def _to_img(img, ss):
    im = Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8), 'RGB')
    if ss > 1:
        im = im.resize((im.width // ss, im.height // ss), Image.LANCZOS)
    return im


# ================================================================================================ outputs

NAMES = {'A': 'A  Fine pixel (1280 x 720 inside)', 'B': 'B  Tiny pixel, HD-2D (1920 x 1080 inside)',
         'C': 'C  Realistic painted (smooth)', 'D': 'D  Mix: painted background, tiny-pixel characters'}
HEAD_BOX = (560, 220, 1180, 620)          # the Dragon's head close-up (x2)
HERO_BOX = (1300, 500, 1580, 710)         # the hero close-up (x4)


def closeup(style, box, zoom):
    st = STY[style]
    bw, bh = box[2] - box[0], box[3] - box[1]
    if style == 'C':
        im = render(style, zoom, box)
    elif style == 'D':
        im = render(style, 1, box).resize((bw * zoom, bh * zoom), Image.NEAREST)
        bg = _to_img(_bg_only(box, zoom), 2)
        # repaint the smooth background at the zoom, keep the pixel characters
        im = _merge_bg(style, box, zoom, im)
    else:
        im = render(style, 1, box)
        im = im.resize((bw * zoom, bh * zoom), Image.NEAREST)
    return im


def _bg_only(box, zoom):
    v = View(2 * zoom, box)
    bg = background(v, STY['C'], True)
    light_rays(bg, v, STY['C'])
    return bg


def _merge_bg(style, box, zoom, pixel_im):
    """D close-up: the painted background at full zoom, the tiny-pixel actors on top, scaled with nearest."""
    bw, bh = box[2] - box[0], box[3] - box[1]
    bg = _to_img(_bg_only(box, zoom), 2)
    chv = View(1, box)
    empty = np.zeros((chv.h, chv.w, 3), np.float32)
    mask_img = _actors_mask(chv)
    big = pixel_im
    m = Image.fromarray((mask_img * 255).astype(np.uint8), 'L').resize((bw * zoom, bh * zoom), Image.NEAREST)
    bg.paste(big, (0, 0), m)
    return bg


def _actors_mask(view):
    """Where the B-style actors and effects cover the background (for the D close-up)."""
    st = STY['B']
    m = np.zeros((view.h, view.w), np.float32)
    dparts, dstrokes = dragon()
    back, front = nest()
    hparts, smear = hero()
    for parts in (back, dparts, front, outcrop(), hparts, smear):
        p = render_object(view, parts, None, st)
        if p is None:
            continue
        _rgb, a, ox, oy = p
        h, w = a.shape
        m[oy:oy + h, ox:ox + w] = np.maximum(m[oy:oy + h, ox:ox + w], a)
    return _dilate(m > 0.5, 1) | (m > 0.5)


def phone(im):
    """The whole 16:9 screen on an 844 x 390 phone in landscape (693 x 390, with side bars)."""
    out = Image.new('RGB', (844, 390), (0, 0, 0))
    out.paste(im.resize((693, 390), Image.LANCZOS), ((844 - 693) // 2, 0))
    return out


def contrast_report(images):
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    from art.contrast import oklab, dist, THRESHOLD
    lines = []
    for s, im in images.items():
        a = np.asarray(im.resize((W, H))).astype(np.float64)
        v = View(1)
        for name, parts in (('hero', hero()[0]), ('dragon head', [p for p in dragon()[0] if p[0] in ('scale', 'scale_lt', 'brow', 'horn')])):
            p = render_object(v, parts, None, STY['C'], outline=False)
            rgb, al, ox, oy = p
            m = np.zeros((H, W), bool)
            hh, ww = al.shape
            m[oy:oy + hh, ox:ox + ww] = al > 0.5
            whole = np.zeros((H, W), bool)                    # the ring must not count the Dragon's own body
            for part in (dragon()[0],):
                pp = render_object(v, part, None, STY['C'], outline=False)
                r2, a2, ox2, oy2 = pp
                whole[oy2:oy2 + a2.shape[0], ox2:ox2 + a2.shape[1]] |= a2 > 0.5
            ring = _dilate(m, 14) & ~m & (~whole if name != 'hero' else True)
            ma = np.array(oklab(a[m].T)).T.mean(axis=0)
            mb = np.array(oklab(a[ring].T)).T.mean(axis=0)
            dd = dist(ma, mb)
            lines.append(f'{s} {name} vs what is around it: {dd:.3f} {"PASS" if dd >= THRESHOLD else "FAIL"}')
    return lines


def sheet(images, heads, heroes, phones, sketch_path, path):
    """The sketch, the 4 scenes 2 x 2, then the close-ups and the phone versions."""
    font = ImageFont.truetype(FONT, 22)
    sw, sh = 900, 506
    pad, lab = 16, 34
    sk = Image.open(sketch_path).convert('RGB')
    skh = 2 * (sh + lab) + pad
    sk = sk.resize((int(sk.width * skh / sk.height), skh), Image.LANCZOS)
    hw = 440
    rows_h = lab + int(hw * 400 / 620) + pad + lab + int(hw * 210 / 280) + pad + lab + int(hw * 390 / 844)
    Wt = pad + sk.width + pad + 2 * (sw + pad)
    Ht = pad + skh + pad + rows_h + pad
    out = Image.new('RGB', (Wt, Ht), (22, 20, 28))
    d = ImageDraw.Draw(out)
    out.paste(sk, (pad, pad))
    d.text((pad + 8, pad + 8), 'Your sketch', font=font, fill=(30, 30, 40))
    x0 = pad + sk.width + pad
    for i, s in enumerate('ABCD'):
        x = x0 + (i % 2) * (sw + pad)
        y = pad + (i // 2) * (sh + lab + pad)
        d.text((x, y + 4), NAMES[s], font=font, fill=(240, 236, 226))
        out.paste(images[s].resize((sw, sh), Image.LANCZOS), (x, y + lab))
    y = pad + skh + pad
    for title, ims, ratio in (('Dragon close-up (2x)', heads, 400 / 620), ('Hero close-up (4x)', heroes, 210 / 280),
                              ('Phone size (844 x 390)', phones, 390 / 844)):
        hh = int(hw * ratio)
        for i, s in enumerate('ABCD'):
            x = pad + i * (hw + pad)
            d.text((x, y + 4), f'{s}  {title}', font=font, fill=(240, 236, 226))
            res = Image.NEAREST if s in 'AB' and title.startswith('Hero') else Image.LANCZOS
            out.paste(ims[s].resize((hw, hh), res), (x, y + lab))
        y += lab + hh + pad
    out.save(path)


def finish():
    """Re-make the phone versions, the contrast report and the sheet from the saved images."""
    docs = os.path.join(ROOT, 'docs', 'art')
    load = lambda n: Image.open(os.path.join(docs, n)).convert('RGB')
    images = {s: load(f'sketch_test_{s}.png') for s in 'ABCD'}
    heads = {s: load(f'sketch_test_{s}_dragon.png') for s in 'ABCD'}
    heroes = {s: load(f'sketch_test_{s}_hero.png') for s in 'ABCD'}
    phones = {}
    for s in 'ABCD':
        phones[s] = phone(images[s])
        phones[s].save(os.path.join(docs, f'sketch_test_{s}_phone.png'))
    lines = contrast_report(images)
    with open(os.path.join(docs, 'sketch_test_contrast.txt'), 'w', newline='\n') as f:
        f.write('# ART13b: OKLab distance of the hero and the Dragon from what is around them (FAIL below 0.15)\n')
        f.write('\n'.join(lines) + '\n')
    sheet(images, heads, heroes, phones, os.path.join(docs, 'sketch', 'user_sketch_03.png'),
          os.path.join(docs, 'sketch_test_compare.png'))
    return lines


def build():
    docs = os.path.join(ROOT, 'docs', 'art')
    images, heads, heroes, phones = {}, {}, {}, {}
    for s in 'ABCD':
        im = render(s)
        if im.size != (W, H):
            im = im.resize((W, H), Image.NEAREST)       # A: 1280 x 720 shown at 1.5x
        im.save(os.path.join(docs, f'sketch_test_{s}.png'))
        images[s] = im
        heads[s] = closeup(s, HEAD_BOX, 2)
        heads[s].save(os.path.join(docs, f'sketch_test_{s}_dragon.png'))
        heroes[s] = closeup(s, HERO_BOX, 4)
        heroes[s].save(os.path.join(docs, f'sketch_test_{s}_hero.png'))
        phones[s] = phone(im)
        phones[s].save(os.path.join(docs, f'sketch_test_{s}_phone.png'))
        print('done', s, flush=True)
    lines = contrast_report(images)
    with open(os.path.join(docs, 'sketch_test_contrast.txt'), 'w', newline='\n') as f:
        f.write('# ART13b: OKLab distance of the hero and the Dragon from what is around them (FAIL below 0.15)\n')
        f.write('\n'.join(lines) + '\n')
    sheet(images, heads, heroes, phones, os.path.join(docs, 'sketch', 'user_sketch_03.png'),
          os.path.join(docs, 'sketch_test_compare.png'))
    return lines


if __name__ == '__main__':
    if sys.argv[1:] == ['finish']:
        print('\n'.join(finish()))
    elif len(sys.argv) > 1:                    # quick look: one style only
        render(sys.argv[1]).save(sys.argv[2])
    else:
        print('\n'.join(build()))
