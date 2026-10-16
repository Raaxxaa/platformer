import unittest
import numpy as np
import _path  # noqa: F401
from art import palette as P
from art import npcs as N


class NpcsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fr, cls.anims = N.build_frames()

    def test_frames(self):
        for npc in ('shopkeeper', 'innkeeper', 'merchant', 'villager_a', 'villager_b'):
            for i in range(4):
                self.assertEqual(self.fr[f'{npc}_idle_{i:02d}'].size, (48, 48))
        for npc in ('shopkeeper', 'innkeeper'):
            for i in range(4):
                self.assertIn(f'{npc}_wave_{i:02d}', self.fr)
        self.assertEqual(len(self.fr), 5 * 4 + 2 * 4)
        keys = {a['key']: a for a in self.anims}
        self.assertEqual(keys['merchant_idle']['fps'], 6)

    def test_palette_and_not_player_colors(self):
        player = P.allowed(['p_cloth', 'p_leather', 'p_steel'])
        for n, img in self.fr.items():
            P.check_palette_lock(img, P.allowed(N.ALLOWED), 'npcs', n)
            cols = {px[:3] for px in img.getdata() if px[3]}
            self.assertFalse(cols & player, n)
            a = np.array(img)[:, :, 3] > 0
            self.assertEqual(np.nonzero(a.any(axis=1))[0].max(), 45, n)


if __name__ == '__main__':
    unittest.main()
