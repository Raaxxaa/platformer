"""ART10 Part B: the player as colorable layers (09 §7).

One combined figure per (outfit, race, pose) is drawn on the humanoid rig, shaded once, and then split into layers by
which part is visible at each pixel, so the layers never overlap each other. Tinted layers use the four fixed greys
(`grey4`): the game multiplies them by a skin, dye or hair color. Hair, beards, faces and headwear are drawn on their
own (they swap independently), each placed from the pose's head joint.

Layer order, back to front (09 §7): skin, outfitA, outfitB, fixed, trim A, trim B, beard, hair, headwear, then the
face sits right above `fixed` (it never overlaps a trim)."""
import numpy as np
from PIL import Image

from . import palette as P
from . import raster as R
from .rig import humanoid_fk
from .poses.player import POSES

W = H = 48
RACES = ['human', 'elf', 'dwarf', 'orc']
OUTFITS = ['leather', 'plate', 'ranger', 'robe']
LEGACY = {'leather': 'swordsman', 'plate': 'tank', 'ranger': 'archer', 'robe': 'wizard'}
HAIRS = ['bald', 'short', 'spiky', 'long_tied', 'braid', 'mohawk', 'curly', 'top_knot']
BEARDS = ['none', 'stubble', 'short', 'long', 'braided']
FACES = ['calm', 'fierce', 'cheerful', 'tired']
TINTED = ('skin', 'A', 'B')
GREY = 'grey4'


class Fig:
    """The combined figure: every part knows its layer. Tinted layers always use the grey ramp."""

    def __init__(self):
        self.L = R.PartLayer(W, H)
        self.layer = {}

    def part(self, name, layer, ramp=None, shift=0):
        if name not in self.L.index:
            if layer in TINTED:
                ramp = GREY
                shift += -2 if layer == 'skin' else -1
            elif layer.startswith('trim'):
                ramp = 'trim'
            self.L.add_part(name, P.ramp_ids(ramp), shift)
            self.layer[name] = layer
        return name


def _box(f, x0, y0, x1, y1, part):
    R.fill_rect(f.L, x0, y0, x1 - x0 + 1, y1 - y0 + 1, part)


def _leg(f, j, side, thigh, shin, boot, shift):
    """thigh/shin/boot: (layer, ramp) pairs."""
    hip, kn, ft = j['hip'], j['knee' + side], j['foot' + side]
    t = f.part('thigh' + side, thigh[0], thigh[1], shift)
    s = f.part('shin' + side, shin[0], shin[1], shift)
    b = f.part('boot' + side, boot[0], boot[1], shift)
    R.capsule(f.L, (hip[0], hip[1] + 1), kn, 4, t)
    R.capsule(f.L, kn, (ft[0], ft[1] - 1), 3, s)
    _box(f, ft[0] - 1, ft[1] - 1, ft[0] + 2, ft[1], b)


def _arm(f, j, side, upper, fore, shift, cuff=None, hand_r=1.4):
    sh, el, ha = j['shoulder' + side], j['elbow' + side], j['hand' + side]
    u = f.part('upper' + side, upper[0], upper[1], shift)
    fo = f.part('fore' + side, fore[0], fore[1], shift)
    h = f.part('hand' + side, 'skin', None, shift)
    R.capsule(f.L, sh, el, 3, u)
    R.capsule(f.L, el, ha, 3, fo)
    if cuff:
        c = f.part('cuff' + side, 'trim_' + cuff)
        mx, my = (el[0] + 2 * ha[0]) / 3, (el[1] + 2 * ha[1]) / 3
        R.capsule(f.L, (round(mx), round(my)), (round(mx), round(my)), 3, c)
    R.ellipse(f.L, ha[0], ha[1], hand_r, hand_r, h)


def _torso(f, j, layer, ramp, width, bottom_extra=1, name='torso'):
    c, hp = j['chest'], j['hip']
    t = f.part(name, layer, ramp)
    hw = width / 2
    cx, hx = c[0] + 0.5, hp[0] + 0.5
    dx, dy = c[0] - hp[0], c[1] - hp[1]
    if abs(dx) <= 3:
        R.fill_polygon(f.L, [(cx - hw, c[1]), (cx + hw, c[1]), (hx + hw - 0.5, hp[1] + 1 + bottom_extra),
                             (hx - hw + 0.5, hp[1] + 1 + bottom_extra)], t)
        return t
    ln = (dx * dx + dy * dy) ** 0.5
    ux, uy = dx / ln, dy / ln
    px, py = -uy, ux
    b = 1 + bottom_extra
    R.fill_polygon(f.L, [(cx + px * hw, c[1] + 0.5 + py * hw), (cx - px * hw, c[1] + 0.5 - py * hw),
                         (hx - px * (hw - 0.5) - ux * b, hp[1] + 0.5 - py * (hw - 0.5) - uy * b),
                         (hx + px * (hw - 0.5) - ux * b, hp[1] + 0.5 + py * (hw - 0.5) - uy * b)], t)
    return t


