"""Stage 4 (King's Castle) enemies (08 §7.3): royal_guard, gargoyle, castle_mage, living_armor, royal_executioner."""
import math

from .. import palette as P
from .. import raster as R
from .armored import L_SMALL, draw_armored, gp, damage_set
from .common34 import build_enemy_atlas
from .plains import Fig, finish, human_walk, downed, box

ATLAS = 'enemies_castle'
ENEMIES = ['royal_guard', 'gargoyle', 'castle_mage', 'living_armor', 'royal_executioner']
L_GUARD = {'hip': 13, 'torso': 9, 'head': 5, 'upper': 5, 'fore': 5, 'thigh': 6.5, 'shin': 6.5}
L_EXEC = {'hip': 16, 'torso': 12, 'head': 6, 'upper': 7.5, 'fore': 7.5, 'thigh': 8.5, 'shin': 8.5}

CFG = {
    'royal_guard': dict(L=L_GUARD, torso=10, limb=3.2, thigh=4.2, head=(3.9, 4.2), plate='en_gold', cloth='en_red', emblem='en_gold',
                        plume='en_red', boots='en_gold', weapon='polearm', wlen=50, big=False, beltc='en_red'),
    'castle_mage': dict(L=L_SMALL, torso=8, limb=3, thigh=4, head=(3.7, 4.0), plate='en_red', robe='en_red', trim='en_gold',
                        hood='en_red', weapon='staff', orb='en_ghost', wlen=22, big=False, glove='skin'),
    'living_armor': dict(L=L_SMALL, torso=9, limb=3.2, thigh=4.2, head=(3.7, 4.0), plate='en_steel', eyes=P.RAMPS['en_ghost'][2],
                         boots='en_steel', weapon='sword', wlen=12, bw=2.8, bramp='gray', hilt='en_steel', big=False,
                         beltc='en_black', glove='en_ghost'),
    'royal_executioner': dict(L=L_EXEC, torso=15, limb=5, thigh=6, head=(4.8, 5.2), plate='en_steel', cloth='en_red', hood='en_black',
                              weapon='axe', wlen=34, big=True, beltc='en_black', boots='en_black', glove='en_black'),
}


def frame_size(enemy, anim):
    if enemy == 'royal_guard':
        return (176, 64), (88, 62)
    if enemy == 'royal_executioner':
        return (128, 96), (64, 94)
    if anim.startswith('atk_'):
        return (96, 48), (48, 46)
    return (48, 48), (24, 46)


# ---------------------------------------------------------------- gargoyle

