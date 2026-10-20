"""Stone Colossus (08 §7.4): a giant Rock Golem. Atlas `boss_stone_colossus`, 192 × 144, anchor (96, 142)."""
from .. import atlas as A
from .. import palette as P
from .. import raster as R
from ..enemies.plains import Fig, finish, on_ground, box, human_pose, downed
from ..enemies.mountains import part1
from ..rig import humanoid_fk

ATLAS = 'boss_stone_colossus'
SIZE, ANCHOR = (192, 144), (96, 142)
RAMPS = ['ink', 'white', 'en_ochre', 'fx_fire']
K = 2.3
L = {k: v * K for k, v in {'hip': 9, 'torso': 12, 'head': 6, 'upper': 8, 'fore': 8, 'thigh': 5, 'shin': 4}.items()}


def _scaled(pose):
    p = dict(pose)
    for k in ('hipOffset', 'chest', 'head'):
        if k in p:
            p[k] = (p[k][0] * K, p[k][1] * K)
    if 'lean' in p:
        p['lean'] = p['lean'] * K
    return p


def draw(pose):
    f = Fig(*SIZE)
    feet = (ANCHOR[0], ANCHOR[1] - 2)
    j = humanoid_fk(_scaled(pose), L, feet)
    hx, hy = j['head']
    cx, cy = j['chest']
    hpx, hpy = j['hip']
    glow = pose.get('glow', 0)

    def arm(side, shift):
        u = f.part('upper' + side, 'en_ochre', shift)
        R.ellipse(f.L, *j['shoulder' + side], 4.4 * K, 4.4 * K, u)
        R.capsule(f.L, j['shoulder' + side], j['elbow' + side], 5.4 * K, u)
        R.capsule(f.L, j['elbow' + side], j['hand' + side], 5.0 * K, u)
        fi = f.part('fist' + side, 'en_ochre', shift)
        R.ellipse(f.L, j['hand' + side][0], j['hand' + side][1], 4.4 * K, 4.2 * K, fi)

    def leg(side, shift):
        t = f.part('leg' + side, 'en_ochre', shift + 1)
        kn, ft = j['knee' + side], j['foot' + side]
        ft = (ft[0], min(ft[1], feet[1]))
        R.capsule(f.L, (hpx, hpy + 1), kn, 7.4 * K, t)
        R.capsule(f.L, kn, (ft[0], ft[1] - 2 * K), 6.4 * K, t)
        box(f, ft[0] - int(3 * K), ft[1] - int(K), ft[0] + int(3 * K), ft[1], t)

    arm('B', 1)
    leg('B', 1)
    mx, my = (cx + hpx) / 2, (cy + hpy) / 2
    body = f.part('body', 'en_ochre', 1)
    R.ellipse(f.L, mx, my - 1 * K, 8.6 * K, 9 * K, body)
    R.ellipse(f.L, cx, cy + 1 * K, 8 * K, 4.6 * K, body)
    leg('F', 0)
    chip = f.part('chip', 'en_ochre', 2)
    for dx, dy, r in ((-5, 3, 2.6), (4, -4, 2.2), (-2, -7, 1.8), (6, 4, 2.0)):
        R.ellipse(f.L, mx + dx * K, my + dy * K, r * K, r * K * 0.85, chip)
    crack = part1(f, 'crack', P.RAMPS['fx_fire'][2])
    hot = part1(f, 'crack_hot', P.RAMPS['fx_fire'][3 if glow else 2])
    px0, py0 = int(mx - 2 * K), int(my - 6 * K)
    path = ((0, 0), (1, 1), (1, 2), (0, 3), (-1, 4), (-1, 5), (0, 6), (1, 7), (2, 8))
    for dx, dy in path:
        R.fill_rect(f.L, px0 + int(dx * K), py0 + int(dy * K), 2, 3, crack if (dx + dy) % 3 else hot)
    for dx, dy in ((5, 3), (6, 3), (7, 4), (8, 4), (9, 5)):
        R.fill_rect(f.L, px0 + int(dx * K), py0 + int((dy + 2) * K), 2, 2, crack)
    if glow:                                         # Break: the cracks flare
        for dx, dy in ((-4, 2), (-5, 3), (4, 0), (5, 1)):
            R.fill_rect(f.L, px0 + int(dx * K), py0 + int((dy + 3) * K), 3, 3, hot)
    head = f.part('head', 'en_ochre')
    R.ellipse(f.L, hx + 3 * K, hy + 1 * K, 5.0 * K, 4.2 * K, head)
    brow = f.part('brow', 'en_ochre', 2)
    R.fill_rect(f.L, int(hx + 1 * K), int(hy - 1 * K), int(7 * K), int(1.4 * K), brow)
    eye = part1(f, 'eye', P.RAMPS['ink'][0] if pose.get('dead') else P.RAMPS['fx_fire'][3])
    R.fill_rect(f.L, int(hx + 4 * K), int(hy), int(1.6 * K), int(1.3 * K), eye)
    R.fill_rect(f.L, int(hx + 6.4 * K), int(hy), int(1.6 * K), int(1.3 * K), eye)
    arm('F', 0)
    return finish(f)


