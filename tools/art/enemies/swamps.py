"""Stage 2 (Dark Forest & Swamps) enemies (08 §7.1-7.3): bog_zombie, giant_spider, wisp, swamp_witch, treant."""
import math

from .. import atlas as A
from .. import palette as P
from .. import raster as R
from ..rig import humanoid_fk, rnd
from .plains import Fig, finish, on_ground, seg, ip, box, human_pose, human_walk, downed
from .mountains import part1

ATLAS = 'enemies_swamps'
ENEMIES = ['bog_zombie', 'giant_spider', 'wisp', 'swamp_witch', 'treant']


def frame_size(enemy, anim):
    if enemy == 'treant':
        return (128, 80), (64, 78)
    if anim.startswith('atk_'):
        return (96, 48), (48, 46)
    return (48, 48), (24, 46)


# ---------------------------------------------------------------- bog zombie

ZL = {'hip': 11, 'torso': 8, 'head': 5, 'upper': 7, 'fore': 7, 'thigh': 5.5, 'shin': 5.5}


def draw_zombie(pose, size, feet):
    f = Fig(*size)
    j = humanoid_fk(pose, ZL, feet)
    hx, hy = j['head']
    cx, cy = j['chest']
    hpx, hpy = j['hip']
    sink = pose.get('sink', 0)

    def arm(side, shift):
        u = f.part('upper' + side, 'en_violet', shift)
        fo = f.part('fore' + side, 'en_bone', shift)
        R.capsule(f.L, j['shoulder' + side], j['elbow' + side], 3.4, u)
        R.capsule(f.L, j['elbow' + side], j['hand' + side], 3.0, fo)
        hd = f.part('hand' + side, 'en_bone', shift)
        R.ellipse(f.L, j['hand' + side][0], j['hand' + side][1], 2.0, 2.0, hd)
        if pose.get('claws'):
            cl = f.part('claw' + side, 'en_bone', shift + 1)
            hx_, hy_ = j['hand' + side]
            for k in (-1, 0, 1):
                R.line(f.L, (hx_ + 2, hy_ + k * 2), (hx_ + 4, hy_ + k * 2 + 1), cl)
        dr = part1(f, 'drip' + side, P.RAMPS['en_glow'][0])
        if pose.get('drip', 1):
            box(f, j['hand' + side][0], j['hand' + side][1] + 3, j['hand' + side][0], j['hand' + side][1] + 4, dr)

    def leg(side, shift):
        t = f.part('thigh' + side, 'en_violet', shift + 1)
        sh = f.part('shin' + side, 'en_bone', shift)
        kn, ft = j['knee' + side], j['foot' + side]
        ft = (ft[0], min(ft[1], feet[1]))
        R.capsule(f.L, (hpx, hpy + 1), kn, 4.2, t)
        R.capsule(f.L, kn, (ft[0], ft[1] - 1), 3.2, sh)
        box(f, ft[0] - 1, ft[1] - 1, ft[0] + 2, ft[1], f.part('foot' + side, 'en_bone', shift + 1))

    arm('B', 1)
    leg('B', 1)
    mx, my = (cx + hpx) / 2, (cy + hpy) / 2
    t = f.part('torso', 'en_violet')
    R.ellipse(f.L, mx, my, 5.2, abs(cy - hpy) / 2 + 3, t)
    rag = f.part('rag', 'en_violet', 1)
    for k, dx in enumerate((-4, -1, 2, 4)):                      # ragged hem
        R.line(f.L, (hpx + dx, hpy + 3), (hpx + dx - 1, hpy + 6 + (k % 2) * 2), rag)
    ribs = f.part('ribs', 'en_bone', 1)
    for k in range(2):
        R.line(f.L, ip((cx - 1, cy + 3 + k * 2)), ip((cx + 3, cy + 3 + k * 2)), ribs)
    leg('F', 0)
    head = f.part('head', 'en_bone')
    R.ellipse(f.L, hx, hy, 4.2, 4.0, head)
    jaw = f.part('jaw', 'en_bone', 1)
    R.fill_rect(f.L, int(hx), int(hy + 2), 4, int(2 + pose.get('mouth', 0)), jaw)
    hair = f.part('hair', 'en_violet', 1)
    R.fill_polygon(f.L, [(hx - 4, hy), (hx - 3, hy - 5), (hx + 1, hy - 4), (hx + 3, hy - 3), (hx - 1, hy - 1)], hair)
    eye = part1(f, 'eye', P.RAMPS['en_glow'][1])
    box(f, hx + 2, hy - 1, hx + 3, hy - 1, eye)
    mouth = part1(f, 'mouth', P.RAMPS['ink'][0])
    box(f, hx + 1, hy + 2, hx + 3, hy + 2 + pose.get('mouth', 0), mouth)
    if pose.get('dead'):
        box(f, hx + 1, hy - 1, hx + 3, hy - 1, mouth)
    arm('F', 0)
    del sink
    return finish(f)


