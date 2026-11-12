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
    trunk = [taper([(x, base + 2), (x + rng.normal(0, 0.6), base - h)], max(1.2, w * 0.35), 1.0, 2)]
    clumps = []
    tiers = int(rng.integers(5, 9))
    for k in range(tiers):
        t = (k + 1) / (tiers + 1)
        y = base - h * (0.25 + 0.75 * t)
        r = w * (1.6 - 1.2 * t) * rng.uniform(0.7, 1.2)
        clumps.append(poly((x - r, y + r * 0.5), (x + rng.normal(0, 0.4), y - r * 1.2), (x + r, y + r * 0.5)))
    return trunk, clumps


def snag(x, base, h, w, rng):
    """A dead tree: a tall bare trunk, a broken top and a few short stubby branches."""
    S = [taper([(x, base + 2), (x + rng.normal(0, 1.2), base - h * 0.5), (x + rng.normal(0, 2.0), base - h)], w, max(1.0, w * 0.4), 4)]
    for k in range(int(rng.integers(2, 5))):
        y = base - h * rng.uniform(0.45, 0.95)
        s = rng.choice([-1, 1])
        ln = rng.uniform(4, 12) * (w / 3 + 0.6)
        S.append(taper([(x, y), (x + s * ln * 0.6, y - ln * 0.3), (x + s * ln, y - ln * rng.uniform(0.2, 0.8))], max(1.0, w * 0.4), 0.8, 3))
    return S


def cypress(x, base, h, w, rng):
    """A bald cypress: a trunk flaring wide at the water (buttress), knees around it, a ragged crown of clumps on a few
    upswept limbs, moss hanging from the clumps."""
    trunk = [taper([(x - w * 1.6, base + 3), (x - w * 0.5, base - h * 0.12), (x, base - h * 0.5), (x + rng.normal(0, w * 0.2), base - h)],
                   w * 2.6, w * 0.5, 6)]
    trunk.append(taper([(x + w * 1.6, base + 3), (x + w * 0.4, base - h * 0.14), (x, base - h * 0.4)], w * 1.2, w * 0.4, 4))
    for k in range(int(rng.integers(2, 5))):                     # cypress knees poking out of the water
        kx = x + rng.uniform(-w * 4, w * 4)
        trunk.append(taper([(kx, base + 3), (kx + rng.normal(0, 0.5), base - rng.uniform(2, 6))], rng.uniform(2, 3.4), 1, 2))
    clumps, anchors = [], []
    for k in range(int(rng.integers(3, 6))):
        t = rng.uniform(0.55, 1.0)
        y = base - h * t
        s = rng.choice([-1, 1])
        ln = w * rng.uniform(2.5, 6)
        ex, ey = x + s * ln, y - ln * rng.uniform(0.3, 0.8)
        trunk.append(taper([(x, y + 4), (x + s * ln * 0.5, y - ln * 0.2), (ex, ey)], w * 0.45, 1.2, 4))
        # an irregular crown: several small clumps scattered along the limb, not one umbrella
        for j in range(int(rng.integers(3, 6))):
            tt = rng.uniform(0.35, 1.0)
            cx_ = x + s * ln * tt + rng.normal(0, w * 0.6)
            cy_ = y + 2 - ln * (0.2 + 0.4 * tt) + rng.normal(0, w * 0.8)
            r = w * rng.uniform(1.0, 2.0)
            clumps.append(ell(cx_, cy_, r * rng.uniform(1.0, 1.5), r, rng.uniform(-30, 30), 14))
            anchors += [(cx_ + rng.uniform(-r, r), cy_ + r * 0.6) for _ in range(3)]
    for j in range(int(rng.integers(3, 6))):                     # the top: a ragged spire of clumps
        cy_ = base - h + j * w * 1.2 - w
        r = w * rng.uniform(1.2, 2.0) * (0.6 + j * 0.15)
        clumps.append(ell(x + rng.normal(0, w * 0.8), cy_, r, r * 0.8, 0, 14))
    anchors += [(x + rng.uniform(-w * 2, w * 2), base - h + w * 3) for _ in range(4)]
    return trunk, clumps, anchors


