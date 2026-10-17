import { describe, expect, it } from 'vitest';
import { newWeapon } from '../abilities/runtime.ts';
import type { WeaponInstance } from '../combat/types.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { attackSpeedBonus, critChance, extraSpeed, incomingMult } from './perks.ts';
import { attackSpeed } from '../combat/playerCombat.ts';

const A = (id: 'greatsword' | 'katana', perk: string): WeaponInstance => ({ ...newWeapon(id), grade: 'A', element: 'fire', perk });
function world(weapons: [WeaponInstance | null, WeaponInstance | null], enemy = 'bandit_brute' as const) {
  const w = arenaWorld({ enemies: [{ enemy, x: 230, y: 320, facing: -1 }] });
  w.setLoadout({ weapons, abilities: [null, null] });
  stepSpec(w, {}, 2);
  return w;
}
const swingDamage = (w: ReturnType<typeof world>) => {
  const ev = [...stepSpec(w, { attack1: true }, 1), ...stepSpec(w, {}, 40)];
  return ev.filter((e) => e.t === 'hit' && e.target !== 'player' && !e.dot && e.slot === 0).map((e) => (e as { amount: number }).amount)[0];
};

describe('A-grade perks (05 §4.4)', () => {
  it('Quick: +15% attack speed for this weapon only', () => {
    const w = world([A('greatsword', 'quick'), newWeapon('katana')]);
    expect(attackSpeedBonus(w, 0)).toBeCloseTo(0.15);
    expect(attackSpeedBonus(w, 1)).toBe(0);
    expect(attackSpeed(w, 'heavy', 0) / attackSpeed(w, 'heavy', 1)).toBeCloseTo(1.15);
  });
  it('Keen: +12% critChance on this weapon', () => {
    const w = world([A('greatsword', 'keen'), null]);
    expect(critChance(w, 0)).toBeCloseTo(0.12);
    expect(critChance(w, 1)).toBe(0);
  });
  it('Brutal: +15% in the bonus pool', () => {
    const base = swingDamage(world([{ ...A('greatsword', 'quick') }, null]));
    const brutal = swingDamage(world([A('greatsword', 'brutal'), null]));
    expect(brutal / base).toBeCloseTo(1.15, 1);
  });
  it('Finisher: +40% when the target is at ≤ 30% HP', () => {
    const w1 = world([A('greatsword', 'finisher'), null]);
    const full = swingDamage(w1);
    const w2 = world([A('greatsword', 'finisher'), null]);
    w2.enemies[0].hp = Math.floor(w2.enemies[0].maxHp * 0.3);
    expect(swingDamage(w2) / full).toBeCloseTo(1.4, 1);
  });
  it('Leeching: 1 HP per 40 damage dealt, banked on the weapon', () => {
    const w = world([A('greatsword', 'leeching'), null]);
    w.health.hp = 50;
    const dmg = swingDamage(w);
    expect(w.health.hp).toBe(50 + Math.floor(dmg / 40));
    expect((w.combat.slots[0] as WeaponInstance & { leechBank: number }).leechBank).toBe(dmg % 40);
  });
  it('Fleet: +8% move speed per carried copy (two = +16%); Sturdy ×0.90 each (two = ×0.81)', () => {
    expect(extraSpeed(world([A('greatsword', 'fleet'), A('katana', 'fleet')]))).toBeCloseTo(0.16);
    expect(incomingMult(world([A('greatsword', 'sturdy'), A('katana', 'sturdy')]))).toBeCloseTo(0.81);
    expect(incomingMult(world([A('greatsword', 'sturdy'), null]))).toBeCloseTo(0.9);
  });
});