def draw_gargoyle(pose, size, feet):
    f = Fig(*size)
    stone = pose.get('stone', False)
    ramp = 'gray' if stone else 'en_verdigris'
    cx, cy = feet[0] + pose.get('dx', 0), feet[1] - 12 + pose.get('dy', 0)
    wa = math.radians(pose.get('wing', 40))
    dead = pose.get('dead')
    if dead:                                                  # shattered into lumps on the floor
        for k, (ox, oy, rx, ry) in enumerate(((-6, 0, 5, 3), (3, 1, 6, 3), (10, -2, 3, 2), (-1, -3, 4, 2.6))):
            R.ellipse(f.L, feet[0] + ox, feet[1] - 3 + oy + pose.get('sink', 0), rx, ry, f.part(f'lump{k}', ramp, k % 2))
        R.fill_polygon(f.L, [(feet[0] + 2, feet[1] - 8), (feet[0] + 7, feet[1] - 5), (feet[0] + 1, feet[1] - 5)], f.part('horn', ramp, 2))
        return finish(f)
    for side, shade in ((-1, 1), (1, 0)):                     # far wing first, near wing over the body later
        pass
    def wing(shade, dx):
        base = (cx - 2 + dx, cy - 5)
        tip = (base[0] - 11 * math.cos(wa), base[1] - 11 * math.sin(wa))
        tip2 = (tip[0] - 4, tip[1] + 6 + 4 * math.sin(wa))
        R.fill_polygon(f.L, [base, tip, tip2, (base[0] - 6, base[1] + 6), (base[0] - 1, base[1] + 6)], f.part(f'wing{dx}', ramp, shade))
        R.line(f.L, (int(base[0]), int(base[1])), (int(tip[0]), int(tip[1])), f.part(f'wbone{dx}', ramp, 2))
    wing(1, 2)
    tail = f.part('tail', ramp, 1)
    R.capsule(f.L, (int(cx - 5), int(cy + 4)), (int(cx - 11), int(cy + 8 + pose.get('tail', 0))), 2.4, tail)
    body = f.part('body', ramp)
    R.ellipse(f.L, cx, cy, 7, 8.5, body)
    R.ellipse(f.L, cx + 1, cy + 4, 5, 4, f.part('belly', ramp, -1))
    for lx in (-3, 3):                                        # legs and claws
        ext = pose.get('claws', 0)
        R.capsule(f.L, (int(cx + lx), int(cy + 6)), (int(cx + lx + ext), int(cy + 11 + (0 if ext else 1))), 2.4, f.part(f'leg{lx}', ramp, 1 if lx < 0 else 0))
    hx, hy = cx + 5, cy - 8 + pose.get('hy', 0)
    R.ellipse(f.L, hx, hy, 4.6, 4.2, f.part('head', ramp))
    R.fill_polygon(f.L, [(hx + 3, hy - 1), (hx + 8, hy + 1), (hx + 3, hy + 3)], f.part('snout', ramp, 1))
    for hxo in (-2, 1):
        R.fill_polygon(f.L, [(hx + hxo, hy - 3), (hx + hxo - 1, hy - 8), (hx + hxo + 2, hy - 3)], f.part('horn', ramp, 2))
    if not stone:
        box(f, int(hx + 2), int(hy - 1), int(hx + 3), int(hy - 1), f.part('eye', 'white'))
    else:
        box(f, int(hx + 2), int(hy - 1), int(hx + 2), int(hy - 1), f.part('eye', 'ink'))
    if pose.get('cracks'):
        ck = f.part('crack', 'ink')
        for (dx, dy) in ((0, -3), (1, -2), (1, -1), (0, 0), (-1, 1), (-1, 2), (0, 3)):
            box(f, int(cx + dx), int(cy + dy), int(cx + dx), int(cy + dy), ck)
        box(f, int(hx), int(hy - 3), int(hx), int(hy - 2), ck)
    wing(0, 0)
    return finish(f)


def gargoyle_anims():
    fly = [dict(wing=w, dy=d) for w, d in zip((50, 20, -20, 20), (-1, 0, 1, 0))]
    A_ = {'fly': fly,
          'stone': [dict(stone=True, wing=75, dy=3, tail=0, hy=1)],
          'wake': [dict(stone=True, wing=70, dy=2, cracks=True), dict(wing=60, dy=1, cracks=True), dict(wing=55, dy=0)],
          'atk_swoop': [dict(wing=75, dy=-1, claws=0), dict(wing=85, dy=-3, hy=1), dict(wing=-10, dy=3, claws=5, hy=2),
                        dict(wing=-20, dy=4, claws=6, hy=2), dict(wing=40, dy=0), dict(wing=45, dy=0)],
          'hurt': [dict(wing=70, dx=-1, hy=-1, dy=1)],
          'stagger': [dict(wing=65, dx=-1, dy=1), dict(wing=30, dx=1, dy=2)],
          'knockdown': [dict(wing=60, dy=6, dx=-2), dict(wing=70, dy=14, dx=-2)],
          'death': [dict(wing=60, dy=6), dict(wing=70, dy=12, dead=True, sink=4), dict(dead=True, sink=2), dict(dead=True)]}
    return A_


# ---------------------------------------------------------------- tables

