"""ART9 checks (08 test 22): every music JSON is valid against instruments.json, and building twice gives the same bytes."""
import hashlib
import json
import os
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'tools'))

from audio import render_music  # noqa: E402
from audio.music import tracks  # noqa: E402


class MusicTests(unittest.TestCase):
    def test_all_tracks_present_and_valid(self):
        music = os.path.join(ROOT, 'public', 'assets', 'music')
        inst = {m['id']: m for m in json.load(open(os.path.join(ROOT, 'public', 'assets', 'audio', 'inst', 'instruments.json')))}
        self.assertEqual(sorted(tracks.ORDER), sorted(f[:-5] for f in os.listdir(music)))
        for tid in tracks.ORDER:
            tr = json.load(open(os.path.join(music, tid + '.json')))
            self.assertLessEqual(tr['loopStartBar'], tr['bars'])
            step = 60.0 / tr['bpm'] / 4
            for c in tr['channels']:
                self.assertIn(c['inst'], inst)
                self.assertIn(c['layer'], ('base', 'L1', 'L2', 'L3'))
                for s, midi, ln, vel in c['notes']:
                    self.assertLess(s, tr['bars'] * 16)
                    self.assertLessEqual(ln * step, inst[c['inst']]['seconds'] + 1e-9)

    def test_deterministic(self):
        def digest(root):
            h = hashlib.sha256()
            for d in ('music', 'audio/inst'):
                base = os.path.join(root, 'public', 'assets', d)
                for f in sorted(os.listdir(base)):
                    h.update(open(os.path.join(base, f), 'rb').read())
            return h.hexdigest()
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            render_music.build(a)
            render_music.build(b)
            self.assertEqual(digest(a), digest(b))


if __name__ == '__main__':
    unittest.main()
