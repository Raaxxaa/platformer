import { describe, expect, it } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { levelFrom, feet } from '../testkit/levelData.ts';
import { newAbility, newWeapon } from '../abilities/runtime.ts';
import { specToInput, type InputSpec } from '../sim/playerSim.ts';
import { stepInteract } from '../abilities/items.ts';
import { sourceRng } from '../loot/pick.ts';
import { rollWeapon, rollAbility } from '../loot/roll.ts';
import { GRADE_ODDS } from '../../data/loot.ts';
import { applyStatUpgrade } from './stats.ts';
import type { AbilityId } from '../abilities/types.ts';
import { setupShop, rerollShop, buyFlaskUpgrade, refill, buyKey, sellAbility, stepAltarInteraction, type ShopState, type AltarHold } from './shop.ts';

type ShopWorld = GameWorld & { shop: ShopState | null; altarHold: AltarHold | null };
const world = (seedText = 'SHOP') => {
  const d = levelFrom(Array.from({ length: 23 }, (_, y) => y >= 20 ? '#'.repeat(48) : `#${'.'.repeat(46)}#`), [
    feet('player_start', 3, 19), ...[9, 12, 15].map((x, slot) => feet('shop_item', x, 19, { slot })),
    feet('ability_altar', 19, 19, { slot: 1 }), feet('ability_altar', 22, 19, { slot: 2 }),
  ], 'crossroads'); d.kind = 'village'; d.stage = 0;
  const w = GameWorld.fromLevel(d, { seedText }) as ShopWorld;
  w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [newAbility('blade_dash'), null] });
  if (!w.interactables.some((i) => i.kind === 'ability_altar')) for (const [slot, x] of [19, 22].entries()) w.interactables.push({ id: w.newId(), x: x * 16 + 8, y: 320, kind: 'ability_altar', label: String(slot), use: () => {} });
  return w;
};
const stockItems = (w: ShopWorld) => w.groundItems.filter((i) => (i as typeof i & { shopSlot?: number }).shopSlot !== undefined);
function hold(w: ShopWorld, count: number, previous: InputSpec = {}) {
  let prev = previous;
  for (let i = 0; i < count; i++) { const next = { interact: true }; stepAltarInteraction(w, specToInput(prev, next)); prev = next; }
}
function altar(w: ShopWorld, slot = 0) { const a = w.interactables.filter((a) => a.kind === 'ability_altar')[slot]; w.teleportPlayer(a.x, a.y); }

