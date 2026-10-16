import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art.boxes import HURTBOX, ATTACK_BOX
from art.bosses import great_boar as G

EXPECTED = {'idle': 4, 'walk': 6, 'hurt': 1, 'stagger': 2, 'death': 9, 'intro': 6, 'break': 3, 'transition': 6,
            'dazed': 2, 'atk_charge': 8, 'atk_tusk_toss': 5, 'atk_stomp_quake': 5}
SIZE, ANCHOR = (160, 112), (80, 110)


class GreatBoarTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frames, cls.anims = G.build_frames()

    def test_anims(self):
        keys = {a['key']: a for a in self.anims}
        for anim, n in EXPECTED.items():
            self.assertIn(anim, keys)
            self.assertEqual(len(keys[anim]['frames']), n, anim)
            for f in keys[anim]['frames']:
                self.assertEqual(self.frames[f].size, SIZE, f)
        self.assertEqual(keys['atk_charge']['segments'][1], {'phase': 'act', 'frames': [2, 3, 4, 5], 'loopFps': 16})

    def test_reach(self):
        boxes = ATTACK_BOX['great_boar']
        self.assertEqual(boxes, {'charge': (28, -20, 40, 36), 'tusk_toss': (36, -24, 48, 48),
                                 'stomp_quake': (0, -8, 96, 16)})
        (fw, fh), (ax, ay) = SIZE, ANCHOR
        for atk, (dx, dy, w, h) in boxes.items():
            self.assertLessEqual(abs(dx) + w / 2, ax, atk)
            self.assertLessEqual(h / 2 - dy, ay, atk)
            self.assertLessEqual(dy + h / 2, fh - ay, atk)

    def test_silhouette(self):
        w, h = HURTBOX['great_boar']
        self.assertEqual((w, h), (64, 40))
        ax, ay = ANCHOR
        a = np.array(self.frames['idle_00'])[:, :, 3] > 0
        cols = np.nonzero(a.any(axis=0))[0]
        rows = np.nonzero(a.any(axis=1))[0]
        self.assertLessEqual(abs(cols.min() - (ax - w / 2)), 3, ('left', cols.min()))
        self.assertLessEqual(abs(cols.max() + 1 - (ax + w / 2)), 3, ('right', cols.max() + 1))
        self.assertLessEqual(abs(rows.min() - (ay - h)), 3, ('top', rows.min()))
        self.assertEqual(rows.max(), ay - 1)

    def test_nothing_below_the_ground(self):
        for name, img in self.frames.items():
            a = np.array(img)[:, :, 3] > 0
            self.assertFalse(a[ANCHOR[1]:].any(), name)
            self.assertFalse(a[-1].any() or a[:, 0].any() or a[:, -1].any() or a[0].any(), name)

    def test_hue_and_palette(self):
        world = P.allowed(P.PLAINS_WORLD_RAMPS) - set(P.RAMPS['ink']) - set(P.RAMPS['white'])
        allowed = P.allowed(G.RAMPS)
        for name, img in self.frames.items():
            P.check_palette_lock(img, allowed, 'boss_great_boar', name)
            cols = {tuple(c[:3]) for c in np.array(img).reshape(-1, 4) if c[3] == 255}
            self.assertFalse(cols & world, name)


if __name__ == '__main__':
    unittest.main()
