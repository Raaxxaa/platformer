import unittest
import _path  # noqa: F401
from art import palette as P
from art import projectiles as PR
from art import vfx as VX
from art import contrast

PROJ = {'enemy_arrow': ((12, 4), 1), 'brute_wave': ((16, 12), 2), 'shockwave': ((16, 16), 2),
        'falling_rock': ((18, 18), 1), 'falling_rock_shatter': ((18, 18), 4)}
FX = {'hit_spark': ((16, 16), 3), 'hit_heavy': ((32, 32), 4), 'crit_spark': ((24, 24), 4),
      'stun_stars': ((16, 8), 4), 'dust_land': ((24, 8), 4), 'dust_jump': ((16, 8), 4), 'muzzle': ((8, 8), 2),
      'debris': ((2, 2), 4)}


class ProjectilesVfxTest(unittest.TestCase):
    def check(self, frames, table, allowed, atlas):
        for key, (size, n) in table.items():
            names = [f for f in frames if f.rsplit('_', 1)[0] == key]
            self.assertEqual(len(names), n, key)
            for f in names:
                self.assertEqual(frames[f].size, size, f)
                P.check_palette_lock(frames[f], P.allowed(allowed), atlas, f)
                self.assertTrue(any(px[3] for px in frames[f].getdata()), f)

    def test_projectiles(self):
        fr, anims = PR.build_frames()
        self.check(fr, PROJ, PR.ALLOWED, 'projectiles')
        self.assertLessEqual(set(PROJ), {a['key'] for a in anims})
        world = P.allowed(P.PLAINS_WORLD_RAMPS)
        for f, img in fr.items():
            cols = {px[:3] for px in img.getdata() if px[3]}
            self.assertFalse(cols & (world - P.allowed(['ink', 'white'])), f)

    def test_vfx(self):
        fr, anims = VX.build_frames()
        self.check(fr, FX, VX.ALLOWED, 'vfx')
        self.assertTrue(set(FX) <= {a['key'] for a in anims})
        # spark cores are white so code can add the element color around them
        for k in ('hit_spark_00', 'hit_heavy_00'):
            self.assertIn((255, 255, 255, 255), list(fr[k].getdata()))

    def test_projectile_contrast(self):
        lines = contrast.report_lines()
        accepted = contrast.accepted_fails()
        for p in ('enemy_arrow', 'brute_wave', 'shockwave', 'falling_rock'):
            mine = [l for l in lines if l.split()[0] == p]
            self.assertEqual(len(mine), 4, p)
            bad = [l for l in mine if l.endswith('FAIL') and ' '.join(l.split()[:2]) not in accepted]
            self.assertEqual(bad, [], p)


if __name__ == '__main__':
    unittest.main()
