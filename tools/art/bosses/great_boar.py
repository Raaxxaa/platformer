"""Great Boar (08 §7.4): a giant, scarred Wild Boar. Atlas `boss_great_boar`, 160 × 112, anchor (80, 110)."""
import math

from .. import atlas as A
from .. import palette as P
from .. import raster as R
from ..enemies.plains import Fig, finish, on_ground, seg, ip, rot, box
from ..rig import rnd

ATLAS = 'boss_great_boar'
SIZE, ANCHOR = (160, 112), (80, 110)
RAMPS = ['ink', 'white', 'en_slate', 'en_red', 'en_bone']
K = 2.2                     # scale against the Wild Boar's proportions


def draw(pose):
    f = Fig(*SIZE)
    fx, fy = ANCHOR[0], ANCHOR[1] - 2
    bdx, bdy = pose.get('body', (0, 0))
    c = (fx - 5 + bdx, fy - 10 * K + bdy)
    tilt = pose.get('tilt', 0)
    P_ = lambda dx, dy: rot((c[0] + dx * K, c[1] + dy * K), c, tilt)   # noqa: E731
    legs = pose['legs']

    def leg(key, shift, hind):
        root = P_(-7, 4) if hind else P_(7, 4)
        root = (root[0] + (2 if key[1] == 'F' else -2), root[1])
        hd, kd = legs[key]
        up = f.part('up' + key, 'en_slate', shift)
        hoof = f.part('hoof' + key, 'en_slate', shift + 2)
        kn = seg(root, hd, 3 * K)
        ft = seg(kn, hd + (kd if hind else -kd), 3 * K)
        ft = (ft[0], min(ft[1], fy))                      # feet never sink into the ground
        R.capsule(f.L, ip(root), ip(kn), 9, up)
        R.capsule(f.L, ip(kn), ip((ft[0], ft[1] - 3)), 7, up)
        box(f, rnd(ft[0]) - 3, rnd(ft[1]) - 2, rnd(ft[0]) + 3, rnd(ft[1]), hoof)

    tl = f.part('tail', 'en_slate', 1)
    R.capsule(f.L, ip(P_(-10, -3)), ip(P_(-12, -1 + pose.get('tailUp', 0))), 2, tl)
    tuft = f.part('tuft', 'en_red', 1)
    R.ellipse(f.L, *P_(-12.3, -0.5 + pose.get('tailUp', 0)), 1.6, 1.6, tuft)
    leg('FB', 1, False)
    leg('BB', 1, True)
    body = f.part('body', 'en_slate')
    R.ellipse(f.L, *P_(0, 0), 10.6 * K, 7 * K, body)
    R.ellipse(f.L, *P_(4, -3), 7 * K, 4.5 * K, body)            # shoulder hump, same part: no seam
    # scars: pale slashes across the flank
    scar = f.part('scar', 'en_bone', 1)
    for (x0, y0, x1, y1) in ((-6, -2.5, -4, 0.5), (-4.5, -3, -2.5, 0), (3, 1.5, 4.6, 3.4)):
        R.line(f.L, ip(P_(x0, y0)), ip(P_(x1, y1)), scar)
    # mane: tall en_red spikes along the back
    mane = f.part('mane', 'en_red')
    br = pose.get('bristle', 0)
    pts = [P_(-9, -3), P_(-8, -6.2 - br * 0.4), P_(-6.5, -5.6), P_(-5, -7.2 - br * 0.6), P_(-3, -6.2),
           P_(-1, -7.8 - br), P_(1, -6.6), P_(3, -8.2 - br), P_(5, -6.8), P_(7, -8 - br), P_(8.6, -6.4),
           P_(10, -7 - br * 0.6), P_(11, -4), P_(5, -5.5), P_(-4, -4.6)]
    R.fill_polygon(f.L, pts, mane)
    leg('FF', 0, False)
    leg('BF', 0, True)
    hdx, hdy = pose.get('head', (0, 0))
    hc = P_(10 + hdx, 1.5 + hdy)
    ha = pose.get('headTilt', 0) + tilt
    H = lambda dx, dy: rot((hc[0] + dx * K, hc[1] + dy * K), hc, ha)  # noqa: E731
    head = f.part('head', 'en_slate')
    R.ellipse(f.L, hc[0], hc[1], 4.8 * K, 4.6 * K, head)
    R.fill_polygon(f.L, [H(0, -3.8), H(5.6, -1.2), H(5.6, 3.2), H(0, 4.1)], head)
    snout = f.part('snout', 'en_red')
    s0 = H(5.2, -1)
    R.ellipse(f.L, s0[0] + 1, s0[1] + 2, 2.2, 3.4, snout)
    nost = f.part('nostril', 'ink')
    q = ip(H(5.9, 0.2))
    box(f, q[0], q[1], q[0], q[1] + 1, nost)
    ear = f.part('ear', 'en_slate', 1)
    ed = pose.get('earDown', 0)
    R.fill_polygon(f.L, [H(-3, -3), H(0, -4.2), H(-3.6, -7.4 + ed)], ear)
    nick = f.part('earnick', 'en_slate', 3)                    # torn ear
    R.line(f.L, ip(H(-2.2, -5.6 + ed * 0.7)), ip(H(-2.8, -5.6 + ed * 0.7)), nick)
    # big curved tusks
    tusk = f.part('tusk', 'en_bone')
    tk = pose.get('tusk', 0)
    # quadratic curve from the mouth corner, forward and up; thick at the root
    p0, p1, p2 = H(3.0, 2.8), H(7.4 + tk * 0.05, 3.4), H(7.0 + tk * 0.08, -1.2)
    n = 14
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        R.capsule(f.L, ip((x, y)), ip((x, y)), 4.2 - 2.6 * t, tusk)
    jaw = f.part('jaw', 'en_slate', 1)
    R.capsule(f.L, ip(H(1, 3.6)), ip(H(4.4, 3.6)), 3, jaw)
    scar2 = f.part('scar_face', 'en_bone', 1)
    R.line(f.L, ip(H(-1, -3)), ip(H(2.2, 1)), scar2)
    # small glowing eye
    e = ip(H(1.4, -1.2))
    eye = f.part('eye', 'ink')
    glow = f.part('glow', 'en_red', 3)
    if pose.get('dead'):
        box(f, e[0] - 1, e[1], e[0] + 1, e[1], eye)
    else:
        box(f, e[0] - 1, e[1] - 1, e[0] + 1, e[1], eye)
        box(f, e[0], e[1] - 1, e[0], e[1] - 1, glow)
    img = finish(f)
    return img


