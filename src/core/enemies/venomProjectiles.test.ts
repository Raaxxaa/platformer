import { describe, expect, it } from 'vitest';
import { ENEMY_PROJECTILES } from '../../data/enemyProjectiles.ts';
import { gridFromRects } from '../level/build.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { spawnEnemyProjectile, spawnVenomSpit, stepProjectiles, stepPuddles } from './projectiles.ts';

function world(oneway = false) {
  const grid = gridFromRects(60, 30, [
    { x0: 0, y0: 20, x1: 59, y1: 29, kind: 'solid' },
    ...(oneway ? [{ x0: 0, y0: 16, x1: 59, y1: 16, kind: 'oneway' as const }] : []),
  ]);
  return new GameWorld({ grid, spawn: { x: 500, y: 320 }, stage: 2, enemies: [{ enemy: 'bandit_archer', x: 400, y: 320, facing: 1 }] });
}

describe('Spider Queen venom projectiles (04 §8, §10.3)', () => {
  it('uses ten-pixel globs, a 0.8-second arc, base fifteen damage, and a two-second poison puddle', () => {
    expect(ENEMY_PROJECTILES.venom_glob).toMatchObject({ w: 10, h: 10, motion: 'arc', arcTime: 0.8,
      hit: { damage: 15, status: { id: 'poisoned', stacks: 1 } }, puddle: { w: 48, h: 8, life: 2, status: 'poisoned' } });
  });

  it('fires three arcs toward the same snapshotted feet point with minus48/zero/plus48 x offsets', () => {
    const w = world(); const shots = spawnVenomSpit(w, w.enemies[0]);
    expect(shots).toHaveLength(3); expect(w.projectiles).toEqual(shots);
    expect(shots.map((p) => p.x + p.vx * 0.8)).toEqual([452, 500, 548]);
    for (const p of shots) expect(p.y + p.vy * 0.8 + 0.5 * 1000 * 0.8 ** 2).toBeCloseTo(320);
    const speeds = shots.map((p) => p.vx); w.body.x = 800; stepProjectiles(w);
    expect(shots.map((p) => p.vx)).toEqual(speeds);
  });

  it('keeps the shared 260px/s arc clamp at long range', () => {
    const w = world(); w.body.x = 900;
    expect(spawnVenomSpit(w, w.enemies[0]).every((p) => p.vx === 260)).toBe(true);
  });

  it('a player impact deals one Stage2 hit for twenty, applies Poison1, and leaves no ground puddle', () => {
    const w = world(); const p = spawnEnemyProjectile(w, w.enemies[0], ENEMY_PROJECTILES.venom_glob!, 'arc', 0, { x: 499, y: 304 });
    w.enemies[0].dead = true; p.vx = 120; p.vy = 0;
    expect(w.hitGroups.find((g) => g.id === p.groupId)?.active).toBe(false);
    const events = stepSpec(w, {}); expect(w.health.hp).toBe(80); expect(w.playerStatus.poisoned?.stacks).toBe(1);
    expect(events.filter((e) => e.t === 'hit' && e.target === 'player' && !e.dot)).toHaveLength(1);
    expect(w.projectiles).toHaveLength(0); expect(w.puddles).toHaveLength(0);
    expect(w.hitGroups.find((g) => w.blasts.includes(g.id))?.rect).toMatchObject({ w: 10, h: 10 });
  });

  it('lands on a one-way platform and makes a floor-aligned puddle immediately, without a bomb fuse', () => {
    const w = world(true); const p = spawnEnemyProjectile(w, w.enemies[0], ENEMY_PROJECTILES.venom_glob!, 'arc', 0, { x: 700, y: 249 });
    p.vx = 0; p.vy = 480; stepProjectiles(w);
    expect(w.projectiles).toHaveLength(0); expect(w.puddles[0]).toMatchObject({ x: 676, y: 248, w: 48, h: 8, left: 240, next: 60, status: 'poisoned' });
    w.body.x = 700; w.body.y = 256; w.health.iframeTicks = 999;
    for (let i = 0; i < 59; i++) stepPuddles(w); expect(w.playerStatus.poisoned).toBeNull();
    stepPuddles(w); expect(w.playerStatus.poisoned?.stacks).toBe(1); expect(w.health.hp).toBe(100);
    for (let i = 0; i < 180; i++) stepPuddles(w); expect(w.puddles).toHaveLength(0);
  });
});
