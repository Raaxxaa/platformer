import { describe, expect, it } from 'vitest';
import plainsJson from '../../../public/levels/plains.json';
import { loadLevel } from '../level/loadLevel.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { kitLoadout, newAbility, newWeapon } from '../abilities/runtime.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { priceOf, upgradeAt } from './merchant.ts';

const plains = loadLevel(plainsJson);
const world = (seed = 'MERCH') => { const w = GameWorld.fromLevel(plains, { seedText: seed }); w.setLoadout(kitLoadout('swordsman', 'greatsword')); return w; };

describe('wandering merchant (05 §12, 06 §11.3)', () => {
  it('present on about 40% of seeds', () => {
    let n = 0;
    for (let i = 0; i < 400; i++) if (world(`S${i}`).merchant?.present) n++;
    expect(Math.abs(n / 400 - 0.4)).toBeLessThan(0.07);
  });
  it('stock: 2 cursed-table weapons with different ids, then 1 ability; prices ×1.25 to the nearest 5', () => {
    const w = world();
    w.rollStageLoot(true);
    const stock = w.groundItems.filter((i) => i.price !== undefined);
    expect(stock.length).toBe(3);
    const [a, b, c] = stock;
    expect(a.weapon!.weaponId).not.toBe(b.weapon!.weaponId);
    expect(['C', 'B', 'A', 'S']).toContain(a.weapon!.grade);
    expect(c.ability).toBeDefined();
    expect(c.price).toBe(150);
    expect(priceOf(160, true)).toBe(200);                      // checklist 22: the merchant's B weapon
    expect(priceOf(640, true)).toBe(800);
  });
  it('buying goes through pickup: refused when unaffordable; gold is taken only when the item is taken; SOLD after', () => {
    const w = world();
    w.rollStageLoot(true);
    stepSpec(w, {}, 2);
    const ab = w.groundItems.find((i) => i.price !== undefined && i.ability)!;
    w.teleportPlayer(ab.x, ab.y);
    stepSpec(w, {}, 3);
    stepSpec(w, { interact: true }, 1);
    expect(w.abilities.slots[1]).toBeNull();                    // 0 gold
    w.econ.goldTenths = 2000;
    stepSpec(w, {}, 1);
    stepSpec(w, { interact: true }, 1);
    expect(w.abilities.slots[1]?.id).toBe(ab.ability!.id);
    expect(w.gold).toBe(200 - 150);
    expect(w.merchant!.sold[2]).toBe(true);
  });
  it('altars upgrade at normal prices; MAX at Lv5; a Lv5 Blade Dash gains a ready charge', () => {
    const w = world();
    w.rollStageLoot(true);
    w.econ.goldTenths = 99990;
    w.abilities.slots[0] = { ...newAbility('blade_dash'), level: 4 };
    const before = w.abilities.slots[0]!.charges;
    expect(upgradeAt(w, 0)).toBe(true);
    expect(w.abilities.slots[0]!.level).toBe(5);
    expect(w.abilities.slots[0]!.charges).toBe(before + 1);
    expect(w.gold).toBe(9999 - 400);
    expect(upgradeAt(w, 0)).toBe(false);                       // MAX
    expect(upgradeAt(w, 1)).toBe(false);                       // No ability
    void newWeapon;
  });
});
