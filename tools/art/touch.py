"""ART10 Part A: phone touch-control art (07 §3.4 "Touch" row, §8.6) and the app icons.

Every touch frame is pure #ffffff (the game tints it and sets the Touch opacity). Edges are hard (alpha 0 or 255)."""
import math
import os

import numpy as np
from PIL import Image

from . import palette as P

WHITE = (255, 255, 255, 255)


def _grid(w, h):
    ys, xs = np.mgrid[0:h, 0:w]
    return xs + 0.5, ys + 0.5


def _img(mask):
    a = np.zeros(mask.shape + (4,), np.uint8)
    a[mask] = WHITE
    return Image.fromarray(a, 'RGBA')


def _seg(xs, ys, p0, p1, half):
    """Pixels within `half` of the segment p0-p1."""
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    t = np.clip(((xs - x0) * dx + (ys - y0) * dy) / (dx * dx + dy * dy), 0, 1)
    return np.hypot(xs - (x0 + t * dx), ys - (y0 + t * dy)) <= half


def _poly(xs, ys, pts):
    inside = np.zeros(xs.shape, bool)
    for i, (x0, y0) in enumerate(pts):
        x1, y1 = pts[(i + 1) % len(pts)]
        inside ^= ((y0 > ys) != (y1 > ys)) & (xs < (x1 - x0) * (ys - y0) / (y1 - y0 + 1e-9) + x0)
    return inside


def ring():
    xs, ys = _grid(64, 64)
    d = np.hypot(xs - 32, ys - 32)
    return _img((d <= 31.5) & (d >= 28.5))


def fill():
    xs, ys = _grid(64, 64)
    return _img(np.hypot(xs - 32, ys - 32) <= 31.5)


def icon_jump():
    xs, ys = _grid(24, 24)
    head = _poly(xs, ys, [(12, 3), (21, 13), (15.5, 13), (15.5, 21), (8.5, 21), (8.5, 13), (3, 13)])
    return _img(head)


def icon_dash():
    """A forward streak: a chevron with three speed lines behind it."""
    xs, ys = _grid(24, 24)
    m = _seg(xs, ys, (13, 4), (21, 12), 1.9) | _seg(xs, ys, (21, 12), (13, 20), 1.9)
    for y, x0 in ((7, 2), (12, 1), (17, 2)):
        m |= (np.abs(ys - y) <= 1.0) & (xs >= x0) & (xs <= x0 + 9)
    return _img(m)


def icon_heal():
    """A flask: round belly, neck and a stopper."""
    xs, ys = _grid(24, 24)
    belly = np.hypot((xs - 12) / 8.0, (ys - 15) / 7.5) <= 1
    neck = (np.abs(xs - 12) <= 3) & (ys >= 5) & (ys <= 11)
    lip = (np.abs(xs - 12) <= 4.5) & (ys >= 3) & (ys <= 5)
    m = belly | neck | lip
    m &= ~(np.hypot((xs - 12) / 5.2, (ys - 15.5) / 4.6) <= 1) | (ys < 14.5)      # liquid line cut-out reads as a flask
    return _img(m)


def icon_interact():
    """A hand: palm and four fingers."""
    xs, ys = _grid(24, 24)
    m = (xs >= 6.5) & (xs <= 17.5) & (ys >= 12) & (ys <= 21)
    for x, top in ((7.8, 6), (10.6, 3.5), (13.4, 3.5), (16.2, 6)):
        m |= (np.abs(xs - x) <= 1.4) & (ys >= top) & (ys <= 13)
    m |= _seg(xs, ys, (7, 15), (3.5, 11.5), 1.6)          # thumb
    return _img(m)


def icon_pause():
    xs, ys = _grid(24, 24)
    m = ((xs >= 6) & (xs <= 10) | (xs >= 14) & (xs <= 18)) & (ys >= 5) & (ys <= 19)
    return _img(m)


def stick_base():
    """96 × 96: a ring with 8 direction ticks, so the stick reads as 8-way."""
    xs, ys = _grid(96, 96)
    d = np.hypot(xs - 48, ys - 48)
    m = (d <= 47.5) & (d >= 44)
    ang = np.arctan2(ys - 48, xs - 48)
    for k in range(8):
        th = k * math.pi / 4
        diff = np.abs((ang - th + math.pi) % (2 * math.pi) - math.pi)
        m |= (diff * d <= 1.8) & (d >= 33) & (d <= 41)
    return _img(m)


