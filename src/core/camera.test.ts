import { describe, it, expect } from 'vitest';
import { createCamera, snapCamera, stepCamera, type CameraState } from './camera.ts';
import { createPlayerBody } from './player/body.ts';
import { PlayerSim, type InputSpec } from './sim/playerSim.ts';
import { gridFromRects } from './level/build.ts';
import { ticksUntil } from './testkit/measure.ts';
import { MOVEMENT_TEST } from '../data/levels/movementTest.ts';

/** A 60 × 60 tile world with the floor in the middle (feet y 480), so the bounds never clamp the feet row. */
const tallWorld = () => gridFromRects(60, 60, [{ x0: 0, y0: 30, x1: 59, y1: 59, kind: 'solid' }]);

describe('camera (01 §14)', () => {
  it('standing on flat ground, the feet settle at screen y 220', () => {
    const sim = new PlayerSim(tallWorld(), { x: 400, y: 480 });
    sim.stepSpec({}, 120);
    expect(sim.body.y - sim.camera.y).toBe(220);
  });
  it('a full jump never moves the camera vertically (no look-down above the takeoff height)', () => {
    const sim = new PlayerSim(tallWorld(), { x: 400, y: 480 });
    sim.stepSpec({}, 120);
    const y0 = sim.camera.y, anchor0 = sim.camera.anchorY;
    sim.stepSpec({ jump: true });
    for (let i = 0; i < 80 && sim.body.state !== 'ground'; i++) {
      expect(sim.camera.anchorY).toBe(anchor0);
      expect(sim.camera.lookDown).toBe(0);
      expect(sim.camera.y).toBe(y0);
      sim.stepSpec({ jump: true });
    }
    expect(sim.body.state).toBe('ground');
  });
  it('a fall moves the camera down at once and looks down 64 px once falling at 300 px/s', () => {
    const g = gridFromRects(60, 80, [{ x0: 0, y0: 20, x1: 20, y1: 20, kind: 'solid' }, { x0: 0, y0: 77, x1: 59, y1: 79, kind: 'solid' }]);
    const sim = new PlayerSim(g, { x: 300, y: 320 });
    sim.stepSpec({}, 60);
    const camY0 = sim.camera.cy;
    ticksUntil(sim, { moveX: 1 }, (b) => b.state === 'air');
    sim.stepSpec({ moveX: 1 }, 10);
    expect(sim.camera.anchorY).toBe(sim.body.y);
    expect(sim.camera.cy).toBeGreaterThan(camY0);
    ticksUntil(sim, {}, (b) => b.vy >= 300);
    expect(sim.camera.lookDown).toBeGreaterThan(0);
    sim.stepSpec({}, 30);
    expect(sim.camera.lookDown).toBe(64);
  });
  it('look-ahead approaches clamp(vx × 0.35, ±80) at 240 px/s; idle look-ahead is facing × 24', () => {
    const b = createPlayerBody(1000, 480);
    const c = createCamera({ x: 0, y: 0, w: 4000, h: 2000 }, b);
    expect(c.lookX).toBe(0);
    b.vx = 240;
    stepCamera(c, b);
    expect(c.lookX).toBeCloseTo(2, 9);
    for (let i = 0; i < 60; i++) stepCamera(c, b);
    expect(c.lookX).toBe(80);
    b.vx = 100;
    for (let i = 0; i < 60; i++) stepCamera(c, b);
    expect(c.lookX).toBeCloseTo(35, 9);
    b.vx = 5;
    b.facing = -1;
    for (let i = 0; i < 60; i++) stepCamera(c, b);
    expect(c.lookX).toBe(-24);
  });
  it('smooths toward the desired center with time constants 0.08 s (x) and 0.12 s (y)', () => {
    const b = createPlayerBody(1000, 1000);
    const c = createCamera({ x: 0, y: 0, w: 4000, h: 4000 }, b);
    const cx0 = c.cx;
    b.x += 100;
    b.vx = 0;
    stepCamera(c, b);
    // desired x moved by 100 (plus idle look-ahead creeping 2 px); one tick covers 1 - e^(-1/9.6) of it
    expect(c.cx - cx0).toBeCloseTo((100 + 2) * (1 - Math.exp(-1 / 120 / 0.08)), 6);
  });
  it('keeps the player box 64 px from the side edges and 48 px from the top and bottom', () => {
    const b = createPlayerBody(1000, 1000);
    const c = createCamera({ x: 0, y: 0, w: 4000, h: 4000 }, b);
    for (let i = 0; i < 4; i++) { b.x += 150; stepCamera(c, b); }     // smoothing alone would lag far behind
    expect(c.x + 640 - (b.x + 6)).toBe(64);
    for (let i = 0; i < 4; i++) { b.y -= 150; stepCamera(c, b); }
    expect(b.y - 28 - c.y).toBe(48);
    for (let i = 0; i < 8; i++) { b.x -= 150; stepCamera(c, b); }
    expect(b.x - 6 - c.x).toBe(64);
    for (let i = 0; i < 8; i++) { b.y += 150; stepCamera(c, b); }
    expect(c.y + 360 - b.y).toBe(48);
  });
  it('snapCamera places the camera with no smoothing and resets the look-ahead', () => {
    const b = createPlayerBody(1000, 1000);
    const c = createCamera({ x: 0, y: 0, w: 4000, h: 4000 }, b);
    b.vx = 240;
    for (let i = 0; i < 30; i++) stepCamera(c, b);
    b.x = 2500; b.y = 1500;
    snapCamera(c, b);
    expect(c.lookX).toBe(0);
    expect(c.cx).toBe(2500);
    expect(c.cy).toBe(1500 - 40);
    expect([c.x, c.y]).toEqual([2500 - 320, 1500 - 40 - 180]);
  });
  it('a single-tick player move over 160 px snaps', () => {
    const b = createPlayerBody(1000, 1000);
    const c = createCamera({ x: 0, y: 0, w: 4000, h: 4000 }, b);
    b.x += 200;
    stepCamera(c, b);
    expect(c.cx).toBe(1200);
  });
  it('centers on an axis where the bounds are smaller than the view', () => {
    const b = createPlayerBody(100, 100);
    const c = createCamera({ x: 0, y: 0, w: 400, h: 2000 }, b);
    expect(c.cx).toBe(200);
    expect(c.x).toBe(-120);
  });
  it('never shows outside the level, and keeps the margins except where the bounds win (random run, checklist 30)', () => {
    // Random inputs can't climb the wall-jump shaft, so the level is run in segments: start → shaft,
    // inside the shaft, and past the shaft → right wall.
    const g = MOVEMENT_TEST.grid;
    let seed = 12345;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    let marginChecks = 0, maxX = 0;
    const segments = [{ x: 72, endX: 840 }, { x: 890, endX: 928 }, { x: 1250, endX: 1880 }];
    for (const seg of segments) {
      const sim = new PlayerSim(g, { x: seg.x, y: 432 });
      let spec: InputSpec = {};
      for (let t = 0; t < 4000 && sim.body.x < seg.endX; t++) {
        if (t % 6 === 0) {
          const r = rand();
          spec = {
            moveX: r < 0.7 ? 1 : r < 0.85 ? 0 : -1,
            moveY: rand() < 0.15 ? 1 : 0,
            jump: rand() < 0.4,
            dash: rand() < 0.1,
            attack1: rand() < 0.05,
          };
        }
        sim.stepSpec(spec);
        const c: CameraState = sim.camera, b = sim.body;
        maxX = Math.max(maxX, b.x);
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x).toBeLessThanOrEqual(g.widthPx - 640);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeLessThanOrEqual(g.heightPx - 360);
        if (c.x > 0 && c.x < g.widthPx - 640) {
          expect(b.x - 6 - c.x).toBeGreaterThanOrEqual(64);
          expect(c.x + 640 - (b.x + 6)).toBeGreaterThanOrEqual(64);
          marginChecks++;
        }
        if (c.y > 0 && c.y < g.heightPx - 360) {
          expect(b.y - b.h - c.y).toBeGreaterThanOrEqual(48);
          expect(c.y + 360 - b.y).toBeGreaterThanOrEqual(48);
        }
      }
    }
    expect(maxX).toBeGreaterThan(1800);
    expect(marginChecks).toBeGreaterThan(100);
  });
});
