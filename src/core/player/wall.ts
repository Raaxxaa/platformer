// Wall contact, wall slide and wall jump (01 §8).
import type { InputState } from '../input.ts';
import type { TileGrid } from '../level/tiles.ts';
import { MOVE } from '../tuning.ts';
import { NEVER, setState, type PlayerBody } from './body.ts';

/** wallGap result when no wall is within WALL_PROBE_MAX px. */
export const NO_WALL = 1_000_000;

/**
 * 01 §8.1: empty pixel columns between the box and the nearest wall pixel on `side`,
 * measured on the row y - 14 (body center height). 0 = touching.
 */
export function wallGap(b: PlayerBody, g: TileGrid, side: 1 | -1): number {
  const row = b.y - MOVE.WALL_PROBE_ROW;
  const firstOutside = side > 0 ? b.x + b.w / 2 : b.x - b.w / 2 - 1;
  for (let d = 0; d <= MOVE.WALL_PROBE_MAX; d++) {
    if (g.isSolidPx(firstOutside + side * d, row)) return d;
  }
  return NO_WALL;
}

/**
 * 01 §8.3: which way a wall jump would go right now, or 0 if none applies (airborne callers only).
 * Walls in range on both sides: away from the side moveX points to, else from the side faced.
 * Only wall coyote: away from the last wall.
 */
export function wallJumpDir(b: PlayerBody, input: InputState, g: TileGrid): -1 | 0 | 1 {
  const inRight = wallGap(b, g, 1) <= MOVE.WALL_JUMP_RANGE;
  const inLeft = wallGap(b, g, -1) <= MOVE.WALL_JUMP_RANGE;
  if (inRight && inLeft) return input.moveX !== 0 ? -input.moveX as -1 | 1 : -b.facing as -1 | 1;
  if (inRight) return -1;
  if (inLeft) return 1;
  if (b.pt - b.lastWallPt <= MOVE.WALL_COYOTE_TICKS) return -b.lastWallDir as -1 | 1;
  return 0;
}

/** 01 §8.3: the wall jump itself. */
export function wallJump(b: PlayerBody, away: 1 | -1): void {
  b.vx = MOVE.WALL_JUMP_VX * away;
  b.vy = MOVE.WALL_JUMP_VY;
  b.facing = away;
  b.steerLockTicks = MOVE.WALL_JUMP_LOCK_TICKS;
  b.airDashAvailable = true;
  b.doubleJumpAvailable = true;
  b.jumpCuttable = true;
  b.coyoteValid = false;
  b.lastWallPt = NEVER;    // this wall's coyote is used up
}

/** Leaving a wall slide without a wall jump: remember the wall for wall coyote (01 §8.2). */
export function leaveWall(b: PlayerBody): void {
  b.lastWallPt = b.pt;
}

/**
 * §3 step 9 wall slide transitions (01 §8.2). While sliding, `lastWallDir` holds the wall's side.
 * Landing out of a wall slide is handled by the landing code.
 */
export function updateWallSlide(b: PlayerBody, input: InputState, g: TileGrid): void {
  if (b.grounded) return;
  if (b.state === 'wallSlide') {
    const side = b.lastWallDir;
    if (input.moveX !== side || wallGap(b, g, side) !== 0) {
      leaveWall(b);
      setState(b, 'air', 0);
    }
    return;
  }
  if (b.state === 'air' && b.vy >= 0 && input.moveX !== 0 && wallGap(b, g, input.moveX) === 0) {
    b.lastWallDir = input.moveX;
    b.facing = -input.moveX as -1 | 1;
    b.vx = 0;
    setState(b, 'wallSlide', 0);
  }
}
