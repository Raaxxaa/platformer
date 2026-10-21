"""The Black Knight (08 §7.4): atlas boss_black_knight, 144 x 96 frames, anchor (72, 94)."""
from .. import palette as P
from ..enemies.armored import draw_armored, gp
from ..enemies.common34 import build_enemy_atlas
from ..enemies.plains import human_walk, downed

ATLAS = 'boss_black_knight'
ID = 'black_knight'
SIZE, ANCHOR = (144, 96), (72, 94)
L_BK = {'hip': 17, 'torso': 13, 'head': 6, 'upper': 8, 'fore': 8, 'thigh': 9, 'shin': 9}
CFG = dict(L=L_BK, torso=17, limb=5.2, thigh=6.2, head=(5.2, 5.6), plate='en_black', cape='en_red', helm='en_black',
           eyes=P.RAMPS['fx_fire'][3], horns='en_black', boots='en_black', weapon='sword', wlen=26, bw=3.4, bramp='gray',
           hilt='en_black', shield='en_red', shield_scale=1.5, big=True, beltc='en_red', emblem='en_red', lift=1)


def sw(ang, ln=26, **kw):
    return dict({'ang': ang, 'len': ln}, **kw)


def tables():
    A_ = {}
    rest = sw(160)
    A_['idle'] = [gp(chest=(0, b), armF=(14 + s, 24), weapon=rest, shield='low', sway=b) for b, s in zip([0, 0, 1, 1], [0, 2, 3, 1])]
    A_['walk'] = [dict(p, armF=(p['armF'][0] + 6, 24), weapon=rest, shield='low', sway=i % 2) for i, p in enumerate(human_walk())]
    A_['bulwark'] = [gp(tilt=-4, armF=(30, 50), armB=(55, 50), weapon=sw(110), shield='up')]
    s3 = [gp(tilt=-6, armF=(-40, 30), weapon=sw(-150), shield='low'),
          gp(tilt=-10, hipOffset=(-1, 0), armF=(-150, 20), legF=(14, 6), weapon=sw(-170), shield='low'),
          gp(tilt=16, hipOffset=(5, 1), armF=(95, 0), armB=(-30, 40), legF=(36, 30), legB=(-26, 4), weapon=sw(100, 30), shield='low')]
    link_tele = [gp(tilt=4, hipOffset=(2, 0), armF=(150, 20), legF=(20, 10), weapon=sw(150), shield='low'),
                 gp(tilt=-4, hipOffset=(2, 0), armF=(-120, 20), legF=(20, 10), weapon=sw(-130), shield='low'),
                 gp(tilt=-8, hipOffset=(0, 1), armF=(176, 0), legF=(20, 10), weapon=sw(180), shield='low'),
                 gp(tilt=-8, hipOffset=(0, 1), armF=(176, 0), legF=(20, 10), weapon=sw(180), shield='low')]
    link_act = [gp(tilt=20, hipOffset=(6, 1), armF=(100, 0), armB=(-30, 40), legF=(40, 34), legB=(-30, 4), weapon=sw(70, 30), shield='low'),
                gp(tilt=18, hipOffset=(6, 1), armF=(80, 0), armB=(-30, 40), legF=(40, 34), legB=(-30, 4), weapon=sw(110, 30), shield='low'),
                gp(tilt=22, hipOffset=(7, 2), armF=(60, 10), armB=(-30, 40), legF=(44, 36), legB=(-32, 6), weapon=sw(40, 30), shield='low'),
                gp(tilt=16, hipOffset=(4, 2), armF=(100, 0), armB=(-60, 40), legF=(30, 20), legB=(-24, 4), weapon=sw(90, 34), shield='low')]
    rec = [gp(tilt=12, hipOffset=(3, 1), armF=(60, 20), legF=(28, 22), legB=(-20, 4), weapon=sw(120), shield='low'),
           gp(tilt=4, armF=(30, 40), weapon=sw(150), shield='low')]
    A_['atk_triple_slash'] = s3 + [link_tele[0], link_act[0], link_tele[1], link_act[1], link_tele[2], link_act[2]] + rec
    A_['atk_lunge_thrust'] = [
        gp(tilt=-6, hipOffset=(-1, 1), armF=(-30, 110), legF=(16, 20), legB=(-12, 12), weapon=sw(90), shield='low'),
        gp(tilt=-12, hipOffset=(-2, 2), armF=(-50, 130), legF=(22, 36), legB=(-16, 24), weapon=sw(90), shield='low'),
        gp(tilt=24, hipOffset=(7, 2), armF=(92, 0), armB=(-40, 20), legF=(40, 30), legB=(-35, 0), weapon=sw(90, 32), shield='low'),
        gp(tilt=24, hipOffset=(7, 3), armF=(90, 0), armB=(-50, 20), legF=(-30, 6), legB=(36, 40), weapon=sw(90, 32), shield='low'),
        rec[0], rec[1]]
    A_['atk_shield_bash'] = [
        gp(tilt=-4, armF=(30, 50), weapon=rest, shield='up', armB=(20, 90)),
        gp(tilt=-10, hipOffset=(-1, 1), armF=(30, 50), weapon=rest, shield='up', armB=(0, 120), legF=(14, 10)),
        gp(tilt=14, hipOffset=(4, 1), armF=(30, 50), weapon=rest, shield='bash', armB=(92, 0), legF=(34, 26), legB=(-24, 6)),
        gp(tilt=10, hipOffset=(3, 1), armF=(30, 50), weapon=rest, shield='bash', armB=(80, 10), legF=(28, 20), legB=(-20, 4)),
        gp(tilt=3, armF=(30, 50), weapon=rest, shield='low')]
    A_['atk_dark_wave'] = [
        gp(tilt=-4, armF=(100, 40), weapon=sw(150), shield='low'),
        gp(tilt=-10, hipOffset=(-1, 0), armF=(170, 10), weapon=sw(176), shield='low'),
        gp(tilt=16, hipOffset=(4, 2), armF=(70, 10), legF=(34, 24), legB=(-22, 6), weapon=sw(30, 30), shield='low'),
        gp(tilt=12, hipOffset=(3, 2), armF=(60, 10), legF=(30, 20), legB=(-20, 6), weapon=sw(20, 30), shield='low'),
        gp(tilt=4, armF=(30, 40), weapon=rest, shield='low')]
    A_['atk_leap_slam'] = [
        gp(tilt=-4, hipOffset=(-1, 3), armF=(150, 30), legF=(30, 50), legB=(-20, 40), weapon=sw(150), shield='low'),
        gp(tilt=-8, hipOffset=(-2, 5), armF=(176, 10), legF=(40, 70), legB=(-26, 54), weapon=sw(180), shield='low'),
        gp(tilt=-6, hipOffset=(4, -4), armF=(176, 0), legF=(-30, 40), legB=(-50, 30), weapon=sw(180), shield='low'),     # rising
        gp(tilt=14, hipOffset=(6, -2), armF=(110, 0), legF=(50, 10), legB=(-20, 30), weapon=sw(70, 30), shield='low'),   # falling
        gp(tilt=24, hipOffset=(7, 4), armF=(70, 0), legF=(60, 70), legB=(30, 60), weapon=sw(50, 30), shield='low'),
        rec[1]]
    hurt = gp(tilt=-12, hipOffset=(-1, 0), head=(-1, 0), armF=(-40, 40), armB=(-70, 30), legF=(14, 8), legB=(-10, 4),
              weapon=rest, shield='low')
    A_['hurt'] = [hurt]
    A_['stagger'] = [gp(tilt=-8, hipOffset=(-1, 1), armF=(-20, 50), armB=(-50, 20), legF=(18, 20), legB=(-6, 10), weapon=rest, shield='low'),
                     gp(tilt=6, hipOffset=(1, 1), armF=(20, 30), armB=(-10, 20), legF=(10, 18), legB=(-14, 10), weapon=rest, shield='low')]
    kneel = gp(tilt=14, hipOffset=(0, 8), legF=(80, 130), legB=(30, 120), armF=(30, 60), armB=(10, 60), weapon=sw(30, 20), shield='low')
    kneel2 = dict(kneel, head=(1, 2), tilt=20, weapon=sw(20, 20))
    A_['break'] = [kneel, kneel2, dict(kneel, head=(0, 1))]
    A_['intro'] = [dict(kneel, tilt=26, hipOffset=(0, 10), weapon=sw(10, 20)), kneel,
                   gp(tilt=6, hipOffset=(0, 4), legF=(40, 70), legB=(10, 50), armF=(60, 40), weapon=sw(60, 24), shield='low'),
                   gp(tilt=-2, armF=(60, 40), weapon=sw(100), shield='low'),
                   gp(tilt=-6, armF=(150, 30), weapon=sw(165), shield='low'),
                   gp(tilt=0, armF=(140, 20), weapon=sw(170), shield='low', head=(0, -1))]
    A_['transition'] = [gp(tilt=-4, armF=(40, 40), weapon=rest, shield='low'),
                        gp(tilt=-10, hipOffset=(0, 2), armF=(110, 30), weapon=sw(130), shield='low'),
                        gp(tilt=-14, hipOffset=(0, 3), legF=(20, 20), armF=(170, 10), weapon=sw(180), shield='low'),
                        gp(tilt=-16, hipOffset=(0, 3), legF=(20, 20), armF=(176, 0), weapon=sw(180), shield='low', head=(0, -1)),
                        gp(tilt=-10, armF=(150, 20), weapon=sw(165), shield='low'),
                        gp(tilt=0, armF=(60, 30), weapon=rest, shield='low')]
    d = [hurt, A_['stagger'][0], A_['stagger'][1], kneel, dict(kneel, tilt=30, hipOffset=(-1, 9), weapon=None)]
    A_['death'] = d + [downed(0), downed(1), downed(2), downed(3)]
    return A_


