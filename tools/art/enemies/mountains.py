"""Stage 2 (Caves & Mountains) enemies (08 §7.1-7.3): bat_swarm, goblin_miner, rock_golem, ram, goblin_shaman."""
import math

from .. import atlas as A
from .. import palette as P
from .. import raster as R
from ..rig import humanoid_fk, rnd
from .plains import Fig, finish, on_ground, seg, ip, rot, box, human_pose, human_walk, downed

ATLAS = 'enemies_mountains'
ENEMIES = ['bat_swarm', 'goblin_miner', 'rock_golem', 'ram', 'goblin_shaman']


def part1(f, name, color):
    """A one-color part (no auto edge shading)."""
    if name not in f.L.index:
        f.L.add_part(name, [P.sid(color)])
    return name


def frame_size(enemy, anim):
    if enemy == 'goblin_shaman':
        return (128, 80), (64, 78)
    if anim.startswith('atk_'):
        return (96, 48), (48, 46)
    return (48, 48), (24, 46)


# ---------------------------------------------------------------- weapons

def pickaxe(f, hand, ang, length=10):
    h = f.part('pick_handle', 'en_ochre', 1)
    hd = f.part('pick_head', 'gray')
    tip = seg(hand, ang, length)
    R.capsule(f.L, ip(seg(hand, ang, -2)), ip(tip), 1.8, h)
    a, b = seg(tip, ang + 90, 4), seg(tip, ang - 90, 3)
    R.capsule(f.L, ip(a), ip(b), 2.0, hd)
    R.line(f.L, ip(seg(a, ang + 30, 1)), ip(seg(a, ang + 30, 1)), hd)


def bomb(f, hand, big=1.0):
    b = f.part('bomb', 'gray', 1)
    sp = part1(f, 'bomb_spark', P.RAMPS['fx_fire'][3])
    fu = part1(f, 'bomb_fuse', P.RAMPS['en_ochre'][2])
    x, y = hand
    R.ellipse(f.L, x + 1, y - 3, 3.4 * big, 3.4 * big, b)
    R.line(f.L, (x + 1, y - 7), (x + 3, y - 9), fu)
    R.line(f.L, (x + 3, y - 10), (x + 3, y - 10), sp)


def staff(f, hand, ang, length=22, glow=0):
    s = f.part('staff', 'en_ochre', 1)
    sk = f.part('skull', 'en_bone')
    gem = f.part('gem', 'en_magenta')
    top = seg(hand, ang, length)
    R.capsule(f.L, ip(seg(hand, ang, -6)), ip(top), 1.8, s)
    R.ellipse(f.L, *ip(seg(top, ang, 1.5)), 2.8, 2.8, sk)
    c = ip(seg(top, ang, 5.5))
    R.ellipse(f.L, c[0], c[1], 1.5 + 0.6 * glow, 1.5 + 0.6 * glow, gem)
    if glow >= 2:
        g1 = part1(f, 'gemglow', P.RAMPS['white'][0])
        R.line(f.L, c, c, g1)
    return top


# ---------------------------------------------------------------- goblins

GOBLINS = {
    'goblin_miner': dict(L={'hip': 7, 'torso': 5, 'head': 4, 'upper': 4, 'fore': 4, 'thigh': 3.5, 'shin': 3.5},
                         torso=6, limb=2.6, thigh=3.2, head=(4.0, 3.6)),
    'goblin_shaman': dict(L={'hip': 9, 'torso': 7, 'head': 5, 'upper': 5, 'fore': 5, 'thigh': 4.5, 'shin': 4.5},
                          torso=9, limb=3.0, thigh=3.6, head=(4.6, 4.0)),
}


