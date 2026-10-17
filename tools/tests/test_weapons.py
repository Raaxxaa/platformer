import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art import weapons as WP
from art import outfits as O

STEPS = {'greatsword': 3, 'war_maul': 2}
BOXES = {('greatsword', 1): (22, -16, 40, 28), ('greatsword', 2): (22, -18, 40, 32),
         ('greatsword', 3): (24, -18, 64, 40), ('war_maul', 1): (24, -16, 40, 32), ('war_maul', 2): (28, -10, 56, 20)}


class WeaponsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.atl = {w: WP.build_frames(w) for w in STEPS}
        cls.body = O.build_outfit('tank')[0]

    def test_frames(self):
        for w, n in STEPS.items():
            fr = self.atl[w]
            for s in range(1, n + 1):
                key = f'atk_{w}_{s}'
                for i in range(5):
                    self.assertEqual(fr[f'{key}_{i:02d}'].size, (160, 96))
                    self.assertIn(f'{key}_{i:02d}', self.body)
                self.assertIn(f'{key}_smear', fr)
            for part in ('windup', 'fall', 'land'):
                for i in range(2):
                    self.assertIn(f'dive_{w}_{part}_{i:02d}', fr)
            for name, img in fr.items():
                ok = P.allowed(['smear']) if name.endswith('_smear') else P.allowed(WP.ALLOWED)
                P.check_palette_lock(img, ok, f'weapon_{w}', name)

    def test_smear_covers_box(self):
        for (w, s), (dx, dy, bw, bh) in BOXES.items():
            sm = np.array(self.atl[w][f'atk_{w}_{s}_smear'])[:, :, 3] > 0
            ax, ay = 80, 72
            x0, x1 = int(round(ax + dx - bw / 2)), int(round(ax + dx + bw / 2))
            y0, y1 = int(round(ay + dy - bh / 2)), int(round(ay + dy + bh / 2))
            cover = sm[y0:y1, x0:x1].mean()
            # 02's boxes reach lower and wider than a weapon swung above the floor can (docs/art/SPEC-GAPS-art.md #4):
            # each step must keep at least its best measured cover.
            need = {('greatsword', 1): 0.64, ('greatsword', 2): 0.8, ('greatsword', 3): 0.43,
                    ('war_maul', 1): 0.64, ('war_maul', 2): 0.7}[(w, s)]
            self.assertGreaterEqual(cover, need, (w, s, round(float(cover), 2)))

    def test_nothing_below_the_floor(self):
        # the floor is under the sole row: weapon frame row 71 is the lowest a weapon or smear may use
        for w in STEPS:
            for name, img in self.atl[w].items():
                if name.startswith('dive_'):
                    continue
                a = np.array(img)[:, :, 3] > 0
                self.assertFalse(a[72:].any(), name)

    def test_snapped_angles(self):
        for a in (0, 10, 33, 47, 70, 90, 100, 179, -120):
            v = WP.snap(a)
            self.assertIn(tuple(sorted(map(abs, v))), {(0, 1), (1, 2), (1, 1)})


if __name__ == '__main__':
    unittest.main()
