import json
import os
import tempfile
import unittest
from PIL import Image
import _path  # noqa: F401
from art import atlas as A


class AtlasTest(unittest.TestCase):
    def test_pack_order_and_json(self):
        frames = {
            'idle_00': Image.new('RGBA', (48, 48), (255, 0, 0, 255)),
            'idle_01': Image.new('RGBA', (48, 48), (0, 255, 0, 255)),
            'walk_00': Image.new('RGBA', (48, 48), (0, 0, 255, 255)),
            'atk_slash_00': Image.new('RGBA', (96, 48), (9, 9, 9, 255)),
        }
        with tempfile.TemporaryDirectory() as d:
            meta = A.pack_atlas('t', frames, d)
            data = json.load(open(os.path.join(d, 't.json')))
            self.assertTrue(os.path.exists(os.path.join(d, 't.png')))
        fr = data['frames']
        self.assertEqual(set(fr), set(frames))
        big = fr['atk_slash_00']['frame']
        self.assertEqual((big['x'], big['y']), (2, 2))
        for name, img in frames.items():
            self.assertEqual(fr[name]['sourceSize'], {'w': img.width, 'h': img.height})
            self.assertFalse(fr[name]['rotated'])
            self.assertFalse(fr[name]['trimmed'])
        self.assertEqual(data['meta']['image'], 't.png')
        self.assertIn('atk_slash_00', meta['frames'])

    def test_frame_names(self):
        self.assertEqual(A.frame_names('walk', 3), ['walk_00', 'walk_01', 'walk_02'])
        with self.assertRaises(ValueError):
            A.check_frame_name('walk_0')


if __name__ == '__main__':
    unittest.main()
