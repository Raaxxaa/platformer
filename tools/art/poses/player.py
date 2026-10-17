"""Player pose table (08 §12.3). Every outfit uses these poses."""


def _idle():
    frames = []
    bob = [0, 0, 1, 1, 1, 0]          # chest and head sink 1 px while breathing out
    sway = [0, 2, 4, 4, 2, 0]         # arms sway a few degrees
    for i in range(6):
        frames.append({
            'lean': 0, 'hipOffset': (0, 0), 'chest': (0, bob[i]), 'head': (0, 0),
            'armF': (8 + sway[i], 18), 'armB': (-6 - sway[i], 14),
            'legF': (9, 6), 'legB': (-7, 2),
        })
    return frames


def _run():
    # one leg's cycle over 8 frames; the other leg is 4 frames later
    thigh = [38, 22, 2, -22, -40, -30, 6, 34]
    knee = [12, 28, 20, 8, 30, 85, 95, 55]
    arm = [-40, -26, -6, 22, 42, 30, 6, -24]   # opposite to the same-side leg
    bob = [1, 0, 0, 1, 1, 0, 0, 1]          # 1 px bob; keeps the planted foot on the sole row
    frames = []
    for i in range(8):
        k = (i + 4) % 8
        frames.append({
            'lean': 2, 'hipOffset': (0, bob[i]), 'head': (1, 0),
            'legF': (thigh[i], knee[i]), 'legB': (thigh[k], knee[k]),
            'armF': (arm[i], 80), 'armB': (arm[k], 80),
        })
    return frames


POSES = {'idle': _idle(), 'run': _run()}
FPS = {'idle': 8}


# ---------------------------------------------------------------- 08 §6.1 full move set (ART4)
# Extra pose keys used by outfits.build_outfit: 'rot' (quarter turns counter-clockwise of the rendered figure,
# about its own bounding-box center), 'ground' (put the lowest pixel on the sole row 45), 'flask' (drink).


def _p(**kw):
    d = {'lean': 0, 'tilt': 0, 'hipOffset': (0, 0), 'head': (0, 0), 'chest': (0, 0),
         'armF': (10, 20), 'armB': (-8, 14), 'legF': (9, 6), 'legB': (-7, 2)}
    d.update(kw)
    return d


def _lying(**kw):
    """Upright pose that becomes lying on the back (head left, feet right, face up) after one ccw turn."""
    d = _p(armF=(60, 30), armB=(-60, 20), legF=(4, 0), legB=(-4, 2), rot=1, ground=True)
    d.update(kw)
    return d


TUCK = dict(tilt=20, legF=(100, 150), legB=(88, 150), armF=(60, 100), armB=(40, 100))

