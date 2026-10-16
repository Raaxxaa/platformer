import unittest
import _path  # noqa: F401
from art import palette as P
from art import vfx as VX

NEW = {'ring_djump': ((20, 6), 4), 'dust_walljump': ((12, 12), 4), 'dust_wall': ((2, 2), 1),
       'dust_slide': ((2, 2), 1), 'dive_trail': ((2, 12), 1), 'dive_impact': ((48, 16), 5),
       'dive_impact_heavy': ((64, 16), 5), 'dive_bounce': ((16, 16), 3), 'spike_spark': ((16, 16), 3),
       'guard_spark': ((16, 16), 3), 'charge_glow': ((3, 3), 1), 'charge_full': ((12, 12), 3),
       'explosion_s': ((56, 56), 6), 'explosion_l': ((96, 96), 6), 'flask_orb': ((4, 4), 1), 'heal': ((5, 5), 1),
       'rush_up': ((32, 32), 4), 'dash_refund': ((16, 16), 3), 'spawn_in': ((32, 48), 6), 'curse_wisps': ((6, 6), 2)}


class VfxTest(unittest.TestCase):
    def test_new_effects(self):
        fr, anims = VX.build_frames()
        keys = {a['key'] for a in anims}
        for key, (size, n) in NEW.items():
            names = [f for f in fr if f.rsplit('_', 1)[0] == key]
            self.assertEqual(len(names), n, key)
            self.assertIn(key, keys)
            for f in names:
                self.assertEqual(fr[f].size, size, f)
                P.check_palette_lock(fr[f], P.allowed(VX.ALLOWED) | {P.UI_COLORS['rush2']}, 'vfx', f)
                self.assertTrue(any(px[3] for px in fr[f].getdata()), f)


if __name__ == '__main__':
    unittest.main()
