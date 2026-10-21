"""ART8: body poses of the 11 weapons M9 added (08 §6.3). Imported at the end of `player.py`, which owns POSES.

Same pose language as `player.py`; 'weapon2' = the off-hand copy's angle (Twin Daggers), 'weapon' None = the weapon
has left the hand (Javelin, Throwing Knives after the release)."""
from .player import POSES, FPS, SMEAR, _p, _atk, _lunge, WIDE, TENSE


def _atk2(armF, armB, w1, w2=None, behind=False, **kw):
    d = _p(armF=armF, armB=armB, **kw)
    d['weapon'], d['weapon2'], d['behind'] = w1, w2, behind
    return d


ATTACKS8 = {
    # Twin Daggers: 1-3 quick alternating stabs and slashes, 4 a cross slash with a lunge
    'atk_twin_daggers_1': [_atk2((40, 100), (30, 100), 90, 90, **WIDE), _atk2((20, 120), (30, 100), 90, 90, **WIDE),
                           _atk2((92, 0), (30, 100), 90, 90, **_lunge(3)), _atk2((70, 30), (30, 100), 90, 90, **WIDE),
                           _atk2((40, 80), (30, 100), 90, 90, **WIDE)],
    'atk_twin_daggers_2': [_atk2((40, 100), (20, 120), 90, 90, **WIDE), _atk2((30, 100), (-20, 130), 90, 90, **WIDE),
                           _atk2((40, 100), (92, 0), 90, 90, **_lunge(3)), _atk2((40, 100), (70, 30), 90, 90, **WIDE),
                           _atk2((40, 100), (40, 80), 90, 90, **WIDE)],
    'atk_twin_daggers_3': [_atk2((-30, 100), (40, 100), 117, 90, **WIDE), _atk2((-60, 110), (40, 100), 135, 90, **WIDE),
                           _atk2((110, 10), (40, 100), 117, 90, **_lunge(3, 1)),
                           _atk2((90, 30), (40, 100), 117, 90, **WIDE), _atk2((60, 60), (40, 100), 117, 90, **WIDE)],
    'atk_twin_daggers_4': [_atk2((-40, 100), (-20, 100), 135, 135, tilt=-4, **WIDE),
                           _atk2((-70, 110), (-50, 110), 153, 153, tilt=-8, **WIDE),
                           _atk2((100, 0), (80, 10), 117, 63, tilt=14, **_lunge(5, 2)),
                           _atk2((90, 20), (70, 20), 108, 72, tilt=10, **_lunge(5, 1)),
                           _atk2((50, 50), (30, 60), 90, 90, **WIDE)],
    # Spear: three long thrusts and the lunge (the move is the active frame)
    'atk_spear_1': [_atk((60, 40), 90, **WIDE), _atk((30, 90), 90, tilt=-4, **WIDE),
                    _atk((92, 0), 90, **_lunge(4, 1)), _atk((80, 10), 90, **_lunge(3)), _atk((50, 40), 90, **WIDE)],
    'atk_spear_2': [_atk((70, 30), 108, **WIDE), _atk((40, 70), 100, tilt=-4, **WIDE),
                    _atk((94, 0), 90, **_lunge(5, 1)), _atk((80, 10), 90, **_lunge(4)), _atk((50, 40), 90, **WIDE)],
    'atk_spear_3': [_atk((20, 100), 90, tilt=-6, **WIDE), _atk((10, 120), 90, tilt=-10, **dict(WIDE, hipOffset=(-2, 2))),
                    _atk((96, 0), 90, tilt=8, **_lunge(8, 2)), _atk((86, 10), 90, **_lunge(6, 1)),
                    _atk((50, 40), 90, **WIDE)],
    'atk_spear_lunge': [_atk((30, 90), 90, **dict(TENSE, tilt=-6)), _atk((16, 110), 90, **dict(TENSE, tilt=-10)),
                        _atk((98, 0), 90, tilt=20, **_lunge(14, 3)), _atk((92, 0), 90, tilt=14, **_lunge(10, 2)),
                        _atk((60, 40), 90, **WIDE)],
    # Scythe: two sweeping cuts and a wide cut over both sides
    'atk_scythe_1': [_atk((170, 30), -153, True, **WIDE), _atk((-170, 40), -135, True, tilt=-6, **WIDE),
                     _atk((60, 0), 117, **_lunge(3, 2)), _atk((70, 10), 135, **_lunge(3, 1)),
                     _atk((60, 20), 153, **WIDE)],
    'atk_scythe_2': [_atk((-100, 10), -117, True, **WIDE), _atk((-80, 10), -90, True, tilt=-4, **WIDE),
                     _atk((120, 20), 153, tilt=12, **_lunge(1)), _atk((140, 20), 153, tilt=8, **_lunge(1)),
                     _atk((150, 20), 153, **WIDE)],
    'atk_scythe_3': [_atk((170, 0), 180, **WIDE), _atk((-176, 20), -153, True, tilt=-10, **WIDE),
                     _atk((70, 0), 153, tilt=6, **_lunge(5, 2)), _atk((90, 10), 153, **_lunge(4, 1)),
                     _atk((60, 20), 135, **WIDE)],
    # Giant Axe: two heavy chops and the Cyclone spin (6 frames: wind up, spin x4, recover)
    'atk_giant_axe_1': [_atk((170, 30), -153, True, **WIDE), _atk((-170, 40), -135, True, tilt=-6, **WIDE),
                        _atk((60, 0), 90, **_lunge(4, 3)), _atk((70, 10), 117, **_lunge(4, 2)),
                        _atk((60, 20), 135, **WIDE)],
    'atk_giant_axe_2': [_atk((176, 0), 180, **WIDE), _atk((-170, 20), -153, True, tilt=-10, **WIDE),
                        _atk((70, 10), 63, tilt=16, **_lunge(0)), _atk((76, 10), 63, tilt=16, **_lunge(0)),
                        _atk((60, 20), 90, **WIDE)],
    'atk_giant_axe_spin': [_atk((120, 30), 135, tilt=-6, **WIDE),
                           _atk((90, 0), 90, tilt=6, **WIDE), _atk((60, 0), 63, tilt=6, **WIDE),
                           _atk((-90, 0), -90, True, tilt=6, **WIDE), _atk((-60, 0), -63, True, tilt=6, **WIDE),
                           _atk((60, 20), 117, **WIDE)],
    # Flail: two swings, a held charge and the big release
    'atk_flail_1': [_atk((170, 30), -153, True, **WIDE), _atk((-170, 40), -135, True, tilt=-6, **WIDE),
                    _atk((70, 0), 90, **_lunge(4, 2)), _atk((70, 10), 108, **_lunge(4, 1)), _atk((60, 20), 135, **WIDE)],
    'atk_flail_2': [_atk((-100, 10), -117, True, **WIDE), _atk((-80, 10), -90, True, tilt=-4, **WIDE),
                    _atk((80, 10), 90, tilt=12, **_lunge(2)), _atk((90, 10), 90, tilt=10, **_lunge(2)),
                    _atk((60, 20), 108, **WIDE)],
    'charge_flail': [_atk((-90, 30), -117, True, **TENSE), _atk((-96, 34), -117, True, **dict(TENSE, tilt=8))],
    'atk_flail_charged': [_atk((-90, 30), -117, True, **TENSE), _atk((-100, 20), -90, True, **TENSE),
                          _atk((90, 0), 90, tilt=16, **_lunge(10, 2)), _atk((90, 0), 90, tilt=14, **_lunge(9, 1)),
                          _atk((60, 20), 108, **WIDE)],
    # Shield: held up in front, let down, and the bash
    'shield_up': [_atk((70, 40), 90, tilt=-4, **WIDE)],
    'shield_lower': [_atk((40, 40), 70, **WIDE)],
    'atk_shield_bash': [_atk((60, 60), 90, tilt=-6, **WIDE),
                        _atk((30, 90), 90, tilt=-8, **dict(WIDE, hipOffset=(-1, 1))),
                        _atk((92, 0), 90, tilt=14, **_lunge(5, 1)), _atk((80, 10), 90, tilt=8, **_lunge(3)),
                        _atk((50, 40), 80, **WIDE)],
    # Hand Cannon: raise, aim, fire with a kick (frame 2 is the release)
    'atk_hand_cannon_1': [_atk((70, 20), 90, **WIDE), _atk((88, 4), 90, **WIDE),
                          _atk((88, 4), 117, tilt=-10, **dict(WIDE, hipOffset=(-2, 0))),
                          _atk((84, 8), 108, tilt=-6, **WIDE), _atk((50, 30), 117, **WIDE)],
    # Javelin: cocked back over the shoulder, thrown (the weapon leaves the hand at frame 2)
    'atk_javelin_1': [_atk((-100, 40), 100, tilt=-6, **WIDE),
                      _atk((-130, 30), 108, tilt=-12, **dict(WIDE, hipOffset=(-1, 0))),
                      _atk((100, 10), None, tilt=14, **_lunge(5, 1)), _atk((80, 10), None, tilt=8, **_lunge(3)),
                      _atk((40, 40), None, **WIDE)],
    # Throwing Knives: a flick of the wrist, the fan flies at frame 2
    'atk_throwing_knives_1': [_atk((-30, 60), 63, **WIDE), _atk((-50, 60), 63, tilt=-4, **WIDE),
                              _atk((96, 4), None, tilt=8, **_lunge(2)), _atk((70, 20), None, **WIDE),
                              _atk((40, 40), None, **WIDE)],
    # Wand: a quick flick
    'atk_wand_1': [_atk((70, 50), 126, **WIDE), _atk((80, 30), 117, **WIDE), _atk((90, 4), 90, tilt=4, **_lunge(1)),
                   _atk((84, 10), 99, **WIDE), _atk((50, 40), 126, **WIDE)],
    # Spell Tome: two pushes with the book and a ring cast with the book raised (frame 2 = the cast)
    'atk_spell_tome_1': [_atk((60, 60), 90, **WIDE), _atk((40, 80), 90, tilt=-4, **WIDE),
                         _atk((90, 0), 90, tilt=6, **_lunge(2)), _atk((80, 10), 90, **WIDE), _atk((50, 40), 90, **WIDE)],
    'atk_spell_tome_2': [_atk((100, 30), 99, **WIDE), _atk((120, 20), 108, tilt=-4, **WIDE),
                         _atk((84, 0), 81, tilt=6, **_lunge(2)), _atk((76, 10), 90, **WIDE), _atk((50, 40), 90, **WIDE)],
    'atk_spell_tome_3': [_atk((100, 40), 117, **WIDE), _atk((150, 20), 153, tilt=-4, **WIDE),
                         _atk((176, 0), 180, tilt=-6, **WIDE), _atk((170, 10), 171, **WIDE),
                         _atk((100, 30), 135, **WIDE)],
}
SMEAR.update({'atk_twin_daggers_1': (65, 115), 'atk_twin_daggers_2': (65, 115), 'atk_twin_daggers_3': (63, 135),
              'atk_twin_daggers_4': (50, 140),
              'atk_spear_1': (82, 98), 'atk_spear_2': (82, 98), 'atk_spear_3': (84, 96), 'atk_spear_lunge': (84, 96),
              'atk_scythe_1': (225, 117), 'atk_scythe_2': (-90, 153), 'atk_scythe_3': (250, 110),
              'atk_giant_axe_1': (225, 90), 'atk_giant_axe_2': (207, 63), 'atk_giant_axe_spin': (0, 359),
              'atk_flail_1': (225, 90), 'atk_flail_2': (-90, 108), 'atk_flail_charged': (110, 80),
              'atk_shield_bash': (30, 120), 'atk_spell_tome_1': (60, 120), 'atk_spell_tome_2': (130, 70)})
POSES.update(ATTACKS8)
FPS.update({'shield_up': 1, 'shield_lower': 1})
