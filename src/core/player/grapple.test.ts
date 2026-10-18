import { describe, it, expect } from 'vitest';
import { PlayerSim } from '../sim/playerSim.ts';
import { gridFromRects } from '../level/build.ts';
import { startGrapplePull } from './grapple.ts';
const sim = () => new PlayerSim(gridFromRects(80, 40, []), { x: 200, y: 250 });
describe('grapple foundations (01 §13.7, ability remains M9)', () => {
  it('point arrival hops200/-250 in start direction and refreshes both air moves', () => {
    const s = sim();
    s.body.airDashAvailable = s.body.doubleJumpAvailable = false;
    startGrapplePull(s.body, { x: 300, y: 180 }, 450, 1, 'point');
    for (let n = 0; n < 80 && s.body.forced; n++)
      s.stepSpec({});
    expect(s.body.state).toBe('air');
    expect(s.body.vx).toBe(200);
    expect(s.body.vy).toBe(-250);
    expect(s.body.jumpCuttable).toBe(false);
    expect(s.body.airDashAvailable).toBe(true);
    expect(s.body.doubleJumpAvailable).toBe(true);
  });
  it('nearly vertical point arrival gives zero horizontal speed', () => {
    const s = sim();
    startGrapplePull(s.body, { x: 207, y: 180 }, 450, 1, 'point');
    while (s.body.forced)
      s.stepSpec({});
    expect(s.body.vx).toBe(0);
  });
  it('wall-target arrival and collision before a point zero velocity, remain air, and do not refresh', () => {
    for (const kind of ['wall', 'point'] as const) {
      const s = new PlayerSim(gridFromRects(80, 40, [{ x0: 16, y0: 0, x1: 16, y1: 39, kind: 'solid' }]), { x: 200, y: 250 });
      s.body.airDashAvailable = s.body.doubleJumpAvailable = false;
      startGrapplePull(s.body, { x: kind === 'wall' ? 250 : 350, y: 236 }, 450, 1, kind);
      while (s.body.forced)
        s.stepSpec({});
      expect(s.body.vx).toBe(0);
      expect(s.body.vy).toBe(0);
      expect(s.body.state).toBe('air');
      expect(s.body.airDashAvailable).toBe(false);
      expect(s.body.doubleJumpAvailable).toBe(false);
    }
  });
  it('jump and dash cancel the pull through ordinary movement rules', () => {
    for (const action of ['jump', 'dash'] as const) {
      const s = sim();
      startGrapplePull(s.body, { x: 500, y: 100 }, 450, 2, 'point');
      const ev = s.stepSpec({ [action]: true });
      expect(s.body.forced).toBe(null);
      expect(ev).toContain(action === 'jump' ? 'doubleJump' : 'dashStart');
    }
  });
});