def _belt(f, j, width, trim='b'):
    hp = j['hip']
    b = f.part('belt', 'trim_' + trim)
    _box(f, hp[0] - width // 2, hp[1], hp[0] + width // 2 - 1 + (width % 2), hp[1], b)


# The head joint and the head the outfits are fitted to are the human's. A race adds pixels *behind* everything (drawn
# first, so clothes and arms cover them the same way for every race): ears and a pointed chin for elves, a broad head for
# dwarves, a heavy jaw for orcs. That keeps the cloth and trim layers identical for every race (09 §1).
HEAD_RX, HEAD_RY = 3.7, 4.1


def _head(f, j, race):
    hx, hy = j['head']
    h = f.part('head', 'skin')
    R.ellipse(f.L, hx, hy, HEAD_RX, HEAD_RY, h)
    _race_head_details(f, j, race)
    return hx, hy


def _behind(f, j, race):
    hx, hy = j['head']
    if race == 'elf':
        ear = f.part('ear', 'skin')
        R.fill_polygon(f.L, [(hx - 1.2, hy - 1.8), (hx - 8.2, hy - 6.8), (hx - 3.4, hy + 1.2)], ear)
        chin = f.part('head', 'skin')
        R.fill_rect(f.L, hx + 1, hy + 4, 2, 1, chin)
    elif race == 'dwarf':
        R.ellipse(f.L, hx, hy + 0.5, 4.4, 3.9, f.part('head', 'skin'))
        R.fill_rect(f.L, hx + 3, hy + 0, 2, 2, f.part('head', 'skin'))           # a stout nose
    elif race == 'orc':
        R.ellipse(f.L, hx + 0.3, hy + 0.3, 4.0, 4.3, f.part('head', 'skin'))


def _race_head_details(f, j, race, brow=True):
    """Orc: a heavy brow (a darker band of skin) and two ivory tusks (untinted), right after the head."""
    hx, hy = j['head']
    if race == 'orc':
        if brow:
            band = f.part('brow', 'skin', None, 2)
            _box(f, hx + 1, hy - 2, hx + 3, hy - 2, band)
        tusk = f.part('tusk', 'fixed', 'white')
        _box(f, hx + 3, hy + 1, hx + 3, hy + 2, tusk)


def draw_figure(outfit, pose, race):
    """The combined, unshaded figure for one outfit, race and pose."""
    f = Fig()
    j = humanoid_fk(pose)
    hx, hy = j['head']
    cx, cy = j['chest']
    hpx, hpy = j['hip']
    hand_r = 1.4
    _behind(f, j, race)
    A, B, FX = 'A', 'B', 'fixed'
    if outfit == 'leather':
        _arm(f, j, 'B', (A, None), ('skin', None), 1, cuff='b', hand_r=hand_r)
        _leg(f, j, 'B', (A, None), (A, None), (FX, 'p_leather'), 1)
        tail = f.part('scarf_tail', 'trim_a')
        sway = 1 if pose.get('lean', 0) else 0
        R.fill_polygon(f.L, [(cx - 1, cy), (cx - 5 - 2 * sway, cy + 1 - sway), (cx - 6 - 2 * sway, cy + 3 - sway),
                             (cx - 1, cy + 2)], tail)
        _torso(f, j, B, None, 8)
        _belt(f, j, 8)
        _leg(f, j, 'F', (A, None), (A, None), (FX, 'p_leather'), 0)
        _head(f, j, race)
        scarf = f.part('scarf', 'trim_a')
        _box(f, cx - 3, cy - 1, cx + 3, cy, scarf)
        _arm(f, j, 'F', (A, None), ('skin', None), 0, cuff='b', hand_r=hand_r)
    elif outfit == 'plate':
        _arm(f, j, 'B', (A, None), (FX, 'p_steel'), 1, cuff='b', hand_r=hand_r)
        pb = f.part('pauldronB', FX, 'p_steel', 1)
        R.ellipse(f.L, j['shoulderB'][0] - 1, j['shoulderB'][1], 2.6, 2.4, pb)
        _leg(f, j, 'B', (A, None), (FX, 'p_steel'), (FX, 'p_steel'), 1)
        _torso(f, j, FX, 'p_steel', 10)
        stripe = f.part('tabard', 'trim_a')
        _box(f, cx, cy + 2, cx + 1, hpy + 2, stripe)
        _belt(f, j, 10)
        # a short cloth skirt under the belt (cloth B), so the set has a second dye
        skirt = f.part('skirt', B)
        R.fill_polygon(f.L, [(hpx - 4.5, hpy + 1), (hpx + 5.5, hpy + 1), (hpx + 6, hpy + 4), (hpx - 5, hpy + 4)], skirt)
        _leg(f, j, 'F', (A, None), (FX, 'p_steel'), (FX, 'p_steel'), 0)
        rv = f.part('rivets', 'trim_b')
        for s in 'FB':
            k = j['knee' + s]
            _box(f, k[0] + 1, k[1], k[0] + 1, k[1], rv)
        _head(f, j, race)
        pl = f.part('plume', 'trim_a')
        R.fill_polygon(f.L, [(hx - 1, hy - 3), (hx + 1, hy - 7), (hx - 2, hy - 8), (hx - 6, hy - 6),
                             (hx - 6, hy - 3)], pl)
        pf = f.part('pauldronF', FX, 'p_steel')
        _arm(f, j, 'F', (A, None), (FX, 'p_steel'), 0, cuff='b', hand_r=hand_r)
        R.ellipse(f.L, j['shoulderF'][0], j['shoulderF'][1], 2.8, 2.5, pf)
    elif outfit == 'ranger':
        cape = f.part('cape', B, None, 1)
        flap = 2 if pose.get('lean', 0) else 0
        R.fill_polygon(f.L, [(cx - 2, cy - 1), (cx + 2, cy - 1), (cx - 1, hpy + 2),
                             (cx - 6 - flap, hpy + 1 - flap), (cx - 5, cy + 1)], cape)
        edge = f.part('cape_edge', 'trim_a')
        R.line(f.L, (cx - 6 - flap, hpy + 1 - flap), (cx - 1, hpy + 2), edge)
        quiver = f.part('quiver', FX, 'p_leather', 1)
        R.capsule(f.L, (cx - 3, cy + 6), (cx - 1, cy - 2), 3, quiver)
        fl = f.part('fletching', 'trim_b')
        R.fill_polygon(f.L, [(cx - 2, cy - 2), (cx + 1, cy - 5), (cx + 2, cy - 4), (cx, cy - 1)], fl)
        _arm(f, j, 'B', (A, None), ('trim_b', None), 1, hand_r=hand_r)
        _leg(f, j, 'B', (FX, 'p_leather'), (FX, 'p_leather'), (FX, 'p_leather'), 1)
        _torso(f, j, A, None, 8)
        _belt(f, j, 8, trim='b')
        _leg(f, j, 'F', (FX, 'p_leather'), (FX, 'p_leather'), (FX, 'p_leather'), 0)
        hood = f.part('hood', A)
        R.ellipse(f.L, hx - 1, hy - 0.5, 4.3, 4.6, hood)
        R.fill_polygon(f.L, [(hx - 3, hy + 2), (hx - 7, hy + 6), (hx - 2, hy + 5)], hood)
        lining = f.part('hood_lining', 'trim_a')
        R.ellipse(f.L, hx + 2, hy + 0.5, 2.7, 3.4, lining)
        face = f.part('head', 'skin')
        R.ellipse(f.L, hx + 2.6, hy + 0.8, 2.0, 2.7, face)
        _race_head_details(f, j, race, brow=False)
        _arm(f, j, 'F', (A, None), ('trim_b', None), 0, hand_r=hand_r)
    elif outfit == 'robe':
        _arm(f, j, 'B', (A, None), (A, None), 1, cuff='b', hand_r=hand_r)
        _leg(f, j, 'B', (FX, 'p_leather'), (FX, 'p_leather'), (FX, 'p_leather'), 1)
        _leg(f, j, 'F', (FX, 'p_leather'), (FX, 'p_leather'), (FX, 'p_leather'), 0)
        robe = _torso(f, j, A, None, 8)
        kf, kb = j['kneeF'], j['kneeB']
        ky = max(kf[1], kb[1]) + 1
        x0 = min(kf[0], kb[0], hpx - 3) - 1.5
        x1 = max(kf[0], kb[0], hpx + 4) + 2.5
        R.fill_polygon(f.L, [(hpx - 3.5, hpy - 1), (hpx + 4.5, hpy - 1), (x1, ky + 1), (x0, ky + 1)], robe)
        hem = f.part('hem', 'trim_a')
        R.fill_rect(f.L, int(round(x0)), ky, int(round(x1 - x0)), 1, hem)
        _belt(f, j, 8)
        _head(f, j, race)
        _arm(f, j, 'F', (A, None), (A, None), 0, cuff='b', hand_r=hand_r)
    else:
        raise ValueError(outfit)
    if pose.get('flask'):
        hx2, hy2 = j['handF']
        g = f.part('flask', FX, 'fx_heal')
        R.ellipse(f.L, hx2 + 1, hy2 - 1, 2.2, 2.4, g)
        _box(f, hx2 + 1, hy2 - 5, hx2 + 1, hy2 - 3, g)
    return f, j


# --- splitting ---------------------------------------------------------------------------------------------------

def split(f):
    """Shade the figure, then give each layer the pixels whose visible part belongs to it. The ink outline of the
    bare figure goes to `fixed`. Returns {layer: slot array}, with layers 'skin', 'A', 'B', 'fixed', 'trim_a', 'trim_b'."""
    full = R.auto_shade(f.L)
    R.outline(full, P.INK)
    layer_of = np.array([f.layer[name] for name, _r in f.L.parts] + [''], dtype=object)
    lid = layer_of[f.L.ids]
    out = {}
    for name in ('skin', 'A', 'B', 'fixed', 'trim_a', 'trim_b'):
        m = lid == name
        if name == 'fixed':
            m = m | ((f.L.ids < 0) & (full.a >= 0))            # the outline
        out[name] = np.where(m, full.a, -1).astype(np.int16)
    return out


# --- transforms (the same for every layer of a frame) --------------------------------------------------------------

class Xform:
    """The pose's quarter turn and ground settle, worked out from the bare figure and applied to every layer."""

    def __init__(self, union_mask, pose):
        self.k = pose.get('rot', 0)
        self.ground = pose.get('ground', False)
        ys, xs = np.nonzero(union_mask)
        self.y0, self.y1, self.x0, self.x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        self.cy, self.cx = (self.y0 + self.y1) // 2, (self.x0 + self.x1) // 2
        turned = self._turn(union_mask)
        low = int(np.nonzero(turned.any(axis=1))[0].max())
        self.shift = (45 - low) if self.ground else min(0, 45 - low)

    MARGIN = 12

    def _turn(self, a):
        """The legacy turn (outfits._turn) on the bare figure's box, but carrying MARGIN px of overhang with it."""
        if not self.k:
            return a
        M = self.MARGIN
        fill = -1 if a.dtype == np.int16 else 0
        big = np.full((a.shape[0] + 2 * M,) + (a.shape[1] + 2 * M,) + a.shape[2:], fill, a.dtype)
        big[M:-M, M:-M] = a
        crop = big[self.y0:self.y1 + 2 * M, self.x0:self.x1 + 2 * M]
        rot = np.rot90(crop, self.k)
        h, w = self.y1 - self.y0, self.x1 - self.x0
        nh, nw = (w, h) if self.k % 2 else (h, w)
        oy, ox = self.cy - nh // 2 - M, self.cx - nw // 2 - M
        out = np.full_like(a, fill)
        y_a, x_a = max(0, oy), max(0, ox)
        y_b, x_b = min(a.shape[0], oy + rot.shape[0]), min(a.shape[1], ox + rot.shape[1])
        out[y_a:y_b, x_a:x_b] = rot[y_a - oy:y_b - oy, x_a - ox:x_b - ox]
        return out

    def apply(self, a):
        a = self._turn(a)
        if self.shift > 0:
            o = np.full_like(a, -1) if a.dtype == np.int16 else np.zeros_like(a)
            o[self.shift:] = a[:-self.shift]
            return o
        if self.shift < 0:
            o = np.full_like(a, -1) if a.dtype == np.int16 else np.zeros_like(a)
            o[:self.shift] = a[-self.shift:]
            return o
        return a

    def point(self, p):
        m = np.zeros((H, W), np.int16)
        x, y = int(p[0]), int(p[1])
        if 0 <= x < W and 0 <= y < H:
            m[y, x] = 1
        r = self.apply(m)
        ys, xs = np.nonzero(r)
        return [int(xs[0]), int(ys[0])] if len(xs) else [x, y + self.shift]


# --- overlays: hair, beards, faces, headwear ------------------------------------------------------------------------

class Ov:
    """A small figure for one overlay layer: parts in the grey ramp (or a real one), shaded and outlined on its own."""

    def __init__(self):
        self.L = R.PartLayer(W, H)

    def part(self, name, ramp=GREY, shift=0):
        if name not in self.L.index:
            self.L.add_part(name, P.ramp_ids(ramp), shift - 1 if ramp == GREY else shift)
        return name

    def done(self, outline=True, clip_above=None):
        c = R.auto_shade(self.L)
        if clip_above is not None:
            c.a[:clip_above] = -1
        if outline:
            R.outline(c, P.INK)
        return c.a


def hair(style, j, hat=False):
    """A hair style around the head joint, facing right. `hat`: only what shows below a hat's brim."""
    hx, hy = j['head']
    o = Ov()
    h = o.part('hair')
    d = o.part('hair_dark', GREY, 1)
    if style == 'bald':
        return None
    cap = [(hx - 4.5, hy + 1.5), (hx - 4.8, hy - 3), (hx - 2, hy - 5.6), (hx + 2, hy - 5.6), (hx + 4.2, hy - 3.4),
           (hx + 4.6, hy - 2), (hx + 1.5, hy - 2.6), (hx - 1, hy - 1.2), (hx - 1.2, hy + 2)]
    if style == 'short':
        R.fill_polygon(o.L, cap, h)
    elif style == 'spiky':
        R.fill_polygon(o.L, [(hx - 4, hy + 1), (hx - 5, hy - 5), (hx - 2, hy - 4), (hx - 1, hy - 7), (hx + 1, hy - 4),
                             (hx + 3, hy - 6), (hx + 4, hy - 3), (hx + 4.5, hy - 2), (hx + 1, hy - 2), (hx - 1, hy - 1),
                             (hx - 1, hy + 2)], h)
    elif style == 'long_tied':
        R.fill_polygon(o.L, cap, h)
        R.capsule(o.L, (hx - 4, hy - 1), (hx - 8, hy + 5), 3, d)
        tie = o.part('tie', GREY, 2)
        R.fill_rect(o.L, hx - 6, hy + 0, 2, 2, tie)
    elif style == 'braid':
        R.fill_polygon(o.L, cap, h)
        for k in range(7):
            R.ellipse(o.L, hx - 5 - (k % 2), hy + 2 + k * 1.4, 1.5, 1.2, h if k % 2 else d)
    elif style == 'mohawk':
        R.fill_polygon(o.L, [(hx - 3.4, hy - 2.5), (hx - 3, hy - 7), (hx - 1, hy - 5.5), (hx + 0.5, hy - 8.5),
                             (hx + 2, hy - 5.5), (hx + 3.6, hy - 6.5), (hx + 3.6, hy - 2.5), (hx + 1, hy - 3.4),
                             (hx - 1, hy - 3.4)], h)
        R.fill_polygon(o.L, [(hx - 4.4, hy + 1.2), (hx - 4.4, hy - 2), (hx - 2.6, hy - 3), (hx - 1.5, hy + 1.6)], d)
    elif style == 'curly':
        for (x, y, r) in ((-3.5, -2.6, 2.2), (-0.8, -4.4, 2.3), (2.6, -3.6, 2.0), (-4.6, 0.6, 2.0), (-3.6, 3.0, 1.8),
                          (0.3, -2.8, 1.8)):
            R.ellipse(o.L, hx + x, hy + y, r, r, h)
        for (x, y, r) in ((-2.2, -0.5, 1.6), (-4.4, 2.0, 1.2)):
            R.ellipse(o.L, hx + x, hy + y, r, r, d)
    elif style == 'top_knot':
        R.fill_polygon(o.L, [(hx - 4.3, hy + 1.3), (hx - 4.5, hy - 2.8), (hx - 2, hy - 4.8), (hx + 2, hy - 4.8),
                             (hx + 3.8, hy - 3.2), (hx + 4.4, hy - 2), (hx + 1.5, hy - 2.6), (hx - 1, hy - 1.2),
                             (hx - 1.2, hy + 1.8)], h)
        R.ellipse(o.L, hx - 1, hy - 7.2, 2.4, 2.2, d)
        tie = o.part('tie', GREY, 2)
        R.fill_rect(o.L, hx - 2, hy - 5, 3, 1, tie)
    else:
        raise ValueError(style)
    return o.done(clip_above=(hy - 1) if hat else None)


def beard(style, j):
    hx, hy = j['head']
    if style == 'none':
        return None
    o = Ov()
    b = o.part('beard')
    d = o.part('beard_dark', GREY, 1)
    if style == 'stubble':
        for (x, y) in ((0, 3), (1, 4), (2, 3), (3, 2), (3, 4), (2, 5), (-1, 3), (0, 5), (-2, 4), (4, 3)):
            R.fill_rect(o.L, hx + x, hy + y, 1, 1, d)
        return o.done(outline=False)
    R.fill_polygon(o.L, [(hx - 1.5, hy + 0.5), (hx + 3.6, hy + 1.6), (hx + 4.4, hy + 3.4), (hx + 3, hy + 5.6),
                         (hx, hy + 6), (hx - 2.2, hy + 3.4)], b)
    if style == 'long':
        R.fill_polygon(o.L, [(hx - 1.5, hy + 3), (hx + 3.6, hy + 3), (hx + 3.4, hy + 8), (hx + 1.2, hy + 11),
                             (hx - 1.2, hy + 8.5)], b)
        R.fill_polygon(o.L, [(hx + 0.2, hy + 6), (hx + 1.8, hy + 6), (hx + 1.4, hy + 9.5)], d)
    elif style == 'braided':
        for k in range(5):
            R.ellipse(o.L, hx + 1.2 + (0.6 if k % 2 else -0.4), hy + 6 + k * 1.5, 1.3, 1.1, d if k % 2 else b)
    mouth = o.part('mouth', 'ink')
    R.fill_rect(o.L, hx + 2, hy + 2, 2, 1, mouth)
    return o.done()


def face(n, j, dead=False):
    """Eyes and brows (ink) at the head joint: calm, fierce, cheerful, tired."""
    hx, hy = j['head']
    o = Ov()
    e = o.part('eye', 'ink')
    kind = FACES[n]
    if dead:
        R.fill_rect(o.L, hx + 1, hy, 2, 1, e)
        if kind == 'fierce':
            R.fill_rect(o.L, hx + 1, hy - 2, 2, 1, e)
        return o.done(outline=False)
    if kind == 'calm':
        R.fill_rect(o.L, hx + 2, hy - 1, 1, 2, e)
    elif kind == 'fierce':                           # a heavy brow slanting down to the nose and a grim mouth
        R.fill_rect(o.L, hx + 2, hy - 1, 1, 2, e)
        R.fill_rect(o.L, hx + 1, hy - 3, 1, 1, e)
        R.fill_rect(o.L, hx + 2, hy - 2, 2, 1, e)
        R.fill_rect(o.L, hx + 2, hy + 2, 2, 1, e)
    elif kind == 'cheerful':                         # a happy arched eye and a smile
        R.fill_rect(o.L, hx + 1, hy, 1, 1, e)
        R.fill_rect(o.L, hx + 2, hy - 1, 1, 1, e)
        R.fill_rect(o.L, hx + 3, hy, 1, 1, e)
        R.fill_rect(o.L, hx + 2, hy + 2, 1, 1, e)
        R.fill_rect(o.L, hx + 3, hy + 1, 1, 1, e)
    elif kind == 'tired':                            # a half-closed lid, a drooping brow and a small flat mouth
        R.fill_rect(o.L, hx + 2, hy, 2, 1, e)
        R.fill_rect(o.L, hx + 1, hy - 2, 2, 1, e)
        R.fill_rect(o.L, hx + 3, hy - 1, 1, 1, e)
        R.fill_rect(o.L, hx + 3, hy + 2, 1, 1, e)
    return o.done(outline=False)


def headwear(outfit, j):
    """Built-in headwear: the plate helmet (steel, untinted) and the robe hat (grey, tinted with cloth B)."""
    hx, hy = j['head']
    if outfit == 'plate':
        o = Ov()
        helm = o.part('helmet', 'p_steel')
        R.ellipse(o.L, hx, hy, 4.2, 4.4, helm)
        visor = o.part('visor', 'p_steel', 3)
        _box(o, hx, hy - 1, hx + 4, hy, visor)
        slit = o.part('slit', 'ink')
        _box(o, hx + 1, hy - 1, hx + 4, hy - 1, slit)
        return o.done()
    if outfit == 'robe':
        o = Ov()
        hat = o.part('hat')
        R.fill_polygon(o.L, [(hx - 3.5, hy - 2), (hx + 4.5, hy - 2), (hx + 1, hy - 7), (hx - 3, hy - 9),
                             (hx - 6, hy - 8), (hx - 2, hy - 7)], hat)
        R.fill_rect(o.L, hx - 6, hy - 3, 13, 2, hat)
        band = o.part('band', GREY, 2)
        R.fill_rect(o.L, hx - 3, hy - 5, 7, 1, band)
        return o.done()
    return None


# --- the build ---------------------------------------------------------------------------------------------------

def _poses():
    for key, poses in POSES.items():
        for i, pose in enumerate(poses):
            yield f'{key}_{i:02d}', pose


def _points(j, pose, xf):
    hip, ch = j['hip'], j['chest']
    ux, uy = ch[0] - hip[0], ch[1] - hip[1]
    n = max(1e-6, (ux * ux + uy * uy) ** 0.5)
    ux, uy = ux / n, uy / n
    fx, fy = -uy, ux                                  # forward (+x when upright)
    back = (round(ch[0] - fx * 3 - ux * 2), round(ch[1] - fy * 3 - uy * 2))
    pts = {'head': j['head'], 'back': back, 'neck': (ch[0], ch[1] - 1), 'shoulder': j['shoulderF']}
    return {k: xf.point(v) for k, v in pts.items()}


def _img(a):
    return R.Canvas(W, H, a.astype(np.int16)).to_image()


def render_all():
    """Every layer frame of the player. Returns (atlases {name: {frame: Image}}, points {outfit: {frame: {...}}})."""
    atl = {}

    def put(name, frame, arr):
        if arr is None:
            return
        atl.setdefault(name, {})[frame] = _img(arr)
    points = {o: {} for o in OUTFITS}
    for frame, pose in _poses():
        dead = bool(pose.get('dead'))
        sp = {}
        js = {}
        for outfit in OUTFITS:
            for race in RACES:
                f, j = draw_figure(outfit, pose, race)
                sp[(outfit, race)] = split(f)
                js[outfit] = j
        j = js['leather']
        # one transform for every layer of the frame, from the bare silhouette of every outfit together
        union = np.zeros((H, W), bool)
        for outfit in OUTFITS:
            for layer, a in sp[(outfit, 'human')].items():
                union |= a >= 0
        xf = Xform(union, pose)
        for outfit in OUTFITS:
            h = sp[(outfit, 'human')]
            put(f'player_outfitA_{outfit}', frame, xf.apply(h['A']))
            put(f'player_outfitB_{outfit}', frame, xf.apply(h['B']))
            put(f'player_{outfit}_trim', 'a/' + frame, xf.apply(h['trim_a']))
            put(f'player_{outfit}_trim', 'b/' + frame, xf.apply(h['trim_b']))
            for race in RACES:
                put(f'player_fixed_{race}_{outfit}', frame, xf.apply(sp[(outfit, race)]['fixed']))
            points[outfit][frame] = _points(js[outfit], pose, xf)
        for race in RACES:
            skin = np.full((H, W), -1, np.int16)
            for outfit in OUTFITS:
                a = sp[(outfit, race)]['skin']
                skin = np.where(skin < 0, a, skin)
            put(f'player_skin_{race}', frame, xf.apply(skin))
        for n in range(len(FACES)):
            put(f'player_face_{FACES[n]}', frame, xf.apply(face(n, j, dead)))
        for style in HAIRS:
            if style == 'bald':
                continue
            put(f'player_hair_{style}', frame, xf.apply(hair(style, j)))
            put(f'player_hair_{style}_hat', frame, xf.apply(hair(style, j, hat=True)))
        for style in BEARDS:
            if style != 'none':
                put(f'player_beard_{style}', frame, xf.apply(beard(style, j)))
        for outfit in ('plate', 'robe'):
            put(f'player_headwear_{outfit}', frame, xf.apply(headwear(outfit, j)))
    return atl, points


# --- composing a look (previews and boards; the game does the same with tints) ------------------------------------

import functools


@functools.lru_cache(maxsize=1)
def layers():
    return render_all()


def _rgb(hexcode):
    return tuple(int(hexcode[i:i + 2], 16) for i in (1, 3, 5))


def tinted(img, base_hex, kind='cloth'):
    """Multiply a grey-ramp layer by the tint for `base_hex` (what Phaser's setTint does)."""
    t = _rgb(P.tint_for(base_hex, kind))
    a = np.array(img).astype(np.float32)
    for i in range(3):
        a[:, :, i] = np.floor(a[:, :, i] * t[i] / 255.0 + 0.5)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def tinted_rgb(img, rgb):
    a = np.array(img).astype(np.float32)
    for i in range(3):
        a[:, :, i] = np.floor(a[:, :, i] * rgb[i] / 255.0 + 0.5)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


AIR = {'jump', 'apex', 'fall', 'double', 'wall', 'dive', 'ledge'}
DEFAULT_LOOK = dict(race='human', skin=2, face='calm', hair='spiky', hair_color='#5a3a28', beard='none',
                    outfit='leather', color_a='#4a5a78', color_b='#6b4a30')


def compose(frame, look=None, trim_colors=((0x42, 0xd9, 0xff), (0xff, 0xa8, 0x3a)), accessories=()):
    """The full character for one frame name like 'idle_00' as a 48 × 48 RGBA image."""
    lk = dict(DEFAULT_LOOK)
    lk.update(look or {})
    atl, pts = layers()
    race, outfit = lk['race'], lk['outfit']
    skin_hex = (COSMETIC.skin_orc if race == 'orc' else COSMETIC.skin)[lk['skin']]
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    from . import cosmetics as CS
    accs = {CS.ALL[a][0]: a for a in accessories}
    if accs.get('head') is None and 'hat' in lk:
        pass

    def get(name, key=None):
        return atl.get(name, {}).get(key or frame)

    def put(img):
        if img is not None:
            out.alpha_composite(img)
    def wear(cid):
        slot, point, n, _fn = CS.ALL[cid]
        i = 0 if n == 1 else (2 if frame.split('_')[0] in AIR else (1 if frame.startswith('run') else 0))
        if n == 2:
            i = int(frame[-2:]) % 2
        img = CS.frames_cache()[f'{cid}_{i:02d}']
        px, py = pts[outfit][frame][point]
        out.alpha_composite(img, (px - CS.AX, py - CS.AY))
    if 'back' in accs:
        wear(accs['back'])
    for img, col, kind in ((get(f'player_skin_{race}'), skin_hex, 'skin'),
                           (get(f'player_outfitA_{outfit}'), lk['color_a'], 'cloth'),
                           (get(f'player_outfitB_{outfit}'), lk['color_b'], 'cloth')):
        if img is not None:
            put(tinted(img, col, kind))
    put(get(f'player_fixed_{race}_{outfit}'))
    put(get(f"player_face_{lk['face']}"))
    for tag, col in (('a', trim_colors[0]), ('b', trim_colors[1])):
        t = get(f'player_{outfit}_trim', f'{tag}/{frame}')
        if t is not None:
            put(tinted_rgb(t, col))
    if lk['beard'] != 'none':
        put(tinted(get(f"player_beard_{lk['beard']}"), lk['hair_color']))
    hat = outfit in ('plate', 'robe', 'ranger') or 'head' in accs
    if lk['hair'] != 'bald':
        put(tinted(get(f"player_hair_{lk['hair']}" + ('_hat' if hat else '')), lk['hair_color']))
    hw = get(f'player_headwear_{outfit}') if 'head' not in accs else None
    if hw is not None:
        put(tinted(hw, lk['color_b']) if outfit == 'robe' else hw)
    if 'extra' in accs:
        wear(accs['extra'])
    if 'head' in accs:
        wear(accs['head'])
    return out


class _Cosmetic:
    skin = P.COSMETIC_COLORS['skin']
    skin_orc = P.COSMETIC_COLORS['skin_orc']


COSMETIC = _Cosmetic


# --- atlas output, manifest, anims.json points ---------------------------------------------------------------------

GREY_ATLASES = ('skin', 'outfitA', 'outfitB', 'hair', 'beard')


def _cos_manifest():
    from . import cosmetics
    return cosmetics.manifest()


def _layer_manifest():
    import json
    from . import atlas as A
    atl, _pts = layers()
    cc = P.COSMETIC_COLORS

    def colors(names, hexes, kind='cloth'):
        return [{'id': n, 'base': h, 'tint': P.tint_for(h, kind)} for n, h in zip(names, hexes)]
    return {
        'note': 'Generated by tools/art/look.py (ART10). 09 §7: the player is drawn as these layers, back to front.',
        'frame': {'w': W, 'h': H, 'anchor': [24, 46]},
        'greys': ['#%02x%02x%02x' % c for c in P.RAMPS['grey4']],
        'tintRule': 'Tinted layers are grey ramps; the game multiplies them by `tint`. `base` is the color a player '
                    'sees on most of the layer (skin: the whole skin; cloth, hair, beard: the middle shade, with '
                    'edges 23% darker and the tint itself as the highlight).',
        'layerOrder': ['back accessory', 'skin_<race> (skin tint)', 'outfitA_<outfit> (colorA)',
                       'outfitB_<outfit> (colorB)', 'fixed_<race>_<outfit>', 'face_<face>', '<outfit>_trim a (class)',
                       '<outfit>_trim b (class)', 'beard_<style> (hair color)', 'hair_<style>[_hat] (hair color)',
                       'headwear_<outfit> (plate: untinted, robe: colorB)', 'extra accessory', 'head accessory'],
        'atlasPrefix': 'player_',
        'trimAtlas': 'player_<outfit>_trim (frames a/<frame>, b/<frame>)',
        'races': RACES, 'outfits': OUTFITS, 'outfitOfClassArt': LEGACY, 'hair': HAIRS, 'beards': BEARDS, 'faces': FACES,
        'hairHatRule': 'Use hair_<style>_hat when the outfit is plate, robe or ranger (its hood counts as headwear) '
                       'or a head accessory is worn; there is no atlas for bald or beard none.',
        'colors': {
            'skin': colors([f'skin{i}' for i in range(6)], cc['skin'], 'skin'),
            'skinOrc': colors([f'orc{i}' for i in range(4)], cc['skin_orc'], 'skin'),
            'hair': colors(P.HAIR_NAMES, cc['hair']),
            'dye': colors(P.DYE_NAMES, cc['dye']),
            'dyeShop': colors(list(cc['dye_shop']), list(cc['dye_shop'].values())),
            'hairShop': colors(list(cc['hair_shop']), list(cc['hair_shop'].values())),
        },
        'atlases': sorted(atl),
        'cosmetics': _cos_manifest(),
    }


def build(assets, preview):
    import json
    import os
    from . import atlas as A
    atl, _pts = layers()
    out = os.path.join(assets, 'atlases')
    for name, frames in atl.items():
        ramps = ['grey4', 'ink'] if name.split('_')[1] in GREY_ATLASES else \
            (['trim', 'ink'] if name.endswith('_trim') else
             ['ink', 'p_cloth', 'p_leather', 'p_steel', 'white', 'fx_heal', 'grey4', 'skin'])
        ok = P.allowed(ramps)
        for fname, img in frames.items():
            P.check_palette_lock(img, ok, name, fname)
        A.pack_atlas(name, frames, out)
    with open(os.path.join(assets, 'look.json'), 'w', newline='\n') as f:
        json.dump(_layer_manifest(), f, indent=1)
        f.write('\n')


def annotate(anims):
    """Give every player body anim its outfit id and the attachment points of each frame (09 §7, ART10 Task 2)."""
    _atl, pts = layers()
    back = {f'player_{v}': k for k, v in LEGACY.items()}
    for a in anims:
        outfit = back.get(a['atlas'])
        if outfit is None:
            continue
        a['outfit'] = outfit
        a['points'] = [pts[outfit][fr] for fr in a['frames']]
    return anims
