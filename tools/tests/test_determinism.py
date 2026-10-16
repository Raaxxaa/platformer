import hashlib
import os
import sys
import tempfile
import unittest
import _path  # noqa: F401

sys.path.insert(0, os.path.dirname(_path.TOOLS))
import importlib.util  # noqa: E402

spec = importlib.util.spec_from_file_location('build_assets', os.path.join(_path.TOOLS, 'build_assets.py'))
build_assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_assets)


def hashes(root):
    out = {}
    for d, _dirs, files in os.walk(root):
        for f in files:
            p = os.path.join(d, f)
            out[os.path.relpath(p, root)] = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    return out


class DeterminismTest(unittest.TestCase):
    def test_two_builds_are_byte_identical(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            build_assets.build(a)
            build_assets.build(b)
            ha, hb = hashes(a), hashes(b)
        self.assertGreater(len(ha), 20)
        self.assertEqual(ha, hb)

    def test_committed_assets_match_a_fresh_build(self):
        root = os.path.dirname(_path.TOOLS)
        with tempfile.TemporaryDirectory() as a:
            build_assets.build(a)
            fresh = hashes(os.path.join(a, 'public', 'assets'))
        committed = hashes(os.path.join(root, 'public', 'assets'))
        self.assertEqual(fresh, committed)


if __name__ == '__main__':
    unittest.main()
