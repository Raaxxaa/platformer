import os
import tempfile
import unittest
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
import _path  # noqa: F401
from art import fonts as F

CHARSET = [chr(c) for c in range(32, 127)] + list('×·−—±←↑→↓▸★…')


class FontsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.TemporaryDirectory()
        F.build(cls.dir.name)

    @classmethod
    def tearDownClass(cls):
        cls.dir.cleanup()

    def load(self, name):
        root = ET.parse(os.path.join(self.dir.name, name + '.xml')).getroot()
        chars = {int(c.get('id')): {k: int(v) for k, v in c.attrib.items()} for c in root.iter('char')}
        return root, chars

    def test_charset_and_glyphs(self):
        self.assertEqual(len(CHARSET), 107)
        self.assertEqual(set(F.GLYPHS), set(CHARSET))

    def test_metrics(self):
        spec = {'rb_small': (11, 7, 7, 5, 6, 4, -1), 'rb_small_plain': (10, 7, 7, 5, 6, 4, 0),
                'rb_large': (22, 14, 14, 10, 12, 8, -1)}
        for name, (lh, base, size, dw, dadv, sadv, off) in spec.items():
            root, chars = self.load(name)
            self.assertEqual(int(root.find('common').get('lineHeight')), lh, name)
            self.assertEqual(int(root.find('common').get('base')), base, name)
            self.assertEqual(int(root.find('info').get('size')), size, name)
            self.assertEqual(root.find('common').get('pages'), '1')
            self.assertEqual(set(chars), {ord(c) for c in CHARSET}, name)
            pad = 2 if off else 0
            for d in '0123456789':
                c = chars[ord(d)]
                self.assertEqual(c['width'] - pad, dw, (name, d))
                self.assertEqual(c['xadvance'], dadv, (name, d))
            self.assertEqual(chars[32]['xadvance'], sadv, name)
            for c in chars.values():
                if c['id'] != 32:
                    self.assertEqual((c['xoffset'], c['yoffset']), (off, off), (name, c['id']))

    def test_colors(self):
        for name in ('rb_small', 'rb_small_plain', 'rb_large'):
            a = np.array(Image.open(os.path.join(self.dir.name, name + '.png')).convert('RGBA')).reshape(-1, 4)
            cols = {tuple(px[:3]) for px in a if px[3]}
            self.assertTrue(cols <= {(255, 255, 255), (13, 11, 20)}, name)
            self.assertTrue(set(np.unique(a[:, 3])) <= {0, 255})
            if name == 'rb_small_plain':
                self.assertNotIn((13, 11, 20), cols)


if __name__ == '__main__':
    unittest.main()
