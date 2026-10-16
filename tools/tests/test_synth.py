import os
import tempfile
import unittest
import wave
import numpy as np
import _path  # noqa: F401
from audio import synth as S


def read(path):
    with wave.open(path, 'rb') as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1, 2, 44100)
        return np.frombuffer(w.readframes(w.getnframes()), dtype='<i2')


class SynthTest(unittest.TestCase):
    def test_sine_length_and_pitch(self):
        x = S.render([S.Layer('sin', 440, 440, 0.0, 0.1, 0.0)], seed=1)
        self.assertEqual(len(x), 4410)
        spec = np.abs(np.fft.rfft(x, n=44100))
        self.assertLessEqual(abs(int(np.argmax(spec)) - 440), 5)

    def test_wav_peak_fades_and_determinism(self):
        rec = [S.Layer('nz', None, None, 0.005, 0.05, 0.1, lp=(2000, 600)),
               S.Layer('sq', 280, 520, 0.0, 0.05, 0.03, duty=0.25)]
        with tempfile.TemporaryDirectory() as d:
            a, b = os.path.join(d, 'a.wav'), os.path.join(d, 'b.wav')
            S.write_wav(a, S.render(rec, seed=3))
            S.write_wav(b, S.render(rec, seed=3))
            self.assertEqual(open(a, 'rb').read(), open(b, 'rb').read())
            s = read(a)
        peak_db = 20 * np.log10(np.abs(s.astype(np.int32)).max() / 32767)
        self.assertAlmostEqual(peak_db, -1.0, delta=0.1)
        self.assertLessEqual(abs(int(s[0])), 64)
        self.assertLessEqual(abs(int(s[-1])), 64)

    def test_variant_shifts_frequencies(self):
        rec = [S.Layer('sin', 400, 800, 0, 0.05, 0)]
        v, seed = S.variant(rec, 2)
        ratio = v[0].f0 / 400
        self.assertTrue(0.96 <= ratio <= 1.04 and ratio != 1)
        self.assertAlmostEqual(v[0].f1 / 800, ratio)
        self.assertNotEqual(seed, S.variant(rec, 1)[1])


if __name__ == '__main__':
    unittest.main()