def _poses():
    stand = {'FF': (4, 4), 'FB': (-2, 2), 'BF': (4, 6), 'BB': (-4, 6)}

    def p(**kw):
        d = {'legs': dict(stand)}
        d.update(kw)
        return d

    def run(i):
        r = [(40, 20, -40, 30), (10, 50, -10, 40), (-30, 40, 50, 10), (-6, 30, 20, 40)][i]
        return {'FF': (r[0], r[1]), 'FB': (r[0] - 14, r[1]), 'BF': (r[2], r[3]), 'BB': (r[2] - 14, r[3])}

    A_ = {}
    A_['idle'] = [p(body=(0, b), head=(0, h), tailUp=t, tusk=0)
                  for b, h, t in zip([0, 0, 2, 2], [0, 1, 2, 1], [0, -1, 0, 1])]
    sw = [22, 10, -6, -20, -6, 10]
    A_['walk'] = [p(body=(0, [0, 2, 0, 0, 2, 0][i]),
                    legs={'FF': (sw[i], 8), 'FB': (sw[(i + 3) % 6], 8), 'BF': (sw[(i + 3) % 6], 10),
                          'BB': (sw[i], 10)}) for i in range(6)]
    paw_a = {'FF': (-34, 60), 'FB': (10, 4), 'BF': (-12, 22), 'BB': (-20, 28)}
    paw_b = {'FF': (12, 6), 'FB': (6, 4), 'BF': (-12, 22), 'BB': (-20, 28)}
    A_['atk_charge'] = (
        [p(body=(-3, 3), tilt=-6, head=(0, 2.5), headTilt=-22, bristle=2, legs=paw_a),     # tele: head down, paw back
         p(body=(-5, 4), tilt=-8, head=(0, 3), headTilt=-26, bristle=3, legs=paw_b)] +     # tele: paw strikes
        [p(body=(20, [0, -2, 0, -1][i]), tilt=-6, head=(1.5, 2.5), headTilt=-18, bristle=3, legs=run(i))
         for i in range(4)] +                                                             # act: run loop
        [p(body=(4, 2), tilt=6, head=(0, 1), headTilt=6, bristle=1,
           legs={'FF': (40, 0), 'FB': (34, 0), 'BF': (16, 10), 'BB': (10, 10)}),          # rec: brake
         p(body=(0, 1), bristle=1)])
    A_['atk_tusk_toss'] = [
        p(body=(-2, 3), head=(-1, 3), headTilt=-24, bristle=2, legs={'FF': (16, 10), 'FB': (8, 6), 'BF': (-8, 16),
                                                                      'BB': (-14, 16)}),
        p(body=(-4, 4), head=(-1, 4), headTilt=-30, bristle=3, legs={'FF': (20, 16), 'FB': (12, 10), 'BF': (-10, 20),
                                                                       'BB': (-16, 20)}),
        p(body=(20, -3), tilt=12, head=(3, -1), headTilt=34, bristle=3, tusk=-10,
          legs={'FF': (30, 10), 'FB': (20, 10), 'BF': (-24, 4), 'BB': (-30, 4)}),
        p(body=(12, -1), tilt=6, head=(2, -1), headTilt=20, bristle=2,
          legs={'FF': (20, 8), 'FB': (12, 8), 'BF': (-16, 8), 'BB': (-22, 8)}),
        p(body=(1, 1), headTilt=4, bristle=1),
    ]
    rear = {'FF': (70, 70), 'FB': (60, 80), 'BF': (-14, 16), 'BB': (-20, 18)}
    A_['atk_stomp_quake'] = [
        p(body=(-4, -6), tilt=18, head=(0, -1), headTilt=10, bristle=2, legs=rear),            # tele: rearing
        p(body=(-6, -10), tilt=28, head=(0, -2), headTilt=16, bristle=3,
          legs={'FF': (90, 80), 'FB': (80, 90), 'BF': (-20, 24), 'BB': (-26, 26)}),           # tele: peak
        p(body=(6, 4), tilt=-6, head=(1, 2), headTilt=-10, bristle=3,
          legs={'FF': (30, 2), 'FB': (24, 2), 'BF': (-20, 24), 'BB': (-24, 26)}),             # act: slam
        p(body=(2, 3), tilt=-3, head=(1, 2), headTilt=-6, bristle=2),
        p(body=(0, 1), bristle=1),
    ]
    A_['hurt'] = [p(body=(-3, 0), tilt=8, head=(-1, -1), headTilt=20, earDown=3,
                    legs={'FF': (20, 10), 'FB': (14, 10), 'BF': (-6, 10), 'BB': (-10, 10)})]
    A_['stagger'] = [p(body=(-2, 2), tilt=4, headTilt=12, earDown=3), p(body=(2, 2), tilt=-3, headTilt=-10, earDown=3)]
    A_['dazed'] = [p(body=(0, 2), head=(0, 2), headTilt=-14, earDown=4), p(body=(0, 2), head=(0, 2), headTilt=-6,
                                                                            earDown=4)]
    A_['intro'] = [
        p(body=(0, 0), head=(0, 0)),
        p(body=(-2, -4), tilt=12, head=(0, -1), headTilt=10, bristle=1, legs=rear),
        p(body=(-4, -10), tilt=26, head=(0, -2), headTilt=24, bristle=3,
          legs={'FF': (90, 80), 'FB': (80, 90), 'BF': (-20, 24), 'BB': (-26, 26)}),
        p(body=(-4, -10), tilt=26, head=(0, -2), headTilt=32, bristle=3, tusk=-8,
          legs={'FF': (100, 60), 'FB': (90, 70), 'BF': (-20, 24), 'BB': (-26, 26)}),
        p(body=(2, 3), tilt=-4, head=(1, 3), headTilt=-14, bristle=3,
          legs={'FF': (24, 2), 'FB': (16, 2), 'BF': (-14, 16), 'BB': (-20, 18)}),         # lands, snorts
        p(body=(0, 1), head=(0, 1), headTilt=-6, bristle=2),
    ]
    kneel = {'FF': (80, 150), 'FB': (70, 150), 'BF': (-10, 30), 'BB': (-16, 30)}
    A_['break'] = [
        p(body=(0, 4), tilt=-8, head=(0, 3), headTilt=-14, earDown=4,
          legs={'FF': (40, 90), 'FB': (34, 90), 'BF': (-6, 20), 'BB': (-12, 20)}),
        p(body=(0, 8), tilt=-10, head=(0, 2), headTilt=-18, earDown=5, legs=kneel),
        p(body=(0, 9), tilt=-10, head=(0, 2), headTilt=-22, earDown=5, legs=kneel),
    ]
    A_['transition'] = [
        p(body=(0, 1), bristle=b, headTilt=t, head=(0, h))
        for b, t, h in ((1, -4, 1), (2, -10, 2), (3, -16, 3), (3, 6, 0), (3, 14, -1), (2, 0, 0))]
    fold = {'FF': (90, 150), 'FB': (80, 150), 'BF': (-90, 140), 'BB': (-80, 140)}
    A_['death'] = [
        A_['hurt'][0],
        p(body=(-2, 2), tilt=10, headTilt=24, earDown=4, legs={'FF': (40, 30), 'FB': (34, 30), 'BF': (-20, 30),
                                                                 'BB': (-26, 30)}),
        p(body=(0, 4), tilt=-6, head=(0, 3), headTilt=-12, earDown=5, legs=kneel),
        p(body=(0, 7), tilt=-10, head=(0, 2), headTilt=-20, earDown=5, legs=kneel),
        p(body=(0, 9), tilt=-6, head=(0, 2), headTilt=-22, earDown=5, legs=fold),
        p(body=(0, 10), tilt=-3, head=(0, 2), headTilt=-22, earDown=5, legs=fold),
        p(body=(0, 11), head=(0, 2), headTilt=-22, earDown=5, legs=fold, dead=True),
        p(body=(0, 11), head=(0, 2), headTilt=-22, earDown=5, legs=fold, dead=True, bristle=-1),
        p(body=(0, 11), head=(0, 2), headTilt=-22, earDown=5, legs=fold, dead=True, bristle=-1),
    ]
    return A_