POSES.update({
    'skid': [_p(lean=-2, tilt=-12, legF=(40, 0), legB=(-10, 24), armF=(-30, 30), armB=(-50, 20), ground=True)],
    'jump': [_p(tilt=4, legF=(64, 104), legB=(14, 44), armF=(150, 20), armB=(124, 24)),
             _p(tilt=2, legF=(50, 90), legB=(4, 34), armF=(140, 24), armB=(104, 30))],
    'apex': [_p(legF=(40, 70), legB=(-10, 50), armF=(96, 10), armB=(76, 12))],
    'fall': [_p(legF=(10, 12), legB=(-16, 22), armF=(124, 12), armB=(104, 14)),
             _p(legF=(6, 8), legB=(-20, 26), armF=(132, 8), armB=(112, 10))],
    'double_jump': [dict(_p(**TUCK), rot=k) for k in (0, 3, 2, 1)],         # forward flip, clockwise
    'wall_jump': [_p(tilt=10, hipOffset=(2, 0), legF=(34, 64), legB=(-52, 10), armF=(112, 20), armB=(-80, 12)),
                  _p(tilt=6, hipOffset=(1, 0), legF=(42, 74), legB=(-28, 40), armF=(140, 20), armB=(110, 20))],
    'land': [_p(tilt=16, hipOffset=(0, 5), legF=(62, 124), legB=(32, 112), armF=(40, 40), armB=(-20, 40),
                ground=True),
             _p(tilt=6, hipOffset=(0, 2), legF=(30, 60), legB=(10, 50), armF=(24, 30), armB=(-14, 30), ground=True)],
    'dash': [_p(tilt=16, lean=2, legF=(42, 44), legB=(-40, 10), armF=(-60, 20), armB=(-82, 10)),
             _p(tilt=36, lean=3, hipOffset=(0, 1), legF=(64, 74), legB=(-62, 0), armF=(-104, 0), armB=(-124, 0)),
             _p(tilt=14, lean=2, legF=(30, 30), legB=(-30, 10), armF=(-30, 30), armB=(-50, 20))],
    'wall_slide': [_p(tilt=-4, hipOffset=(1, 0), legF=(24, 54), legB=(-22, 4), armF=(30, 40), armB=(-20, 10)),
                   _p(tilt=-4, hipOffset=(1, 0), legF=(20, 50), legB=(-20, 4), armF=(36, 44), armB=(-24, 8))],
    'ledge_climb': [_p(legF=(10, 30), legB=(-6, 20), armF=(178, 0), armB=(172, 0)),
                    _p(hipOffset=(0, -4), legF=(20, 40), legB=(0, 30), armF=(160, 70), armB=(150, 70)),
                    _p(tilt=14, hipOffset=(1, -6), legF=(92, 124), legB=(0, 20), armF=(110, 40), armB=(90, 40)),
                    _p(lean=1, tilt=4, legF=(12, 8), legB=(-8, 4), armF=(20, 30), armB=(-10, 20))],
    'slide': [_lying(armF=(16, 10), armB=(-22, 10), legB=(12, 30)), _lying(armF=(12, 10), armB=(-18, 10), legB=(8, 24))],
    'crawl': [_p(tilt=88, hipOffset=(-3, 7), head=(1, 5), legF=(4 + d, 96), legB=(-6 - d, 96), armF=(-78 - d, 20),
                 armB=(-94 + d, 20), ground=True) for d in (0, 12, 0, -12)],
    'dive_windup': [_p(tilt=20, legF=(80, 120), legB=(60, 110), armF=(150, 30), armB=(130, 30)),
                    _p(tilt=26, legF=(92, 136), legB=(70, 124), armF=(170, 20), armB=(150, 20))],
    'dive_fall': [_p(legF=(2, 0), legB=(-4, 4), armF=(24, 0), armB=(-16, 0)),
                  _p(legF=(-2, 2), legB=(4, 2), armF=(30, 0), armB=(-22, 0))],
    'dive_land': [_p(tilt=30, hipOffset=(0, 7), legF=(72, 132), legB=(40, 124), armF=(30, 0), armB=(-60, 20),
                     ground=True),
                  _p(tilt=20, hipOffset=(0, 5), legF=(60, 118), legB=(30, 108), armF=(40, 10), armB=(-50, 20),
                     ground=True)],
    'hurt': [_p(tilt=-20, head=(-1, 0), legF=(30, 30), legB=(10, 10), armF=(100, 30), armB=(60, 20)),
             _p(tilt=-12, legF=(24, 20), legB=(4, 8), armF=(70, 30), armB=(40, 20))],
    'dead': [_p(tilt=-20, head=(-1, 0), legF=(30, 30), legB=(10, 10), armF=(100, 30), armB=(60, 20), ground=True),
             _p(tilt=-12, hipOffset=(0, 5), legF=(44, 94), legB=(22, 84), armF=(40, 30), armB=(10, 20), ground=True),
             _p(tilt=-44, hipOffset=(-1, 9), legF=(70, 140), legB=(60, 130), armF=(-30, 20), armB=(-60, 20),
                ground=True),
             _lying(armF=(30, 20), armB=(-30, 20), legB=(10, 30)),
             _lying(armF=(10, 10), armB=(-20, 10)),
             _lying(armF=(6, 6), armB=(-16, 6), dead=True)],
    'drink': [_p(armF=(30, 70), flask=True, ground=True),
              _p(armF=(60, 116), flask=True, ground=True),
              _p(tilt=-6, head=(-1, 0), armF=(86, 112), flask=True, ground=True),
              _p(armF=(44, 90), flask=True, ground=True)],
    'cart_ride': [_p(hipOffset=(0, 4), tilt=8, legF=(50, 100), legB=(30, 90), armF=(80, 20), armB=(66, 24)),
                  _p(hipOffset=(0, 5), tilt=10, legF=(54, 106), legB=(34, 96), armF=(84, 18), armB=(70, 22))],
})