def zpose(**kw):
    p = human_pose(tilt=12, armF=(18, 14), armB=(-2, 14), legF=(8, 6), legB=(-6, 4))
    p.update(kw)
    return p


def zombie_anims():
    A_ = {}
    A_['idle'] = [zpose(chest=(0, b), head=(0, h), armF=(18 + s, 14), armB=(-2 + s, 14), mouth=m)
                  for b, h, s, m in zip([0, 0, 1, 1], [0, 1, 1, 0], [0, 2, 3, 1], [0, 0, 1, 1])]
    th = [16, 7, -4, -14, -5, 9]
    kn = [6, 4, 8, 20, 40, 26]
    A_['walk'] = [zpose(hipOffset=(0, [0, 1, 0, 0, 1, 0][i]), legF=(th[i], kn[i]),
                        legB=(th[(i + 3) % 6], kn[(i + 3) % 6]), armF=(30 - th[i] * 0.5, 12),
                        armB=(14 + th[i] * 0.5, 12)) for i in range(6)]
    A_['atk_rise_swipe'] = [
        zpose(tilt=36, hipOffset=(2, 11), armF=(60, 20), armB=(40, 20), legF=(70, 110), legB=(60, 100), drip=0),
        zpose(tilt=30, hipOffset=(1, 8), armF=(110, 20), armB=(60, 20), legF=(60, 90), legB=(40, 80)),
        zpose(tilt=22, hipOffset=(1, 4), armF=(150, 10), armB=(100, 20), legF=(40, 60), legB=(20, 50)),
        zpose(tilt=8, hipOffset=(0, 1), armF=(170, 10), armB=(150, 10), legF=(14, 12), legB=(-8, 6), mouth=2),
        zpose(tilt=18, hipOffset=(3, 1), armF=(96, 0), armB=(60, 20), legF=(26, 18), legB=(-12, 6), mouth=2,
              claws=True),
        zpose(tilt=14, hipOffset=(2, 1), armF=(60, 20), mouth=1),
        zpose(),
    ]
    A_['atk_claw'] = [
        zpose(tilt=6, armF=(-30, 40), legF=(10, 6)),
        zpose(tilt=2, hipOffset=(-1, 0), armF=(-80, 40), armB=(-20, 30), mouth=1),
        zpose(tilt=22, hipOffset=(4, 1), armF=(100, 0), armB=(-10, 30), legF=(28, 20), legB=(-18, 6), mouth=2,
              claws=True),
        zpose(tilt=18, hipOffset=(3, 1), armF=(70, 10), mouth=1),
        zpose(),
    ]
    A_['atk_grab_lunge'] = [
        zpose(tilt=16, hipOffset=(-1, 2), armF=(40, 50), armB=(20, 50), legF=(18, 24), legB=(-12, 18)),
        zpose(tilt=22, hipOffset=(-2, 3), armF=(30, 70), armB=(10, 70), legF=(24, 34), legB=(-16, 24), mouth=1),
        zpose(tilt=36, hipOffset=(5, 2), armF=(96, 0), armB=(90, 0), legF=(40, 30), legB=(-30, 8), mouth=2,
              claws=True),
        zpose(tilt=38, hipOffset=(7, 2), armF=(94, 0), armB=(88, 0), legF=(-6, 8), legB=(34, 30), mouth=2,
              claws=True),
        zpose(tilt=24, hipOffset=(3, 2), armF=(70, 20), armB=(60, 20), mouth=1),
        zpose(),
    ]
    A_['hurt'] = [zpose(tilt=-6, hipOffset=(-1, 0), armF=(-40, 40), armB=(-60, 30), mouth=2)]
    A_['stagger'] = [zpose(tilt=2, hipOffset=(-1, 1), armF=(-20, 50), armB=(-50, 20), mouth=1),
                     zpose(tilt=18, hipOffset=(1, 1), armF=(30, 30), armB=(10, 20))]
    A_['knockdown'] = [downed(0), downed(2)]
    A_['death'] = [downed(0), downed(1), downed(2), downed(3)]
    return A_


# ---------------------------------------------------------------- spider (also used for the Spiderling and the Queen)

