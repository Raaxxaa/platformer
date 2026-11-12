"""ART13b: the detailed swamp example, version 2, after the user's swamp reference (docs/art/sketch/reference_07_swamps.png).

Realistic swamp trees and realistic light:
- trees: a far skyline of thin pines and dead snags, tall bald cypresses with leafy clumps and moss curtains, huge old
  trunks with flared buttress roots in front, a few crooked dead trees; no cartoon branches;
- light: one moon low behind the trees. Everything is backlit: layers get paler and mistier with distance, trees are
  silhouettes with a thin rim of moonlight, mist glows near the moon, still water mirrors the bright sky and the moon,
  mossy banks catch sky light on top. Only small warm accents (a lantern, a lit window) and the enemies' eyes.
640 x 360 inside, shown at 3x. Only writes docs/art/. Run: python3 tools/art/final_swamp.py"""
import math
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from art.style_test_sketch import taper, spoly, ell, cap, poly, fbm, _blur, _dilate  # noqa: E402
from art.stage_test import W, H, XX, YY, BAY, C, mask, fill, glow, actor, hud, hero, phone  # noqa: E402
from art.final_example import moss, lily, reeds, lantern, spider, witch, zombie, hut  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WATER = 252
HZ = 236                     # the horizon: where the far shore meets the water
MOON = (318, 92)
SKY_HI, SKY_LO, MIST = C('#16201c'), C('#a4b08e'), C('#b8c4a0')
NEAR = C('#0a110d')


def mix(a, b, t):
    return np.asarray(a, np.float32) * (1 - t) + np.asarray(b, np.float32) * t


def depth_col(d, tint=None):
    """The colour of a silhouette at depth d (0 = at the horizon mist, 1 = right in front)."""
    far = mix(SKY_LO, C('#5e6e58'), 0.35)
    c = mix(far, NEAR, d ** 0.8)
    if tint is not None:
        c = mix(c, tint, 0.25 * d)
    return c


# ============================================================================================== tree shapes

def leafy(m, seed, amount=0.7):
    """Turn a smooth blob mask into a leafy, ragged one."""
    b = _blur(m.astype(np.float32), 1.6)
    n = fbm(XX / 3.2, YY / 3.2, 3, seed)
    return (b + (n - 0.5) * amount) > 0.5


def pine(x, base, h, w, rng):
    """A thin conifer: a straight trunk and ragged tiers of needles getting smaller to the top."""
    trunk = [taper([(x, base + 2), (x + rng.normal(0, 0.6), base - h)], max(1.6, w * 0.55), 1.4, 2)]
    clumps = []
    tiers = int(rng.integers(5, 9))
    for k in range(tiers):
        t = (k + 1) / (tiers + 1)
        y = base - h * (0.25 + 0.75 * t)
        r = w * (1.6 - 1.2 * t) * rng.uniform(0.7, 1.2)
        clumps.append(poly((x - r, y + r * 0.5), (x + rng.normal(0, 0.4), y - r * 1.2), (x + r, y + r * 0.5)))
    return trunk, clumps


def crooked(S, x, y, ang, ln, wd, depth, rng, tips, kink=0.35):
    """A crooked old branch: bends at every joint, thins out, forks into twigs; records the tips (for clumps, moss)."""
    pts = [(x, y)]
    a = ang
    for k in range(4):
        a += rng.normal(0, kink)
        x, y = x + math.cos(a) * ln / 4, y + math.sin(a) * ln / 4
        pts.append((x, y))
    S.append(taper(pts, max(1.0, wd), max(0.8, wd * 0.35), 4))
    tips.append((x, y))
    if depth > 0:
        for _ in range(int(rng.integers(2, 4))):
            j = int(rng.integers(1, 4))
            crooked(S, pts[j][0], pts[j][1], a + rng.choice([-1, 1]) * rng.uniform(0.35, 1.0) - 0.15, ln * rng.uniform(0.45, 0.7),
                    wd * 0.55, depth - 1, rng, tips, kink)
    elif rng.random() < 0.5:                                     # a dead twig flicking off the end
        S.append(taper([(x, y), (x + math.cos(a + 0.6) * 4, y + math.sin(a + 0.6) * 4)], 1.0, 0.8, 2))


def stubs(S, x, base, h, w, rng, n):
    """Broken-off branch stumps along an old trunk."""
    for _ in range(n):
        y = base - h * rng.uniform(0.2, 0.85)
        sd = rng.choice([-1, 1])
        ln = w * rng.uniform(0.6, 1.4)
        S.append(taper([(x, y), (x + sd * ln, y - ln * rng.uniform(0.1, 0.6))], w * rng.uniform(0.25, 0.4), w * 0.18, 2))


def snag(x, base, h, w, rng):
    """A dead tree: a tall bare trunk, a broken top, crooked dead branches and stumps."""
    S = [taper([(x, base + 2), (x + rng.normal(0, 1.2), base - h * 0.5), (x + rng.normal(0, 2.0), base - h)], w, max(1.0, w * 0.4), 4)]
    tips = []
    for k in range(int(rng.integers(3, 6))):
        y = base - h * rng.uniform(0.4, 0.95)
        sd = rng.choice([-1, 1])
        crooked(S, x, y, -math.pi / 2 + sd * rng.uniform(0.6, 1.3), h * rng.uniform(0.12, 0.25), max(1.2, w * 0.45), 1, rng, tips, 0.5)
    stubs(S, x, base, h, w, rng, 2)
    return S


FORMS = ['normal', 'lean', 'twin', 'squat', 'skinny', 'hollow']
TEMPLATES = FORMS + ['giant', 'banyan', 'willow', 'mangrove', 'triple', 'broken']


def _crown(rng, tips, clumps, anchors, wc, p=0.55):
    for (tx, ty) in tips:
        anchors.append((tx, ty + 1))
        if rng.random() < p:
            r = wc * rng.uniform(0.9, 1.6)
            clumps.append(ell(tx + rng.normal(0, 1), ty + rng.normal(0, 1), r * rng.uniform(1.0, 1.6), r, rng.uniform(-30, 30), 14))
            anchors += [(tx + rng.uniform(-r, r), ty + r * 0.6) for _ in range(3)]


def giant(x, base, h, w, rng):
    """A giant: an enormous trunk with great buttress roots spreading wide, thick low limbs, its top out of the frame."""
    S = [taper([(x - w * 2.2, base + 4), (x - w * 0.8, base - h * 0.15), (x, base - h * 0.6), (x + rng.normal(0, w * 0.3), base - h)],
               w * 3.2, w * 1.3, 6)]
    for k in range(7):
        sd = -1 + k / 3
        S.append(taper([(x + sd * w * 0.6, base - w * rng.uniform(1.2, 3.0)), (x + sd * w * 1.6, base - w * 0.6),
                        (x + sd * w * rng.uniform(2.6, 4.2), base + 4)], w * rng.uniform(0.6, 1.0), 3, 6))
    stubs(S, x, base, h, w, rng, 4)
    clumps, anchors, tips = [], [], []
    for k in range(int(rng.integers(4, 7))):
        y = base - h * rng.uniform(0.45, 1.0)
        sd = rng.choice([-1, 1])
        crooked(S, x, y, -math.pi / 2 + sd * rng.uniform(0.7, 1.4), 9 * rng.uniform(4, 8), w * 0.7, 2, rng, tips, 0.3)
    _crown(rng, tips, clumps, anchors, 9)
    return S, clumps, anchors, (x, base - w * 1.4, w * 0.7, w * 1.5)