def draw_goblin(kind, pose, size, feet):
    s = GOBLINS[kind]
    shaman = kind == 'goblin_shaman'
    f = Fig(*size)
    j = humanoid_fk(pose, s['L'], feet)
    hx, hy = j['head']
    cx, cy = j['chest']
    hpx, hpy = j['hip']
    lw, tw = s['limb'], s['thigh']
    wp = pose.get('weapon')
    tilt = pose.get('tilt', 0)

    def arm(side, shift):
        u = f.part('upper' + side, 'en_ochre', shift)
        fo = f.part('fore' + side, 'en_olive', shift)
        R.capsule(f.L, j['shoulder' + side], j['elbow' + side], lw, u)
        R.capsule(f.L, j['elbow' + side], j['hand' + side], lw - 0.4, fo)
        hd = f.part('hand' + side, 'en_olive', shift)
        R.ellipse(f.L, j['hand' + side][0], j['hand' + side][1], lw / 2.0, lw / 2.0, hd)

    def leg(side, shift):
        t = f.part('thigh' + side, 'en_ochre', shift + 1)
        sh = f.part('shin' + side, 'en_olive', shift)
        b = f.part('boot' + side, 'en_ochre', shift + 2)
        kn, ft = j['knee' + side], j['foot' + side]
        ft = (ft[0], min(ft[1], feet[1]))
        R.capsule(f.L, (hpx, hpy + 1), kn, tw, t)
        R.capsule(f.L, kn, (ft[0], ft[1] - 1), tw - 0.8, sh)
        box(f, ft[0] - 1, ft[1] - 1, ft[0] + 2, ft[1], b)

    def weapon(back):
        if not wp or wp.get('back', False) != back:
            return
        hand = j['hand' + wp.get('hand', 'F')]
        k = wp.get('kind', 'staff' if shaman else 'pick')
        if k == 'pick':
            pickaxe(f, hand, wp['ang'], wp.get('len', 10))
        elif k == 'bomb':
            bomb(f, hand)
        else:
            staff(f, hand, wp['ang'], wp.get('len', 22), wp.get('glow', 0))

    weapon(True)
    arm('B', 1)
    leg('B', 1)
    mx, my = (cx + hpx) / 2, (cy + hpy) / 2
    t = f.part('torso', 'en_ochre', -2)
    if shaman:                                              # robe down to the shins
        hem = feet[1] - 3 - pose.get('hemLift', 0)
        sway = pose.get('sway', 0)
        R.fill_polygon(f.L, [(cx - 5, cy - 1), (cx + 5, cy - 1), (hpx + 7 + sway, hem), (hpx - 7 + sway, hem)], t)
        tr = f.part('trim', 'en_ochre', -3)
        R.fill_rect(f.L, int(hpx - 7 + sway), int(hem - 1), 14, 2, tr)
        belt = f.part('belt', 'en_olive', 1)
        R.fill_rect(f.L, int(hpx - 4), int(hpy + 1), 9, 1, belt)
    else:
        R.ellipse(f.L, mx, my, tw / 2 + 2.6, abs(cy - hpy) / 2 + 2.2, t)
        belt = f.part('belt', 'en_ochre', 2)
        R.fill_rect(f.L, int(hpx - 2), int(hpy + 1), 5, 1, belt)
    if not shaman:
        leg('F', 0)
    else:
        leg('F', 0)
        # the robe hides the legs above the hem
        R.fill_polygon(f.L, [(hpx - 6 + pose.get('sway', 0), hpy + 1), (hpx + 6 + pose.get('sway', 0), hpy + 1),
                             (hpx + 7 + pose.get('sway', 0), feet[1] - 3 - pose.get('hemLift', 0)),
                             (hpx - 7 + pose.get('sway', 0), feet[1] - 3 - pose.get('hemLift', 0))], t)
        tr = f.part('trim', 'en_ochre', -3)
        R.fill_rect(f.L, int(hpx - 7 + pose.get('sway', 0)), int(feet[1] - 4 - pose.get('hemLift', 0)), 14, 2, tr)
        sash = f.part('sash', 'en_magenta', -1)
        hem = feet[1] - 4 - pose.get('hemLift', 0)
        R.fill_polygon(f.L, [(cx + 1, cy), (cx + 3, cy), (hpx + 4, hem), (hpx + 2, hem)], sash)
    # head: big goblin head, pointed ear back, nose forward
    rx, ry = s['head']
    head = f.part('head', 'en_olive')
    R.ellipse(f.L, hx, hy, rx, ry, head)
    ear = f.part('ear', 'en_olive', 1)
    R.fill_polygon(f.L, [(hx - rx + 1, hy - 1), (hx - rx - 5, hy - 4 - (1 if shaman else 0)), (hx - rx + 1, hy + 2)], ear)
    nose = f.part('nose', 'en_olive', 0)
    R.fill_polygon(f.L, [(hx + rx - 1, hy - 1), (hx + rx + 2, hy + 1), (hx + rx - 1, hy + 2)], nose)
    eye = part1(f, 'eye', P.RAMPS['ink'][0])
    if shaman:
        mask = f.part('mask', 'en_bone', 1)
        R.ellipse(f.L, hx + 1, hy + 0.5, rx - 0.5, ry + 0.5, mask)
        R.fill_polygon(f.L, [(hx - 2, hy - ry), (hx - 1, hy - ry - 4), (hx + 1, hy - ry)], mask)
        R.fill_polygon(f.L, [(hx + 2, hy - ry), (hx + 4, hy - ry - 4), (hx + 5, hy - ry + 1)], mask)
        box(f, hx, hy - 1, hx + 1, hy, eye)
        box(f, hx + 3, hy - 1, hx + 4, hy, eye)
        mg = f.part('maskmark', 'en_magenta', 1)
        box(f, hx + 1, hy + 2, hx + 3, hy + 2, mg)
    else:
        hel = f.part('helmet', 'en_ochre', -1)
        R.ellipse(f.L, hx, hy - 3, rx + 0.6, 2.2, hel)
        R.fill_rect(f.L, int(hx - rx), int(hy - 2), int(2 * rx + 1), 1, hel)
        lamp = part1(f, 'lamp', P.RAMPS['white'][0])
        box(f, hx + 3, hy - 4, hx + 4, hy - 3, lamp)
        lh = part1(f, 'lamphalo', P.RAMPS['en_bone'][3])
        box(f, hx + 5, hy - 4, hx + 5, hy - 3, lh)
        box(f, hx + 2, hy - 1, hx + 2, hy, eye)
    if pose.get('dead'):
        box(f, hx + 1, hy, hx + 3, hy, eye)
    weapon(False)
    arm('F', 0)
    del tilt, wp
    return finish(f)


