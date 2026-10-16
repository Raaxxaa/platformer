// Dash, slide and crawl (01 §7, §9).
import type { InputState } from '../input.ts';
import type { TileGrid } from '../level/tiles.ts';
import { boxFree } from '../physics/collide.ts';
import { MOVE } from '../tuning.ts';
import { NEVER, setState, type MoveEvent, type MoveStateId, type PlayerBody } from './body.ts';
import { runMaxEff, type MoveModifiers } from './modifiers.ts';
import { leaveWall } from './wall.ts';

/** States a dash or slide can start from (01 §7.1). */
const DASH_STATES: ReadonlySet<MoveStateId> = new Set<MoveStateId>(['ground', 'air', 'crawl', 'wallSlide']);

/** The dash buffer is active while the last press is under 12 ticks old and unused. */
export function dashBufferActive(b: PlayerBody): boolean {
  return b.pt - b.dashPressPt < MOVE.DASH_BUFFER_TICKS;
}

/** True if the standing 12 × 28 box fits at the body's position. */
export function standingFits(b: PlayerBody, g: TileGrid): boolean {
  return boxFree(g, b.x, b.y, MOVE.BOX_W, MOVE.BOX_H);
}

/** Dash cooldown in ticks: 42 × dashCooldownMult, rounded half up (01 §7.3). */
export function dashCooldownTicks(mods: MoveModifiers): number {
  return Math.floor(MOVE.DASH_COOLDOWN_TICKS * mods.dashCooldownMult + 0.5);
}

/**
 * The part of every dash/slide end that is the same for all reasons: i-frames end and the
 * shared cooldown starts. The caller sets the next state and velocity. Returns the end event.
 */
export function endDashOrSlide(b: PlayerBody, mods: MoveModifiers): 'dashEnd' | 'slideEnd' {
  const event = b.state === 'slide' ? 'slideEnd' : 'dashEnd';
  b.dashIframes = false;
  b.dashReadyPt = b.pt + dashCooldownTicks(mods);
  return event;
}

/** Natural-end speed clamp (01 §7.3): |vx| = min(|vx|, max(runMaxEff, preDashSpeed)). */
function clampEndSpeed(b: PlayerBody, mods: MoveModifiers): void {
  const max = Math.max(runMaxEff(b, mods), b.preDashSpeed);
  if (Math.abs(b.vx) > max) b.vx = Math.sign(b.vx) * max;
}

/** §3 step 5a: starts a dash (or a slide) if the dash buffer is active and every §7.1 check passes. */
export function tryStartDash(b: PlayerBody, input: InputState, _g: TileGrid, mods: MoveModifiers): MoveEvent | null {
  if (!dashBufferActive(b)) return null;
  if (b.pt < b.dashReadyPt || !mods.canDash || mods.rooted || !DASH_STATES.has(b.state)) return null;
  if (!b.grounded && !b.airDashAvailable) return null;

  const slide = b.grounded && (input.moveY === 1 || b.state === 'crawl');
  // Direction: moveX, else facing; from a wall slide always away from the wall (01 §7.1).
  let dir: 1 | -1 = input.moveX !== 0 ? input.moveX : b.facing;
  if (b.state === 'wallSlide') {
    dir = -b.lastWallDir as -1 | 1;
    leaveWall(b);
  }
  b.preDashSpeed = Math.sign(b.vx) === dir ? Math.abs(b.vx) : 0;
  b.vx = dir * Math.max(slide ? MOVE.SLIDE_SPEED : MOVE.DASH_SPEED, b.preDashSpeed);
  b.vy = 0;
  b.facing = dir;
  b.dashIframes = true;
  b.steerLockTicks = 0;
  b.jumpCuttable = false;
  b.dashPressPt = NEVER;   // the press is used up
  if (!b.grounded) b.airDashAvailable = false;
  if (slide) {
    b.h = MOVE.BOX_H_LOW;
    setState(b, 'slide', 1);
    return 'slideStart';
  }
  setState(b, 'dash', 1);
  return 'dashStart';
}

/** §3 step 2 for dash/slide: natural ends (01 §7.3, §9.3) and the slide's i-frame window. */
export function stepDashOrSlide(b: PlayerBody, g: TileGrid, mods: MoveModifiers): MoveEvent | null {
  if (b.state === 'dash' && b.stateTicks > MOVE.DASH_TICKS) {
    const event = endDashOrSlide(b, mods);
    setState(b, b.grounded ? 'ground' : 'air', 1);
    clampEndSpeed(b, mods);
    return event;
  }
  if (b.state === 'slide') {
    if (b.stateTicks > MOVE.SLIDE_TICKS) {
      const event = endDashOrSlide(b, mods);
      if (standingFits(b, g)) {
        b.h = MOVE.BOX_H;
        setState(b, 'ground', 1);
      } else {
        setState(b, 'crawl', 1);
      }
      clampEndSpeed(b, mods);
      return event;
    }
    b.dashIframes = b.stateTicks <= MOVE.SLIDE_IFRAMES_TICKS;
  }
  return null;
}

/** 01 §7.4: every "refund the dash" / "reset the dash cooldown" effect calls this. */
export function refundDash(b: PlayerBody): void {
  b.dashReadyPt = b.pt;
  b.airDashAvailable = true;
}
