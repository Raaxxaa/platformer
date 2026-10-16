import { describe, it, expect } from 'vitest';
import { PlayerSim, specToInput } from '../sim/playerSim.ts';
import { flatWorld } from '../testkit/worlds.ts';
import { ticksUntil, peakRise } from '../testkit/measure.ts';
import { gridFromRects } from '../level/build.ts';
import { speedMult, defaultModifiers } from './modifiers.ts';
import { createPlayerBody } from './body.ts';
import { MOVE, TICK } from '../tuning.ts';

function simOnFlat(x = 200): PlayerSim {
  return new PlayerSim(flatWorld(), { x, y: 432 });
}

describe('MOVE tuning (01 §4)', () => {
  it('has the spec values and tick twins', () => {
    expect(MOVE.RUN_MAX).toBe(170);
    expect(MOVE.JUMP_V).toBe(-410);
    expect(MOVE.DASH_TIME).toBe(0.15); expect(MOVE.DASH_TICKS).toBe(18);
    expect(MOVE.COYOTE).toBe(0.10); expect(MOVE.COYOTE_TICKS).toBe(12);
    expect(MOVE.DASH_COOLDOWN).toBe(0.35); expect(MOVE.DASH_COOLDOWN_TICKS).toBe(42);
    expect(MOVE.SLIDE_TICKS).toBe(36); expect(MOVE.WALL_JUMP_LOCK_TICKS).toBe(14);
    expect(MOVE.LEDGE_CLIMB_UP_TICKS).toBe(12); expect(MOVE.LEDGE_CLIMB_OVER_TICKS).toBe(6);
    expect(MOVE.DIVE_WINDUP_TICKS).toBe(6); expect(MOVE.DIVE_LAND_LAG_TICKS).toBe(12);
  });
});

describe('createPlayerBody', () => {
  it('starts on the ground facing right with both refreshes and old press stamps', () => {
    const b = createPlayerBody(10, 20);
    expect(b).toMatchObject({ x: 10, y: 20, w: 12, h: 28, state: 'ground', facing: 1, airDashAvailable: true, doubleJumpAvailable: true, dashReadyPt: 0, jumpPressPt: -1000, dashPressPt: -1000, lastWallPt: -1000, hitStopTicks: 0 });
  });
});

describe('specToInput', () => {
  it('pressed = held now and not before; released = the reverse', () => {
    const a = specToInput({}, { jump: true, moveX: 1 });
    expect(a.jump).toEqual({ held: true, pressed: true, released: false });
    expect(a.moveX).toBe(1);
    const b = specToInput({ jump: true }, { jump: true });
    expect(b.jump.pressed).toBe(false);
    const c = specToInput({ jump: true }, {});
    expect(c.jump).toEqual({ held: false, pressed: false, released: true });
  });
});

describe('running (01 §5.3, checklist 4)', () => {
  it('reaches 170 px/s on the 12th tick and not before', () => {
    const sim = simOnFlat();
    for (let t = 1; t <= 12; t++) {
      sim.stepSpec({ moveX: 1 });
      if (t < 12) expect(sim.body.vx).toBeLessThan(170);
      else expect(sim.body.vx).toBe(170);
    }
    expect(sim.body.state).toBe('ground');
  });
  it('stops within 9 ticks after releasing at 170', () => {
    const sim = simOnFlat();
    sim.stepSpec({ moveX: 1 }, 20);
    expect(ticksUntil(sim, {}, (b) => b.vx === 0)).toBe(9);
  });
  it('runs at 246.5 px/s with +45% move speed (checklist 9)', () => {
    const sim = simOnFlat();
    sim.mods.speedPercents = [0.45];
    sim.stepSpec({ moveX: 1 }, 30);
    expect(sim.body.vx).toBeCloseTo(246.5, 6);
  });
  it('speedMult adds percents and clamps to 0.5–1.8', () => {
    const m = defaultModifiers();
    expect(speedMult(m)).toBe(1);
    expect(speedMult({ ...m, speedPercents: [0.2, 0.25] })).toBeCloseTo(1.45, 10);
    expect(speedMult({ ...m, speedPercents: [2] })).toBe(1.8);
    expect(speedMult({ ...m, speedPercents: [-1] })).toBe(0.5);
  });
  it('turning from +170 uses the turn rate until vx flips, then accel (01 §5.3 pseudocode)', () => {
    const sim = simOnFlat(400);
    sim.stepSpec({ moveX: 1 }, 20);
    expect(ticksUntil(sim, { moveX: -1 }, (b) => b.vx < 0)).toBe(9);     // 2400 px/s²: 20 px/s per tick
    expect(ticksUntil(sim, { moveX: -1 }, (b) => b.vx === -170)).toBe(11); // then 1800 px/s²
  });
  it('faces the input direction', () => {
    const sim = simOnFlat();
    sim.stepSpec({ moveX: -1 });
    expect(sim.body.facing).toBe(-1);
    sim.stepSpec({});
    expect(sim.body.facing).toBe(-1);
  });
  it('overspeed on the ground decays at 1600 px/s² while holding forward and stops at 170', () => {
    const sim = simOnFlat();
    sim.body.vx = 300;
    let prev = 300;
    for (let i = 0; i < 20; i++) {
      sim.stepSpec({ moveX: 1 });
      expect(sim.body.vx).toBeGreaterThanOrEqual(170);
      if (prev > 170) expect(sim.body.vx).toBeCloseTo(Math.max(170, prev - 1600 * TICK), 9);
      prev = sim.body.vx;
    }
    expect(sim.body.vx).toBe(170);
  });
  it('rooted sets vx to 0', () => {
    const sim = simOnFlat();
    sim.stepSpec({ moveX: 1 }, 10);
    sim.mods.rooted = true;
    sim.stepSpec({ moveX: 1 });
    expect(sim.body.vx).toBe(0);
  });
});

