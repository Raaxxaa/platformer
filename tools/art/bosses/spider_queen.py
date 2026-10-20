"""Spider Queen (08 §7.4) and the Spiderling (08 §4.1, 04 §10.3).
Atlas `boss_spider_queen`, 192 × 112, anchor (96, 110). Spiderling frames 40 × 32, anchor (20, 30), in `enemies_extra`."""
from PIL import ImageOps

from .. import atlas as A
from .. import palette as P
from ..enemies.plains import on_ground
from ..enemies.swamps import draw_spider, sp, STAND, FAR, spider_anims

ATLAS = 'boss_spider_queen'
SIZE, ANCHOR = (192, 112), (96, 110)
RAMPS = ['ink', 'white', 'en_violet', 'en_red', 'en_glow', 'en_bone']
K = 2.3
SL_SIZE, SL_ANCHOR, SL_K = (40, 32), (20, 30), 0.5
SL_RAMPS = ['ink', 'white', 'en_violet', 'en_red', 'en_bone']


def draw(pose):
    return draw_spider(pose, SIZE, (ANCHOR[0], ANCHOR[1] - 2), K=K)


def _poses():
    base = spider_anims(hang_frames=False)
    A_ = {}
    A_['idle'] = base['idle']
    A_['walk'] = base['walk']
    A_['hurt'] = base['hurt']
    A_['stagger'] = base['stagger']
    A_['atk_fang_strike'] = [dict(p, mouth=min(3, p.get('mouth', 0) + 1)) for p in base['atk_bite']]
    A_['atk_pounce'] = base['atk_pounce']
    up = [(-12, -9), (-5, -12), (7, -12), (14, -8)]
    rear_front = [(-14, 0), (-7, 0), (6, -14), (13, -18)]
    A_['atk_ceiling_drop'] = [
        sp(body=(0, 2), near=[(-16, 0), (-9, 0), (4, 0), (12, 0)], far=[(-14, 0), (-6, 0), (6, 0), (14, 0)]),
        sp(body=(0, 3), mouth=1, near=[(-14, 0), (-8, 0), (5, 0), (11, 0)]),
        sp(body=(0, 3), mouth=3, near=[(-18, 0), (-10, 0), (8, 0), (17, 0)], far=[(-16, 0), (-7, 0), (10, 0), (19, 0)]),
        sp(body=(0, 2), mouth=1),
        sp(),
    ]
    A_['atk_venom_spit'] = [
        sp(body=(-1, 1), near=rear_front, far=[(x + 1, y) for x, y in rear_front], headDy=-1),
        sp(body=(-2, 0), near=[(-14, 0), (-7, 0), (6, -18), (13, -22)], far=rear_front, headDy=-3, mouth=1),
        sp(body=(-2, 0), near=[(-14, 0), (-7, 0), (7, -16), (14, -20)], far=rear_front, headDy=-3, mouth=3),
        sp(body=(-1, 1), near=rear_front, headDy=-1, mouth=2),
        sp(),
    ]
    A_['atk_brood'] = [
        sp(body=(0, 1), near=rear_front, far=rear_front, headDy=-1),
        sp(body=(0, 0), near=[(-14, 0), (-7, 0), (4, -20), (11, -22)], far=[(-12, 0), (-5, 0), (8, -20), (15, -22)],
           headDy=-3, mouth=1),
        sp(body=(0, 0), near=[(-14, 0), (-7, 0), (6, -22), (14, -20)], far=[(-12, 0), (-5, 0), (6, -20), (12, -22)],
           headDy=-3, mouth=3),
        sp(body=(0, 1), near=rear_front, far=rear_front, headDy=-1, mouth=1),
        sp(),
    ]
    A_['climb'] = [sp(body=(0, -3), near=[(-12, -6), (-5, -14), (7, -10), (14, -16)],
                      far=[(-10, -12), (-3, -8), (9, -16), (16, -10)]),
                   sp(body=(0, -3), near=[(-12, -12), (-5, -8), (7, -16), (14, -10)],
                      far=[(-10, -6), (-3, -14), (9, -10), (16, -16)])]
    A_['fall'] = [sp(body=(0, -2), mouth=2, near=[(-14, -14), (-8, -18), (5, -18), (12, -14)],
                     far=[(-12, -13), (-6, -17), (7, -17), (14, -13)])]
    A_['intro'] = [
        sp(body=(0, 3), near=[(-12, 0), (-6, 0), (4, 0), (10, 0)], far=[(-10, 0), (-3, 0), (6, 0), (12, 0)]),
        sp(body=(0, 1), near=[(-14, 0), (-7, 0), (6, -8), (13, -10)], far=FAR, headDy=-1),
        sp(body=(0, 0), near=rear_front, far=rear_front, headDy=-2, mouth=1),
        sp(body=(0, 0), near=[(-14, 0), (-7, 0), (7, -20), (14, -24)], far=rear_front, headDy=-3, mouth=3),
        sp(body=(0, 0), near=[(-14, 0), (-7, 0), (8, -22), (15, -22)], far=[(x, y) for x, y in rear_front],
           headDy=-3, mouth=3),
        sp(body=(0, 1), mouth=1),
    ]
    curl = [(-8, -4), (-4, -6), (4, -6), (8, -4)]
    A_['break'] = [sp(body=(0, 2), near=[(-12, -2), (-6, -2), (5, -2), (11, -2)], far=[(-10, -2), (-4, -2), (7, -2),
                                                                                       (13, -2)], mouth=2),
                   sp(body=(0, 3), near=curl, far=[(x + 1, y) for x, y in curl], kneeLift=-3, mouth=1),
                   sp(body=(0, 3), near=[(x, y - 1) for x, y in curl], far=curl, kneeLift=-2, mouth=2)]
    A_['transition'] = [sp(body=(0, 1), mouth=m, headDy=h, near=n, far=n) for m, h, n in (
        (1, 0, STAND), (2, -1, [(-14, 0), (-7, 0), (6, -8), (13, -12)]), (3, -3, rear_front),
        (3, -3, [(-14, 0), (-7, 0), (8, -22), (16, -22)]), (2, -1, rear_front), (1, 0, STAND))]
    A_['death'] = [
        base['hurt'][0],
        sp(body=(-1, 1), mouth=2, near=[(-14, -1), (-8, -1), (4, -2), (12, -2)]),
        sp(body=(0, 2), near=curl, far=curl, kneeLift=-3),
        sp(body=(0, 3), near=[(-7, -6), (-3, -8), (3, -8), (7, -6)], far=curl, kneeLift=-3, dead=True),
        sp(body=(0, 3), near=[(-6, -7), (-3, -9), (3, -9), (6, -7)], far=curl, kneeLift=-3, dead=True),
        sp(body=(0, 3), near=[(-5, -8), (-2, -10), (2, -10), (5, -8)], far=curl, kneeLift=-3, dead=True),
        sp(body=(0, 3), near=[(-5, -8), (-2, -10), (2, -10), (5, -8)], far=curl, kneeLift=-3, dead=True),
        sp(body=(0, 3), near=[(-4, -9), (-2, -10), (2, -10), (4, -9)], far=curl, kneeLift=-3, dead=True),
        sp(body=(0, 3), near=[(-4, -9), (-2, -10), (2, -10), (4, -9)], far=curl, kneeLift=-3, dead=True),
    ]
    return A_