def banyan(x, base, h, w, rng):
    """A banyan: a wide trunk, long level limbs, curtains of aerial roots dropping straight into the water."""
    S = [taper([(x - w * 1.5, base + 3), (x, base - h * 0.4), (x, base - h * 0.75)], w * 2.6, w * 1.2, 5)]
    clumps, anchors, tips = [], [], []
    for sd in (-1, 1):
        for k in range(2):
            y = base - h * (0.62 + k * 0.12)
            ln = w * rng.uniform(5, 8)
            pts = [(x, y), (x + sd * ln * 0.5, y - ln * 0.08 + rng.normal(0, 3)), (x + sd * ln, y + rng.normal(0, 4))]
            S.append(taper(pts, w * 0.75, w * 0.3, 5))
            for j in range(int(rng.integers(4, 8))):              # aerial roots, some reaching the water
                t = rng.uniform(0.2, 1.0)
                rx = x + sd * ln * t
                ry = y - ln * 0.05
                reach = base + 3 if rng.random() < 0.5 else ry + rng.uniform(20, 60)
                S.append(taper([(rx, ry), (rx + rng.normal(0, 1.5), (ry + reach) / 2), (rx + rng.normal(0, 2.5), reach)],
                               rng.uniform(1.4, 3.2), 1.0, 3))
            crooked(S, pts[-1][0], pts[-1][1], -math.pi / 2 + sd * 0.5, 9 * 3, w * 0.4, 1, rng, tips, 0.3)
    for k in range(10):                                          # a wide, heavy crown over everything
        clumps.append(ell(x + rng.uniform(-w * 7, w * 7), base - h * rng.uniform(0.75, 1.0), 9 * rng.uniform(1.4, 2.4), 9 * rng.uniform(1.0, 1.6), 0, 14))
    _crown(rng, tips, clumps, anchors, 8)
    anchors += [(x + rng.uniform(-w * 7, w * 7), base - h * 0.72) for _ in range(20)]
    return S, clumps, anchors, None


def willow(x, base, h, w, rng):
    """A weeping willow: a short leaning trunk, arching limbs, and long hanging curtains of leaves almost to the water."""
    lean = rng.choice([-1, 1]) * w * 1.5
    S = [taper([(x - w, base + 3), (x + lean * 0.4, base - h * 0.35), (x + lean, base - h * 0.6)], w * 2.0, w * 0.8, 5)]
    clumps, anchors, tips = [], [], []
    for k in range(int(rng.integers(6, 10))):
        a = -math.pi / 2 + rng.uniform(-1.3, 1.3)
        crooked(S, x + lean, base - h * 0.6, a, h * rng.uniform(0.25, 0.45), w * 0.45, 1, rng, tips, 0.3)
    for (tx, ty) in tips:                                        # the arching ends droop: leaf curtains hang from them
        clumps.append(ell(tx, ty + 4, 9 * rng.uniform(1.2, 1.8), 9 * rng.uniform(0.8, 1.2), 0, 14))
        anchors += [(tx + rng.uniform(-14, 14), ty + 8) for _ in range(8)]
    clumps.append(ell(x + lean, base - h * 0.75, w * 4, w * 2.4, 0, 18))
    return S, clumps, anchors, None


def mangrove(x, base, h, w, rng):
    """A mangrove: the trunk starts above the water on a cage of arched stilt roots, then a round crown."""
    top = base - h * 0.28
    S = [taper([(x, top + 4), (x + rng.normal(0, 2), base - h * 0.7), (x + rng.normal(0, 3), base - h)], w * 1.2, w * 0.5, 5)]
    for k in range(int(rng.integers(7, 11))):                     # prop roots arching out and down
        sd = rng.uniform(-1, 1)
        ex = x + sd * w * rng.uniform(3, 6)
        S.append(taper([(x + sd * w * 0.3, top + rng.uniform(-6, 6)), (x + sd * w * 2.2, top - rng.uniform(4, 14)), (ex, base + 3)],
                       rng.uniform(2.0, 3.6), 1.4, 5))
    clumps, anchors, tips = [], [], []
    for k in range(int(rng.integers(4, 7))):
        crooked(S, x, base - h * rng.uniform(0.6, 0.95), -math.pi / 2 + rng.uniform(-1.2, 1.2), 9 * rng.uniform(2.5, 4), w * 0.45, 1, rng, tips, 0.3)
    _crown(rng, tips, clumps, anchors, 8, 0.8)
    clumps.append(ell(x, base - h, w * 3, w * 2, 0, 16))
    return S, clumps, anchors, None


def triple(x, base, h, w, rng):
    """Three trunks splaying from one swollen base."""
    S = [ell(x, base - w, w * 2.2, w * 1.4, 0, 18)]
    clumps, anchors, tips = [], [], []
    for k, a in enumerate((-0.35, 0.0, 0.3)):
        ex = x + math.sin(a) * h * 0.6 + rng.normal(0, 4)
        hh = h * rng.uniform(0.75, 1.0)
        S.append(taper([(x + a * w * 2, base), (x + a * w * 2 + (ex - x) * 0.4, base - hh * 0.45), (ex, base - hh)], w * 0.95, w * 0.35, 5))
        for j in range(3):
            crooked(S, x + (ex - x) * (0.6 + j * 0.15), base - hh * (0.6 + j * 0.15), -math.pi / 2 + rng.uniform(-1.2, 1.2),
                    9 * rng.uniform(2, 4), w * 0.35, 1, rng, tips, 0.35)
    _crown(rng, tips, clumps, anchors, 8)
    return S, clumps, anchors, None


def broken(x, base, h, w, rng):
    """A storm-broken tree: the trunk snapped half way, a splintered stump, the fallen top leaning into the water."""
    sh = h * rng.uniform(0.45, 0.6)
    S = [taper([(x - w * 1.2, base + 3), (x, base - sh * 0.4), (x, base - sh)], w * 2.2, w * 0.9, 5),
         poly((x - w * 0.5, base - sh + 2), (x - w * 0.3, base - sh - 10), (x, base - sh - 3), (x + w * 0.2, base - sh - 14), (x + w * 0.5, base - sh + 2))]
    sd = rng.choice([-1, 1])
    S.append(taper([(x + sd * w, base - sh + 6), (x + sd * h * 0.35, base - sh * 0.5), (x + sd * h * 0.62, base + 4)], w * 0.8, w * 0.4, 5))
    tips = []
    for k in range(3):
        t = 0.4 + k * 0.2
        crooked(S, x + sd * h * 0.62 * t, base - sh * (1 - t) + 6, -math.pi / 2 + sd * 0.8, 9 * 2.5, w * 0.3, 1, rng, tips, 0.4)
    stubs(S, x, base, sh, w, rng, 2)
    return S, [], tips, None


SPECIAL = {'giant': giant, 'banyan': banyan, 'willow': willow, 'mangrove': mangrove, 'triple': triple, 'broken': broken}


