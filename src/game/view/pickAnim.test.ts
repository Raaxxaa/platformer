import { describe, expect, it } from 'vitest';
import animsJson from '../../../public/assets/anims.json';
import type { AnimDef } from './animClock.ts';
import { yardDummyFrame, pickEnemyAnim, pickPlayerAnim, type EnemyAnimState, type PlayerAnimState } from './pickAnim.ts';

const defs = animsJson as AnimDef[];
const player = (k: string) => defs.find((d) => d.atlas === 'player_swordsman' && d.key === k) ?? defs.find((d) => d.atlas.startsWith('weapon_') && d.key === k);
const wolf = (k: string) => defs.find((d) => d.atlas === 'enemies_plains' && d.key === `wolf_${k}`);

const base: PlayerAnimState = {
  state: 'ground', stateTicks: 50, vx: 0, vy: 0, facing: 1, landSpeed: 0, dead: false, attack: null,
  diveWeapon: 'greatsword', drinkTicks: null, ticksSinceDoubleJump: 999, ticksSinceWallJump: 999,
};
const pick = (s: Partial<PlayerAnimState>, t = 0, run = 0) => pickPlayerAnim({ ...base, ...s }, player, t, run);

describe('player anim choice (08 §5.2, §6.1)', () => {
  it('movement states', () => {
    expect(pick({}).key).toBe('idle');
    expect(pick({ vx: 170 }, 0, 3).key).toBe('run');
    expect(pick({ vx: 170 }, 0, 3).frame).toBe(3);
    expect(pick({ vx: -170 }).key).toBe('skid');
    expect(pick({ state: 'air', vy: -200 }).key).toBe('jump');
    expect(pick({ state: 'air', vy: 0 }).key).toBe('apex');
    expect(pick({ state: 'air', vy: 200 }).key).toBe('fall');
    expect(pick({ state: 'air', vy: -200, ticksSinceDoubleJump: 3 }).key).toBe('double_jump');
    expect(pick({ state: 'air', vy: -200, ticksSinceWallJump: 3 }).key).toBe('wall_jump');
    expect(pick({ state: 'ground', stateTicks: 2, landSpeed: 300 }).key).toBe('land');
    expect(pick({ state: 'wallSlide' }).key).toBe('wall_slide');
    expect(pick({ state: 'slide', stateTicks: 3 }).frame).toBe(0);
    expect(pick({ state: 'slide', stateTicks: 9 }).frame).toBe(1);
  });
  it('dash frames by dash tick', () => {
    expect(pick({ state: 'dash', stateTicks: 1 }).frame).toBe(0);
    expect(pick({ state: 'dash', stateTicks: 5 }).frame).toBe(1);
    expect(pick({ state: 'dash', stateTicks: 16 }).frame).toBe(2);
  });
  it('dead beats hurt beats attack beats drink', () => {
    const attack = { weaponId: 'greatsword', step: 0, phase: 'active' as const, phaseTicks: 1, lens: { startup: 30, active: 6, recovery: 30 } };
    expect(pick({ dead: true, attack }).key).toBe('dead');
    expect(pick({ state: 'hurt', attack }).key).toBe('hurt');
    expect(pick({ attack, drinkTicks: 10 }).key).toBe('atk_greatsword_1');
    expect(pick({ drinkTicks: 10 }).key).toBe('drink');
  });
  it('weapon steps: frame by phase, weapon layer, smear in active and the first 6 recovery ticks', () => {
    const lens = { startup: 30, active: 6, recovery: 30 };
    const s = pick({ attack: { weaponId: 'war_maul', step: 1, phase: 'startup', phaseTicks: 1, lens } });
    expect(s.key).toBe('atk_war_maul_2');
    expect(s.weapon).toEqual({ atlas: 'weapon_war_maul', frame: 'atk_war_maul_2_00', behind: false, smear: null });
    const a = pick({ attack: { weaponId: 'greatsword', step: 0, phase: 'active', phaseTicks: 1, lens } });
    expect(a.frame).toBe(2);
    expect(a.weapon!.smear).toBe('atk_greatsword_1_smear');
    expect(pick({ attack: { weaponId: 'greatsword', step: 0, phase: 'recovery', phaseTicks: 6, lens } }).weapon!.smear).not.toBeNull();
    expect(pick({ attack: { weaponId: 'greatsword', step: 0, phase: 'recovery', phaseTicks: 7, lens } }).weapon!.smear).toBeNull();
    // Greatsword step 1 frames 0 and 1 draw the weapon behind the body.
    expect(pick({ attack: { weaponId: 'greatsword', step: 0, phase: 'startup', phaseTicks: 1, lens } }).weapon!.behind).toBe(true);
  });
  it('ART5 weapons: steps, charged attacks, the hammer throw, charge poses; ranged weapons have no smear', () => {
    const lens = { startup: 12, active: 4, recovery: 12 };
    const k = pick({ attack: { weaponId: 'iron_fists', step: 3, phase: 'active', phaseTicks: 1, lens } });
    expect(k.key).toBe('atk_iron_fists_4');
    expect(k.weapon!.smear).toBe('atk_iron_fists_4_smear');
    const bow = pick({ attack: { weaponId: 'bow', step: 0, phase: 'active', phaseTicks: 1, lens } });
    expect(bow.key).toBe('atk_bow_1');
    expect(bow.weapon!.smear).toBeNull();
    expect(bow.frame).toBe(1);                                    // no active segment: hold the last startup frame
    expect(pick({ attack: { weaponId: 'staff', step: 0, phase: 'startup', phaseTicks: 1, lens, kind: 'charged' } }).key).toBe('atk_staff_charged');
    expect(pick({ attack: { weaponId: 'storm_hammer', step: 0, phase: 'startup', phaseTicks: 1, lens, kind: 'throw' } }).key).toBe('atk_storm_hammer_throw');
    expect(pick({ attack: { weaponId: 'storm_hammer', step: 0, phase: 'recovery', phaseTicks: 1, lens, kind: 'throw' } }).weapon!.smear).toBeNull();   // the throw has no smear frame
    const ch = pick({ charging: 'katana' }, 0.2);
    expect(ch.key).toBe('charge_katana');
    expect(ch.weapon!.frame).toMatch(/^charge_katana_0[01]$/);
  });
  it('ability poses: cast_slam / cast_up by cast phase; Blade Dash uses the dash pose', () => {
    expect(pick({ cast: { id: 'shockwave', phase: 'startup', t: 0, len: 24 } })).toMatchObject({ key: 'cast_slam', frame: 0 });
    expect(pick({ cast: { id: 'thunder_strike', phase: 'recovery', t: 3, len: 24 } })).toMatchObject({ key: 'cast_up', frame: 2 });
    expect(pick({ cast: { id: 'blink', phase: 'startup', t: 0, len: 1 } }).key).toBe('idle');   // no pose: movement as usual
    expect(pick({ state: 'forced', stateTicks: 1, forcedOwner: 'ability:blade_dash' }).key).toBe('dash');
  });
  it('dives draw the weapon dive layer', () => {
    const p = pick({ state: 'diveFall', stateTicks: 1 });
    expect(p.key).toBe('dive_fall');
    expect(p.weapon!.frame).toBe('dive_greatsword_fall_00');
  });
});

