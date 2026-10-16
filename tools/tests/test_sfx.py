import os
import tempfile
import unittest
import wave
import numpy as np
import _path  # noqa: F401
from audio import sfx_defs as D

ART4 = {'ledge_grab': 2, 'drop_through': 2, 'spike_hit': 2, 'rush_up': 1, 'rush_max': 1, 'rush_down': 1,
        'charge_loop': 1, 'charge_full': 1, 'explosion_s': 2, 'explosion_l': 2, 'lucky_hit': 1, 'lucky_buff': 1,
        'lucky_debuff': 1, 'jackpot': 1, 'chest_open': 1, 'chest_locked': 1, 'cursed_open': 1, 'curse_lifted': 1,
        'key_pickup': 2, 'keys_full': 2, 'coin': 2, 'item_pop': 2, 'pickup_weapon': 2, 'pickup_ability': 2,
        'blueprint': 2, 'purchase': 1, 'cant_afford': 1, 'upgrade': 1, 'sell': 1, 'reroll': 1, 'split_faster': 1,
        'split_slower': 1, 'pb': 1, 'sleep': 1, 'restart': 1, 'ui_move': 1, 'ui_confirm': 1, 'ui_back': 1,
        'ui_error': 1, 'ui_open': 1, 'ui_close': 1, 'ui_toggle': 1}


class SfxTest(unittest.TestCase):
    def test_ids_variants_and_levels(self):
        with tempfile.TemporaryDirectory() as d:
            D.build(d)
            for sid, n in ART4.items():
                self.assertIn(sid, D.SFX)
                self.assertEqual(D.SFX[sid][0], n, sid)
                for nm in D.files_for(sid):
                    path = os.path.join(d, nm)
                    with wave.open(path, 'rb') as w:
                        self.assertEqual((w.getnchannels(), w.getsampwidth(), w.getframerate()), (1, 2, 44100))
                        n_fr = w.getnframes()
                        s = np.frombuffer(w.readframes(n_fr), dtype='<i2').astype(np.float64)
                    self.assertLessEqual(n_fr, 2 * 44100, nm)
                    self.assertAlmostEqual(20 * np.log10(np.abs(s).max() / 32767), -1.0, delta=0.1, msg=nm)
                    self.assertGreater(np.sqrt(np.mean(s ** 2)), 100, nm)


if __name__ == '__main__':
    unittest.main()
