import { describe, it, expect } from 'vitest';
import { PlayerSim } from '../sim/playerSim.ts';
import { peakRise, ticksUntil } from '../testkit/measure.ts';
import { gridFromRects } from '../level/build.ts';
import { MOVEMENT_TEST } from '../../data/levels/movementTest.ts';
import { wallGap, NO_WALL } from './wall.ts';
import { createPlayerBody } from './body.ts';

/** Floor at 432 and a tall wall whose left face is x 320 (tile 20). */
const wallWorld = () => gridFromRects(40, 30, [
  { x0: 0, y0: 27, x1: 39, y1: 29, kind: 'solid' },
  { x0: 20, y0: 0, x1: 20, y1: 26, kind: 'solid' },
]);

/** A player in the air beside the wall, wall sliding on it (wall on the right). */
function sliding(): PlayerSim {
  const sim = new PlayerSim(wallWorld(), { x: 314, y: 200 });
  sim.stepSpec({ moveX: 1 }, 3);
  expect(sim.body.state).toBe('wallSlide');
  return sim;
}

describe('wallGap (01 §8.1)', () => {
  it('counts empty pixel columns to the wall on row y - 14', () => {
    const g = wallWorld();
    expect(wallGap(createPlayerBody(314, 200), g, 1)).toBe(0);
    expect(wallGap(createPlayerBody(311, 200), g, 1)).toBe(3);
    expect(wallGap(createPlayerBody(306, 200), g, 1)).toBe(8);
    expect(wallGap(createPlayerBody(305, 200), g, 1)).toBe(NO_WALL);
    expect(wallGap(createPlayerBody(342, 200), g, -1)).toBe(0);   // right face: x 336
    expect(wallGap(createPlayerBody(345, 200), g, -1)).toBe(3);
  });
  it('one-way tiles are never walls', () => {
    const g = gridFromRects(40, 30, [{ x0: 20, y0: 0, x1: 20, y1: 26, kind: 'oneway' }]);
    expect(wallGap(createPlayerBody(314, 200), g, 1)).toBe(NO_WALL);
  });
});

describe('wall slide (01 §8.2, checklist 15)', () => {
  it('starts when falling into a wall while holding toward it, faces away, and caps the fall at 90 px/s', () => {
    const sim = new PlayerSim(wallWorld(), { x: 314, y: 100 });
    sim.body.airDashAvailable = false;
    sim.body.doubleJumpAvailable = false;
    sim.stepSpec({ moveX: 1 });
    expect(sim.body.state).toBe('wallSlide');
    expect(sim.body.facing).toBe(-1);
    let maxVy = 0;
    for (let i = 0; i < 60; i++) { sim.stepSpec({ moveX: 1 }); maxVy = Math.max(maxVy, sim.body.vy); expect(sim.body.vx).toBe(0); }
    expect(maxVy).toBe(90);
    expect(sim.body.airDashAvailable).toBe(false);       // sliding refreshes nothing
    expect(sim.body.doubleJumpAvailable).toBe(false);
  });
  it('caps at 400 px/s while holding down', () => {
    const sim = new PlayerSim(wallWorld(), { x: 314, y: 20 });
    let maxVy = 0;
    for (let i = 0; i < 70 && sim.body.state !== 'ground'; i++) { sim.stepSpec({ moveX: 1, moveY: 1 }); maxVy = Math.max(maxVy, sim.body.vy); }
    expect(maxVy).toBe(400);
  });
  it('does not start while rising', () => {
    const sim = new PlayerSim(wallWorld(), { x: 314, y: 200 });
    sim.body.vy = -200;
    sim.stepSpec({ moveX: 1 });
    expect(sim.body.state).toBe('air');
  });
  it('ends when moveX stops pointing at the wall, recording the wall for wall coyote', () => {
    const sim = sliding();
    sim.stepSpec({});
    expect(sim.body.state).toBe('air');
    expect(sim.body.lastWallPt).toBe(sim.body.pt);
    expect(sim.body.lastWallDir).toBe(1);
  });
  it('ends on landing', () => {
    const sim = sliding();
    expect(ticksUntil(sim, { moveX: 1 }, (b) => b.state === 'ground', 600)).toBeGreaterThan(0);
    expect(sim.body.y).toBe(432);
  });
  it('a dash from a wall slide goes away from the wall', () => {
    const sim = sliding();
    expect(sim.stepSpec({ moveX: 1, dash: true })).toContain('dashStart');
    expect(sim.body.vx).toBe(-400);
  });
});

