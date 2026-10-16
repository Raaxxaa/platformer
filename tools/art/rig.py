"""Part-based rigs (08 §12.3). Coordinates are pixel indexes; joints rounded half up."""
import math

HUMANOID = {'hip': 12, 'torso': 8, 'head': 5, 'upper': 5, 'fore': 5, 'thigh': 6, 'shin': 6}


def rnd(v):
    return int(math.floor(v + 0.5))


def _seg(p, deg, length):
    """0° = straight down, positive = toward the facing (+x)."""
    r = math.radians(deg)
    return (p[0] + length * math.sin(r), p[1] + length * math.cos(r))


def _pt(p):
    return (rnd(p[0]), rnd(p[1]))


def humanoid_fk(pose, lengths=HUMANOID, feet=(24, 44)):
    """pose: dict with lean, hipOffset, head, chest, armF/armB [shoulderDeg, elbowDeg], legF/legB [hipDeg, kneeDeg].
    Elbows bend forward (forearm = shoulder + elbow), knees bend backward (shin = hip − knee)."""
    L = lengths
    hx, hy = pose.get('hipOffset', (0, 0))
    hip = (feet[0] + hx, feet[1] - L['hip'] + hy)
    cdx, cdy = pose.get('chest', (0, 0))
    chest = (hip[0] + pose.get('lean', 0) + cdx, hip[1] - L['torso'] + cdy)
    hdx, hdy = pose.get('head', (0, 0))
    head = (chest[0] + hdx, chest[1] - L['head'] + hdy)
    j = {'hip': _pt(hip), 'chest': _pt(chest), 'head': _pt(head)}
    for side in 'FB':
        sd, ed = pose['arm' + side]
        sh = (chest[0], chest[1] + 1)
        el = _seg(sh, sd, L['upper'])
        ha = _seg(el, sd + ed, L['fore'])
        j['shoulder' + side], j['elbow' + side], j['hand' + side] = _pt(sh), _pt(el), _pt(ha)
        td, kd = pose['leg' + side]
        kn = _seg(hip, td, L['thigh'])
        ft = _seg(kn, td - kd, L['shin'])
        j['knee' + side], j['foot' + side] = _pt(kn), _pt(ft)
        j['shin' + side] = td - kd
    return j


def quadruped_fk(pose, dims):
    """Quadruped rig: body ellipse center, neck + head, 4 two-segment legs, tail.
    dims: body (rx, ry), hipH (height of leg roots above feet), legs (upper, lower), feet y, x.
    pose: body [dx, dy], head [dx, dy], tail deg, legs {FF, FB, BF, BB: [hipDeg, kneeDeg]}.
    Front legs bend backward at the knee, hind legs (hock) bend forward."""
    fx, fy = dims['feet']
    bdx, bdy = pose.get('body', (0, 0))
    body = (fx + dims.get('bodyX', 0) + bdx, fy - dims['bodyH'] + bdy)
    j = {'body': _pt(body)}
    up, lo = dims['legs']
    for key, (ox, sign) in {'FF': (dims['frontX'] + 1, -1), 'FB': (dims['frontX'] - 1, -1),
                            'BF': (dims['backX'] + 1, 1), 'BB': (dims['backX'] - 1, 1)}.items():
        root = (body[0] + ox, body[1] + dims['legRootDy'])
        hd, kd = pose['legs'][key]
        kn = _seg(root, hd, up)
        ft = _seg(kn, hd + sign * kd, lo)
        j['root' + key], j['knee' + key], j['foot' + key] = _pt(root), _pt(kn), _pt(ft)
    hdx, hdy = pose.get('head', (0, 0))
    j['neck'] = _pt((body[0] + dims['neck'][0], body[1] + dims['neck'][1]))
    j['head'] = _pt((body[0] + dims['headAt'][0] + hdx, body[1] + dims['headAt'][1] + hdy))
    tr = (body[0] + dims['tailAt'][0], body[1] + dims['tailAt'][1])
    j['tailRoot'] = _pt(tr)
    td = pose.get('tail', -120)
    mid = _seg(tr, td, dims['tail'] / 2)
    j['tailMid'] = _pt(mid)
    j['tailTip'] = _pt(_seg(mid, td + pose.get('tailCurl', 0), dims['tail'] / 2))
    return j