def knob():
    """40 × 40: a disc with a thin inner ring."""
    xs, ys = _grid(40, 40)
    d = np.hypot(xs - 20, ys - 20)
    return _img(((d <= 19.5) & (d >= 17)) | (d <= 12))


def rotate_phone():
    """64 × 48: a phone outline with a curved arrow, 'turn your phone sideways'."""
    xs, ys = _grid(64, 48)
    body = (np.abs(xs - 24) <= 8.5) & (np.abs(ys - 25) <= 15.5)
    hole = (np.abs(xs - 24) <= 6) & (np.abs(ys - 24) <= 12.5)
    m = body & ~hole
    m |= (np.abs(xs - 24) <= 2.2) & (np.abs(ys - 37) <= 1.0) & hole        # home dot
    d = np.hypot(xs - 24, ys - 25)
    ang = np.arctan2(ys - 25, xs - 24)
    arc = (np.abs(d - 27) <= 1.8) & (ang > -0.9) & (ang < 0.55)
    m |= arc
    m |= _poly(xs, ys, [(52.2, 33), (60, 29), (50, 25)])
    return _img(m)


def frames():
    return {'touch_ring': ring(), 'touch_fill': fill(), 'touch_jump': icon_jump(), 'touch_dash': icon_dash(),
            'touch_heal': icon_heal(), 'touch_interact': icon_interact(), 'touch_pause': icon_pause(),
            'touch_stick_base': stick_base(), 'touch_knob': knob(), 'rotate_phone': rotate_phone()}


# --- app icons -----------------------------------------------------------------------------------------------------

