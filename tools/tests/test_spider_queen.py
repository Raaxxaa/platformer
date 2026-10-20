import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art.boxes import ATTACK_BOX
from art.bosses import spider_queen as Q

COUNTS = {'idle': 4, 'walk': 6, 'hurt': 1, 'stagger': 2, 'climb': 2, 'hang_top': 1, 'fall': 1, 'intro': 6,
          'break': 3, 'transition': 6, 'death': 9, 'atk_ceiling_drop': 5, 'atk_fang_strike': 5, 'atk_pounce': 6,
          'atk_venom_spit': 5, 'atk_brood': 5}
SL = {'idle': 4, 'walk': 6, 'hurt': 1, 'stagger': 2, 'knockdown': 2, 'death': 4, 'atk_bite': 5}


class SpiderQueenTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frames, cls.anims = Q.build_frames()
        cls.sl, cls.sl_anims = Q.spiderling_frames()

    def test_queen_anims_and_sizes(self):
        for anim, n in COUNTS.items():
            names = [f for f in self.frames if f.rsplit('_', 1)[0] == anim]
            self.assertEqual(len(names), n, anim)
            for f in names:
                self.assertEqual(self.frames[f].size, (192, 112), f)
        self.assertEqual({a['key'] for a in self.anims}, set(COUNTS))

    def test_queen_reach_rule(self):
        ax, ay = Q.ANCHOR
        for atk, box in ATTACK_BOX['spider_queen'].items():
            if box is None:
                continue
            dx, dy, w, h = box
            self.assertLessEqual(abs(dx) + w / 2, ax, atk)
            self.assertLessEqual(h / 2 - dy, ay, atk)
            self.assertLessEqual(dy + h / 2, 112 - ay, atk)

    def test_spiderling(self):
        for anim, n in SL.items():
            names = [f for f in self.sl if f.rsplit('_', 1)[0] == f'spiderling_{anim}']
            self.assertEqual(len(names), n, anim)
            for f in names:
                self.assertEqual(self.sl[f].size, (40, 32), f)
                self.assertFalse((np.array(self.sl[f])[:, :, 3] > 0)[30:].any(), f)
        dx, dy, w, h = ATTACK_BOX['spiderling']['bite']
        self.assertLessEqual(abs(dx) + w / 2, 20)                     # Bite reaches 17 px (08 §4.1)
        self.assertEqual({a['atlas'] for a in self.sl_anims}, {'enemies_extra'})

    def test_palette(self):
        for name, img in self.frames.items():
            P.check_palette_lock(img, P.allowed(Q.RAMPS), Q.ATLAS, name)
        for name, img in self.sl.items():
            P.check_palette_lock(img, P.allowed(Q.SL_RAMPS), 'enemies_extra', name)


if __name__ == '__main__':
    unittest.main()