def cypress(x, base, h, w, rng, form=None):
    """An old bald cypress in one of several forms (straight, leaning, split in two, squat and fat, tall and skinny,
    hollow at the base): a trunk flaring at the water, knees, many crooked limbs, a ragged crown, moss everywhere."""
    form = form or rng.choice(FORMS)
    if form in SPECIAL:
        return SPECIAL[form](x, base, h, w, rng)
    if form == 'squat':
        w, h = w * 1.5, h * 0.72
    elif form == 'skinny':
        w, h = w * 0.6, h * 1.12
    top_dx = rng.normal(0, w * 0.2)
    if form == 'lean':
        top_dx = rng.choice([-1, 1]) * w * rng.uniform(2.5, 5)
    flare = rng.uniform(1.2, 2.2)
    trunk = [taper([(x - w * flare * 0.6, base + 3), (x - w * 0.4, base - h * 0.12), (x + top_dx * 0.35, base - h * 0.5),
                    (x + top_dx, base - h)], w * flare, w * rng.uniform(0.35, 0.6), 6)]
    trunk.append(taper([(x + w * flare * 0.6, base + 3), (x + w * 0.4, base - h * 0.14), (x + top_dx * 0.3, base - h * 0.4)],
                       w * flare * 0.45, w * 0.4, 4))
    if form == 'twin':                                           # a second trunk splitting off low down
        sd = -1 if top_dx > 0 else 1
        trunk.append(taper([(x, base - h * 0.22), (x + sd * w * 1.6, base - h * 0.55), (x + sd * w * 3.0, base - h * 0.9)],
                           w * 0.7, w * 0.3, 5))
        x2 = x + sd * w * 3.0
    hole = None
    if form == 'hollow':
        hole = (x, base - w * 0.9, w * 0.45, w * 1.0)
    wc = min(w, 8.0)                                             # crowns and limbs keep a normal size on fat trunks
    for k in range(int(rng.integers(2, 5))):                     # cypress knees poking out of the water
        kx = x + rng.uniform(-w * 4, w * 4)
        trunk.append(taper([(kx, base + 3), (kx + rng.normal(0, 0.5), base - rng.uniform(2, 6))], rng.uniform(2, 3.4), 1, 2))
    stubs(trunk, x, base, h, w, rng, int(rng.integers(2, 5)))
    clumps, anchors, tips = [], [], []
    for k in range(int(rng.integers(5, 9))):
        t = rng.uniform(0.4, 1.0)
        y = base - h * t
        sd = rng.choice([-1, 1])
        bx = x + top_dx * t
        if form == 'twin' and k % 2:
            bx = x + (x2 - x) * min(1, t * 1.1)
        crooked(trunk, bx, y, -math.pi / 2 + sd * rng.uniform(0.5, 1.35), wc * rng.uniform(3, 6), min(w, 12) * 0.6, 2, rng, tips)
    for (tx, ty) in tips:                                        # ragged clumps on some branch ends, bare twigs on others
        anchors.append((tx, ty + 1))
        if rng.random() < 0.55:
            r = wc * rng.uniform(0.9, 1.6)
            clumps.append(ell(tx + rng.normal(0, 1), ty + rng.normal(0, 1), r * rng.uniform(1.0, 1.6), r, rng.uniform(-30, 30), 14))
            anchors += [(tx + rng.uniform(-r, r), ty + r * 0.6) for _ in range(3)]
    for j in range(int(rng.integers(2, 5))):                     # the broken top: a few ragged clumps
        cy_ = base - h + j * wc * 1.2 - wc
        r = wc * rng.uniform(1.0, 1.6) * (0.6 + j * 0.15)
        clumps.append(ell(x + top_dx + rng.normal(0, w * 0.8), cy_, r, r * 0.8, 0, 14))
    return trunk, clumps, anchors, hole


def old_tree(x, base, h, w, rng, side=1):
    """A huge old swamp tree right in front: a massive gnarled trunk, flared buttress roots, many crooked limbs."""
    S = [taper([(x, base + 6), (x + side * w * 0.2, base - h * 0.4), (x + side * w * 0.5, base - h)], w * 1.3, w * 0.7, 6)]
    for k in range(5):                                             # buttress roots
        s = [-1, -0.5, 0.3, 0.8, 1][k]
        S.append(taper([(x + s * w * 0.3, base - w * rng.uniform(0.6, 1.4)), (x + s * w * 0.9, base - w * 0.3),
                        (x + s * w * rng.uniform(1.4, 2.4), base + 6)], w * rng.uniform(0.35, 0.55), 3, 5))
    stubs(S, x + side * w * 0.2, base, h, w, rng, 3)
    clumps, anchors, tips = [], [], []
    for k in range(5):
        y = base - h * rng.uniform(0.4, 0.95)
        crooked(S, x + side * w * 0.3, y, math.pi * (0.5 + side * 0.5) * -1 + (-0.9 if side > 0 else 0.9) + rng.normal(0, 0.25),
                w * rng.uniform(2.2, 3.6), w * 0.42, 2, rng, tips, 0.3)
    for (tx, ty) in tips:
        anchors.append((tx, ty))
        if rng.random() < 0.55:
            r = w * rng.uniform(0.5, 0.9)
            clumps.append(ell(tx, ty, r * 1.4, r, rng.uniform(-20, 20), 16))
            anchors += [(tx + rng.uniform(-r, r), ty + r * 0.5) for _ in range(5)]
    return S, clumps, anchors


def old_details(img, m, x_hint, seed, d):
    """Signs of age on near trunks: knot holes, burls, shelf mushrooms, pale lichen speckles."""
    rng = np.random.default_rng(seed)
    ys, xs = np.nonzero(m & ~_dilate(~m, 3))
    if not len(xs):
        return
    for _ in range(int(len(xs) / 900) + 2):
        i = rng.integers(len(xs))
        x, y = xs[i], ys[i]
        kind = rng.random()
        if kind < 0.35:                                            # a knot hole
            fill(img, mask([ell(x, y, rng.uniform(1.5, 3.5), rng.uniform(2.5, 5), 0, 12)]) & m, NEAR * 0.5)
            img[max(0, y - 4), x] = img[max(0, y - 4), x] * 1.3
        elif kind < 0.65:                                          # shelf mushrooms, stacked
            for k in range(int(rng.integers(1, 4))):
                sh = mask([ell(x + 2, y + k * 4, rng.uniform(3, 5), 1.4, 0, 12)]) & (YY <= y + k * 4)
                fill(img, sh, mix(C('#a89a74'), NEAR, 0.4 * d))
                fill(img, sh & ~np.roll(sh, 1, 0), mix(C('#d8ccaa'), SKY_LO, 0.2))
        else:                                                      # a burl
            bm = mask([ell(x, y, rng.uniform(3, 6), rng.uniform(3, 5), 0, 14)]) & m
            fill(img, bm, img[y, x] * 1.15 if 0 <= y < H and 0 <= x < W else NEAR)
            fill(img, bm & ~np.roll(bm, -1, 0), NEAR * 0.6)
    lich = m & (fbm(XX / 2, YY / 2, 2, seed + 5) > 0.82)
    fill(img, lich, mix(C('#7a8a64'), SKY_LO, 0.25), 0.7)


def hanging_vines(img, pairs, col, leaf, seed, thick=2):
    """Lianas sagging between branches: two twisting strands, leaf clusters along them, loose ends dangling."""
    rng = np.random.default_rng(seed)
    col, leaf = np.asarray(col), np.asarray(leaf)
    for (a, b) in pairs:
        sag = rng.uniform(16, 38)
        n = int(abs(b[0] - a[0]) + abs(b[1] - a[1])) * 2 + 2
        for strand in range(2):
            ph = rng.uniform(0, 6)
            for k in range(n + 1):
                t = k / n
                x = a[0] + (b[0] - a[0]) * t
                y = a[1] + (b[1] - a[1]) * t + sag * 4 * t * (1 - t) + 1.4 * math.sin(t * 40 + ph) * (strand * 2 - 1)
                xi, yi = int(x), int(y)
                for dy in range(thick if strand == 0 else 1):
                    if 0 <= xi < W and 0 <= yi + dy < H:
                        img[yi + dy, xi] = col * (0.85 if strand else 1.0)
        for k in range(int(n / 9)):                               # leaf clusters
            t = rng.uniform(0.05, 0.95)
            x = a[0] + (b[0] - a[0]) * t
            y = a[1] + (b[1] - a[1]) * t + sag * 4 * t * (1 - t)
            for _ in range(int(rng.integers(3, 7))):
                lx, ly = int(x + rng.normal(0, 2.2)), int(y + abs(rng.normal(1.5, 2)))
                if 0 <= lx < W - 1 and 0 <= ly < H:
                    img[ly, lx:lx + 2] = leaf * rng.uniform(0.85, 1.15)
        for k in range(int(rng.integers(1, 4))):                   # loose ends hanging down
            t = rng.uniform(0.15, 0.85)
            x = int(a[0] + (b[0] - a[0]) * t)
            y = int(a[1] + (b[1] - a[1]) * t + sag * 4 * t * (1 - t))
            for j in range(int(rng.uniform(10, 34))):
                xx = int(x + math.sin(j / 5) * 1.2)
                if 0 <= xx < W - 1 and 0 <= y + j < H:
                    img[y + j, xx] = col
                    if j % 4 == 2:
                        img[y + j, xx + 1] = leaf