def guard_anims():
    ph = {'ang': 176, 'len': 50}
    A_ = {}
    A_['idle'] = [gp(chest=(0, b), armF=(8 + s, 30), armB=(14, 40), weapon=ph) for b, s in zip([0, 0, 1, 1], [0, 1, 2, 1])]
    A_['walk'] = [dict(p, armF=(12, 30), armB=(16, 40), weapon=ph) for p in human_walk()]
    A_['atk_halberd_thrust'] = [
        gp(tilt=-4, armF=(40, 70), armB=(30, 80), weapon={'ang': 100, 'len': 52}),
        gp(tilt=-10, hipOffset=(-1, 1), armF=(10, 110), armB=(0, 120), legF=(16, 20), legB=(-12, 12), weapon={'ang': 92, 'len': 52}),
        gp(tilt=14, hipOffset=(5, 1), armF=(92, 0), armB=(80, 10), legF=(38, 30), legB=(-30, 0), weapon={'ang': 90, 'len': 60}),
        gp(tilt=10, hipOffset=(4, 1), armF=(88, 0), armB=(78, 10), legF=(32, 24), legB=(-26, 2), weapon={'ang': 90, 'len': 58}),
        gp(tilt=3, armF=(40, 40), armB=(30, 60), weapon={'ang': 120, 'len': 50})]
    A_['atk_halberd_sweep'] = [
        gp(tilt=-6, armF=(-30, 60), armB=(-40, 70), weapon={'ang': -135, 'len': 50}),
        gp(tilt=-12, hipOffset=(-1, 0), armF=(-70, 60), armB=(-80, 60), legF=(14, 8), weapon={'ang': -150, 'len': 50}),
        gp(tilt=12, hipOffset=(4, 1), armF=(90, 10), armB=(80, 20), legF=(34, 26), legB=(-24, 4), weapon={'ang': 63, 'len': 52}),
        gp(tilt=14, hipOffset=(4, 1), armF=(70, 20), armB=(60, 30), legF=(30, 20), legB=(-22, 4), weapon={'ang': 45, 'len': 52}),
        gp(tilt=4, armF=(40, 40), armB=(30, 60), weapon={'ang': 100, 'len': 50})]
    A_.update(damage_set(ph))
    return A_


def mage_anims():
    held = {'ang': 172, 'len': 22}
    base = dict(armF=(24, 40), armB=(-6, 14))
    A_ = {}
    A_['idle'] = [gp(chest=(0, b), sway=s, weapon=dict(held, glow=g), **base) for b, s, g in
                  zip([0, 0, 1, 1], [0, 1, 0, -1], [0, 1, 1, 0])]
    A_['walk'] = [dict(p, armF=(30, 40), sway=[0, 1, 1, 0, -1, -1][i], hemLift=[0, 0, 1, 0, 0, 1][i], weapon=held)
                  for i, p in enumerate(human_walk())]
    A_['channel'] = [gp(tilt=-2, armF=(10, 150), armB=(-30, 120), weapon={'ang': 180, 'len': 22, 'glow': g}, hemLift=1) for g in (2, 3)]
    A_['atk_ward'] = [gp(tilt=-2, armF=(60, 70), weapon={'ang': 150, 'len': 22, 'glow': 1}, armB=(-6, 14)),
                      gp(tilt=-6, armF=(10, 150), legF=(10, 6), weapon={'ang': 176, 'len': 22, 'glow': 2}, armB=(-20, 60)),
                      gp(tilt=-2, armF=(10, 160), hipOffset=(0, -1), weapon={'ang': 180, 'len': 22, 'glow': 3}, hemLift=1, armB=(-30, 100)),
                      gp(tilt=0, armF=(24, 100), weapon={'ang': 176, 'len': 22, 'glow': 2}, armB=(-6, 14)),
                      gp(armF=(24, 50), weapon=dict(held, glow=1), armB=(-6, 14))]
    A_['atk_arcane_bolts'] = [
        gp(tilt=-4, armF=(50, 40), weapon={'ang': 120, 'len': 22, 'glow': 1}, armB=(-6, 14)),
        gp(tilt=-10, hipOffset=(-1, 0), armF=(70, 30), weapon={'ang': 100, 'len': 22, 'glow': 2}, armB=(-6, 14)),
        gp(tilt=6, hipOffset=(2, 0), armF=(88, 2), legF=(18, 8), legB=(-12, 4), weapon={'ang': 94, 'len': 22, 'glow': 3}, armB=(-6, 14)),
        gp(tilt=2, armF=(80, 10), weapon={'ang': 100, 'len': 22, 'glow': 1}, armB=(-6, 14)),
        gp(armF=(40, 40), weapon=dict(held, glow=1), armB=(-6, 14))]
    A_.update(damage_set(held))
    return A_


