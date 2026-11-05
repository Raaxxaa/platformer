import { describe, expect, it } from 'vitest';
import { defaultAssist, type AssistSettings } from '../../data/assist.ts';
import { FLASK } from '../tuning.ts';
import { gridFromRects } from '../level/build.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { hurtPlayer } from '../combat/health.ts';
import { flaskCap } from '../economy/shop.ts';
import { createRunState, isAssisted } from './runState.ts';
import { recordSplit, savePersonalBest } from './splits.ts';
import { buildTimedDoors } from './timedDoors.ts';

const world = (a: Partial<AssistSettings> = {}) => {
  const settings = { ...defaultAssist(), ...a };
  const grid = gridFromRects(60, 23, [{ x0: 0, y0: 20, x1: 59, y1: 22, kind: 'solid' }]);
  return { w: new GameWorld({ grid, spawn: { x: 200, y: 320 }, assist: () => settings }), settings };
};
const bandit = (w: GameWorld, damageA: number) => hurtPlayer(w, { kind: 'enemyHit', enemyId: 1, enemyDefId: 'bandit', damageA, attackerCx: 260, melee: true });

describe('assist mode in the core (06 §5.4)', () => {
  it('copies the options into RunState at run start; default runs are not assisted', () => {
    expect(world().w.run.assist).toEqual({ damageTaken: 1, extraFlask: false, longerDoors: false, slowedEver: false });
    expect(isAssisted(world().w.run)).toBe(false);
    const { w } = world({ damageTaken: 0.5, extraFlask: true }); expect(w.run.assist).toMatchObject({ damageTaken: 0.5, extraFlask: true });
    expect(isAssisted(w.run)).toBe(true);
  });
  it('Damage taken 50% halves a 12-damage hit to 6; a 1-damage hit stays 1', () => {
    const { w } = world({ damageTaken: 0.5 }); const hp = w.health.hp;
    bandit(w, 12); expect(hp - w.health.hp).toBe(6);
    w.health.iframeTicks = 0; w.health.hitstunTicks = 0; const hp2 = w.health.hp;
    bandit(w, 1); expect(hp2 - w.health.hp).toBe(1);
  });
  it('the one-hit curse still kills', () => {
    const { w } = world({ damageTaken: 0.5 }); w.econ.curse = { id: 'one_hit', killsLeft: 10 } as never;
    bandit(w, 12); expect(w.health.hp).toBeLessThanOrEqual(0);
  });
  it('Extra flask charge: one more charge, full, at run start; upgrades can reach 5', () => {
    const { w } = world({ extraFlask: true });
    expect(w.flask).toMatchObject({ charges: FLASK.START_CHARGES + 1, maxCharges: FLASK.START_CHARGES + 1 });
    expect(flaskCap(w)).toBe(5); expect(flaskCap(world().w)).toBe(4);
  });
  it('changing settings mid-run changes nothing until the next run', () => {
    const { w, settings } = world({ damageTaken: 1 });
    settings.damageTaken = 0.5; const hp = w.health.hp; bandit(w, 12); expect(hp - w.health.hp).toBe(12);
    w.restart(); expect(w.run.assist.damageTaken).toBe(0.5);
  });
  it('an assisted run writes no best segment and no personal best, but still compares', () => {
    const r = createRunState('ASSIST', false, { ...defaultAssist(), damageTaken: 0.75 });
    r.startKit = { cls: 'swordsman', weapon: 'greatsword' } as never; r.road = 'mountain';
    const records = { pbs: {}, bestSegments: {} };
    r.runTicks = 1200; recordSplit(r, 1, records, false); expect(records.bestSegments).toEqual({});
    r.splits = [1200, 2400, 3600, 4800]; r.phase = 'runComplete';
    expect(savePersonalBest(r, records, '2026-11-05', { displayName: 'x', weapons: [null, null], abilities: [null, null] } as never)).toBe(false);
    const plain = createRunState('ASSIST'); plain.assist.slowedEver = true; expect(isAssisted(plain)).toBe(true);
  });
  it('Longer timed doors make a 120 s door 180 s', () => {
    const door = { id: 1, type: 'timed_door', x: 0, y: 0, w: 16, h: 48, props: { id: 'd', timeLimit: 120 } };
    for (const [longerDoors, s] of [[false, 120], [true, 180]] as const) {
      const { w } = world({ longerDoors }); (w as unknown as { level: unknown }).level = { id: 'plains', objects: [door] };
      expect(buildTimedDoors(w)[0].limitTicks).toBe(s * 120);
    }
  });
});
