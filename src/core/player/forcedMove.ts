// ForcedMove (01 §12.3): dash-like ability and weapon moves. The player is in state `forced` while one runs.
import type { InputState } from '../input.ts';
import type { TileGrid } from '../level/tiles.ts';
import { isGrounded, pushOut } from '../physics/collide.ts';
import { MOVE, TERRAIN, TICK, ticks } from '../tuning.ts';
import { detachCart, setState, type PlayerBody } from './body.ts';
import { runMaxEff, type MoveModifiers } from './modifiers.ts';

export interface ForcedMove {
  vx: number; vy: number;               // px/s, constant unless gravity is true
  durationS: number;
  gravity: boolean;
  endOnWall: boolean;                   // end on horizontal collision
  target?: { x: number; y: number };    // pull toward a point instead of vx/vy (grapple)
  speed?: number;                       // with target: px/s along the line
  arriveDist?: number;                  // with target: end when center is this close (default 12)
  endVelocity: 'keep' | 'clampToRun' | 'zero';
  cancelByJump: boolean; cancelByDash: boolean;
}

/** A running ForcedMove (implementation state on the body). */
export interface ForcedRt {
  fm: ForcedMove;
  ticks: number;                        // total ticks
  /** How it ended (read by the owner on the tick it ends): 'time', 'wall', 'arrived', 'jump', 'dash', 'knockback', 'cancel'. */
  endReason: string | null;
  /** The owner's tag (ability id, weapon move) so the owner knows its move is still running. */
  owner: string;
  grapple?: { kind: 'point' | 'wall'; startX: number };
}

export const ARRIVE_DIST_DEFAULT = 12;

/** Starts a ForcedMove from combat or abilities (02 §2.1 step 3); its first movement tick is this tick's step 4. */
export function startForcedMove(b: PlayerBody, fm: ForcedMove, owner: string): void {
  detachCart(b);
  if (b.state === 'wallSlide') b.lastWallPt = b.pt;
  b.forced = { fm, ticks: Math.max(1, ticks(fm.durationS)), endReason: null, owner };
  b.dashIframes = false;
  b.vx = fm.target ? 0 : fm.vx;
  b.vy = fm.target ? 0 : fm.vy;
  setState(b, 'forced', 0);
}

/** Ends the running ForcedMove now: velocity per `endVelocity`, then ground / crawl / air. */
export function endForcedMove(b: PlayerBody, g: TileGrid, mods: MoveModifiers, reason: string): void {
  const rt = b.forced;
  if (!rt) return;
  rt.endReason = reason;
  b.forced = null;
  b.lastForced = rt;
  if (rt.grapple && (reason === 'arrived' || reason === 'wall')) {
    const point = reason === 'arrived' && rt.grapple.kind === 'point';
    const dx = rt.fm.target!.x - rt.grapple.startX;
    b.vx = point && Math.abs(dx) >= TERRAIN.GRAPPLE_ZERO_X ? TERRAIN.GRAPPLE_VX * Math.sign(dx) : 0;
    b.vy = point ? TERRAIN.GRAPPLE_VY : 0;
    b.grounded = false; b.coyoteValid = false; b.jumpCuttable = false;
    if (point) b.airDashAvailable = b.doubleJumpAvailable = true;
    setState(b, 'air', 0); return;
  }
  if (rt.fm.endVelocity === 'zero') { b.vx = 0; b.vy = 0; }
  else if (rt.fm.endVelocity === 'clampToRun') {
    const max = runMaxEff(b, mods);
    if (Math.abs(b.vx) > max) b.vx = Math.sign(b.vx) * max;
    if (!rt.fm.gravity && b.vy < 0) b.vy = 0;
  }
  if (b.state !== 'forced') return;
  const grounded = isGrounded(b, g, Math.max(0, b.vy));
  b.grounded = grounded;
  if (grounded) setState(b, b.h < MOVE.BOX_H ? 'crawl' : 'ground', 0);
  else setState(b, 'air', 0);
}

/** 01 §3 step 2: the move's time ran out; step 5: a jump or dash press cancels it (if its flag says so). */
export function forcedTimeAndCancels(b: PlayerBody, input: InputState, g: TileGrid, mods: MoveModifiers): void {
  const rt = b.forced;
  if (!rt || b.state !== 'forced') return;
  if (b.stateTicks > rt.ticks) { endForcedMove(b, g, mods, 'time'); return; }
  if (rt.fm.cancelByDash && input.dash.pressed) endForcedMove(b, g, mods, 'dash');
  else if (rt.fm.cancelByJump && input.jump.pressed) endForcedMove(b, g, mods, 'jump');
}

/** Steps 6–7 for `forced`: velocity from the move. */
export function forcedVelocity(b: PlayerBody): void {
  const rt = b.forced!;
  const fm = rt.fm;
  if (fm.target) {
    const cx = b.x, cy = b.y - b.h / 2;
    const dx = fm.target.x - cx, dy = fm.target.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    const sp = fm.speed ?? 0;
    b.vx = (dx / d) * sp;
    b.vy = (dy / d) * sp;
    return;
  }
  b.vx = fm.vx;
  b.vy = fm.gravity ? Math.min(MOVE.MAX_FALL, b.vy + MOVE.GRAVITY * TICK) : fm.vy;
}

/** Step 9 for `forced`: grounded check, wall end, arrival; no ledge grab, no wall slide, no refresh. */
export function forcedAfterMove(b: PlayerBody, g: TileGrid, mods: MoveModifiers, hitWall: boolean): void {
  const rt = b.forced;
  b.grounded = isGrounded(b, g, b.vy);
  if (b.grounded && b.vy > 0) b.vy = 0;
  if (rt && rt.fm.target) {
    const d = Math.hypot(rt.fm.target.x - b.x, rt.fm.target.y - (b.y - b.h / 2));
    if (d <= (rt.fm.arriveDist ?? ARRIVE_DIST_DEFAULT)) { endForcedMove(b, g, mods, 'arrived'); pushOut(b, g); return; }
  }
  if (rt && hitWall && rt.fm.endOnWall) {
    const wasTarget = !!rt.fm.target;
    endForcedMove(b, g, mods, 'wall');
    if (wasTarget) { b.vx = 0; b.vy = 0; }
  }
  pushOut(b, g);
}
