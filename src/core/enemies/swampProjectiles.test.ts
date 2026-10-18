import { describe, expect, it } from 'vitest';
import { ENEMY_PROJECTILES } from '../../data/enemyProjectiles.ts';
import { createPlayerStatus, stepPlayerStatus } from '../combat/playerStatus.ts';
import { gridFromRects } from '../level/build.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { spawnEnemyProjectile, stepProjectiles, stepPuddles } from './projectiles.ts';

function world(stage: 1 | 2 = 2) {
  const grid = gridFromRects(60, 30, [{ x0: 0, y0: 20, x1: 59, y1: 29, kind: 'solid' }]);
  const w = new GameWorld({ grid, spawn: { x: 500, y: 320 }, stage, enemies: [{ enemy: 'bandit_archer', x: 400, y: 320, facing: 1 }] });
  w.playerStatus = createPlayerStatus(); w.puddles = []; return w;
}
function potion(w: GameWorld, x = 700, y = 315) {
  const p = spawnEnemyProjectile(w, w.enemies[0], ENEMY_PROJECTILES.potion!, 'arc', 0, { x, y });
  w.enemies[0].dead = true; return p;
}
function groundPotion(w: GameWorld) {
  const p = potion(w); p.vx = 0; p.vy = 240; stepProjectiles(w); return p;
}
const puddles = (w: GameWorld, n: number) => { for (let i = 0; i < n; i++) stepPuddles(w); };

describe('Swamp Witch potion and puddle (04 §2.7, §5, §8)', () => {
  it('uses the exact arc, splash, and puddle data', () => {
    expect(ENEMY_PROJECTILES.potion).toMatchObject({ w: 8, h: 8, motion: 'arc', arcTime: 0.7,
      blast: { w: 40, h: 24, fuse: 0 }, hit: { damage: 9, status: { id: 'poisoned', stacks: 1 } },
      puddle: { w: 48, h: 8, life: 2.5, status: 'poisoned' } });
    const w = world(); const p = potion(w, 420, 200);
    expect(p.vx).toBeCloseTo(80 / 0.7); expect(p.vy).toBeCloseTo((320 - 200 - 0.5 * 1000 * 0.7 ** 2) / 0.7);
  });

  it('shatters on the player for one splash, applies one poison stack, and leaves no puddle', () => {
    const w = world(); const p = potion(w, 499, 304); p.vx = 120; p.vy = 0;
    expect(w.hitGroups.find((g) => g.id === p.groupId)?.active).toBe(false);
    stepSpec(w, {}); expect(w.health.hp).toBe(88); expect(w.playerStatus.poisoned?.stacks).toBe(1);
    expect(w.projectiles).toHaveLength(0); expect(w.puddles).toHaveLength(0); expect(w.blasts).toHaveLength(1);
    expect(w.hitGroups.find((g) => w.blasts.includes(g.id))?.rect).toMatchObject({ w: 40, h: 24 });
  });

  it('spends an invulnerable player impact without a poison stack or a delayed puddle', () => {
    const w = world(); const p = potion(w, 500, 304); p.vx = 0; p.vy = 0; w.health.iframeTicks = 120;
    stepSpec(w, {}); expect(w.health.hp).toBe(100); expect(w.playerStatus.poisoned).toBeNull(); expect(w.puddles).toHaveLength(0);
    w.health.iframeTicks = 0; stepSpec(w, {}); expect(w.health.hp).toBe(100); expect(w.projectiles).toHaveLength(0);
  });

  it('shatters immediately on ground, then leaves a floor-aligned 48 by 8 puddle for 300 ticks', () => {
    const w = world(); const p = groundPotion(w);
    expect(w.projectiles).not.toContain(p); expect(w.blasts).toHaveLength(1);
    expect(w.puddles).toHaveLength(1); expect(w.puddles[0]).toMatchObject({ owner: w.enemies[0].id, x: 676, y: 312, w: 48, h: 8, left: 300, next: 60, status: 'poisoned' });
    puddles(w, 299); expect(w.puddles).toHaveLength(1); puddles(w, 1); expect(w.puddles).toHaveLength(0);
  });

  it('first applies after sixty ticks, ignores all i-frames, adds no direct damage, and reaches at most three stacks', () => {
    const w = world(); groundPotion(w); w.body.x = 700; w.health.iframeTicks = 999; w.health.abilityIframeTicks = 999; w.body.dashIframes = true;
    puddles(w, 59); expect(w.playerStatus.poisoned).toBeNull();
    puddles(w, 1); expect(w.playerStatus.poisoned?.stacks).toBe(1); expect(w.health.hp).toBe(100);
    puddles(w, 60); expect(w.playerStatus.poisoned?.stacks).toBe(2);
    puddles(w, 180); expect(w.playerStatus.poisoned?.stacks).toBe(3); expect(w.puddles).toHaveLength(0); expect(w.health.hp).toBe(100);
  });

  it('pulses from creation time rather than time spent standing inside', () => {
    const w = world(); groundPotion(w); puddles(w, 60); expect(w.playerStatus.poisoned).toBeNull();
    w.body.x = 700; puddles(w, 59); expect(w.playerStatus.poisoned).toBeNull();
    puddles(w, 1); expect(w.playerStatus.poisoned?.stacks).toBe(1);
  });

  it('slows the puddle pulse and lifetime globally while player poison still uses player ticks', () => {
    const w = world(1); groundPotion(w); w.body.x = 700; w.worldTimeScale = 0.5;
    puddles(w, 119); expect(w.playerStatus.poisoned).toBeNull(); puddles(w, 1); expect(w.playerStatus.poisoned?.stacks).toBe(1);
    for (let i = 0; i < 60; i++) stepPlayerStatus(w); expect(w.health.hp).toBe(99);
    puddles(w, 479); expect(w.puddles).toHaveLength(1); puddles(w, 1); expect(w.puddles).toHaveLength(0);
  });
});
