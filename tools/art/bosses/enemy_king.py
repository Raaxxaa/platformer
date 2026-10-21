"""The Enemy King (08 §7.4): atlas boss_enemy_king, 160 x 112 frames, anchor (80, 110)."""
from .. import palette as P
from ..enemies.armored import draw_armored, gp
from ..enemies.common34 import build_enemy_atlas
from ..enemies.plains import human_walk, downed

ATLAS = 'boss_enemy_king'
ID = 'enemy_king'
SIZE, ANCHOR = (160, 112), (80, 110)
L_KING = {'hip': 18, 'torso': 14, 'head': 6.5, 'upper': 8, 'fore': 8, 'thigh': 9.5, 'shin': 9.5}
CFG = dict(L=L_KING, torso=18, limb=5.4, thigh=6.4, head=(5.0, 5.4), plate='en_gold', cloth='en_red', emblem='en_gold',
           cape='en_red', helm='en_gold', crown='en_gold', collar='gray', boots='en_gold', weapon='sword', wlen=28, bw=3.4,
           bramp='gray', hilt='en_gold', orb='w_magic', pole='en_gold', big=True, beltc='en_red')


def sw(ang, ln=28, **kw):
    return dict({'ang': ang, 'len': ln}, **kw)


def sc(ang, glow=1):
    return {'ang': ang, 'len': 22, 'kind': 'staff', 'glow': glow}


def tables():
    A_ = {}
    rest = sw(165)
    A_['idle'] = [gp(chest=(0, b), armF=(14 + s, 24), weapon=rest, sway=b) for b, s in zip([0, 0, 1, 1], [0, 2, 3, 1])]
    A_['walk'] = [dict(p, armF=(p['armF'][0] + 6, 24), weapon=rest, sway=i % 2) for i, p in enumerate(human_walk())]
    rec = [gp(tilt=12, hipOffset=(3, 1), armF=(60, 20), legF=(28, 22), legB=(-20, 4), weapon=sw(120)),
           gp(tilt=4, armF=(30, 40), weapon=sw(150))]
    A_['atk_crown_cleave'] = [
        gp(tilt=-6, armF=(-40, 30), weapon=sw(-150)),
        gp(tilt=-10, hipOffset=(-1, 0), armF=(-150, 20), legF=(14, 6), weapon=sw(-170)),
        gp(tilt=16, hipOffset=(5, 1), armF=(95, 0), armB=(-30, 40), legF=(36, 30), legB=(-26, 4), weapon=sw(100, 32)),
        gp(tilt=4, hipOffset=(2, 0), armF=(150, 20), legF=(20, 10), weapon=sw(150)),
        gp(tilt=20, hipOffset=(6, 1), armF=(100, 0), armB=(-30, 40), legF=(40, 34), legB=(-30, 4), weapon=sw(70, 32)),
        rec[0], rec[1]]
    A_['atk_royal_thrust'] = [
        gp(tilt=-6, hipOffset=(-1, 1), armF=(-30, 110), legF=(16, 20), legB=(-12, 12), weapon=sw(90)),
        gp(tilt=-12, hipOffset=(-2, 2), armF=(-50, 130), legF=(22, 36), legB=(-16, 24), weapon=sw(90)),
        gp(tilt=24, hipOffset=(7, 2), armF=(92, 0), armB=(-40, 20), legF=(40, 30), legB=(-35, 0), weapon=sw(90, 34)),
        gp(tilt=24, hipOffset=(7, 3), armF=(90, 0), armB=(-50, 20), legF=(-30, 6), legB=(36, 40), weapon=sw(90, 34)),
        rec[0], rec[1]]
    orbs = [gp(tilt=-4, armF=(50, 40), weapon=sc(120, 1)), gp(tilt=-10, hipOffset=(-1, 0), armF=(70, 30), weapon=sc(100, 2)),
            gp(tilt=6, hipOffset=(2, 0), armF=(88, 2), legF=(18, 8), legB=(-12, 4), weapon=sc(94, 3)),
            gp(tilt=2, armF=(80, 10), weapon=sc(100, 1)), gp(armF=(40, 40), weapon=sw(150))]
    A_['atk_scepter_orbs'] = orbs
    A_['atk_scepter_orbs_wide'] = orbs
    lift = [gp(tilt=-4, armF=(120, 30), armB=(110, 30), weapon=sc(150, 1)),
            gp(tilt=-8, armF=(160, 10), armB=(150, 10), weapon=sc(176, 2)),
            gp(tilt=-10, armF=(176, 0), armB=(170, 0), hipOffset=(0, -1), weapon=sc(180, 3), head=(0, -1)),
            gp(tilt=-6, armF=(170, 10), armB=(160, 10), weapon=sc(180, 2)),
            gp(tilt=0, armF=(60, 30), weapon=sw(150))]
    A_['atk_royal_decree'] = lift
    A_['atk_blade_rain'] = lift
    A_['atk_throne_beam'] = [gp(tilt=-4, armF=(60, 40), weapon=sc(100, 1)), gp(tilt=-8, armF=(80, 20), weapon=sc(94, 2)),
                             gp(tilt=-4, hipOffset=(1, 0), armF=(90, 0), weapon=sc(90, 3)),
                             gp(tilt=-2, armF=(88, 2), weapon=sc(90, 3)), gp(armF=(40, 40), weapon=sw(150))]
    A_['atk_shockwave_slam'] = [
        gp(tilt=-4, hipOffset=(-1, 3), armF=(150, 30), legF=(30, 50), legB=(-20, 40), weapon=sw(150)),
        gp(tilt=-8, hipOffset=(-2, 5), armF=(176, 10), legF=(40, 70), legB=(-26, 54), weapon=sw(180)),
        gp(tilt=-6, hipOffset=(4, -4), armF=(176, 0), legF=(-30, 40), legB=(-50, 30), weapon=sw(180)),
        gp(tilt=14, hipOffset=(6, -2), armF=(110, 0), legF=(50, 10), legB=(-20, 30), weapon=sw(70, 32)),
        gp(tilt=24, hipOffset=(7, 4), armF=(60, 0), legF=(60, 70), legB=(30, 60), weapon=sw(40, 32)), rec[1]]
    hurt = gp(tilt=-12, hipOffset=(-1, 0), head=(-1, 0), armF=(-40, 40), armB=(-70, 30), legF=(14, 8), legB=(-10, 4), weapon=rest)
    A_['hurt'] = [hurt]
    A_['stagger'] = [gp(tilt=-8, hipOffset=(-1, 1), armF=(-20, 50), armB=(-50, 20), legF=(18, 20), legB=(-6, 10), weapon=rest),
                     gp(tilt=6, hipOffset=(1, 1), armF=(20, 30), armB=(-10, 20), legF=(10, 18), legB=(-14, 10), weapon=rest)]
    kneel = gp(tilt=14, hipOffset=(0, 8), legF=(80, 130), legB=(30, 120), armF=(30, 60), armB=(10, 60), weapon=sw(30, 22))
    A_['break'] = [kneel, dict(kneel, head=(1, 2), tilt=20), dict(kneel, head=(0, 1))]
    A_['intro'] = [gp(tilt=0, armF=(30, 40), weapon=None), gp(tilt=-4, armF=(60, 40), weapon=sw(100)),
                   gp(tilt=-6, armF=(120, 30), weapon=sw(140)), gp(tilt=-8, armF=(160, 20), weapon=sw(170)),
                   gp(tilt=-10, armF=(176, 0), weapon=sw(180), head=(0, -1)), gp(tilt=0, armF=(60, 30), weapon=rest)]
    A_['transition'] = [gp(tilt=-4, armF=(40, 40), weapon=rest), gp(tilt=-10, hipOffset=(0, 2), armF=(110, 30), weapon=sc(130, 2)),
                        gp(tilt=-14, hipOffset=(0, 3), armF=(170, 10), armB=(160, 10), weapon=sc(180, 3)),
                        gp(tilt=-16, hipOffset=(0, 3), armF=(176, 0), armB=(176, 0), weapon=sc(180, 3), head=(0, -1)),
                        gp(tilt=-10, armF=(150, 20), weapon=sc(165, 2)), gp(tilt=0, armF=(60, 30), weapon=rest)]
    A_['death'] = [hurt, A_['stagger'][0], A_['stagger'][1], kneel, dict(kneel, tilt=30, hipOffset=(-1, 9), weapon=None),
                   downed(0), downed(1), downed(2), downed(3)]
    return A_


