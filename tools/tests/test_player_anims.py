import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art import outfits as O

OUTFITS = ['swordsman', 'tank', 'archer', 'wizard']
COUNTS = {'idle': 6, 'run': 8, 'skid': 1, 'jump': 2, 'apex': 1, 'fall': 2, 'double_jump': 4, 'wall_jump': 2,
          'land': 2, 'dash': 3, 'wall_slide': 2, 'ledge_climb': 4, 'slide': 2, 'crawl': 4, 'dive_windup': 2,
          'dive_fall': 2, 'dive_land': 2, 'hurt': 2, 'dead': 6, 'drink': 4, 'cart_ride': 2}
GROUNDED = ['idle', 'skid', 'land', 'slide', 'crawl', 'dive_land', 'drink', 'dead']


def alpha(*imgs):
    a = np.zeros((48, 48), bool)
    for im in imgs:
        a |= np.array(im)[:, :, 3] > 0
    return a


class PlayerAnimsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.built = {o: O.build_outfit(o) for o in OUTFITS}

    def frames(self, o, key):
        body, trim = self.built[o]
        names = sorted(n for n in body if n.rsplit('_', 1)[0] == key)
        return [(body[n], trim['a/' + n], trim['b/' + n]) for n in names]

    def test_counts_and_layers(self):
        for o in OUTFITS:
            body, trim = self.built[o]
            self.assertEqual(sorted('a/' + n for n in body), sorted(k for k in trim if k.startswith('a/')))
            self.assertEqual(sorted('b/' + n for n in body), sorted(k for k in trim if k.startswith('b/')))
            for key, n in COUNTS.items():
                self.assertEqual(len(self.frames(o, key)), n, (o, key))

    def test_feet_and_floor(self):
        for o in OUTFITS:
            for key in COUNTS:
                for i, f in enumerate(self.frames(o, key)):
                    rows = np.nonzero(alpha(*f).any(axis=1))[0]
                    self.assertLessEqual(rows.max(), 45, (o, key, i))
                    if key in GROUNDED:
                        self.assertEqual(rows.max(), 45, (o, key, i))

    def test_low_and_wall_poses(self):
        for o in OUTFITS:
            for key in ('slide', 'crawl'):
                for i, f in enumerate(self.frames(o, key)):
                    rows = np.nonzero(alpha(*f).any(axis=1))[0]
                    self.assertGreaterEqual(rows.min(), 46 - 14 - 1, (o, key, i))     # 01 §2.2 low box 12 × 14
            for i, f in enumerate(self.frames(o, 'wall_slide')):
                cols = np.nonzero(alpha(*f).any(axis=0))[0]
                self.assertTrue(16 <= cols.min() <= 18, (o, i, cols.min()))           # touches the wall at x 18

    def test_palette(self):
        for o in OUTFITS:
            body, trim = self.built[o]
            for n, img in body.items():
                P.check_palette_lock(img, P.allowed(O.BODY_RAMPS), 'player_' + o, n)
            for n, img in trim.items():
                P.check_palette_lock(img, P.allowed(['trim']), f'player_{o}_trim', n)


if __name__ == '__main__':
    unittest.main()
