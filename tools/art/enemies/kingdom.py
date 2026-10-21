"""Stage 3 (Enemy Kingdom) enemies (08 §7.3): soldier, crossbowman, war_hound, battle_mage, knight."""
from .. import palette as P
from . import plains
from .armored import L_SMALL, draw_armored, gp, rest_idle, walk, damage_set
from .common34 import build_enemy_atlas
from .plains import human_pose, human_walk, downed

ATLAS = 'enemies_kingdom'
ENEMIES = ['soldier', 'crossbowman', 'war_hound', 'battle_mage', 'knight']
L_KNIGHT = {'hip': 15, 'torso': 11, 'head': 6, 'upper': 7, 'fore': 7, 'thigh': 8, 'shin': 8}

CFG = {
    'soldier': dict(L=L_SMALL, torso=9, limb=3, thigh=4, head=(3.7, 4.0), plate='en_steel', cloth='en_red', emblem='en_bone',
                    boots='en_black', weapon='sword', hilt='en_bone', wlen=10, shield='en_red', big=False, beltc='en_black'),
    'crossbowman': dict(L=L_SMALL, torso=8, limb=3, thigh=4, head=(3.7, 4.0), plate='en_steel', sleeve='en_red',
                        helm='en_red', visor=False, boots='en_black', weapon='crossbow', big=False, beltc='en_black'),
    'battle_mage': dict(L=L_SMALL, torso=8, limb=3, thigh=4, head=(3.7, 4.0), plate='en_red', robe='en_red', trim='fx_fire',
                        hood='en_red', hat=True, weapon='staff', orb='fx_fire', wlen=22, big=False, glove='skin'),
    'knight': dict(L=L_KNIGHT, torso=14, limb=4.6, thigh=5.4, head=(4.6, 5.0), plate='en_steel', cloth='en_red', emblem='en_bone',
                   plume='en_red', boots='en_black', weapon='sword', hilt='en_bone', wlen=16, bw=3.2, big=True, beltc='en_black'),
}


def frame_size(enemy, anim):
    if enemy == 'knight':
        return (128, 80), (64, 78)
    if anim.startswith('atk_'):
        return (96, 48), (48, 46)
    return (48, 48), (24, 46)


# ---------------------------------------------------------------- tables

def soldier_anims():
    sw = {'ang': 110, 'len': 10}
    up = dict(shield='up', armB=(40, 60))
    A_ = {}
    A_['idle'] = [gp(chest=(0, b), armF=(30 + s, 50), weapon=sw, **up) for b, s in zip([0, 0, 1, 1], [0, 2, 3, 1])]
    A_['walk'] = [dict(p, armF=(30, 50), armB=(40, 60), weapon=sw, shield='up') for p in human_walk()]
    A_['atk_sword_thrust'] = [
        gp(tilt=-6, armF=(-20, 120), weapon={'ang': 90, 'len': 10}, **up),
        gp(tilt=-10, hipOffset=(-1, 1), armF=(-40, 140), legF=(16, 20), legB=(-12, 12), weapon={'ang': 90, 'len': 10}, **up),
        gp(tilt=20, hipOffset=(5, 2), armF=(92, 0), armB=(-30, 20), legF=(40, 30), legB=(-34, 0),
           weapon={'ang': 90, 'len': 14}, shield='low'),
        gp(tilt=22, hipOffset=(5, 3), armF=(90, 0), armB=(-30, 20), legF=(44, 40), legB=(-38, 6),
           weapon={'ang': 90, 'len': 14}, shield='low'),
        gp(tilt=8, hipOffset=(2, 1), armF=(60, 30), weapon={'ang': 100, 'len': 10}, **up)]
    A_['atk_shield_bash'] = [
        gp(tilt=-4, armF=(30, 50), weapon=sw, shield='up', armB=(20, 90)),
        gp(tilt=-10, hipOffset=(-1, 1), armF=(30, 50), weapon=sw, shield='up', armB=(0, 120), legF=(14, 10)),
        gp(tilt=14, hipOffset=(4, 1), armF=(30, 50), weapon=sw, shield='bash', armB=(92, 0), legF=(34, 26), legB=(-24, 6)),
        gp(tilt=10, hipOffset=(3, 1), armF=(30, 50), weapon=sw, shield='bash', armB=(80, 10), legF=(28, 20), legB=(-20, 4)),
        gp(tilt=3, armF=(30, 50), weapon=sw, **up)]
    A_['guard_hit'] = [gp(tilt=-6, hipOffset=(-1, 0), armF=(30, 50), weapon=sw, shield='up', armB=(55, 55))]
    A_.update(damage_set(sw, shield='up'))
    return A_


