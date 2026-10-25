import json
import os
import unittest
import numpy as np
import _path  # noqa: F401
from art import look as LK
from art import palette as P
from art.poses.player import POSES

FRAMES = sorted(f'{k}_{i:02d}' for k, v in POSES.items() for i in range(len(v)))
GREY = P.allowed(['grey4', 'ink'])
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')


class LookLayersTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.atl, cls.pts = LK.layers()

    def test_every_layer_atlas_has_the_full_frame_list(self):
        want = {f'player_skin_{r}' for r in LK.RACES}
        want |= {f'player_outfitA_{o}' for o in LK.OUTFITS} | {f'player_outfitB_{o}' for o in LK.OUTFITS}
        want |= {f'player_fixed_{r}_{o}' for r in LK.RACES for o in LK.OUTFITS}
        want |= {f'player_face_{f}' for f in LK.FACES}
        want |= {f'player_hair_{h}{s}' for h in LK.HAIRS if h != 'bald' for s in ('', '_hat')}
        want |= {f'player_beard_{b}' for b in LK.BEARDS if b != 'none'}
        want |= {'player_headwear_plate', 'player_headwear_robe'}
        for name in want:
            frames = self.atl[name]
            self.assertEqual(sorted(frames), FRAMES, name)
            for im in frames.values():
                self.assertEqual(im.size, (48, 48))
        for o in LK.OUTFITS:
            frames = self.atl[f'player_{o}_trim']
            self.assertEqual(sorted(k for k in frames if k.startswith('a/')), ['a/' + f for f in FRAMES])
            self.assertEqual(sorted(k for k in frames if k.startswith('b/')), ['b/' + f for f in FRAMES])
        self.assertEqual(set(self.atl), want | {f'player_{o}_trim' for o in LK.OUTFITS})

    def test_palette(self):
        fixed = P.allowed(['ink', 'p_cloth', 'p_leather', 'p_steel', 'white', 'fx_heal'])
        for name, frames in self.atl.items():
            kind = name.split('_')[1]
            if name.endswith('_trim'):
                ok = P.allowed(['trim'])
            elif kind in LK.GREY_ATLASES or name.startswith('player_headwear_robe'):
                ok = GREY
            elif kind == 'face':
                ok = P.allowed(['ink'])
            else:                                          # fixed layers and the plate helmet: real colors, no greys
                ok = fixed
            for fname, im in frames.items():
                P.check_palette_lock(im, ok, name, fname)

    def test_feet_on_the_floor(self):
        for race in LK.RACES:
            for outfit in LK.OUTFITS:
                low = lambda f: max((np.nonzero(np.array(LK.compose(f, dict(race=race, outfit=outfit)))[:, :, 3].any(axis=1))[0]))
                self.assertEqual(low('idle_00'), 45, (race, outfit))
        for f in FRAMES:
            im = LK.compose(f, dict(outfit='leather'))
            self.assertLessEqual(int(np.nonzero(np.array(im)[:, :, 3].any(axis=1))[0].max()), 45, f)

    def test_cloth_and_trims_are_the_same_for_every_race(self):
        """09 §1: the races differ only in skin, face and fixed details; the shared cloth/trim layers stay identical."""
        for key in ('idle', 'run', 'dead', 'jump', 'atk_greatsword_1', 'drink'):
            for i, pose in enumerate(POSES[key]):
                sp = {(o, r): LK.split(LK.draw_figure(o, pose, r)[0]) for o in LK.OUTFITS for r in LK.RACES}
                for o in LK.OUTFITS:
                    for r in LK.RACES[1:]:
                        for lay in ('A', 'B', 'trim_a', 'trim_b'):
                            self.assertTrue(((sp[(o, r)][lay] >= 0) == (sp[(o, 'human')][lay] >= 0)).all(),
                                            (key, i, o, r, lay))
                for r in LK.RACES:
                    skin = np.full((48, 48), -1)
                    for o in LK.OUTFITS:
                        skin = np.where(skin < 0, sp[(o, r)]['skin'], skin)
                    for o in LK.OUTFITS:
                        own = np.zeros((48, 48), bool)
                        for a in sp[(o, r)].values():
                            own |= a >= 0
                        self.assertFalse(((skin >= 0) & ~own).any(), ('skin pokes out', key, i, o, r))

    def test_attachment_points_in_anims_json(self):
        anims = json.load(open(os.path.join(ROOT, 'public', 'assets', 'anims.json')))
        seen = 0
        for a in anims:
            if 'points' not in a:
                continue
            seen += 1
            self.assertIn(a['outfit'], LK.OUTFITS)
            self.assertEqual(len(a['points']), len(a['frames']), a['key'])
            for p in a['points']:
                self.assertEqual(sorted(p), ['back', 'head', 'neck', 'shoulder'])
                for x, y in p.values():
                    self.assertTrue(0 <= x < 48 and 0 <= y < 48, (a['key'], p))
        self.assertGreater(seen, 4 * 70)

    def test_manifest(self):
        m = json.load(open(os.path.join(ROOT, 'public', 'assets', 'look.json')))
        self.assertEqual(m['races'], LK.RACES)
        self.assertEqual(len(m['colors']['skin']), 6)
        self.assertEqual(len(m['colors']['skinOrc']), 4)
        self.assertEqual(len(m['colors']['dye']), 8)
        self.assertEqual(len(m['colors']['dyeShop']), 8)
        self.assertEqual(len(m['colors']['hairShop']), 6)
        self.assertEqual(m['greys'], ['#707070', '#a0a0a0', '#d0d0d0', '#ffffff'])


if __name__ == '__main__':
    unittest.main()
