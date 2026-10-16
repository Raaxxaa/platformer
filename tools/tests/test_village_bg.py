import unittest
import numpy as np
import _path  # noqa: F401
from art import backgrounds as B
from art import palette as P
from art import village as V


class VillageBackgroundsTest(unittest.TestCase):
    def test_palette_and_seamless(self):
        for s in ('village_home', 'village_crossroads'):
            for i in range(3):
                one = B.render(s, i, 640)
                P.check_palette_lock(one, P.allowed(B.allowed_for(s, i)), f'bg_{s}_{i}')
                two = np.array(B.render(s, i, 1280))
                a = np.array(one)
                self.assertEqual(a.shape, (360, 640, 4))
                np.testing.assert_array_equal(two[:, :640], a)
                np.testing.assert_array_equal(two[:, 640:], a)
            self.assertTrue((np.array(B.render(s, 0))[:, :, 3] == 255).all())

    def test_skies(self):
        self.assertEqual(P.RAMPS['vh_sky'][0], (0xf2, 0xb4, 0x8a))
        self.assertEqual(P.RAMPS['vh_sky'][-1], (0xfb, 0xe6, 0xc8))
        self.assertEqual(P.RAMPS['vc_sky'][0], (0xe0, 0x78, 0x5a))
        self.assertEqual(P.RAMPS['vc_sky'][-1], (0xf6, 0xc8, 0x90))
        top = np.array(B.render('village_home', 0))[0, 0, :3]
        self.assertEqual(tuple(top), (0xf2, 0xb4, 0x8a))

    def test_buildings(self):
        fr = V.building_frames()
        for k in ('cottage_a_00', 'cottage_b_00', 'well_00', 'market_roof_00', 'inn_00'):
            self.assertIn(k, fr)
            P.check_palette_lock(fr[k], P.allowed(V.ALLOWED), 'objects', k)
        # market roof spans tiles 7-37
        self.assertEqual(fr['market_roof_00'].width, (37 - 7 + 1) * 16)
        # the inn's door covers tiles 41-43, rows 16-19 (06 §12.2)
        x0, y0, x1, y1 = V.inn_door_world()
        self.assertEqual((x0, y0, x1, y1), (41 * 16, 16 * 16, 44 * 16, 20 * 16))
        img = np.array(fr['inn_00'])
        ox, oy = V.INN_ORIGIN
        door = img[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
        self.assertTrue((door[:, :, 3] == 255).all())
        self.assertEqual(img.shape[0] + oy, 320)


if __name__ == '__main__':
    unittest.main()