def draw_spider(pose, size, feet, K=1.0, ramps=('en_violet', 'en_red')):
    """8-legged spider. feet = ground point under the body. Legs given as foot offsets (dx, dy) from `feet`."""
    f = Fig(*size)
    fx, fy = feet
    bdx, bdy = pose.get('body', (0, 0))
    bx, by = fx + bdx * K, fy - 7 * K + bdy * K
    body, mark = ramps
    legs = pose['legs']                                   # 8 entries: 4 near then 4 far, foot (dx, dy) offsets
    roots = [(-3, -2), (-1, -2), (2, -2), (4, -1)]

    def leg(i, shift):
        rx, ry = roots[i % 4]
        fdx, fdy = legs[i]
        side = 1 if i < 4 else -1
        rt = (bx + rx * K, by + ry * K + (0.5 * K if side < 0 else 0))
        ft = (fx + fdx * K, min(fy + fdy * K, fy) if fdy >= 0 else fy + fdy * K)
        kn = ((rt[0] + ft[0]) / 2 + (-(1 if fdx < rt[0] - fx else -1)) * 0 + (rt[0] - fx) * 0.15 + 0.0,
              min(rt[1], ft[1]) - 4.5 * K + pose.get('kneeLift', 0))
        part = f.part(f'leg{i}', body, shift)
        R.capsule(f.L, ip(rt), ip(kn), min(1.7 * K, 3.0), part)
        R.capsule(f.L, ip(kn), ip(ft), min(1.5 * K, 2.6), part)

    for i in (4, 5, 6, 7):
        leg(i, 2)
    for i in (0, 1, 2, 3):
        leg(i, 1)                                          # near legs are drawn under the body so it stays readable
    abd = f.part('abdomen', body)
    ax, ay = bx - 5.5 * K, by - 1 * K
    R.ellipse(f.L, ax, ay, 6.5 * K, 5.0 * K, abd)
    th = f.part('thorax', body, 1)
    R.ellipse(f.L, bx + 1 * K, by - 0.5 * K, 3.6 * K, 3.0 * K, th)
    hd = f.part('head', body)
    hx, hy = bx + 4.5 * K, by - 0.5 * K + pose.get('headDy', 0) * K
    R.ellipse(f.L, hx, hy, 2.8 * K, 2.5 * K, hd)
    mk = f.part('mark', mark)
    R.fill_polygon(f.L, [(ax - 1.5 * K, ay - 2.5 * K), (ax + 1.5 * K, ay - 2.5 * K), (ax, ay),
                         (ax + 1.5 * K, ay + 2.5 * K), (ax - 1.5 * K, ay + 2.5 * K), (ax, ay)], mk)
    fang = f.part('fang', 'en_bone')
    op = pose.get('mouth', 0)
    R.capsule(f.L, ip((hx + 2 * K, hy + 1 * K)), ip((hx + 3 * K + op, hy + 3 * K + op)), 1.2 * K, fang)
    eye = part1(f, 'eye', P.RAMPS['ink'][0] if pose.get('dead') else P.RAMPS['en_red'][3])
    box(f, int(hx + 1 * K), int(hy - 1 * K), int(hx + 1.5 * K), int(hy - 0.5 * K), eye)
    box(f, int(hx - 1 * K), int(hy - 1.5 * K), int(hx - 0.5 * K), int(hy - 1 * K), eye)
    return finish(f)


STAND = [(-14, 0), (-7, 0), (5, 0), (13, 0)]
FAR = [(-11, 0), (-3, 0), (8, 0), (16, 0)]


def sp(near=None, far=None, **kw):
    d = {'legs': list(near or STAND) + list(far or FAR)}
    d.update(kw)
    return d


