import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art import items as IT
from art import icons as I


class ItemsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fr = IT.build_frames()

    def test_sizes(self):
        want = {'chest_timed_closed_00': (24, 16), 'chest_timed_open_00': (24, 16),
                'chest_cursed_closed_00': (24, 16), 'chest_cursed_open_00': (24, 16),
                'chest_key_closed_00': (24, 16), 'chest_key_open_00': (24, 16), 'key_00': (16, 16),
                'blueprint_00': (16, 16), 'beam_00': (2, 40)}
        want.update({f'coin_spin_{i:02d}': (8, 8) for i in range(4)})
        want.update({f'lucky_block_idle_{i:02d}': (16, 16) for i in range(4)})
        want.update({f'glow_weapon_{w}': (18, 18) for w in I.WEAPONS})
        want.update({f'glow_ability_{a}': (18, 18) for a in I.ABILITIES})
        for k, size in want.items():
            self.assertIn(k, self.fr)
            self.assertEqual(self.fr[k].size, size, k)
            P.check_palette_lock(self.fr[k], P.allowed(IT.ALLOWED), 'items', k)

    def test_glows_hug_icons(self):
        for kind, ids, fn in (('weapon', I.WEAPONS, I.weapon_icon), ('ability', I.ABILITIES, I.ability_icon)):
            for i in ids:
                ring = np.array(self.fr[f'glow_{kind}_{i}'])[:, :, 3] > 0
                icon = np.zeros((18, 18), bool)
                icon[1:17, 1:17] = np.array(fn(i))[:, :, 3] > 0
                self.assertFalse((ring & icon).any(), i)               # covers no icon pixel
                pad = np.pad(icon, 1)
                near = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
                self.assertTrue((ring == (near & ~icon)).all(), i)      # exactly the ring around it

    def test_beam_fades_up(self):
        a = np.array(self.fr['beam_00'])[:, :, 3] > 0
        self.assertGreater(a[30:].mean(), a[:10].mean())


if __name__ == '__main__':
    unittest.main()