def crossbowman_anims():
    held = {'ang': 90}
    A_ = {}
    A_['idle'] = [gp(chest=(0, b), armF=(70 + s, 30), armB=(60, 60), weapon=held) for b, s in zip([0, 0, 1, 1], [0, 2, 3, 1])]
    A_['atk_bolt'] = [
        gp(tilt=-2, armF=(60, 40), armB=(50, 60), weapon={'ang': 80}),
        gp(tilt=-4, armF=(88, 2), armB=(80, 20), legF=(14, 4), legB=(-10, 2), weapon={'ang': 90}),
        gp(tilt=-8, hipOffset=(-1, 0), armF=(90, 0), armB=(80, 20), legF=(14, 4), legB=(-10, 2), weapon={'ang': 96}),
        gp(tilt=-2, armF=(76, 20), armB=(60, 50), weapon={'ang': 88}),
        gp(armF=(50, 40), armB=(40, 60), weapon={'ang': 70})]
    A_['aim'] = [gp(tilt=-3, armF=(a, 2), armB=(a - 8, 20), legF=(14, 4), legB=(-10, 2), weapon={'ang': a})
                 for a in (45, 67, 90, 112, 135)]
    A_['atk_kick'] = [
        gp(tilt=-8, armF=(30, 40), armB=(10, 40), legF=(40, 80), weapon={'ang': 50}),
        gp(tilt=-14, hipOffset=(-1, 0), armF=(30, 40), armB=(10, 40), legF=(70, 110), legB=(-5, 0), weapon={'ang': 50}),
        gp(tilt=-6, hipOffset=(1, 0), armF=(30, 40), armB=(10, 40), legF=(86, 4), legB=(-5, 0), weapon={'ang': 50}),
        gp(tilt=-4, armF=(30, 40), legF=(50, 40), weapon={'ang': 50}),
        gp(armF=(40, 40), weapon=held)]
    A_.update(damage_set(held))
    return A_


def mage_anims():
    held = {'ang': 172, 'len': 22}
    base = dict(armF=(24, 40), armB=(-6, 14))
    A_ = {}
    A_['idle'] = [gp(chest=(0, b), sway=s, weapon=dict(held, glow=g), **base) for b, s, g in
                  zip([0, 0, 1, 1], [0, 1, 0, -1], [0, 1, 1, 0])]
    A_['walk'] = [dict(p, armF=(30, 40), sway=[0, 1, 1, 0, -1, -1][i], hemLift=[0, 0, 1, 0, 0, 1][i], weapon=held)
                  for i, p in enumerate(human_walk())]
    A_['atk_fireball'] = [
        gp(tilt=-4, armF=(50, 40), weapon={'ang': 120, 'len': 22, 'glow': 1}, armB=(-6, 14)),
        gp(tilt=-10, hipOffset=(-1, 0), armF=(70, 30), weapon={'ang': 100, 'len': 22, 'glow': 2}, armB=(-6, 14)),
        gp(tilt=6, hipOffset=(2, 0), armF=(88, 2), legF=(18, 8), legB=(-12, 4), weapon={'ang': 94, 'len': 22, 'glow': 3}, armB=(-6, 14)),
        gp(tilt=2, armF=(80, 10), weapon={'ang': 100, 'len': 22, 'glow': 1}, armB=(-6, 14)),
        gp(armF=(40, 40), weapon=dict(held, glow=1), armB=(-6, 14))]
    A_['atk_flame_burst'] = [
        gp(tilt=-4, armF=(-20, 120), weapon={'ang': 160, 'len': 22, 'glow': 1}, armB=(-6, 14)),
        gp(tilt=-12, hipOffset=(-1, 0), armF=(-60, 160), legF=(12, 6), weapon={'ang': -165, 'len': 22, 'glow': 2},
           hemLift=1, armB=(-6, 14)),
        gp(tilt=18, hipOffset=(5, 2), armF=(70, 10), legF=(34, 24), legB=(-22, 6), weapon={'ang': 40, 'len': 22, 'glow': 3},
           armB=(-6, 14)),
        gp(tilt=14, hipOffset=(4, 2), armF=(64, 10), legF=(30, 20), legB=(-20, 6), weapon={'ang': 36, 'len': 22, 'glow': 2},
           armB=(-6, 14)),
        gp(tilt=4, armF=(30, 40), weapon=dict(held, glow=1), armB=(-6, 14))]
    A_.update(damage_set(held))
    return A_