# ---------------------------------------------------------------- golem

GOLEM_L = {'hip': 9, 'torso': 12, 'head': 6, 'upper': 8, 'fore': 8, 'thigh': 5, 'shin': 4}


def draw_golem(pose, size, feet):
    f = Fig(*size)
    j = humanoid_fk(pose, GOLEM_L, feet)
    hx, hy = j['head']
    cx, cy = j['chest']
    hpx, hpy = j['hip']
    sq = pose.get('squash', 0)

    def arm(side, shift):
        u = f.part('upper' + side, 'en_ochre', shift)
        R.ellipse(f.L, *j['shoulder' + side], 4.4, 4.4, u)
        R.capsule(f.L, j['shoulder' + side], j['elbow' + side], 5.4, u)
        R.capsule(f.L, j['elbow' + side], j['hand' + side], 5.0, u)
        fi = f.part('fist' + side, 'en_ochre', shift)
        R.ellipse(f.L, j['hand' + side][0], j['hand' + side][1], 4.2, 4.0, fi)

    def leg(side, shift):
        t = f.part('leg' + side, 'en_ochre', shift + 1)
        kn, ft = j['knee' + side], j['foot' + side]
        ft = (ft[0], min(ft[1], feet[1]))
        R.capsule(f.L, (hpx, hpy + 1), kn, 7.4, t)
        R.capsule(f.L, kn, (ft[0], ft[1] - 2), 6.4, t)
        box(f, ft[0] - 3, ft[1] - 1, ft[0] + 3, ft[1], t)

    arm('B', 1)
    leg('B', 1)
    mx, my = (cx + hpx) / 2, (cy + hpy) / 2
    body = f.part('body', 'en_ochre', 1)
    R.ellipse(f.L, mx, my - 1, 8.6 - sq * 2, 9, body)
    R.ellipse(f.L, cx, cy + 1, 8 - sq * 2, 4.6, body)
    leg('F', 0)
    # boulder chips + glowing cracks
    chip = f.part('chip', 'en_ochre', 2)
    R.ellipse(f.L, mx - 5 + sq, my + 3, 2.6, 2.2, chip)
    R.ellipse(f.L, mx + 4 - sq, my - 4, 2.2, 1.8, chip)
    crack = part1(f, 'crack', P.RAMPS['fx_fire'][2])
    cb = part1(f, 'crack_hot', P.RAMPS['fx_fire'][3])
    px0, py0 = int(mx - 2), int(my - 6)
    for dx, dy in ((0, 0), (1, 1), (1, 2), (0, 3), (-1, 4), (-1, 5), (0, 6), (1, 7)):
        box(f, px0 + dx, py0 + dy, px0 + dx, py0 + dy, crack)
    box(f, px0 + 1, py0 + 2, px0 + 1, py0 + 2, cb)
    for dx, dy in ((5, 3), (6, 3), (7, 4), (8, 4)):
        box(f, px0 + dx, py0 + dy + 2, px0 + dx, py0 + dy + 2, crack)
    head = f.part('head', 'en_ochre')
    R.ellipse(f.L, hx + 3 - sq * 3, hy + 1, 5.0 - sq, 4.2, head)
    brow = f.part('brow', 'en_ochre', 2)
    R.fill_rect(f.L, int(hx + 1 - sq * 3), int(hy - 1), 7, 1, brow)
    eye = part1(f, 'eye', P.RAMPS['ink'][0] if pose.get('dead') else P.RAMPS['fx_fire'][3])
    box(f, hx + 4 - sq * 3, hy, hx + 5 - sq * 3, hy, eye)
    if sq:
        box(f, hx - 1, hy, hx, hy, eye)
    arm('F', 0)
    return finish(f)


