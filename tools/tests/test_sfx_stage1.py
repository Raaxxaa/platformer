import os
import tempfile
import unittest
import wave
import numpy as np
import _path  # noqa: F401
from audio import sfx_defs as D

IDS = {
    'vo_wolf': 2, 'vo_bandit': 2, 'vo_bandit_archer': 2, 'vo_wild_boar': 2, 'vo_bandit_brute': 2,
    'boss_roar_great_boar': 1, 'boss_break': 1, 'boss_defeated': 1,
    'enemy_swing_s': 3, 'enemy_swing_m': 3, 'enemy_swing_l': 3,
    'enemy_death_s': 2, 'enemy_death_m': 2, 'enemy_death_l': 2,
    'proj_enemy_arrow': 2, 'proj_brute_wave': 2, 'proj_shockwave': 2, 'rock_shatter': 2, 'rock_whistle': 2,
    'hit_light': 3, 'hit_medium': 3, 'hit_heavy': 3, 'hit_crit': 3,
    'swing_light': 3, 'swing_medium': 3, 'swing_heavy': 3,
    'player_hurt': 2, 'player_death': 2,
    'jump': 2, 'double_jump': 2, 'wall_jump': 2, 'land': 3, 'dash': 2, 'slide': 2,
    'dive_start': 1, 'dive_land': 1, 'dive_land_heavy': 1, 'dive_bounce': 1, 'step_soft': 4,
    'flask_drink': 1, 'flask_sip': 1, 'flask_empty': 1, 'flask_tick': 1, 'flask_charge': 1,
    'door_slam': 1, 'door_open': 1, 'arena_clear': 1, 'timed_open': 1, 'timed_missed': 1,
    # ART5
    'shot_bow': 2, 'shot_crossbow': 2, 'shot_staff': 2, 'shot_orb': 2, 'hammer_throw': 1, 'hammer_return': 1,
    'hammer_catch': 1, 'zap': 2, 'ab_blade_dash': 1, 'ab_whirlwind': 1, 'ab_shockwave': 1, 'ab_shoulder_charge': 1,
    'ab_arrow_rain': 1, 'ab_hunters_mark': 1, 'ab_thunder_strike': 1, 'ab_blink': 1, 'ab_link': 1, 'ab_fizzle': 1,
    'ab_not_ready': 1, 'wall_break': 1, 'class_change': 1, 'class_discovered': 1,
    # ART6
    'fire_hit': 2, 'ice_hit': 2, 'freeze': 2, 'shatter': 2, 'poison_hit': 2, 'wind_hit': 2, 'zap': 2,
    'explosion_s': 2, 'explosion_l': 2,
}


class SfxStage1Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.TemporaryDirectory()
        cls.files = D.build(cls.dir.name)

    @classmethod
    def tearDownClass(cls):
        cls.dir.cleanup()

    def test_ids_and_variants(self):
        for sid, n in IDS.items():
            self.assertIn(sid, D.SFX)
            self.assertEqual(D.SFX[sid][0], n, sid)
            names = [f'{sid}.wav'] if n == 1 else [f'{sid}_{k}.wav' for k in range(1, n + 1)]
            for nm in names:
                self.assertTrue(os.path.exists(os.path.join(self.dir.name, nm)), nm)

    def test_format(self):
        for path in self.files:
            with wave.open(path, 'rb') as w:
                self.assertEqual((w.getnchannels(), w.getsampwidth(), w.getframerate()), (1, 2, 44100), path)
                n = w.getnframes()
                s = np.frombuffer(w.readframes(n), dtype='<i2').astype(np.float64)
            self.assertLessEqual(n, 2 * 44100, path)
            peak = 20 * np.log10(np.abs(s).max() / 32767)
            self.assertAlmostEqual(peak, -1.0, delta=0.1, msg=path)
            self.assertGreater(np.sqrt(np.mean(s ** 2)), 100, path)
            self.assertLessEqual(abs(s[0]), 64)
            self.assertLessEqual(abs(s[-1]), 64)


if __name__ == '__main__':
    unittest.main()
