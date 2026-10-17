import { describe, it, expect } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { hurtPlayer } from '../combat/health.ts';
import { specToInput, type InputSpec } from './playerSim.ts';
import type { InputState } from '../input.ts';
import type { GameWorld } from './gameWorld.ts';

const kill = (w: GameWorld) => {
  w.health.hp = 1;
  hurtPlayer(w, { kind: 'enemyHit', enemyId: 1, enemyDefId: 'bandit', damageA: 10, attackerCx: 300, melee: true });
};

describe('death and restart (06 §6, checklist 39)', () => {
  it('dying stops the run timer; the world runs 120 ticks, then the death screen freezes it', () => {
    const w = arenaWorld();
    stepSpec(w, {}, 10);
    kill(w);
    const t = w.runTicks;
    stepSpec(w, { moveX: 1 }, 119);
    expect(w.runTicks).toBe(t);
    expect(w.phase).toBe('dead');
    stepSpec(w, {});
    expect(w.phase).toBe('deathScreen');
    const tick = w.tick;
    stepSpec(w, {}, 10);
    expect(w.body.y).toBe(320);
    expect(w.tick).toBe(tick);
  });
  it('a restart press 20 ticks after death is ignored; 31 ticks after it restarts', () => {
    const w = arenaWorld();
    kill(w);
    stepSpec(w, {}, 19);
    stepSpec(w, { restart: true });
    expect(w.health.dead).toBe(true);
    stepSpec(w, {}, 10);
    stepSpec(w, { restart: true });
    expect(w.health.dead).toBe(false);
    expect(w.phase).toBe('stage');
  });
  it('holding R for 59 ticks does nothing, 60 restarts, and holding on does not restart twice', () => {
    const w = arenaWorld();
    stepSpec(w, { moveX: 1 }, 30);
    let restarts = 0;
    const onRestart = w.restart.bind(w);
    w.restart = () => { restarts++; onRestart(); };
    stepSpec(w, { restart: true }, 59);
    expect(restarts).toBe(0);
    stepSpec(w, { restart: true });
    expect(restarts).toBe(1);
    stepSpec(w, { restart: true }, 200);
    expect(restarts).toBe(1);
    stepSpec(w, {});
    stepSpec(w, { restart: true }, 60);
    expect(restarts).toBe(2);
  });
  it('a restart mid-fight leaves no hit groups or projectiles and resets HP, Rush, flask and gold', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'bandit', x: 230, y: 320, facing: -1 }, { enemy: 'bandit_archer', x: 500, y: 320, facing: -1 }] });
    w.health.hp = 40; w.rush.value = 250; w.flask.charges = 0; w.flask.fillTenths = 300; w.econ.goldTenths = 330;
    stepSpec(w, { attack1: true }, 30);
    w.restart();
    expect(w.hitGroups).toEqual([]);
    expect(w.projectiles).toEqual([]);
    expect(w.health.hp).toBe(100);
    expect(w.rush.value).toBe(0);
    expect(w.flask).toEqual({ charges: 2, maxCharges: 2, fillTenths: 0 });
    expect(w.gold).toBe(0);
    expect(w.body.hitStopTicks).toBe(0);
    expect(w.health.iframeTicks).toBe(0);
    expect(w.enemies.every((e) => !e.dead && e.hp === e.maxHp)).toBe(true);
  });
  it('the same 3,000-tick recording after a restart gives identical enemies every tick (determinism)', () => {
    let seed = 99;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    const rec: InputState[] = [];
    let prev: InputSpec = {}, spec: InputSpec = {};
    for (let t = 0; t < 3000; t++) {
      if (t % 6 === 0) spec = { moveX: rand() < 0.6 ? 1 : rand() < 0.5 ? -1 : 0, jump: rand() < 0.2, dash: rand() < 0.1, attack1: rand() < 0.3, attack2: rand() < 0.1 };
      rec.push(specToInput(prev, spec)); prev = spec;
    }
    const w = arenaWorld({ seed: 3, enemies: [
      { enemy: 'wolf', x: 400, y: 320, facing: -1, group: 'p' }, { enemy: 'wolf', x: 430, y: 320, facing: -1, group: 'p' },
      { enemy: 'bandit', x: 600, y: 320, facing: -1 }, { enemy: 'bandit_brute', x: 800, y: 320, facing: -1 } ] });
    const snap = () => JSON.stringify(w.enemies.map((e) => [e.x, e.y, e.hp, e.ai.state]));
    const first: string[] = [];
    for (const input of rec) { w.step(input); first.push(snap()); }
    w.restart();
    for (let i = 0; i < rec.length; i++) {
      w.step(rec[i]);
      const s = snap();
      if (s !== first[i]) expect(s).toBe(first[i]);
    }
  });
});