def gpose(**kw):
    p = human_pose(armF=(8, 8), armB=(-8, 8), legF=(6, 4), legB=(-6, 2))
    p.update(kw)
    return p


def golem_anims():
    A_ = {}
    A_['idle'] = [gpose(chest=(0, b), armF=(26 + s, 12), armB=(-16 - s, 12), tilt=2)
                  for b, s in zip([0, 0, 1, 1], [0, 2, 3, 1])]
    th = [14, 7, -4, -12, -5, 8]
    kn = [4, 3, 6, 12, 28, 18]
    A_['walk'] = [gpose(hipOffset=(0, [0, 1, 0, 0, 1, 0][i]), legF=(th[i], kn[i]),
                        legB=(th[(i + 3) % 6], kn[(i + 3) % 6]), armF=(-th[i] * 0.8 + 10, 14),
                        armB=(th[i] * 0.8 - 6, 12), tilt=3) for i in range(6)]
    A_['turn'] = [gpose(squash=1, tilt=0, armF=(4, 6), armB=(-4, 6)),
                  gpose(squash=1, tilt=-3, chest=(0, 1), armF=(0, 6), armB=(0, 6))]
    A_['atk_fist_slam'] = [
        gpose(tilt=-8, armF=(-140, 30), armB=(-150, 30)),
        gpose(tilt=-16, hipOffset=(-2, 0), armF=(-175, 10), armB=(-175, 10), legF=(10, 6)),
        gpose(tilt=34, hipOffset=(9, 3), armF=(78, 0), armB=(70, 0), legF=(40, 36), legB=(-24, 8), lean=2),
        gpose(tilt=30, hipOffset=(8, 3), armF=(72, 0), armB=(66, 0), legF=(38, 34), legB=(-24, 8)),
        gpose(tilt=10, hipOffset=(2, 1), armF=(30, 20), armB=(24, 20)),
    ]
    A_['atk_shoulder_ram'] = [
        gpose(tilt=-6, hipOffset=(-2, 1), armF=(-60, 50), armB=(-80, 40), legF=(20, 18), legB=(-12, 8)),
        gpose(tilt=-12, hipOffset=(-3, 2), armF=(-80, 60), armB=(-100, 50), legF=(24, 26), legB=(-16, 12)),
        gpose(tilt=42, hipOffset=(8, 2), armF=(-70, 60), armB=(-90, 60), legF=(44, 40), legB=(-34, 10)),
        gpose(tilt=44, hipOffset=(10, 2), armF=(-80, 60), armB=(-100, 60), legF=(-10, 6), legB=(36, 40)),
        gpose(tilt=34, hipOffset=(6, 2), armF=(-40, 50), armB=(-60, 50), legF=(26, 20), legB=(-20, 8)),
        gpose(tilt=8, hipOffset=(1, 1), armF=(20, 20), armB=(10, 20)),
    ]
    w = {}
    A_['hurt'] = [gpose(tilt=-12, hipOffset=(-1, 0), armF=(-30, 30), armB=(-50, 30))]
    A_['stagger'] = [gpose(tilt=-8, hipOffset=(-1, 1), armF=(-20, 40), armB=(-40, 30)),
                     gpose(tilt=6, hipOffset=(1, 1), armF=(20, 30), armB=(-10, 30))]
    A_['knockdown'] = [downed(0), downed(2)]
    A_['death'] = [downed(0), downed(1), downed(2), downed(3)]
    del w
    return A_


# ---------------------------------------------------------------- ram