describe('enemy anim choice (08 §7)', () => {
  const e: EnemyAnimState = { dead: false, vx: 0, vy: 0, knockback: false, control: null, attack: null, boss: null };
  it('attack phases, walk, idle, stagger', () => {
    expect(pickEnemyAnim(e, wolf, 0, 0).key).toBe('idle');
    expect(pickEnemyAnim({ ...e, vx: 50 }, wolf, 0, 2.5).frame).toBe(2);
    expect(pickEnemyAnim({ ...e, control: { type: 'stagger' } }, wolf, 0, 0).key).toBe('stagger');
    expect(pickEnemyAnim({ ...e, attack: { id: 'snap', phase: 'tele', t: 0, len: 40 } }, wolf, 0, 0).key).toBe('atk_snap');
  });
});

describe('Training Yard targets (ART5)', () => {
  const base = { dead: false, deathElapsed: 0, sinceHit: 999, attack: null };
  it('sparring dummy: idle, telegraph, swing by Act progress, hit', () => {
    expect(yardDummyFrame('sparring_dummy', base)).toBe('sparring_dummy_idle_00');
    expect(yardDummyFrame('sparring_dummy', { ...base, attack: { phase: 'tele', t: 0, len: 72 } })).toBe('sparring_dummy_tele_00');
    expect(yardDummyFrame('sparring_dummy', { ...base, attack: { phase: 'act', t: 11, len: 12 } })).toBe('sparring_dummy_atk_practice_swing_02');
    expect(yardDummyFrame('sparring_dummy', { ...base, sinceHit: 0 })).toBe('sparring_dummy_hit_00');
  });
  it('straw target: idle, then its 4-frame break', () => {
    expect(yardDummyFrame('straw_target', base)).toBe('straw_target_idle_00');
    expect(yardDummyFrame('straw_target', { ...base, dead: true, deathElapsed: 0 })).toBe('straw_target_death_00');
    expect(yardDummyFrame('straw_target', { ...base, dead: true, deathElapsed: 999 })).toBe('straw_target_death_03');
  });
});
