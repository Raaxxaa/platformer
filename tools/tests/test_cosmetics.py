import json
import os
import unittest
import numpy as np
import _path  # noqa: F401
from art import cosmetics as CS
from art import palette as P

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
ENEMY_ACC = ['wolf', 'bandit', 'bandit_archer', 'wild_boar', 'bandit_brute', 'great_boar', 'bat_swarm', 'goblin_miner',
             'rock_golem', 'ram', 'goblin_shaman', 'stone_colossus', 'bog_zombie', 'giant_spider', 'spiderling', 'wisp',
             'swamp_witch', 'treant', 'spider_queen', 'soldier', 'crossbowman', 'war_hound', 'battle_mage', 'knight',
             'black_knight', 'royal_guard', 'gargoyle', 'castle_mage', 'living_armor', 'royal_executioner', 'enemy_king']
SHOP_HATS = ['hat_straw', 'hat_beret', 'hat_flower', 'hat_tricorn', 'hat_tophat']
SHOP_CAPES = ['cape_purple', 'cape_patched', 'cape_starry', 'cape_checkered', 'cape_gold']


class CosmeticsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fr, cls.icons = CS.build_frames()

    def test_counts_and_ids(self):
        want = [f'acc_{e}' for e in ENEMY_ACC] + [f'acc_dragon_{c}' for c in ('red', 'white', 'storm', 'green')]
        self.assertEqual(len(want), 35)
        self.assertEqual(sorted(CS.ACCESSORIES), sorted(want))
        self.assertEqual(sorted(CS.SHOP), sorted(SHOP_HATS + SHOP_CAPES))
        for cid, (slot, point, n, _f) in CS.ALL.items():
            self.assertIn(slot, ('head', 'back', 'extra'))
            self.assertIn(point, ('head', 'back', 'neck', 'shoulder'))
            if slot == 'back':
                self.assertIn(n, (1, 3), cid)
            self.assertIn(f'icon_cos_{cid}', self.icons)
            for i in range(n):
                self.assertIn(f'{cid}_{i:02d}', self.fr)
        self.assertEqual(len([k for k in self.icons if k.startswith(('icon_cos_dye_', 'icon_cos_hair_'))]), 14)
        self.assertEqual(len(self.icons), 59)

    def test_sizes_palette_and_anchor(self):
        ok = P.allowed(list(P.RAMPS))
        for n, im in self.fr.items():
            self.assertEqual(im.size, (32, 32), n)
            a = np.array(im)[:, :, 3] > 0
            self.assertTrue(a.any(), n)
            P.check_palette_lock(im, ok, 'cosmetics', n)
            ys, xs = np.nonzero(a)
            # drawn inside the 48 x 48 player frame whatever the attachment point: at most ~16 px each way
            self.assertLessEqual(max(xs.max() - 16, 16 - xs.min(), ys.max() - 16, 16 - ys.min()), 16, n)
        for n, im in self.icons.items():
            self.assertEqual(im.size, (16, 16), n)
            self.assertTrue((np.array(im)[:, :, 3] > 0).any(), n)
            P.check_palette_lock(im, ok | set(P.UI_COLORS.values()), 'ui', n)

    def test_icons_distinct(self):
        masks = {n: tuple(np.array(im).reshape(-1).tolist()) for n, im in self.icons.items()}
        self.assertEqual(len(set(masks.values())), len(masks))

    def test_manifest_in_look_json(self):
        m = json.load(open(os.path.join(ROOT, 'public', 'assets', 'look.json')))['cosmetics']
        self.assertEqual(sorted(m), sorted(CS.ALL))
        self.assertEqual(m['acc_wolf']['point'], 'head')
        self.assertEqual(m['acc_dragon_red']['frames'], 3)


if __name__ == '__main__':
    unittest.main()
