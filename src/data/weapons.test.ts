import { describe, it, expect } from 'vitest';
import { WEAPONS, DIVE } from './weapons.ts';
import { playerHitDamage } from '../core/combat/damage.ts';
import { phaseTicks } from '../core/combat/phases.ts';
import type { WeaponDef } from '../core/combat/types.ts';

const cycleTicks = (w: WeaponDef, atk = 1) =>
  w.combo.reduce((s, st) => s + phaseTicks(st.startup, atk) + phaseTicks(st.active, atk) + phaseTicks(st.recovery, atk), 0);
const matchedDps = (w: WeaponDef) =>
  w.combo.reduce((s, st) => s + playerHitDamage({ base: st.hit!.damage, grade: 'C', matched: true, isWeapon: true }).damage, 0) / (cycleTicks(w) / 120);

describe('weapons (02 §10)', () => {
  const gs = WEAPONS.greatsword!, wm = WEAPONS.war_maul!;
  it('C-grade matched Greatsword combo deals 20, 20, 43 and one cycle is 216 ticks (checklist 1)', () => {
    expect(gs.combo.map((s) => playerHitDamage({ base: s.hit!.damage, grade: 'C', matched: true, isWeapon: true }).damage)).toEqual([20, 20, 43]);
    expect(cycleTicks(gs)).toBe(216);
  });
  it('matched DPS is 43–47 (Greatsword 46.1, War Maul 45.4) (checklist 3)', () => {
    expect(matchedDps(gs)).toBeCloseTo(46.1, 1);
    expect(matchedDps(wm)).toBeCloseTo(45.4, 1);
    for (const w of [gs, wm]) { expect(matchedDps(w)).toBeGreaterThanOrEqual(43); expect(matchedDps(w)).toBeLessThanOrEqual(47); }
  });
  it('War Maul step 2 is the heavy smash with box 28,−10,56,20', () => {
    expect(wm.combo[1].hit!.heavy).toBe(true);
    expect(wm.combo[1].box).toEqual({ dx: 28, dy: -10, w: 56, h: 20 });
    expect(wm.combo[0].hit!.heavy).toBe(true);
  });
  it('both are heavy, repeat, with move cap 0.25 and their dives', () => {
    for (const w of [gs, wm]) {
      expect(w.weight).toBe('heavy'); expect(w.hold).toBe('repeat');
      for (const s of w.combo) { expect(s.moveMult).toBe(0.25); expect(s.hit!.kind).toBe('melee'); }
    }
    expect(gs.dive).toBe('standard'); expect(wm.dive).toBe('war_maul');
    expect(gs.combo[2].hit).toMatchObject({ damage: 34, kb: [260, -120], poise: 40, hitStop: 0.10, heavy: true });
    expect(gs.combo[0].hit!.heavy).toBeFalsy();
  });
  it('dive data (02 §9.7, §10.5)', () => {
    expect(DIVE.heavy.impactBox).toEqual({ dx: 0, dy: -8, w: 64, h: 16 });
    expect(DIVE.heavy.hit.damage).toBe(26);
    expect(DIVE.lightMedium.hit.damage).toBe(18);
    expect(DIVE.warMaul.impactBox).toEqual({ dx: 0, dy: -12, w: 128, h: 24 });
    expect(DIVE.warMaul.hit).toMatchObject({ damage: 30, kb: [200, -200], poise: 50, hitStop: 0.10, heavy: true, control: { type: 'knockdown', duration: 1.0 } });
  });
  it('phaseTicks scales by attack speed and keeps 0 at 0 (02 §9.9)', () => {
    expect(phaseTicks(0.2, 1)).toBe(24);
    expect(phaseTicks(0, 1.45)).toBe(0);
    expect(phaseTicks(0.001, 1)).toBe(1);
    expect(phaseTicks(0.35, 1.45)).toBe(29);
  });
});