def climbing_vines(img, m, col, leaf, seed, n=3):
    """Ivy winding up a trunk."""
    rng = np.random.default_rng(seed)
    ys, xs = np.nonzero(m)
    if not len(xs):
        return
    for _ in range(n):
        i = rng.integers(len(xs))
        x0, y0 = xs[i], ys[i]
        ph = rng.uniform(0, 6)
        for k in range(int(rng.uniform(30, 90))):
            y = y0 - k
            x = int(x0 + 3 * math.sin(k / 6 + ph))
            if 0 <= y < H and 0 <= x < W and m[y, x]:
                img[y, x] = col
                if k % 3 == 0 and x + 1 < W:
                    img[y, x + 1] = leaf


# ============================================================================================== shading

def rim_light(img, m, strength, col=None, width=1):
    """Moonlight catching the edge of a silhouette: the side facing the moon, stronger near it."""
    col = SKY_LO * 1.15 if col is None else col
    left_of_moon = XX < MOON[0]
    toward = np.where(left_of_moon, np.roll(m, -width, 1), np.roll(m, width, 1))
    e = m & (~toward | ~np.roll(m, width, 0))
    near = np.clip(1 - np.hypot(XX - MOON[0], YY - MOON[1]) / 330, 0.15, 1)
    a = np.clip(strength * near, 0, 1)
    img[e] = img[e] * (1 - a[e, None]) + np.asarray(col) * a[e, None]


def bark_dark(img, m, col, seed):
    """Near-black bark: vertical grooves, slightly lighter on the moon side."""
    b = _blur(m.astype(np.float32), 4.0)
    gy, gx = np.gradient(b)
    face = np.clip(0.5 + 6 * (gx * np.sign(XX - MOON[0]) * -1), 0, 1)
    groove = fbm(XX / 2.0 + fbm(XX / 20, YY / 40, 2, seed) * 5, YY / 18, 3, seed + 1)
    v = 0.6 + 0.35 * face + (groove - 0.5) * 0.6
    q = np.floor(v * 4 + BAY * 0.8) / 4
    img[m] = (np.asarray(col)[None, None] * np.clip(q, 0.4, 1.4)[..., None])[m]


def foliage_shade(img, m, col, seed, d):
    """Leaf clumps: dark, with a lighter top where the sky hits them and a speckle of leaves."""
    top = m & ~np.roll(m, 2, 0)
    n = fbm(XX / 2.5, YY / 2.5, 2, seed)
    fill(img, m, col)
    fill(img, m & (n > 0.62), np.asarray(col) * 1.18)
    fill(img, m & (n < 0.3), np.asarray(col) * 0.82)
    fill(img, top, mix(col, SKY_LO, 0.35 * (1 - d) + 0.12), 0.8)


def mist(img, y, thick, a, seed, stretch=70):
    """A band of mist, glowing brighter close to the moon."""
    n = fbm(XX / stretch, YY / 6, 4, seed)
    band = np.clip(1 - np.abs(YY - y) / thick, 0, 1) ** 1.2
    v = np.clip(band * (0.35 + n), 0, 1)
    q = np.floor(v * 5 + BAY * 0.9) / 5
    near = np.clip(1 - np.abs(XX - MOON[0]) / 400, 0.3, 1)
    col = mix(MIST * 0.75, MIST * 1.1, near[..., None])
    aa = (q * a * near)[..., None]
    img[:] = img * (1 - aa) + col * aa


def layer(img, items, d, seed, kind_weights, moss_on=True, rim=0.6, leaf_tint=C('#2a3e2a')):
    """One depth layer: a mix of pines, snags and cypresses around depth d. Each tree gets its own form and a slightly
    different shade, so no two look alike. Items: (x, base, h, w) or (x, base, h, w, form)."""
    rng = np.random.default_rng(seed)
    for n_, it in enumerate(items):
        x, base, h, w = it[:4]
        form = it[4] if len(it) > 4 else None
        k = 'cypress' if form else rng.choice(['pine', 'snag', 'cypress'], p=kind_weights)
        trunks, clumps, anchors, hole = [], [], [], None
        if k == 'pine':
            t, c = pine(x, base, h, w, rng)
            trunks += t
            clumps += c
        elif k == 'snag':
            trunks += snag(x, base, h, w * 0.9, rng)
        else:
            t, c, a, hole = cypress(x, base, h, w, rng, form)
            trunks += t
            clumps += c
            anchors += a
        di = float(np.clip(d + rng.uniform(-0.07, 0.07), 0, 1))
        col = depth_col(di) * rng.uniform(0.9, 1.1)
        sd = seed + n_ * 7
        tm = mask(trunks)
        if d > 0.4:
            tm = tm | (leafy(tm, sd + 9, 0.35) & _dilate(tm, 1))         # rough, uneven bark edges
        cm = leafy(mask(clumps), sd, 1.0) if clumps else np.zeros((H, W), bool)
        cm &= ~((fbm(XX / 3.5, YY / 3.5, 2, sd + 4) < 0.3) & ~_dilate(~cm, 2))  # gaps in the crowns
        fill(img, tm, col * 0.95)
        if d > 0.5:
            bark_dark(img, tm, col * 1.1, sd)
        if hole is not None:
            hx, hy, hrx, hry = hole
            fill(img, mask([ell(hx, hy, hrx, hry, 0, 16)]) & tm, NEAR * 0.35)
        foliage_shade(img, cm, mix(col, leaf_tint, 0.3 * di), sd, di)
        if d > 0.45:
            old_details(img, tm, 0, sd + 3, di)
            climbing_vines(img, tm, mix(col, C('#3a5a30'), 0.5), mix(col, C('#5a7a44'), 0.5), sd + 6, 2)
        rim_light(img, tm | cm, rim * (1 - di * 0.4))
        if moss_on and anchors:
            moss(img, anchors, mix(col, C('#6a7a5a'), 0.35), mix(col, C('#8a9a74'), 0.4), sd, 1.6, int(30 + 70 * di))


