import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art.boxes import ATTACK_BOX
from art.bosses import stone_colossus as S

COUNTS = {'idle': 4, 'walk': 6, 'hurt': 1, 'stagger': 2, 'turn': 3, 'intro': 6, 'break': 3, 'transition': 6,
          'death': 9, 'atk_fist_slam': 5, 'atk_shoulder_ram': 6, 'atk_leap_slam': 6, 'atk_rock_rain': 5}


class StoneColossusTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frames, cls.anims = S.build_frames()

    def test_anims_and_sizes(self):
        for anim, n in COUNTS.items():
            names = [f for f in self.frames if f.rsplit('_', 1)[0] == anim]
            self.assertEqual(len(names), n, anim)
            for f in names:
                self.assertEqual(self.frames[f].size, (192, 144), f)
        self.assertEqual({a['key'] for a in self.anims}, set(COUNTS))

    def test_reach_rule(self):
        ax, ay = S.ANCHOR
        for atk, box in ATTACK_BOX['stone_colossus'].items():
            if box is None:
                continue
            dx, dy, w, h = box
            self.assertLessEqual(abs(dx) + w / 2, ax, atk)
            self.assertLessEqual(h / 2 - dy, ay, atk)
            self.assertLessEqual(dy + h / 2, 144 - ay, atk)

    def test_palette_and_sole(self):
        for name, img in self.frames.items():
            P.check_palette_lock(img, P.allowed(S.RAMPS), S.ATLAS, name)
            self.assertFalse((np.array(img)[:, :, 3] > 0)[S.ANCHOR[1]:].any(), name)


if __name__ == '__main__':
    unittest.main()
