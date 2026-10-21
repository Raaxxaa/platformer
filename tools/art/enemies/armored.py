"""ART8: one armored-humanoid drawer for the Stage 3-4 soldiers, mages, knights, guards, armors, bosses (08 §7.3-7.4).

Everything is config: lengths, plate / cloth ramps, helmet, plume, cape, robe, weapon kind. Poses are the same dicts as
`plains.human_pose` (+ 'shield': 'up' | 'low' | None and 'weapon': {'ang', 'len', 'glow'})."""
from .. import palette as P
from .. import raster as R
from ..rig import humanoid_fk
from .plains import Fig, finish, seg, ip, box, human_pose, human_walk, downed

L_SMALL = {'hip': 12, 'torso': 8, 'head': 5, 'upper': 5, 'fore': 5, 'thigh': 6, 'shin': 6}


def one(f, name, color):
    if name not in f.L.index:
        f.L.add_part(name, [P.sid(color)])
    return name


# ---------------------------------------------------------------- weapons

def blade(f, hand, ang, length, width=2.4, ramp='gray', hilt='en_gold', name='blade'):
    b = f.part(name, ramp)
    h = f.part(name + '_hilt', hilt)
    tip = seg(hand, ang, length)
    base = seg(hand, ang, 2)
    R.capsule(f.L, ip(base), ip(tip), width, b)
    g0, g1 = seg(base, ang + 90, width + 1), seg(base, ang - 90, width + 1)
    R.line(f.L, ip(g0), ip(g1), h)
    R.line(f.L, ip(seg(hand, ang, -3)), ip(seg(hand, ang, 1)), h)


def crossbow(f, hand, ang):
    st = f.part('xb_stock', 'en_bone', 2)
    bw = f.part('xb_bow', 'en_steel')
    tip = seg(hand, ang, 9)
    R.capsule(f.L, ip(seg(hand, ang, -5)), ip(tip), 2.4, st)
    a, b = seg(tip, ang + 90, 6), seg(tip, ang - 90, 6)
    R.line(f.L, ip(a), ip(seg(tip, ang, -2)), bw)
    R.line(f.L, ip(b), ip(seg(tip, ang, -2)), bw)
    R.line(f.L, ip(a), ip(b), one(f, 'xb_string', P.RAMPS['gray'][3]))


def staff(f, hand, ang, length, orb, glow=0, gem_ramp=None):
    s = f.part('staff', 'en_bone', 2)
    top = seg(hand, ang, length)
    R.capsule(f.L, ip(seg(hand, ang, -6)), ip(top), 1.8, s)
    o = f.part('orb', gem_ramp or orb)
    c = ip(seg(top, ang, 3.5))
    R.ellipse(f.L, c[0], c[1], 2.8 + 0.5 * glow, 2.8 + 0.5 * glow, o)
    if glow >= 2:
        R.line(f.L, c, c, one(f, 'orbglow', P.RAMPS['white'][0]))
    return top


def polearm(f, hand, ang, length, head='halberd'):
    sh = f.part('shaft', 'en_gold', 2)
    hd = f.part('head', 'en_steel')
    tip = seg(hand, ang, length)
    R.capsule(f.L, ip(seg(hand, ang, -8)), ip(tip), 1.8, sh)
    if head == 'halberd':
        R.fill_polygon(f.L, [seg(tip, ang, 5), seg(tip, ang + 90, 1), seg(seg(tip, ang, -4), ang + 90, 6),
                             seg(seg(tip, ang, -4), ang - 90, 1)], hd)
        R.line(f.L, ip(tip), ip(seg(tip, ang, 6)), hd)
    return tip


def great_axe(f, hand, ang, length):
    sh = f.part('shaft', 'en_bone', 2)
    hd = f.part('head', 'en_steel')
    tip = seg(hand, ang, length)
    R.capsule(f.L, ip(seg(hand, ang, -5)), ip(tip), 2.6, sh)
    R.fill_polygon(f.L, [seg(tip, ang, 1), seg(seg(tip, ang, 1), ang + 90, 11), seg(seg(tip, ang, -9), ang + 90, 7),
                         seg(seg(tip, ang, -9), ang - 90, 3)], hd)
    R.line(f.L, ip(seg(seg(tip, ang, 1), ang + 90, 11)), ip(seg(seg(tip, ang, -9), ang + 90, 7)), one(f, 'edge', P.RAMPS['white'][0]))