describe('Crossroads shop stock (05 §10.1)', () => {
  it('uses the exact per-village/reroll RNG, draw order and next-stage odds', () => {
    const w = world(), rng = sourceRng(w.runSeed, 'shop', 1, 0), classes = w.classState.carriedClasses;
    const first = rollWeapon(rng, { ...GRADE_ODDS.free[2], F: 0, C: 0 }, classes), weapons = [first.weaponId], abilities: AbilityId[] = [];
    const expected: ShopState['slots'] = [{ kind: 'weapon', weapon: first }];
    for (let i = 1; i < 3; i++) {
      const ability = rng() < 0.40 ? rollAbility(rng, ['blade_dash'], classes, abilities) : null;
      if (ability) { abilities.push(ability.id); expected.push({ kind: 'ability', ability }); }
      else { const weapon = rollWeapon(rng, GRADE_ODDS.free[2], classes, { exclude: weapons }); weapons.push(weapon.weaponId); expected.push({ kind: 'weapon', weapon }); }
    }
    const key = rng() < 0.50; setupShop(w);
    expect(w.shop!.slots).toEqual(expected); expect(w.shop!.keyInStock).toBe(key);
    expect(stockItems(w)).toHaveLength(3);
  });
  it('same seed/state is stable, independent streams do not shift stock, repeated setup preserves purchases', () => {
    const a = world(), b = world(); a.rng.combat.next(); a.rng.enemyAI.next(); setupShop(a); setupShop(b);
    expect(a.shop).toEqual(b.shop); a.shop!.slots[0] = 'sold'; const ids = stockItems(a).map((i) => i.id);
    setupShop(a); expect(a.shop!.slots[0]).toBe('sold'); expect(stockItems(a).map((i) => i.id)).toEqual(ids);
  });
  it('always gives B+ first, no duplicate IDs, no carried ability, Lv1 full charges', () => {
    for (let seed = 0; seed < 100; seed++) {
      const w = world(`MIX${seed}`); setupShop(w);
      const first = w.shop!.slots[0]; expect(first !== 'sold' && first.kind === 'weapon' && ['B', 'A', 'S'].includes(first.weapon.grade)).toBe(true);
      const ids = w.shop!.slots.map((s) => s === 'sold' ? '' : s.kind === 'weapon' ? `w:${s.weapon.weaponId}` : `a:${s.ability.id}`);
      expect(new Set(ids).size).toBe(3);
      for (const s of w.shop!.slots) if (s !== 'sold' && s.kind === 'ability') { expect(s.ability.id).not.toBe('blade_dash'); expect(s.ability.level).toBe(1); expect(s.ability.charges).toBeGreaterThan(0); expect(s.ability.rechargeLeft).toBe(0); }
    }
  });
  it('10,000 seeds match the exact guaranteed-slot grade odds within1.5 percentage points', () => {
    const w = world(), counts = { B: 0, A: 0, S: 0 };
    for (let seed = 0; seed < 10000; seed++) {
      w.runSeed = seed; w.shop = null; setupShop(w);
      const item = w.shop!.slots[0]; if (item === 'sold' || item.kind !== 'weapon' || !(item.weapon.grade in counts)) throw new Error('guaranteed slot was below B');
      counts[item.weapon.grade as keyof typeof counts]++;
    }
    expect(Math.abs(counts.B / 10000 - 0.625)).toBeLessThan(0.015);
    expect(Math.abs(counts.A / 10000 - 0.28125)).toBeLessThan(0.015);
    expect(Math.abs(counts.S / 10000 - 0.09375)).toBeLessThan(0.015);
  });
  it('does not deduct gold before a real swap choice is confirmed', () => {
    const w = world(); w.combat.slots[1] = newWeapon('katana'); w.refreshClassState(); setupShop(w);
    w.econ.goldTenths = 100000; const item = stockItems(w).find((i) => i.weapon)!;
    w.teleportPlayer(item.x, item.y);
    stepInteract(w, specToInput({}, { interact: true }));
    expect(w.weaponSwapChoice).toEqual({ itemId: item.id }); expect(w.gold).toBe(10000);
    stepInteract(w, specToInput({ interact: true }, { attack1: true }));
    expect(w.gold).toBe(10000 - item.price!); expect(w.groundItems).not.toContain(item);
    expect(w.shop!.slots[item.shopSlot!]).toBe('sold');
  });
  it('revalidates gold on swap confirmation and never marks rejected stock SOLD', () => {
    const w = world(); w.combat.slots[1] = newWeapon('katana'); w.refreshClassState(); setupShop(w);
    w.econ.goldTenths = 10000; const item = stockItems(w).find((i) => i.weapon)!; w.teleportPlayer(item.x, item.y);
    stepInteract(w, specToInput({}, { interact: true })); w.econ.goldTenths = 0;
    stepInteract(w, specToInput({ interact: true }, { attack1: true }));
    expect(w.gold).toBe(0); expect(w.groundItems).toContain(item); expect(w.shop!.slots[item.shopSlot!]).not.toBe('sold');
  });
  it('rerolls cost50/100/150, refill SOLD slots, retain key stock, and reset in the next village', () => {
    const w = world(); setupShop(w); const key = w.shop!.keyInStock; w.econ.goldTenths = 10000;
    w.shop!.slots[0] = 'sold'; const oldIds = stockItems(w).map((i) => i.id);
    for (const price of [50, 100, 150]) { const before = w.gold; expect(rerollShop(w)).toBe(true); expect(w.gold).toBe(before - price); expect(w.shop!.keyInStock).toBe(key); expect(w.shop!.slots).not.toContain('sold'); }
    expect(stockItems(w)).toHaveLength(3); expect(stockItems(w).every((i) => !oldIds.includes(i.id))).toBe(true);
    setupShop(w, 2); expect(w.shop!.rerollCount).toBe(0); const before = w.gold; expect(rerollShop(w)).toBe(true); expect(w.gold).toBe(before - 50);
  });
  it('a refused reroll changes neither gold, stock, IDs nor count', () => {
    const w = world(); setupShop(w); const before = structuredClone(w.shop), ids = stockItems(w).map((i) => i.id);
    expect(rerollShop(w)).toBe(false); expect(w.gold).toBe(0); expect(w.shop).toEqual(before); expect(stockItems(w).map((i) => i.id)).toEqual(ids);
  });
});

