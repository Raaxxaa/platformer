import { describe, expect, it } from 'vitest';
import { gridFromRects } from '../level/build.ts';
import { PlayerSim } from '../sim/playerSim.ts';
import { applyKnockback } from './movement.ts';
import { refundDash } from './dash.ts';
import { startForcedMove, type ForcedMove } from './forcedMove.ts';
import { teleport } from './teleport.ts';
import { Bodies } from '../physics/bodies.ts';

/** Floor at row 20, walls at both ends; optional wall columns. */
function sim(walls: { x0: number; x1: number; y0?: number }[] = [], x = 160, y = 320) {
  const g = gridFromRects(60, 23, [
    { x0: 0, y0: 20, x1: 59, y1: 22, kind: 'solid' },
    { x0: 0, y0: 0, x1: 0, y1: 22, kind: 'solid' }, { x0: 59, y0: 0, x1: 59, y1: 22, kind: 'solid' },
    ...walls.map((w) => ({ x0: w.x0, x1: w.x1, y0: w.y0 ?? 0, y1: 19, kind: 'solid' as const })),
  ]);
  return new PlayerSim(g, { x, y });
}
const DASH: ForcedMove = { vx: 480, vy: 0, durationS: 0.20, gravity: false, endOnWall: true, endVelocity: 'clampToRun', cancelByJump: true, cancelByDash: true };

describe('ForcedMove (01 §12.3)', () => {
  it('480 px/s for 0.20 s moves exactly 96 px on open ground, then clamps to run speed', () => {
    const s = sim();
    s.stepSpec({}, 2);
    const x0 = s.body.x;
    startForcedMove(s.body, DASH, 'test');
    s.stepSpec({}, 24);
    expect(s.body.x - x0).toBe(96);
    expect(s.body.state).toBe('forced');
    s.stepSpec({}, 1);
    expect(s.body.state).toBe('ground');
    expect(s.body.lastForced?.endReason).toBe('time');
    expect(Math.abs(s.body.vx)).toBeLessThanOrEqual(170);
  });
  it('stops at a wall', () => {
    const s = sim([{ x0: 13, x1: 13 }]);       // wall face at x 208
    s.stepSpec({}, 2);
    startForcedMove(s.body, DASH, 'test');
    s.stepSpec({}, 24);
    expect(s.body.x + s.body.w / 2).toBe(208);
    expect(s.body.state).toBe('ground');
    expect(s.body.lastForced?.endReason).toBe('wall');
  });
  it('jump and dash presses cancel it on that tick; knockback ends it', () => {
    for (const spec of [{ jump: true }, { dash: true }]) {
      const s = sim();
      s.stepSpec({}, 2);
      startForcedMove(s.body, DASH, 'test');
      s.stepSpec({}, 5);
      s.stepSpec(spec, 1);
      expect(s.body.state).not.toBe('forced');
      expect(s.body.lastForced?.endReason).toBe(spec.jump ? 'jump' : 'dash');
    }
    const s = sim();
    s.stepSpec({}, 2);
    startForcedMove(s.body, DASH, 'test');
    s.stepSpec({}, 3);
    applyKnockback(s.body, -100, -100, 12);
    expect(s.body.state).toBe('hurt');
    expect(s.body.forced).toBeNull();
  });
  it('does not use or refresh the air dash', () => {
    const s = sim([], 160, 200);
    s.body.airDashAvailable = false;
    startForcedMove(s.body, DASH, 'test');
    s.stepSpec({}, 24);
    expect(s.body.airDashAvailable).toBe(false);
    const t = sim([], 160, 200);
    startForcedMove(t.body, DASH, 'test');
    t.stepSpec({}, 24);
    expect(t.body.airDashAvailable).toBe(true);
  });
  it('the target form arrives and ends', () => {
    const s = sim();
    s.stepSpec({}, 2);
    startForcedMove(s.body, { ...DASH, vx: 0, durationS: 1, target: { x: 400, y: 200 }, speed: 450, arriveDist: 12, endVelocity: 'zero' }, 'test');
    for (let i = 0; i < 120 && s.body.forced; i++) s.stepSpec({}, 1);
    expect(s.body.lastForced?.endReason).toBe('arrived');
    expect(Math.hypot(400 - s.body.x, 200 - (s.body.y - s.body.h / 2))).toBeLessThanOrEqual(12);
  });
});

describe('teleport (01 §12.4)', () => {
  const bounds = { x: 0, y: 0, w: 960, h: 368 };
  it('64 px on open ground; through a 16 px wall', () => {
    const s = sim();
    s.stepSpec({}, 2);
    s.body.vx = 50; s.body.vy = 30;
    expect(teleport(s.body, s.grid, 64, 0, bounds)).toEqual({ ok: true, dx: 64, dy: 0 });
    expect(s.body.vy).toBe(0);
    expect(s.body.vx).toBe(50);
    const t = sim([{ x0: 12, x1: 12 }]);       // wall x 192–208, player at 160
    t.stepSpec({}, 2);
    expect(teleport(t.body, t.grid, 64, 0, bounds).dx).toBe(64);
  });
  it('never crosses a noTeleport body or leaves the camera bounds; fails with no free spot', () => {
    const s = sim();
    s.stepSpec({}, 2);
    s.grid.bodies = new Bodies(s.grid.w, s.grid.h);
    s.grid.bodies.add({ id: 'door', x: 192, y: 256, w: 16, h: 64, oneWay: false, surface: 'normal', grabbable: false, noTeleport: true, active: true });
    const r = teleport(s.body, s.grid, 64, 0, bounds);
    expect(s.body.x + s.body.w / 2).toBeLessThanOrEqual(192);
    expect(r.dx).toBeLessThan(64);
    const t = sim();
    t.stepSpec({}, 2);
    expect(teleport(t.body, t.grid, 64, 0, { x: 0, y: 0, w: 180, h: 368 }).dx).toBe(14);
    const u = sim([{ x0: 11, x1: 18 }]);       // a thick wall right next to the player
    u.stepSpec({}, 2);
    u.body.x = 170;
    expect(teleport(u.body, u.grid, 64, 0, bounds)).toEqual({ ok: false, dx: 0, dy: 0 });
  });
});

describe('refundDash (01 §7.4)', () => {
  it('resets the dash cooldown and gives the air dash back', () => {
    const s = sim([], 160, 200);
    s.stepSpec({ dash: true }, 1);
    s.stepSpec({}, 20);
    expect(s.body.airDashAvailable).toBe(false);
    expect(s.body.dashReadyPt).toBeGreaterThan(s.body.pt);
    refundDash(s.body);
    expect(s.body.airDashAvailable).toBe(true);
    expect(s.body.dashReadyPt).toBe(s.body.pt);
  });
});
