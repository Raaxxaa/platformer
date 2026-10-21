"""The Dragon in four colors (08 §7.4): atlases boss_dragon_<red|white|storm|green>, 288 x 192 frames, anchor (144, 190).

One base drawing in the `dr_red` shades, recolored to the other three ramps shade by shade."""
import math
import os

import numpy as np
from PIL import Image

from .. import atlas as A
from .. import palette as P
from .. import raster as R
from ..enemies.common34 import build_enemy_atlas
from ..enemies.plains import Fig, finish, seg, ip, rot, box

ID = 'dragon'
SIZE, ANCHOR = (288, 192), (144, 190)
COLORS = ['red', 'white', 'storm', 'green']
BASE = 'dr_red'


def _p(f, name, shade=0):
    return f.part(name, BASE, shade)


def draw_dragon(pose, size=SIZE, feet=(144, 188)):
    f = Fig(*size)
    dx, dy = pose.get('dx', 0), pose.get('dy', 0)
    B = (feet[0] + dx, feet[1] - 44 + dy)
    tilt = pose.get('tilt', 0)
    T = lambda x, y: rot((B[0] + x, B[1] + y), B, tilt)   # noqa: E731  body-local point
    nx, ny = pose.get('neck', (0, 0))
    mouth = pose.get('mouth', 0)

    def wing(shade, off, fl):
        S = T(-4 + off, -15)
        pts = [(0, 0), (-8, -26), (-40, -46), (-56, -22), (-38, -4), (-20, 7)]
        world = [rot((S[0] + x, S[1] + y), S, fl) for x, y in pts]
        R.fill_polygon(f.L, world, _p(f, f'wing{off}', shade))
        for tip in world[2:5]:
            R.line(f.L, ip(world[1]), ip(tip), _p(f, f'wbone{off}', 3))
        R.line(f.L, ip(world[0]), ip(world[1]), _p(f, f'warm{off}', 2))

    def leg(rx, front, shade, ph):
        root = T(rx, 10)
        th, kn = ph
        k = seg(root, th, 13)
        ft = seg(k, th - kn, 12)
        ft = (ft[0], min(ft[1], feet[1]))
        R.capsule(f.L, ip(root), ip(k), 8 if not front else 6, _p(f, f'thigh{rx}', shade))
        R.capsule(f.L, ip(k), ip((ft[0], ft[1] - 1)), 5, _p(f, f'shin{rx}', shade))
        box(f, ft[0] - 3, ft[1] - 1, ft[0] + 4, ft[1], _p(f, f'foot{rx}', shade + 1))
        for c in (-2, 1, 4):
            R.line(f.L, ip((ft[0] + c, ft[1])), ip((ft[0] + c + 1, ft[1])), f.part(f'claw{rx}{c}', 'white'))

    wing(1, 8, pose.get('wing2', pose.get('wing', 10)) + 8)
    # tail
    base, curl = pose.get('tail', -112), pose.get('curl', 7)
    p0, ang, w = T(-30, 3), base, 11.0
    for i in range(7):
        p1 = seg(p0, ang, 14)
        R.capsule(f.L, ip(p0), ip(p1), w, _p(f, 'tail', 1))
        p0, ang, w = p1, ang + curl, max(2.5, w - 1.3)
    R.fill_polygon(f.L, [(p0[0], p0[1] - 5), (p0[0] + 10, p0[1]), (p0[0], p0[1] + 5)], _p(f, 'tailtip', 2))
    L = pose.get('legs', ((0, 8), (0, 8)))
    leg(-17, False, 1, L[1])
    leg(19, True, 1, L[0])
    # body
    R.ellipse(f.L, *T(0, 0), 35, 21, _p(f, 'body'))
    R.ellipse(f.L, *T(4, 10), 27, 11, _p(f, 'belly', -1))
    for i in range(8):                                        # back spikes
        sx, sy = -26 + i * 7, -19 + abs(i - 3) * 0.8
        a = T(sx, sy)
        R.fill_polygon(f.L, [(a[0] - 3, a[1] + 2), (a[0] - 1, a[1] - 6), (a[0] + 3, a[1] + 2)], _p(f, 'spike', -1))
    # neck + head
    n0 = T(24, -8)
    pts = [n0, (n0[0] + 9 + nx * 0.3, n0[1] - 8 + ny * 0.3), (n0[0] + 14 + nx * 0.7, n0[1] - 18 + ny * 0.7), (n0[0] + 18 + nx, n0[1] - 28 + ny)]
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        R.capsule(f.L, ip(a), ip(b), 13 - i * 2, _p(f, f'neck{i}', 0 if i % 2 else 1))
    hc = pts[-1]
    R.ellipse(f.L, hc[0] + 4, hc[1], 12, 8, _p(f, 'head'))
    R.fill_polygon(f.L, [(hc[0] + 8, hc[1] - 5), (hc[0] + 26, hc[1] - 1), (hc[0] + 24, hc[1] + 3), (hc[0] + 8, hc[1] + 4)], _p(f, 'snout', 0))
    jaw = [(hc[0] + 6, hc[1] + 3), (hc[0] + 24, hc[1] + 3 + 9 * mouth), (hc[0] + 22, hc[1] + 6 + 9 * mouth), (hc[0] + 4, hc[1] + 7)]
    R.fill_polygon(f.L, jaw, _p(f, 'jaw', 1))
    if mouth:
        for tx in (12, 17, 22):
            R.line(f.L, ip((hc[0] + tx, hc[1] + 3 + 9 * mouth * (tx / 24))), ip((hc[0] + tx, hc[1] + 5 + 9 * mouth * (tx / 24))), f.part('tooth', 'white'))
    for hx, hy in ((-6, -6), (-1, -7)):
        R.fill_polygon(f.L, [(hc[0] + hx, hc[1] + hy), (hc[0] + hx - 12, hc[1] + hy - 10), (hc[0] + hx - 4, hc[1] + hy + 1)], _p(f, 'horn', 2))
    ex, ey = hc[0] + 7, hc[1] - 2
    if pose.get('dead'):
        R.line(f.L, ip((ex - 1, ey)), ip((ex + 2, ey)), f.part('eyex', 'ink'))
    else:
        box(f, int(ex), int(ey), int(ex + 2), int(ey), f.part('eye', 'white'))
        box(f, int(ex + 2), int(ey), int(ex + 2), int(ey + 1), f.part('pupil', 'ink'))
    box(f, int(hc[0] + 23), int(hc[1] - 3), int(hc[0] + 24), int(hc[1] - 2), f.part('nostril', 'ink'))
    leg(-11, False, 0, L[1])
    leg(25, True, 0, L[0])
    wing(0, 0, pose.get('wing', 10))
    return finish(f)


