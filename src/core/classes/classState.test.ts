import { describe, expect, it } from 'vitest';
import { computeClassState } from './classState.ts';
import type { AbilityId } from '../abilities/types.ts';

describe('computeClassState (03 §4)', () => {
  it('checklist 1: Thief', () => {
    expect(computeClassState(['blade_dash', 'arrow_rain'])).toMatchObject({ hybrid: 'thief', displayName: 'Thief', connection: false, bond: null });
  });
  it('checklist 2: Storm Caller', () => {
    expect(computeClassState(['thunder_strike', 'frost_burst'])).toMatchObject({ bond: 'storm_caller', displayName: 'Wizard', bondName: 'Storm Caller', connection: true });
  });
  it('checklist 3: Vampire is neutral', () => {
    const s = computeClassState(['vampire', 'blink'], ['staff', 'bow']);
    expect(s).toMatchObject({ displayName: 'Wizard', bond: null, hybrid: null, weaponMatched: [true, false] });
    for (const a of [['vampire', null], [null, null]] as (AbilityId | null)[][]) {
      expect(computeClassState(a, ['staff', 'bow'])).toMatchObject({ displayName: 'No Class', weaponMatched: [false, false] });
    }
  });
  it('checklist 4: the Storm Hammer matches Tank or Wizard', () => {
    expect(computeClassState(['shockwave', null], ['storm_hammer', null]).weaponMatched[0]).toBe(true);
    expect(computeClassState(['blink', null], ['storm_hammer', null]).weaponMatched[0]).toBe(true);
    const tl = computeClassState(['shockwave', 'blink'], ['storm_hammer', null]);
    expect(tl.hybrid).toBe('thunderlord');
    expect(tl.weaponMatched[0]).toBe(true);
    expect(computeClassState(['arrow_rain', null], ['storm_hammer', null]).weaponMatched[0]).toBe(false);
  });
  it('all 10 pair kinds name themselves', () => {
    const one: Record<string, AbilityId> = { swordsman: 'blade_dash', tank: 'shockwave', archer: 'arrow_rain', wizard: 'thunder_strike' };
    const two: Record<string, AbilityId> = { swordsman: 'whirlwind', tank: 'shoulder_charge', archer: 'hunters_mark', wizard: 'blink' };
    const bonds: Record<string, [string, string]> = { swordsman: ['Swordsman', 'Blademaster'], tank: ['Tank', 'Iron Will'], archer: ['Archer', 'Eagle Eye'], wizard: ['Wizard', 'Storm Caller'] };
    for (const c of Object.keys(one)) expect(computeClassState([one[c], two[c]])).toMatchObject({ displayName: bonds[c][0], bondName: bonds[c][1] });
    const pairs: [string, string, string][] = [['swordsman', 'archer', 'Thief'], ['swordsman', 'tank', 'Gladiator'], ['swordsman', 'wizard', 'Spellblade'],
      ['tank', 'archer', 'Warden'], ['tank', 'wizard', 'Thunderlord'], ['archer', 'wizard', 'Arcane Archer']];
    for (const [a, b, name] of pairs) {
      expect(computeClassState([one[a], one[b]]).displayName).toBe(name);
      expect(computeClassState([one[b], one[a]]).displayName).toBe(name);
    }
  });
});