FPS.update({'jump': 12, 'fall': 12, 'double_jump': 24, 'wall_jump': 16, 'land': 20, 'wall_slide': 8,
            'crawl': 8, 'dive_fall': 16, 'hurt': 10, 'dead': 10, 'cart_ride': 6})


# ---------------------------------------------------------------- weapon attack steps (08 §6.3), ART4
# Each step: 5 frames [S0, S1, A, R0, R1]. 'weapon' = weapon angle (0 down, 90 forward, 180 up),
# 'behind' = weapon drawn behind the body (08 §4.2 weaponBehind). SMEAR = (from S1 angle, to A angle) along the swing.

def _atk(arm, wpn, behind=False, **kw):
    d = _p(armF=arm, armB=(arm[0] - 15, arm[1] + 10), **kw)
    d['weapon'] = wpn
    d['behind'] = behind
    return d


LUNGE = dict(lean=2, tilt=8, legF=(34, 26), legB=(-24, 6))
WIDE = dict(legF=(22, 10), legB=(-18, 4))

def _lunge(hx, dip=0):
    return dict(hipOffset=(hx, (3 if hx else 0) + dip), lean=2, legF=(34 + hx * 3 + dip * 4, 26 + hx * 4 + dip * 8),
                legB=(-24 - hx * 2 - dip * 3, 6 + dip * 4))


# Hit poses (A frames): natural swings that keep the weapon above the floor, picked by searching for the best
# cover of 02's boxes (deep lunges lower the hands). Coverage numbers: docs/art/SPEC-GAPS-art.md #4.
ATTACKS = {
    'atk_greatsword_1': [_atk((170, 30), -153, True, **WIDE), _atk((-170, 40), -135, True, tilt=-6, **WIDE),
                         _atk((60, 0), 90, **_lunge(4, 3)), _atk((70, 10), 117, **_lunge(4, 2)),
                         _atk((60, 20), 135, **WIDE)],
    'atk_greatsword_2': [_atk((-100, 10), -117, True, **WIDE), _atk((-80, 10), -90, True, tilt=-4, **WIDE),
                         _atk((120, 20), 135, tilt=16, **_lunge(0)), _atk((140, 20), 153, tilt=10, **_lunge(0)),
                         _atk((150, 20), 153, **WIDE)],
    'atk_greatsword_3': [_atk((170, 0), 180, **WIDE), _atk((-176, 20), -153, True, tilt=-8, **WIDE),
                         _atk((50, 10), 90, **_lunge(6, 3)), _atk((60, 10), 117, **_lunge(6, 2)),
                         _atk((60, 20), 135, **WIDE)],
    'atk_war_maul_1': [_atk((170, 30), -153, True, **WIDE), _atk((-170, 40), -135, True, tilt=-6, **WIDE),
                       _atk((60, 0), 90, **_lunge(4, 3)), _atk((70, 10), 117, **_lunge(4, 2)),
                       _atk((60, 20), 135, **WIDE)],
    'atk_war_maul_2': [_atk((176, 0), 180, **WIDE), _atk((-170, 20), -153, True, tilt=-10, **WIDE),
                       _atk((70, 10), 63, tilt=16, **_lunge(0)), _atk((76, 10), 63, tilt=16, **_lunge(0)),
                       _atk((60, 20), 90, **WIDE)],
}
SMEAR = {'atk_greatsword_1': (225, 90), 'atk_greatsword_2': (-90, 135), 'atk_greatsword_3': (207, 90),
         'atk_war_maul_1': (225, 90), 'atk_war_maul_2': (207, 63)}
GROUND_SHOCK = {'atk_war_maul_2': 56}     # smash: the smear also shows the shock along the floor to this reach
# Weapon angles over the body's dive frames (windup, fall, land), 2 frames each.
DIVE_WEAPON = {'dive_windup': (180, 153), 'dive_fall': (0, 0), 'dive_land': (27, 27)}
POSES.update(ATTACKS)


# ---------------------------------------------------------------- ART5 class weapons (08 §6.3)
# 'weapon' None = the weapon layer is empty in that frame (Storm Hammer after the throw).
# 'draw' = bow string pull 0..1.
TENSE = dict(tilt=6, hipOffset=(0, 2), legF=(30, 40), legB=(-22, 18))       # charging: low and ready