def armor_anims():
    sw = {'ang': 150, 'len': 12}
    A_ = {}
    A_['idle'] = [gp(chest=(0, b), armF=(12 + s, 22), weapon=sw) for b, s in zip([0, 0, 1, 1], [0, 2, 3, 1])]
    A_['walk'] = [dict(p, armF=(p['armF'][0] + 4, 22), weapon=sw) for p in human_walk()]
    A_['atk_sword_slash'] = [
        gp(tilt=-6, armF=(-40, 30), weapon={'ang': -150, 'len': 12}),
        gp(tilt=-10, hipOffset=(-1, 0), armF=(-150, 20), legF=(14, 6), weapon={'ang': -170, 'len': 12}),
        gp(tilt=16, hipOffset=(5, 1), armF=(95, 0), armB=(-30, 40), legF=(36, 30), legB=(-26, 4), weapon={'ang': 100, 'len': 15}),
        gp(tilt=12, hipOffset=(2, 1), armF=(60, 20), legF=(28, 22), legB=(-20, 4), weapon={'ang': 120, 'len': 12}),
        gp(tilt=4, armF=(30, 40), weapon=sw)]
    A_['atk_overhead_chop'] = [
        gp(tilt=-4, armF=(120, 30), weapon={'ang': 150, 'len': 12}),
        gp(tilt=-12, hipOffset=(-1, 0), armF=(176, 0), legF=(12, 6), weapon={'ang': 180, 'len': 12}),
        gp(tilt=18, hipOffset=(5, 2), armF=(60, 10), legF=(34, 26), legB=(-22, 6), weapon={'ang': 45, 'len': 15}),
        gp(tilt=16, hipOffset=(4, 2), armF=(50, 10), legF=(32, 24), legB=(-20, 6), weapon={'ang': 30, 'len': 15}),
        gp(tilt=4, armF=(30, 40), weapon=sw)]
    collapse = [downed(0), downed(1), downed(2), {'pile': True}]
    A_['collapse'] = collapse
    A_['pile'] = [{'pile': True}]
    A_['rise'] = [{'pile': True}, downed(2), downed(1), gp(tilt=-14, hipOffset=(-1, 0), armF=(-40, 40), weapon=sw)]
    A_.update(damage_set(sw))
    A_['death'] = [downed(0), downed(1), downed(2), {'pile': True}]
    return A_


