import os
import tempfile
import unittest
import wave
import numpy as np
import _path  # noqa: F401
from audio import sfx_stage2 as D

IDS = {
    'vo_bat_swarm': 2, 'vo_goblin_miner': 2, 'vo_rock_golem': 2, 'vo_ram': 2, 'vo_goblin_shaman': 2,
    'vo_bog_zombie': 2, 'vo_giant_spider': 2, 'vo_wisp': 2, 'vo_swamp_witch': 2, 'vo_treant': 2,
    'proj_bomb': 2, 'bomb_fuse': 2, 'proj_hex_bolt': 2, 'proj_potion': 2, 'proj_venom_glob': 2,
    'boss_roar_stone_colossus': 1, 'boss_roar_spider_queen': 1,
    'cart_roll': 1, 'cart_jump': 1, 'cart_crash': 1, 'splash': 2, 'step_wet': 4, 'step_ice': 4,
}


class SfxStage2Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.TemporaryDirectory()
        cls.files = D.build(cls.dir.name)

    @classmethod
    def tearDownClass(cls):
        cls.dir.cleanup()

    def test_ids_and_variants(self):
        for sid, n in IDS.items():
            self.assertIn(sid, D.SFX2)
            self.assertEqual(D.SFX2[sid][0], n, sid)
            for nm in D.files_for(sid):
                self.assertTrue(os.path.exists(os.path.join(self.dir.name, nm)), nm)

    def test_no_clash_with_stage_1_ids(self):
        from audio import sfx_defs
        self.assertFalse(set(D.SFX2) & set(sfx_defs.SFX))

    def test_format(self):
        for p in self.files:
            with wave.open(p) as w:
                self.assertEqual((w.getnchannels(), w.getsampwidth(), w.getframerate()), (1, 2, 44100), p)
                x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.int32)
            self.assertLessEqual(len(x) / 44100, 2.0, p)
            self.assertLessEqual(abs(int(x.max())), 29204, p)             # -1 dBFS
            self.assertLessEqual(abs(int(x[0])), 64, p)
            self.assertLessEqual(abs(int(x[-1])), 64, p)
            self.assertGreater(np.abs(x).max(), 20000, p)


if __name__ == '__main__':
    unittest.main()
