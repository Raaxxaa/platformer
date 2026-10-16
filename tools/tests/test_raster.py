import unittest
import numpy as np
import _path  # noqa: F401
from art import raster as R

INK = 0


class RasterTest(unittest.TestCase):
    def test_auto_shade_square(self):
        L = R.PartLayer(10, 10)
        L.add_part('box', [10, 11, 12])  # dark, base, light slot ids
        R.fill_rect(L, 2, 2, 6, 6, 'box')
        c = R.auto_shade(L)
        self.assertEqual(c.a[2, 4], 12)   # top edge light
        self.assertEqual(c.a[4, 2], 12)   # left edge light
        self.assertEqual(c.a[7, 4], 10)   # bottom edge dark
        self.assertEqual(c.a[4, 7], 10)   # right edge dark
        self.assertEqual(c.a[4, 4], 11)   # inside base
        self.assertEqual(c.a[0, 0], -1)

    def test_outline_single_pixel(self):
        c = R.Canvas(5, 5)
        c.a[2, 2] = 7
        R.outline(c, INK)
        self.assertEqual(int((c.a == INK).sum()), 4)
        for y, x in [(1, 2), (3, 2), (2, 1), (2, 3)]:
            self.assertEqual(c.a[y, x], INK)

    def test_capsule_width(self):
        L = R.PartLayer(16, 9)
        L.add_part('p', [1, 2, 3])
        R.capsule(L, (2, 4), (12, 4), 3, 'p')
        col = L.ids[:, 7]
        self.assertEqual(int((col >= 0).sum()), 3)

    def test_deterministic(self):
        def make():
            L = R.PartLayer(20, 20)
            L.add_part('a', [1, 2, 3])
            R.ellipse(L, 10, 10, 6, 4, 'a')
            R.line(L, (0, 0), (19, 13), 'a')
            R.fill_polygon(L, [(1, 18), (9, 12), (15, 19)], 'a')
            return R.auto_shade(L).a
        self.assertTrue(np.array_equal(make(), make()))


if __name__ == '__main__':
    unittest.main()
