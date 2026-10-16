import { describe, it, expect } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { gridFromRects } from '../level/build.ts';
import { stepEnemyBody, separateEnemies } from './body.ts';
import { applyEnemyKnockback } from '../combat/enemyReactions.ts';
import type { EnemySpawn } from './types.ts';

/** Upper floor x 0–19 tiles (feet y 240), lower floor everywhere (feet y 320), a wall at tile 59. */
function ledgeWorld(enemies: EnemySpawn[], player = { x: 100, y: 240 }): GameWorld {
  const grid = gridFromRects(60, 23, [
    { x0: 0, y0: 15, x1: 19, y1: 15, kind: 'solid' },
    { x0: 0, y0: 20, x1: 59, y1: 22, kind: 'solid' },
    { x0: 59, y0: 0, x1: 59, y1: 22, kind: 'solid' },
    { x0: 30, y0: 17, x1: 40, y1: 17, kind: 'oneway' },
  ]);
  const w = new GameWorld({ grid, spawn: player, enemies });
  for (const e of w.enemies) e.dormant = false;
  return w;
}

function walk(w: GameWorld, idx: number, vx: number, n: number): void {
  for (let i = 0; i < n; i++) { w.enemies[idx].vx = vx; stepEnemyBody(w, w.enemies[idx]); }
}

describe('enemy body (04 §2.1)', () => {
  it('a Bandit walking at 50 px/s toward a ledge stops at the edge', () => {
    const w = ledgeWorld([{ enemy: 'bandit', x: 280, y: 240, facing: 1 }]);
    walk(w, 0, 50, 240);
    const e = w.enemies[0];
    expect(e.y).toBe(240);
    expect(e.x + 7).toBeLessThanOrEqual(321);            // front edge at most 1 px past the ledge (x 320)
    expect(e.x).toBeGreaterThan(300);
  });
  it('a Wolf walks off a ledge when the player is lower, and stops when the player is level', () => {
    const lower = ledgeWorld([{ enemy: 'wolf', x: 280, y: 240, facing: 1 }], { x: 500, y: 320 });
    walk(lower, 0, 150, 120);
    expect(lower.enemies[0].y).toBe(320);
    const level = ledgeWorld([{ enemy: 'wolf', x: 280, y: 240, facing: 1 }], { x: 100, y: 240 });
    walk(level, 0, 150, 120);
    expect(level.enemies[0].y).toBe(240);
  });
  it('knockback slides and stops (control back below 20 px/s, grounded), and can push off a ledge', () => {
    const w = ledgeWorld([{ enemy: 'bandit', x: 200, y: 320, facing: 1 }, { enemy: 'bandit', x: 300, y: 240, facing: 1 }]);
    const a = w.enemies[0], b = w.enemies[1];
    applyEnemyKnockback(a, [120, -40], 1);
    let n = 0;
    while (a.knockback && n++ < 300) stepEnemyBody(w, a);
    expect(a.knockback).toBe(false);
    expect(a.vx).toBe(0);
    expect(a.x).toBeGreaterThan(202);                     // 108 px/s decaying at 1600 px/s² slides a few px
    applyEnemyKnockback(b, [300, -100], 1);
    for (let i = 0; i < 200; i++) stepEnemyBody(w, b);
    expect(b.y).toBe(320);
  });
  it('a wall stops knockback (vx 0)', () => {
    const w = ledgeWorld([{ enemy: 'bandit', x: 930, y: 320, facing: 1 }]);
    const e = w.enemies[0];
    applyEnemyKnockback(e, [400, 0], 1);
    for (let i = 0; i < 20; i++) stepEnemyBody(w, e);
    expect(e.x + 7).toBe(944);
    expect(e.vx).toBe(0);
  });
  it('two Bandits on the same x separate to more than 10 px', () => {
    const w = ledgeWorld([{ enemy: 'bandit', x: 400, y: 320, facing: 1 }, { enemy: 'bandit', x: 400, y: 320, facing: 1 }]);
    for (let i = 0; i < 120; i++) { for (const e of w.enemies) stepEnemyBody(w, e); separateEnemies(w); }
    const [a, b] = w.enemies;
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(10);
    expect(a.x).toBeLessThan(b.x);                        // lower id moves left on a tie
  });
  it('never drops through a one-way platform and lands on it from above', () => {
    const w = ledgeWorld([{ enemy: 'bandit', x: 560, y: 200, facing: 1 }]);
    const e = w.enemies[0];
    for (let i = 0; i < 120; i++) stepEnemyBody(w, e);
    expect(e.y).toBe(272);
    expect(e.grounded).toBe(true);
  });
});