def knight_anims():
    sw = {'ang': 165, 'len': 16}
    A_ = {}
    A_['idle'] = [gp(chest=(0, b), armF=(12 + s, 22), weapon=sw) for b, s in zip([0, 0, 1, 1], [0, 2, 3, 1])]
    A_['walk'] = [dict(p, armF=(p['armF'][0] + 4, 22), weapon=sw) for p in human_walk()]
    A_['atk_sword_combo'] = [
        gp(tilt=-6, armF=(-40, 30), weapon={'ang': -150, 'len': 17}),
        gp(tilt=-10, hipOffset=(-1, 0), armF=(-150, 20), legF=(14, 6), weapon={'ang': -170, 'len': 17}),
        gp(tilt=16, hipOffset=(5, 1), armF=(95, 0), armB=(-30, 40), legF=(36, 30), legB=(-26, 4), weapon={'ang': 100, 'len': 20}),
        gp(tilt=4, hipOffset=(2, 0), armF=(150, 20), legF=(20, 10), weapon={'ang': 150, 'len': 17}),     # link: back up
        gp(tilt=20, hipOffset=(6, 1), armF=(100, 0), armB=(-30, 40), legF=(40, 34), legB=(-30, 4), weapon={'ang': 70, 'len': 20}),
        gp(tilt=12, hipOffset=(3, 1), armF=(60, 20), legF=(28, 22), legB=(-20, 4), weapon={'ang': 120, 'len': 17}),
        gp(tilt=4, armF=(30, 40), weapon={'ang': 150, 'len': 16})]
    A_['atk_charging_thrust'] = [
        gp(tilt=-6, hipOffset=(-1, 1), armF=(-30, 110), legF=(16, 20), legB=(-12, 12), weapon={'ang': 90, 'len': 17}),
        gp(tilt=-12, hipOffset=(-2, 2), armF=(-50, 130), legF=(22, 36), legB=(-16, 24), weapon={'ang': 90, 'len': 17}),
        gp(tilt=24, hipOffset=(7, 2), armF=(92, 0), armB=(-40, 20), legF=(40, 30), legB=(-35, 0), weapon={'ang': 90, 'len': 21}),
        gp(tilt=24, hipOffset=(7, 3), armF=(90, 0), armB=(-50, 20), legF=(-30, 6), legB=(36, 40), weapon={'ang': 90, 'len': 21}),
        gp(tilt=12, hipOffset=(3, 1), armF=(60, 20), legF=(28, 20), legB=(-20, 4), weapon={'ang': 110, 'len': 17}),
        gp(tilt=4, armF=(30, 40), weapon={'ang': 128, 'len': 16})]
    A_.update(damage_set(sw))
    return A_


def draw_hound(pose, size, feet):
    """War Hound = the Wolf's body in `en_steel` with an `en_red` collar (08 §7.3)."""
    class HoundFig(plains.Fig):
        def part(self, name, ramp, shift=0):
            ramp = {'en_slate': 'en_steel'}.get(ramp, ramp)
            if name == 'ruff':
                ramp = 'en_red'
            return super().part(name, ramp, shift)
    orig = plains.Fig
    plains.Fig = HoundFig
    try:
        return plains.draw_wolf(pose, size, feet)
    finally:
        plains.Fig = orig


def hound_anims():
    w = plains.wolf_anims()
    out = {'idle': w['idle'], 'walk': w['walk'], 'atk_leap_bite': w['atk_lunge_bite'], 'atk_snap': w['atk_snap'],
           'hurt': w['hurt'], 'stagger': w['stagger'], 'knockdown': w['knockdown'], 'death': w['death']}
    return out


TABLES = {'soldier': soldier_anims(), 'crossbowman': crossbowman_anims(), 'war_hound': hound_anims(),
          'battle_mage': mage_anims(), 'knight': knight_anims()}


def drawer(enemy, pose, size, feet):
    if enemy == 'war_hound':
        return draw_hound(pose, size, feet)
    return draw_armored(CFG[enemy], pose, size, feet)


TELE, REC = [0, 1], None


def seg_overrides():
    return {
        ('knight', 'atk_sword_combo'): [{'phase': 'tele', 'frames': [0, 1]}, {'phase': 'act', 'frames': [2]},
                                        {'phase': 'tele1', 'frames': [3]}, {'phase': 'act1', 'frames': [4]},
                                        {'phase': 'rec', 'frames': [5, 6]}],
        ('knight', 'atk_charging_thrust'): [{'phase': 'tele', 'frames': [0, 1]},
                                            {'phase': 'act', 'frames': [2, 3], 'loopFps': 12},
                                            {'phase': 'rec', 'frames': [4, 5]}],
        ('war_hound', 'atk_leap_bite'): [{'phase': 'tele', 'frames': [0, 1]}, {'phase': 'act', 'frames': [2, 3], 'byVy': True},
                                         {'phase': 'rec', 'frames': [4, 5]}],
    }


# `aim` (5 frames) is drawn but not listed: the view has no aim-angle input yet (docs/art/SPEC-GAPS-art.md #19).
HIDDEN = {('crossbowman', 'aim')}


def build_frames():
    """Frames + anims without writing files (the contrast report uses it)."""
    import tempfile
    return _build(None, tempfile.mkdtemp())


def _build(assets, preview):
    anims, frames = build_enemy_atlas(ATLAS, ENEMIES, TABLES, drawer, frame_size, P.KINGDOM_ENEMY_RAMPS + ['fx_fire'],
                                      preview, tuple(P.RAMPS['kg_bg1'][1]), seg_overrides(), HIDDEN, assets)
    return frames, anims


def build(assets, preview):
    return _build(assets, preview)[1]


def idle_key(enemy):
    return f'{enemy}_idle_00'
