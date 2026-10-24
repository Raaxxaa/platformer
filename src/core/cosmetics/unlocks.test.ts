import { describe, expect, it } from 'vitest';
import { ACCESSORIES, SHOP_COSMETICS, ALL_COSMETIC_IDS, COSMETIC_TOTAL } from '../../data/cosmetics.ts';
import { accessoryFor, newCosmeticState, noteSeen, unlockOnKill } from './unlocks.ts';

describe('cosmetics data (09 §3, §5, checklist 3)', () => {
  it('35 accessories and 24 shop items, unique ids, a slot or kind each, 59 in all', () => {
    expect(ACCESSORIES.length).toBe(35); expect(SHOP_COSMETICS.length).toBe(24); expect(COSMETIC_TOTAL).toBe(59);
    expect(new Set(ALL_COSMETIC_IDS).size).toBe(59);
    for (const a of ACCESSORIES) expect(['head', 'back', 'extra']).toContain(a.slot);
    for (const s of SHOP_COSMETICS) expect(['dye', 'hair', 'hat', 'cape', 'gold_cape']).toContain(s.kind);
    expect(SHOP_COSMETICS.filter((s) => s.kind === 'dye').length).toBe(8); expect(SHOP_COSMETICS.filter((s) => s.kind === 'hair').length).toBe(6);
    expect(SHOP_COSMETICS.filter((s) => s.kind === 'hat').length).toBe(5); expect(SHOP_COSMETICS.filter((s) => s.kind === 'cape').length).toBe(4);
    expect(SHOP_COSMETICS.find((s) => s.id === 'cape_gold')!.price).toBe(400);
  });
});

describe('unlocking accessories (09 §3–§4, checklist 2, 8)', () => {
  it('the first Wolf kill unlocks acc_wolf once; the second kill adds nothing', () => {
    const s = newCosmeticState();
    expect(unlockOnKill(s, 'wolf')).toBe('acc_wolf'); expect([...s.owned]).toEqual(['acc_wolf']);
    expect(unlockOnKill(s, 'wolf')).toBeNull(); expect(s.owned.size).toBe(1);
  });
  it('dummies and straw targets unlock nothing; a Spiderling kill unlocks the tiny spider', () => {
    const s = newCosmeticState();
    for (const id of ['training_dummy', 'sparring_dummy', 'straw_target'] as const) expect(unlockOnKill(s, id)).toBeNull();
    expect(unlockOnKill(s, 'spiderling')).toBe('acc_spiderling');
  });
  it('a storm Dragon kill unlocks only the storm cape', () => {
    const s = newCosmeticState();
    expect(unlockOnKill(s, 'dragon', 'storm')).toBe('acc_dragon_storm'); expect([...s.owned]).toEqual(['acc_dragon_storm']);
    expect(accessoryFor('dragon', 'red')).toBe('acc_dragon_red'); expect(accessoryFor('dragon')).toBeNull();
  });
  it('every non-dragon enemy type in the table maps to its own accessory', () => {
    for (const a of ACCESSORIES) if (!a.dragon) expect(accessoryFor(a.enemy)).toBe(a.id);
  });
  it('becoming aware of a type adds it to seenEnemies once', () => {
    const s = newCosmeticState();
    expect(noteSeen(s, 'wolf')).toBe(true); expect(noteSeen(s, 'wolf')).toBe(false); expect(noteSeen(s, 'training_dummy')).toBe(false);
    expect([...s.seen]).toEqual(['wolf']);
  });
});