describe('shop services and selling (05 §10–11)', () => {
  it('buying an ability and tapping it toLv5 costs exactly1070; selling pays535', () => {
    let w = world(); setupShop(w); let item = stockItems(w).find((i) => i.ability);
    for (let seed = 0; !item && seed < 100; seed++) { w = world(`BUY${seed}`); setupShop(w); item = stockItems(w).find((i) => i.ability); }
    if (!item) throw new Error('no ability shop in100 fixed seeds');
    w.econ.goldTenths = 10700; w.teleportPlayer(item.x, item.y);
    stepInteract(w, specToInput({}, { interact: true })); expect(w.abilities.slots[1]?.id).toBe(item.ability!.id);
    altar(w, 1);
    for (let level = 2; level <= 5; level++) { hold(w, 1); stepAltarInteraction(w, specToInput({ interact: true }, {})); expect(w.abilities.slots[1]!.level).toBe(level); }
    expect(w.gold).toBe(0); expect(sellAbility(w, 1)).toBe(true); expect(w.gold).toBe(535);
  });
  it('flask upgrades add one current/max charge, stop at4, and refill preserves banked fill', () => {
    const w = world(); setupShop(w); w.econ.goldTenths = 20000;
    expect(buyFlaskUpgrade(w)).toBe(true); expect([w.flask.charges, w.flask.maxCharges, w.gold]).toEqual([3, 3, 1700]);
    w.flask.charges = 1; expect(buyFlaskUpgrade(w)).toBe(true); expect([w.flask.charges, w.flask.maxCharges]).toEqual([2, 4]);
    const gold = w.gold; expect(buyFlaskUpgrade(w)).toBe(false); expect(w.gold).toBe(gold);
    w.flask.fillTenths = 321; expect(refill(w)).toBe(true); expect([w.flask.charges, w.flask.fillTenths]).toEqual([4, 321]);
    const after = w.gold; expect(refill(w)).toBe(false); expect(w.gold).toBe(after);
  });
  it('a shop sells one key, respects max3, and refuses every unaffordable service', () => {
    const w = world(); setupShop(w); w.shop!.keyInStock = true; w.econ.keys = 3; w.econ.goldTenths = 2000;
    expect(buyKey(w)).toBe(false); expect(w.shop!.keyInStock).toBe(true); expect(w.gold).toBe(200);
    w.econ.keys = 2; expect(buyKey(w)).toBe(true); expect(w.econ.keys).toBe(3); expect(w.gold).toBe(50); expect(w.shop!.keyInStock).toBe(false);
    expect(buyKey(w)).toBe(false); expect(buyFlaskUpgrade(w)).toBe(false); w.flask.charges = 0; expect(refill(w)).toBe(false); expect(w.gold).toBe(50);
  });
  it('Haggler discounts services and rerolls but never ability sale prices', () => {
    const w = world(); applyStatUpgrade(w, 'haggler'); setupShop(w); w.shop!.keyInStock = true; w.econ.goldTenths = 20000;
    expect(buyFlaskUpgrade(w)).toBe(true); expect(w.gold).toBe(1745); w.flask.charges = 0;
    expect(refill(w)).toBe(true); expect(w.gold).toBe(1530); expect(buyKey(w)).toBe(true); expect(w.gold).toBe(1400);
    for (const price of [45, 85, 130]) { const before = w.gold; expect(rerollShop(w)).toBe(true); expect(w.gold).toBe(before - price); }
    const before = w.gold; w.abilities.slots[0] = newAbility('blade_dash', 5); expect(sellAbility(w, 0)).toBe(true); expect(w.gold).toBe(before + 535); expect(w.abilities.slots[0]).toBeNull();
  });
  it('selling the last ability gives gold once, drops nothing and updates class immediately', () => {
    const w = world(); const ground = w.groundItems.length;
    expect(sellAbility(w, 0)).toBe(true); expect(w.gold).toBe(60); expect(w.abilities.slots[0]).toBeNull(); expect(w.classState.displayName).toBe('No Class'); expect(w.groundItems).toHaveLength(ground);
    expect(sellAbility(w, 0)).toBe(false); expect(w.gold).toBe(60);
  });
});

