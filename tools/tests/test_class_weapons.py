import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art import weapons as WP
from art import outfits as O
from art import projectiles as PR
from art import vfx as VX

KEYS = {
    'katana': {'atk_katana_1': 5, 'atk_katana_2': 5, 'atk_katana_3': 5, 'charge_katana': 2, 'atk_katana_charged': 5},
    'iron_fists': {f'atk_iron_fists_{i}': 5 for i in range(1, 5)},
    'bow': {'atk_bow_1': 5, 'charge_bow': 2, 'atk_bow_charged': 5},
    'crossbow': {'atk_crossbow_1': 5},
    'staff': {'atk_staff_1': 5, 'charge_staff': 2, 'atk_staff_charged': 5},
    'storm_hammer': {'atk_storm_hammer_1': 5, 'atk_storm_hammer_2': 5, 'atk_storm_hammer_throw': 5},
}
MELEE = {'atk_katana_1', 'atk_katana_2', 'atk_katana_3', 'atk_katana_charged', 'atk_iron_fists_1', 'atk_iron_fists_2',
         'atk_iron_fists_3', 'atk_iron_fists_4', 'atk_storm_hammer_1', 'atk_storm_hammer_2'}


class ClassWeaponsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.atl = {w: WP.build_frames(w) for w in KEYS}
        cls.body = O.build_outfit('archer')

    def test_frames_body_and_smears(self):
        body, trim = self.body
        for w, keys in KEYS.items():
            fr = self.atl[w]
            for key, n in keys.items():
                for i in range(n):
                    name = f'{key}_{i:02d}'
                    self.assertEqual(fr[name].size, (160, 96), name)
                    self.assertIn(name, body)
                    self.assertIn('a/' + name, trim)
                self.assertEqual(f'{key}_smear' in fr, key in MELEE, key)
            for part in ('windup', 'fall', 'land'):
                for i in range(2):
                    self.assertIn(f'dive_{w}_{part}_{i:02d}', fr)
            for name, img in fr.items():
                ok = P.allowed(['smear']) if name.endswith('_smear') else P.allowed(WP.ALLOWED)
                P.check_palette_lock(img, ok, f'weapon_{w}', name)
                if not name.startswith('dive_'):
                    self.assertFalse((np.array(img)[:, :, 3] > 0)[72:].any(), name)

    def test_projectile_step_and_throw(self):
        # 08 §6.3: a projectile step's frame 2 is the release; while the hammer is out the weapon layer is empty
        fr = self.atl['storm_hammer']
        for i in (2, 3, 4):
            self.assertFalse(np.array(fr[f'atk_storm_hammer_throw_{i:02d}'])[:, :, 3].any())
        for i in (0, 1):
            self.assertTrue(np.array(fr[f'atk_storm_hammer_throw_{i:02d}'])[:, :, 3].any())

    def test_melee_smears_cover_some_of_their_box(self):
        for key, (dx, dy, bw, bh) in WP.BOXES.items():
            w = WP.weapon_of(key)
            sm = np.array(self.atl[w][f'{key}_smear'])[:, :, 3] > 0
            x0, x1 = int(80 + dx - bw / 2), int(80 + dx + bw / 2)
            y0, y1 = int(72 + dy - bh / 2), int(72 + dy + bh / 2)
            self.assertGreaterEqual(sm[y0:y1, x0:x1].mean(), WP.MIN_COVER.get(key, 0.4), key)

    def test_projectiles(self):
        fr, anims = PR.build_frames()
        want = {'arrow_00': (12, 4), 'arrow_charged_00': (16, 4), 'bolt_00': (14, 4), 'pin_bolt_00': (14, 4),
                'staff_bolt_00': (8, 8), 'orb_00': (14, 14), 'orb_01': (14, 14)}
        want.update({f'hammer_spin_{i:02d}': (16, 16) for i in range(4)})
        for k, size in want.items():
            self.assertEqual(fr[k].size, size, k)
        vf, _ = VX.build_frames()
        for i in range(4):
            self.assertEqual(vf[f'hammer_dive_bolt_{i:02d}'].size, (32, 160))


if __name__ == '__main__':
    unittest.main()
