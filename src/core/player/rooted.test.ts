import { describe, expect, it } from 'vitest';
import { PlayerSim } from '../sim/playerSim.ts';
import { gridFromRects } from '../level/build.ts';
import { startForcedMove } from './forcedMove.ts';
describe('Rooted movement (02 §5.4)', () => {
  it('ends existing dash, slide and ability movement without drifting or accepting jump/dash', () => {
    for (const mode of ['dash', 'slide', 'forced'] as const) {
      const s = new PlayerSim(gridFromRects(100, 30, [{ x0: 0, y0: 20, x1: 99, y1: 29, kind: 'solid' }]), { x: 200, y: 320 });
      if (mode === 'forced')
        startForcedMove(s.body, { vx: 400, vy: 0, durationS: 1, gravity: false, endOnWall: true, endVelocity: 'keep', cancelByJump: true, cancelByDash: true }, 'test');
      else
        s.stepSpec({ dash: true, moveY: mode === 'slide' ? 1 : 0 });
      const x = s.body.x;
      s.mods.rooted = true;
      s.stepSpec({ moveX: 1, jump: true, dash: true }, 10);
      expect(s.body.x).toBe(x);
      expect(s.body.vx).toBe(0);
      expect(s.body.y).toBe(320);
      expect(s.body.forced).toBe(null);
    }
  });
  it('falls normally while rooted in the air even when a cast requests hover', () => {
    const s = new PlayerSim(gridFromRects(100, 100, []), { x: 200, y: 200 });
    s.mods.rooted = true;
    s.mods.gravityMult = 0;
    s.stepSpec({ moveX: 1 }, 10);
    expect(s.body.x).toBe(200);
    expect(s.body.y).toBeGreaterThan(200);
    expect(s.body.vy).toBe(125);
  });
});