def old_tree(x, base, h, w, rng, side=1):
    """A huge old swamp tree right in front: a massive trunk with flared buttress roots and thick limbs."""
    S = [taper([(x, base + 6), (x + side * w * 0.2, base - h * 0.4), (x + side * w * 0.5, base - h)], w * 1.3, w * 0.7, 6)]
    for k in range(5):                                             # buttress roots
        s = [-1, -0.5, 0.3, 0.8, 1][k]
        S.append(taper([(x + s * w * 0.3, base - w * rng.uniform(0.6, 1.4)), (x + s * w * 0.9, base - w * 0.3),
                        (x + s * w * rng.uniform(1.4, 2.4), base + 6)], w * rng.uniform(0.35, 0.55), 3, 5))
    clumps, anchors = [], []
    for k in range(3):
        y = base - h * rng.uniform(0.55, 0.95)
        ln = w * rng.uniform(2.0, 3.4)
        ex, ey = x - side * ln, y - ln * 0.5
        S.append(taper([(x, y), (x - side * ln * 0.5, y - ln * 0.15), (ex, ey)], w * 0.42, w * 0.15, 5))
        clumps.append(ell(ex, ey, ln * 0.7, ln * 0.4, 0, 18))
        anchors += [(ex + rng.uniform(-ln * 0.6, ln * 0.6), ey + ln * 0.25) for _ in range(10)]
    return S, clumps, anchors


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
    """One depth layer: a mix of pines, snags and cypresses, all at depth d."""
    rng = np.random.default_rng(seed)
    trunks, clumps, anchors = [], [], []
    for (x, base, h, w) in items:
        k = rng.choice(['pine', 'snag', 'cypress'], p=kind_weights)
        if k == 'pine':
            t, c = pine(x, base, h, w, rng)
            trunks += t
            clumps += c
        elif k == 'snag':
            trunks += snag(x, base, h, w * 0.6, rng)
        else:
            t, c, a = cypress(x, base, h, w, rng)
            trunks += t
            clumps += c
            anchors += a
    col = depth_col(d)
    tm = mask(trunks)
    cm = leafy(mask(clumps), seed) if clumps else np.zeros((H, W), bool)
    fill(img, tm, col * 0.95)
    if d > 0.5:
        bark_dark(img, tm, col * 1.1, seed)
    foliage_shade(img, cm, mix(col, leaf_tint, 0.3 * d), seed, d)
    rim_light(img, tm | cm, rim * (1 - d * 0.4))
    if moss_on and anchors:
        moss(img, anchors, mix(col, C('#6a7a5a'), 0.35), mix(col, C('#8a9a74'), 0.4), seed, 1.0, int(18 + 40 * d))
    return tm | cm


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
    rng = np.random.default_rng(seed)
    ys, xs = np.nonzero(top)
    for i in range(0, len(xs), 3):                                  # grass blades
        if rng.random() < 0.5:
            hgt = int(rng.integers(2, 7))
            for k in range(hgt):
                y = ys[i] - k
                x = xs[i] + (k // 3) * (1 if rng.random() < 0.5 else -1)
                if 0 <= y < H and 0 <= x < W:
                    img[y, x] = mix(grass_col * 1.3, SKY_LO, 0.25 if k == hgt - 1 else 0.05)
    return m


# ============================================================================================== the scene

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
    # far forest skyline: a low ridge of trees and many thin pines and snags
    rng = np.random.default_rng(2)
    ridge = WATER - 18 - 10 * fbm(XX[0] / 40, np.zeros(W), 3, 3) * 2
    rm = YY > ridge[None, :]
    fill(img, rm, depth_col(0.1))
    items = [(rng.uniform(-10, W + 10), WATER - 8, rng.uniform(30, 110), rng.uniform(2, 4)) for _ in range(70)]
    layer(img, items, 0.12, 11, [0.6, 0.35, 0.05], moss_on=False, rim=0.3)
    mist(img, WATER - 20, 26, 0.75, 3)
    items = [(rng.uniform(-10, W + 10), WATER - 2, rng.uniform(70, 170), rng.uniform(3, 5)) for _ in range(34)]
    layer(img, items, 0.3, 12, [0.5, 0.3, 0.2], rim=0.45)
    hut(img, 404, WATER - 52, 0.55)
    mist(img, WATER - 8, 20, 0.6, 4)
    # mid cypresses standing in the water
    items = [(70, WATER + 2, 200, 5), (180, WATER + 2, 230, 6), (250, WATER + 1, 150, 4), (430, WATER + 2, 210, 5), (530, WATER + 1, 180, 5)]
    layer(img, items, 0.52, 21, [0.0, 0.25, 0.75], rim=0.55)
    items = [(x, WATER + 1, rng.uniform(120, 200), 5) for x in (30, 300, 360, 470, 610)]
    layer(img, items, 0.6, 23, [0.85, 0.15, 0.0], moss_on=False, rim=0.5)
    for (x, y, c) in ((214, 214, '#ff3a2a'), (458, 222, '#ffc84a'), (98, 228, '#ff3a2a')):     # eyes in the dark
        img[y, x] = img[y, x + 3] = C(c)
        glow(img, x + 1.5, y, 5, C(c), 0.3)
    mist(img, WATER + 2, 12, 0.5, 6)
    # the water: a still mirror of the sky and the trees, darker and rippled closer to us
    above = img.copy()
    wy = YY >= WATER
    src = np.clip(2 * WATER - YY, 0, H - 1).astype(int)
    rip = (np.sin(YY * 1.9 + np.sin(XX / 13)) * (YY - WATER) / 60).astype(int)
    srcx = np.clip(XX.astype(int) + rip, 0, W - 1)
    refl = above[src, srcx]
    depth = np.clip((YY - WATER) / 110, 0, 1)
    water = refl * (0.78 - 0.4 * depth[..., None]) + C('#050a08') * (0.22 + 0.4 * depth[..., None])
    img[wy] = water[wy]
    wob = fbm(XX / 6, YY / 2, 2, 13)
    streak = wy & (np.abs(XX - MOON[0] + (wob - 0.5) * 10) < 16 - (YY - WATER) * 0.08) & (fbm(XX / 5, YY / 1.5, 2, 14) > 0.5)
    fill(img, streak, C('#e0e8cc'), 0.55)
    ripl = wy & (np.sin(XX / 9 + YY * 1.7) > 0.95) & (fbm(XX / 30, YY / 4, 2, 7) > 0.55)
    fill(img, ripl, mix(SKY_LO, NEAR, 0.4), 0.5)
    img[WATER, :] = mix(img[WATER, :], MIST, 0.35)
    # big cypresses at the sides, in front of the water
    items = [(110, WATER + 6, 330, 9), (560, WATER + 8, 340, 10)]
    layer(img, items, 0.78, 31, [0.0, 0.0, 1.0], rim=0.7)
    # mossy banks and the half-sunken boardwalk between them
    bank(img, [(-20, 300), (-10, 266), (60, 258), (140, 262), (196, 276), (214, 300)], 41, 0.82)
    bank(img, [(450, 300), (470, 270), (530, 262), (600, 260), (660, 266), (660, 300)], 42, 0.82)
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
        S, cl_, an = old_tree(x + side * 6, 304, 330, 34, rng2, side)
        tm = mask(S)
        bark_dark(img, tm, C('#141a14'), sd)
        cm = leafy(mask(cl_), sd)
        foliage_shade(img, cm, C('#141e14'), sd, 0.95)
        rim_light(img, tm | cm, 0.35, width=1)
        moss(img, an, C('#2a3426'), C('#3a4632'), sd, 1.3, 80)
    rng4 = np.random.default_rng(23)
    for cxg in (20, 90, 150, 480, 560, 620):                             # dark grass clumps along the bottom corners
        for _ in range(26):
            bx = cxg + rng4.normal(0, 14)
            hgt = rng4.uniform(8, 26)
            lean = rng4.uniform(-6, 6)
            fill(img, mask([taper([(bx, H + 1), (bx + lean * 0.5, H - hgt * 0.6), (bx + lean, H - hgt)], 2.2, 0.6, 3)]), NEAR * 0.75)
    # characters: backlit by the moon (dim, with a rim), warmed by the lantern
    key = {'dir': (0.0, -0.7, 0.5), 'col': (0.42, 0.48, 0.4)}
    amb = (0.18, 0.22, 0.2)
    pts = [(420, 254, 130, (1.0, 0.62, 0.28), 0.9), (MOON[0], MOON[1], 500, (0.5, 0.55, 0.45), 0.3)]
    actor(img, witch(540, 262), key, amb, pts, rim='#dce6c4')
    glow(img, 532, 212, 30, C('#90ff60'), 0.45)
    actor(img, spider(150, 150, 1.6), key, amb, pts, rim='#dce6c4')
    actor(img, zombie(330, 288), key, amb, pts, rim='#dce6c4', flash='#ff8a2a')
    for k in range(3):
        r = 12 + k * 7
        rr = mask([ell(330, 289, r, r * 0.22, 0, 24)]) & ~mask([ell(330, 289, r - 1.4, r * 0.22 - 0.8, 0, 24)])
        fill(img, rr & (YY > 288), C('#9aa88a'), 0.5 - k * 0.13)
    actor(img, hero(250, 244, 1), key, amb, pts, rim='#eef2dc')
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


def build():
    docs = os.path.join(ROOT, 'docs', 'art')
    img = scene()
    im = Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8), 'RGB')
    big = im.resize((W * 3, H * 3), Image.NEAREST)
    big.save(os.path.join(docs, 'final_example_swamp_v2.png'))
    phone(big).save(os.path.join(docs, 'final_example_swamp_v2_phone.png'))
    big.crop((150 * 3, 150 * 3, 470 * 3, 330 * 3)).resize((320 * 5, 180 * 5), Image.NEAREST).save(
        os.path.join(docs, 'final_example_swamp_v2_closeup.png'))


if __name__ == '__main__':
    build()
