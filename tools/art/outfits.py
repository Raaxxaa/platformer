"""Player outfits (08 §6.4) drawn on the humanoid rig (08 §12.3)."""
import numpy as np

from . import palette as P
from . import raster as R
from .rig import humanoid_fk
from .poses.player import POSES

W = H = 48
ANCHOR = (24, 46)
OUTFITS = ['swordsman', 'tank', 'archer', 'wizard']
HEADWEAR = {'hat', 'hat_band', 'plume'}


class Fig:
    """A figure being drawn: one PartLayer, with trim parts tagged 'a' or 'b'."""

    def __init__(self, skip=()):
        self.L = R.PartLayer(W, H)
        self.trim = {}
        self.skip = set(skip)

    def part(self, name, ramp, shift=0, trim=None):
        if name not in self.L.index:
            self.L.add_part(name, P.ramp_ids(ramp), shift)
            if trim:
                self.trim[name] = trim
        return name

    def on(self, name):
        return name not in self.skip


def _box(f, x0, y0, x1, y1, part):
    """Inclusive pixel box."""
    R.fill_rect(f.L, x0, y0, x1 - x0 + 1, y1 - y0 + 1, part)


def _leg(f, j, side, mat_thigh, mat_shin, mat_boot, shift):
    hip, kn, ft = j['hip'], j['knee' + side], j['foot' + side]
    t = f.part('thigh' + side, mat_thigh, shift)
    s = f.part('shin' + side, mat_shin, shift)
    b = f.part('boot' + side, mat_boot, shift)
    R.capsule(f.L, (hip[0], hip[1] + 1), kn, 4, t)
    R.capsule(f.L, kn, (ft[0], ft[1] - 1), 3, s)
    # boot: 4 wide, 2 tall, toe forward; flat on the sole row when the shin is near vertical
    _box(f, ft[0] - 1, ft[1] - 1, ft[0] + 2, ft[1], b)


def _arm(f, j, side, mat_upper, mat_fore, shift, cuff=None):
    sh, el, ha = j['shoulder' + side], j['elbow' + side], j['hand' + side]
    u = f.part('upper' + side, mat_upper, shift)
    fo = f.part('fore' + side, mat_fore, shift)
    h = f.part('hand' + side, 'skin', shift)
    R.capsule(f.L, sh, el, 3, u)
    R.capsule(f.L, el, ha, 3, fo)
    if cuff:
        c = f.part('cuff' + side, 'trim', 0, cuff)
        mx, my = (el[0] + 2 * ha[0]) / 3, (el[1] + 2 * ha[1]) / 3
        R.capsule(f.L, (round(mx), round(my)), (round(mx), round(my)), 3, c)
    R.ellipse(f.L, ha[0], ha[1], 1.4, 1.4, h)


def _torso(f, j, mat, width, bottom_extra=1):
    c, hp = j['chest'], j['hip']
    t = f.part('torso', mat)
    hw = width / 2
    cx, hx = c[0] + 0.5, hp[0] + 0.5
    R.fill_polygon(f.L, [(cx - hw, c[1]), (cx + hw, c[1]), (hx + hw - 0.5, hp[1] + 1 + bottom_extra),
                         (hx - hw + 0.5, hp[1] + 1 + bottom_extra)], t)
    return t