describe('ability altar tap/hold (06 §12.2)', () => {
  it.each(['max', 'unaffordable', 'empty'] as const)('tap refusal flash for%s emits one event; empty stays inactive', (reason) => {
    const w = world(); altar(w);
    if (reason === 'max') w.abilities.slots[0] = newAbility('blade_dash', 5);
    if (reason === 'empty') w.abilities.slots[0] = null;
    const before = w.events.filter((e) => e.t === 'cantAfford').length;
    hold(w, 1); stepAltarInteraction(w, specToInput({ interact: true }, {}));
    expect(w.events.filter((e) => e.t === 'cantAfford')).toHaveLength(before + (reason === 'empty' ? 0 : 1));
  });
  it('village altars require ground/crawl; jumping during a hold cancels it', () => {
    const w = world(); altar(w); w.body.state = 'air'; w.body.grounded = false; hold(w, 90);
    expect(w.abilities.slots[0]).not.toBeNull(); expect(w.gold).toBe(0);
    stepAltarInteraction(w, specToInput({ interact: true }, {})); w.body.state = 'ground'; w.body.grounded = true;
    hold(w, 10); w.body.state = 'air'; hold(w, 20, { interact: true }); w.body.state = 'ground'; hold(w, 60, { interact: true });
    stepAltarInteraction(w, specToInput({ interact: true }, {})); expect(w.abilities.slots[0]!.level).toBe(1); expect(w.gold).toBe(0);
  });
  it('interact with an open swap choice passes through to close it without starting an altar hold', () => {
    const w = world(); altar(w); w.weaponSwapChoice = { itemId: -1 };
    const input = specToInput({}, { interact: true }), out = stepAltarInteraction(w, input);
    expect(out.interact.pressed).toBe(true); expect(w.altarHold).toBeNull();
  });
  it('89 held ticks then release upgrades without selling; the interaction is consumed', () => {
    const w = world(); altar(w); w.econ.goldTenths = 10000;
    hold(w, 89); const out = stepAltarInteraction(w, specToInput({ interact: true }, {}));
    expect(out.interact.pressed).toBe(false); expect(out.interact.released).toBe(false);
    expect(w.abilities.slots[0]!.level).toBe(2); expect(w.gold).toBe(900); expect(w.altarHold).toBeNull();
  });
  it('90 held ticks sells exactly once; release never upgrades or drops the sold ability', () => {
    const w = world(); altar(w); const ground = w.groundItems.length;
    hold(w, 89); expect(w.abilities.slots[0]).not.toBeNull(); hold(w, 1, { interact: true });
    expect(w.abilities.slots[0]).toBeNull(); expect(w.gold).toBe(60); hold(w, 40, { interact: true });
    stepAltarInteraction(w, specToInput({ interact: true }, {})); expect(w.gold).toBe(60); expect(w.groundItems).toHaveLength(ground);
  });
  it('leaving overlap cancels both upgrade and sale, even if the held player returns', () => {
    const w = world(); altar(w); w.econ.goldTenths = 10000; hold(w, 30);
    w.teleportPlayer(50, 320); hold(w, 30, { interact: true }); altar(w); hold(w, 50, { interact: true });
    stepAltarInteraction(w, specToInput({ interact: true }, {})); expect(w.gold).toBe(1000); expect(w.abilities.slots[0]!.level).toBe(1);
  });
  it('empty slots do nothing; Lv5 tap does nothing but holding can still sell', () => {
    const w = world(); altar(w, 1); hold(w, 90); stepAltarInteraction(w, specToInput({ interact: true }, {})); expect(w.gold).toBe(0);
    altar(w); w.abilities.slots[0] = newAbility('blade_dash', 5); hold(w, 1); stepAltarInteraction(w, specToInput({ interact: true }, {})); expect(w.gold).toBe(0);
    hold(w, 90); expect(w.abilities.slots[0]).toBeNull(); expect(w.gold).toBe(535);
  });
});
