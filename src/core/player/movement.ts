// One player movement tick, in the fixed order of 01 §3.
import type { InputState } from '../input.ts';
import type { TileGrid } from '../level/tiles.ts';
import { isGrounded, moveX, moveY, pushOut } from '../physics/collide.ts';
import { approach, clampAbs } from '../math.ts';
import { MOVE, TICK } from '../tuning.ts';
import { setState, type MoveEvent, type PlayerBody } from './body.ts';
import { runMaxEff, type MoveContext, type MoveModifiers } from './modifiers.ts';
import { applyJumpCut, tryJump } from './jump.ts';

interface Rates { accel: number; decel: number; turn: number; overspeed: number }
const GROUND_RATES: Rates = { accel: MOVE.GROUND_ACCEL, decel: MOVE.GROUND_DECEL, turn: MOVE.GROUND_TURN, overspeed: MOVE.OVERSPEED_DECAY_GROUND };
const AIR_RATES: Rates = { accel: MOVE.AIR_ACCEL, decel: MOVE.AIR_DECEL, turn: MOVE.AIR_TURN, overspeed: MOVE.OVERSPEED_DECAY_AIR };

/** 01 §5.3 horizontal rules for `ground`, `air` and `crawl`. */
function steer(b: PlayerBody, dir: -1 | 0 | 1, max: number, r: Rates, mods: MoveModifiers): void {
  if (mods.rooted) b.vx = 0;
  else if (dir === 0) b.vx = approach(b.vx, 0, r.decel * TICK);
  else if (Math.sign(b.vx) === -dir) b.vx = approach(b.vx, dir * max, r.turn * TICK);
  else if (Math.abs(b.vx) > max) b.vx = approach(b.vx, dir * max, r.overspeed * TICK);
  else b.vx = approach(b.vx, dir * max, r.accel * TICK);
}

/** Gravity toward `cap`; above the cap, vy drops to it at FALL_CAP_DECEL (01 §5.4). */
function fall(vy: number, gravity: number, cap: number): number {
  if (vy > cap) return Math.max(cap, vy - MOVE.FALL_CAP_DECEL * TICK);
  return Math.min(cap, vy + gravity * TICK);
}

/** Step 6: horizontal velocity by state (01 §5). */
function horizontalVelocity(b: PlayerBody, input: InputState, mods: MoveModifiers): void {
  switch (b.state) {
    case 'ground': steer(b, input.moveX, runMaxEff(b, mods), GROUND_RATES, mods); break;
    case 'air': steer(b, input.moveX, runMaxEff(b, mods), AIR_RATES, mods); break;
    default: break;
  }
}

/** Step 7: vertical velocity by state (01 §5.4). */
function verticalVelocity(b: PlayerBody, input: InputState, mods: MoveModifiers): void {
  switch (b.state) {
    case 'ground': b.vy = 0; break;
    case 'air': {
      const cap = mods.maxFallOverride ?? (input.moveY === 1 ? MOVE.MAX_FALL_DOWN_HELD : MOVE.MAX_FALL);
      b.vy = fall(b.vy, MOVE.GRAVITY * mods.gravityMult, cap);
      break;
    }
    default: break;
  }
}

/** Landing (01 §5.5). */
function land(b: PlayerBody, ev: MoveEvent[]): void {
  b.landSpeed = b.vy;
  b.vy = 0;
  b.airDashAvailable = true;
  b.doubleJumpAvailable = true;
  b.jumpCuttable = false;
  setState(b, 'ground', 0);
  ev.push('land');
}

/** Step 9: grounded check, landing and leaving the ground (01 §5.5). */
function afterMove(b: PlayerBody, g: TileGrid, ev: MoveEvent[]): void {
  const grounded = isGrounded(b, g, b.vy);
  if (grounded) {
    if (b.state === 'air') land(b, ev);
    b.lastGroundPt = b.pt;
  } else if (b.state === 'ground') {
    setState(b, 'air', 0);
    b.coyoteValid = true;
  }
  b.grounded = grounded;
}

/** Step 10: facing follows moveX in the free-moving states unless combat locked it. */
function updateFacing(b: PlayerBody, input: InputState, mods: MoveModifiers): void {
  if (mods.facingLocked || input.moveX === 0) return;
  if (b.state === 'ground' || b.state === 'air') b.facing = input.moveX;
}

/** Runs one movement tick for the player (01 §3). Returns this tick's movement events. */
export function stepPlayer(b: PlayerBody, input: InputState, g: TileGrid, mods: MoveModifiers, _ctx: MoveContext): MoveEvent[] {
  const ev: MoveEvent[] = [];
  // 1. Hit-stop: arrives with combat in M2 (hitStopTicks stays 0).
  // 2. Advance.
  b.pt += 1;
  b.stateTicks += 1;
  // 3. Record presses.
  if (input.jump.pressed) {
    b.jumpPressPt = b.pt;
    b.jumpPressFresh = true;
  }
  // 5. Actions (velocities after them are the "start" velocities of the trapezoid move).
  const jumpEvent = tryJump(b, input, g, mods);
  if (jumpEvent) ev.push(jumpEvent);
  else applyJumpCut(b, input);
  const vxStart = b.vx, vyStart = b.vy;
  // 6–7. Velocities.
  horizontalVelocity(b, input, mods);
  verticalVelocity(b, input, mods);
  b.vx = clampAbs(b.vx, MOVE.MAX_SPEED);
  b.vy = clampAbs(b.vy, MOVE.MAX_SPEED);
  if (b.vy >= 0) b.jumpCuttable = false;
  // 8. Move (trapezoid rule, 01 §2.4).
  const dx = ((vxStart + b.vx) / 2) * TICK;
  const dy = ((vyStart + b.vy) / 2) * TICK;
  if (moveX(b, g, dx, true) === 'wall') b.vx = 0;
  if (moveY(b, g, dy, { dropping: false, preferDir: input.moveX }) === 'bonk') {
    b.vy = 0;
    b.jumpCuttable = false;
  }
  // 9. After move.
  afterMove(b, g, ev);
  pushOut(b, g);
  // 10. Facing and box.
  updateFacing(b, input, mods);
  b.jumpPressFresh = false;
  return ev;
}
