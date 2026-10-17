import { describe, expect, it } from 'vitest';
import { newAbility, newWeapon } from './runtime.ts';
import type { AbilityId } from './types.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { dropItem } from './items.ts';
import type { WeaponId } from '../combat/types.ts';

function setup(abilities: [AbilityId | null, AbilityId | null], weapons: [WeaponId | null, WeaponId | null] = ['greatsword', null]): GameWorld {
  const w = arenaWorld();
  w.setLoadout({ weapons: [weapons[0] && newWeapon(weapons[0]), weapons[1] && newWeapon(weapons[1])], abilities: [abilities[0] && newAbility(abilities[0]), abilities[1] && newAbility(abilities[1])] });
  stepSpec(w, {}, 2);
  return w;
}
const run = (w: GameWorld, spec: InputSpec, n = 1) => stepSpec(w, spec, n);
/** An item right at the player's feet, settled. */
function itemHere(w: GameWorld, item: Parameters<typeof dropItem>[3]) {
  const it = dropItem(w, w.body.x, w.body.y, item);
  run(w, {}, 2);
  return it;
}

describe('ability items (03 §7.1, checklist 13–15)', () => {
  it('13: a new item is Lv1 with full charges, whatever you carry', () => {
    expect(newAbility('blink')).toEqual({ id: 'blink', level: 1, charges: 1, rechargeLeft: 0 });
  });
  it('14: a dropped Lv3 ability on cooldown keeps its level and keeps recharging', () => {
    const w = setup(['thunder_strike', 'blink']);
    w.abilities.slots[0] = { id: 'thunder_strike', level: 3, charges: 0, rechargeLeft: 900 };
    itemHere(w, { ability: newAbility('frost_burst') });
    run(w, { interact: true }, 1);
    expect(w.abilities.swapChoice).not.toBeNull();
    run(w, { ability1: true }, 1);                              // replace slot 1
    expect(w.abilities.slots[0]?.id).toBe('frost_burst');
    const dropped = w.groundItems.find((i) => i.ability?.id === 'thunder_strike')!;
    expect(dropped.ability!.level).toBe(3);
    const before = dropped.ability!.rechargeLeft;
    run(w, {}, 240);
    run(w, { interact: true }, 1);                              // same-class item: swap choice again
    run(w, { ability1: true }, 1);
    expect(w.abilities.slots[0]).toMatchObject({ id: 'thunder_strike', level: 3 });
    expect(before - w.abilities.slots[0]!.rechargeLeft).toBeGreaterThanOrEqual(240);
  });
  it('15: picking up an ability you already carry swaps that slot directly', () => {
    const w = setup(['blink', 'thunder_strike']);
    w.abilities.slots[0] = { id: 'blink', level: 4, charges: 1, rechargeLeft: 0 };
    itemHere(w, { ability: newAbility('blink') });
    run(w, { interact: true }, 1);
    expect(w.abilities.swapChoice).toBeNull();
    expect(w.abilities.slots[0]?.level).toBe(1);
    expect(w.groundItems.some((i) => i.ability?.level === 4)).toBe(true);
  });
  it('an empty slot fills; the class state recomputes the same tick', () => {
    const w = setup(['thunder_strike', null]);
    itemHere(w, { ability: newAbility('blink') });
    const ev = run(w, { interact: true }, 1);
    expect(w.abilities.slots[1]?.id).toBe('blink');
    expect(w.classState.bond).toBe('storm_caller');
    expect(ev.map((e) => e.t)).toContain('classChanged');
  });
  it('the swap choice: ability buttons pick a slot and never activate; it closes on interact, walking away or damage', () => {
    const w = setup(['thunder_strike', 'blink']);
    itemHere(w, { ability: newAbility('shockwave') });
    run(w, { interact: true }, 1);
    expect(w.abilities.swapChoice).not.toBeNull();
    run(w, {}, 1);
    run(w, { interact: true }, 1);
    expect(w.abilities.swapChoice).toBeNull();
    run(w, {}, 1); run(w, { interact: true }, 1);
    run(w, { moveX: 1 }, 30);
    expect(w.abilities.swapChoice).toBeNull();
    const v = setup(['thunder_strike', 'blink']);
    itemHere(v, { ability: newAbility('shockwave') });
    run(v, { interact: true }, 1);
    v.onPlayerDamaged();
    expect(v.abilities.swapChoice).toBeNull();
  });
  it('pickup is refused during a cast or an ability move', () => {
    const w = setup(['thunder_strike', null]);
    itemHere(w, { ability: newAbility('blink') });
    run(w, { ability1: true }, 1);
    run(w, { interact: true }, 1);
    expect(w.abilities.slots[1]).toBeNull();
  });
});

describe('weapon items (05 §5.7, 07 §6.2)', () => {
  it('fills an empty slot; with both full the attack buttons pick the slot and never attack; the old one drops', () => {
    const w = setup([null, null], ['greatsword', null]);
    itemHere(w, { weapon: newWeapon('katana') });
    run(w, { interact: true }, 1);
    expect(w.combat.slots[1]?.weaponId).toBe('katana');
    itemHere(w, { weapon: newWeapon('bow') });
    run(w, {}, 1);
    run(w, { interact: true }, 1);
    expect(w.weaponSwapChoice).not.toBeNull();
    run(w, { attack2: true }, 1);
    expect(w.combat.current).toBeNull();
    expect(w.combat.slots[1]?.weaponId).toBe('bow');
    expect(w.groundItems.some((i) => i.weapon?.weaponId === 'katana')).toBe(true);
  });
  it('is refused while attacking; only one swap choice at a time', () => {
    const w = setup([null, null], ['greatsword', 'war_maul']);
    itemHere(w, { weapon: newWeapon('katana') });
    run(w, { attack1: true }, 1);
    run(w, { interact: true }, 1);
    expect(w.weaponSwapChoice).toBeNull();
    run(w, {}, 80);
    run(w, { interact: true }, 1);
    expect(w.weaponSwapChoice).not.toBeNull();
    expect(w.abilities.swapChoice).toBeNull();
  });
  it('an endless armory stand leaves a copy', () => {
    const w = setup([null, null], ['greatsword', null]);
    itemHere(w, { weapon: newWeapon('staff'), endless: true });
    run(w, { interact: true }, 1);
    expect(w.combat.slots[1]?.weaponId).toBe('staff');
    expect(w.groundItems.filter((i) => i.weapon?.weaponId === 'staff').length).toBe(1);
  });
});