def spider_anims(hang_frames=True):
    A_ = {}
    A_['idle'] = [sp(body=(0, b), headDy=h) for b, h in zip([0, 0, 1, 1], [0, 1, 1, 0])]
    sw = [4, 2, 0, -3, -1, 2]
    A_['walk'] = [sp(near=[(x + sw[i] * (1 if k % 2 else -1), -(1 if (i + k) % 3 == 0 else 0) * 2)
                           for k, (x, _y) in enumerate(STAND)],
                     far=[(x - sw[i] * (1 if k % 2 else -1), -(1 if (i + k + 1) % 3 == 0 else 0) * 2)
                          for k, (x, _y) in enumerate(FAR)], body=(0, [0, 1, 0, 0, 1, 0][i])) for i in range(6)]
    up = [(-12, -9), (-5, -12), (7, -12), (14, -8)]
    if hang_frames:
        A_['hang'] = [sp(near=[(x - 3, -10) for x, _ in STAND], far=[(x - 2, -9) for x, _ in FAR], body=(0, -4)),
                      sp(near=[(x - 3, -12) for x, _ in STAND], far=[(x - 2, -10) for x, _ in FAR], body=(0, -4))]
    A_['atk_drop'] = [
        sp(near=up, far=[(x + 1, y + 1) for x, y in up], body=(0, -3)),
        sp(near=[(x - 2, y - 2) for x, y in up], far=up, body=(0, -5), mouth=1),
        sp(near=[(-8, -12), (-4, -14), (4, -14), (9, -12)], far=[(-6, -11), (-2, -13), (6, -13), (11, -11)],
           body=(0, -2), mouth=2),                                         # falling: legs spread up
        sp(near=[(x, y) for x, y in STAND], body=(0, 2), mouth=1),
        sp(),
    ]
    A_['atk_bite'] = [
        sp(body=(-1, 1), headDy=1),
        sp(body=(-3, 2), headDy=-1, mouth=1, near=[(-16, 0), (-8, 0), (3, 0), (10, -3)]),
        sp(body=(6, -1), headDy=2, mouth=2, near=[(-12, 0), (-4, 0), (8, 0), (15, -4)]),
        sp(body=(1, 0), mouth=1),
        sp(),
    ]
    A_['atk_pounce'] = [
        sp(body=(-1, 2), near=[(-14, 0), (-8, 0), (2, 0), (10, 0)]),
        sp(body=(-3, 3), headDy=-1, mouth=1, near=[(-16, 0), (-10, 0), (0, 0), (8, 0)],
           far=[(-14, 0), (-6, 0), (4, 0), (12, 0)]),
        sp(body=(4, -4), mouth=2, near=[(-8, -6), (-2, -9), (9, -9), (16, -4)], far=[(-6, -5), (0, -8), (11, -8),
                                                                                    (17, -3)]),
        sp(body=(6, -1), mouth=2, near=[(-10, -3), (-3, -2), (9, -3), (15, -1)], far=[(-8, -2), (0, -2), (11, -2),
                                                                                       (17, 0)]),
        sp(body=(2, 1), mouth=1),
        sp(),
    ]
    A_['hurt'] = [sp(body=(-2, 0), headDy=-1, mouth=2, near=[(-16, -1), (-9, -1), (3, -1), (11, -1)])]
    A_['stagger'] = [sp(body=(-1, 1), headDy=-1, mouth=1), sp(body=(1, 1), headDy=1)]
    curl = [(-8, -4), (-4, -6), (4, -6), (8, -4)]
    A_['knockdown'] = [sp(body=(-1, 1), mouth=1), sp(body=(0, 2), near=curl, far=[(x + 1, y) for x, y in curl],
                                                     kneeLift=-3)]
    A_['death'] = [A_['knockdown'][0], sp(body=(0, 2), near=curl, far=curl, kneeLift=-2),
                   sp(body=(0, 3), near=[(-6, -7), (-3, -9), (3, -9), (6, -7)], far=[(-5, -6), (-2, -8), (4, -8),
                                                                                    (7, -6)], dead=True),
                   sp(body=(0, 3), near=[(-5, -8), (-2, -10), (2, -10), (5, -8)], far=[(-4, -7), (-1, -9), (3, -9),
                                                                                        (6, -7)], dead=True)]
    return A_


# ---------------------------------------------------------------- wisp

def draw_wisp(pose, size, feet):
    f = Fig(*size)
    cx = feet[0] + pose.get('dx', 0)
    cy = feet[1] - 7 + pose.get('dy', 0)
    r = pose.get('r', 5.0)
    sway = pose.get('sway', 0)
    body = f.part('body', 'en_glow')
    R.ellipse(f.L, cx, cy + 1, r, r * 0.95, body)
    tip = pose.get('tip', 6)
    R.fill_polygon(f.L, [(cx - r * 0.75, cy), (cx + r * 0.75, cy), (cx + sway, cy - r - tip)], body)
    # side licks of flame
    R.fill_polygon(f.L, [(cx - r, cy + 1), (cx - r - 2, cy - 3 - pose.get('lick', 0)), (cx - r * 0.4, cy - 2)], body)
    R.fill_polygon(f.L, [(cx + r, cy + 1), (cx + r + 2, cy - 3 - pose.get('lick', 0)), (cx + r * 0.4, cy - 2)], body)
    core = part1(f, 'core', P.RAMPS['en_glow'][2])
    R.ellipse(f.L, cx, cy + 1, max(1.5, r * 0.5), max(1.5, r * 0.5), core)
    eye = part1(f, 'eye', P.RAMPS['ink'][0])
    box(f, rnd(cx) - 2, rnd(cy), rnd(cx) - 2, rnd(cy) + 1, eye)
    box(f, rnd(cx) + 1, rnd(cy), rnd(cx) + 1, rnd(cy) + 1, eye)
    if pose.get('dead'):
        box(f, rnd(cx) - 2, rnd(cy) + 1, rnd(cx) + 1, rnd(cy) + 1, eye)
    return finish(f)


