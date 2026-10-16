import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art import outfits as player_art
from art.boxes import PLAYER_HURTBOX

OUTFITS = ['swordsman', 'tank', 'archer', 'wizard']


class PlayerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.built = {o: player_art.build_outfit(o) for o in OUTFITS}

    def test_frame_lists_match(self):
        names = None
        for o in OUTFITS:
            body, trim = self.built[o]
            self.assertEqual(['a/' + n for n in sorted(body)], sorted(k for k in trim if k.startswith('a/')))
            self.assertEqual(['b/' + n for n in sorted(body)], sorted(k for k in trim if k.startswith('b/')))
            if names is None:
                names = sorted(body)
            self.assertEqual(sorted(body), names)
        self.assertEqual(len([n for n in names if n.startswith('idle_')]), 6)
        self.assertEqual(len([n for n in names if n.startswith('run_')]), 8)

    def test_colors(self):
        body_ok = P.allowed(player_art.BODY_RAMPS)
        trim_ok = P.allowed(['trim'])
        for o in OUTFITS:
            body, trim = self.built[o]
            for n, img in body.items():
                self.assertEqual(img.size, (48, 48))
                P.check_palette_lock(img, body_ok, 'player_' + o, n)
            for n, img in trim.items():
                P.check_palette_lock(img, trim_ok, 'player_%s_trim' % o, n)

    def test_sole_row(self):
        for o in OUTFITS:
            body, _ = self.built[o]
            for n, img in body.items():
                a = np.array(img)[:, :, 3]
                rows = np.nonzero(a.any(axis=1))[0]
                if n.startswith('idle'):
                    self.assertEqual(rows.max(), 45, (o, n))
                self.assertLessEqual(rows.max(), 45, (o, n))

    def test_idle_silhouette_matches_hurtbox(self):
        w, h = PLAYER_HURTBOX
        left, right, top = 24 - w // 2, 24 + w // 2, 46 - h
        for o in OUTFITS:
            body, trim = self.built[o]
            a = np.array(body['idle_00'])[:, :, 3] > 0
            a |= np.array(trim['a/idle_00'])[:, :, 3] > 0
            a |= np.array(trim['b/idle_00'])[:, :, 3] > 0
            # left/right: torso and legs (rows from the shoulders down)
            cols = np.nonzero(a[26:46].any(axis=0))[0]
            self.assertLessEqual(abs(cols.min() - left), 2, (o, 'left', cols.min()))
            self.assertLessEqual(abs(cols.max() + 1 - right), 2, (o, 'right', cols.max() + 1))
            # top: headwear (hat, plume) is left out; hair and hood may exceed by up to 4 px
            from art.poses.player import POSES
            core = [np.array(im)[:, :, 3] > 0 for im in player_art.render(
                player_art.draw(o, POSES['idle'][0], skip=player_art.HEADWEAR))]
            rows = np.nonzero((core[0] | core[1] | core[2]).any(axis=1))[0]
            self.assertTrue(top - 2 - 4 <= rows.min() <= top + 2, (o, 'top', rows.min()))


if __name__ == '__main__':
    unittest.main()
