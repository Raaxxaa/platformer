import { describe, it, expect } from 'vitest';
import { GRADE_MULT, playerHitDamage, enemyHitDamage } from './damage.ts';
import { roundHalfUp } from '../math.ts';

describe('damage (02 §3)', () => {
  it('grade multipliers', () => {
    expect(GRADE_MULT).toEqual({ F: 0.8, C: 1.0, B: 1.25, A: 1.6, S: 2.0 });
  });
  it('base 20, C, matched, +0.30, crit, target 1.3 deals 85 (checklist 5)', () => {
    const r = playerHitDamage({ base: 20, grade: 'C', matched: true, bonus: 0.30, crit: true, targetMult: 1.3, isWeapon: true });
    expect(r.procBase).toBeCloseTo(32.5, 9);
    expect(r.damage).toBe(85);
  });
  it('base 12 at F deals 10; damage never below 1 (checklist 6)', () => {
    expect(playerHitDamage({ base: 12, grade: 'F', isWeapon: true }).damage).toBe(10);
    expect(playerHitDamage({ base: 0.1, isWeapon: true }).damage).toBe(1);
  });
  it('ability hits skip grade and match', () => {
    expect(playerHitDamage({ base: 20, grade: 'S', matched: true, isWeapon: false }).damage).toBe(20);
  });
  it('enemy → player: round half up, minimum 1, curse = current HP (02 §3.3)', () => {
    expect(enemyHitDamage(10 * 1.3, 1, null)).toBe(13);
    expect(enemyHitDamage(10, 0.25, null)).toBe(3);
    expect(enemyHitDamage(1, 0.25, null)).toBe(1);
    expect(enemyHitDamage(10, 1, 37)).toBe(37);
  });
  it('roundHalfUp', () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(2.4999)).toBe(2);
    expect(roundHalfUp(9.6)).toBe(10);
  });
});
