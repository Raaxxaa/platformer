"""Stage 1 enemies (08 §7.1–7.3): wolf, bandit, bandit_archer, wild_boar, bandit_brute."""
import math

from .. import atlas as A
from .. import palette as P
from .. import raster as R
from ..rig import humanoid_fk, rnd

ATLAS = 'enemies_plains'
ENEMIES = ['wolf', 'bandit', 'bandit_archer', 'wild_boar', 'bandit_brute']


# ---------------------------------------------------------------- helpers

class Fig:
    def __init__(self, w, h):
        self.L = R.PartLayer(w, h)

    def part(self, name, ramp, shift=0):
        if name not in self.L.index:
            self.L.add_part(name, P.ramp_ids(ramp), shift)
        return name


def finish(f):
    c = R.auto_shade(f.L)
    R.outline(c, P.INK)
    return c.to_image()


def seg(p, deg, length):
    r = math.radians(deg)
    return (p[0] + length * math.sin(r), p[1] + length * math.cos(r))


def ip(p):
    return (rnd(p[0]), rnd(p[1]))


def rot(p, c, deg):
    """Rotate p about c; + = counter-clockwise on screen (nose up when facing right)."""
    r = math.radians(-deg)
    x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * math.cos(r) - y * math.sin(r), c[1] + x * math.sin(r) + y * math.cos(r))


def box(f, x0, y0, x1, y1, part):
    R.fill_rect(f.L, int(x0), int(y0), int(x1 - x0 + 1), int(y1 - y0 + 1), part)


# ---------------------------------------------------------------- frame sizes (08 §4.1)

def frame_size(enemy, anim):
    if enemy == 'bandit_brute':
        return (128, 80), (64, 78)
    if anim.startswith('atk_'):
        return (96, 48), (48, 46)
    return (48, 48), (24, 46)


# ---------------------------------------------------------------- weapons

def sword(f, hand, ang, length=9, name='sword'):
    b = f.part(name, 'gray')
    h = f.part(name + '_hilt', 'en_bone')
    tip = seg(hand, ang, length)
    base = seg(hand, ang, 2)
    R.capsule(f.L, ip(base), ip(tip), 2.2, b)
    g0, g1 = seg(base, ang + 90, 2), seg(base, ang - 90, 2)
    R.line(f.L, ip(g0), ip(g1), h)


def club(f, hand, ang, length, name='club'):
    c = f.part(name, 'en_bone')
    s = f.part(name + '_spikes', 'gray')
    h0 = seg(hand, ang, -3)
    mid = seg(hand, ang, length * 0.45)
    tip = seg(hand, ang, length)
    R.capsule(f.L, ip(h0), ip(mid), 3.2, c)
    R.capsule(f.L, ip(mid), ip(tip), 6.2, c)
    for t in (0.6, 0.8, 0.97):
        p = seg(hand, ang, length * t)
        for side in (90, -90):
            q = seg(p, ang + side, 4)
            R.line(f.L, ip(q), ip(q), s)
    R.line(f.L, ip(seg(tip, ang, 1.5)), ip(seg(tip, ang, 1.5)), s)


def bow(f, hand, ang, draw=0.0, arrow=False):
    """Bow held in `hand`, facing `ang` (90 = forward). draw 0..1 pulls the string."""
    b = f.part('bow', 'en_bone')
    st = f.part('string', 'gray', -2)
    top = seg(seg(hand, ang + 90, 7), ang, -1)
    bot = seg(seg(hand, ang - 90, 7), ang, -1)
    mid = seg(hand, ang, 2.5)
    R.line(f.L, ip(top), ip(mid), b)
    R.line(f.L, ip(mid), ip(bot), b)
    R.line(f.L, ip(seg(top, ang, 1)), ip(seg(top, ang + 90, -0.1)), b)
    nock = seg(hand, ang, -1 - 6 * draw)
    R.line(f.L, ip(top), ip(nock), st)
    R.line(f.L, ip(nock), ip(bot), st)
    if arrow:
        a = f.part('arrow', 'en_bone', 1)
        hd = f.part('arrowhead', 'gray')
        tip = seg(hand, ang, 5)
        R.line(f.L, ip(nock), ip(tip), a)
        R.line(f.L, ip(tip), ip(seg(tip, ang, 1)), hd)


# ---------------------------------------------------------------- humanoids

BANDIT_LEN = {'hip': 11, 'torso': 7, 'head': 5, 'upper': 5, 'fore': 5, 'thigh': 5, 'shin': 6}
BRUTE_LEN = {'hip': 16, 'torso': 13, 'head': 5, 'upper': 8, 'fore': 8, 'thigh': 8, 'shin': 8}

HUMANS = {
    'bandit': dict(L=BANDIT_LEN, torso=9, limb=3, thigh=4, head=(3.7, 4.1), hood='en_red', tunic='en_red',
                   pants='en_slate', boots='en_slate', sleeve='en_red', fore='skin', weapon='sword'),
    'bandit_archer': dict(L=BANDIT_LEN, torso=8, limb=3, thigh=4, head=(3.7, 4.1), hood='en_slate',
                          tunic='en_slate', pants='en_red', boots='en_slate', sleeve='en_slate', fore='skin',
                          scarf='en_red', weapon='bow'),
    'bandit_brute': dict(L=BRUTE_LEN, torso=17, limb=6.2, thigh=7.4, head=(4.6, 5.0), hood=None, tunic='en_red',
                         pants='en_slate', boots='en_slate', sleeve='skin', fore='skin', weapon='club'),
}