ATTACKS5 = {
    # Katana: fast flat slashes; step 2 mirrors step 1; step 3 a rising cut; charged = dash-slash
    'atk_katana_1': [_atk((-40, 30), -117, True, **WIDE), _atk((-70, 20), -90, True, **WIDE),
                     _atk((90, 0), 90, **_lunge(3, 2)), _atk((80, 10), 117, **_lunge(3, 1)),
                     _atk((40, 30), 135, **WIDE)],
    'atk_katana_2': [_atk((150, 30), 153, **WIDE), _atk((160, 20), 135, **WIDE),
                     _atk((80, 0), 90, **_lunge(3, 2)), _atk((60, 10), 90, **_lunge(3, 1)),
                     _atk((40, 30), 67, **WIDE)],
    'atk_katana_3': [_atk((-60, 20), -90, True, **WIDE), _atk((-30, 20), -90, True, tilt=6, **WIDE),
                     _atk((130, 10), 135, tilt=10, **_lunge(2)), _atk((150, 10), 153, **_lunge(2)),
                     _atk((150, 20), 153, **WIDE)],
    'charge_katana': [_atk((-80, 30), -117, True, **TENSE), _atk((-84, 34), -117, True, **dict(TENSE, tilt=8))],
    'atk_katana_charged': [_atk((-80, 30), -117, True, **TENSE), _atk((-90, 20), -90, True, **TENSE),
                           _atk((90, 0), 90, tilt=18, **_lunge(12, 2)), _atk((90, 0), 90, tilt=16, **_lunge(12, 1)),
                           _atk((60, 20), 117, **WIDE)],
    # Iron Fists: quick jabs, step 4 a big rising uppercut
    'atk_iron_fists_1': [_atk((30, 90), 90, **WIDE), _atk((20, 110), 90, tilt=-4, **WIDE),
                         _atk((90, 0), 90, **_lunge(3)), _atk((70, 30), 90, **WIDE), _atk((30, 80), 90, **WIDE)],
    'atk_iron_fists_2': [_atk((20, 110), 90, **WIDE), _atk((10, 120), 90, tilt=-4, **WIDE),
                         _atk((92, 0), 90, tilt=6, **_lunge(4)), _atk((70, 30), 90, **WIDE),
                         _atk((30, 80), 90, **WIDE)],
    'atk_iron_fists_3': [_atk((30, 90), 90, **WIDE), _atk((10, 120), 90, tilt=-6, **WIDE),
                         _atk((96, 0), 90, tilt=10, **_lunge(5)), _atk((70, 30), 90, **WIDE),
                         _atk((30, 80), 90, **WIDE)],
    'atk_iron_fists_4': [_atk((10, 60), 180, **TENSE), _atk((0, 80), 180, **dict(TENSE, tilt=10, hipOffset=(0, 4))),
                         _atk((160, 10), 180, tilt=-6, **_lunge(2)), _atk((170, 0), 180, tilt=-4, **WIDE),
                         _atk((40, 60), 180, **WIDE)],
    # Bow (projectile steps: frame 2 is the release)
    'atk_bow_1': [_atk((80, 10), 90, draw=0.3, **WIDE), _atk((88, 4), 90, draw=1, **WIDE),
                  _atk((88, 4), 90, draw=0, **WIDE), _atk((80, 10), 90, draw=0, **WIDE),
                  _atk((50, 30), 117, draw=0, **WIDE)],
    'charge_bow': [_atk((88, 4), 90, draw=1, **dict(TENSE, tilt=-4)), _atk((88, 4), 90, draw=1, **dict(TENSE, tilt=-6))],
    'atk_bow_charged': [_atk((88, 4), 90, draw=1, **TENSE), _atk((88, 4), 90, draw=1, **dict(TENSE, tilt=-4)),
                        _atk((88, 4), 90, draw=0, tilt=-8, **WIDE), _atk((80, 10), 90, draw=0, **WIDE),
                        _atk((50, 30), 117, draw=0, **WIDE)],
    'atk_crossbow_1': [_atk((70, 20), 90, **WIDE), _atk((86, 4), 90, **WIDE), _atk((86, 4), 90, tilt=-8, **WIDE),
                       _atk((80, 10), 90, tilt=-4, **WIDE), _atk((50, 30), 117, **WIDE)],
    # Staff
    'atk_staff_1': [_atk((120, 20), 153, **WIDE), _atk((140, 10), 153, **WIDE), _atk((90, 0), 90, **_lunge(2)),
                    _atk((80, 10), 117, **WIDE), _atk((40, 30), 153, **WIDE)],
    'charge_staff': [_atk((150, 10), 180, **TENSE), _atk((156, 6), 180, **dict(TENSE, tilt=4))],
    'atk_staff_charged': [_atk((150, 10), 180, **TENSE), _atk((160, 6), 180, **TENSE), _atk((96, 0), 90, **_lunge(3)),
                          _atk((80, 10), 117, **WIDE), _atk((40, 30), 153, **WIDE)],
    # Storm Hammer
    'atk_storm_hammer_1': [_atk((170, 30), -153, True, **WIDE), _atk((-170, 40), -135, True, tilt=-6, **WIDE),
                           _atk((60, 0), 90, **_lunge(4, 3)), _atk((70, 10), 117, **_lunge(4, 2)),
                           _atk((60, 20), 135, **WIDE)],
    'atk_storm_hammer_2': [_atk((-40, 10), -117, True, **WIDE), _atk((-80, 10), -90, True, tilt=-4, **WIDE),
                           _atk((120, 20), 135, tilt=16, **_lunge(0)), _atk((140, 20), 153, tilt=10, **_lunge(0)),
                           _atk((150, 20), 153, **WIDE)],
    'atk_storm_hammer_throw': [_atk((-170, 30), -153, True, **WIDE), _atk((-160, 20), -135, True, tilt=-8, **WIDE),
                               _atk((110, 0), None, tilt=10, **_lunge(3)), _atk((90, 10), None, **_lunge(2)),
                               _atk((40, 30), None, **WIDE)],
}
SMEAR.update({'atk_katana_1': (270, 90), 'atk_katana_2': (-117, 90), 'atk_katana_3': (-63, 135),
              'atk_katana_charged': (135, 45), 'atk_iron_fists_1': (63, 117), 'atk_iron_fists_2': (63, 117),
              'atk_iron_fists_3': (63, 117), 'atk_iron_fists_4': (63, 180),
              'atk_storm_hammer_1': (225, 90), 'atk_storm_hammer_2': (-90, 135)})
