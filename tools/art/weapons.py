"""Player weapons and smears (08 §6.3, §12.4). Atlas weapon_<id>: 160 × 96 frames, anchor (80, 72)."""
import math
import os

import numpy as np

from . import atlas as A
from . import palette as P
from . import raster as R
from .rig import humanoid_fk
from .poses.player import POSES, SMEAR, DIVE_WEAPON, GROUND_SHOCK

W, H = 160, 96
ANCHOR = (80, 72)
BODY_OFFSET = (ANCHOR[0] - 24, ANCHOR[1] - 46)   # body frame (24, 46) -> weapon frame (80, 72)
ALLOWED = ['ink', 'w_steel', 'w_wood', 'w_gold', 'w_magic', 'gray', 'fx_bolt']

# Segments along the weapon axis from the grip point (hand). (start, end, width, ramp, shape)
WEAPONS = {
    'greatsword': [(-5, -3, 3, 'w_gold', 'rect'), (-3, 4, 2, 'w_wood', 'rect'), (4, 6, 9, 'w_gold', 'rect'),
                   (6, 34, 4, 'w_steel', 'taper')],
    'war_maul': [(-5, 24, 2, 'w_wood', 'rect'), (23, 33, 12, 'w_steel', 'head'), (25, 26, 12, 'w_gold', 'rect'),
                 (30, 31, 12, 'w_gold', 'rect')],
    'katana': [(-4, 3, 2, 'w_wood', 'rect'), (3, 4, 5, 'w_gold', 'rect'), (4, 26, 2.4, 'w_steel', 'taper')],
    'iron_fists': [(-3, 3, 6, 'w_steel', 'rect')],
    'bow': [(0, 0, 18, 'w_wood', 'bow')],
    'crossbow': [(-5, 12, 3, 'w_wood', 'rect'), (9, 11, 15, 'w_steel', 'rect'), (11, 15, 1.6, 'w_steel', 'taper')],
    'staff': [(-9, 19, 2, 'w_wood', 'rect'), (19, 26, 6, 'w_magic', 'disc')],
    'storm_hammer': [(-5, 16, 2, 'w_wood', 'rect'), (15, 23, 10, 'w_gold', 'head'), (18, 20, 3, 'fx_bolt', 'rect')],
}
# Keys per weapon (08 §6.3). Melee keys get a smear; ranged keys (frame 2 = release) and charge loops do not.
KEYS = {
    'greatsword': ['atk_greatsword_1', 'atk_greatsword_2', 'atk_greatsword_3'],
    'war_maul': ['atk_war_maul_1', 'atk_war_maul_2'],
    'katana': ['atk_katana_1', 'atk_katana_2', 'atk_katana_3', 'charge_katana', 'atk_katana_charged'],
    'iron_fists': ['atk_iron_fists_1', 'atk_iron_fists_2', 'atk_iron_fists_3', 'atk_iron_fists_4'],
    'bow': ['atk_bow_1', 'charge_bow', 'atk_bow_charged'],
    'crossbow': ['atk_crossbow_1'],
    'staff': ['atk_staff_1', 'charge_staff', 'atk_staff_charged'],
    'storm_hammer': ['atk_storm_hammer_1', 'atk_storm_hammer_2', 'atk_storm_hammer_throw'],
}
STEPS = {w: len(k) for w, k in KEYS.items()}
RANGED = {'atk_bow_1', 'atk_bow_charged', 'atk_crossbow_1', 'atk_staff_1', 'atk_staff_charged', 'atk_storm_hammer_throw'}
# 02 §10.2 / §10.5 boxes of the ART5 melee steps; cover floors follow the approved 'smaller streaks' choice.
BOXES = {'atk_katana_1': (20, -16, 32, 20), 'atk_katana_2': (20, -16, 32, 20), 'atk_katana_3': (22, -16, 40, 24),
         'atk_katana_charged': (34, -16, 52, 10), 'atk_iron_fists_1': (14, -16, 22, 16),
         'atk_iron_fists_2': (14, -16, 22, 16), 'atk_iron_fists_3': (14, -16, 24, 18),
         'atk_iron_fists_4': (12, -24, 20, 36), 'atk_storm_hammer_1': (22, -16, 40, 30),
         'atk_storm_hammer_2': (24, -14, 48, 28)}