def draw_ram(pose, size, feet):
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
        up = f.part('up' + key, 'en_ochre', shift + 1)
        hoof = f.part('hoof' + key, 'en_bone', shift)
        kn = seg(root, hd, 3.2)
        ft = seg(kn, hd + (kd if hind else -kd), 3.2)
        ft = (ft[0], min(ft[1], fy))
        R.capsule(f.L, ip(root), ip(kn), 3.4, up)
        R.capsule(f.L, ip(kn), ip((ft[0], ft[1] - 1)), 2.6, up)
        box(f, rnd(ft[0]) - 1, rnd(ft[1]), rnd(ft[0]) + 1, rnd(ft[1]), hoof)

    tl = f.part('tail', 'en_ochre', 0)
    R.ellipse(f.L, *P_(-11, -3), 2.2, 2.2, tl)
    leg('FB', 1, False)
    leg('BB', 1, True)
    wool = f.part('wool', 'en_ochre')
    R.ellipse(f.L, *P_(0, 0), 10.5, 7, wool)
    for dx, dy in ((-9, -2), (-6, -6), (-2, -7), (2, -7.5), (6, -6), (9, -3), (-8, 3), (-4, 6), (1, 6.5), (6, 5)):
        R.ellipse(f.L, *P_(dx, dy), 3.4, 3.0, wool)
    leg('FF', 0, False)
    leg('BF', 0, True)
    hdx, hdy = pose.get('head', (0, 0))
    hc = P_(11 + hdx, 0 + hdy)
    ha = pose.get('headTilt', 0) + tilt
    H = lambda dx, dy: rot((hc[0] + dx, hc[1] + dy), hc, ha)  # noqa: E731
    face = f.part('face', 'en_ochre', 1)
    R.ellipse(f.L, hc[0], hc[1], 4.2, 3.8, face)
    R.fill_polygon(f.L, [H(0, -2.6), H(5.5, -0.5), H(5.5, 3), H(0, 3.6)], face)
    horn = f.part('horn', 'en_bone')
    # curled horn: spiral from the temple back, down, forward
    pts = [H(0.5, -2.5), H(-2.5, -4), H(-5, -2.5), H(-5.5, 0.5), H(-3.5, 2.5), H(-1, 2.2), H(-1.5, 0)]
    for a, b in zip(pts, pts[1:]):
        R.capsule(f.L, ip(a), ip(b), 2.4, horn)
    ear = f.part('ear', 'en_ochre', 2)
    R.fill_polygon(f.L, [H(-1, 1.5), H(-4, 3.5 + pose.get('earDown', 0)), H(-1, 3.5)], ear)
    nose = f.part('nose', 'ink')
    q = ip(H(5.5, 0.5))
    box(f, q[0], q[1], q[0], q[1], nose)
    eye = f.part('eye', 'ink')
    e = ip(H(1.5, -0.5))
    box(f, e[0], e[1], e[0], e[1], eye)
    if pose.get('dead'):
        box(f, e[0] - 1, e[1], e[0] + 1, e[1], eye)
    return finish(f)


def ram_anims():
    stand = {'FF': (4, 4), 'FB': (-2, 2), 'BF': (4, 6), 'BB': (-4, 6)}

    def p(**kw):
        d = {'legs': dict(stand)}
        d.update(kw)
        return d
    A_ = {}
    A_['idle'] = [p(body=(0, b), head=(0, h)) for b, h in zip([0, 0, 1, 1], [0, 1, 1, 0])]
    sw = [22, 10, -6, -20, -6, 10]
    A_['walk'] = [p(body=(0, [0, 1, 0, 0, 1, 0][i]),
                    legs={'FF': (sw[i], 8), 'FB': (sw[(i + 3) % 6], 8), 'BF': (sw[(i + 3) % 6], 10),
                          'BB': (sw[i], 10)}) for i in range(6)]
    run = [(40, 20, -40, 30), (-30, 40, 50, 10)]
    A_['atk_headbutt'] = [
        p(body=(-1, 1), tilt=-4, head=(0, 2), headTilt=-14,
          legs={'FF': (10, 4), 'FB': (-30, 40), 'BF': (-10, 20), 'BB': (-20, 26)}),
        p(body=(-3, 2), tilt=-8, head=(-1, 3), headTilt=-24,
          legs={'FF': (-30, 50), 'FB': (14, 4), 'BF': (-14, 24), 'BB': (-24, 30)}),
        p(body=(7, -1), tilt=-6, head=(2, 3), headTilt=-18,
          legs={'FF': (run[0][0], run[0][1]), 'FB': (run[0][0] - 12, run[0][1]),
                'BF': (run[0][2], run[0][3]), 'BB': (run[0][2] - 12, run[0][3])}),
        p(body=(7, 0), tilt=-4, head=(2, 3), headTilt=-18,
          legs={'FF': (run[1][0], run[1][1]), 'FB': (run[1][0] + 12, run[1][1]),
                'BF': (run[1][2], run[1][3]), 'BB': (run[1][2] + 12, run[1][3])}),
        p(body=(1, 1), tilt=-2, head=(0, 2), headTilt=-8),
        p(),
    ]
    A_['atk_leap_butt'] = [
        p(body=(-1, 2), tilt=-4, head=(0, 2), headTilt=-10,
          legs={'FF': (30, 50), 'FB': (24, 44), 'BF': (-20, 50), 'BB': (-26, 54)}),
        p(body=(-2, 3), tilt=-8, head=(-1, 3), headTilt=-20,
          legs={'FF': (40, 70), 'FB': (34, 64), 'BF': (-30, 70), 'BB': (-36, 72)}),
        p(body=(5, -3), tilt=-16, head=(2, 1), headTilt=-24,                   # rising
          legs={'FF': (-50, 40), 'FB': (-40, 40), 'BF': (-70, 20), 'BB': (-80, 20)}),
        p(body=(6, -1), tilt=14, head=(2, 3), headTilt=-8,                      # falling
          legs={'FF': (60, 10), 'FB': (50, 10), 'BF': (-30, 30), 'BB': (-40, 30)}),
        p(body=(1, 2), tilt=2, head=(0, 2), headTilt=-6),
        p(),
    ]
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


