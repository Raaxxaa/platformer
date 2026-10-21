import json
import os
import unittest
import _path  # noqa: F401
from audio import sfx_stage34 as S

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets')
ANIMS = json.load(open(os.path.join(ROOT, 'anims.json')))


def keys(atlas):
    return {a['key'] for a in ANIMS if a['atlas'] == atlas}


class Stage34Test(unittest.TestCase):
    def test_enemies_have_the_standard_anims(self):
        for atlas, enemies in (('enemies_kingdom', ['soldier', 'crossbowman', 'war_hound', 'battle_mage', 'knight']),
                               ('enemies_castle', ['royal_guard', 'castle_mage', 'living_armor', 'royal_executioner'])):
            k = keys(atlas)
            for e in enemies:
                for a in ('idle', 'hurt', 'stagger', 'knockdown', 'death'):
                    self.assertIn(f'{e}_{a}', k, (e, a))
        self.assertIn('gargoyle_fly', keys('enemies_castle'))
        self.assertIn('living_armor_collapse', keys('enemies_castle'))

    def test_bosses_follow_08_7_4(self):
        for atlas in ('boss_black_knight', 'boss_enemy_king') + tuple(f'boss_dragon_{c}' for c in ('red', 'white', 'storm', 'green')):
            k = {a['key']: a for a in ANIMS if a['atlas'] == atlas}
            for a in ('idle', 'intro', 'break', 'transition', 'death'):
                self.assertIn(a, k, (atlas, a))
            self.assertEqual(len(k['death']['frames']), 9)
            self.assertEqual(len(k['intro']['frames']), 6)

    def test_dragon_extra_anims(self):
        k = {a['key']: a for a in ANIMS if a['atlas'] == 'boss_dragon_red'}
        self.assertEqual(len(k['walk']['frames']), 8)
        self.assertEqual(len(k['hover']['frames']), 6)
        self.assertEqual(len(k['perched']['frames']), 2)
        for a in ('takeoff', 'dive', 'fall', 'atk_breath', 'atk_dive_bomb'):
            self.assertIn(a, k)

    def test_sound_ids_cover_the_new_things(self):
        for sid in ('vo_soldier', 'vo_royal_executioner', 'boss_roar_black_knight', 'boss_roar_enemy_king', 'dragon_roar',
                    'breath_red', 'breath_white', 'breath_storm', 'breath_green', 'cannon_fire', 'throw_javelin',
                    'ab_time_slow', 'ab_rage', 'step_hard'):
            self.assertIn(sid, S.SFX34)
        for sid in S.SFX34:
            for f in S.files_for(sid):
                self.assertTrue(os.path.exists(os.path.join(ROOT, 'audio', 'sfx', f)), f)

    def test_tilesets_and_backgrounds_exist(self):
        for f in ('tiles/tiles_kingdom.png', 'tiles/tiles_castle.png', 'bg/bg_kingdom_0.png', 'bg/bg_castle_2.png',
                  'bg/bg_village_rebel_camp_1.png'):
            self.assertTrue(os.path.exists(os.path.join(ROOT, f)), f)


if __name__ == '__main__':
    unittest.main()
