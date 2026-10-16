import { describe, it, expect } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { bossLevel } from '../testkit/levelData.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { killEnemy, processDeaths } from '../combat/resolve.ts';
import { hurtPlayer } from '../combat/health.ts';
import { specToInput, type InputSpec } from '../sim/playerSim.ts';
import type { InputState } from '../input.ts';

const world = (seed = 'A') => GameWorld.fromLevel(bossLevel(), { seedText: seed });
const boss = (w: GameWorld) => w.enemies.find((e) => e.def.id === 'great_boar')!;
const walkIn = (w: GameWorld) => { for (let i = 0; i < 600 && !w.run.arenas.boss1?.locked; i++) stepSpec(w, { moveX: 1 }); };
const lethal = (w: GameWorld) => { w.health.hp = 1; hurtPlayer(w, { kind: 'enemyHit', enemyId: 1, enemyDefId: 'great_boar', damageA: 20, attackerCx: 999, melee: true }); };

describe('run logic (06 §2.5, §5, §6; tests 7, 9, 30, 32)', () => {
  it('split 1 equals runTicks on the boss-death tick', () => {
    const w = world();
    walkIn(w);
    stepSpec(w, {}, 200);
    killEnemy(w, boss(w));
    const ev = stepSpec(w, {});
    expect(w.run.splits[0]).toBe(w.run.runTicks);
    expect(ev).toContainEqual({ t: 'split', index: 1, runTicks: w.run.runTicks, segmentTicks: w.run.runTicks, deltaTicks: null, bestSegment: false });
  });
  it('runTicks advances during hit-stop and stops on the death tick', () => {
    const w = world();
    stepSpec(w, {}, 10);
    w.body.hitStopTicks = 20;
    stepSpec(w, {}, 5);
    expect(w.run.runTicks).toBe(15);
    lethal(w);
    expect(w.run.phase).toBe('dead');
    stepSpec(w, {}, 50);
    expect(w.run.runTicks).toBe(15);
    expect(w.run.deathTick).toBe(15);
  });
  it('the boss and the player dying on the same tick: the split is recorded, then the phase is dead', () => {
    const w = world();
    walkIn(w);
    stepSpec(w, {}, 200);
    const b = boss(w);
    killEnemy(w, b);             // the boss reaches 0 HP (7a)...
    lethal(w);                   // ...the player too (7b), on the same tick...
    processDeaths(w);            // ...then step 9 runs the boss death
    expect(w.run.splits[0]).not.toBeNull();
    expect(w.run.phase).toBe('dead');
  });
  it('a boss dying after the player’s death tick records no split', () => {
    const w = world();
    walkIn(w);
    stepSpec(w, {}, 200);
    lethal(w);
    stepSpec(w, {}, 60);
    killEnemy(w, boss(w));
    stepSpec(w, {});
    expect(w.run.splits[0]).toBeNull();
  });
  it('the exit after the split clears the stage: the world freezes and a fresh R press restarts', () => {
    const w = world();
    walkIn(w);
    killEnemy(w, boss(w));
    stepSpec(w, {});
    w.run.phase = 'stageClear';
    const t = w.run.runTicks, tick = w.tick, x = w.body.x;
    stepSpec(w, { moveX: 1 }, 60);
    expect([w.run.runTicks, w.tick, w.body.x]).toEqual([t, tick, x]);
    stepSpec(w, { restart: true });
    expect(w.run.phase).toBe('stage');
    expect(w.run.runTicks).toBe(0);
    expect(w.run.splits[0]).toBeNull();
  });
  it('the same seed and a recorded 20 000-tick input give an identical RunState (test 30)', () => {
    let seed = 7;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    const rec: InputState[] = [];
    let prev: InputSpec = {}, spec: InputSpec = {};
    for (let t = 0; t < 20000; t++) {
      if (t % 8 === 0) spec = { moveX: rand() < 0.7 ? 1 : rand() < 0.5 ? -1 : 0, jump: rand() < 0.2, dash: rand() < 0.1, attack1: rand() < 0.4, attack2: rand() < 0.1 };
      rec.push(specToInput(prev, spec)); prev = spec;
    }
    const run = () => { const w = world('SEED1'); for (const i of rec) w.step(i); return JSON.stringify([w.run, w.enemies.map((e) => [e.x, e.y, e.hp]), w.health.hp]); };
    expect(run()).toBe(run());
  });
});