def dead_tree(img, x, base, h, w, d, seed):
    """A big dead tree: a bare, cracked trunk with a broken top, crooked leafless limbs, a few rags of moss."""
    rng = np.random.default_rng(seed)
    S = [taper([(x - w * 1.2, base + 3), (x, base - h * 0.3), (x + rng.normal(0, w), base - h * 0.75), (x + rng.normal(0, w * 1.5), base - h)],
               w * 2.0, w * 0.5, 6)]
    tips = []
    for k in range(int(rng.integers(5, 8))):
        t = rng.uniform(0.35, 0.95)
        sd = rng.choice([-1, 1])
        crooked(S, x, base - h * t, -math.pi / 2 + sd * rng.uniform(0.6, 1.4), h * rng.uniform(0.14, 0.3), w * 0.5, 2, rng, tips, 0.45)
    stubs(S, x, base, h, w, rng, 3)
    m = mask(S)
    m = m | (leafy(m, seed, 0.3) & _dilate(m, 1))
    col = depth_col(d) * 1.05
    fill(img, m, col)
    if d > 0.45:
        bark_dark(img, m, col * 1.1, seed)
        cracks = m & (fbm(XX / 1.5, YY / 25, 2, seed + 2) > 0.7)
        fill(img, cracks, col * 0.55)
    # the broken top: a jagged splintered end
    tx, ty = x, base - h
    fill(img, mask([poly((tx - w * 0.6, ty + 4), (tx - w * 0.2, ty - 6), (tx + w * 0.1, ty), (tx + w * 0.5, ty - 9), (tx + w * 0.7, ty + 4))]), col)
    rim_light(img, m, 0.55 * (1 - d * 0.4))
    moss(img, tips[::3], mix(col, C('#6a7a5a'), 0.3), mix(col, C('#8a9a74'), 0.35), seed, 0.6, 30)


def fallen_log(img, x0, x1, y, w, seed):
    """A dead log lying half sunk in the water, with a broken branch sticking up and moss on top."""
    rng = np.random.default_rng(seed)
    S = [taper([(x0, y + 2), ((x0 + x1) / 2, y - 2), (x1, y + 4)], w, w * 0.6, 4),
         taper([((x0 + x1) / 2 + 10, y - 2), ((x0 + x1) / 2 + 16, y - 16), ((x0 + x1) / 2 + 13, y - 24)], 3, 1, 3)]
    m = mask(S)
    bark_dark(img, m, depth_col(0.75) * 1.2, seed)
    top = m & ~np.roll(m, 2, 0)
    fill(img, top & (fbm(XX / 4, YY / 4, 2, seed) > 0.4), C('#3e5a34'))
    fill(img, mask([ell(x0, y + 2, w * 0.35, w * 0.48, 0, 12)]), depth_col(0.75) * 0.6)      # the broken end
    rim_light(img, m, 0.4)


def graded_actor(img, parts, key, amb, pts, rim, flash=None, fog_a=0.22, dim=0.82):
    """Draw a character, then grade it into the scene: dimmer, a little mist over it, a soft dark-green outline
    instead of black, colours pulled towards the moonlit greens. Glowing eyes, staffs and the attack flash stay bright."""
    before = img.copy()
    actor(img, parts, key, amb, pts, rim=rim, outline='#0e1a12', flash=flash)
    ch = np.abs(img - before).sum(axis=2) > 0.01
    mx, mn = img.max(axis=2), img.min(axis=2)
    glowy = (mx > 0.8) & (mx - mn > 0.3)
    if flash is not None:
        glowy |= ch & (img[..., 0] > img[..., 2] + 0.25)
    g = ch & ~glowy
    lum = img[g].mean(axis=1, keepdims=True)
    tinted = lum * np.array([0.9, 1.05, 0.92], np.float32)
    img[g] = mix(img[g], tinted, 0.35) * dim
    img[g] = mix(img[g], MIST * 0.7, fog_a)
    # a soft moonlit edge on the top and moon side, so dark creatures still read against the dark
    inner = ch & _dilate(ch, 0) & ~(np.roll(ch, 1, 0) & np.roll(ch, -1, 0) & np.roll(ch, 1, 1) & np.roll(ch, -1, 1))
    side = np.where(XX < MOON[0], ~np.roll(ch, -1, 1), ~np.roll(ch, 1, 1))
    edge = ch & ~glowy & (~np.roll(ch, 1, 0) | side) & ~inner | (ch & ~glowy & ~np.roll(ch, 1, 0))
    img[edge] = mix(img[edge], C(rim), 0.45)


def grass_tufts(img, top, grass_col, seed, density=0.5, hmin=3, hmax=12, d=0.8):
    """Detailed grass: tufts of 4-9 curved blades in three tones (dark base, mid, a moonlit tip), seed heads, little
    ferns and a few pale flowers."""
    rng = np.random.default_rng(seed)
    ys, xs = np.nonzero(top)
    if not len(xs):
        return
    dark = mix(grass_col * 0.55, NEAR, 0.3)
    midc = grass_col
    tip = mix(grass_col * 1.35, SKY_LO * 1.1, 0.35)
    order = rng.permutation(len(xs))
    for i in order[:int(len(xs) * density / 3)]:
        bx, by = xs[i], ys[i]
        n = int(rng.integers(4, 10))
        base_h = rng.uniform(hmin, hmax)
        for b in range(n):
            hgt = base_h * rng.uniform(0.5, 1.1)
            spread = (b - n / 2) * rng.uniform(0.5, 1.2)
            curve = rng.uniform(-0.8, 0.8)
            steps = int(hgt) + 1
            for k in range(steps):
                t = k / max(1, steps - 1)
                x = int(round(bx + spread * t + curve * t * t * hgt * 0.4))
                y = int(round(by - k))
                if 0 <= x < W and 0 <= y < H:
                    img[y, x] = dark if t < 0.35 else (midc if t < 0.8 else tip)
        r = rng.random()
        if r < 0.12:                                                # a seed head
            x, y = int(bx + rng.uniform(-2, 2)), int(by - base_h * 1.2)
            if 1 <= y < H - 1 and 0 <= x < W:
                img[y - 1:y + 2, x] = mix(C('#8a7a4a'), SKY_LO, 0.3)
        elif r < 0.2:                                               # a little fern frond
            for k in range(6):
                for side in (-1, 1):
                    x, y = int(bx + side * (3 - k * 0.4)), int(by - k * 1.4 - 1)
                    if 0 <= x < W and 0 <= y < H:
                        img[y, x] = midc * 0.95
        elif r < 0.25:                                              # a pale flower
            x, y = int(bx), int(by - base_h * 0.8)
            if 0 <= x < W and 0 <= y < H:
                img[y, x] = mix(C('#e8e4c8'), SKY_LO, 0.4)


def bank(img, pts, seed, d, grass_col=C('#3e5a34')):
    """A mossy mound of earth at the water's edge: dark sides, a mossy top lit by the sky, grass and roots."""
    m = mask([spoly(*pts, n=6)])
    m = leafy(m, seed, 0.35)
    base = depth_col(d)
    fill(img, m, base)
    n = fbm(XX / 4, YY / 3, 3, seed)
    top = m & ~np.roll(m, 3, 0)
    top2 = m & ~np.roll(m, 6, 0)
    fill(img, top2 & (n > 0.35), mix(grass_col, base, 0.35))
    fill(img, top, mix(grass_col * 1.25, SKY_LO, 0.2))
    fill(img, m & (n > 0.7) & ~top2, base * 1.25)
    surface = m & ~np.roll(m, 1, 0)
    grass_tufts(img, surface, grass_col * 0.8, seed + 100, 1.6, 5, 16, d)          # the back row, taller
    grass_tufts(img, surface, grass_col, seed, 2.4, 3, 11, d)
    lower = m & ~np.roll(m, 9, 0) & ~surface
    grass_tufts(img, lower & (fbm(XX / 12, YY / 5, 2, seed) > 0.5), grass_col * 0.7, seed + 200, 0.6, 2, 7, d)
    return m


# ============================================================================================== the scene