describe('falling (01 §5.4, checklist 15, 28)', () => {
  it('caps at 400 px/s', () => {
    const sim = new PlayerSim(flatWorld(), { x: 200, y: 50 });
    let maxVy = 0;
    for (let i = 0; i < 80; i++) { sim.stepSpec({}); maxVy = Math.max(maxVy, sim.body.vy); }
    expect(maxVy).toBe(400);
  });
  it('caps at 520 px/s while holding down, and drops back to 400 at 2400 px/s² on release', () => {
    const sim = new PlayerSim(flatWorld(), { x: 200, y: 50 });
    sim.stepSpec({ moveY: 1 }, 50);
    expect(sim.body.vy).toBe(520);
    sim.stepSpec({});
    expect(sim.body.vy).toBeCloseTo(520 - 2400 * TICK, 9);
    sim.stepSpec({}, 10);
    expect(sim.body.vy).toBe(400);
  });
  it('a drop from 2000 px lands exactly on the floor, on the ground, with no damage', () => {
    const g = gridFromRects(10, 140, [{ x0: 0, y0: 137, x1: 9, y1: 139, kind: 'solid' }]);
    const sim = new PlayerSim(g, { x: 80, y: 2192 - 2000 });
    expect(sim.body.state).toBe('air');
    const n = ticksUntil(sim, {}, (b) => b.state === 'ground', 3000);
    expect(n).toBeGreaterThan(0);
    expect(sim.body.y).toBe(2192);
    expect(sim.body.vy).toBe(0);
  });
  it('emits land on the landing tick, with the impact speed', () => {
    const sim = new PlayerSim(flatWorld(), { x: 200, y: 400 });
    const events: string[][] = [];
    for (let i = 0; i < 60 && sim.body.state !== 'ground'; i++) events.push(sim.stepSpec({}));
    expect(events.at(-1)).toContain('land');
    expect(events.slice(0, -1).flat()).not.toContain('land');
    expect(sim.body.landSpeed).toBeGreaterThan(0);
  });
  it('walking off a ledge goes to air with coyote time', () => {
    const g = gridFromRects(30, 30, [{ x0: 0, y0: 27, x1: 9, y1: 29, kind: 'solid' }, { x0: 0, y0: 29, x1: 29, y1: 29, kind: 'solid' }]);
    const sim = new PlayerSim(g, { x: 140, y: 432 });
    ticksUntil(sim, { moveX: 1 }, (b) => b.state === 'air');
    expect(sim.body.x - 6).toBeGreaterThanOrEqual(160);
    expect(sim.body.coyoteValid).toBe(true);
    expect(sim.body.lastGroundPt).toBe(sim.body.pt - 1);
  });
  it('peakRise measures how far above the start the body went', () => {
    const sim = simOnFlat();
    expect(peakRise(sim, () => sim.stepSpec({}, 10))).toBe(0);
  });
});

describe('PlayerSim.respawn', () => {
  it('puts a fresh body at the spot and snaps the camera', () => {
    const sim = new PlayerSim(flatWorld(), { x: 200, y: 432 });
    sim.stepSpec({ moveX: 1, jump: true }, 20);
    sim.respawn({ x: 500, y: 432 });
    expect(sim.body).toMatchObject({ x: 500, y: 432, vx: 0, vy: 0, state: 'ground', grounded: true });
    expect(sim.camera.cx).toBe(500);
    sim.respawn({ x: 300, y: 100 });
    expect(sim.body.state).toBe('air');
  });
});
