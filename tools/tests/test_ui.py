import itertools
import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art import ui as U

WEAPONS = ['greatsword', 'katana', 'twin_daggers', 'spear', 'scythe', 'war_maul', 'iron_fists', 'giant_axe', 'flail',
           'shield', 'bow', 'crossbow', 'hand_cannon', 'javelin', 'throwing_knives', 'storm_hammer', 'staff', 'wand',
           'spell_tome']
ABILITIES = ['blade_dash', 'whirlwind', 'blade_flurry', 'riposte', 'shockwave', 'shoulder_charge', 'rage',
             'boulder_toss', 'arrow_rain', 'turret', 'grapple_arrow', 'hunters_mark', 'thunder_strike', 'frost_burst',
             'blink', 'time_slow', 'vampire']
STATS = ['vitality', 'might', 'quickstep', 'focus', 'bloodthirst', 'precision', 'frenzy', 'iron_skin', 'prospector',
         'light_feet', 'haggler', 'lucky_charm']
CLASSES = ['swordsman', 'tank', 'archer', 'wizard']
ELEMENTS = ['fire', 'ice', 'lightning', 'poison', 'wind']
LUCKY = ['swift', 'golden_touch', 'firestarter', 'second_wind', 'overdrive', 'bloodrush', 'heavy', 'glass_bones',
         'leaky_pockets', 'jammed', 'dry_flask', 'butterfingers']
CURSES = ['one_hit', 'no_heal', 'heavy_feet', 'hunted']
STATUSES = ['burning', 'poisoned', 'chilled', 'rooted']

EXPECTED = {}
EXPECTED.update({f'icon_weapon_{w}': (16, 16) for w in WEAPONS})
EXPECTED.update({f'icon_ability_{a}': (16, 16) for a in ABILITIES})
EXPECTED.update({f'icon_stat_{s}': (16, 16) for s in STATS})
EXPECTED.update({f'icon_class_{c}': (16, 16) for c in CLASSES})
EXPECTED.update({f'class_{c}': (6, 6) for c in CLASSES})
EXPECTED.update({f'elem_{e}': (7, 7) for e in ELEMENTS})
EXPECTED.update({f'effect_{e}': (10, 10) for e in LUCKY})
EXPECTED.update({f'effect_curse_{c}': (10, 10) for c in CURSES})
EXPECTED.update({f'status_{s}': (8, 8) for s in STATUSES})
EXPECTED.update({f'hud_flask_{k}': (10, 12) for k in ('full', 'empty', 'blocked')})
EXPECTED.update({'hud_coin': (8, 8), 'hud_key': (7, 10), 'hud_lockpick': (8, 10), 'hud_link': (8, 7),
                 'hud_lock': (8, 8), 'hud_dragon_arrow': (12, 12)})
EXPECTED.update({f'prompt_ps_{k}': (7, 7) for k in ('cross', 'circle', 'square', 'triangle')})
TINT = [k for k in EXPECTED if k.startswith(('class_', 'prompt_ps_'))]


class UiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fr = U.build_frames()

    def test_all_94_frames(self):
        self.assertEqual(len(EXPECTED), 94)
        self.assertEqual(set(self.fr), set(EXPECTED))
        for k, size in EXPECTED.items():
            self.assertEqual(self.fr[k].size, size, k)
            self.assertTrue(any(px[3] for px in self.fr[k].getdata()), k)

    def test_palette(self):
        white = {(255, 255, 255)}
        for k, img in self.fr.items():
            P.check_palette_lock(img, white if k in TINT else P.allowed_ui(), 'ui', k)

    def test_icons_distinct(self):
        for group in (WEAPONS, ABILITIES):
            prefix = 'icon_weapon_' if group is WEAPONS else 'icon_ability_'
            masks = {g: np.array(self.fr[prefix + g])[:, :, 3] > 0 for g in group}
            for a, b in itertools.combinations(group, 2):
                self.assertFalse((masks[a] == masks[b]).all(), (a, b))


if __name__ == '__main__':
    unittest.main()
