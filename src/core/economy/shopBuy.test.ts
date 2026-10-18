import { describe, expect, it } from 'vitest';
import json from '../../../public/levels/village_crossroads.json';
import { loadLevel } from '../level/loadLevel.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { newWeapon } from '../abilities/runtime.ts';
import { buyKey, rerollShop } from './shop.ts';
describe('shop confirmation revalidation (05 §10.2)', () => {
  it('a bought key stays sold across rerolls', () => {
    const w = GameWorld.fromLevel(loadLevel(json), { seedText: 'KEY' }); stepSpec(w, {}); w.econ.goldTenths = 20000; w.shop!.keyInStock = true;
    expect(buyKey(w)).toBe(true); expect(w.shop!.keyInStock).toBe(false);
    expect(rerollShop(w)).toBe(true); expect(w.shop!.keyInStock).toBe(false); expect(w.econ.keys).toBe(1);
  });
  it('cancelling a pending swap spends nothing; a reroll invalidates it and only charges its fee', () => {
    const w = GameWorld.fromLevel(loadLevel(json), { seedText: 'CANCEL' }); w.setStartingKit({ cls: 'tank', weapon: 'war_maul' }); w.combat.slots[1] = newWeapon('katana'); w.econ.goldTenths = 10000; stepSpec(w, {});
    const item = w.groundItems.find((it) => it.shopSlot === 0)!;
    w.teleportPlayer(item.x, item.y); stepSpec(w, { interact: true }); stepSpec(w, {}); stepSpec(w, { interact: true });
    expect(w.weaponSwapChoice).toBeNull(); expect(w.gold).toBe(1000); expect(w.shop!.slots[0]).not.toBe('sold');
    stepSpec(w, {}); stepSpec(w, { interact: true }); expect(w.weaponSwapChoice).not.toBeNull();
    rerollShop(w); stepSpec(w, { attack1: true });
    expect(w.weaponSwapChoice).toBeNull(); expect(w.gold).toBe(950); expect(w.combat.slots[0]?.weaponId).toBe('war_maul');
  });
  it('priced stock and village services require ground or crawl', () => {
    const w = GameWorld.fromLevel(loadLevel(json), { seedText: 'AIR' }); w.econ.goldTenths = 10000; stepSpec(w, {});
    const item = w.groundItems.find((it) => it.shopSlot === 0)!;
    w.teleportPlayer(item.x, item.y - 4); w.body.state = 'air'; w.body.grounded = false;
    stepSpec(w, { interact: true });
    expect(w.groundItems).toContain(item); expect(w.gold).toBe(1000);
    w.teleportPlayer(26 * 16 + 8, 316); w.body.state = 'air'; w.body.grounded = false; stepSpec(w, {}); stepSpec(w, { interact: true });
    expect(w.flask.maxCharges).toBe(2); expect(w.gold).toBe(1000);
  });
  it('an unaffordable pending weapon swap never takes the item or marks SOLD', () => {
    const w = GameWorld.fromLevel(loadLevel(json), { seedText: 'SWAP' });
    w.setStartingKit({ cls: 'tank', weapon: 'war_maul' }); w.combat.slots[1] = newWeapon('katana'); w.econ.goldTenths = 10000;
    stepSpec(w, {});
    const item = w.groundItems.find((it) => it.shopSlot === 0)!;
    w.teleportPlayer(item.x, item.y); stepSpec(w, { interact: true });
    expect(w.weaponSwapChoice).not.toBeNull();
    w.econ.goldTenths = 0; stepSpec(w, { attack1: true });
    expect(w.combat.slots[0]?.weaponId).toBe('war_maul');
    expect(w.groundItems).toContain(item); expect(w.shop?.slots[0]).not.toBe('sold'); expect(w.gold).toBe(0);
  });
});