def _anim(key, n):
    if key.startswith('atk_'):
        last = n - 1
        act = ({'phase': 'act', 'frames': [2, 3], 'byVy': True} if key == 'atk_pounce'
               else {'phase': 'act', 'frames': [2]})
        return A.anim(key, ATLAS, n, 'phase', segments=[{'phase': 'tele', 'frames': [0, 1]}, act,
                                                      {'phase': 'rec', 'frames': [last - 1, last]}])
    if key in ('intro', 'transition'):
        return A.anim(key, ATLAS, n, 'phase', segments=[{'phase': 'all', 'frames': list(range(n))}])
    if key == 'break':
        return A.anim(key, ATLAS, n, 'phase', segments=[{'phase': 'all', 'frames': [0]},
                                                      {'phase': 'all', 'frames': [1, 2], 'loopFps': 4}])
    mode, fps = {'idle': ('loop', 6), 'walk': ('speed', None), 'hurt': ('once', None), 'stagger': ('loop', 8),
                 'death': ('once', 6), 'climb': ('loop', 10), 'hang_top': ('once', None),
                 'fall': ('once', None)}[key]
    return A.anim(key, ATLAS, n, mode, fps)


def build_frames():
    frames, anims = {}, []
    for key, poses in _poses().items():
        for i, pose in enumerate(poses):
            frames[f'{key}_{i:02d}'] = on_ground(draw(pose), ANCHOR[1])
        anims.append(_anim(key, len(poses)))
    # hang_top: the idle pose upside down against the ceiling (08 §7.4)
    flipped = ImageOps.flip(on_ground(draw(_poses()['idle'][0]), ANCHOR[1]))
    frames['hang_top_00'] = flipped
    anims.append(_anim('hang_top', 1))
    return frames, anims


