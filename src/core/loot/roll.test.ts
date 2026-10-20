import { ABILITIES } from '../../data/abilities.ts';
import { describe, expect, it } from 'vitest';
import { FIXED_ODDS, GRADE_ODDS } from '../../data/loot.ts';
import { WEAPON_CLASSES } from '../../data/classes.ts';
import { mulberry32 } from '../rng.ts';
import { abilityPool, itemName, rollAbility, rollWeapon, weaponPool } from './roll.ts';

const counting = (seed: number) => { const r = mulberry32(seed); const f = Object.assign(() => { f.n++; return r(); }, { n: 0 }); return f; };

describe('weapon and ability rolls (05 §4)', () => {
  it('7: B/A/S always have an element, F/C never; only A/S have a perk; exactly 5 draws every time', () => {
    for (let s = 0; s < 3000; s++) {
      const rng = counting(s);
      const w = rollWeapon(rng, GRADE_ODDS.free[1], []);
      expect(rng.n).toBe(5);
      expect(w.element === null).toBe(w.grade === 'F' || w.grade === 'C');
      expect(w.perk !== null).toBe(w.grade === 'A' || w.grade === 'S');
    }
  });
  it('5: Dragon rolls are A/S with the forced element; Black Knight rolls are B/A/S at 60/31/9', () => {
    const n = 100000, d = { A: 0, S: 0 } as Record<string, number>, bk = { B: 0, A: 0, S: 0 } as Record<string, number>;
    const rng = mulberry32(5);
    for (let i = 0; i < n; i++) {
      const w = rollWeapon(rng, FIXED_ODDS.dragon, [], { forcedElement: 'ice' });
      d[w.grade] = (d[w.grade] ?? 0) + 1;
      expect(w.element).toBe('ice');
      const b = rollWeapon(rng, FIXED_ODDS.blackKnight, []);
      bk[b.grade] = (bk[b.grade] ?? 0) + 1;
    }
    expect(Object.keys(d).sort()).toEqual(['A', 'S']);
    expect(Math.abs(d.A / n - 0.75)).toBeLessThan(0.005);
    expect(Object.keys(bk).sort()).toEqual(['A', 'B', 'S']);
    expect(Math.abs(bk.B / n - 0.60)).toBeLessThan(0.005);
    expect(Math.abs(bk.A / n - 0.31)).toBeLessThan(0.005);
  });
  it('6: class lean on the implemented pool: one Swordsman ability → Swordsman weapons ≈ 0.35 + 0.65 × sw/19; Vampire only → uniform', () => {
    const pool = weaponPool();
    expect(pool.length).toBe(19);
    const sw = pool.filter((p) => WEAPON_CLASSES[p].includes('swordsman')).length;
    const n = 100000, rng = mulberry32(6);
    let hits = 0;
    for (let i = 0; i < n; i++) if (WEAPON_CLASSES[rollWeapon(rng, GRADE_ODDS.free[1], ['swordsman']).weaponId].includes('swordsman')) hits++;
    expect(Math.abs(hits / n - (0.35 + 0.65 * sw / pool.length))).toBeLessThan(0.005);
    const counts = new Map<string, number>();
    for (let i = 0; i < n; i++) { const id = rollWeapon(rng, GRADE_ODDS.free[1], []).weaponId; counts.set(id, (counts.get(id) ?? 0) + 1); }
    for (const c of counts.values()) expect(Math.abs(c / n - 1 / pool.length)).toBeLessThan(0.006);
  });
  it('8: names', () => {
    expect(itemName({ weaponId: 'greatsword', grade: 'S', element: 'fire', perk: 'keen' })).toBe('Sunbreaker');
    expect(itemName({ weaponId: 'storm_hammer', grade: 'S', element: 'lightning', perk: 'keen' })).toBe('Skysplitter');
    expect(itemName({ weaponId: 'bow', grade: 'B', element: 'wind', perk: null })).toBe('Wind Bow');
    expect(itemName({ weaponId: 'katana', grade: 'C', element: null, perk: null })).toBe('Katana');
  });
  it('28: an ability roll never returns a carried ability; it is Lv1 with full charges; both draws always made', () => {
    for (let s = 0; s < 500; s++) {
      const rng = counting(s);
      const a = rollAbility(rng, ['blade_dash', 'blink'], ['swordsman', 'wizard'])!;
      expect(rng.n).toBe(2);
      expect(['blade_dash', 'blink']).not.toContain(a.id);
      expect(a.level).toBe(1);
      expect(a.charges).toBeGreaterThanOrEqual(1);
      expect(a.rechargeLeft).toBe(0);
    }
    expect(abilityPool([]).length).toBe(Object.keys(ABILITIES).length);   // every implemented ability
  });
  it('exclusions: a weapon roll can leave out ids (key chest item B)', () => {
    for (let s = 0; s < 300; s++) expect(rollWeapon(mulberry32(s), GRADE_ODDS.key[1], [], { exclude: ['greatsword'] }).weaponId).not.toBe('greatsword');
  });
});
