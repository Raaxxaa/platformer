// Jumping: ground jump, double jump, jump cut, coyote time and the jump buffer (01 §6).
import type { InputState } from '../input.ts';
import type { TileGrid } from '../level/tiles.ts';
import { MOVE } from '../tuning.ts';
import { NEVER, setState, type MoveEvent, type MoveStateId, type PlayerBody } from './body.ts';
import { endDashOrSlide, standingFits } from './dash.ts';
import type { MoveModifiers } from './modifiers.ts';

/** States a jump can start from. Others (crawl, …) keep the press buffered (01 §6.4). */
const JUMP_STATES: ReadonlySet<MoveStateId> = new Set<MoveStateId>(['ground', 'air', 'dash', 'slide']);

/** The jump buffer is active while the last press is under 12 ticks old and unused (01 §6.4). */
export function jumpBufferActive(b: PlayerBody): boolean {
  return b.pt - b.jumpPressPt < MOVE.JUMP_BUFFER_TICKS;
}

function startJump(b: PlayerBody, vy: number, mods: MoveModifiers): void {
  // A jump from a dash or slide keeps its vx and ends it this tick (01 §6.4); the caller emits the end event.
  if (b.state === 'dash' || b.state === 'slide') endDashOrSlide(b, mods);
  b.h = MOVE.BOX_H;
  b.vy = vy;
  b.jumpCuttable = true;
  b.coyoteValid = false;
  b.grounded = false;
  b.jumpPressPt = NEVER;   // the press is used up
  setState(b, 'air', 1);
}

/**
 * §3 step 5b: tries the §6.4 jump priority if the buffer is active.
 * Returns the event of the jump that happened, or null (the press then stays buffered).
 */
export function tryJump(b: PlayerBody, _input: InputState, g: TileGrid, mods: MoveModifiers): MoveEvent | null {
  if (!jumpBufferActive(b)) return null;
  if (mods.rooted || !mods.canJump || !JUMP_STATES.has(b.state)) return null;
  // Slide-jump needs room to stand (01 §9.2); otherwise the press stays buffered.
  if (b.state === 'slide' && !standingFits(b, g)) return null;

  // 2. Ground jump: grounded, or coyote time after leaving the ground without a jump.
  if (b.grounded || (b.coyoteValid && b.pt - b.lastGroundPt <= MOVE.COYOTE_TICKS)) {
    startJump(b, MOVE.JUMP_V, mods);
    return 'jump';
  }
  // 4. Double jump.
  if (b.doubleJumpAvailable && mods.canDoubleJump) {
    startJump(b, MOVE.DOUBLE_JUMP_V, mods);
    b.doubleJumpAvailable = false;
    return 'doubleJump';
  }
  return null;
}

/** §3 step 5d / §6.3: releasing jump while rising cuts vy once. Not called on the tick a jump started. */
export function applyJumpCut(b: PlayerBody, input: InputState): void {
  if (b.state === 'air' && b.jumpCuttable && b.vy < 0 && !input.jump.held) {
    b.vy *= MOVE.JUMP_CUT;
    b.jumpCuttable = false;
  }
}
