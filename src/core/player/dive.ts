// Dive slam: windup, fall, landing lag, and the bounce hook combat calls (01 §11).
import type { InputState } from '../input.ts';
import { MOVE } from '../tuning.ts';
import { setState, type MoveEvent, type MoveStateId, type PlayerBody } from './body.ts';
import type { MoveContext } from './modifiers.ts';
import { leaveWall } from './wall.ts';

/** States a dive slam can start from (01 §11.1). An attack in progress is cancelled by combat (M2). */
const DIVE_STATES: ReadonlySet<MoveStateId> = new Set<MoveStateId>(['air', 'wallSlide', 'dash']);

/**
 * §3 step 5c: down + a fresh attack press on a slot with a usable weapon, while airborne
 * (coyote time counts as airborne). The caller skips this on a tick where a jump started,
 * and ends a dash it cancels.
 */
export function tryStartDive(b: PlayerBody, input: InputState, ctx: MoveContext): MoveEvent | null {
  if (input.moveY !== 1 || b.grounded || !DIVE_STATES.has(b.state)) return null;
  const slot1 = input.attack1.pressed && ctx.slotUsable[0];
  const slot2 = input.attack2.pressed && ctx.slotUsable[1];
  if (!slot1 && !slot2) return null;
  if (b.state === 'wallSlide') leaveWall(b);
  b.vx = 0;
  b.vy = 0;
  b.jumpCuttable = false;
  b.steerLockTicks = 0;
  setState(b, 'diveWindup', 1);
  return 'diveStart';
}

/** §3 step 2 for the dive: windup → fall after 6 ticks; landing lag → ground after 12 (01 §11.2). */
export function stepDivePhases(b: PlayerBody): void {
  if (b.state === 'diveWindup' && b.stateTicks > MOVE.DIVE_WINDUP_TICKS) {
    b.vy = MOVE.DIVE_SPEED;   // constant from the first fall tick
    setState(b, 'diveFall', 1);
  } else if (b.state === 'diveLand' && b.stateTicks > MOVE.DIVE_LAND_LAG_TICKS) setState(b, 'ground', 1);
}

/**
 * Combat (02) calls this on the first tick the dive hitbox hits an enemy, boss or bounceable
 * object: the bounce (01 §11.2). Returns 'diveBounce', or null if the player isn't in `diveFall`.
 */
export function onDiveHit(b: PlayerBody): MoveEvent | null {
  if (b.state !== 'diveFall') return null;
  b.vy = MOVE.DIVE_BOUNCE_V;
  b.vx = 0;
  b.airDashAvailable = true;
  b.doubleJumpAvailable = true;
  b.jumpCuttable = false;
  b.coyoteValid = false;
  setState(b, 'air', 0);
  return 'diveBounce';
}