TABLES = {ID: tables()}


def drawer(enemy, pose, size, feet):
    return draw_armored(CFG, pose, size, feet)


def segs():
    n = 11
    return {(ID, 'atk_triple_slash'): [
        {'phase': 'tele', 'frames': [0, 1]}, {'phase': 'act', 'frames': [2]},
        {'phase': 'tele1', 'frames': [3]}, {'phase': 'act1', 'frames': [4]},
        {'phase': 'tele2', 'frames': [5]}, {'phase': 'act2', 'frames': [6]},
        {'phase': 'tele3', 'frames': [7]}, {'phase': 'act3', 'frames': [8]},
        {'phase': 'rec', 'frames': [n - 2, n - 1]}],
        (ID, 'atk_lunge_thrust'): [{'phase': 'tele', 'frames': [0, 1]}, {'phase': 'act', 'frames': [2, 3], 'loopFps': 12},
                                   {'phase': 'rec', 'frames': [4, 5]}],
        (ID, 'atk_leap_slam'): [{'phase': 'tele', 'frames': [0, 1]}, {'phase': 'act', 'frames': [2, 3], 'byVy': True},
                                {'phase': 'rec', 'frames': [4, 5]}]}


def build(assets, preview):
    anims, frames = build_enemy_atlas(ATLAS, [ID], TABLES, drawer, lambda e, a: (SIZE, ANCHOR),
                                      ['ink', 'white', 'gray', 'en_black', 'en_red', 'fx_fire'], preview,
                                      tuple(P.RAMPS['kg_bg1'][1]), segs(), (), assets, label_w=200, boss=True)
    return anims


def build_frames():
    import tempfile
    anims, frames = build_enemy_atlas(ATLAS, [ID], TABLES, drawer, lambda e, a: (SIZE, ANCHOR),
                                      ['ink', 'white', 'gray', 'en_black', 'en_red', 'fx_fire'], tempfile.mkdtemp(),
                                      tuple(P.RAMPS['kg_bg1'][1]), segs(), (), None, label_w=200, boss=True)
    return frames, anims


def idle_key(enemy=None):
    return 'idle_00'