# ---------------------------------------------------------------- bats

def draw_bats(pose, size, feet):
    f = Fig(*size)
    cx, cy = feet[0] + pose.get('dx', 0), feet[1] - 8 + pose.get('dy', 0)
    spread = pose.get('spread', 1.0)
    ph = pose.get('flap', 0)
    for k, (ox, oy, off) in enumerate(((-7, -2, 0), (7, -4, 2), (0, 3, 1))):
        bx, by = cx + ox * spread + pose.get('jit', ((0, 0),) * 3)[k][0], cy + oy * spread + pose.get('jit', ((0, 0),) * 3)[k][1]
        fl = (ph + off) % 4
        up = [-5, -2, 3, 0][fl] if not pose.get('folded') else 4
        wing = f.part(f'wing{k}', 'en_magenta', -1)
        for side in (-1, 1):
            tip = (bx + side * 6, by + up)
            R.fill_polygon(f.L, [(bx + side * 1, by - 1.5), (tip[0], tip[1]), (bx + side * 4, by + 1 + max(0, up) * 0.3),
                                 (bx + side * 1, by + 1.5)], wing)
        body = f.part(f'body{k}', 'en_magenta', -2)
        R.ellipse(f.L, bx, by, 2.0, 2.4, body)
        ear = f.part(f'ear{k}', 'en_magenta', 1)
        R.fill_polygon(f.L, [(bx - 2, by - 2), (bx - 1, by - 4.5), (bx, by - 2)], ear)
        R.fill_polygon(f.L, [(bx + 0.5, by - 2), (bx + 2, by - 4.5), (bx + 2.5, by - 2)], ear)
        eye = part1(f, f'eye{k}', P.RAMPS['white'][0] if not pose.get('dead') else P.RAMPS['ink'][0])
        box(f, int(bx) - 1, int(by) - 1, int(bx) - 1, int(by) - 1, eye)
        box(f, int(bx) + 1, int(by) - 1, int(bx) + 1, int(by) - 1, eye)
        if pose.get('fangs'):
            fg = part1(f, f'fang{k}', P.RAMPS['white'][0])
            box(f, int(bx) - 1, int(by) + 2, int(bx) - 1, int(by) + 2, fg)
            box(f, int(bx) + 1, int(by) + 2, int(bx) + 1, int(by) + 2, fg)
    return finish(f)


def bat_anims():
    def b(**kw):
        return kw
    A_ = {}
    A_['fly'] = [b(flap=i, dy=[0, -1, 0, 1][i]) for i in range(4)]
    A_['atk_dive_bite'] = [
        b(flap=0, dy=-2, spread=1.1), b(flap=1, dy=-4, spread=0.8, fangs=True),               # rear up, gather
        b(flap=3, dy=4, spread=0.55, folded=True, fangs=True, jit=((0, 0), (1, 1), (-1, 2))),  # dive
        b(flap=2, dy=2, spread=0.7, fangs=True), b(flap=0, dy=-1, spread=1.0)]
    A_['hurt'] = [b(flap=2, dx=-2, spread=1.3, fangs=True)]
    A_['stagger'] = [b(flap=1, dx=-1, dy=2, spread=1.2), b(flap=3, dx=1, dy=1, spread=1.1)]
    A_['knockdown'] = [b(flap=2, dy=3, spread=1.2, folded=True), b(flap=0, dy=7, spread=0.9, folded=True)]
    A_['death'] = [b(flap=2, dy=2, folded=True), b(flap=0, dy=5, spread=1.1, folded=True, dead=True),
                   b(flap=0, dy=8, spread=1.3, folded=True, dead=True),
                   b(flap=0, dy=10, spread=1.4, folded=True, dead=True)]
    return A_


