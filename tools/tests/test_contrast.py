import unittest
import _path  # noqa: F401
from art import contrast

ENTITIES = ['wolf', 'bandit', 'bandit_archer', 'wild_boar', 'bandit_brute',
            'player_swordsman', 'player_tank', 'player_archer', 'player_wizard']
SURFACES = ['terrain', 'bg_plains_0', 'bg_plains_1', 'bg_plains_2']


class ContrastTest(unittest.TestCase):
    def test_report_complete_and_passing(self):
        lines = contrast.report_lines()
        for e in ENTITIES:
            for s in SURFACES:
                hits = [l for l in lines if l.split()[0] == e and l.split()[1] == s]
                self.assertEqual(len(hits), 1, (e, s))
        # 08 §12.8: a FAIL must be fixed or accepted by the user in APPROVALS.md
        accepted = contrast.accepted_fails()
        fails = [l for l in lines if l.endswith('FAIL') and ' '.join(l.split()[:2]) not in accepted]
        self.assertEqual(fails, [])

    def test_village_lines(self):
        lines = contrast.report_lines()
        people = ['player_swordsman', 'player_tank', 'player_archer', 'player_wizard', 'shopkeeper', 'innkeeper',
                  'merchant', 'villager_a', 'villager_b']
        surf = [f'bg_{v}_{i}' for v in ('village_home', 'village_crossroads') for i in range(3)]
        accepted = contrast.accepted_fails()
        for e in people:
            for s in surf:
                hits = [l for l in lines if l.split()[:2] == [e, s]]
                self.assertEqual(len(hits), 1, (e, s))
                self.assertFalse(hits[0].endswith('FAIL') and f'{e} {s}' not in accepted, hits[0])

    def test_oklab_known_values(self):
        w = contrast.oklab((255, 255, 255))
        self.assertAlmostEqual(w[0], 1.0, places=3)
        k = contrast.oklab((0, 0, 0))
        self.assertAlmostEqual(k[0], 0.0, places=3)


class ItemsTest(unittest.TestCase):
    def test_items(self):
        from art import items
        fr = items.build_frames()
        self.assertEqual([fr[f'lucky_block_idle_{i:02d}'].size for i in range(4)], [(16, 16)] * 4)
        self.assertEqual(fr['chest_key_closed_00'].size, (24, 16))
        self.assertEqual(fr['chest_key_open_00'].size, (24, 16))
        self.assertEqual(fr['glow_weapon_greatsword'].size, (18, 18))
        from art import icons
        self.assertEqual(icons.weapon_icon('greatsword').size, (16, 16))


if __name__ == '__main__':
    unittest.main()