MIN_COVER = {f'atk_iron_fists_{i}': 0.2 for i in range(1, 5)}   # punches are short jabs: see SPEC-GAPS-art #4
SHOULDER_SMEAR = {'iron_fists': 15}       # punches: the smear pivots at the shoulder, reaching the fist


def weapon_of(key):
    return next(w for w, ks in KEYS.items() if key in ks)

_DIRS = [(0, 1), (1, 2), (1, 1), (2, 1), (1, 0), (2, -1), (1, -1), (1, -2), (0, -1),
         (-1, -2), (-1, -1), (-2, -1), (-1, 0), (-2, 1), (-1, 1), (-1, 2)]


def _ang(v):
    return math.degrees(math.atan2(v[0], v[1]))        # 0 = down, 90 = forward (+x), 180 = up


def snap(deg):
    """Nearest of the 16 clean directions (slopes 0, ½, 1, 2, ∞), as an integer vector."""
    def diff(v):
        d = (_ang(v) - deg + 180) % 360 - 180
        return abs(d)
    return min(_DIRS, key=diff)


def _unit(v):
    n = math.hypot(*v)
    return v[0] / n, v[1] / n


def body_hand(pose):
    """Front hand in weapon-frame px (the body frame never moves: attack poses keep feet on the sole row)."""
    j = humanoid_fk(pose)
    hx, hy = j['handF']
    return hx + BODY_OFFSET[0] + 0.5, hy + BODY_OFFSET[1] + 0.5


def draw_weapon(wid, hand, angle, draw=0.0):
    L = R.PartLayer(W, H)
    if angle is None:                                  # weapon not in hand (thrown)
        return R.Canvas(W, H).to_image()
    ux, uy = _unit(snap(angle))
    px, py = -uy, ux
    for k, (a, b, wd, ramp, shape) in enumerate(WEAPONS[wid]):
        name = f's{k}'
        L.add_part(name, P.ramp_ids(ramp), 1 if shape == 'head' else 0)
        if shape == 'disc':
            c = (hand[0] + ux * (a + b) / 2, hand[1] + uy * (a + b) / 2)
            R.ellipse(L, c[0] - 0.5, c[1] - 0.5, wd / 2, wd / 2, name)
            continue
        if shape == 'bow':                             # arc across the aim line, string pulled back by `draw`
            half = wd / 2
            pts = []
            for i in range(13):
                t = -1 + 2 * i / 12
                bulge = 3.5 * (1 - t * t)
                pts.append((hand[0] + px * half * t + ux * bulge, hand[1] + py * half * t + uy * bulge))
            for p0, p1 in zip(pts, pts[1:]):
                R.capsule(L, (round(p0[0] - 0.5), round(p0[1] - 0.5)), (round(p1[0] - 0.5), round(p1[1] - 0.5)), 2, name)
            L.add_part('string', P.ramp_ids('gray'), -2)
            nock = (hand[0] - ux * 7 * draw, hand[1] - uy * 7 * draw)
            for end in (pts[0], pts[-1]):
                R.line(L, (round(end[0] - 0.5), round(end[1] - 0.5)), (round(nock[0] - 0.5), round(nock[1] - 0.5)),
                       'string')
            continue
        w0 = wd / 2
        w1 = 0.6 if shape == 'taper' else w0
        x0, y0 = hand[0] + ux * a, hand[1] + uy * a
        x1, y1 = hand[0] + ux * b, hand[1] + uy * b
        R.fill_polygon(L, [(x0 + px * w0, y0 + py * w0), (x1 + px * w1, y1 + py * w1),
                           (x1 - px * w1, y1 - py * w1), (x0 - px * w0, y0 - py * w0)], name)
    c = R.auto_shade(L)
    R.outline(c, P.INK)
    return c.to_image()


