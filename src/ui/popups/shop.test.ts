import { describe, expect, it } from 'vitest';
import { arenaWorld } from '../../core/testkit/combatWorld.ts';
import { serviceTag } from './shop.ts';
describe('village service tags (07 §6.4)', () => {
  it('shows MAX, Full, Keys full and hides a missing key', () => {
    const w = arenaWorld(); w.shop = { villageIndex: 1, rerollCount: 2, slots: [], keyInStock: true, cosmeticId: null, cosmeticSold: false };
    w.flask.maxCharges = 4; w.flask.charges = 4; w.econ.keys = 3;
    expect(serviceTag(w, 'shop_flask')).toMatchObject({ word: 'MAX' });
    expect(serviceTag(w, 'shop_refill')).toMatchObject({ word: 'Full' });
    expect(serviceTag(w, 'shop_key')).toMatchObject({ word: 'Keys full' });
    expect(serviceTag(w, 'shop_reroll')).toMatchObject({ price: 150 });
    w.shop.keyInStock = false; expect(serviceTag(w, 'shop_key').hidden).toBe(true);
  });
  it('Haggler changes buy/upgrade prices but not sell prices', () => {
    const w = arenaWorld(); w.econ.statStacks.haggler = 1; w.flask.charges = 0;
    expect(serviceTag(w, 'shop_flask')).toMatchObject({ price: 255 });
    expect(serviceTag(w, 'shop_refill')).toMatchObject({ price: 215 });
  });
});
