import { describe, expect, it } from 'vitest';
import json from '../../../public/levels/village_crossroads.json';
import { GameWorld } from '../sim/gameWorld.ts';
import { loadLevel } from '../level/loadLevel.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { cancelRoad, chooseRoad, openInn } from './roads.ts';
describe('Crossroads and Border inns (06 §3, §12.2)', () => {
  const world = () => GameWorld.fromLevel(loadLevel(json), { seedText: 'INN' });
  it('route choice freezes the world but counts time; cancel preserves road', () => {
    const w = world(); openInn(w); const x = w.body.x;
    stepSpec(w, { moveX: 1 }, 40);
    expect(w.run.phase).toBe('routeChoice'); expect(w.run.runTicks).toBe(40); expect(w.body.x).toBe(x);
    expect(cancelRoad(w)).toBe(true); expect(w.run.phase).toBe('village'); expect(w.run.road).toBeNull();
  });
  it.each(['mountain', 'forest'] as const)('%s requests the real road after60 timed fade ticks and heals without refilling flask', (road) => {
    const w = world(); w.health.hp = 17; w.flask.charges = 0; w.flask.fillTenths = 321; w.run.splits[0] = 100;
    openInn(w); expect(chooseRoad(w, road)).toBe(true);
    expect(w.run.road).toBe(road); expect(chooseRoad(w, road)).toBe(false);
    stepSpec(w, {}, 59); expect(w.health.hp).toBe(17);
    const events=stepSpec(w, {}); expect(w.health.hp).toBe(w.health.maxHp);
    expect(events).toContainEqual({t:'loadLevel',levelId:road==='mountain'?'mountains':'swamps',stage:2});
    expect(w.run.phase).toBe('loading');expect(w.run.runTicks).toBe(60);
    expect(w.run.splits).toEqual([100, null, null, null]);
    expect(w.flask).toMatchObject({ charges: 0, fillTenths: 321 });
    const x=w.body.x;stepSpec(w,{moveX:1},200);expect(w.body.x).toBe(x);expect(w.run.runTicks).toBe(60);
  });
  it('Border sleeps directly into the authorized ending without reaching an unbuilt Stage3',()=>{
    const data=loadLevel(json);data.id='border';const w=GameWorld.fromLevel(data,{seedText:'BORDER'});
    w.run.splits=[100,300,null,null];w.run.road='forest';w.health.hp=10;
    expect(openInn(w)).toBe(true);expect(w.run.phase).toBe('transition');expect(chooseRoad(w,'mountain')).toBe(false);
    stepSpec(w,{},60);expect(w.health.hp).toBe(100);expect(w.run.transition?.target.phase).toBe('runSoFar');
    w.completeLoading();stepSpec(w,{},60);expect(w.run.phase).toBe('runSoFar');expect(w.run.levelId).toBe('border');expect(w.run.stage).toBe(0);
    expect(w.run.splits).toEqual([100,300,null,null]);expect(w.records.pbs).toEqual({});
  });
  it('run kill counters survive a village boundary for the run-so-far screen', () => {
    const w = world(), enemy = w.spawnExtra({ enemy: 'bandit', x: 64, y: 320, facing: 1 }); w.onPlayerKill(enemy, 'regular'); w.onPlayerKill(enemy, 'elite');
    expect(w.run.stats).toMatchObject({ kills: 2, eliteKills: 1 });
  });
});