def gp(**kw):
    p = human_pose(armF=(8, 8), armB=(-8, 8), legF=(6, 4), legB=(-6, 2))
    p.update(kw)
    return p


def _poses():
    A_ = {}
    A_['idle'] = [gp(chest=(0, b), armF=(26 + s, 12), armB=(-16 - s, 12), tilt=2)
                  for b, s in zip([0, 0, 0.5, 0.5], [0, 2, 3, 1])]
    th = [14, 7, -4, -12, -5, 8]
    kn = [4, 3, 6, 12, 28, 18]
    A_['walk'] = [gp(hipOffset=(0, [0, 0.6, 0, 0, 0.6, 0][i]), legF=(th[i], kn[i]),
                     legB=(th[(i + 3) % 6], kn[(i + 3) % 6]), armF=(-th[i] * 0.8 + 10, 14),
                     armB=(th[i] * 0.8 - 6, 12), tilt=3) for i in range(6)]
    A_['turn'] = [gp(tilt=0, armF=(10, 10), armB=(-10, 10)), gp(tilt=-3, chest=(0, 0.5), armF=(4, 8), armB=(-4, 8)),
                  gp(tilt=0, armF=(18, 10), armB=(-14, 10))]
    A_['atk_fist_slam'] = [
        gp(tilt=-8, armF=(-140, 30), armB=(-150, 30)),
        gp(tilt=-16, hipOffset=(-1, 0), armF=(-175, 10), armB=(-175, 10), legF=(10, 6)),
        gp(tilt=34, hipOffset=(6, 2), armF=(78, 0), armB=(70, 0), legF=(40, 36), legB=(-24, 8), lean=1, glow=1),
        gp(tilt=30, hipOffset=(5, 2), armF=(72, 0), armB=(66, 0), legF=(38, 34), legB=(-24, 8)),
        gp(tilt=10, hipOffset=(1, 1), armF=(30, 20), armB=(24, 20)),
    ]
    A_['atk_shoulder_ram'] = [
        gp(tilt=-6, hipOffset=(-1, 1), armF=(-60, 50), armB=(-80, 40), legF=(20, 18), legB=(-12, 8)),
        gp(tilt=-12, hipOffset=(-2, 1), armF=(-80, 60), armB=(-100, 50), legF=(24, 26), legB=(-16, 12)),
        gp(tilt=42, hipOffset=(5, 1), armF=(-70, 60), armB=(-90, 60), legF=(44, 40), legB=(-34, 10)),
        gp(tilt=44, hipOffset=(6, 1), armF=(-80, 60), armB=(-100, 60), legF=(-10, 6), legB=(36, 40)),
        gp(tilt=34, hipOffset=(4, 1), armF=(-40, 50), armB=(-60, 50), legF=(26, 20), legB=(-20, 8)),
        gp(tilt=8, armF=(20, 20), armB=(10, 20)),
    ]
    A_['atk_leap_slam'] = [
        gp(tilt=-6, hipOffset=(-1, 1), armF=(-30, 60), armB=(-40, 60), legF=(24, 40), legB=(-20, 40)),
        gp(tilt=-10, hipOffset=(-1, 2), armF=(-50, 70), armB=(-60, 70), legF=(34, 60), legB=(-30, 60)),
        gp(tilt=8, hipOffset=(0, -3), armF=(-150, 20), armB=(-160, 20), legF=(40, 50), legB=(-10, 40)),       # rising
        gp(tilt=24, hipOffset=(2, -3), armF=(60, 10), armB=(50, 10), legF=(10, 6), legB=(-16, 6)),            # falling
        gp(tilt=30, hipOffset=(3, 3), armF=(80, 0), armB=(76, 0), legF=(40, 36), legB=(-26, 8), glow=1),
        gp(tilt=8, armF=(30, 20), armB=(24, 20)),
    ]
    A_['atk_rock_rain'] = [
        gp(tilt=-4, armF=(-100, 40), armB=(-110, 40)),
        gp(tilt=-10, hipOffset=(0, -1), armF=(-170, 10), armB=(-175, 10), glow=1),
        gp(tilt=-4, hipOffset=(0, -1), armF=(-178, 0), armB=(-178, 0), glow=1, chest=(0, -1)),
        gp(tilt=6, armF=(-120, 20), armB=(-130, 20)),
        gp(tilt=2, armF=(10, 14), armB=(-6, 14)),
    ]
    A_['hurt'] = [gp(tilt=-12, hipOffset=(-1, 0), armF=(-30, 30), armB=(-50, 30))]
    A_['stagger'] = [gp(tilt=-8, hipOffset=(-1, 1), armF=(-20, 40), armB=(-40, 30)),
                     gp(tilt=6, hipOffset=(1, 1), armF=(20, 30), armB=(-10, 30))]
    A_['intro'] = [
        gp(tilt=6, chest=(0, 2), armF=(0, 10), armB=(0, 10), glow=0),
        gp(tilt=4, chest=(0, 1), armF=(10, 20), armB=(-10, 20)),
        gp(tilt=-6, armF=(-90, 40), armB=(-100, 40)),
        gp(tilt=-16, hipOffset=(-1, 0), armF=(-170, 10), armB=(-170, 10), glow=1),
        gp(tilt=14, hipOffset=(2, 1), armF=(60, 10), armB=(56, 10), legF=(22, 16), legB=(-14, 6), glow=1),
        gp(tilt=2, armF=(26, 12), armB=(-16, 12)),
    ]
    sit = dict(tilt=-30, hipOffset=(-2, 5), armF=(-60, 20), armB=(-80, 10), legF=(70, 20), legB=(60, 10), glow=1)
    A_['break'] = [gp(**dict(sit, tilt=-14, hipOffset=(-1, 3))), gp(**sit), gp(**dict(sit, chest=(0, 0.6)))]
    A_['transition'] = [gp(tilt=t, armF=(a, 20), armB=(-a, 20), glow=g)
                        for t, a, g in ((0, 20, 0), (-4, -30, 1), (-10, -100, 1), (-12, -160, 1), (4, 40, 1),
                                        (0, 26, 0))]
    d = [downed(0), downed(1), downed(2), downed(3)]
    A_['death'] = [gp(tilt=-12, armF=(-30, 30), armB=(-50, 30)), d[0], gp(**sit), d[1], d[1], d[2], d[2],
                   dict(d[3]), dict(d[3])]
    for p in A_['death']:
        p['glow'] = 1
    return A_


