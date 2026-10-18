import { describe, expect, it } from 'vitest';
import { SPIDERLING } from '../../data/spiderlings.ts';
import { killEnemy, processDeaths } from '../combat/resolve.ts';
import { gridFromRects } from '../level/build.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { livingSpiderlings, spawnBrood } from './spiderlings.ts';

function world() {
  const grid = gridFromRects(200, 24, [{ x0: 0, y0: 20, x1: 199, y1: 23, kind: 'solid' }]);
  return new GameWorld({ grid, spawn: { x: 2800, y: 320 }, stage: 2, enemies: [{ enemy: 'bandit_archer', x: 500, y: 320, facing: 1 }] });
}

describe('Spider Queen brood (04 §2.2, §9.5, §10.3)', () => {
  it('has the exact Spiderling body, health, chase speed and Bite data', () => {
    expect(SPIDERLING).toMatchObject({ id: 'spiderling', tier: 'summon', size: 'small', hurtbox: { w: 12, h: 8 }, hp: 12,
      poiseMax: 0, kbResist: 0, chase: 120, preferred: [0, 16], gold: 0, itemRoll: 'none', blueprintRoll: false,
      attacks: [{ id: 'bite', use: { minX: 0, maxX: 20 }, telegraph: 0.35, active: 0.10, recovery: 0.35, cooldown: 1.2,
        token: 'melee', hit: { box: { dx: 10, dy: -5, w: 14, h: 10 }, damage: 8 } }] });
  });

  it('spawns two at ±32 with Stage2 HP, owner links and all sixty spawn-in ticks intact', () => {
    const w = world(), queen = w.enemies[0]; const brood = spawnBrood(w, queen); queen.dead = true;
    expect(brood.map((e) => e.x)).toEqual([468, 532]);
    for (const e of brood) expect(e).toMatchObject({ hp: 17, maxHp: 17, y: 320, aware: true, dormant: false, noRewards: true, spawnInTicks: 60, summonOwner: queen.id, ai: { state: 'engage' } });
    stepSpec(w, {}, 59); expect(brood.map((e) => e.spawnInTicks)).toEqual([1, 1]);
    stepSpec(w, {}); expect(brood.map((e) => e.spawnInTicks)).toEqual([0, 0]); expect(brood.map((e) => e.x)).toEqual([468, 532]);
    stepSpec(w, {}); expect(brood.every((e) => e.x > e.spawn.x)).toBe(true);
  });

  it('caps living brood at four, counts spawn-in, and replaces only the dead slots', () => {
    const w = world(), queen = w.enemies[0]; const first = spawnBrood(w, queen); spawnBrood(w, queen);
    expect(livingSpiderlings(w, queen)).toHaveLength(4); expect(spawnBrood(w, queen)).toHaveLength(0);
    first[0].dead = true; expect(spawnBrood(w, queen)).toHaveLength(1); expect(livingSpiderlings(w, queen)).toHaveLength(4);
    queen.dead = true; expect(spawnBrood(w, queen)).toHaveLength(0);
  });

  it('counts only Spiderlings belonging to this Queen', () => {
    const w = world(), queen = w.enemies[0]; const other = w.spawnExtra({ enemy: 'bandit_archer', x: 900, y: 320, facing: -1 });
    spawnBrood(w, queen); spawnBrood(w, other);
    expect(livingSpiderlings(w, queen)).toHaveLength(2); expect(livingSpiderlings(w, other)).toHaveLength(2);
  });

  it('stays aware and chasing rather than returning home after a distant player', () => {
    const w = world(), queen = w.enemies[0]; const brood = spawnBrood(w, queen); queen.dead = true;
    stepSpec(w, {}, 700); expect(brood.every((e) => e.aware && e.ai.state === 'engage')).toBe(true);
  });

  it('gives no gold, flask fill, Rush, counters, curse progress, drops, or kill events', () => {
    const w = world(), queen = w.enemies[0]; const brood = spawnBrood(w, queen);
    w.econ.curse = { id: 'one_hit', killsLeft: 10 };
    const before = structuredClone({ economy: w.econ, flask: w.flask, rush: w.rush, stats: w.run.stats });
    for (const e of brood) killEnemy(w, e); processDeaths(w);
    expect({ economy: w.econ, flask: w.flask, rush: w.rush, stats: w.run.stats }).toEqual(before);
    expect(w.groundItems).toHaveLength(0); expect(w.run.blueprintsDropped).toHaveLength(0); expect(w.events.some((e) => e.t === 'kill')).toBe(false);
  });
});