def _anim(key, n):
    if key.startswith('atk_'):
        last = n - 1
        act = ({'phase': 'act', 'frames': [2, 3, 4, 5], 'loopFps': 16} if key == 'atk_charge'
               else {'phase': 'act', 'frames': [2]})
        return A.anim(key, ATLAS, n, 'phase', segments=[{'phase': 'tele', 'frames': [0, 1]}, act,
                                                      {'phase': 'rec', 'frames': [last - 1, last]}])
    if key == 'intro':
        return A.anim(key, ATLAS, n, 'phase', segments=[{'phase': 'all', 'frames': list(range(n))}])
    if key == 'transition':
        return A.anim(key, ATLAS, n, 'phase', segments=[{'phase': 'all', 'frames': list(range(n))}])
    if key == 'break':
        return A.anim(key, ATLAS, n, 'phase', segments=[{'phase': 'all', 'frames': [0]},
                                                      {'phase': 'all', 'frames': [1, 2], 'loopFps': 4}])
    mode, fps = {'idle': ('loop', 6), 'walk': ('speed', None), 'hurt': ('once', None), 'stagger': ('loop', 8),
                 'death': ('once', 6), 'dazed': ('loop', 6)}[key]
    return A.anim(key, ATLAS, n, mode, fps)


def build_frames():
    frames, anims = {}, []
    for key, poses in _poses().items():
        for i, pose in enumerate(poses):
            frames[f'{key}_{i:02d}'] = on_ground(draw(pose), ANCHOR[1])
        anims.append(_anim(key, len(poses)))
    return frames, anims