def cabin(img, x, base, fogt, lights=True):
    """The witch's cabin on stilts: plank walls, a sagging mossy roof, a lit window, a porch with a lantern, a smoking
    chimney and a rowboat tied below."""
    f = lambda c: mix(c, depth_col(0.0), fogt)
    wood, dark, roofc, moss_c = f(C('#4a3e2c')), f(C('#1e1a12')), f(C('#33301e')), f(C('#4e6a3a'))
    top = base - 46
    for sx in (x - 30, x - 12, x + 8, x + 28):                          # stilts
        fill(img, mask([cap((sx, top + 30), (sx + (sx % 3 - 1), base + 2), 2.2)]), dark)
    fill(img, mask([poly((x - 36, top + 30), (x + 38, top + 30), (x + 38, top + 33), (x - 36, top + 33))]), wood)       # porch floor
    for k in range(-36, 38, 6):
        fill(img, mask([cap((x + k, top + 30), (x + k, top + 24), 0.8)]), dark)                                         # railing
    fill(img, mask([cap((x - 36, top + 24), (x + 38, top + 24), 0.8)]), dark)
    body = mask([poly((x - 26, top + 30), (x - 25, top + 4), (x + 26, top + 3), (x + 27, top + 30))])
    fill(img, body, wood)
    for k in range(-24, 27, 4):                                          # vertical boards
        fill(img, body & (np.abs(XX - (x + k)) < 0.5), dark)
    fill(img, body & (fbm(XX / 3, YY / 6, 2, 7) > 0.72), wood * 1.25)
    roof = mask([poly((x - 34, top + 6), (x - 6, top - 20), (x + 4, top - 18), (x + 36, top + 5), (x + 30, top + 8), (x - 30, top + 9))])
    fill(img, roof, roofc)
    for k in range(6):                                                   # shingle rows
        fill(img, roof & (np.abs(YY - (top - 14 + k * 4)) < 0.5), dark)
    fill(img, roof & (fbm(XX / 4, YY / 4, 2, 8) > 0.55), moss_c)
    moss(img, [(xx, top + 8) for xx in range(x - 30, x + 32, 5)], f(C('#3a4a30')), f(C('#5a6a46')), 5, 1.2, 14)
    fill(img, mask([poly((x + 14, top - 14), (x + 21, top - 14), (x + 22, top - 2), (x + 15, top - 2))]), dark)        # chimney
    for k in range(5 if lights else 0):                                  # smoke drifting
        glow(img, x + 18 + k * 5, top - 20 - k * 6, 7 + k * 2, f(C('#8a9480')) * 0.5, 0.35)
    wx, wy_ = x - 16, top + 10                                           # the lit window
    img[wy_:wy_ + 9, wx:wx + 9] = C('#ffb84a')
    img[wy_ + 4, wx:wx + 9] = C('#6a3a12')
    img[wy_:wy_ + 9, wx + 4] = C('#6a3a12')
    img[wy_ + 9, wx - 1:wx + 10] = dark
    if lights:
        glow(img, wx + 4, wy_ + 4, 40, C('#ff9a3a'), 0.4)
    fill(img, mask([poly((x + 4, top + 30), (x + 4, top + 12), (x + 14, top + 12), (x + 14, top + 30))]), dark)     # door
    img[top + 21, x + 12] = C('#a89a74')
    lx, ly = x - 32, top + 14                                            # porch lantern
    fill(img, mask([cap((lx, top + 6), (lx, ly), 0.6)]), dark)
    img[ly:ly + 4, lx - 1:lx + 2] = C('#ffcf6a')
    if lights:
        glow(img, lx, ly + 2, 22, C('#ff9a3a'), 0.45)
    boat = mask([poly((x - 40, base - 1), (x - 6, base - 1), (x - 10, base + 3), (x - 36, base + 3))])                 # rowboat
    fill(img, boat, f(C('#3a2a1c')))
    fill(img, boat & ~np.roll(boat, 1, 0), f(C('#6a5236')))
    fill(img, mask([cap((x - 6, base - 1), (x - 2, top + 32), 0.5)]), dark)                                           # rope



def far_cabin(img, x, base, s, fogt):
    """The cabin shrunk to distance s (1 = full size): drawn full size off-screen, scaled down, pasted, lights added."""
    cx, cb = 320, 300
    blk, wht = np.zeros((H, W, 3), np.float32), np.ones((H, W, 3), np.float32)
    cabin(blk, cx, cb, fogt, lights=False)
    cabin(wht, cx, cb, fogt, lights=False)
    a = np.clip(1 - (wht - blk).mean(axis=2), 0, 1)
    ys, xs = np.nonzero(a > 0.01)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([blk[y0:y1, x0:x1], a[y0:y1, x0:x1]])
    sw, sh = max(1, round((x1 - x0) * s)), max(1, round((y1 - y0) * s))
    chans = [np.asarray(Image.fromarray(rgba[..., k].astype(np.float32), 'F').resize((sw, sh), Image.BOX)) for k in range(4)]
    col, al = np.dstack(chans[:3]), np.clip(chans[3], 0, 1)
    al = np.where(al > 0.35, 1.0, 0.0)                                   # keep hard pixel edges
    col = col / np.maximum(chans[3], 1e-3)[..., None]
    px, py = int(round(x + (x0 - cx) * s)), int(round(base + (y0 - cb) * s))
    reg = img[py:py + sh, px:px + sw]
    reg[:] = reg * (1 - al[..., None]) + np.clip(col, 0, 1) * al[..., None]
    top = cb - 46
    wx, wy_ = x + (cx - 16 + 4 - cx) * s, base + (top + 14 - cb) * s
    glow(img, wx, wy_, 40 * s, C('#ff9a3a'), 0.45)
    glow(img, x + (-32) * s, base + (top + 16 - cb) * s, 22 * s, C('#ff9a3a'), 0.4)
    for k in range(5):
        glow(img, x + (18 + k * 5) * s, base + (top - 20 - k * 6 - cb) * s, (7 + k * 2) * s, mix(C('#8a9480'), depth_col(0), fogt) * 0.5, 0.35)