def wisp_anims():
    A_ = {}
    A_['float'] = [dict(dy=d, tip=t, sway=s, lick=l) for d, t, s, l in
                   ((0, 6, 0, 0), (-1, 7, 1, 1), (-1, 5, 0, 2), (0, 7, -1, 1))]
    A_['atk_detonate'] = [dict(r=5.4 + k * 1.2, tip=5 + k, lick=k, dy=-k * 0.5, sway=(k % 2)) for k in range(4)] + \
        [dict(r=11, tip=2, lick=3, dy=-2)]
    A_['hurt'] = [dict(dx=-2, tip=3, lick=3)]
    A_['stagger'] = [dict(dx=-1, tip=4, lick=2), dict(dx=1, tip=5, lick=1)]
    A_['knockdown'] = [dict(dy=2, tip=3, r=4.6), dict(dy=4, tip=2, r=4.0)]
    A_['death'] = [dict(r=6, tip=4, lick=3), dict(r=7, tip=2, lick=2, dy=-1), dict(r=3.2, tip=0, dead=True, dy=2),
                   dict(r=2.2, tip=0, dead=True, dy=3)]
    return A_


# ---------------------------------------------------------------- swamp witch

WL = {'hip': 9, 'torso': 8, 'head': 5, 'upper': 5, 'fore': 5, 'thigh': 4.5, 'shin': 4.5}


def draw_witch(pose, size, feet):
    f = Fig(*size)
    j = humanoid_fk(pose, WL, feet)
    hx, hy = j['head']
    cx, cy = j['chest']
    hpx, hpy = j['hip']
    wp = pose.get('item')

    def arm(side, shift):
        u = f.part('upper' + side, 'en_violet', shift)
        fo = f.part('fore' + side, 'en_bone', shift)
        R.capsule(f.L, j['shoulder' + side], j['elbow' + side], 3.0, u)
        R.capsule(f.L, j['elbow' + side], j['hand' + side], 2.6, fo)
        R.ellipse(f.L, j['hand' + side][0], j['hand' + side][1], 1.7, 1.7, f.part('hand' + side, 'en_bone', shift))
        if pose.get('claws'):
            cl = f.part('claw' + side, 'en_bone', shift + 1)
            h_ = j['hand' + side]
            for k in (-1, 0, 1):
                R.line(f.L, (h_[0] + 2, h_[1] + k * 2), (h_[0] + 4, h_[1] + k * 2 + 1), cl)

    def leg(side, shift):
        t = f.part('leg' + side, 'en_violet', shift + 1)
        kn, ft = j['knee' + side], j['foot' + side]
        ft = (ft[0], min(ft[1], feet[1]))
        R.capsule(f.L, (hpx, hpy + 1), kn, 3.2, t)
        R.capsule(f.L, kn, (ft[0], ft[1] - 1), 2.8, t)
        box(f, ft[0] - 1, ft[1] - 1, ft[0] + 2, ft[1], f.part('boot' + side, 'en_bone', shift + 2))

    arm('B', 1)
    leg('B', 1)
    robe = f.part('robe', 'en_violet')
    sway = pose.get('sway', 0)
    hem = feet[1] - 4
    R.fill_polygon(f.L, [(cx - 3.5, cy - 1), (cx + 3.5, cy - 1), (hpx + 5.5 + sway, hem), (hpx - 5.5 + sway, hem)], robe)
    leg('F', 0)
    R.fill_polygon(f.L, [(hpx - 5 + sway, hpy + 1), (hpx + 5 + sway, hpy + 1), (hpx + 5.5 + sway, hem),
                         (hpx - 5.5 + sway, hem)], robe)
    hemp = f.part('hem', 'en_bone', 1)
    R.fill_rect(f.L, int(hpx - 5 + sway), hem - 1, 11, 1, hemp)
    belt = f.part('belt', 'en_bone', 2)
    R.fill_rect(f.L, int(hpx - 3), int(hpy), 8, 1, belt)
    for k, dx in enumerate((-2, 1, 4)):                             # potion bottles on the belt
        bot = part1(f, f'potion{k}', P.RAMPS['en_glow'][0 if k == 1 else 1])
        box(f, int(hpx + dx), int(hpy + 1), int(hpx + dx) + 1, int(hpy + 3), bot)
    head = f.part('head', 'en_bone')
    R.ellipse(f.L, hx, hy, 3.7, 3.7, head)
    nose = f.part('nose', 'en_bone', 1)
    R.fill_polygon(f.L, [(hx + 2.5, hy - 0.5), (hx + 6, hy + 2), (hx + 2.5, hy + 2)], nose)
    hat = f.part('hat', 'en_violet')
    R.fill_polygon(f.L, [(hx - 7, hy - 2), (hx + 6, hy - 2), (hx + 3, hy - 4), (hx + 0.5 + pose.get('hatBend', 0) + 4, hy - 13),
                         (hx - 3, hy - 4)], hat)
    band = f.part('band', 'en_bone', 1)
    R.fill_rect(f.L, int(hx - 3), int(hy - 4), 7, 1, band)
    hair = f.part('hair', 'en_violet', 2)
    R.fill_polygon(f.L, [(hx - 4, hy - 2), (hx - 6, hy + 4), (hx - 3, hy + 3)], hair)
    eye = part1(f, 'eye', P.RAMPS['en_glow'][1] if not pose.get('dead') else P.RAMPS['ink'][0])
    box(f, hx + 1, hy - 1, hx + 2, hy - 1, eye)
    if wp == 'potion':
        hand = j['handF']
        pb = part1(f, 'pot', P.RAMPS['en_glow'][1])
        pg = f.part('potglass', 'en_bone', 1)
        R.ellipse(f.L, hand[0] + 1, hand[1] - 3, 2.4, 2.4, pg)
        box(f, hand[0], hand[1] - 3, hand[0] + 1, hand[1] - 2, pb)
    arm('F', 0)
    return finish(f)