def build(assets, preview):
    import os
    from .. import preview as V
    from ..boxes import HURTBOX, ATTACK_BOX
    frames, anims = build_frames()
    allowed = P.allowed(RAMPS)
    for n, img in frames.items():
        P.check_palette_lock(img, allowed, ATLAS, n)
    A.pack_atlas(ATLAS, frames, os.path.join(assets, 'atlases'))
    bg = tuple(P.RAMPS['pl_bg1'][1])
    w, h = HURTBOX['great_boar']
    hurt = (0, -h / 2, w, h)
    rows = []
    for ad in anims:
        atk = ATTACK_BOX['great_boar'].get(ad['key'][4:]) if ad['key'].startswith('atk_') else None
        act = ad['segments'][1]['frames'] if atk else []
        imgs = [V.overlay(frames[fn], ANCHOR, hurt, atk if i in act else None, scale=2)
                for i, fn in enumerate(ad['frames'])]
        rows.append((f"{ad['key']} ({len(imgs)}, {ad['mode']})", imgs))
        fps = 16 if ad['key'] == 'atk_charge' else (ad.get('fps') or 6)
        V.preview_gif(os.path.join(preview, f"{ATLAS}__{ad['key']}.gif"),
                      [V.overlay(frames[fn], ANCHOR) for fn in ad['frames']], fps, bg)
    V.preview_sheet(os.path.join(preview, f'{ATLAS}_sheet.png'), rows, bg, label_w=200)
    return anims