def exec_anims():
    ax = {'ang': 172, 'len': 34}
    A_ = {}
    A_['idle'] = [gp(chest=(0, b), armF=(14 + s, 24), armB=(20, 30), weapon=ax) for b, s in zip([0, 0, 1, 1], [0, 2, 3, 1])]
    A_['walk'] = [dict(p, armF=(p['armF'][0] + 6, 24), armB=(20, 30), weapon=ax) for p in human_walk()]
    A_['atk_overhead_chop'] = [
        gp(tilt=-6, armF=(130, 30), armB=(120, 30), weapon={'ang': 150, 'len': 34}),
        gp(tilt=-14, hipOffset=(-1, 0), armF=(176, 0), armB=(170, 0), legF=(12, 6), weapon={'ang': 180, 'len': 34}),
        gp(tilt=20, hipOffset=(5, 2), armF=(70, 10), armB=(60, 10), legF=(34, 26), legB=(-22, 6), weapon={'ang': 55, 'len': 34}),
        gp(tilt=18, hipOffset=(5, 2), armF=(60, 10), armB=(50, 10), legF=(32, 24), legB=(-20, 6), weapon={'ang': 40, 'len': 34}),
        gp(tilt=4, armF=(30, 40), weapon=ax)]
    A_['atk_whirling_axe'] = [
        gp(tilt=-4, armF=(-40, 60), armB=(-50, 60), weapon={'ang': -135, 'len': 34}),
        gp(tilt=-8, armF=(-80, 40), armB=(-90, 40), legF=(14, 6), weapon={'ang': -90, 'len': 34}),
        gp(tilt=6, armF=(90, 0), armB=(80, 0), legF=(24, 10), legB=(-20, 6), weapon={'ang': 90, 'len': 34}),
        gp(tilt=6, armF=(40, 0), armB=(30, 0), legF=(20, 10), legB=(-24, 6), weapon={'ang': 45, 'len': 34}),
        gp(tilt=6, armF=(-90, 0), armB=(-80, 0), legF=(16, 10), legB=(-22, 6), weapon={'ang': -90, 'len': 34}),
        gp(tilt=6, armF=(-40, 0), armB=(-30, 0), legF=(22, 10), legB=(-18, 6), weapon={'ang': -45, 'len': 34}),
        gp(tilt=8, armF=(40, 30), weapon={'ang': 120, 'len': 34}),
        gp(tilt=2, armF=(30, 40), weapon=ax)]
    A_['atk_leap_chop'] = [
        gp(tilt=-4, hipOffset=(-1, 3), armF=(130, 30), armB=(120, 30), legF=(30, 50), legB=(-20, 40), weapon={'ang': 150, 'len': 34}),
        gp(tilt=-8, hipOffset=(-2, 5), armF=(176, 0), armB=(170, 0), legF=(40, 70), legB=(-26, 54), weapon={'ang': 180, 'len': 34}),
        gp(tilt=-6, hipOffset=(4, -4), armF=(176, 0), armB=(170, 0), legF=(-30, 40), legB=(-50, 30), weapon={'ang': 180, 'len': 34}),
        gp(tilt=14, hipOffset=(6, -2), armF=(110, 0), armB=(100, 0), legF=(50, 10), legB=(-20, 30), weapon={'ang': 70, 'len': 34}),
        gp(tilt=22, hipOffset=(7, 4), armF=(60, 0), armB=(50, 0), legF=(60, 70), legB=(30, 60), weapon={'ang': 40, 'len': 34}),
        gp(tilt=4, armF=(30, 40), weapon=ax)]
    A_.update(damage_set(ax))
    return A_


TABLES = {'royal_guard': guard_anims(), 'gargoyle': gargoyle_anims(), 'castle_mage': mage_anims(),
          'living_armor': armor_anims(), 'royal_executioner': exec_anims()}


def drawer(enemy, pose, size, feet):
    if enemy == 'gargoyle':
        return draw_gargoyle(pose, size, feet)
    return draw_armored(CFG[enemy], pose, size, feet)


def seg_overrides():
    return {
        ('gargoyle', 'atk_swoop'): [{'phase': 'tele', 'frames': [0, 1]}, {'phase': 'act', 'frames': [2, 3], 'loopFps': 12},
                                    {'phase': 'rec', 'frames': [4, 5]}],
        ('royal_executioner', 'atk_whirling_axe'): [{'phase': 'tele', 'frames': [0, 1]},
                                                    {'phase': 'act', 'frames': [2, 3, 4, 5], 'loopFps': 16},
                                                    {'phase': 'rec', 'frames': [6, 7]}],
        ('royal_executioner', 'atk_leap_chop'): [{'phase': 'tele', 'frames': [0, 1]},
                                                 {'phase': 'act', 'frames': [2, 3], 'byVy': True},
                                                 {'phase': 'rec', 'frames': [4, 5]}],
    }


def _build(assets, preview):
    anims, frames = build_enemy_atlas(ATLAS, ENEMIES, TABLES, drawer, frame_size, P.CASTLE_ENEMY_RAMPS, preview,
                                      tuple(P.RAMPS['cs_bg2'][1]), seg_overrides(), (), assets)
    return frames, anims


def build_frames():
    import tempfile
    return _build(None, tempfile.mkdtemp())


def build(assets, preview):
    return _build(assets, preview)[1]


def idle_key(enemy):
    return f'{enemy}_{"fly" if enemy == "gargoyle" else "idle"}_00'
