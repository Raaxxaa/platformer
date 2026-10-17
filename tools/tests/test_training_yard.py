import json
import os
import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art import village as V

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')


class TrainingYardTest(unittest.TestCase):
    def test_enemy_frames(self):
        fr = V.dummy_frames()
        want = {'sparring_dummy_idle': (1, (48, 48)), 'sparring_dummy_tele': (2, (48, 48)),
                'sparring_dummy_atk_practice_swing': (3, (96, 48)), 'sparring_dummy_hit': (3, (48, 48)),
                'straw_target_idle': (1, (32, 32)), 'straw_target_death': (4, (32, 32))}
        for k, (n, size) in want.items():
            for i in range(n):
                img = fr[f'{k}_{i:02d}']
                self.assertEqual(img.size, size, k)
                a = np.array(img)[:, :, 3] > 0
                self.assertTrue(a.any(), k)

    def test_reach_rule(self):
        # 08 §4.1: the attack box fits the 96 × 48 frame around anchor (48, 46)
        dx, dy, w, h = V.SPARRING_BOX
        ax, ay, fh = 48, 46, 48
        self.assertLessEqual(abs(dx) + w / 2, ax)
        self.assertLessEqual(h / 2 - dy, ay)
        self.assertLessEqual(dy + h / 2, fh - ay)
        # the active swing frame's sword reaches into the box
        a = np.array(V.dummy_frames()['sparring_dummy_atk_practice_swing_01'])[:, :, 3] > 0
        x0, x1 = int(ax + dx - w / 2), int(ax + dx + w / 2)
        y0, y1 = int(ay + dy - h / 2), int(ay + dy + h / 2)
        self.assertTrue(a[y0:y1, x0 + w // 2:x1].any())

    def test_objects(self):
        fr = V.yard_object_frames()
        for k, size in {'station_sign_00': (24, 32), 'station_flag_grey_00': (8, 24),
                        'station_flag_green_00': (8, 24), 'training_gate_00': (32, 64)}.items():
            self.assertEqual(fr[k].size, size, k)
            P.check_palette_lock(fr[k], P.allowed(V.ALLOWED), 'objects', k)

    def test_yard_enemies_left_out_of_anims_json(self):
        keys = {a['key'] for a in V.anims()}
        for a in V.YARD_ENEMY_ANIMS:
            self.assertNotIn(a['key'], keys)
        self.assertIn('training_dummy_idle', keys)


if __name__ == '__main__':
    unittest.main()
