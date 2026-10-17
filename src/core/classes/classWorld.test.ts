import { describe, expect, it } from 'vitest';
import { kitLoadout, newAbility, newWeapon } from '../abilities/runtime.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';

describe('class state in the world (03 §4.3–4.4)', () => {
  it('a Greatsword hit deals 16 unmatched and 20 matched (×1.25)', () => {
    for (const [ability, expected] of [[null, 16], ['blade_dash', 20]] as const) {
      const w = arenaWorld({ enemies: [{ enemy: 'bandit_brute', x: 230, y: 320, facing: -1 }] });
      w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [ability ? newAbility(ability) : null, null] });
      const e = w.enemies[0];
      e.hp = e.maxHp = 1000;
      const ev = stepSpec(w, { attack1: true }, 1).concat(stepSpec(w, {}, 40));
      const hit = ev.find((x) => x.t === 'hit' && x.target === e.id);
      expect(hit && hit.t === 'hit' ? hit.amount : -1).toBe(expected);
    }
  });
  it('classChanged fires only on a visible change; classDiscovered once per session', () => {
    const w = arenaWorld();
    w.setLoadout(kitLoadout('wizard', 'staff'));
    const kinds = () => w.events.map((e) => e.t);
    expect(kinds()).toContain('classChanged');
    w.events = [];
    w.abilities.slots[0] = newAbility('thunder_strike', 3);       // same class, level only: no event
    w.refreshClassState();
    expect(kinds()).toEqual([]);
    w.abilities.slots[1] = newAbility('blink');
    w.refreshClassState();
    expect(w.events).toEqual([
      { t: 'classChanged', displayName: 'Wizard', bond: 'storm_caller', hybrid: null },
      { t: 'classDiscovered', id: 'storm_caller' },
    ]);
    w.events = [];
    w.abilities.slots[1] = null; w.refreshClassState();
    w.abilities.slots[1] = newAbility('blink'); w.refreshClassState();
    expect(kinds()).toEqual(['classChanged', 'classChanged']);
  });
  it('restart keeps the kit', () => {
    const w = arenaWorld();
    w.setLoadout(kitLoadout('archer', 'bow'));
    w.restart();
    expect(w.combat.slots[0]?.weaponId).toBe('bow');
    expect(w.abilities.slots[0]?.id).toBe('arrow_rain');
    expect(w.classState.weaponMatched).toEqual([true, false]);
  });
});
