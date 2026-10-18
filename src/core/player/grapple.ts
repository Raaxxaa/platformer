import type { PlayerBody } from './body.ts';
import { startForcedMove } from './forcedMove.ts';
import { TERRAIN } from '../tuning.ts';
/** Pull mechanics only. Grapple Arrow targeting/unlock remains in M9 (M7.1 plan). */
export function startGrapplePull(b: PlayerBody, target: {
  x: number;
  y: number;
}, speed: number, durationS: number, kind: 'point' | 'wall'): void {
  const startX = b.x;
  startForcedMove(b, { vx: 0, vy: 0, target, speed, durationS, gravity: false, endOnWall: true, arriveDist: TERRAIN.GRAPPLE_ARRIVE, endVelocity: 'zero', cancelByJump: true, cancelByDash: true }, 'grapple');
  b.forced!.grapple = { kind, startX };
}