def _belt(f, j, width, trim='b'):
    hp = j['hip']
    b = f.part('belt', 'trim', 0, trim)
    _box(f, hp[0] - width // 2, hp[1], hp[0] + width // 2 - 1 + (width % 2), hp[1], b)


def _head(f, j):
    hx, hy = j['head']
    h = f.part('head', 'skin')
    R.ellipse(f.L, hx, hy, 3.7, 4.1, h)
    return hx, hy


def _eye(f, j):
    hx, hy = j['head']
    e = f.part('eye', 'ink')
    _box(f, hx + 2, hy - 1, hx + 2, hy, e)


def draw(outfit, pose, skip=()):
    """Returns the Fig for one outfit and pose."""
    f = Fig(skip)
    j = humanoid_fk(pose)
    hx, hy = j['head']
    cx, cy = j['chest']
    hpx, hpy = j['hip']

    if outfit == 'swordsman':
        _arm(f, j, 'B', 'p_cloth', 'skin', 1, cuff='b')
        _leg(f, j, 'B', 'p_cloth', 'p_cloth', 'p_leather', 1)
        # scarf tail flutters behind the neck (trim A)
        tail = f.part('scarf_tail', 'trim', 0, 'a')
        sway = 1 if pose.get('lean', 0) else 0
        R.fill_polygon(f.L, [(cx - 1, cy), (cx - 5 - 2 * sway, cy + 1 - sway), (cx - 6 - 2 * sway, cy + 3 - sway),
                             (cx - 1, cy + 2)], tail)
        _torso(f, j, 'p_leather', 8)
        _belt(f, j, 8)
        _leg(f, j, 'F', 'p_cloth', 'p_cloth', 'p_leather', 0)
        _head(f, j)
        hair = f.part('hair', 'hair')
        R.fill_polygon(f.L, [(hx - 4, hy + 1), (hx - 5, hy - 5), (hx - 2, hy - 4), (hx - 1, hy - 7),
                             (hx + 1, hy - 4), (hx + 3, hy - 6), (hx + 4, hy - 3), (hx + 4.5, hy - 2),
                             (hx + 1, hy - 2), (hx - 1, hy - 1), (hx - 1, hy + 2)], hair)
        _eye(f, j)
        scarf = f.part('scarf', 'trim', 0, 'a')
        _box(f, cx - 3, cy - 1, cx + 3, cy, scarf)
        _arm(f, j, 'F', 'p_cloth', 'skin', 0, cuff='b')

    elif outfit == 'tank':
        _arm(f, j, 'B', 'p_cloth', 'p_steel', 1, cuff='b')
        pb = f.part('pauldronB', 'p_steel', 1)
        R.ellipse(f.L, j['shoulderB'][0] - 1, j['shoulderB'][1], 2.6, 2.4, pb)
        _leg(f, j, 'B', 'p_cloth', 'p_steel', 'p_steel', 1)
        _torso(f, j, 'p_steel', 10)
        stripe = f.part('tabard', 'trim', 0, 'a')
        _box(f, cx, cy + 2, cx + 1, hpy + 2, stripe)
        _belt(f, j, 10)
        _leg(f, j, 'F', 'p_cloth', 'p_steel', 'p_steel', 0)
        rv = f.part('rivets', 'trim', 0, 'b')
        for s in 'FB':
            k = j['knee' + s]
            _box(f, k[0] + 1, k[1], k[0] + 1, k[1], rv)
        if f.on('plume'):
            pl = f.part('plume', 'trim', 0, 'a')
            R.fill_polygon(f.L, [(hx - 1, hy - 3), (hx + 1, hy - 7), (hx - 2, hy - 8), (hx - 6, hy - 6),
                                 (hx - 6, hy - 3)], pl)
        helm = f.part('helmet', 'p_steel')
        R.ellipse(f.L, hx, hy, 4.2, 4.4, helm)
        visor = f.part('visor', 'p_steel', 3)
        _box(f, hx, hy - 1, hx + 4, hy, visor)
        _eye(f, j)
        pf = f.part('pauldronF', 'p_steel')
        _arm(f, j, 'F', 'p_cloth', 'p_steel', 0, cuff='b')
        R.ellipse(f.L, j['shoulderF'][0], j['shoulderF'][1], 2.8, 2.5, pf)

    elif outfit == 'archer':
        cape = f.part('cape', 'p_cloth', 1)
        flap = 2 if pose.get('lean', 0) else 0
        R.fill_polygon(f.L, [(cx - 2, cy - 1), (cx + 2, cy - 1), (cx - 1, hpy + 2),
                             (cx - 6 - flap, hpy + 1 - flap), (cx - 5, cy + 1)], cape)
        edge = f.part('cape_edge', 'trim', 0, 'a')
        R.line(f.L, (cx - 6 - flap, hpy + 1 - flap), (cx - 1, hpy + 2), edge)
        quiver = f.part('quiver', 'p_leather', 1)
        R.capsule(f.L, (cx - 3, cy + 6), (cx - 1, cy - 2), 3, quiver)
        fl = f.part('fletching', 'trim', 0, 'b')
        R.fill_polygon(f.L, [(cx - 2, cy - 2), (cx + 1, cy - 5), (cx + 2, cy - 4), (cx, cy - 1)], fl)
        _arm(f, j, 'B', 'p_cloth', 'trim', 1)
        f.trim['foreB'] = 'b'
        _leg(f, j, 'B', 'p_leather', 'p_leather', 'p_leather', 1)
        _torso(f, j, 'p_cloth', 8)
        _belt(f, j, 8, trim='b')
        f.trim['belt'] = 'b'
        _leg(f, j, 'F', 'p_leather', 'p_leather', 'p_leather', 0)
        hood = f.part('hood', 'p_cloth')
        R.ellipse(f.L, hx - 1, hy - 0.5, 4.3, 4.6, hood)
        R.fill_polygon(f.L, [(hx - 3, hy + 2), (hx - 7, hy + 6), (hx - 2, hy + 5)], hood)
        lining = f.part('hood_lining', 'trim', 0, 'a')
        R.ellipse(f.L, hx + 2, hy + 0.5, 2.7, 3.4, lining)
        face = f.part('head', 'skin')
        R.ellipse(f.L, hx + 2.6, hy + 0.8, 2.0, 2.7, face)
        _eye(f, j)
        _arm(f, j, 'F', 'p_cloth', 'trim', 0)
        f.trim['foreF'] = 'b'

    elif outfit == 'wizard':
        _arm(f, j, 'B', 'p_cloth', 'p_cloth', 1, cuff='b')
        _leg(f, j, 'B', 'p_leather', 'p_leather', 'p_leather', 1)
        _leg(f, j, 'F', 'p_leather', 'p_leather', 'p_leather', 0)
        robe = _torso(f, j, 'p_cloth', 8)
        kf, kb = j['kneeF'], j['kneeB']
        ky = max(kf[1], kb[1]) + 1
        x0 = min(kf[0], kb[0], hpx - 3) - 1.5
        x1 = max(kf[0], kb[0], hpx + 4) + 2.5
        R.fill_polygon(f.L, [(hpx - 3.5, hpy - 1), (hpx + 4.5, hpy - 1), (x1, ky + 1), (x0, ky + 1)], robe)
        hem = f.part('hem', 'trim', 0, 'a')
        R.fill_rect(f.L, int(round(x0)), ky, int(round(x1 - x0)), 1, hem)
        _belt(f, j, 8)   # sash
        _head(f, j)
        hair = f.part('hair', 'hair')
        R.fill_polygon(f.L, [(hx - 4, hy + 3), (hx - 4, hy - 2), (hx - 1, hy - 2), (hx - 2, hy + 3)], hair)
        _eye(f, j)
        if f.on('hat'):
            hat = f.part('hat', 'p_cloth')
            R.fill_polygon(f.L, [(hx - 3.5, hy - 2), (hx + 4.5, hy - 2), (hx + 1, hy - 7), (hx - 3, hy - 9),
                                 (hx - 6, hy - 8), (hx - 2, hy - 7)], hat)
            R.fill_rect(f.L, hx - 6, hy - 3, 13, 2, hat)
            band = f.part('hat_band', 'trim', 0, 'a')
            R.fill_rect(f.L, hx - 3, hy - 5, 7, 1, band)
        _arm(f, j, 'F', 'p_cloth', 'p_cloth', 0, cuff='b')
    else:
        raise ValueError(outfit)
    return f


def render(f):
    """Shade, outline, split into (body, trimA, trimB) images."""
    full = R.auto_shade(f.L)
    R.outline(full, P.INK)
    trim_mask = {'a': np.zeros((H, W), bool), 'b': np.zeros((H, W), bool)}
    for name, tag in f.trim.items():
        if name in f.L.index:
            trim_mask[tag] |= f.L.ids == f.L.index[name]
    body = full.a.copy()
    body[trim_mask['a'] | trim_mask['b']] = -1
    out = [R.Canvas(W, H, body)]
    for tag in 'ab':
        a = np.where(trim_mask[tag], full.a, -1).astype(np.int16)
        out.append(R.Canvas(W, H, a))
    return [c.to_image() for c in out]


def draw_player(outfit, pose):
    return render(draw(outfit, pose))


def build_outfit(outfit):
    """Returns (body frames, trim frames) dicts for one outfit."""
    body, trim = {}, {}
    for key, poses in POSES.items():
        for i, pose in enumerate(poses):
            name = f'{key}_{i:02d}'
            b, ta, tb = draw_player(outfit, pose)
            body[name] = b
            trim['a/' + name] = ta
            trim['b/' + name] = tb
    return body, trim
