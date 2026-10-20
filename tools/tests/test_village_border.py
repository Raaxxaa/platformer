import unittest
import numpy as np
import _path  # noqa: F401
from art import backgrounds as B
from art import palette as P
from art import village as VL


class VillageBorderTest(unittest.TestCase):
    def test_backgrounds_seamless_and_locked(self):
        for i in range(3):
            one = np.array(B.render('village_border', i, 640))
            two = np.array(B.render('village_border', i, 1280))
            self.assertEqual(one.shape, (360, 640, 4))
            np.testing.assert_array_equal(two[:, :640], one)
            np.testing.assert_array_equal(two[:, 640:], one)
            P.check_palette_lock(B.render('village_border', i, 640), P.allowed(B.BORDER_ALLOWED[i]),
                                 f'bg_village_border_{i}')
        self.assertTrue((np.array(B.render('village_border', 0, 640))[:, :, 3] == 255).all())

    def test_props_match_the_crossroads_ones(self):
        fr = VL.building_frames()
        self.assertEqual(fr['market_roof_border_00'].size, fr['market_roof_00'].size)
        self.assertEqual(fr['inn_border_00'].size, fr['inn_00'].size)
        for n in ('market_roof_border_00', 'inn_border_00'):
            P.check_palette_lock(fr[n], P.allowed(VL.ALLOWED), 'objects', n)


if __name__ == '__main__':
    unittest.main()
