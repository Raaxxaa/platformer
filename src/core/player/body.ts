// The player's movement body, states and events (01 §15).
import type { AABBBody } from '../physics/collide.ts';
import { MOVE } from '../tuning.ts';

export type MoveStateId = 'ground' | 'air' | 'dash' | 'slide' | 'crawl' | 'wallSlide' | 'ledgeClimb'
  | 'diveWindup' | 'diveFall' | 'diveLand' | 'hurt' | 'forced' | 'minecart' | 'dead';

export type MoveEvent = 'jump' | 'doubleJump' | 'wallJump' | 'land' | 'dashStart' | 'dashEnd'
  | 'slideStart' | 'slideEnd' | 'ledgeGrab' | 'diveStart' | 'diveLand' | 'diveBounce'
  | 'spikeHit' | 'enterWater' | 'exitWater' | 'cartBoard' | 'cartJump' | 'cartCrash'
  | 'platformShake' | 'platformCollapse' | 'dropThrough';

/** "Never happened" stamp for press and wall times. */
export const NEVER = -1000;

export interface PlayerBody extends AABBBody {
  x: number; y: number; remX: number; remY: number;   // 01 §2.1
  vx: number; vy: number;
  w: 12; h: 28 | 20 | 14;
  facing: 1 | -1;
  state: MoveStateId; stateTicks: number; pt: number;
  grounded: boolean; inWater: boolean; onIce: boolean;
  airDashAvailable: boolean; doubleJumpAvailable: boolean; jumpCuttable: boolean;
  coyoteValid: boolean; lastGroundPt: number; jumpPressPt: number; jumpPressFresh: boolean;
  dashPressPt: number; dashReadyPt: number; lastWallPt: number; lastWallDir: 1 | -1;
  steerLockTicks: number; dashIframes: boolean; preDashSpeed: number;
  // Implementation fields beyond 01 §15:
  hitStopTicks: number;   // player hit-stop (02); always 0 until M2
  landSpeed: number;      // impact speed of the last landing, for the 'land' event's listeners
}

export function createPlayerBody(x: number, y: number): PlayerBody {
  return {
    x, y, remX: 0, remY: 0, vx: 0, vy: 0, w: MOVE.BOX_W, h: MOVE.BOX_H, facing: 1,
    state: 'ground', stateTicks: 0, pt: 0,
    grounded: true, inWater: false, onIce: false,
    airDashAvailable: true, doubleJumpAvailable: true, jumpCuttable: false,
    coyoteValid: false, lastGroundPt: NEVER, jumpPressPt: NEVER, jumpPressFresh: false,
    dashPressPt: NEVER, dashReadyPt: 0, lastWallPt: NEVER, lastWallDir: 1,
    steerLockTicks: 0, dashIframes: false, preDashSpeed: 0,
    hitStopTicks: 0, landSpeed: 0,
  };
}

/** Enters a state. States entered at §3 step 5 count their first tick as 1; at step 9, the next tick is 1. */
export function setState(b: PlayerBody, s: MoveStateId, stateTicks: number): void {
  b.state = s;
  b.stateTicks = stateTicks;
}
