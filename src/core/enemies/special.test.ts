import { describe, it, expect } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { gridFromRects, type Rect as TileRect } from '../level/build.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { startEnemyAttack } from './attack.ts';
import type { EnemySpawn } from './types.ts';

function world(enemies: EnemySpawn[], player: { x: number; y: number }, extra: TileRect[] = []): GameWorld {
  const grid = gridFromRects(60, 23, [{ x0: 0, y0: 20, x1: 59, y1: 22, kind: 'solid' }, ...extra]);
  const w = new GameWorld({ grid, spawn: player, enemies });
  for (const e of w.enemies) { e.dormant = false; e.aware = true; e.ai.state = 'engage'; }
  return w;
}

describe('Stage 1 specials (04 §3)', () => {
  it('a Boar Charge into a wall leaves it dazed for 144 ticks and shakes the camera', () => {
    const w = world([{ enemy: 'wild_boar', x: 600, y: 320, facing: -1 }], { x: 400, y: 320 }, [{ x0: 30, y0: 17, x1: 30, y1: 19, kind: 'solid' }]);
    const boar = w.enemies[0];
    startEnemyAttack(w, boar, boar.def.attacks.find((a) => a.id === 'charge')!);
    let shook = false;
    for (let i = 0; i < 200 && !boar.control; i++) shook ||= stepSpec(w, {}).some((e) => e.t === 'shake');
    expect(boar.control).toEqual({ type: 'dazed', ticks: 144 });
    expect(boar.ai.attack).toBeNull();
    expect(boar.x - 15).toBe(496);
    expect(shook).toBe(true);
  });
  it('0.90 s of charging on open ground goes to its 72-tick Rec; it hits the player at most once', () => {
    const w = world([{ enemy: 'wild_boar', x: 600, y: 320, facing: -1 }], { x: 420, y: 320 });
    const boar = w.enemies[0];
    w.health.iframeTicks = 0;
    startEnemyAttack(w, boar, boar.def.attacks.find((a) => a.id === 'charge')!);
    stepSpec(w, {}, 72);
    expect(boar.ai.attack?.phase).toBe('act');
    let hits = 0;
    for (let i = 0; i < 130 && boar.ai.attack?.phase === 'act'; i++)   // + 9 ticks of attacker hit-stop on the hit
      hits += stepSpec(w, {}).filter((e) => e.t === 'hit' && e.target === 'player').length;
    expect(boar.ai.attack?.phase).toBe('rec');
    expect(boar.ai.attack?.len).toBe(72);
    expect(hits).toBe(1);
  });
  it('a Wolf leap lands, and its box ends on landing', () => {
    const w = world([{ enemy: 'wolf', x: 500, y: 320, facing: -1 }], { x: 100, y: 320 });
    const wolf = w.enemies[0];
    startEnemyAttack(w, wolf, wolf.def.attacks.find((a) => a.id === 'lunge_bite')!);
    stepSpec(w, {}, 48);
    expect(wolf.ai.attack?.phase).toBe('act');
    expect(wolf.y).toBeLessThan(320);
    expect(w.hitGroups.some((g) => g.owner === wolf.id)).toBe(true);
    for (let i = 0; i < 120 && wolf.ai.attack?.phase === 'act'; i++) stepSpec(w, {});
    expect(wolf.ai.attack?.phase).toBe('rec');
    expect(wolf.y).toBe(320);
    expect(wolf.vx).toBe(0);
    expect(w.hitGroups.some((g) => g.owner === wolf.id)).toBe(false);
  });
  it('after an attack a Wolf backs off to its 72–112 band', () => {
    const w = world([{ enemy: 'wolf', x: 230, y: 320, facing: -1 }], { x: 200, y: 320 });
    w.health.iframeTicks = 100000;
    const wolf = w.enemies[0];
    startEnemyAttack(w, wolf, wolf.def.attacks.find((a) => a.id === 'snap')!);
    for (let i = 0; i < 400 && wolf.ai.attack; i++) stepSpec(w, {});
    for (let i = 0; i < 60; i++) { stepSpec(w, {}); wolf.ai.gapTicks = 999; }
    const d = Math.abs(wolf.x - w.body.x);
    expect(d).toBeGreaterThanOrEqual(72);
    expect(d).toBeLessThanOrEqual(112);
  });
  it('a Bandit Lunge Stab moves 64 px over 0.2 s in its facing', () => {
    const w = world([{ enemy: 'bandit', x: 500, y: 320, facing: -1 }], { x: 100, y: 320 });
    const b = w.enemies[0];
    startEnemyAttack(w, b, b.def.attacks.find((a) => a.id === 'lunge_stab')!);
    stepSpec(w, {}, 59);                                   // Tele is 60 ticks; Act moves on the next 24
    const x0 = b.x;
    stepSpec(w, {}, 24);
    expect(x0 - b.x).toBeGreaterThanOrEqual(63);
    expect(x0 - b.x).toBeLessThanOrEqual(65);
    stepSpec(w, {}, 2);
    expect(b.vx).toBe(0);
  });
});