ICON_SIZES = {'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180, 'favicon.png': 32}


def logo():
    """A 64 × 64 pixel-art master: a slashing blade over a dash streak on ink. Everything stays inside the central
    80% circle so Android's round mask never cuts it."""
    W = 64
    xs, ys = _grid(W, W)
    U = P.UI_COLORS
    steel = P.RAMPS['w_steel']
    gold = P.RAMPS['w_gold']
    a = np.zeros((W, W, 4), np.uint8)
    a[:, :] = U['ink'] + (255,)

    def paint(mask, col):
        a[mask] = tuple(col) + (255,)
    # dash streak: three speed lines in the rush colors, rising to the right behind the blade
    for k, (y, x0, x1, col) in enumerate(((46, 13, 21, U['rush1']), (40, 10, 25, U['rush2']), (34, 12, 30, U['rush3']), (28, 17, 33, U['rush2']))):
        paint((np.abs(ys - y) <= 1.5) & (xs >= x0) & (xs <= x1) & (np.hypot(xs - 32, ys - 32) <= 26), col)
    # blade: a tapered diagonal from the lower left hilt to the upper right tip
    hx, hy, tx, ty = 20.0, 44.0, 49.0, 15.0
    dx, dy = tx - hx, ty - hy
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln
    s = (xs - hx) * ux + (ys - hy) * uy
    n = -(xs - hx) * uy + (ys - hy) * ux
    half = np.clip(4.2 * (1 - (s - 6) / (ln - 6)) + 0.6, 0.6, 4.2)
    blade = (s >= 6) & (s <= ln) & (np.abs(n) <= half)
    paint(blade, steel[1])
    paint(blade & (n > 0.6), steel[2])
    paint(blade & (n > 0.6) & (np.abs(n) < half * 0.45), steel[3])
    paint(blade & (n < -half * 0.55), steel[0])
    # crossguard and grip
    guard = (s >= 3) & (s <= 6) & (np.abs(n) <= 7)
    paint(guard, gold[2])
    paint(guard & (n < -4.2), gold[1])
    grip = (s >= -3) & (s < 3) & (np.abs(n) <= 1.9)
    paint(grip, P.RAMPS['w_wood'][1])
    pommel = np.hypot(xs - (hx - ux * 4), ys - (hy - uy * 4)) <= 2.4
    paint(pommel, gold[2])
    # a white slash spark on the tip
    paint(np.hypot(xs - 51.5, ys - 12.5) <= 1.7, U['text'])
    return Image.fromarray(a, 'RGBA')


def write_app_icons(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    master = logo()
    P.check_palette_lock(master, P.allowed_ui(), 'app', 'logo')
    for name, size in ICON_SIZES.items():
        master.convert('RGB').resize((size, size), Image.NEAREST).save(os.path.join(out_dir, name))
    return master


# --- mock ------------------------------------------------------------------------------------------------------------

def mock(path, bg_dir):
    """The 844 × 390 phone layout of 07 §8.6 over a Stage 1 scene, buttons at the default 55% opacity."""
    W, H = 844, 390
    stack = Image.new('RGBA', (640, 360))
    for i in range(3):
        stack.alpha_composite(Image.open(os.path.join(bg_dir, f'bg_plains_{i}.png')).convert('RGBA'))
    scene = stack.resize((W, int(360 * W / 640)), Image.NEAREST).crop((0, int(360 * W / 640) - H, W, int(360 * W / 640)))
    im = scene.copy()
    U = P.UI_COLORS
    fr = frames()
    u = max(40, min(72, min(W, H) / 7.5))
    from . import ui as UIM
    atlas = UIM.build_frames()
    op = 0.55

    def tinted(img, col, size, alpha=1.0):
        a = np.array(img.resize((size, size), Image.NEAREST)).astype(np.float32)
        a[:, :, :3] = np.array(col)
        a[:, :, 3] *= alpha
        return Image.fromarray(a.astype(np.uint8), 'RGBA')

    def button(cx, cy, d, icon=None, ring_col=None, icon_img=None, pressed=False):
        d = int(round(d * u))
        al = 1.0 if pressed else op
        im.alpha_composite(tinted(fr['touch_fill'], U['panel'], d, al), (int(cx - d / 2), int(cy - d / 2)))
        im.alpha_composite(tinted(fr['touch_ring'], ring_col or U['text'], d, al), (int(cx - d / 2), int(cy - d / 2)))
        if icon is not None:
            s = int(d * 0.5)
            im.alpha_composite(tinted(fr[icon], U['text'], s, al), (int(cx - s / 2), int(cy - s / 2)))
        if icon_img is not None:
            s = int(d * 0.62)
            big = icon_img.resize((s, s), Image.NEAREST)
            big = Image.fromarray((np.array(big) * np.array([1, 1, 1, al])).astype(np.uint8), 'RGBA')
            im.alpha_composite(big, (int(cx - s / 2), int(cy - s / 2)))
    r, b = W, H
    button(r - 1.0 * u, b - 1.0 * u, 1.45, 'touch_jump')
    button(r - 2.55 * u, b - 0.85 * u, 1.25, ring_col=U['grade_B'], icon_img=atlas['icon_weapon_greatsword'])
    button(r - 1.1 * u, b - 2.5 * u, 1.05, 'touch_dash')
    button(r - 2.6 * u, b - 2.3 * u, 1.05, ring_col=U['grade_C'], icon_img=atlas['icon_weapon_katana'])
    button(r - 3.95 * u, b - 1.25 * u, 0.95, ring_col=U['class_swordsman'], icon_img=atlas['icon_ability_blade_dash'])
    button(r - 3.85 * u, b - 2.6 * u, 0.95, ring_col=U['class_swordsman'], icon_img=atlas['icon_ability_whirlwind'])
    button(r - 2.35 * u, b - 3.6 * u, 0.85, 'touch_heal', pressed=True, ring_col=U['highlight'])
    button(r - 5.2 * u, b - 1.2 * u, 1.0, 'touch_interact')
    button(r - 0.7 * u, 0.7 * u, 0.75, 'touch_pause')
    # the stick, held at its hint position
    cx, cy = int(1.6 * u), int(H - 1.6 * u)
    im.alpha_composite(tinted(fr['touch_stick_base'], U['text'], int(2.2 * u), 0.3), (cx - int(1.1 * u), cy - int(1.1 * u)))
    kn = int(0.9 * u)
    im.alpha_composite(tinted(fr['touch_knob'], U['text'], kn, 0.6), (cx + int(0.5 * u) - kn // 2, cy - kn // 2))
    im.convert('RGB').save(path)
    return im