def scene():
    # sky: dark at the top, a pale glow around the low moon
    t = np.clip(YY / WATER, 0, 1)
    img = mix(SKY_HI, SKY_LO * 0.85, (t ** 1.6)[..., None]).astype(np.float32)
    img = np.floor(img * 24 + BAY[..., None] * 0.9) / 24
    dm = np.hypot(XX - MOON[0], YY - MOON[1])
    img += (C('#dce6c4') * 0.55) * (np.clip(1 - dm / 220, 0, 1) ** 2)[..., None]
    cl = fbm(XX / 90, YY / 14, 4, 5)                               # thin clouds crossing the moon
    clouds = (cl > 0.6) & (YY < 150)
    fill(img, clouds, mix(SKY_LO * 0.7, C('#dce6c4'), np.clip(1 - dm / 160, 0, 1))[clouds] if False else SKY_LO * 0.75, 0.45)
    mm = dm < 24
    fill(img, mm, C('#eef2dc'))
    fill(img, mm & (fbm(XX / 7, YY / 7, 3, 9) > 0.58), C('#d4dcc0'))
    fill(img, clouds & (dm < 60), C('#c8d2b4'), 0.5)
    # the water: one still surface from the horizon down, mirroring the sky; every plane below adds its own reflection
    objs = np.zeros((H, W), bool)
    wy = YY >= HZ
    src = np.clip(2 * HZ - YY, 0, H - 1).astype(int)
    depth = np.clip((YY - HZ) / 120, 0, 1)
    sky_refl = img[src, XX.astype(int)]
    img[wy] = (sky_refl * (0.7 - 0.4 * depth[..., None]) + C('#050a08') * (0.3 + 0.4 * depth[..., None]))[wy]
    wob = fbm(XX / 6, YY / 2, 2, 13)
    streak = wy & (np.abs(XX - MOON[0] + (wob - 0.5) * 10) < 16 - (YY - HZ) * 0.07) & (fbm(XX / 5, YY / 1.5, 2, 14) > 0.5)
    fill(img, streak, C('#e0e8cc'), 0.55)
    rng = np.random.default_rng(2)

    def plane(base, draw, refl=0.55):
        """Draw one distance plane, then mirror it in the water about its own waterline."""
        nonlocal objs
        before = img.copy()
        draw()
        ch = np.abs(img - before).sum(axis=2) > 0.004
        objs |= ch
        sy = (2 * base - YY).astype(int)
        rip = (np.sin(YY * 1.9 + np.sin(XX / 13)) * np.clip(YY - base, 0, None) / 50).astype(int)
        sx = np.clip(XX.astype(int) + rip, 0, W - 1)
        ok = (YY > base) & (sy >= 0) & ~ch
        syc = np.clip(sy, 0, H - 1)
        hit = ok & ch[syc, sx]
        dk = np.clip((YY - base) / 140, 0, 1)
        col = img[syc, sx] * (refl - 0.25 * dk[..., None]) + C('#050a08') * (1 - refl + 0.25 * dk[..., None])
        img[hit] = col[hit]

    # plane 0: the far shore at the horizon, a ridge of tiny pines and snags
    def p0():
        ridge = HZ - 8 - 8 * fbm(XX[0] / 40, np.zeros(W), 3, 3) * 2
        fill(img, (YY > ridge[None, :]) & (YY <= HZ), depth_col(0.08))
        layer(img, [(rng.uniform(-10, W + 10), HZ, rng.uniform(22, 60), rng.uniform(2.5, 4)) for _ in range(46)], 0.08, 11,
              [0.6, 0.35, 0.05], moss_on=False, rim=0.25)
    plane(HZ, p0, 0.5)
    mist(img, HZ - 6, 18, 0.8, 3)
    # plane 1: small trees standing in the water far away
    def p1():
        layer(img, [(x, 244, rng.uniform(50, 100), rng.uniform(3.5, 5.0)) for x in
                    (14, 70, 118, 172, 214, 424, 464, 504, 548, 590, 630)], 0.24, 12, [0.4, 0.3, 0.3], rim=0.4)
        far_cabin(img, 372, 244, 0.5, 0.62)                       # the cabin, far across the water
    plane(244, p1)
    mist(img, 240, 14, 0.7, 4)
    # plane 2: the cabin on stilts in a clearing, a few trees around it, eyes in the dark
    def p2():
        layer(img, [(150, 254, 120, 5.5), (226, 254, 140, 6), (470, 254, 130, 6), (560, 254, 110, 5.5)], 0.38, 13, [0.3, 0.2, 0.5], rim=0.45)
    plane(254, p2, 0.6)
    for (x, y, c) in ((198, 232, '#ff3a2a'), (520, 236, '#ffc84a')):
        img[y, x] = img[y, x + 3] = C(c)
        glow(img, x + 1.5, y, 5, C(c), 0.3)
    mist(img, 250, 12, 0.6, 5)
    # plane 3: big old trees in the middle distance
    plane(268, lambda: (layer(img, [(110, 268, 170, 9, 'banyan'), (250, 268, 150, 7, 'willow'), (488, 268, 160, 7, 'broken')], 0.52, 21,
                                [0, 0, 1], rim=0.55), dead_tree(img, 300, 268, 190, 6, 0.5, 81)), 0.55)
    mist(img, 264, 10, 0.45, 6)
    # plane 4: closer trees at the sides, a fallen log
    plane(286, lambda: (layer(img, [(30, 286, 250, 10, 'hollow'), (196, 286, 230, 6, 'skinny'), (540, 286, 210, 8, 'mangrove')], 0.66, 22,
                                [0, 0, 1], rim=0.6), dead_tree(img, 612, 286, 230, 8, 0.64, 83), fallen_log(img, 400, 520, 288, 8, 91)), 0.5)
    ripl = wy & ~objs & (np.sin(XX / 9 + YY * 1.7) > 0.95) & (fbm(XX / 30, YY / 4, 2, 7) > 0.55)
    fill(img, ripl, mix(SKY_LO, NEAR, 0.4), 0.45)
    # big cypresses at the sides, in front of the water
    plane(306, lambda: layer(img, [(96, 306, 360, 16, 'giant'), (566, 308, 320, 11, 'triple')], 0.8, 31, [0.0, 0.0, 1.0], rim=0.7), 0.45)
    # mossy banks and the half-sunken boardwalk between them
    plane(300, lambda: (bank(img, [(-20, 300), (-10, 266), (60, 258), (140, 262), (196, 276), (214, 300)], 41, 0.82),
                        bank(img, [(450, 300), (470, 270), (530, 262), (600, 260), (660, 266), (660, 300)], 42, 0.82)), 0.4)
    from art.final_example import boardwalk
    sub = img.copy()
    boardwalk(sub, 190, 470, 270, broken=(300, 326))
    region = np.zeros((H, W), bool)
    region[256:300, 190:470] = True
    changed = region & (np.abs(sub - img).sum(axis=2) > 0.01)
    img[changed] = mix(sub[changed], depth_col(0.85), 0.35)             # the walkway sits in the same night light
    lily(img, 240, 318, 9, True)
    lily(img, 380, 330, 11, False)
    lily(img, 300, 346, 8, True)
    reeds(img, 196, 290, 12, 3, 0.2)
    reeds(img, 455, 286, 10, 4, 0.2)
    lantern(img, 412, 270)
    # front: two huge old trees with buttress roots, cropped by the frame, and grass silhouettes
    rng2 = np.random.default_rng(51)
    for (x, side, sd) in ((-8, 1, 61), (650, -1, 62)):
        S, cl_, an = old_tree(x + side * 10, 304, 330, 48, rng2, side)
        tm = mask(S)
        tm = tm | (leafy(tm, sd + 9, 0.35) & _dilate(tm, 1))
        bark_dark(img, tm, C('#141a14'), sd)
        old_details(img, tm, x, sd + 3, 0.95)
        climbing_vines(img, tm, C('#1e2e1a'), C('#2e4426'), sd + 6, 6)
        cm = leafy(mask(cl_), sd, 1.0)
        cm &= ~((fbm(XX / 3.5, YY / 3.5, 2, sd + 4) < 0.3) & ~_dilate(~cm, 2))
        foliage_shade(img, cm, C('#141e14'), sd, 0.95)
        rim_light(img, tm | cm, 0.35, width=1)
        moss(img, an, C('#2a3426'), C('#3a4632'), sd, 2.0, 110)
    # lianas sagging between the trees, near and far
    hanging_vines(img, [((20, 30), (160, 20)), ((160, 20), (300, 56)), ((420, 40), (560, 18)), ((560, 18), (640, 50)),
                        ((90, 70), (230, 90))], C('#141e14'), C('#2a3a24'), 71)
    hanging_vines(img, [((240, 120), (330, 140)), ((400, 110), (480, 130))], mix(depth_col(0.55), C('#3a5030'), 0.3),
                  mix(depth_col(0.55), C('#5a7044'), 0.3), 72)
    rng4 = np.random.default_rng(23)
    for cxg in (20, 90, 150, 480, 560, 620):                             # dark grass clumps along the bottom corners
        for _ in range(26):
            bx = cxg + rng4.normal(0, 14)
            hgt = rng4.uniform(8, 26)
            lean = rng4.uniform(-6, 6)
            bm = mask([taper([(bx, H + 1), (bx + lean * 0.5, H - hgt * 0.6), (bx + lean, H - hgt)], 2.4, 0.6, 3)])
            fill(img, bm, NEAR * 0.8)
            e = bm & ~np.roll(bm, -1 if bx < MOON[0] else 1, 1)
            fill(img, e & (YY < H - hgt * 0.35), mix(C('#4a6a40'), SKY_LO, 0.3), 0.8)
    # characters: backlit by the moon (dim, with a rim), warmed by the lantern
    key = {'dir': (0.0, -0.7, 0.5), 'col': (0.42, 0.48, 0.4)}
    amb = (0.18, 0.22, 0.2)
    pts = [(420, 254, 130, (1.0, 0.62, 0.28), 0.9), (MOON[0], MOON[1], 500, (0.5, 0.55, 0.45), 0.3)]
    graded_actor(img, witch(540, 262), key, amb, pts + [(530, 214, 70, (0.5, 1.0, 0.4), 1.4)], '#b8f0a0', fog_a=0.08, dim=1.08)
    glow(img, 532, 212, 30, C('#90ff60'), 0.45)
    graded_actor(img, spider(150, 150, 1.6), key, amb, pts, '#c8d8b0', fog_a=0.12, dim=0.95)
    graded_actor(img, zombie(330, 288), key, amb, pts, '#b8c8a4', flash='#ff8a2a')
    for k in range(3):
        r = 12 + k * 7
        rr = mask([ell(330, 289, r, r * 0.22, 0, 24)]) & ~mask([ell(330, 289, r - 1.4, r * 0.22 - 0.8, 0, 24)])
        fill(img, rr & (YY > 288), C('#9aa88a'), 0.5 - k * 0.13)
    graded_actor(img, hero(250, 244, 1), key, amb, pts, '#dce6c4', fog_a=0.1, dim=0.92)
    near_camera(img)
    rng3 = np.random.default_rng(17)
    for _ in range(14):                                                  # a few fireflies, small and soft
        fx, fy = rng3.uniform(150, 520), rng3.uniform(150, 260)
        glow(img, fx, fy, 6, C('#d8f08a'), 0.3)
        img[int(fy), int(fx)] = C('#f0ffc0')
    v = np.clip(np.hypot((XX - 320) / 360, (YY - 170) / 230) - 0.45, 0, 1)
    img[:] = img * (1 - 0.6 * v[..., None])
    img[:] = np.clip(img, 0, 1.15)
    hud(img)
    return img


