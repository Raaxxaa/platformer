"""Stage 1 enemy projectiles (04 §8, 08 §11). Drawn facing right; the game rotates them."""
import math
import os

import numpy as np

from . import atlas as A
from . import palette as P
from . import raster as R

ATLAS = 'projectiles'
ALLOWED = ['ink', 'white', 'gray', 'en_red', 'en_slate', 'en_bone', 'w_wood', 'w_steel', 'w_gold', 'w_magic', 'fx_bolt']


def _L(w, h):
    return R.PartLayer(w, h)


def _part(L, name, ramp, shift=0):
    if name not in L.index:
        L.add_part(name, P.ramp_ids(ramp), shift)
    return name


def _done(L, outline=True):
    c = R.auto_shade(L)
    if outline:
        R.outline(c, P.INK)
    return c.to_image()


def arrow():
    L = _L(12, 4)
    shaft = _part(L, 'shaft', 'en_red')
    head = _part(L, 'head', 'en_slate')
    fl = _part(L, 'fletch', 'en_red', -1)
    R.fill_rect(L, 2, 1, 7, 1, shaft)
    R.fill_rect(L, 9, 1, 2, 2, head)
    R.fill_rect(L, 1, 1, 2, 2, fl)
    c = R.auto_shade(L)
    # 1 px ink outline only where it fits inside the 12 × 4 frame
    R.outline(c, P.INK)
    return c.to_image()


def brute_wave(frame):
    """A low wave of dirt with rocks riding its crest, 16 × 12."""
    L = _L(16, 12)
    dirt = _part(L, 'dirt', 'en_red', -1)
    rock = _part(L, 'rock', 'en_bone')
    sh = frame * 1.5
    pts = [(1, 11), (3, 8 - frame), (6, 5 - frame), (9, 3 + frame * 0.5), (12, 4), (14.5, 7), (15, 11)]
    R.fill_polygon(L, pts, dirt)
    for (x, y, r) in ((6 + sh, 4, 1.6), (10, 5 - frame, 1.3), (4, 7, 1.1)):
        R.ellipse(L, x, y, r, r, rock)
    return _done(L)


def shockwave(frame):
    """Ground shock wave: a crescent of light dust, 16 × 16."""
    L = _L(16, 16)
    a = _part(L, 'arc', 'en_red', -1)
    core = _part(L, 'core', 'white')
    xs, ys = np.mgrid[0:16, 0:16][1] + 0.5, np.mgrid[0:16, 0:16][0] + 0.5
    r0 = 9 + frame
    d = np.sqrt((xs - 1) ** 2 + (ys - 15) ** 2)
    ring = (d < r0 + 2.5) & (d > r0 - 1.5) & (ys < 15)
    L.put(ring, a)
    L.put((d < r0 + 1) & (d > r0) & (ys < 14), core)
    return _done(L)


def falling_rock():
    L = _L(18, 18)
    rk = _part(L, 'rock', 'en_red', -1)
    R.fill_polygon(L, [(3, 6), (7, 2), (13, 2.5), (16, 7), (15, 13), (10, 16), (4, 14), (2, 10)], rk)
    crack = _part(L, 'crack', 'en_red', 2)
    R.line(L, (7, 6), (10, 9), crack)
    R.line(L, (10, 9), (9, 12), crack)
    return _done(L)


def rock_shatter(frame):
    L = _L(18, 18)
    g = np.random.default_rng(7)
    rk = _part(L, 'rock', 'en_red', -1)
    for k in range(6):
        a = 2 * math.pi * k / 6 + 0.4
        dist = 2 + frame * 2.2
        cx, cy = 9 + dist * math.cos(a), 9 + dist * math.sin(a) * 0.8 + frame * frame * 0.3
        s = max(0.8, 2.6 - frame * 0.5 + g.uniform(-0.3, 0.3))
        if 1 <= cx <= 16 and 1 <= cy <= 16:
            R.ellipse(L, cx, cy, s, s, rk)
    return _done(L, outline=frame < 2)


def player_arrow(w, charged=False, bolt=False):
    """Player arrow / crossbow bolt (02 §10.4), w × 4, facing right."""
    L = _L(w, 4)
    shaft = _part(L, 'shaft', 'w_wood')
    head = _part(L, 'head', 'w_gold' if charged else 'w_steel')
    fl = _part(L, 'fletch', 'w_steel' if bolt else 'w_gold', -1)
    R.fill_rect(L, 2, 1, w - 5, 1, shaft)
    R.fill_rect(L, w - 3, 1, 2, 2, head)
    R.fill_rect(L, 1, 1, 2 if not bolt else 3, 2, fl)
    if charged:
        glow = _part(L, 'glow', 'fx_bolt', 1)
        R.fill_rect(L, 4, 2, w - 8, 1, glow)
    return _done(L)