# ---------------------------------------------------------------- goblin anim tables

def goblin_anims(kind):
    A_ = {}
    if kind == 'goblin_miner':
        rest = {'ang': 165, 'len': 10}
        gp = lambda **kw: human_pose(**dict(dict(armF=(14, 20), armB=(-8, 15)), **kw))   # noqa: E731
        A_['idle'] = [gp(chest=(0, b), armF=(12 + s, 22), weapon=rest) for b, s in zip([0, 0, 1, 1], [0, 2, 3, 1])]
        A_['walk'] = [dict(p, armF=(p['armF'][0] + 4, 22), weapon=rest) for p in human_walk()]
        bm = {'kind': 'bomb', 'ang': 0}
        A_['atk_bomb_toss'] = [
            gp(tilt=-4, armF=(-70, 90), weapon=bm),
            gp(tilt=-14, hipOffset=(-1, 0), armF=(-150, 40), armB=(30, 30), legF=(14, 6), weapon=bm),
            gp(tilt=14, hipOffset=(3, 1), armF=(80, 0), armB=(-30, 40), legF=(30, 20), legB=(-20, 4)),
            gp(tilt=10, hipOffset=(2, 1), armF=(50, 20), legF=(24, 18), legB=(-16, 4)),
            gp(tilt=3, armF=(24, 30)),
        ]
        A_['atk_pick_swing'] = [
            gp(tilt=-6, armF=(-40, 30), weapon={'ang': -150, 'len': 10}),
            gp(tilt=-12, hipOffset=(-1, 0), armF=(-150, 20), legF=(14, 6), weapon={'ang': -170, 'len': 10}),
            gp(tilt=16, hipOffset=(4, 1), armF=(95, 0), armB=(-30, 40), legF=(34, 28), legB=(-24, 4),
               weapon={'ang': 100, 'len': 12}),
            gp(tilt=12, hipOffset=(2, 1), armF=(60, 20), legF=(26, 20), legB=(-18, 4), weapon={'ang': 120, 'len': 10}),
            gp(tilt=4, armF=(30, 40), weapon={'ang': 150, 'len': 10}),
        ]
        w = rest
    else:
        held = {'ang': 172, 'len': 22}
        gp = lambda **kw: human_pose(**dict(dict(armF=(24, 40), armB=(-6, 14)), **kw))   # noqa: E731
        A_['idle'] = [gp(chest=(0, b), sway=s, weapon=dict(held, glow=g)) for b, s, g in
                      zip([0, 0, 1, 1], [0, 1, 0, -1], [0, 1, 1, 0])]
        A_['walk'] = [dict(p, armF=(30, 40), sway=[0, 1, 1, 0, -1, -1][i], hemLift=[0, 0, 1, 0, 0, 1][i],
                           weapon=held) for i, p in enumerate(human_walk())]
        A_['atk_stone_ward'] = [
            gp(tilt=-2, armF=(60, 70), weapon={'ang': 150, 'len': 22, 'glow': 1}),
            gp(tilt=-6, armF=(10, 150), legF=(10, 6), weapon={'ang': 176, 'len': 22, 'glow': 2}),
            gp(tilt=-2, armF=(10, 160), hipOffset=(0, -1), legF=(6, 4), weapon={'ang': 180, 'len': 22, 'glow': 3},
               hemLift=1),
            gp(tilt=0, armF=(24, 100), weapon={'ang': 176, 'len': 22, 'glow': 2}),
            gp(armF=(24, 50), weapon=dict(held, glow=1)),
        ]
        A_['atk_hex_bolt'] = [
            gp(tilt=-4, armF=(50, 40), weapon={'ang': 120, 'len': 22, 'glow': 1}),
            gp(tilt=-10, hipOffset=(-1, 0), armF=(70, 30), weapon={'ang': 100, 'len': 22, 'glow': 2}),
            gp(tilt=6, hipOffset=(2, 0), armF=(88, 2), legF=(18, 8), legB=(-12, 4),
               weapon={'ang': 94, 'len': 22, 'glow': 3}),
            gp(tilt=2, armF=(80, 10), weapon={'ang': 100, 'len': 22, 'glow': 1}),
            gp(armF=(40, 40), weapon=dict(held, glow=1)),
        ]
        A_['atk_stone_spikes'] = [
            gp(tilt=-4, armF=(-20, 120), weapon={'ang': 160, 'len': 22, 'glow': 1}),
            gp(tilt=-12, hipOffset=(-1, 0), armF=(-60, 160), legF=(12, 6),
               weapon={'ang': -165, 'len': 22, 'glow': 2}, hemLift=1),
            gp(tilt=18, hipOffset=(5, 2), armF=(70, 10), legF=(34, 24), legB=(-22, 6),
               weapon={'ang': 40, 'len': 22, 'glow': 3}),
            gp(tilt=14, hipOffset=(4, 2), armF=(64, 10), legF=(30, 20), legB=(-20, 6),
               weapon={'ang': 36, 'len': 22, 'glow': 2}),
            gp(tilt=4, armF=(30, 40), weapon=dict(held, glow=1)),
        ]
        w = held
    A_['hurt'] = [human_pose(tilt=-14, hipOffset=(-1, 0), head=(-1, 0), armF=(-40, 40), armB=(-70, 30),
                             legF=(14, 8), legB=(-10, 4), weapon=w)]
    A_['stagger'] = [human_pose(tilt=-8, hipOffset=(-1, 1), armF=(-20, 50), armB=(-50, 20), legF=(18, 20),
                                legB=(-6, 10), weapon=w),
                     human_pose(tilt=6, hipOffset=(1, 1), armF=(20, 30), armB=(-10, 20), legF=(10, 18),
                                legB=(-14, 10), weapon=w)]
    A_['knockdown'] = [downed(0), downed(2)]
    A_['death'] = [downed(0), downed(1), downed(2), downed(3)]
    return A_


