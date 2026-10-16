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