def recolor(img, color):
    if color == 'red':
        return img
    src = [np.array(c, np.uint8) for c in P.RAMPS[BASE]]
    dst = [np.array(c, np.uint8) for c in P.RAMPS[P.DRAGON_RAMPS[color]]]
    a = np.array(img)
    out = a.copy()
    for s_, d_ in zip(src, dst):
        m = np.all(a[:, :, :3] == s_, axis=2) & (a[:, :, 3] == 255)
        out[m, :3] = d_
    return Image.fromarray(out, 'RGBA')


# ---------------------------------------------------------------- anim tables

STAND = ((8, 14), (6, 12))


def pz(**kw):
    d = {'legs': STAND, 'wing': 12, 'tail': -112}
    d.update(kw)
    return d


def tables():
    A_ = {}
    A_['idle'] = [pz(dy=b, neck=(0, b), wing=12 + w, tail=-112 + t) for b, w, t in zip((0, 0, 1, 1), (0, 4, 6, 2), (0, 3, 5, 2))]
    sw = [(24, 10), (12, 8), (-4, 14), (-16, 26), (-6, 36), (10, 20), (22, 10), (24, 8)]
    A_['walk'] = [pz(dy=(0, 1, 0, 0, 1, 0, 0, 1)[i], legs=(sw[i], sw[(i + 4) % 8]), tail=-112 + (i % 4) * 3, wing=14) for i in range(8)]
    A_['perched'] = [pz(dy=2, wing=0, neck=(-4, 4)), pz(dy=3, wing=2, neck=(-4, 5), tail=-108)]
    A_['takeoff'] = [pz(dy=2, wing=70, legs=((20, 40), (14, 34))), pz(dy=-4, wing=-10, legs=((10, 20), (8, 16)), tilt=-4),
                     pz(dy=-14, wing=60, legs=((-20, 10), (-24, 10)), tilt=-6), pz(dy=-24, wing=20, legs=((-40, 10), (-44, 10)), tilt=-6)]
    A_['hover'] = [pz(dy=-30 + d, wing=w, legs=((-36, 10), (-40, 10)), tilt=-5, tail=-100) for w, d in
                   zip((-10, 30, 70, 100, 70, 30), (0, 1, 2, 3, 2, 1))]
    A_['dive'] = [pz(dy=-20, wing=100, legs=((-50, 10), (-54, 10)), tilt=28, neck=(14, 14), mouth=0.4, tail=-150)]
    A_['fall'] = [pz(dy=-10, wing=100, legs=((-20, 20), (-24, 20)), tilt=-12, neck=(-6, 6), tail=-130)]
    A_['wing_hop'] = [pz(dy=-12, wing=60, legs=((10, 30), (6, 30)), tilt=-6), pz(dy=-8, wing=20, legs=((20, 20), (16, 20)), tilt=4)]
    A_['hurt'] = [pz(dx=-3, dy=2, tilt=-5, neck=(-8, 6), mouth=0.6, wing=40)]
    A_['stagger'] = [pz(dx=-3, dy=3, tilt=-6, neck=(-8, 8), mouth=0.4, wing=50), pz(dx=2, dy=4, tilt=4, neck=(-2, 8), wing=40)]
    crouch = pz(dy=6, legs=((30, 50), (24, 46)), neck=(-6, 10), wing=40)
    A_['break'] = [crouch, dict(crouch, dy=8, neck=(-6, 14)), dict(crouch, dy=7, neck=(-4, 12))]
    A_['intro'] = [pz(dy=8, wing=0, neck=(-8, 14)), pz(dy=6, wing=20, neck=(-4, 10)), pz(dy=2, wing=60, neck=(0, 4), mouth=0.2),
                   pz(dy=-2, wing=100, neck=(6, -2), mouth=0.8), pz(dy=-2, wing=100, neck=(8, -4), mouth=1.0, tail=-100),
                   pz(dy=0, wing=40, neck=(2, 0), mouth=0.3)]
    A_['transition'] = [pz(dy=0, wing=30), pz(dy=-4, wing=80, neck=(4, -2), mouth=0.3), pz(dy=-8, wing=110, neck=(8, -6), mouth=0.8, tilt=-4),
                        pz(dy=-10, wing=120, neck=(10, -8), mouth=1.0, tilt=-6), pz(dy=-6, wing=80, neck=(6, -2), mouth=0.5),
                        pz(dy=0, wing=30)]
    d0 = pz(dx=-4, dy=4, tilt=-8, neck=(-8, 8), wing=50, mouth=0.5)
    A_['death'] = [d0, dict(d0, dy=8, tilt=-12, legs=((30, 40), (26, 36))), dict(d0, dy=12, tilt=-8, legs=((50, 70), (44, 60)), wing=30),
                   dict(d0, dy=16, tilt=-4, legs=((70, 90), (66, 84)), wing=20, neck=(-4, 14)),
                   dict(d0, dy=20, tilt=0, legs=((90, 110), (80, 100)), wing=10, neck=(0, 18), dead=True),
                   dict(d0, dy=22, tilt=0, legs=((90, 110), (80, 100)), wing=0, neck=(2, 20), dead=True),
                   dict(d0, dy=22, tilt=0, legs=((90, 110), (80, 100)), wing=-10, neck=(4, 22), dead=True),
                   dict(d0, dy=23, tilt=0, legs=((90, 110), (80, 100)), wing=-14, neck=(4, 22), dead=True),
                   dict(d0, dy=24, tilt=0, legs=((90, 110), (80, 100)), wing=-16, neck=(4, 22), dead=True)]

    def atk(tele_a, tele_b, act_a, act_b, rec_a, rec_b):
        return [tele_a, tele_b, act_a, act_b, rec_a, rec_b]
    brt = lambda m, n, w=40, **k: pz(mouth=m, neck=n, wing=w, **k)     # noqa: E731
    A_['atk_breath'] = atk(brt(0.2, (-4, 6)), brt(0.5, (-6, 2), dy=2), brt(1.0, (10, -4), 60, dy=-1), brt(1.0, (12, -2), 70),
                           brt(0.4, (4, 2)), brt(0.1, (0, 0)))
    A_['atk_claw_swipe'] = [pz(dy=2, legs=((-20, 20), (6, 12)), neck=(-6, 4)), pz(dy=4, legs=((-40, 30), (6, 12)), neck=(-10, 8), tilt=-4),
                            pz(dy=-2, legs=((70, 10), (6, 12)), neck=(8, -2), tilt=4, mouth=0.4),
                            pz(dy=0, legs=((50, 20), (6, 12)), neck=(6, 0), tilt=3), pz(dy=0, legs=((20, 20), (6, 12)))]
    A_['atk_tail_sweep'] = [pz(tail=-80, curl=10, dx=3, neck=(2, 2)), pz(tail=-60, curl=12, dx=4, neck=(4, 2), tilt=3),
                            pz(tail=-180, curl=2, dx=2, tilt=-2), pz(tail=-170, curl=-4, dx=1), pz(tail=-120)]
    A_['atk_wing_gust'] = [pz(wing=60, dy=1), pz(wing=100, dy=-1), pz(wing=0, dy=0, tilt=-2), pz(wing=100, dy=-2), pz(wing=30), pz(wing=20)]
    A_['atk_color_special'] = [pz(dy=2, wing=70, neck=(-4, 4)), pz(dy=0, wing=110, neck=(2, -4), mouth=0.4), pz(dy=-3, wing=120, neck=(8, -8), mouth=1.0, tilt=-4),
                               pz(dy=-2, wing=100, neck=(8, -6), mouth=0.8, tilt=-3), pz(dy=0, wing=40)]
    air = dict(legs=((-36, 10), (-40, 10)), tail=-100)
    A_['atk_dive_bomb'] = [pz(dy=-30, wing=40, tilt=-5, **air), pz(dy=-40, wing=120, tilt=-12, **air),
                           pz(dy=-16, wing=100, tilt=26, neck=(12, 12), mouth=0.4, legs=((-50, 10), (-54, 10)), tail=-150),     # rising
                           pz(dy=-8, wing=100, tilt=34, neck=(14, 14), mouth=0.4, legs=((-50, 10), (-54, 10)), tail=-150),      # falling
                           pz(dy=4, wing=50, legs=((40, 60), (34, 56))), pz(dy=2, wing=30)]
    A_['atk_strafing_breath'] = [pz(dy=-30, wing=40, mouth=0.2, **air), pz(dy=-30, wing=80, mouth=0.5, neck=(4, 4), **air),
                                 pz(dy=-30, wing=20, mouth=1.0, neck=(10, 8), tilt=6, **air), pz(dy=-30, wing=80, mouth=1.0, neck=(12, 10), tilt=6, **air),
                                 pz(dy=-30, wing=40, mouth=0.4, **air), pz(dy=-30, wing=40, **air)]
    return A_