def near_camera(img):
    """Things right in front of the camera: huge dark branches reaching in from the top corners with vines and moss
    hanging close, big fern fronds and a broken stump in the bottom corners. Almost black, lit only at the edges."""
    rng = np.random.default_rng(101)
    col, rimc = C('#070c09'), mix(C('#4a5e44'), SKY_LO, 0.25)
    S, tips = [], []
    crooked(S, -10, 70, -0.25, 300, 22, 2, rng, tips, 0.25)
    crooked(S, 650, 40, math.pi + 0.35, 240, 20, 2, rng, tips, 0.25)
    m = mask(S)
    m = m | (leafy(m, 5, 0.3) & _dilate(m, 1))
    fill(img, m, col)
    e = m & ~np.roll(m, 1, 0)
    fill(img, e, rimc, 0.7)
    moss(img, tips + [(x, 76 + 6 * math.sin(x / 9)) for x in range(10, 240, 9)] + [(x, 50 + (650 - x) * 0.3) for x in range(470, 640, 9)],
         C('#0c1610'), C('#18261a'), 103, 0.9, 85)
    hanging_vines(img, [((0, 20), (210, 60)), ((440, 10), (640, 70))], C('#060a08'), C('#152015'), 104, thick=3)
    for (x, y, sd) in ((60, 330, 1), (600, 336, -1), (150, 360, 1)):          # big fern fronds
        for k in range(7):
            a = -math.pi / 2 + sd * (-0.9 + k * 0.3)
            ln = rng.uniform(40, 70)
            fx, fy = x + math.cos(a) * ln, y + math.sin(a) * ln
            fm = mask([taper([(x, y), ((x + fx) / 2 + sd * 6, (y + fy) / 2 - 8), (fx, fy)], 6, 1, 4)])
            for j in range(9):                                            # leaflets along the frond
                t = 0.15 + j * 0.09
                lx, ly = x + (fx - x) * t, y + (fy - y) * t - 8 * math.sin(math.pi * t)
                fm |= mask([ell(lx - 3, ly + 2, 4.5, 1.6, 30, 8), ell(lx + 3, ly + 2, 4.5, 1.6, -30, 8)])
            fill(img, fm, col)
            fill(img, fm & ~np.roll(fm, 1, 0), rimc, 0.5)
    stump = mask([spoly((520, 362), (524, 318), (536, 300), (548, 312), (556, 296), (566, 318), (572, 362), n=3)])
    fill(img, stump, C('#0a100c'))
    fill(img, stump & ~np.roll(stump, 1, 1), rimc, 0.6)


SIZES = {'normal': (210, 8), 'lean': (200, 8), 'twin': (210, 8), 'squat': (200, 12), 'skinny': (230, 7), 'hollow': (220, 16),
         'giant': (300, 14), 'banyan': (200, 11), 'willow': (170, 9), 'mangrove': (180, 8), 'triple': (210, 9), 'broken': (220, 9)}


def template_sheet(path):
    """Every tree template on its own, in the same moonlit mist, so they can be compared."""
    from PIL import ImageDraw, ImageFont
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
    cells = []
    for i, form in enumerate(TEMPLATES):
        t = np.clip(YY / WATER, 0, 1)
        img = mix(SKY_HI, SKY_LO * 0.85, (t ** 1.6)[..., None]).astype(np.float32)
        img += (C('#dce6c4') * 0.4) * (np.clip(1 - np.hypot(XX - 320, YY - 90) / 220, 0, 1) ** 2)[..., None]
        mist(img, WATER - 10, 24, 0.6, 4)
        img[YY >= WATER] = img[YY >= WATER] * 0.4 + C('#0a120e') * 0.6
        h, w = SIZES[form]
        layer(img, [(320, WATER + 2, h, w, form)], 0.62, 300 + i * 11, [0, 0, 1])
        im = Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8), 'RGB').crop((120, 0, 520, 300)).resize((400 * 2, 300 * 2), Image.NEAREST)
        cells.append((form, im))
    cw, ch, pad, lab = 800, 600, 12, 36
    out = Image.new('RGB', (4 * (cw + pad) + pad, 3 * (ch + lab + pad) + pad), (16, 14, 22))
    d = ImageDraw.Draw(out)
    for i, (form, im) in enumerate(cells):
        x, y = pad + (i % 4) * (cw + pad), pad + (i // 4) * (ch + lab + pad)
        d.text((x, y + 6), form, font=font, fill=(240, 236, 226))
        out.paste(im, (x, y + lab))
    out.save(path)


def build():
    docs = os.path.join(ROOT, 'docs', 'art')
    template_sheet(os.path.join(docs, 'final_example_swamp_trees.png'))
    img = scene()
    im = Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8), 'RGB')
    big = im.resize((W * 3, H * 3), Image.NEAREST)
    big.save(os.path.join(docs, 'final_example_swamp_v2.png'))
    phone(big).save(os.path.join(docs, 'final_example_swamp_v2_phone.png'))
    big.crop((150 * 3, 150 * 3, 470 * 3, 330 * 3)).resize((320 * 5, 180 * 5), Image.NEAREST).save(
        os.path.join(docs, 'final_example_swamp_v2_closeup.png'))


if __name__ == '__main__':
    build()
