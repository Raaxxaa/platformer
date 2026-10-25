import { describe, expect, it } from 'vitest';
import crossroads from '../../../public/levels/village_crossroads.json';
import { kitLoadout } from '../abilities/runtime.ts';
import { loadLevel } from '../level/loadLevel.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { SHOP_COSMETICS } from '../../data/cosmetics.ts';
import { buyCosmetic, cosmeticStand, rerollShop, setupShop } from './shop.ts';
import baseline from './shopStock.baseline.json';

const world = (seed = 'ALPHA', owned: string[] = []) => {
  const w = GameWorld.fromLevel(loadLevel(crossroads), { seedText: seed, cosmetics: { owned, seenEnemies: [] } });
  w.setLoadout(kitLoadout('swordsman', 'greatsword'));
  return w;
};

describe('the shop cosmetic slot (09 §5, checklist 4, 5)', () => {
  it('adds a draw AFTER the key draw: stock and key are identical to before M13 for the same seed', () => {
    for (const seed of ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA']) for (const v of [1, 2, 3] as const) {
      const s = setupShop(world(seed), v);
      expect({ slots: s.slots, key: s.keyInStock }, `${seed}:${v}`).toEqual((baseline as Record<string, unknown>)[`${seed}:${v}`]);
    }
  });
  it('offers one unowned shop cosmetic per visit, the same for the same seed; a reroll keeps it', () => {
    const w = world('BRAVO'), s = setupShop(w, 1);
    expect(SHOP_COSMETICS.map((c) => c.id)).toContain(s.cosmeticId);
    expect(setupShop(world('BRAVO'), 1).cosmeticId).toBe(s.cosmeticId);
    const before = s.cosmeticId; w.econ.goldTenths = 9999;
    expect(rerollShop(w)).toBe(true); expect(w.shop!.rerollCount).toBe(1); expect(w.shop!.cosmeticId).toBe(before);
  });
  it('never offers an owned cosmetic; with all 24 owned the stand says Collection complete and does nothing', () => {
    const ids = SHOP_COSMETICS.map((c) => c.id);
    const w = world('CHARLIE', ids.filter((i) => i !== 'hat_straw')); expect(setupShop(w, 1).cosmeticId).toBe('hat_straw');
    const full = world('CHARLIE', ids); const s = setupShop(full, 1);
    expect(s.cosmeticId).toBeNull(); expect(cosmeticStand(full).word).toBe('Collection complete');
    expect(buyCosmetic(full)).toBe(true);                       // a no-op press: nothing owned changes, no gold taken
    expect(full.gold).toBe(0);
  });
  it('buying takes the price (Haggler 85%, round to 5), adds it to the collection at once and emits the unlock', () => {
    const w = world('DELTA', SHOP_COSMETICS.map((c) => c.id).filter((i) => i !== 'cape_gold')); const s = setupShop(w, 2);
    expect(s.cosmeticId).toBe('cape_gold'); w.econ.goldTenths = 4000; w.events = [];
    expect(cosmeticStand(w)).toMatchObject({ price: 400 });
    expect(buyCosmetic(w)).toBe(true);
    expect(w.gold).toBe(0); expect(w.cosmetics.owned.has('cape_gold')).toBe(true);
    expect(w.events).toContainEqual({ t: 'cosmeticUnlocked', id: 'cape_gold', source: 'shop' }); expect(s.cosmeticSold).toBe(true);
    expect(cosmeticStand(w).word).toBe('SOLD'); w.econ.goldTenths = 4000; expect(buyCosmetic(w)).toBe(true); expect(w.gold).toBe(400);   // already bought: nothing more is taken
    const h = world('DELTA', SHOP_COSMETICS.map((c) => c.id).filter((i) => i !== 'cape_gold')); setupShop(h, 2); h.econ.statStacks.haggler = 1; h.econ.goldTenths = 3400;
    expect(cosmeticStand(h).price).toBe(340); expect(buyCosmetic(h)).toBe(true); expect(h.gold).toBe(0);
  });
  it('too little gold: cantAfford, nothing owned', () => {
    const w = world('DELTA', SHOP_COSMETICS.map((c) => c.id).filter((i) => i !== 'cape_gold')); setupShop(w, 2); w.events = [];
    expect(buyCosmetic(w)).toBe(false); expect(w.cosmetics.owned.has('cape_gold')).toBe(false); expect(w.events.some((e) => e.t === 'cantAfford')).toBe(true);
  });
});