def _anim(key, n):
    if key.startswith('atk_'):
        last = n - 1
        if key in ('atk_shoulder_ram',):
            act = {'phase': 'act', 'frames': [2, 3], 'loopFps': 12}
        elif key == 'atk_leap_slam':
            act = {'phase': 'act', 'frames': [2, 3], 'byVy': True}
        else:
            act = {'phase': 'act', 'frames': [2]}
        return A.anim(key, ATLAS, n, 'phase', segments=[{'phase': 'tele', 'frames': [0, 1]}, act,
                                                      {'phase': 'rec', 'frames': [last - 1, last]}])
    if key in ('intro', 'transition'):
        return A.anim(key, ATLAS, n, 'phase', segments=[{'phase': 'all', 'frames': list(range(n))}])
    if key == 'break':
        return A.anim(key, ATLAS, n, 'phase', segments=[{'phase': 'all', 'frames': [0]},
                                                      {'phase': 'all', 'frames': [1, 2], 'loopFps': 4}])
    mode, fps = {'idle': ('loop', 6), 'walk': ('speed', None), 'hurt': ('once', None), 'stagger': ('loop', 8),
                 'death': ('once', 6), 'turn': ('once', 3)}[key]
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
    bg = tuple(P.RAMPS['mt_bg1'][1])
    w, h = HURTBOX['stone_colossus']
    hurt = (0, -h / 2, w, h)
    rows = []
    for ad in anims:
        atk = ATTACK_BOX['stone_colossus'].get(ad['key'][4:]) if ad['key'].startswith('atk_') else None
        act = ad['segments'][1]['frames'] if atk else []
        imgs = [V.overlay(frames[fn], ANCHOR, hurt, atk if i in act else None, scale=2)
                for i, fn in enumerate(ad['frames'])]
        rows.append((f"{ad['key']} ({len(imgs)}, {ad['mode']})", imgs))
        V.preview_gif(os.path.join(preview, f"{ATLAS}__{ad['key']}.gif"),
                      [V.overlay(frames[fn], ANCHOR) for fn in ad['frames']], ad.get('fps') or 6, bg)
    V.preview_sheet(os.path.join(preview, f'{ATLAS}_sheet.png'), rows, bg, label_w=200)
    return anims
