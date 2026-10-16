import itertools
import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art import village as V

SIZES = {
    'shop_item_00': (24, 16), 'ability_altar_idle_00': (24, 24), 'ability_altar_idle_01': (24, 24),
    'shop_flask_00': (16, 24), 'shop_key_00': (16, 24), 'shop_reroll_00': (16, 24),
    'class_statue_swordsman_00': (32, 48), 'class_statue_tank_00': (32, 48), 'class_statue_archer_00': (32, 48),
    'class_statue_wizard_00': (32, 48), 'unlocks_board_00': (32, 32), 'seed_board_00': (24, 32),
    'gate_idle_00': (32, 64), 'gate_idle_01': (32, 64), 'loot_stand_00': (16, 16), 'mirror_spot_00': (24, 40),
}
SIZES.update({f'shop_refill_idle_{i:02d}': (24, 20) for i in range(4)})


class VillagePropsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fr = V.prop_frames()
        cls.dummy = V.dummy_frames()

    def test_sizes_and_palette(self):
        for k, size in SIZES.items():
            self.assertIn(k, self.fr)
            self.assertEqual(self.fr[k].size, size, k)
            P.check_palette_lock(self.fr[k], P.allowed(V.ALLOWED), 'objects', k)
        self.assertEqual(sorted(self.dummy), ['training_dummy_hit_00', 'training_dummy_hit_01', 'training_dummy_hit_02',
                                              'training_dummy_idle_00'])
        for k, img in self.dummy.items():
            self.assertEqual(img.size, (48, 48))
            P.check_palette_lock(img, P.allowed(['ink', 'vl_wood', 'gray', 'w_gold']), 'enemies_extra', k)
            a = np.array(img)[:, :, 3] > 0
            self.assertFalse(a[46:].any(), k)

    def test_no_overlap_at_layout_spots(self):
        imgs = dict(self.fr)
        imgs['training_dummy_idle_00'] = self.dummy['training_dummy_idle_00']
        for village, spots in V.LAYOUT.items():
            spans = []
            for frame, tile_x in spots:
                a = np.array(imgs[frame])[:, :, 3] > 0
                cols = np.nonzero(a.any(axis=0))[0]
                left = tile_x * 16 + 8 - imgs[frame].width // 2
                spans.append((left + cols.min(), left + cols.max() + 1, frame))
            spans.sort()
            for (a0, a1, fa), (b0, b1, fb) in zip(spans, spans[1:]):
                self.assertLessEqual(a1, b0, (village, fa, fb))

    def test_lights_pulse_gently(self):
        # 08 photosensitivity: glows change at most 2 times per second
        keys = {a['key']: a for a in V.anims()}
        for k in ('ability_altar_idle', 'gate_idle'):
            self.assertLessEqual(keys[k]['fps'], 2, k)

    def test_props_differ(self):
        keys = [k for k in SIZES if k.endswith('_00')]
        for a, b in itertools.combinations(keys, 2):
            ia, ib = self.fr[a], self.fr[b]
            if ia.size == ib.size:
                ma = np.array(ia)[:, :, 3] > 0
                mb = np.array(ib)[:, :, 3] > 0
                self.assertFalse((ma == mb).all(), (a, b))


if __name__ == '__main__':
    unittest.main()
