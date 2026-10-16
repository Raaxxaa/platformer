import unittest
import numpy as np
import _path  # noqa: F401
from art import tiles as T
from art import backgrounds as B
from art import palette as P


class TilesTest(unittest.TestCase):
    def test_blob_masks(self):
        self.assertEqual(len(T.BLOB_MASKS), 47)
        self.assertEqual(T.BLOB_MASKS[0], 0)
        self.assertEqual(T.BLOB_MASKS[21], 85)
        self.assertEqual(T.BLOB_MASKS[31], 124)
        self.assertEqual(T.BLOB_MASKS[46], 255)
        self.assertEqual(T.BLOB_MASKS, sorted(T.BLOB_MASKS))
        for m in range(256):
            self.assertIn(T.reduce_mask(m), T.BLOB_MASKS)

    def test_diagonal_rule(self):
        # N and E set, NE empty differs from NE set
        self.assertNotEqual(T.reduce_mask(1 | 4), T.reduce_mask(1 | 2 | 4))
        self.assertEqual(T.reduce_mask(2), 0)

    def test_sheet_layout_and_extrusion(self):
        sheet = np.array(T.build_sheet('plains'))
        self.assertEqual(sheet.shape[:2], (1 + 9 * 18 - 1, 1 + 16 * 18 - 1))
        used = T.used_cells()
        for (c, r) in used:
            x, y = 1 + c * 18, 1 + r * 18
            t = sheet[y:y + 16, x:x + 16]
            self.assertTrue((t[:, :, 3] > 0).any(), (c, r))
            np.testing.assert_array_equal(sheet[y - 1, x:x + 16], t[0])
            np.testing.assert_array_equal(sheet[y + 16, x:x + 16], t[15])
            np.testing.assert_array_equal(sheet[y:y + 16, x - 1], t[:, 0])
            np.testing.assert_array_equal(sheet[y:y + 16, x + 16], t[:, 15])
        # unused cells stay empty
        x, y = 1 + 12 * 18, 1 + 3 * 18
        self.assertFalse((sheet[y:y + 16, x:x + 16, 3] > 0).any())

    def test_palette(self):
        from PIL import Image
        img = Image.fromarray(np.array(T.build_sheet('plains')), 'RGBA')
        P.check_palette_lock(img, P.allowed(T.ALLOWED), 'tiles_plains')


class BackgroundsTest(unittest.TestCase):
    def test_seamless(self):
        for i in range(3):
            one = np.array(B.render('plains', i, 640))
            two = np.array(B.render('plains', i, 1280))
            self.assertEqual(one.shape, (360, 640, 4))
            np.testing.assert_array_equal(two[:, :640], one)
            np.testing.assert_array_equal(two[:, 640:], one)

    def test_layers(self):
        l0 = np.array(B.render('plains', 0, 640))
        self.assertTrue((l0[:, :, 3] == 255).all())      # layer 0 holds the sky
        for i in (1, 2):
            li = np.array(B.render('plains', i, 640))
            self.assertTrue((li[0, :, 3] == 0).all())     # transparent above the shapes
            self.assertTrue((li[-1, :, 3] == 255).all())
        for i in range(3):
            from PIL import Image
            P.check_palette_lock(B.render('plains', i, 640), P.allowed(B.ALLOWED[i]), f'bg_plains_{i}')


if __name__ == '__main__':
    unittest.main()
