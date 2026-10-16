import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art import objects as OB
from art import tiles as T


class ObjectsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fr = OB.frames()

    def test_sizes_and_palette(self):
        names = ['arena_door_cap_00', 'arena_door_mid_00', 'arena_door_bottom_00',
                 'timed_door_mid_00', 'timed_door_bottom_00', 'timed_door_cap_pending_00',
                 'timed_door_cap_open_00', 'timed_door_cap_missed_00'] + [f'guide_arrow_{i:02d}' for i in range(8)]
        for n in names:
            self.assertEqual(self.fr[n].size, (16, 16), n)
            P.check_palette_lock(self.fr[n], P.allowed(OB.ALLOWED), 'objects', n)

    def test_doors_stack_seamlessly(self):
        for door, cap in (('arena_door', 'arena_door_cap_00'), ('timed_door', 'timed_door_cap_open_00')):
            parts = [cap] + [f'{door}_mid_00'] * 3 + [f'{door}_bottom_00']
            stack = np.vstack([np.array(self.fr[p]) for p in parts])
            body = stack[16:-16]                       # the middle pieces: same columns in every row, no ink seam
            cols = body[:, :, 3] > 0
            self.assertTrue((cols == cols[0]).all(), door)
            ink = np.all(body[:, :, :3] == P.RAMPS['ink'][0], axis=2) & cols
            self.assertFalse(any(ink[y].sum() == cols[y].sum() for y in range(len(ink))), door)

    def test_timed_lamps_differ(self):
        a = [np.array(self.fr[f'timed_door_cap_{s}_00']) for s in ('pending', 'open', 'missed')]
        self.assertFalse((a[0] == a[1]).all())
        self.assertFalse((a[1] == a[2]).all())

    def test_arrows_are_rotations(self):
        a = [np.array(self.fr[f'guide_arrow_{i:02d}']) for i in range(8)]   # 0 = right, then 45° steps ccw
        for i in (0, 1):
            for k in (1, 2, 3):
                np.testing.assert_array_equal(np.rot90(a[i], k), a[(i + 2 * k) % 8])

    def test_deco_tiles(self):
        sheet = np.array(T.build_sheet('plains'))
        for col in range(8, 16):
            x, y = 1 + col * 18, 1 + 7 * 18
            self.assertTrue((sheet[y:y + 16, x:x + 16, 3] > 0).any(), ('top deco', col))
        for col in range(0, 8):
            x, y = 1 + col * 18, 1 + 8 * 18
            self.assertTrue((sheet[y:y + 16, x:x + 16, 3] > 0).any(), ('hanging deco', col))
        for col in range(0, 8):                          # no water in Plains
            x, y = 1 + col * 18, 1 + 7 * 18
            self.assertFalse((sheet[y:y + 16, x:x + 16, 3] > 0).any(), ('water', col))


if __name__ == '__main__':
    unittest.main()