# ---------------------------------------------------------------- tables

def enemy_anims(enemy):
    if enemy == 'bat_swarm':
        return bat_anims(), draw_bats
    if enemy == 'rock_golem':
        return golem_anims(), draw_golem
    if enemy == 'ram':
        return ram_anims(), draw_ram
    return goblin_anims(enemy), lambda pose, size, feet: draw_goblin(enemy, pose, size, feet)


def segments(enemy, anim, n):
    """08 §7.2 phase segments for attack anims."""
    last = n - 1
    rec = {'phase': 'rec', 'frames': [last - 1, last]}
    tele = {'phase': 'tele', 'frames': [0, 1]}
    if anim in ('atk_shoulder_ram', 'atk_headbutt'):
        return [tele, {'phase': 'act', 'frames': [2, 3], 'loopFps': 12}, rec]
    if anim == 'atk_leap_butt':
        return [tele, {'phase': 'act', 'frames': [2, 3], 'byVy': True}, rec]
    return [tele, {'phase': 'act', 'frames': [2]}, rec]


ANIM_MODE = {'idle': ('loop', 6), 'walk': ('speed', None), 'hurt': ('once', None), 'stagger': ('loop', 8),
             'knockdown': ('once', 10), 'death': ('once', 10), 'fly': ('loop', 14), 'turn': ('once', 2.5)}


def anim_def(enemy, anim, n):
    key = f'{enemy}_{anim}'
    if anim.startswith('atk_'):
        return A.anim(key, ATLAS, n, 'phase', segments=segments(enemy, anim, n))
    mode, fps = ANIM_MODE[anim]
    return A.anim(key, ATLAS, n, mode, fps)


def build_frames():
    frames, anims = {}, []
    for enemy in ENEMIES:
        table, drawer = enemy_anims(enemy)
        for anim, poses in table.items():
            size, (ax, ay) = frame_size(enemy, anim)
            for i, pose in enumerate(poses):
                frames[f'{enemy}_{anim}_{i:02d}'] = on_ground(drawer(pose, size, (ax, ay - 2)), ay)
            anims.append(anim_def(enemy, anim, len(poses)))
    return frames, anims


def idle_key(enemy):
    return f'{enemy}_{"fly" if enemy == "bat_swarm" else "idle"}_00'


def build(assets, preview, bg_ramp=('mt_bg1', 1)):
    import os
    from .. import preview as V
    from ..boxes import HURTBOX, ATTACK_BOX
    frames, anims = build_frames()
    allowed = P.allowed(P.MOUNTAINS_ENEMY_RAMPS)
    for n, img in frames.items():
        P.check_palette_lock(img, allowed, ATLAS, n)
    A.pack_atlas(ATLAS, frames, os.path.join(assets, 'atlases'))
    bg = tuple(P.RAMPS[bg_ramp[0]][bg_ramp[1]])
    rows = []
    for ad in anims:
        enemy = next(e for e in ENEMIES if ad['key'].startswith(e + '_'))
        anim = ad['key'][len(enemy) + 1:]
        _size, anchor = frame_size(enemy, anim)
        w, h = HURTBOX[enemy]
        hurt = (0, -h / 2, w, h) if enemy != 'bat_swarm' else (0, -8, w, h)
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