def witch_pose(**kw):
    p = human_pose(tilt=0, armF=(20, 40), armB=(-6, 20), legF=(6, 4), legB=(-6, 2))
    p.update(kw)
    return p


def witch_anims():
    A_ = {}
    A_['idle'] = [witch_pose(chest=(0, b), sway=s, hatBend=h, armF=(20 + s * 3, 40)) for b, s, h in
                  zip([0, 0, 1, 1], [0, 1, 0, -1], [0, 1, 0, -1])]
    A_['walk'] = [dict(p, sway=[0, 1, 1, 0, -1, -1][i], armF=(26, 40)) for i, p in enumerate(human_walk())]
    A_['atk_poison_potion'] = [
        witch_pose(tilt=-3, armF=(50, 80), item='potion'),
        witch_pose(tilt=-12, hipOffset=(-1, 0), armF=(-80, 100), item='potion', legF=(10, 4)),
        witch_pose(tilt=10, hipOffset=(2, 0), armF=(80, 0), legF=(18, 8), legB=(-10, 2)),
        witch_pose(tilt=6, armF=(60, 20), hatBend=2),
        witch_pose(armF=(30, 40)),
    ]
    A_['atk_claw'] = [
        witch_pose(tilt=-4, armF=(-30, 40)),
        witch_pose(tilt=-8, hipOffset=(-1, 0), armF=(-90, 40), legF=(10, 4)),
        witch_pose(tilt=14, hipOffset=(3, 1), armF=(96, 0), legF=(26, 14), legB=(-18, 4), claws=True),
        witch_pose(tilt=10, hipOffset=(2, 1), armF=(60, 20), claws=True),
        witch_pose(),
    ]
    A_['atk_hex_hop'] = [
        witch_pose(tilt=-6, hipOffset=(0, 2), armF=(-40, 60), legF=(24, 50), legB=(-18, 46)),
        witch_pose(tilt=-12, hipOffset=(1, 3), armF=(-70, 70), legF=(30, 70), legB=(-24, 66)),
        witch_pose(tilt=-14, hipOffset=(-3, -3), armF=(-120, 30), armB=(-100, 30), legF=(-30, 60), legB=(-50, 50),
                   hatBend=-3),                                                    # rising (backward leap)
        witch_pose(tilt=-6, hipOffset=(-3, -3), armF=(-60, 40), legF=(-6, 8), legB=(-20, 14), hatBend=-3),   # falling
        witch_pose(tilt=4, hipOffset=(0, 2), armF=(20, 50), legF=(18, 40), legB=(-10, 36)),
        witch_pose(),
    ]
    A_['hurt'] = [witch_pose(tilt=-12, hipOffset=(-1, 0), armF=(-50, 40), armB=(-70, 30), hatBend=-3)]
    A_['stagger'] = [witch_pose(tilt=-8, hipOffset=(-1, 1), armF=(-30, 50), hatBend=-2),
                     witch_pose(tilt=6, hipOffset=(1, 1), armF=(20, 30), hatBend=2)]
    A_['knockdown'] = [downed(0), downed(2)]
    A_['death'] = [downed(0), downed(1), downed(2), downed(3)]
    return A_


# ---------------------------------------------------------------- treant

TL = {'hip': 14, 'torso': 20, 'head': 9, 'upper': 15, 'fore': 15, 'thigh': 7, 'shin': 7}


