import unittest
import numpy as np
import _path  # noqa: F401
from art import outfits as O
from art.poses.player import POSES

WANT = {'cast_slam': 4, 'cast_up': 3, 'spin': 4, 'shoulder': 2}


class AbilityPosesTest(unittest.TestCase):
    def test_poses_in_every_outfit(self):
        for k, n in WANT.items():
            self.assertEqual(len(POSES[k]), n, k)
        for o in O.OUTFITS:
            body, trim = O.build_outfit(o)
            for k, n in WANT.items():
                for i in range(n):
                    name = f'{k}_{i:02d}'
                    self.assertEqual(body[name].size, (48, 48), name)
                    self.assertIn(f'a/{name}', trim)
                    a = np.array(body[name])[:, :, 3] > 0
                    self.assertTrue(a[45].any(), f'{o} {name}: feet on row 45')
                    self.assertFalse(a[46:].any(), f'{o} {name}: below the floor')


if __name__ == '__main__':
    unittest.main()