def floor_ok(wid, hand, angle):
    """True when the weapon (with its outline) stays above the floor (rows < 72)."""
    a = np.array(draw_weapon(wid, hand, angle))[:, :, 3] > 0
    return not a[ANCHOR[1]:].any()


def draw_smear(wid, hand, a0, a1, shock=None, r_out=None):
    """Area swept from angle a0 to a1 (in that direction: a1 > a0 sweeps forward through 0/90, a1 < a0
    sweeps back over the top) about the grip at the A frame: outer 40 % #ffffff, the rest #b0b0b0, no outline."""
    r_out = r_out or max(b for _a, b, *_ in WEAPONS[wid]) + 1
    r_in = 4
    ys, xs = np.mgrid[0:H, 0:W]
    dx, dy = xs + 0.5 - hand[0], ys + 0.5 - hand[1]
    r = np.hypot(dx, dy)
    ang = np.degrees(np.arctan2(dx, dy))
    lo, span = (a0, a1 - a0) if a1 >= a0 else (a1, a0 - a1)
    rel = (ang - lo) % 360
    inside = (rel <= span) & (r >= r_in) & (r <= r_out) & (ys < ANCHOR[1])      # clipped at the floor
    a = np.full((H, W), -1, np.int16)
    a[inside] = P.sid((0xb0, 0xb0, 0xb0))
    a[inside & (r > 0.6 * r_out)] = P.sid((0xff, 0xff, 0xff))
    if shock:
        # ground shock of a smash: a low wedge along the floor from the feet to `shock` px ahead
        fx, fy = ANCHOR
        t = (xs + 0.5 - fx) / shock
        hgt = 14 * (1 - t) + 4
        band = (t >= 0) & (t <= 1) & (ys < fy) & (ys >= fy - hgt)
        a[band] = P.sid((0xb0, 0xb0, 0xb0))
        a[band & (ys >= fy - hgt * 0.45)] = P.sid((0xff, 0xff, 0xff))
    return R.Canvas(W, H, a).to_image()


def body_shoulder(pose):
    j = humanoid_fk(pose)
    x, y = j['shoulderF']
    return x + BODY_OFFSET[0] + 0.5, y + BODY_OFFSET[1] + 0.5


def build_frames(wid):
    fr = {}
    for key in KEYS[wid]:
        poses = POSES[key]
        for i, pose in enumerate(poses):
            fr[f'{key}_{i:02d}'] = draw_weapon(wid, body_hand(pose), pose['weapon'], pose.get('draw', 0.0))
        if key in RANGED or key.startswith('charge_'):
            continue
        if wid in SHOULDER_SMEAR:
            fr[f'{key}_smear'] = draw_smear(wid, body_shoulder(poses[2]), *SMEAR[key], r_out=SHOULDER_SMEAR[wid])
        else:
            fr[f'{key}_smear'] = draw_smear(wid, body_hand(poses[2]), *SMEAR[key], shock=GROUND_SHOCK.get(key))
    for part, angles in DIVE_WEAPON.items():
        for i, pose in enumerate(POSES[part]):
            fr[f'dive_{wid}_{part[5:]}_{i:02d}'] = draw_weapon(wid, body_hand(pose), angles[i])
    return fr


def anims(wid):
    out = []
    for part in ('windup', 'fall', 'land'):
        mode, fps = ('loop', 16) if part == 'fall' else ('phase', None)
        seg = [{'phase': 'all', 'frames': [0, 1]}] if mode == 'phase' else None
        out.append(A.anim(f'dive_{wid}_{part}', f'weapon_{wid}', 2, mode, fps, segments=seg))
    return out


def build(assets, preview):
    from . import preview as V
    from PIL import Image
    out = []
    for wid in STEPS:
        fr = build_frames(wid)
        for n, img in fr.items():
            ok = P.allowed(['smear']) if n.endswith('_smear') else P.allowed(ALLOWED)
            P.check_palette_lock(img, ok, f'weapon_{wid}', n)
        A.pack_atlas(f'weapon_{wid}', fr, os.path.join(assets, 'atlases'))
        out += anims(wid)
    return out