def kite_shield(f, c, ramp, emblem, scale=1.0, tilt=0):
    sh = f.part('shield', ramp)
    em = f.part('shield_em', emblem)
    w, h = 6.5 * scale, 9 * scale
    R.fill_polygon(f.L, [(c[0] - w, c[1] - h), (c[0] + w, c[1] - h), (c[0] + w, c[1] + h * 0.2), (c[0], c[1] + h * 1.25),
                         (c[0] - w, c[1] + h * 0.2)], sh)
    R.fill_rect(f.L, int(c[0] - 1), int(c[1] - h + 2), 2, int(h * 1.7), em)
    R.fill_rect(f.L, int(c[0] - w + 2), int(c[1] - 2), int(2 * w - 4), 2, em)


# ---------------------------------------------------------------- the figure

def draw_armored(cfg, pose, size, feet):
    s = cfg
    f = Fig(*size)
    lift = s.get('lift', 0)
    if lift:                                                  # lighten the plate shades (dark armors on dark floors)
        _part = f.part
        f.part = lambda name, ramp, shift=0: _part(name, ramp, shift - (lift if ramp == s['plate'] else 0))
    L = s['L']
    j = humanoid_fk(pose, L, feet)
    hx, hy = j['head']
    cx, cy = j['chest']
    hpx, hpy = j['hip']
    lw, tw = s['limb'], s['thigh']
    plate, cloth = s['plate'], s.get('cloth')
    wp = pose.get('weapon')
    tilt = pose.get('tilt', 0)

    def arm(side, shift):
        u = f.part('upper' + side, s.get('sleeve', plate), shift)
        fo = f.part('fore' + side, plate, shift)
        R.capsule(f.L, j['shoulder' + side], j['elbow' + side], lw, u)
        R.capsule(f.L, j['elbow' + side], j['hand' + side], lw, fo)
        R.ellipse(f.L, j['shoulder' + side][0], j['shoulder' + side][1], lw / 1.6, lw / 1.6, f.part('pauld' + side, plate, shift - 1))
        hd = f.part('hand' + side, s.get('glove', plate), shift + 1)
        R.ellipse(f.L, j['hand' + side][0], j['hand' + side][1], lw / 2.0, lw / 2.0, hd)

    def leg(side, shift):
        t = f.part('thigh' + side, s.get('pants', plate), shift)
        sh = f.part('shin' + side, plate, shift)
        b = f.part('boot' + side, s.get('boots', plate), shift + 2)
        kn, ft = j['knee' + side], j['foot' + side]
        ft = (ft[0], min(ft[1], feet[1]))
        R.capsule(f.L, (hpx, hpy + 1), kn, tw, t)
        R.capsule(f.L, kn, (ft[0], ft[1] - 1), tw - 0.8, sh)
        R.ellipse(f.L, kn[0], kn[1], tw / 2 + 0.3, tw / 2 + 0.3, f.part('knee' + side, plate, shift - 1))
        bw = 3 if s['big'] else 2
        box(f, ft[0] - bw + 1, ft[1] - (2 if s['big'] else 1), ft[0] + bw, ft[1], b)

    def hold(back):
        if not wp or wp.get('back', False) != back:
            return
        hand = j['hand' + wp.get('hand', 'F')]
        k = s['weapon']
        a, n = wp['ang'], wp.get('len', s.get('wlen', 10))
        if k == 'sword':
            blade(f, hand, a, n, s.get('bw', 2.4), s.get('bramp', 'gray'), s.get('hilt', 'en_gold'))
        elif k == 'crossbow':
            crossbow(f, hand, a)
        elif k == 'staff':
            staff(f, hand, a, n, s['orb'], wp.get('glow', 0), s.get('gem'))
        elif k == 'polearm':
            polearm(f, hand, a, n)
        elif k == 'axe':
            great_axe(f, hand, a, n)

    if s.get('cape'):                                         # behind everything
        cp = f.part('cape', s['cape'])
        sway = pose.get('sway', 0)
        R.fill_polygon(f.L, [(cx - 1, cy - 1), (cx + 1, cy), (hpx - 2 + sway, feet[1] - 3 - pose.get('hemLift', 0)),
                             (hpx - 11 + sway, feet[1] - 2 - pose.get('hemLift', 0)), (cx - 7, cy + 2)], cp)
    hold(True)
    arm('B', 1)
    leg('B', 1)
    # torso
    t = f.part('torso', plate)
    tw2 = s['torso'] / 2
    up = seg((0, 0), 180 - tilt, 1)
    sv = (-up[1], up[0])
    pts = [(cx + 0.5 - sv[0] * tw2 - up[0], cy + 0.5 - sv[1] * tw2 - up[1]),
           (cx + 0.5 + sv[0] * tw2 - up[0], cy + 0.5 + sv[1] * tw2 - up[1]),
           (hpx + 0.5 + sv[0] * (tw2 - 0.5), hpy + 2 + sv[1] * (tw2 - 0.5)),
           (hpx + 0.5 - sv[0] * (tw2 - 0.5), hpy + 2 - sv[1] * (tw2 - 0.5))]
    if s['big']:
        mx, my = (cx + hpx) / 2, (cy + hpy) / 2
        R.ellipse(f.L, mx, my - 1, tw2 + 1.5, abs(cy - hpy) / 2 + 3, t)
        R.ellipse(f.L, cx - 1, cy + 1, tw2, 4.6, t)
    else:
        R.fill_polygon(f.L, pts, t)
    if s.get('robe'):                                         # long robe over the legs
        rb = f.part('robe', s['robe'])
        hem = feet[1] - 3 - pose.get('hemLift', 0)
        sw = pose.get('sway', 0)
        R.fill_polygon(f.L, [(cx - tw2, cy - 1), (cx + tw2, cy - 1), (hpx + 7 + sw, hem), (hpx - 7 + sw, hem)], rb)
        tr = f.part('robe_trim', s['trim'], -1)
        R.fill_rect(f.L, int(hpx - 7 + sw), int(hem - 1), 14, 2, tr)
        R.fill_polygon(f.L, [(cx + 1, cy), (cx + 3, cy), (hpx + 4, hem), (hpx + 2, hem)], f.part('sash', s['trim'], 0))
    elif cloth:                                               # tabard strip down the front
        tb = f.part('tabard', cloth)
        R.fill_polygon(f.L, [(cx - 0.5, cy), (cx + 3.5, cy), (hpx + 4 + pose.get('sway', 0), hpy + 9), (hpx - 1, hpy + 9)], tb)
        if s.get('emblem'):
            R.line(f.L, (int(cx + 1), int(cy + 2)), (int(hpx + 1), int(hpy + 5)), f.part('tabard_em', s['emblem']))
    belt = f.part('belt', s.get('beltc', 'en_black'), 1)
    box(f, hpx - tw2 + 1, hpy + 1, hpx + tw2 - 1, hpy + 1 + (1 if s['big'] else 0), belt)
    if not s.get('robe'):
        leg('F', 0)
    # head
    rx, ry = s['head']
    if s.get('hood'):
        hd = f.part('hood', s['hood'])
        R.ellipse(f.L, hx - 1, hy - 0.5, rx + 0.8, ry + 0.8, hd)
        R.fill_polygon(f.L, [(hx - 3, hy + 2), (hx - 7, hy + 7), (hx - 1, hy + 5)], hd)
        R.ellipse(f.L, hx + 2.4, hy + 0.8, 2.1, 2.8, f.part('face', 'skin'))
        if s.get('hat'):
            R.fill_polygon(f.L, [(hx - rx - 1, hy - 2), (hx + rx + 1, hy - 2), (hx, hy - ry - 8)], f.part('hat', s['hood'], -1))
    else:
        h = f.part('helm', s.get('helm', plate))
        R.ellipse(f.L, hx, hy, rx, ry, h)
        R.fill_rect(f.L, int(hx - rx), int(hy + 1), int(2 * rx + 1), 3, f.part('chin', s.get('helm', plate), 1))
        if s.get('crown'):
            cr = f.part('crown', s['crown'])
            R.fill_rect(f.L, int(hx - rx + 1), int(hy - ry - 1), int(2 * rx - 1), 2, cr)
            for dx in (-rx + 1, 0, rx - 2):
                R.fill_rect(f.L, int(hx + dx), int(hy - ry - 3), 2, 3, cr)
        if s.get('plume'):
            pl = f.part('plume', s['plume'])
            R.fill_polygon(f.L, [(hx - 1, hy - ry), (hx - rx - 5, hy - ry - 1 + pose.get('plumeY', 0)), (hx - rx - 4, hy - ry + 4),
                                 (hx, hy - ry + 2)], pl)
        if s.get('horns'):
            hn = f.part('horns', s['horns'])
            for sd in (-1, 1):
                R.fill_polygon(f.L, [(hx + sd * 3, hy - ry + 1), (hx + sd * 7, hy - ry - 2), (hx + sd * 5.5, hy - ry + 2)], hn)
    ez = s.get('eyes')
    if ez:
        eye = one(f, 'eyeglow', ez)
    else:
        eye = one(f, 'eyeslit', P.RAMPS['ink'][0])
    ex = hx + (2 if not s.get('hood') else 3)
    if s.get('hood') or not s.get('visor', True):
        box(f, ex, hy - 1, ex, hy, eye)
    else:
        box(f, hx - 1, hy, hx + rx - 1, hy, eye)               # visor slit
    if pose.get('dead'):
        box(f, ex - 1, hy, ex + 1, hy, one(f, 'xeye', P.RAMPS['ink'][0]))
    if s.get('robe'):
        pass
    hold(False)
    arm('F', 0)
    sh = pose.get('shield')
    if sh and s.get('shield'):
        hand = j['handB']
        if sh == 'up':
            kite_shield(f, (hand[0] + 4, hand[1] + 1), plate, s['shield'], s.get('shield_scale', 1.0))
        elif sh == 'bash':
            kite_shield(f, (hand[0] + 6, hand[1] + 1), plate, s['shield'], s.get('shield_scale', 1.0))
        else:
            kite_shield(f, (hpx - 1, hpy + 4), plate, s['shield'], 0.8)
    return finish(f)