POSES.update(ATTACKS5)

# ART5 Task 4 — ability poses (08 §6.2). Blade Dash reuses `dash`.
ABILITY_POSES = {
    'cast_slam': [_p(ground=True, tilt=-6, armF=(160, 40), armB=(150, 30), legF=(20, 10), legB=(-16, 4)),
                  _p(ground=True, tilt=-8, armF=(180, 10), armB=(170, 10), legF=(22, 12), legB=(-18, 4)),
                  _p(ground=True, tilt=14, hipOffset=(1, 4), armF=(40, 20), armB=(30, 20), legF=(40, 50), legB=(-34, 30)),
                  _p(ground=True, tilt=8, hipOffset=(0, 2), armF=(30, 30), armB=(20, 30), legF=(30, 30), legB=(-24, 16))],
    'cast_up': [_p(ground=True, armF=(120, 30), armB=(100, 30), legF=(14, 6), legB=(-12, 4)),
                _p(ground=True, tilt=-6, armF=(170, 10), armB=(150, 20), legF=(18, 6), legB=(-14, 4)),
                _p(ground=True, tilt=-2, armF=(150, 30), armB=(120, 30), legF=(14, 6), legB=(-12, 4))],
    'spin': [_p(ground=True, tilt=4, armF=(90, 0), armB=(-90, 0), legF=(24, 10), legB=(-20, 6)),
             _p(ground=True, tilt=4, armF=(60, 0), armB=(-60, 0), legF=(20, 10), legB=(-24, 6)),
             _p(ground=True, tilt=4, armF=(-90, 0), armB=(90, 0), legF=(16, 10), legB=(-22, 6)),
             _p(ground=True, tilt=4, armF=(-60, 0), armB=(60, 0), legF=(22, 10), legB=(-18, 6))],
    'shoulder': [_p(ground=True, tilt=22, lean=3, armF=(-20, 90), armB=(-40, 60), legF=(44, 40), legB=(-40, 12)),
                 _p(ground=True, tilt=22, lean=3, armF=(-20, 90), armB=(-40, 60), legF=(30, 50), legB=(-46, 20))],
}
POSES.update(ABILITY_POSES)
