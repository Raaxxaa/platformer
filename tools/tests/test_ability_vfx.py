import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art import vfx as VX

WANT = {'blade_dash': ((96, 6), 3), 'whirlwind': ((48, 32), 4), 'shoulder_lines': ((32, 16), 3),
        'wall_rubble': ((16, 16), 4), 'arrow_rain': ((4, 12), 1), 'thunder': ((24, 160), 4),
        'blink_puff': ((24, 32), 4), 'mark': ((16, 16), 4), 'mark_linked': ((16, 16), 4), 'link': ((32, 32), 4)}
WANT.update({f'ab_shockwave_{r}': ((2 * r, 44), 5) for r in (56, 64, 72, 84, 96)})
DENSE_OK = {'thunder', 'arrow_rain'}       # the bolt core; a 4 px arrow is all arrow


class AbilityVfxTest(unittest.TestCase):
    def test_ability_effects(self):
        fr, anims = VX.build_frames()
        keys = {a['key'] for a in anims}
        for k, (size, n) in WANT.items():
            self.assertIn(k, keys)
            for i in range(n):
                img = fr[f'{k}_{i:02d}']
                self.assertEqual(img.size, size, k)
                P.check_palette_lock(img, P.allowed(VX.ALLOWED), 'vfx', k)
                a = np.array(img)[:, :, 3] > 0
                self.assertTrue(a.any(), k)
                if k not in DENSE_OK:
                    self.assertLessEqual(a.mean(), 0.4, f'{k}_{i:02d}')


if __name__ == '__main__':
    unittest.main()