def draw_human(enemy, pose, size, feet):
    s = HUMANS[enemy]
    f = Fig(*size)
    j = humanoid_fk(pose, s['L'], feet)
    big = enemy == 'bandit_brute'
    hx, hy = j['head']
    cx, cy = j['chest']
    hpx, hpy = j['hip']
    lw, tw = s['limb'], s['thigh']
    wp = pose.get('weapon')

    def arm(side, shift):
        u = f.part('upper' + side, s['sleeve'], shift)
        fo = f.part('fore' + side, s['fore'], shift)
        R.capsule(f.L, j['shoulder' + side], j['elbow' + side], lw, u)
        R.capsule(f.L, j['elbow' + side], j['hand' + side], lw, fo)
        hd = f.part('hand' + side, 'skin', shift)
        R.ellipse(f.L, j['hand' + side][0], j['hand' + side][1], lw / 2.2, lw / 2.2, hd)
        if big:
            cuff = f.part('cuff' + side, 'en_slate', shift)
            R.capsule(f.L, ip(seg(j['elbow' + side], pose['arm' + side][0] + pose['arm' + side][1]
                                  + pose.get('tilt', 0), 3)),
                      ip(seg(j['elbow' + side], pose['arm' + side][0] + pose['arm' + side][1]
                             + pose.get('tilt', 0), 5)), lw + 0.6, cuff)

    def leg(side, shift):
        t = f.part('thigh' + side, s['pants'], shift)
        sh = f.part('shin' + side, s['pants'], shift)
        b = f.part('boot' + side, s['boots'], shift + 1)
        kn, ft = j['knee' + side], j['foot' + side]
        R.capsule(f.L, (hpx, hpy + 1), kn, tw, t)
        R.capsule(f.L, kn, (ft[0], ft[1] - int(tw - 1) // 2), tw - 1, sh)
        bw = 3 if big else 2
        box(f, ft[0] - bw + 1, ft[1] - (2 if big else 1), ft[0] + bw, ft[1], b)

    def weapon(layer_back):
        if not wp or wp.get('back', False) != layer_back:
            return
        hand = j['hand' + wp.get('hand', 'F')]
        if s['weapon'] == 'sword':
            sword(f, hand, wp['ang'], wp.get('len', 9))
        elif s['weapon'] == 'club':
            club(f, hand, wp['ang'], wp.get('len', 22))
        elif s['weapon'] == 'bow':
            bow(f, hand, wp['ang'], wp.get('draw', 0), wp.get('arrow', False))

    weapon(True)
    arm('B', 1)
    leg('B', 1)
    # torso
    t = f.part('torso', s['tunic'])
    tw2 = s['torso'] / 2
    up = seg((0, 0), 180 - pose.get('tilt', 0), 1)
    side_v = (-up[1], up[0])
    pts = [(cx + 0.5 - side_v[0] * tw2 - up[0], cy + 0.5 - side_v[1] * tw2 - up[1]),
           (cx + 0.5 + side_v[0] * tw2 - up[0], cy + 0.5 + side_v[1] * tw2 - up[1]),
           (hpx + 0.5 + side_v[0] * (tw2 - 0.5), hpy + 2 + side_v[1] * (tw2 - 0.5)),
           (hpx + 0.5 - side_v[0] * (tw2 - 0.5), hpy + 2 - side_v[1] * (tw2 - 0.5))]
    if big:
        mx, my = (cx + hpx) / 2, (cy + hpy) / 2
        R.ellipse(f.L, mx, my - 1, 10.5, 10, t)                     # barrel chest
        R.ellipse(f.L, cx - 1, cy + 1, 9, 5, t)                      # hunched shoulders
        belly = f.part('belly', 'skin')
        R.ellipse(f.L, mx + 4, my + 1, 5, 6.5, belly)
        strap = f.part('strap', 'en_slate')
        R.capsule(f.L, ip((cx - 6, cy)), ip((hpx + 7, hpy - 1)), 2.4, strap)
    else:
        R.fill_polygon(f.L, pts, t)
    belt = f.part('belt', 'en_bone' if not big else 'en_slate', 1)
    box(f, hpx - tw2 + 1, hpy + 1, hpx + tw2 - 1, hpy + 1 + (1 if big else 0), belt)
    if s.get('scarf'):
        sc = f.part('scarf', s['scarf'])
        R.fill_polygon(f.L, [(cx - 3, cy - 1), (cx + 4, cy - 1), (cx + 3, cy + 2), (cx - 2, cy + 2),
                             (cx - 6, cy + 4), (cx - 5, cy + 1)], sc)
    leg('F', 0)
    # head
    rx, ry = s['head']
    head = f.part('head', 'skin')
    if s['hood']:
        hood = f.part('hood', s['hood'])
        R.ellipse(f.L, hx - 1, hy - 0.5, rx + 0.8, ry + 0.6, hood)
        R.fill_polygon(f.L, [(hx - 3, hy + 2), (hx - 7, hy + 7), (hx - 1, hy + 5)], hood)
        R.ellipse(f.L, hx + 2.4, hy + 0.8, 2.1, 2.8, head)
        mask = f.part('mask', 'en_slate' if s['hood'] == 'en_red' else 'en_red')
        box(f, hx + 1, hy + 2, hx + 4, hy + 3, mask)
    else:
        R.ellipse(f.L, hx, hy, rx, ry, head)
        hair = f.part('hair', 'hair')
        R.fill_polygon(f.L, [(hx - rx, hy + 2), (hx - rx - 0.5, hy - 2), (hx - 1, hy - ry - 0.5),
                             (hx + rx, hy - ry + 1.5), (hx + rx, hy - 2), (hx, hy - 2), (hx - 2, hy + 3)], hair)
        beard = f.part('beard', 'hair')
        R.fill_polygon(f.L, [(hx + 1, hy + 2), (hx + rx + 0.5, hy + 1), (hx + rx, hy + ry + 1), (hx + 1, hy + ry + 1.5)],
                       beard)
    eye = f.part('eye', 'ink')
    ex = hx + (3 if s['hood'] else 2)
    box(f, ex, hy - (0 if s['hood'] else 1), ex, hy + (1 if s['hood'] else 0), eye)
    if pose.get('dead'):
        x = f.part('xeye', 'ink')
        box(f, ex - 1, hy, ex + 1, hy, x)
    weapon(False)
    arm('F', 0)
    if wp and wp.get('front'):
        weapon(False)
    return finish(f)


def human_pose(**kw):
    p = {'tilt': 0, 'hipOffset': (0, 0), 'head': (0, 0), 'chest': (0, 0),
         'armF': (10, 20), 'armB': (-8, 15), 'legF': (8, 4), 'legB': (-7, 2)}
    p.update(kw)
    return p


def human_walk(n=6, weapon=None, tilt=0):
    thigh = [20, 9, -5, -18, -6, 10]
    knee = [6, 4, 8, 18, 45, 30]
    arm = [-18, -8, 6, 18, 8, -6]
    bob = [0, 1, 0, 0, 1, 0]
    out = []
    for i in range(n):
        k = (i + 3) % 6
        out.append(human_pose(tilt=tilt, hipOffset=(0, bob[i]), legF=(thigh[i], knee[i]), legB=(thigh[k], knee[k]),
                              armF=(arm[i] + 10, 30), armB=(arm[k], 25), weapon=weapon))
    return out


def downed(i, weapon=None):
    """Knockdown/death frames: 0 = thrown back, 1 = sitting, 2+ = lying."""
    if i == 0:
        return human_pose(tilt=-28, hipOffset=(-1, 1), armF=(-50, 30), armB=(-80, 20), legF=(30, 20), legB=(15, 10),
                          weapon=weapon)
    if i == 1:
        return human_pose(tilt=-55, hipOffset=(-2, 5), armF=(-70, 20), armB=(-100, 10), legF=(70, 40),
                          legB=(60, 30), weapon=weapon)
    return human_pose(tilt=-84, hipOffset=(-3, 10 if i == 2 else 11), armF=(-10, 0), armB=(-24, 0),
                      legF=(88, 4), legB=(84, 2), dead=True)


def humanoid_anims(enemy):
    """Returns {anim: [poses]} for bandit, bandit_archer, bandit_brute."""
    big = enemy == 'bandit_brute'
    A_ = {}
    if enemy == 'bandit':
        rest = {'ang': 165, 'len': 8}
        A_['idle'] = [human_pose(chest=(0, b), armF=(12 + s, 22), weapon=rest)
                      for b, s in zip([0, 0, 1, 1], [0, 2, 3, 1])]
        A_['walk'] = [dict(p, armF=(p['armF'][0] + 4, 22), weapon=rest) for p in human_walk()]
        A_['atk_slash'] = [
            human_pose(tilt=-6, armF=(-40, 30), armB=(-20, 30), weapon={'ang': -150, 'len': 9}),    # tele: draw back
            human_pose(tilt=-10, hipOffset=(-1, 0), armF=(-150, 20), armB=(-40, 30), legF=(14, 6),
                       weapon={'ang': -170, 'len': 9}),                                            # tele: high
            human_pose(tilt=16, hipOffset=(5, 1), armF=(95, 0), armB=(-30, 40), legF=(36, 30), legB=(-26, 4),
                       weapon={'ang': 100, 'len': 14}, lean=1),                                    # act: swing
            human_pose(tilt=12, hipOffset=(2, 1), armF=(60, 20), armB=(-30, 40), legF=(28, 22), legB=(-20, 4),
                       weapon={'ang': 120, 'len': 9}),                                             # rec
            human_pose(tilt=4, armF=(30, 40), weapon={'ang': 128, 'len': 8}),                      # rec
        ]
        A_['atk_lunge_stab'] = [
            human_pose(tilt=-6, hipOffset=(-1, 1), armF=(-30, 110), legF=(16, 20), legB=(-12, 12),
                       weapon={'ang': 90, 'len': 9}),
            human_pose(tilt=-10, hipOffset=(-2, 2), armF=(-50, 130), legF=(22, 36), legB=(-16, 24),
                       weapon={'ang': 90, 'len': 9}),
            human_pose(tilt=22, hipOffset=(6, 2), armF=(92, 0), armB=(-40, 20), legF=(40, 30), legB=(-35, 0),
                       weapon={'ang': 90, 'len': 14}),
            human_pose(tilt=24, hipOffset=(6, 3), armF=(90, 0), armB=(-50, 20), legF=(46, 40), legB=(-40, 6),
                       weapon={'ang': 90, 'len': 14}),
            human_pose(tilt=12, hipOffset=(2, 1), armF=(60, 20), legF=(28, 20), legB=(-20, 4),
                       weapon={'ang': 110, 'len': 9}),
            human_pose(tilt=4, armF=(30, 40), weapon={'ang': 128, 'len': 8}),
        ]
        w = rest
    elif enemy == 'bandit_archer':
        held = {'ang': 90, 'hand': 'F', 'draw': 0}
        A_['idle'] = [human_pose(chest=(0, b), armF=(12 + s, 10), weapon=dict(held, ang=90))
                      for b, s in zip([0, 0, 1, 1], [0, 2, 3, 1])]
        A_['walk'] = [dict(p, armF=(16, 10), weapon=dict(held, ang=90)) for p in human_walk()]
        aim = dict(held, front=True)
        A_['atk_arrow'] = [
            human_pose(armF=(70, 20), armB=(40, 60), weapon=dict(aim, ang=90, draw=0.2, arrow=True)),
            human_pose(tilt=-4, armF=(88, 4), armB=(70, 100), legF=(16, 4), legB=(-12, 2),
                       weapon=dict(aim, ang=90, draw=1, arrow=True)),
            human_pose(tilt=-4, armF=(88, 4), armB=(30, 120), legF=(16, 4), legB=(-12, 2),
                       weapon=dict(aim, ang=90, draw=0)),
            human_pose(tilt=-2, armF=(80, 10), armB=(10, 60), legF=(12, 4), legB=(-10, 2),
                       weapon=dict(aim, ang=90, draw=0)),
            human_pose(armF=(40, 30), weapon=dict(held, ang=70)),
        ]
        A_['atk_kick'] = [
            human_pose(tilt=-8, armF=(-20, 40), armB=(-40, 30), legF=(40, 80), weapon=dict(held, ang=40)),
            human_pose(tilt=-14, hipOffset=(-1, 0), armF=(-30, 40), armB=(-50, 30), legF=(70, 110), legB=(-5, 0),
                       weapon=dict(held, ang=30)),
            human_pose(tilt=-18, hipOffset=(3, 0), armF=(-40, 30), armB=(-60, 30), legF=(84, 0), legB=(-8, 0),
                       weapon=dict(held, ang=30)),
            human_pose(tilt=-10, armF=(-20, 40), armB=(-40, 30), legF=(50, 70), weapon=dict(held, ang=40)),
            human_pose(armF=(30, 30), weapon=dict(held, ang=70)),
        ]
        w = dict(held, ang=70)
    else:   # brute: club on the shoulder
        shoulder = {'ang': -108, 'hand': 'F', 'len': 20, 'back': True}
        base = dict(tilt=8, armF=(6, 122), armB=(-6, 20), legF=(12, 6), legB=(-10, 2))
        A_['idle'] = [human_pose(**dict(base, chest=(0, b)), weapon=shoulder) for b in [0, 0, 1, 1]]
        A_['walk'] = [dict(p, armF=(6, 122), weapon=shoulder) for p in human_walk(tilt=8)]
        A_['atk_club_swing'] = [
            human_pose(tilt=0, armF=(-60, 70), armB=(-30, 30), legF=(14, 6), weapon={'ang': -120, 'len': 22}),
            human_pose(tilt=-8, hipOffset=(-2, 0), armF=(-110, 40), armB=(-50, 30), legF=(20, 10),
                       weapon={'ang': -100, 'len': 22}),
            human_pose(tilt=16, hipOffset=(3, 1), armF=(80, 0), armB=(-20, 30), legF=(30, 20), legB=(-20, 4),
                       weapon={'ang': 88, 'len': 26}),
            human_pose(tilt=14, hipOffset=(3, 1), armF=(50, 20), armB=(-20, 30), legF=(30, 20), legB=(-20, 4),
                       weapon={'ang': 50, 'len': 22}),
            human_pose(tilt=8, armF=(20, 40), weapon={'ang': 30, 'len': 22}),
        ]
        A_['atk_overhead_smash'] = [
            human_pose(tilt=-6, armF=(-150, 20), armB=(-140, 20), legF=(14, 6), weapon={'ang': -170, 'len': 22}),
            human_pose(tilt=-14, hipOffset=(-2, 0), armF=(-175, 10), armB=(-170, 10), legF=(18, 8),
                       weapon={'ang': -150, 'len': 22}),
            human_pose(tilt=34, hipOffset=(6, 4), armF=(64, 0), armB=(56, 0), legF=(50, 50), legB=(-30, 10),
                       weapon={'ang': 62, 'len': 28}),
            human_pose(tilt=32, hipOffset=(6, 4), armF=(58, 0), armB=(50, 0), legF=(50, 50), legB=(-30, 10),
                       weapon={'ang': 58, 'len': 28}),
            human_pose(tilt=12, armF=(20, 40), weapon={'ang': 40, 'len': 22}),
        ]
        w = shoulder
    i0 = A_['idle'][0]
    A_['hurt'] = [human_pose(tilt=-14, hipOffset=(-1, 0), head=(-1, 0), armF=(-40, 40), armB=(-70, 30),
                             legF=(14, 8), legB=(-10, 4), weapon=w)]
    A_['stagger'] = [human_pose(tilt=-8, hipOffset=(-1, 1), armF=(-20, 50), armB=(-50, 20), legF=(18, 20),
                                legB=(-6, 10), weapon=w),
                     human_pose(tilt=6, hipOffset=(1, 1), armF=(20, 30), armB=(-10, 20), legF=(10, 18),
                                legB=(-14, 10), weapon=w)]
    A_['knockdown'] = [downed(0), downed(2)]
    A_['death'] = [downed(0), downed(1), downed(2), downed(3)]
    del i0
    return A_


# ---------------------------------------------------------------- quadrupeds

def draw_wolf(pose, size, feet):
    f = Fig(*size)
    fx, fy = feet
    bdx, bdy = pose.get('body', (0, 0))
    c = (fx + bdx, fy - 9 + bdy)
    tilt = pose.get('tilt', 0)
    P_ = lambda dx, dy: rot((c[0] + dx, c[1] + dy), c, tilt)   # noqa: E731
    legs = pose['legs']

    def leg(key, shift, hind):
        root = P_(-6, 1) if hind else P_(6, 1)
        root = (root[0] + (1 if key[1] == 'F' else -1), root[1])
        hd, kd = legs[key]
        up = f.part('up' + key, 'en_slate', shift)
        lo = f.part('lo' + key, 'en_slate', shift)
        kn = seg(root, hd, 5.5 if hind else 4)
        ft = seg(kn, hd + (kd if hind else -kd), 4)
        R.capsule(f.L, ip(root), ip(kn), 4 if hind else 3, up)
        R.capsule(f.L, ip(kn), ip((ft[0], ft[1] - 1)), 2, lo)
        paw = f.part('paw' + key, 'en_slate', shift + 1)
        box(f, rnd(ft[0]), rnd(ft[1]), rnd(ft[0]) + 1, rnd(ft[1]), paw)

    # tail, far legs, body, near legs, head
    tl = f.part('tail', 'en_slate', 1)
    tr = P_(-8, -1)
    ta = pose.get('tail', -125)
    tm = seg(tr, ta, 4)
    tt = seg(tm, ta + pose.get('curl', -15), 4)
    R.capsule(f.L, ip(tr), ip(tm), 3.4, tl)
    R.capsule(f.L, ip(tm), ip(tt), 2.4, tl)
    leg('FB', 1, False)
    leg('BB', 1, True)
    body = f.part('body', 'en_slate')
    R.capsule(f.L, ip(P_(-7, 0)), ip(P_(5, -1)), 7.2, body)
    R.capsule(f.L, ip(P_(-2, 2)), ip(P_(4, 2)), 4, body)
    ruff = f.part('ruff', 'en_slate')
    R.ellipse(f.L, *P_(7, -1), 3.4, 4, ruff)
    leg('FF', 0, False)
    leg('BF', 0, True)
    hdx, hdy = pose.get('head', (0, 0))
    hc = P_(9 + hdx, -3 + hdy)
    ha = pose.get('headTilt', 0) + tilt
    H = lambda dx, dy: rot((hc[0] + dx, hc[1] + dy), hc, ha)  # noqa: E731
    head = f.part('head', 'en_slate')
    R.ellipse(f.L, hc[0], hc[1], 3.3, 2.8, head)
    snout = f.part('snout', 'en_slate')
    jaw = f.part('jaw', 'en_slate', 1)
    op = pose.get('mouth', 0)
    R.capsule(f.L, ip(H(1, -0.5)), ip(H(5, -0.5 - op * 0.5)), 2.6, snout)
    R.capsule(f.L, ip(H(1, 1.5)), ip(H(4, 1.5 + op)), 1.6, jaw)
    if op:
        fang = f.part('fang', 'white')
        R.line(f.L, ip(H(4, 0.5 - op * 0.5)), ip(H(4, 0.5 - op * 0.5)), fang)
    ear = f.part('ear', 'en_slate')
    ep = pose.get('ears', 0)
    R.fill_polygon(f.L, [H(-2.5, -1.5), H(-0.5, -1.5), H(-2.5 - ep, -4.5 + ep)], ear)
    nose = f.part('nose', 'ink')
    q = ip(H(5.5, -1 - op * 0.5))
    box(f, q[0], q[1], q[0], q[1], nose)
    eye = f.part('eye', 'ink')
    e = ip(H(0.5, -1))
    if pose.get('dead'):
        box(f, e[0] - 1, e[1], e[0], e[1], eye)
    else:
        box(f, e[0], e[1], e[0], e[1], eye)
    return finish(f)


def wolf_anims():
    stand = {'FF': (4, 4), 'FB': (-2, 2), 'BF': (18, 40), 'BB': (8, 36)}

    def p(**kw):
        d = {'legs': dict(stand), 'tail': -110}
        d.update(kw)
        return d
    A_ = {}
    A_['idle'] = [p(body=(0, b), tail=t, head=(0, b)) for b, t in zip([0, 0, 1, 1], [-110, -104, -98, -104])]
    walk = []
    sw = [24, 10, -8, -22, -6, 12]
    for i in range(6):
        k = (i + 3) % 6
        walk.append(p(body=(0, [0, 1, 0, 0, 1, 0][i]), tail=[-120, -105, -95, -105, -120, -130][i],
                      curl=[-20, 0, 15, 20, 0, -20][i],
                      legs={'FF': (sw[i], 10 if sw[i] < 0 else 2), 'FB': (sw[k], 10 if sw[k] < 0 else 2),
                            'BF': (sw[k] + 14, 40), 'BB': (sw[i] + 14, 40)}))
    A_['walk'] = walk
    crouch = {'FF': (30, 50), 'FB': (24, 44), 'BF': (-20, 50), 'BB': (-26, 54)}
    A_['atk_lunge_bite'] = [
        p(body=(-1, 2), tilt=-4, legs=crouch, head=(0, 1), ears=1, tail=-100),
        p(body=(-2, 3), tilt=-6, legs={'FF': (40, 70), 'FB': (34, 64), 'BF': (-30, 70), 'BB': (-36, 72)},
          head=(0, 1), ears=2, mouth=1, tail=-95),
        p(body=(9, -3), tilt=14, legs={'FF': (120, 20), 'FB': (110, 30), 'BF': (-60, 10), 'BB': (-70, 0)},
          head=(2, 0), mouth=2, ears=2, tail=-80),
        p(body=(9, -1), tilt=-8, head=(2, 0), legs={'FF': (50, 10), 'FB': (40, 10), 'BF': (-40, 40), 'BB': (-50, 30)},
          mouth=2, ears=2, headTilt=-6, tail=-90),
        p(body=(1, 1), legs={'FF': (20, 20), 'FB': (10, 16), 'BF': (-10, 40), 'BB': (-14, 40)}, mouth=1),
        p(),
    ]
    A_['atk_snap'] = [
        p(body=(-1, 1), legs=crouch, ears=1, tail=-110),
        p(body=(-2, 2), legs=crouch, ears=2, mouth=1, tail=-100),
        p(body=(7, 0), tilt=4, legs={'FF': (44, 8), 'FB': (30, 8), 'BF': (-30, 30), 'BB': (-40, 26)},
          head=(4, 1), mouth=2, ears=2, tail=-95),
        p(body=(1, 0), mouth=1, head=(1, 0)),
        p(),
    ]
    A_['hurt'] = [p(body=(-1, 0), tilt=8, legs={'FF': (30, 20), 'FB': (24, 16), 'BF': (-10, 40), 'BB': (-16, 40)},
                    head=(-1, -1), headTilt=20, mouth=1, ears=3, tail=-150)]
    A_['stagger'] = [p(body=(-1, 1), tilt=4, headTilt=14, ears=3, tail=-150),
                     p(body=(1, 1), tilt=-3, headTilt=-10, ears=3, tail=-140)]
    lying = {'FF': (80, 30), 'FB': (70, 40), 'BF': (-80, 10), 'BB': (-90, 20)}
    A_['knockdown'] = [p(body=(-1, 1), tilt=14, legs={'FF': (60, 30), 'FB': (50, 30), 'BF': (-30, 30),
                                                        'BB': (-40, 30)}, headTilt=20, ears=3, tail=-160),
                       p(body=(0, 5), legs=lying, head=(1, 2), ears=3, tail=-95)]
    A_['death'] = [A_['knockdown'][0], p(body=(0, 3), tilt=6, legs=lying, head=(0, 1), ears=3, tail=-120),
                   p(body=(0, 5), legs=lying, head=(1, 3), headTilt=-10, ears=3, tail=-95, dead=True),
                   p(body=(0, 6), legs=lying, head=(1, 4), headTilt=-15, ears=3, tail=-92, dead=True)]
    return A_


def draw_boar(pose, size, feet):
    f = Fig(*size)
    fx, fy = feet
    bdx, bdy = pose.get('body', (0, 0))
    c = (fx - 1 + bdx, fy - 10 + bdy)
    tilt = pose.get('tilt', 0)
    P_ = lambda dx, dy: rot((c[0] + dx, c[1] + dy), c, tilt)   # noqa: E731
    legs = pose['legs']

    def leg(key, shift, hind):
        root = P_(-7, 4) if hind else P_(7, 4)
        root = (root[0] + (1 if key[1] == 'F' else -1), root[1])
        hd, kd = legs[key]
        up = f.part('up' + key, 'en_slate', shift)
        hoof = f.part('hoof' + key, 'en_slate', shift + 2)
        kn = seg(root, hd, 3)
        ft = seg(kn, hd + (kd if hind else -kd), 3)
        R.capsule(f.L, ip(root), ip(kn), 4, up)
        R.capsule(f.L, ip(kn), ip((ft[0], ft[1] - 1)), 3, up)
        box(f, rnd(ft[0]) - 1, rnd(ft[1]), rnd(ft[0]) + 1, rnd(ft[1]), hoof)

    tl = f.part('tail', 'en_slate', 1)
    R.line(f.L, ip(P_(-11, -3)), ip(P_(-13, -1 + pose.get('tailUp', 0))), tl)
    leg('FB', 1, False)
    leg('BB', 1, True)
    body = f.part('body', 'en_slate')
    R.ellipse(f.L, *P_(0, 0), 11.5, 7, body)
    mane = f.part('mane', 'en_red')
    bristle = pose.get('bristle', 0)
    pts = [P_(-9, -3), P_(-7, -7.5 - bristle * 0.5), P_(-5, -6.5), P_(-3, -9 - bristle), P_(-1, -7),
           P_(1, -9.5 - bristle), P_(3, -7.2), P_(5, -9 - bristle), P_(7, -6.6), P_(9, -7.6 - bristle * 0.5),
           P_(10, -3), P_(4, -5), P_(-4, -5)]
    R.fill_polygon(f.L, pts, mane)
    leg('FF', 0, False)
    leg('BF', 0, True)
    hdx, hdy = pose.get('head', (0, 0))
    hc = P_(10 + hdx, 1 + hdy)
    ha = pose.get('headTilt', 0) + tilt
    H = lambda dx, dy: rot((hc[0] + dx, hc[1] + dy), hc, ha)  # noqa: E731
    head = f.part('head', 'en_slate')
    R.ellipse(f.L, hc[0], hc[1], 4.6, 4.4, head)
    R.fill_polygon(f.L, [H(0, -3.5), H(5.5, -1), H(5.5, 3), H(0, 3.8)], head)
    snout = f.part('snout', 'en_red', 0)
    R.fill_rect(f.L, rnd(H(5, 0)[0]), rnd(H(5, 0)[1]) - 1, 2, 3, snout)
    ear = f.part('ear', 'en_slate', 1)
    R.fill_polygon(f.L, [H(-3, -3), H(0, -4), H(-3, -7 + pose.get('earDown', 0))], ear)
    tusk = f.part('tusk', 'en_bone')
    t0 = H(3.5, 2.5)
    R.line(f.L, ip(t0), ip(H(5.5, 0.5)), tusk)
    R.line(f.L, ip(H(5.5, 0.5)), ip(H(5.5, -0.5)), tusk)
    eye = f.part('eye', 'ink')
    e = ip(H(1, -1))
    box(f, e[0], e[1], e[0], e[1], eye)
    if pose.get('dead'):
        box(f, e[0] - 1, e[1], e[0] + 1, e[1], eye)
    if pose.get('stars') is not None:
        st = f.part('stars', 'white')
        ph = pose['stars']
        for k in range(3):
            a = math.radians(ph * 60 + k * 120)
            sx, sy = hc[0] + 6 * math.cos(a), hc[1] - 8 + 2 * math.sin(a)
            box(f, rnd(sx), rnd(sy), rnd(sx), rnd(sy), st)
    return finish(f)


def boar_anims():
    stand = {'FF': (4, 4), 'FB': (-2, 2), 'BF': (4, 6), 'BB': (-4, 6)}

    def p(**kw):
        d = {'legs': dict(stand)}
        d.update(kw)
        return d
    A_ = {}
    A_['idle'] = [p(body=(0, b), head=(0, h), tailUp=t)
                  for b, h, t in zip([0, 0, 1, 1], [0, 1, 1, 0], [0, -1, 0, 1])]
    sw = [22, 10, -6, -20, -6, 10]
    A_['walk'] = [p(body=(0, [0, 1, 0, 0, 1, 0][i]),
                    legs={'FF': (sw[i], 8), 'FB': (sw[(i + 3) % 6], 8), 'BF': (sw[(i + 3) % 6], 10),
                          'BB': (sw[i], 10)}) for i in range(6)]
    run = [(40, 20, -40, 30), (-30, 40, 50, 10)]
    A_['atk_charge'] = [
        p(body=(-1, 1), tilt=-4, head=(0, 2), headTilt=-14, bristle=1,
          legs={'FF': (10, 4), 'FB': (-30, 40), 'BF': (-10, 20), 'BB': (-20, 26)}),
        p(body=(-2, 1), tilt=-6, head=(0, 3), headTilt=-20, bristle=2,
          legs={'FF': (-30, 50), 'FB': (14, 4), 'BF': (-14, 24), 'BB': (-24, 30)}),
        p(body=(7, -1), tilt=-6, head=(2, 3), headTilt=-18, bristle=2,
          legs={'FF': (run[0][0], run[0][1]), 'FB': (run[0][0] - 12, run[0][1]),
                'BF': (run[0][2], run[0][3]), 'BB': (run[0][2] - 12, run[0][3])}),
        p(body=(7, 0), tilt=-4, head=(2, 3), headTilt=-18, bristle=2,
          legs={'FF': (run[1][0], run[1][1]), 'FB': (run[1][0] + 12, run[1][1]),
                'BF': (run[1][2], run[1][3]), 'BB': (run[1][2] + 12, run[1][3])}),
        p(body=(0, 1), tilt=-2, head=(0, 2), headTilt=-8, bristle=1),
        p(),
    ]
    A_['atk_tusk_jab'] = [
        p(body=(-1, 1), head=(-1, 2), headTilt=-16, bristle=1),
        p(body=(-2, 1), head=(-2, 3), headTilt=-24, bristle=2, legs={'FF': (14, 6), 'FB': (6, 4), 'BF': (-6, 12),
                                                                       'BB': (-12, 12)}),
        p(body=(6, 0), head=(4, 0), headTilt=18, bristle=2, legs={'FF': (24, 4), 'FB': (14, 4), 'BF': (-18, 10),
                                                                    'BB': (-24, 10)}),
        p(body=(1, 0), head=(1, 1), headTilt=6, bristle=1),
        p(),
    ]
    A_['skid'] = [p(body=(-1, 1), tilt=8, head=(0, 0), headTilt=10, bristle=2,
                    legs={'FF': (40, 0), 'FB': (34, 0), 'BF': (20, 10), 'BB': (14, 10)})]
    A_['dazed'] = [p(body=(0, 1), head=(0, 2), headTilt=-12, earDown=3, stars=0),
                   p(body=(0, 1), head=(0, 2), headTilt=-6, earDown=3, stars=1)]
    A_['hurt'] = [p(body=(-1, 0), tilt=8, head=(-1, -1), headTilt=20, earDown=2,
                    legs={'FF': (20, 10), 'FB': (14, 10), 'BF': (-6, 10), 'BB': (-10, 10)})]
    A_['stagger'] = [p(body=(-1, 1), tilt=4, headTilt=12, earDown=2), p(body=(1, 1), tilt=-3, headTilt=-10, earDown=2)]
    fold = {'FF': (90, 150), 'FB': (80, 150), 'BF': (-90, 140), 'BB': (-80, 140)}
    A_['knockdown'] = [p(body=(-1, 1), tilt=10, headTilt=16, earDown=3,
                         legs={'FF': (50, 30), 'FB': (40, 30), 'BF': (-30, 30), 'BB': (-40, 30)}),
                       p(body=(0, 4), legs=fold, head=(0, 1), earDown=3)]
    A_['death'] = [A_['knockdown'][0], p(body=(0, 2), tilt=4, legs=fold, earDown=3),
                   p(body=(0, 4), legs=fold, head=(0, 2), headTilt=-10, earDown=3, dead=True),
                   p(body=(0, 5), legs=fold, head=(0, 3), headTilt=-14, earDown=3, dead=True)]
    return A_


# ---------------------------------------------------------------- anim table

def segments(enemy, anim, n):
    """08 §7.2 phase segments for attack anims."""
    last = n - 1
    rec = {'phase': 'rec', 'frames': [last - 1, last]}
    tele = {'phase': 'tele', 'frames': [0, 1]}
    if anim in ('atk_lunge_stab', 'atk_charge'):
        return [tele, {'phase': 'act', 'frames': [2, 3], 'loopFps': 12}, rec]
    if anim == 'atk_lunge_bite':
        return [tele, {'phase': 'act', 'frames': [2, 3], 'byVy': True}, rec]
    return [tele, {'phase': 'act', 'frames': [2]}, rec]


def anim_def(enemy, anim, n):
    key = f'{enemy}_{anim}'
    if anim.startswith('atk_'):
        return A.anim(key, ATLAS, n, 'phase', segments=segments(enemy, anim, n))
    mode, fps = {'idle': ('loop', 6), 'walk': ('speed', None), 'hurt': ('once', None), 'stagger': ('loop', 8),
                 'knockdown': ('once', 10), 'death': ('once', 10), 'skid': ('once', None),
                 'dazed': ('loop', 6)}[anim]
    return A.anim(key, ATLAS, n, mode, fps)


def enemy_anims(enemy):
    if enemy == 'wolf':
        return wolf_anims(), draw_wolf
    if enemy == 'wild_boar':
        return boar_anims(), draw_boar
    return humanoid_anims(enemy), lambda pose, size, feet: draw_human(enemy, pose, size, feet)


def build_frames():
    frames, anims = {}, []
    for enemy in ENEMIES:
        table, drawer = enemy_anims(enemy)
        for anim, poses in table.items():
            size, (ax, ay) = frame_size(enemy, anim)
            for i, pose in enumerate(poses):
                frames[f'{enemy}_{anim}_{i:02d}'] = drawer(pose, size, (ax, ay - 2))
            anims.append(anim_def(enemy, anim, len(poses)))
    return frames, anims


def build(assets, preview):
    import os
    from .. import preview as V
    from ..boxes import HURTBOX, ATTACK_BOX
    frames, anims = build_frames()
    allowed = P.allowed(P.PLAINS_ENEMY_RAMPS)
    for n, img in frames.items():
        P.check_palette_lock(img, allowed, ATLAS, n)
    A.pack_atlas(ATLAS, frames, os.path.join(assets, 'atlases'))
    bg = tuple(P.RAMPS['pl_bg1'][1])
    rows = []
    for ad in anims:
        enemy = next(e for e in ENEMIES if ad['key'].startswith(e + '_') and
                     not (e == 'bandit' and ad['key'].startswith('bandit_archer')) and
                     not (e == 'bandit' and ad['key'].startswith('bandit_brute')))
        anim = ad['key'][len(enemy) + 1:]
        _size, anchor = frame_size(enemy, anim)
        w, h = HURTBOX[enemy]
        hurt = (0, -h / 2, w, h)
        atk = ATTACK_BOX[enemy].get(anim[4:]) if anim.startswith('atk_') else None
        imgs = []
        for i, fn in enumerate(ad['frames']):
            is_a = atk is not None and i in ad['segments'][1]['frames']
            imgs.append(V.overlay(frames[fn], anchor, hurt, atk if is_a else None))
        fps = ad.get('fps') or 8
        rows.append((f"{ad['key']} ({len(imgs)}, {ad['mode']})", imgs))
        V.preview_gif(os.path.join(preview, f"{ATLAS}__{ad['key']}.gif"),
                      [V.overlay(frames[fn], anchor) for fn in ad['frames']], fps, bg)
    V.preview_sheet(os.path.join(preview, f'{ATLAS}_sheet.png'), rows, bg, label_w=330)
    return anims
