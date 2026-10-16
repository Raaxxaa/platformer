import unittest
from PIL import Image
import _path  # noqa: F401
from art import palette as P


class PaletteTest(unittest.TestCase):
    def test_ink(self):
        self.assertEqual(P.RAMPS['ink'], [(13, 11, 20)])

    def test_pl_grass_order(self):
        self.assertEqual(P.RAMPS['pl_grass'], [(0x1f, 0x3f, 0x2a), (0x2c, 0x63, 0x34), (0x4c, 0x93, 0x3a), (0x8b, 0xc5, 0x4a)])

    def test_sky_bands(self):
        b = P.sky_bands((0x78, 0xbf, 0xe6), (0xd9, 0xee, 0xf0))
        self.assertEqual(len(b), 6)
        self.assertEqual(b[0], (0x78, 0xbf, 0xe6))
        self.assertEqual(b[-1], (0xd9, 0xee, 0xf0))

    def test_lock_passes_and_fails(self):
        ok = P.allowed(['ink', 'white'])
        img = Image.new('RGBA', (4, 4), (0, 0, 0, 0))
        img.putpixel((1, 1), (13, 11, 20, 255))
        P.check_palette_lock(img, ok, 'test')
        img.putpixel((2, 3), (14, 11, 20, 255))
        with self.assertRaises(P.PaletteError) as cm:
            P.check_palette_lock(img, ok, 'test')
        self.assertEqual((cm.exception.x, cm.exception.y), (2, 3))
        img2 = Image.new('RGBA', (2, 2), (0, 0, 0, 0))
        img2.putpixel((0, 0), (13, 11, 20, 128))
        with self.assertRaises(P.PaletteError):
            P.check_palette_lock(img2, ok, 'test')


if __name__ == '__main__':
    unittest.main()