TABLES = {ID: tables()}
HIDDEN = {(ID, 'wing_hop')}          # the view has no Wing Hop pose input yet (docs/art/SPEC-GAPS-art.md #22)


def segs():
    act = lambda frames, **k: {'phase': 'act', 'frames': frames, **k}      # noqa: E731
    tele, rec = {'phase': 'tele', 'frames': [0, 1]}, {'phase': 'rec', 'frames': [4, 5]}
    return {(ID, 'atk_breath'): [tele, act([2, 3], loopFps=8), rec],
            (ID, 'atk_strafing_breath'): [tele, act([2, 3], loopFps=8), rec],
            (ID, 'atk_wing_gust'): [tele, act([2, 3], loopFps=8), rec],
            (ID, 'atk_dive_bomb'): [tele, act([2, 3], byVy=True), rec],
            (ID, 'atk_claw_swipe'): [tele, {'phase': 'act', 'frames': [2]}, {'phase': 'rec', 'frames': [3, 4]}],
            (ID, 'atk_tail_sweep'): [tele, {'phase': 'act', 'frames': [2]}, {'phase': 'rec', 'frames': [3, 4]}],
            (ID, 'atk_color_special'): [tele, {'phase': 'act', 'frames': [2]}, {'phase': 'rec', 'frames': [3, 4]}]}