def draw_treant(pose, size, feet):
    f = Fig(*size)
    j = humanoid_fk(pose, TL, feet)
    hx, hy = j['head']
    cx, cy = j['chest']
    hpx, hpy = j['hip']

    def arm(side, shift):
        b = f.part('branch' + side, 'en_bone', shift)
        R.capsule(f.L, j['shoulder' + side], j['elbow' + side], 5.0, b)
        R.capsule(f.L, j['elbow' + side], j['hand' + side], 3.6, b)
        hnd = j['hand' + side]
        tw = f.part('twig' + side, 'en_bone', shift + 1)
        for a_ in (-30, 10, 50):
            ang = pose.get('armDeg' + side, 90) + a_
            R.line(f.L, hnd, ip(seg(hnd, ang, 5)), tw)
        lf = f.part('leaf' + side, 'en_violet', shift)
        el = j['elbow' + side]
        R.ellipse(f.L, el[0], el[1] - 3, 3.0, 2.4, lf)
        R.ellipse(f.L, hnd[0] - 1, hnd[1] - 2, 2.4, 2.0, lf)

    def leg(side, shift):
        t = f.part('root' + side, 'en_bone', shift + 1)
        kn, ft = j['knee' + side], j['foot' + side]
        ft = (ft[0], min(ft[1], feet[1]))
        R.capsule(f.L, (hpx, hpy), kn, 7.0, t)
        R.capsule(f.L, kn, (ft[0], ft[1] - 2), 5.0, t)
        for dx in (-5, -2, 3, 6):                               # root toes
            R.line(f.L, (ft[0], ft[1] - 2), (ft[0] + dx, ft[1]), t)
        R.fill_rect(f.L, ft[0] - 2, ft[1] - 1, 5, 1, t)

    arm('B', 1)
    leg('B', 1)
    trunk = f.part('trunk', 'en_bone')
    mx, my = (cx + hpx) / 2, (cy + hpy) / 2 - 1
    R.ellipse(f.L, mx, my, 8.5, abs(cy - hpy) / 2 + 5, trunk)
    R.ellipse(f.L, hpx, hpy + 2, 9, 5, trunk)                    # flared base
    bark = f.part('bark', 'ink')
    for k, (dx, dy) in enumerate(((-6, 4), (2, 9), (-3, 14), (5, 17), (-5, 20), (1, 25))):   # birch marks
        R.line(f.L, ip((mx + dx, cy + dy - 8)), ip((mx + dx + 3, cy + dy - 8)), bark)
    leg('F', 0)
    # face hollow in the upper trunk and the canopy of violet leaves on top
    hol = f.part('hollow', 'ink')
    R.ellipse(f.L, cx + 3, cy - 3, 3.0, 4.0, hol)
    eye = part1(f, 'eye', P.RAMPS['en_glow'][1])
    box(f, cx + 3, cy - 5, cx + 3, cy - 4, eye)
    box(f, cx + 5, cy - 5, cx + 5, cy - 4, eye)
    lv = f.part('leaves', 'en_violet')
    for dx, dy, rx, ry in ((0, -7, 9, 5.5), (-8, -4, 6, 4.5), (8, -5, 6, 4.5), (-3, -12, 6, 4), (4, -11, 6, 4)):
        R.ellipse(f.L, hx + dx + pose.get('canopy', 0), hy + dy, rx, ry, lv)
    lv2 = f.part('leaves2', 'en_violet', 1)
    for dx, dy in ((-9, -1), (-5, 2), (9, -1), (6, 2)):
        R.ellipse(f.L, hx + dx, hy + dy, 2.2, 3.0, lv2)
    arm('F', 0)
    if pose.get('dead'):
        box(f, cx + 3, cy - 3, cx + 5, cy - 3, bark)
    return finish(f)


def tpose(**kw):
    p = human_pose(tilt=0, armF=(14, 20), armB=(-12, 20), legF=(6, 4), legB=(-6, 2))
    p.update(kw)
    return p


