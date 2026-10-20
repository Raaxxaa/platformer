import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art.boxes import HURTBOX, ATTACK_BOX
from art.enemies import mountains as M

STANDARD = {'idle': 4, 'walk': 6, 'hurt': 1, 'stagger': 2, 'knockdown': 2, 'death': 4}
EXPECTED = {
    'bat_swarm': {'fly': 4, 'atk_dive_bite': 5, 'hurt': 1, 'stagger': 2, 'knockdown': 2, 'death': 4},
    'goblin_miner': dict(STANDARD, atk_bomb_toss=5, atk_pick_swing=5),
    'rock_golem': dict(STANDARD, turn=2, atk_fist_slam=5, atk_shoulder_ram=6),
    'ram': dict(STANDARD, atk_headbutt=6, atk_leap_butt=6),
    'goblin_shaman': dict(STANDARD, atk_stone_ward=5, atk_hex_bolt=5, atk_stone_spikes=5),
}
# 08 §4.1: area effects drawn by VFX instead of the enemy's frames are skipped by the reach rule
SKIPPED = {('goblin_shaman', 'stone_spikes')}


class EnemiesMountainsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frames, cls.anims = M.build_frames()

    def test_every_anim_with_count_and_size(self):
        for enemy, want in EXPECTED.items():
            for anim, n in want.items():
                key = f'{enemy}_{anim}'
                names = [f for f in self.frames if f.rsplit('_', 1)[0] == key]
                self.assertEqual(len(names), n, key)
                size, _ = M.frame_size(enemy, anim)
                for f in names:
                    self.assertEqual(self.frames[f].size, size, f)
                self.assertIn(key, {a['key'] for a in self.anims})

    def test_reach_rule(self):
        for enemy, attacks in ATTACK_BOX.items():
            if enemy not in EXPECTED:
                continue
            for atk, box in attacks.items():
                if box is None or (enemy, atk) in SKIPPED:
                    continue
                (fw, fh), (ax, ay) = M.frame_size(enemy, 'atk_' + atk)
                dx, dy, w, h = box
                self.assertLessEqual(abs(dx) + w / 2, ax, (enemy, atk))
                self.assertLessEqual(h / 2 - dy, ay, (enemy, atk))
                self.assertLessEqual(dy + h / 2, fh - ay, (enemy, atk))

    def test_idle_silhouette(self):
        for enemy, (w, h) in HURTBOX.items():
            if enemy not in EXPECTED or enemy == 'bat_swarm':
                continue
            _s, (ax, ay) = M.frame_size(enemy, 'idle')
            a = np.array(self.frames[f'{enemy}_idle_00'])[:, :, 3] > 0
            cols = np.nonzero(a.any(axis=0))[0]
            rows = np.nonzero(a.any(axis=1))[0]
            if enemy != 'goblin_shaman':           # the staff towers over its hurtbox
                self.assertLessEqual(abs(rows.min() - (ay - h)), 8, (enemy, 'top', rows.min()))
            self.assertEqual(rows.max(), ay - 1, (enemy, 'sole'))
            self.assertLessEqual(abs((cols.min() + cols.max() + 1) / 2 - ax), 8, enemy)

    def test_nothing_below_the_sole_row(self):
        for name, img in self.frames.items():
            enemy = next(e for e in EXPECTED if name.startswith(e + '_'))
            _s, (ax, ay) = M.frame_size(enemy, name[len(enemy) + 1:])
            self.assertFalse((np.array(img)[:, :, 3] > 0)[ay:].any(), name)

    def test_palette_and_no_terrain_colors(self):
        world = P.allowed(P.MOUNTAINS_WORLD_RAMPS) - set(P.RAMPS['ink']) - set(P.RAMPS['white'])
        allowed = P.allowed(P.MOUNTAINS_ENEMY_RAMPS)
        for name, img in self.frames.items():
            P.check_palette_lock(img, allowed, M.ATLAS, name)
            cols = {tuple(c[:3]) for c in np.array(img).reshape(-1, 4) if c[3] == 255}
            self.assertFalse(cols & world, name)


class MountainsWorldTest(unittest.TestCase):
    def test_tiles_and_backgrounds(self):
        from art import tiles as T, backgrounds as B
        cells = T.tile_cells('mountains')
        for i in range(47):
            self.assertIn((i % 16, 4 + i // 16), cells)       # ice blobs
        self.assertIn((12, 3), cells)                          # cracked wall
        sheet = T.build_sheet('mountains')
        P.check_palette_lock(sheet, P.allowed(T.MT_ALLOWED), 'tiles_mountains')
        for sn in ('mountains', 'mountains_cave'):
            for i in range(3):
                one = np.array(B.render(sn, i, 640))
                two = np.array(B.render(sn, i, 1280))
                np.testing.assert_array_equal(two[:, :640], one)
                np.testing.assert_array_equal(two[:, 640:], one)
                P.check_palette_lock(B.render(sn, i, 640), P.allowed(B.MT_ALLOWED[sn][i]), f'bg_{sn}_{i}')


if __name__ == '__main__':
    unittest.main()
