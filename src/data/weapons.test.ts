import { describe, it, expect } from 'vitest';
import { WEAPONS, DIVE } from './weapons.ts';
import { PLAYER_PROJECTILES } from './playerProjectiles.ts';
import { playerHitDamage } from '../core/combat/damage.ts';
import { phaseTicks } from '../core/combat/phases.ts';
import type { WeaponDef } from '../core/combat/types.ts';

const cycleTicks = (w: WeaponDef, atk = 1) =>
  w.combo.reduce((s, st) => s + phaseTicks(st.startup, atk) + phaseTicks(st.active, atk) + phaseTicks(st.recovery, atk), 0);
/** Matched damage of one step: every projectile is its own hit, rounded on its own (02 §3.1). */
const stepMatched = (st: WeaponDef['combo'][number]) =>
  (st.hit ? [st.hit.damage] : (st.projectiles ?? []).map((p) => PLAYER_PROJECTILES[p.id]!.hit.damage))
    .reduce((s, base) => s + playerHitDamage({ base, grade: 'C', matched: true, isWeapon: true }).damage, 0);
const matchedDps = (w: WeaponDef) => w.combo.reduce((s, st) => s + stepMatched(st), 0) / (cycleTicks(w) / 120);

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
  it('the M4 weapons match 02 §10.1 C-matched DPS (checklist 3)', () => {
    const want: Record<string, number> = { katana: 45.3, iron_fists: 45.8, bow: 46.2, crossbow: 45.0, storm_hammer: 45.4, staff: 45.7 };
    for (const [id, dps] of Object.entries(want)) {
      const w = WEAPONS[id as keyof typeof WEAPONS]!;
      expect(matchedDps(w), id).toBeCloseTo(dps, 0);
      expect(matchedDps(w)).toBeGreaterThanOrEqual(43);
      expect(matchedDps(w)).toBeLessThanOrEqual(47);
    }
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

  it('all 19 weapons have a def (M9 part 2)', () => {
    const all = ['greatsword', 'katana', 'twin_daggers', 'spear', 'scythe', 'war_maul', 'iron_fists', 'giant_axe', 'flail', 'shield', 'bow', 'crossbow',
      'hand_cannon', 'javelin', 'throwing_knives', 'storm_hammer', 'staff', 'wand', 'spell_tome'] as const;
    for (const id of all) expect(WEAPONS[id], id).toBeDefined();
  });
  it('the M9 weapons match 02 §10.1 C-matched DPS (checklist 3)', () => {
    const want: Record<string, number> = { twin_daggers: 46.0, spear: 45.4, scythe: 44.6, giant_axe: 45.6, flail: 45.5, hand_cannon: 44.7,
      javelin: 44.3, throwing_knives: 45.0, wand: 43.3 };
    for (const [id, dps] of Object.entries(want)) {
      const w = WEAPONS[id as keyof typeof WEAPONS]!;
      expect(matchedDps(w), id).toBeCloseTo(dps, 0);
      expect(matchedDps(w), id).toBeGreaterThanOrEqual(43);
      expect(matchedDps(w), id).toBeLessThanOrEqual(47);
    }
    expect(matchedDps(WEAPONS.shield!)).toBeCloseTo(37.5, 0);                    // the Shield is deliberately below 43
    expect(matchedDps(WEAPONS.spell_tome!) + 20).toBeCloseTo(45.0, 0);           // direct hits 25 + the ring's 20 when matched
  });
  it('Twin Daggers at F unmatched: 4 hits kill 30 HP exactly (8, 8, 8, 10) (checklist 2)', () => {
    const d = WEAPONS.twin_daggers!;
    const dmg = d.combo.map((s) => playerHitDamage({ base: s.hit!.damage, grade: 'F', matched: false, isWeapon: true }).damage);
    expect(dmg).toEqual([8, 8, 8, 10]);
    expect(dmg.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(30);
  });
  it('weights, holds and move caps follow 02 §10.1 and §9.3', () => {
    const wt: Record<string, [string, string]> = { twin_daggers: ['light', 'repeat'], spear: ['medium', 'repeat'], scythe: ['medium', 'repeat'],
      giant_axe: ['heavy', 'repeat'], flail: ['heavy', 'charge'], shield: ['medium', 'shield'], hand_cannon: ['heavy', 'repeat'],
      javelin: ['heavy', 'repeat'], throwing_knives: ['light', 'repeat'], wand: ['light', 'repeat'], spell_tome: ['medium', 'repeat'] };
    const cap = { light: 0.6, medium: 0.4, heavy: 0.25 };
    for (const [id, [weight, hold]] of Object.entries(wt)) {
      const w = WEAPONS[id as keyof typeof WEAPONS]!;
      expect([w.weight, w.hold], id).toEqual([weight, hold]);
      for (const st of w.combo) expect(st.moveMult).toBe(cap[w.weight]);
    }
    expect(WEAPONS.flail!.chargeTime).toBe(0.60);
    expect(WEAPONS.hand_cannon!.combo[0].recoveryMoveMult).toBe(1);
    expect(WEAPONS.spear!.special!.moveMult).toBe(1);
    expect(WEAPONS.giant_axe!.special).toMatchObject({ moveMult: 1, canTurn: true });
  });
  it('projectile table (02 §10.4)', () => {
    expect(PLAYER_PROJECTILES.cannonball).toMatchObject({ speed: 520, range: 360, onWall: 'explode', blast: { w: 56, h: 56 } });
    expect(PLAYER_PROJECTILES.javelin).toMatchObject({ speed: 560, lifetime: 1.5, gravity: 300, pierce: 1, onWall: 'stick', w: 20, h: 4 });
    expect(PLAYER_PROJECTILES.knife).toMatchObject({ speed: 640, range: 240, w: 8, h: 4 });
    expect(PLAYER_PROJECTILES.wand_shot).toMatchObject({ speed: 420, range: 240, homing: { radius: 96, turnRate: 180 } });
  });
});
