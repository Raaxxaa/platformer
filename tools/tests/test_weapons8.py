import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art import weapons as WP
from art import outfits as O
from art.poses.player import POSES

NEW = ['twin_daggers', 'spear', 'scythe', 'giant_axe', 'flail', 'shield', 'hand_cannon', 'javelin', 'throwing_knives',
       'wand', 'spell_tome']


class Weapons8Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.atl = {w: WP.build_frames(w) for w in NEW}
        cls.body = O.build_outfit('wizard')[0]

    def test_every_key_has_body_and_weapon_frames(self):
        for w in NEW:
            for key in WP.KEYS[w]:
                for i in range(len(POSES[key])):
                    n = f'{key}_{i:02d}'
                    self.assertEqual(self.atl[w][n].size, (160, 96), n)
                    self.assertIn(n, self.body)
                    P.check_palette_lock(self.atl[w][n], P.allowed(WP.ALLOWED), f'weapon_{w}', n)

    def test_step_counts_follow_02(self):
        steps = {'twin_daggers': 4, 'spear': 3, 'scythe': 3, 'giant_axe': 2, 'flail': 2, 'hand_cannon': 1, 'javelin': 1,
                 'throwing_knives': 1, 'wand': 1, 'spell_tome': 3}
        for w, n in steps.items():
            for s in range(1, n + 1):
                self.assertIn(f'atk_{w}_{s}', POSES)
        self.assertEqual(len(POSES['atk_giant_axe_spin']), 6)

    def test_thrown_weapons_leave_the_hand(self):
        for w in ('javelin', 'throwing_knives'):
            fr = self.atl[w]
            self.assertFalse(np.array(fr[f'atk_{w}_1_02'])[:, :, 3].any())
            self.assertTrue(np.array(fr[f'atk_{w}_1_00'])[:, :, 3].any())

    def test_melee_smears_cover_part_of_their_box(self):
        for key, (dx, dy, bw, bh) in WP.BOXES8.items():
            w = WP.weapon_of(key)
            sm = np.array(self.atl[w][f'{key}_smear'])[:, :, 3] > 0
            x0, x1 = int(80 + dx - bw / 2), int(80 + dx + bw / 2)
            y0, y1 = int(72 + dy - bh / 2), int(72 + dy + bh / 2)
            self.assertGreaterEqual(sm[y0:y1, x0:x1].mean(), 0.03, key)


if __name__ == '__main__':
    unittest.main()