_CACHE = {}


def drawer_for(color):
    def drawer(enemy, pose, size, feet):
        key = repr(sorted(pose.items(), key=lambda kv: kv[0]))
        if key not in _CACHE:
            _CACHE[key] = draw_dragon(pose, size, feet)
        return recolor(_CACHE[key], color)
    return drawer


def ramps(color):
    return ['ink', 'white', P.DRAGON_RAMPS[color]]


def sheet(frames, path):
    names = sorted(frames)
    cols = 12
    cell = 288
    scale = 0.5
    rows = (len(names) + cols - 1) // cols
    im = Image.new('RGBA', (int(cols * cell * scale), int(rows * 192 * scale)), tuple(P.RAMPS['kg_bg1'][1]) + (255,))
    for i, n in enumerate(names):
        f = frames[n].resize((int(cell * scale), int(192 * scale)), Image.NEAREST)
        im.alpha_composite(f, (int((i % cols) * cell * scale), int((i // cols) * 192 * scale)))
    im.convert('RGB').save(path)


def build(assets, preview):
    out = []
    for color in COLORS:
        atlas = f'boss_dragon_{color}'
        anims, frames = build_enemy_atlas(atlas, [ID], TABLES, drawer_for(color), lambda e, a: (SIZE, ANCHOR), ramps(color), None,
                                          None, segs(), HIDDEN, assets, boss=True, pack_kw={'max_page': 4096, 'row_width': 4096})
        out += anims
        if color in ('red', 'storm'):
            sheet(frames, os.path.join(preview, f'{atlas}_sheet.png'))
    return out


def build_frames(color='red'):
    anims, frames = build_enemy_atlas(f'boss_dragon_{color}', [ID], TABLES, drawer_for(color), lambda e, a: (SIZE, ANCHOR),
                                      ramps(color), None, None, segs(), HIDDEN, None, boss=True)
    return frames, anims


def idle_key(enemy=None):
    return 'idle_00'