def treant_anims():
    A_ = {}
    A_['idle'] = [tpose(chest=(0, b), canopy=c, armF=(14 + s, 20), armB=(-12 - s, 20)) for b, c, s in
                  zip([0, 0, 1, 1], [0, 1, 0, -1], [0, 2, 3, 1])]
    th = [12, 6, -3, -10, -4, 7]
    kn = [4, 3, 6, 12, 24, 14]
    A_['walk'] = [tpose(hipOffset=(0, [0, 1, 0, 0, 1, 0][i]), legF=(th[i], kn[i]),
                        legB=(th[(i + 3) % 6], kn[(i + 3) % 6]), armF=(14 - th[i], 20), armB=(-12 + th[i], 20),
                        canopy=[0, 1, 1, 0, -1, -1][i]) for i in range(6)]
    A_['atk_root_snare'] = [
        tpose(tilt=-4, armF=(-30, 50), armB=(-40, 50)),
        tpose(tilt=-8, hipOffset=(-1, 2), armF=(-60, 70), armB=(-70, 70), legF=(14, 20), legB=(-12, 16), canopy=1),
        tpose(tilt=14, hipOffset=(3, 3), armF=(40, 100), armB=(30, 100), legF=(26, 40), legB=(-18, 20), canopy=-2),
        tpose(tilt=12, hipOffset=(2, 3), armF=(40, 100), armB=(30, 100), legF=(24, 36), legB=(-16, 18)),
        tpose(tilt=4, armF=(20, 30)),
    ]
    A_['atk_branch_slam'] = [
        tpose(tilt=-8, armF=(-120, 40), armB=(-130, 40)),
        tpose(tilt=-16, hipOffset=(-2, 0), armF=(-175, 20), armB=(-170, 20), legF=(10, 6), canopy=2),
        tpose(tilt=22, hipOffset=(5, 2), armF=(60, 20), armB=(50, 20), legF=(32, 28), legB=(-24, 8), canopy=-3,
              armDegF=40),
        tpose(tilt=18, hipOffset=(4, 2), armF=(50, 20), armB=(44, 20), legF=(30, 26), legB=(-22, 8)),
        tpose(tilt=6, hipOffset=(1, 1), armF=(24, 30), armB=(-4, 30)),
    ]
    A_['hurt'] = [tpose(tilt=-8, hipOffset=(-1, 0), armF=(-30, 40), armB=(-50, 30), canopy=-2)]
    A_['stagger'] = [tpose(tilt=-6, hipOffset=(-1, 1), armF=(-20, 40), canopy=-2),
                     tpose(tilt=4, hipOffset=(1, 1), armF=(20, 30), canopy=2)]
    A_['knockdown'] = [downed(0), downed(2)]
    A_['death'] = [downed(0), downed(1), downed(2), downed(3)]
    return A_


# ---------------------------------------------------------------- tables

def enemy_anims(enemy):
    if enemy == 'bog_zombie':
        return zombie_anims(), draw_zombie
    if enemy == 'giant_spider':
        return spider_anims(), lambda pose, size, feet: draw_spider(pose, size, feet)
    if enemy == 'wisp':
        return wisp_anims(), draw_wisp
    if enemy == 'swamp_witch':
        return witch_anims(), draw_witch
    return treant_anims(), draw_treant


def segments(enemy, anim, n):
    last = n - 1
    rec = {'phase': 'rec', 'frames': [last - 1, last]}
    tele = {'phase': 'tele', 'frames': [0, 1]}
    if anim == 'atk_rise_swipe':                       # Tele is 4 frames (08 §7.3)
        return [{'phase': 'tele', 'frames': [0, 1, 2, 3]}, {'phase': 'act', 'frames': [4]},
                {'phase': 'rec', 'frames': [5, 6]}]
    if anim == 'atk_detonate':                         # Tele 4 swelling frames, Act 1, no Rec
        return [{'phase': 'tele', 'frames': [0, 1, 2, 3]}, {'phase': 'act', 'frames': [4]}]
    if anim == 'atk_grab_lunge':
        return [tele, {'phase': 'act', 'frames': [2, 3], 'loopFps': 12}, rec]
    if anim in ('atk_pounce', 'atk_hex_hop'):
        return [tele, {'phase': 'act', 'frames': [2, 3], 'byVy': True}, rec]
    return [tele, {'phase': 'act', 'frames': [2]}, rec]


ANIM_MODE = {'idle': ('loop', 6), 'walk': ('speed', None), 'hurt': ('once', None), 'stagger': ('loop', 8),
             'knockdown': ('once', 10), 'death': ('once', 10), 'float': ('loop', 10), 'hang': ('loop', 4)}


def anim_def(enemy, anim, n):
    key = f'{enemy}_{anim}'
    if anim.startswith('atk_'):
        return A.anim(key, ATLAS, n, 'phase', segments=segments(enemy, anim, n))
    if enemy == 'treant' and anim == 'walk':
        return A.anim(key, ATLAS, n, 'loop', 6)        # fixed 6 fps (08 §7.3)
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
    return f'{enemy}_{"float" if enemy == "wisp" else "idle"}_00'


def build(assets, preview):
    import os
    from .. import preview as V
    from ..boxes import HURTBOX, ATTACK_BOX
    frames, anims = build_frames()
    allowed = P.allowed(P.SWAMPS_ENEMY_RAMPS)
    for n, img in frames.items():
        P.check_palette_lock(img, allowed, ATLAS, n)
    A.pack_atlas(ATLAS, frames, os.path.join(assets, 'atlases'))
    bg = tuple(P.RAMPS['sw_bg0'][1])
    rows = []
    for ad in anims:
        enemy = next(e for e in ENEMIES if ad['key'].startswith(e + '_'))
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