# ---------------------------------------------------------------- Spiderling

def draw_spiderling(pose):
    return draw_spider(pose, SL_SIZE, (SL_ANCHOR[0], SL_ANCHOR[1] - 2), K=SL_K)


def spiderling_poses():
    base = spider_anims(hang_frames=False)
    A_ = {k: base[k] for k in ('idle', 'walk', 'hurt', 'stagger', 'knockdown', 'death')}
    A_['atk_bite'] = base['atk_bite']
    return A_


SL_MODE = {'idle': ('loop', 6), 'walk': ('speed', None), 'hurt': ('once', None), 'stagger': ('loop', 8),
           'knockdown': ('once', 10), 'death': ('once', 10)}


def spiderling_frames():
    """Frames and anims of the Spiderling (atlas `enemies_extra`)."""
    frames, anims = {}, []
    for anim, poses in spiderling_poses().items():
        for i, pose in enumerate(poses):
            frames[f'spiderling_{anim}_{i:02d}'] = on_ground(draw_spiderling(pose), SL_ANCHOR[1])
        key = f'spiderling_{anim}'
        if anim.startswith('atk_'):
            anims.append(A.anim(key, 'enemies_extra', len(poses), 'phase', segments=[
                {'phase': 'tele', 'frames': [0, 1]}, {'phase': 'act', 'frames': [2]},
                {'phase': 'rec', 'frames': [len(poses) - 2, len(poses) - 1]}]))
        else:
            mode, fps = SL_MODE[anim]
            anims.append(A.anim(key, 'enemies_extra', len(poses), mode, fps))
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
    bg = tuple(P.RAMPS['sw_bg0'][1])
    w, h = HURTBOX['spider_queen']
    hurt = (0, -h / 2, w, h)
    rows = []
    for ad in anims:
        atk = ATTACK_BOX['spider_queen'].get(ad['key'][4:]) if ad['key'].startswith('atk_') else None
        act = ad['segments'][1]['frames'] if atk else []
        imgs = [V.overlay(frames[fn], ANCHOR, hurt, atk if i in act else None, scale=2)
                for i, fn in enumerate(ad['frames'])]
        rows.append((f"{ad['key']} ({len(imgs)}, {ad['mode']})", imgs))
        V.preview_gif(os.path.join(preview, f"{ATLAS}__{ad['key']}.gif"),
                      [V.overlay(frames[fn], ANCHOR) for fn in ad['frames']], ad.get('fps') or 6, bg)
    V.preview_sheet(os.path.join(preview, f'{ATLAS}_sheet.png'), rows, bg, label_w=200)
    return anims
