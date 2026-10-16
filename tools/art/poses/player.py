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
