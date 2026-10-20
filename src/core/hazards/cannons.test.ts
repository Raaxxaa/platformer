import { describe, expect, it } from 'vitest';
import { gridFromRects } from '../level/build.ts';
import type { LevelObject } from '../level/loadLevel.ts';
import { createCannons, stepCannons, cannonFlashing } from './cannons.ts';
import { ticks } from '../tuning.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { stepSpec } from '../testkit/combatWorld.ts';

const grid = gridFromRects(80, 23, [{ x0: 0, y0: 20, x1: 79, y1: 22, kind: 'solid' }, { x0: 70, y0: 0, x1: 70, y1: 19, kind: 'solid' }]);
const view = { x: 0, y: 0, w: 640, h: 360 };
const far = { x: 5000, y: 5000, w: 14, h: 28 };
const obj = (props: Record<string, number> = {}): LevelObject => ({ id: 1, type: 'cannon', x: 600, y: 300, w: 0, h: 0, props });

describe('Cannon hazard (06 §10)', () => {
  it('fires its first ball 1.0 s after it first enters the view area, then every 3.0 s', () => {
    const s = createCannons([obj()]);
    const shots: number[] = [];
    for (let t = 1; t <= 120 * 8; t++) {
      const before = s.balls.length;
      stepCannons(s, grid, view, far, 1);
      if (s.nextId - 1 > shots.length) shots.push(t);
      void before;
    }
    expect(shots.slice(0, 3)).toEqual([120, 480, 840]);
  });
  it('flashes the muzzle for the last 0.6 s before each shot', () => {
    const s = createCannons([obj()]);
    const flashes: boolean[] = [];
    for (let t = 1; t <= 120; t++) { stepCannons(s, grid, view, far, 1); flashes.push(cannonFlashing(s.cannons[0])); }
    expect(flashes.indexOf(true) + 1).toBe(120 - 72);
  });
  it('is idle while its point is outside the view grown by 160 px, and the clock waits', () => {
    const s = createCannons([obj()]);
    const away = { x: 0, y: 0, w: 640, h: 360 };
    s.cannons[0].x = 900;                                   // 260 px past the right edge
    for (let t = 0; t < 600; t++) stepCannons(s, grid, away, far, 1);
    expect(s.nextId).toBe(1);
    s.cannons[0].x = 790;                                   // 150 px past the edge: inside the margin
    for (let t = 0; t < 130; t++) stepCannons(s, grid, away, far, 1);
    expect(s.nextId).toBe(2);
  });
  it('moves the ball at 300 px/s (2.5 px per tick), stops at a solid wall, and vanishes after its range', () => {
    const s = createCannons([obj({ dir: -1, range: 100 })]);
    s.cannons[0].x = 400;
    for (let t = 0; t < 121; t++) stepCannons(s, grid, view, far, 1);
    const x0 = s.balls[0].x;
    stepCannons(s, grid, view, far, 1);
    expect(s.balls[0].x - x0).toBeCloseTo(-2.5, 5);
    for (let t = 0; t < 40; t++) stepCannons(s, grid, view, far, 1);
    expect(s.balls).toHaveLength(0);                        // range 100 px passed
    const wall = createCannons([obj({ dir: 1 })]);
    wall.cannons[0].x = 1000;                                // wall tile at x 1120, so the ball stops there
    for (let t = 0; t < 120 + 80; t++) stepCannons(wall, grid, { x: 600, y: 0, w: 640, h: 360 }, far, 1);
    expect(wall.balls.every((b) => b.x < 1120)).toBe(true);
  });
  it('hits the player once (20 damage elsewhere), and Time Slow scales ball speed', () => {
    const s = createCannons([obj({ dir: -1 })]);
    s.cannons[0].x = 400;
    const target = { x: 300, y: 270, w: 14, h: 28 };
    let hit = null;
    for (let t = 0; t < 400 && !hit; t++) hit = stepCannons(s, grid, view, target, 1);
    expect(hit).not.toBeNull();
    const slow = createCannons([obj({ dir: -1 })]);
    slow.cannons[0].x = 400;
    for (let t = 0; t < 241; t++) stepCannons(slow, grid, view, far, 0.5);
    const x0 = slow.balls[0].x;
    stepCannons(slow, grid, view, far, 0.5);
    expect(slow.balls[0].x - x0).toBeCloseTo(-1.25, 5);
    expect(ticks(3)).toBe(360);
  });
  it('hurts the player in a world with a 20 damage, non-scaled hit', () => {
    const g2 = gridFromRects(60, 23, [{ x0: 0, y0: 20, x1: 59, y1: 22, kind: 'solid' }]);
    const w = new GameWorld({ grid: g2, spawn: { x: 200, y: 320 }, stage: 4 });
    w.cannons = createCannons([{ id: 9, type: 'cannon', x: 400, y: 306, w: 0, h: 0, props: { dir: -1, offset: 0.1 } }]);
    const hp = w.health.hp;
    stepSpec(w, {}, 240);
    expect(hp - w.health.hp).toBe(20);
  });
});