TABLES = {ID: tables()}


def drawer(enemy, pose, size, feet):
    return draw_armored(CFG, pose, size, feet)


def segs():
    return {(ID, 'atk_crown_cleave'): [{'phase': 'tele', 'frames': [0, 1]}, {'phase': 'act', 'frames': [2]},
                                       {'phase': 'tele1', 'frames': [3]}, {'phase': 'act1', 'frames': [4]},
                                       {'phase': 'rec', 'frames': [5, 6]}],
            (ID, 'atk_royal_thrust'): [{'phase': 'tele', 'frames': [0, 1]}, {'phase': 'act', 'frames': [2, 3], 'loopFps': 12},
                                       {'phase': 'rec', 'frames': [4, 5]}],
            (ID, 'atk_shockwave_slam'): [{'phase': 'tele', 'frames': [0, 1]}, {'phase': 'act', 'frames': [2, 3], 'byVy': True},
                                         {'phase': 'rec', 'frames': [4, 5]}]}


RAMPS = ['ink', 'white', 'gray', 'en_gold', 'en_red', 'w_magic']


def build(assets, preview):
    anims, frames = build_enemy_atlas(ATLAS, [ID], TABLES, drawer, lambda e, a: (SIZE, ANCHOR), RAMPS, preview,
                                      tuple(P.RAMPS['cs_bg2'][1]), segs(), (), assets, label_w=200, boss=True)
    return anims


def build_frames():
    import tempfile
    anims, frames = build_enemy_atlas(ATLAS, [ID], TABLES, drawer, lambda e, a: (SIZE, ANCHOR), RAMPS, tempfile.mkdtemp(),
                                      tuple(P.RAMPS['cs_bg2'][1]), segs(), (), None, label_w=200, boss=True)
    return frames, anims
