import { describe, it, expect } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { gridFromRects, type Rect as TileRect } from '../level/build.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { spawnEnemyProjectile } from './projectiles.ts';
import { ENEMY_PROJECTILES } from '../../data/enemyProjectiles.ts';
import type { EnemySpawn } from './types.ts';

function world(enemies: EnemySpawn[], player: { x: number; y: number }, extra: TileRect[] = []): GameWorld {
  const grid = gridFromRects(60, 23, [{ x0: 0, y0: 20, x1: 59, y1: 22, kind: 'solid' }, ...extra]);
  const w = new GameWorld({ grid, spawn: player, enemies });
  for (const e of w.enemies) { e.dormant = false; e.aware = true; e.ai.state = 'engage'; }
  return w;
}

describe('enemy projectiles (04 §2.7, §8)', () => {
  it('an Archer arrow at a player 200 px away and ~30 px higher flies aimed, hits once for 9', () => {
    // the player stands on a 2-tile block (feet y 288)
    const w = world([{ enemy: 'bandit_archer', x: 600, y: 320, facing: -1 }], { x: 400, y: 288 }, [{ x0: 23, y0: 18, x1: 27, y1: 19, kind: 'solid' }]);
    const archer = w.enemies[0];
    archer.ai.gapTicks = 0;
    let fired = false;
    const hits: number[] = [];
    for (let i = 0; i < 240; i++) {
      stepSpec(w, {});
      if (w.projectiles.length) {
        if (!fired) { fired = true; expect(w.projectiles[0].vy).toBeLessThan(0); expect(Math.hypot(w.projectiles[0].vx, w.projectiles[0].vy)).toBeCloseTo(300, 6); }
      }
      if (w.health.hp < 100 && hits.length === 0) hits.push(i);
    }
    expect(fired).toBe(true);
    expect(w.health.hp).toBe(91);
  });
  it('aimed shots clamp to ±30° from horizontal', () => {
    const w = world([{ enemy: 'bandit_archer', x: 600, y: 320, facing: -1 }], { x: 560, y: 120 });
    const p = spawnEnemyProjectile(w, w.enemies[0], ENEMY_PROJECTILES.enemy_arrow!, 'player', 0);
    expect(Math.atan2(-p.vy, -p.vx) * 180 / Math.PI).toBeCloseTo(30, 6);
  });
  it('a straight shot is stopped by a solid tile, passes one-way platforms, and keeps flying after its shooter dies', () => {
    const w = world([{ enemy: 'bandit_archer', x: 600, y: 320, facing: -1 }], { x: 300, y: 320 }, [{ x0: 28, y0: 17, x1: 28, y1: 19, kind: 'solid' }, { x0: 33, y0: 18, x1: 34, y1: 18, kind: 'oneway' }]);
    const p = spawnEnemyProjectile(w, w.enemies[0], ENEMY_PROJECTILES.enemy_arrow!, 'facing', 0);
    w.enemies[0].dead = true;
    let maxGone = 0;
    for (let i = 0; i < 200 && w.projectiles.includes(p); i++) { stepSpec(w, {}); maxGone = Math.max(maxGone, 600 - p.x); }
    expect(w.projectiles.includes(p)).toBe(false);
    expect(p.x).toBeGreaterThan(448);
    expect(w.health.hp).toBe(100);
  });
  it('a brute_wave travels 160 px along the floor, then vanishes', () => {
    const w = world([{ enemy: 'bandit_brute', x: 800, y: 320, facing: -1 }], { x: 100, y: 320 });
    const p = spawnEnemyProjectile(w, w.enemies[0], ENEMY_PROJECTILES.brute_wave!, 'facing', 0, { x: 776, y: 320 });
    let last = p.x;
    for (let i = 0; i < 200 && w.projectiles.includes(p); i++) { stepSpec(w, {}); if (w.projectiles.includes(p)) last = p.x; }
    expect(776 - last).toBeGreaterThanOrEqual(156);
    expect(776 - last).toBeLessThanOrEqual(160);
  });
  it('a brute_wave stops at a ledge edge', () => {
    const w = world([{ enemy: 'bandit_brute', x: 800, y: 320, facing: -1 }], { x: 100, y: 320 }, [{ x0: 40, y0: 20, x1: 45, y1: 22, kind: 'empty' }]);
    const p = spawnEnemyProjectile(w, w.enemies[0], ENEMY_PROJECTILES.brute_wave!, 'facing', 0, { x: 776, y: 320 });
    for (let i = 0; i < 200 && w.projectiles.includes(p); i++) stepSpec(w, {});
    expect(p.x - 8).toBeGreaterThanOrEqual(735);
  });
  it('a brute_wave is jumpable: a player who jumps over it takes nothing; one who stands is hit for 14', () => {
    for (const jump of [true, false]) {
      const w = world([{ enemy: 'bandit_brute', x: 800, y: 320, facing: -1 }], { x: 600, y: 320 });
      w.enemies[0].ai.state = 'idle'; w.enemies[0].aware = false;
      const p = spawnEnemyProjectile(w, w.enemies[0], ENEMY_PROJECTILES.brute_wave!, 'facing', 0, { x: 700, y: 320 });
      for (let i = 0; i < 120; i++) {
        const near = Math.abs(p.x - w.body.x) < 40;
        stepSpec(w, { jump: jump && near });
      }
      expect(w.health.hp).toBe(jump ? 100 : 86);
    }
  });
});
