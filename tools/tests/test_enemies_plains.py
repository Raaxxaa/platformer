import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art.boxes import HURTBOX, ATTACK_BOX
from art.enemies import plains

STANDARD = {'idle': 4, 'walk': 6, 'hurt': 1, 'stagger': 2, 'knockdown': 2, 'death': 4}
EXPECTED = {
    'wolf': {'atk_lunge_bite': 6, 'atk_snap': 5},
    'bandit': {'atk_slash': 5, 'atk_lunge_stab': 6},
    'bandit_archer': {'atk_arrow': 5, 'atk_kick': 5},
    'wild_boar': {'atk_charge': 6, 'atk_tusk_jab': 5, 'skid': 1, 'dazed': 2},
    'bandit_brute': {'atk_club_swing': 5, 'atk_overhead_smash': 5},
}


def size_anchor(enemy, anim):
    if enemy == 'bandit_brute':
        return (128, 80), (64, 78)
    if anim.startswith('atk_'):
        return (96, 48), (48, 46)
    return (48, 48), (24, 46)


class EnemiesPlainsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frames, cls.anims = plains.build_frames()

    def test_every_anim_with_count_and_size(self):
        for enemy, extra in EXPECTED.items():
            want = dict(STANDARD)
            want.update(extra)
            for anim, n in want.items():
                key = f'{enemy}_{anim}'
                names = [f for f in self.frames if f.rsplit('_', 1)[0] == key]
                self.assertEqual(len(names), n, key)
                size, _ = size_anchor(enemy, anim)
                for f in names:
                    self.assertEqual(self.frames[f].size, size, f)
                self.assertIn(key, {a['key'] for a in self.anims})

    def test_reach_rule(self):
        for enemy, attacks in ATTACK_BOX.items():
            for atk, box in attacks.items():
                if box is None:
                    continue
                (fw, fh), (ax, ay) = size_anchor(enemy, 'atk_' + atk)
                dx, dy, w, h = box
                self.assertLessEqual(abs(dx) + w / 2, ax, (enemy, atk, 'x overflow', abs(dx) + w / 2 - ax))
                self.assertLessEqual(h / 2 - dy, ay, (enemy, atk, 'top overflow'))
                self.assertLessEqual(dy + h / 2, fh - ay, (enemy, atk, 'bottom overflow'))

    def test_idle_silhouette(self):
        for enemy, (w, h) in HURTBOX.items():
            (fw, fh), (ax, ay) = size_anchor(enemy, 'idle')
            a = np.array(self.frames[f'{enemy}_idle_00'])[:, :, 3] > 0
            cols = np.nonzero(a.any(axis=0))[0]
            rows = np.nonzero(a.any(axis=1))[0]
            self.assertLessEqual(abs(cols.min() - (ax - w / 2)), 3, (enemy, 'left', cols.min()))
            self.assertLessEqual(abs(cols.max() + 1 - (ax + w / 2)), 3, (enemy, 'right', cols.max() + 1))
            self.assertLessEqual(abs(rows.min() - (ay - h)), 3, (enemy, 'top', rows.min()))
            self.assertEqual(rows.max(), ay - 1, (enemy, 'sole'))

    def test_hue_families(self):
        world = P.allowed(P.PLAINS_WORLD_RAMPS) - set(P.RAMPS['ink']) - set(P.RAMPS['white'])
        allowed = P.allowed(P.PLAINS_ENEMY_RAMPS)
        for name, img in self.frames.items():
            P.check_palette_lock(img, allowed, 'enemies_plains', name)
            cols = {tuple(c[:3]) for c in np.array(img).reshape(-1, 4) if c[3] == 255}
            self.assertFalse(cols & world, name)


if __name__ == '__main__':
    unittest.main()
