import itertools
import unittest
import numpy as np
import _path  # noqa: F401
from art import contrast as C
from art import palette as P
from art import vfx as VX
from art import vfx_elements as EL

WANT = {'burn_flame': ((6, 8), 3), 'chill_frost': ((5, 5), 3), 'freeze_block': ((24, 24), 1),
        'shatter_shards': ((6, 6), 8), 'poison_bubble': ((5, 6), 3), 'wind_gust': ((24, 12), 4),
        'chain_spark': ((6, 6), 2), 'lucky_break': ((24, 24), 6), 'chest_open': ((24, 16), 4),
        'chest_open_cursed': ((24, 16), 4), 'buff_aura': ((32, 48), 6), 'debuff_aura': ((32, 48), 6)}
WANT.update({f'hit_{e}': ((16, 16), 3) for e in EL.ELEMENTS})
WANT.update({k: v[:2] for k, v in EL.SIGNATURES.items()})
TINT = {(255, 255, 255), (0xb0, 0xb0, 0xb0)}


class ElementsVfxTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fr, anims = VX.build_frames()
        cls.keys = {a['key'] for a in anims}

    def test_sizes_counts_palette(self):
        for k, (size, n) in WANT.items():
            self.assertIn(k, self.keys)
            for i in range(n):
                img = self.fr[f'{k}_{i:02d}']
                self.assertEqual(img.size, size, k)
                self.assertTrue((np.array(img)[:, :, 3] > 0).any(), f'{k}_{i:02d}')
                ok = TINT if k.startswith('sig_') else P.allowed(VX.ALLOWED)
                P.check_palette_lock(img, ok, 'vfx', f'{k}_{i:02d}')

    def test_elements_far_apart(self):
        means = {}
        for e, ramp in EL.ELEMENTS.items():
            labs = [C.mean_oklab(self.fr[f'hit_{e}_{i:02d}']) for i in range(3)]
            means[e] = np.mean(labs, axis=0)
        for a, b in itertools.combinations(means, 2):
            self.assertGreaterEqual(C.dist(means[a], means[b]), 0.15, (a, b, C.dist(means[a], means[b])))

    def test_freeze_block_nine_slice(self):
        a = np.array(self.fr['freeze_block_00'])
        c = EL.FREEZE_CORNER
        mid = a[:, c:24 - c]
        self.assertTrue((mid == mid[:, :1]).all())
        mid = a[c:24 - c]
        self.assertTrue((mid == mid[:1]).all())


if __name__ == '__main__':
    unittest.main()
