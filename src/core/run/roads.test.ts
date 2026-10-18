import { describe, expect, it } from 'vitest';
import json from '../../../public/levels/village_crossroads.json';
import { GameWorld } from '../sim/gameWorld.ts';
import { loadLevel } from '../level/loadLevel.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { cancelRoad, chooseRoad, openInn } from './roads.ts';
import { pauseRun } from './phases.ts';
describe('Crossroads inn and authorized temporary ending (06 §3, §12.2)', () => {
  const world = () => GameWorld.fromLevel(loadLevel(json), { seedText: 'INN' });
  it('route choice freezes the world but counts time; cancel preserves road', () => {
    const w = world(); openInn(w); const x = w.body.x;
    stepSpec(w, { moveX: 1 }, 40);
    expect(w.run.phase).toBe('routeChoice'); expect(w.run.runTicks).toBe(40); expect(w.body.x).toBe(x);
    expect(cancelRoad(w)).toBe(true); expect(w.run.phase).toBe('village'); expect(w.run.road).toBeNull();
  });
  it.each(['mountain', 'forest'] as const)('%s uses the road key; sleep counts exactly120 ticks, heals at60, and does not reach Stage2', (road) => {
    const w = world(); w.health.hp = 17; w.flask.charges = 0; w.flask.fillTenths = 321; w.run.splits[0] = 100;
    openInn(w); expect(chooseRoad(w, road)).toBe(true);
    expect(w.run.road).toBe(road); expect(chooseRoad(w, road)).toBe(false);
    stepSpec(w, {}, 59); expect(w.health.hp).toBe(17);
    stepSpec(w, {}); expect(w.health.hp).toBe(w.health.maxHp);
    expect(w.run.phase).toBe('loading'); w.completeLoading(); stepSpec(w, {}, 60);
    expect(w.run.phase).toBe('runSoFar'); expect(w.run.runTicks).toBe(120);
    expect(w.run.levelId).toBe('crossroads'); expect(w.run.stage).toBe(0); expect(w.run.splits).toEqual([100, null, null, null]);
    expect(w.flask).toMatchObject({ charges: 0, fillTenths: 321 });
    const state = structuredClone(w.run); stepSpec(w, { restart: true, moveX: 1 }, 200); expect(w.run).toEqual(state);
    pauseRun(w.run); expect(w.run.phase).toBe('runSoFar');
  });
  it('run kill counters survive a village boundary for the run-so-far screen', () => {
    const w = world(), enemy = w.spawnExtra({ enemy: 'bandit', x: 64, y: 320, facing: 1 }); w.onPlayerKill(enemy, 'regular'); w.onPlayerKill(enemy, 'elite');
    expect(w.run.stats).toMatchObject({ kills: 2, eliteKills: 1 });
  });
});