# ---------------------------------------------------------------- pose helpers shared by the tables

def gp(**kw):
    return human_pose(**kw)


def rest_idle(weapon, **base):
    return [human_pose(chest=(0, b), **dict(base, armF=(base.get('armF', (12, 22))[0] + s, base.get('armF', (12, 22))[1]),
                                            weapon=weapon)) for b, s in zip([0, 0, 1, 1], [0, 2, 3, 1])]


def walk(weapon, arm=None, **extra):
    out = []
    for p in human_walk():
        q = dict(p, weapon=weapon, **extra)
        if arm:
            q['armF'] = arm
        out.append(q)
    return out


def damage_set(w=None, **kw):
    """hurt (1), stagger (2), knockdown (2), death (4) for a humanoid holding `w`."""
    return {
        'hurt': [human_pose(tilt=-14, hipOffset=(-1, 0), head=(-1, 0), armF=(-40, 40), armB=(-70, 30), legF=(14, 8),
                            legB=(-10, 4), weapon=w, **kw)],
        'stagger': [human_pose(tilt=-8, hipOffset=(-1, 1), armF=(-20, 50), armB=(-50, 20), legF=(18, 20), legB=(-6, 10),
                               weapon=w, **kw),
                    human_pose(tilt=6, hipOffset=(1, 1), armF=(20, 30), armB=(-10, 20), legF=(10, 18), legB=(-14, 10),
                               weapon=w, **kw)],
        'knockdown': [downed(0), downed(2)],
        'death': [downed(0), downed(1), downed(2), downed(3)],
    }