describe('wall jump (01 §8.3, checklist 16, 17)', () => {
  it('without release rises 48 px, moves 25-26 px away during the 14-tick lock and refreshes both', () => {
    const sim = sliding();
    sim.body.airDashAvailable = false;
    sim.body.doubleJumpAvailable = false;
    const x0 = sim.body.x;
    let xAfterLock = 0;
    const rise = peakRise(sim, () => {
      const ev = sim.stepSpec({ moveX: 1, jump: true });
      expect(ev).toContain('wallJump');
      expect(sim.body.airDashAvailable).toBe(true);
      expect(sim.body.doubleJumpAvailable).toBe(true);
      expect(sim.body.facing).toBe(1);   // still holding toward the wall: facing follows moveX, velocity doesn't
      expect(sim.body.jumpCuttable).toBe(true);
      sim.stepSpec({ moveX: 1, jump: true }, 13);
      xAfterLock = sim.body.x;
      sim.stepSpec({ moveX: 1, jump: true }, 40);
    });
    expect(x0 - xAfterLock).toBeGreaterThanOrEqual(25);
    expect(x0 - xAfterLock).toBeLessThanOrEqual(26);
    expect(rise).toBeGreaterThanOrEqual(47);
    expect(rise).toBeLessThanOrEqual(49);
  });
  it('a 3 px gap is a wall jump; a 4 px gap is a double jump', () => {
    const near = new PlayerSim(wallWorld(), { x: 311, y: 200 });
    expect(near.stepSpec({ jump: true })).toContain('wallJump');
    expect(near.body.vx).toBe(-220);
    const far = new PlayerSim(wallWorld(), { x: 310, y: 200 });
    expect(far.stepSpec({ jump: true })).toContain('doubleJump');
  });
  it('wall coyote: within 12 ticks of leaving the wall a jump is a wall jump away from it', () => {
    for (const [after, expected] of [[10, 'wallJump'], [13, 'doubleJump']] as const) {
      const sim = sliding();
      sim.stepSpec({ moveX: -1 });
      const left = sim.body.lastWallPt;
      expect(left).toBe(sim.body.pt);
      while (sim.body.pt < left + after - 1) sim.stepSpec({ moveX: -1 });
      expect(wallGap(sim.body, sim.grid, 1)).toBeGreaterThan(3);
      const ev = sim.stepSpec({ moveX: -1, jump: true });
      expect(ev).toContain(expected);
      if (expected === 'wallJump') expect(sim.body.vx).toBe(-220);
    }
  });
  it('during the 14-tick lock input does not change vx, but facing follows moveX', () => {
    const sim = sliding();
    sim.stepSpec({ moveX: 1, jump: true });
    for (let i = 2; i <= 14; i++) {
      const dir = i % 2 ? 1 : -1;
      sim.stepSpec({ moveX: dir, jump: true });
      expect(sim.body.vx).toBe(-220);
      expect(sim.body.facing).toBe(dir);
    }
    sim.stepSpec({ moveX: 1, jump: true });
    expect(sim.body.vx).toBeGreaterThan(-220);
  });
  it('a dash ends the lock; a double jump does not', () => {
    const sim = sliding();
    sim.stepSpec({ moveX: 1, jump: true }); sim.stepSpec({ moveX: 1 });
    expect(sim.stepSpec({ moveX: 1, jump: true })).toContain('doubleJump');
    expect(sim.body.steerLockTicks).toBeGreaterThan(0);
    expect(sim.body.vx).toBe(-220);
    sim.stepSpec({ moveX: -1, dash: true });
    expect(sim.body.steerLockTicks).toBe(0);
    expect(sim.body.vx).toBe(-400);
  });
  it('with walls in range on both sides it jumps away from the side moveX points to, else the side faced', () => {
    // 16 px corridor (tile 19 = x 304..319) between walls at tiles 18 and 20
    const corridor = () => gridFromRects(40, 30, [
      { x0: 0, y0: 27, x1: 39, y1: 29, kind: 'solid' },
      { x0: 18, y0: 0, x1: 18, y1: 26, kind: 'solid' },
      { x0: 20, y0: 0, x1: 20, y1: 26, kind: 'solid' },
    ]);
    const a = new PlayerSim(corridor(), { x: 311, y: 200 });   // gaps: left 1, right 3
    a.stepSpec({ moveX: 1, jump: true });
    expect(a.body.x).toBeLessThan(311);       // went left, away from the right wall
    const b = new PlayerSim(corridor(), { x: 311, y: 200 });
    b.body.facing = -1;
    b.stepSpec({ jump: true });
    expect(b.body.facing).toBe(1);           // no moveX: facing = away (right)
    expect(b.body.x).toBeGreaterThan(311);
  });
  it('single-wall climbing works: the test level shaft is climbed to the top platform within 10 s', () => {
    const sim = new PlayerSim(MOVEMENT_TEST.grid, { x: 900, y: 432 });
    // Hold jump (full-height jumps); let go for one tick whenever a fresh press is wanted.
    let prevJump = false;
    let t = 0;
    for (; t < 1200; t++) {
      const b = sim.body;
      if (b.state === 'ground' && b.y === 80) break;
      const want = b.grounded || b.state === 'wallSlide' || wallGap(b, sim.grid, 1) <= 3 || (b.vy >= 0 && b.doubleJumpAvailable);
      const jump: boolean = !(want && prevJump);
      sim.stepSpec({ moveX: 1, jump });
      prevJump = jump;
    }
    expect(sim.body.y).toBe(80);
    expect(sim.body.x + 6).toBeGreaterThan(960);   // standing on the platform (row 5 starts at x 960)
    expect(t).toBeLessThan(1200);
  });
});
