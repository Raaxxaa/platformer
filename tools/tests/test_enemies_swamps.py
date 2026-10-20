import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art.boxes import HURTBOX, ATTACK_BOX
from art.enemies import swamps as S

STANDARD = {'hurt': 1, 'stagger': 2, 'knockdown': 2, 'death': 4}
EXPECTED = {
    'bog_zombie': dict(STANDARD, idle=4, walk=6, atk_rise_swipe=7, atk_claw=5, atk_grab_lunge=6),
    'giant_spider': dict(STANDARD, idle=4, walk=6, hang=2, atk_drop=5, atk_bite=5, atk_pounce=6),
    'wisp': dict(STANDARD, float=4, atk_detonate=5),
    'swamp_witch': dict(STANDARD, idle=4, walk=6, atk_poison_potion=5, atk_claw=5, atk_hex_hop=6),
    'treant': dict(STANDARD, idle=4, walk=6, atk_root_snare=5, atk_branch_slam=5),
}
SKIPPED = {('wisp', 'detonate'), ('treant', 'root_snare')}


class EnemiesSwampsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frames, cls.anims = S.build_frames()

    def test_every_anim_with_count_and_size(self):
        for enemy, want in EXPECTED.items():
            for anim, n in want.items():
                key = f'{enemy}_{anim}'
                names = [f for f in self.frames if f.rsplit('_', 1)[0] == key]
                self.assertEqual(len(names), n, key)
                size, _ = S.frame_size(enemy, anim)
                for f in names:
                    self.assertEqual(self.frames[f].size, size, f)
                self.assertIn(key, {a['key'] for a in self.anims})

    def test_attack_segments(self):
        by = {a['key']: a for a in self.anims}
        self.assertEqual(by['bog_zombie_atk_rise_swipe']['segments'][0]['frames'], [0, 1, 2, 3])   # 4 Tele frames
        self.assertEqual(by['wisp_atk_detonate']['segments'][0]['frames'], [0, 1, 2, 3])
        self.assertEqual(by['treant_walk']['fps'], 6)                                               # fixed 6 fps

    def test_reach_rule(self):
        for enemy, attacks in ATTACK_BOX.items():
            if enemy not in EXPECTED:
                continue
            for atk, box in attacks.items():
                if box is None or (enemy, atk) in SKIPPED:
                    continue
                (fw, fh), (ax, ay) = S.frame_size(enemy, 'atk_' + atk)
                dx, dy, w, h = box
                self.assertLessEqual(abs(dx) + w / 2, ax, (enemy, atk))
                self.assertLessEqual(h / 2 - dy, ay, (enemy, atk))
                self.assertLessEqual(dy + h / 2, fh - ay, (enemy, atk))

    def test_sole_and_palette(self):
        world = P.allowed(P.SWAMPS_WORLD_RAMPS) - set(P.RAMPS['ink']) - set(P.RAMPS['white'])
        allowed = P.allowed(P.SWAMPS_ENEMY_RAMPS)
        for name, img in self.frames.items():
            enemy = next(e for e in EXPECTED if name.startswith(e + '_'))
            _s, (ax, ay) = S.frame_size(enemy, name[len(enemy) + 1:])
            self.assertFalse((np.array(img)[:, :, 3] > 0)[ay:].any(), name)
            P.check_palette_lock(img, allowed, S.ATLAS, name)
            cols = {tuple(c[:3]) for c in np.array(img).reshape(-1, 4) if c[3] == 255}
            self.assertFalse(cols & world, name)

    def test_idle_rests_on_the_sole(self):
        for enemy in ('bog_zombie', 'giant_spider', 'swamp_witch', 'treant'):
            _s, (ax, ay) = S.frame_size(enemy, 'idle')
            a = np.array(self.frames[f'{enemy}_idle_00'])[:, :, 3] > 0
            self.assertEqual(np.nonzero(a.any(axis=1))[0].max(), ay - 1, enemy)

    def test_hurtboxes_known(self):
        for e in EXPECTED:
            self.assertIn(e, HURTBOX)


class SwampWorldTest(unittest.TestCase):
    def test_tiles_and_backgrounds(self):
        from art import tiles as T, backgrounds as B
        cells = T.tile_cells('swamps')
        for c in range(8):
            self.assertIn((c, 7), cells)                       # water surface (0-3) and body (4-7) frames
        P.check_palette_lock(T.build_sheet('swamps'), P.allowed(T.SW_ALLOWED), 'tiles_swamps')
        for i in range(3):
            one = np.array(B.render('swamps', i, 640))
            two = np.array(B.render('swamps', i, 1280))
            np.testing.assert_array_equal(two[:, :640], one)
            np.testing.assert_array_equal(two[:, 640:], one)
            P.check_palette_lock(B.render('swamps', i, 640), P.allowed(B.SW_ALLOWED[i]), f'bg_swamps_{i}')


if __name__ == '__main__':
    unittest.main()