def magic_ball(size, frame, ramp):
    """Staff bolt / orb: a round magic ball with a bright core, pulsing over its frames."""
    L = _L(size, size)
    outer = _part(L, 'outer', ramp)
    core = _part(L, 'core', 'white')
    c = size / 2
    r = c - 1.2 - (frame % 2) * 0.6
    R.ellipse(L, c, c, r, r, outer)
    R.ellipse(L, c - 0.5 + frame * 0.5, c - 0.5, r * 0.4, r * 0.4, core)
    return _done(L)


def hammer_spin(frame):
    """The thrown Storm Hammer, 16 × 16, a quarter turn per frame."""
    L = _L(16, 16)
    hd = _part(L, 'head', 'w_gold')
    hn = _part(L, 'handle', 'w_wood')
    bolt = _part(L, 'bolt', 'fx_bolt', 1)
    a = frame * math.pi / 4
    ux, uy = math.cos(a), math.sin(a)
    px, py = -uy, ux
    R.line(L, (8 - ux * 6, 8 - uy * 6), (8 + ux * 2, 8 + uy * 2), hn)
    pts = [(8 + ux * d + px * s, 8 + uy * d + py * s) for d, s in ((1.5, -4.5), (6, -4.5), (6, 4.5), (1.5, 4.5))]
    R.fill_polygon(L, pts, hd)
    R.line(L, (8 + ux * 3.5 + px * -3, 8 + uy * 3.5 + py * -3), (8 + ux * 3.5 + px * 3, 8 + uy * 3.5 + py * 3), bolt)
    return _done(L)


def build_frames():
    fr = {'enemy_arrow_00': arrow()}
    for i in range(2):
        fr[f'brute_wave_{i:02d}'] = brute_wave(i)
        fr[f'shockwave_{i:02d}'] = shockwave(i)
    fr['falling_rock_00'] = falling_rock()
    for i in range(4):
        fr[f'falling_rock_shatter_{i:02d}'] = rock_shatter(i)
    fr['arrow_00'] = player_arrow(12)
    fr['arrow_charged_00'] = player_arrow(16, charged=True)
    fr['bolt_00'] = player_arrow(14, bolt=True)
    fr['pin_bolt_00'] = player_arrow(14, charged=True, bolt=True)
    fr['staff_bolt_00'] = magic_ball(8, 0, 'w_magic')
    for i in range(2):
        fr[f'orb_{i:02d}'] = magic_ball(14, i, 'w_magic')
    for i in range(4):
        fr[f'hammer_spin_{i:02d}'] = hammer_spin(i)
    anims = [A.anim('arrow', ATLAS, 1, 'once'), A.anim('arrow_charged', ATLAS, 1, 'once'),
             A.anim('bolt', ATLAS, 1, 'once'), A.anim('pin_bolt', ATLAS, 1, 'once'),
             A.anim('staff_bolt', ATLAS, 1, 'once'), A.anim('orb', ATLAS, 2, 'loop', 10),
             A.anim('hammer_spin', ATLAS, 4, 'loop', 20)]
    anims += [A.anim('enemy_arrow', ATLAS, 1, 'once'), A.anim('brute_wave', ATLAS, 2, 'loop', 12),
             A.anim('shockwave', ATLAS, 2, 'loop', 12), A.anim('falling_rock', ATLAS, 1, 'once'),
             A.anim('falling_rock_shatter', ATLAS, 4, 'once', 20)]
    return fr, anims


def sheet(frames, path, scale=6):
    from PIL import Image
    bg = tuple(P.RAMPS['pl_bg1'][1]) + (255,)
    names = sorted(frames)
    W = sum(frames[n].width + 3 for n in names) + 3
    H = max(frames[n].height for n in names) + 6
    im = Image.new('RGBA', (W, H), bg)
    x = 3
    for n in names:
        im.alpha_composite(frames[n], (x, 3))
        x += frames[n].width + 3
    im.resize((W * scale, H * scale), Image.NEAREST).save(path)


def build(assets, preview):
    fr, anims = build_frames()
    for n, img in fr.items():
        P.check_palette_lock(img, P.allowed(ALLOWED), ATLAS, n)
    A.pack_atlas(ATLAS, fr, os.path.join(assets, 'atlases'))
    sheet(fr, os.path.join(preview, 'projectiles_sheet.png'))
    return anims
