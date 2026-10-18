// One player movement tick, in the fixed order of 01 §3.
import type { InputState } from '../input.ts';
import type { TileGrid } from '../level/tiles.ts';
import { approach, clampAbs } from '../math.ts';
import { boxFree, isGrounded, moveX, moveY, oneWayApexSnap, pushOut } from '../physics/collide.ts';
import { MOVE, TERRAIN, TICK } from '../tuning.ts';
import { detachCart, setState, type MoveEvent, type PlayerBody } from './body.ts';
import { endDashOrSlide, standingFits, stepDashOrSlide, tryStartDash } from './dash.ts';
import { applyJumpCut, tryJump } from './jump.ts';
import { defaultModifiers, runMaxEff, type MoveContext, type MoveModifiers } from './modifiers.ts';
import { leaveWall, updateWallSlide } from './wall.ts';
import { checkLedgeGrab, stepLedgeClimb } from './ledge.ts';
import { stepDivePhases, tryStartDive } from './dive.ts';
import { forcedAfterMove, forcedTimeAndCancels, forcedVelocity } from './forcedMove.ts';
import { updateSurfaces } from './surfaces.ts';

interface Rates { accel: number; decel: number; turn: number; overspeed: number }
const GROUND_RATES: Rates = { accel: MOVE.GROUND_ACCEL, decel: MOVE.GROUND_DECEL, turn: MOVE.GROUND_TURN, overspeed: MOVE.OVERSPEED_DECAY_GROUND };
const AIR_RATES: Rates = { accel: MOVE.AIR_ACCEL, decel: MOVE.AIR_DECEL, turn: MOVE.AIR_TURN, overspeed: MOVE.OVERSPEED_DECAY_AIR };
const ICE_RATES: Rates = { accel: TERRAIN.ICE_ACCEL, decel: TERRAIN.ICE_DECEL, turn: TERRAIN.ICE_TURN, overspeed: TERRAIN.ICE_OVERSPEED };

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

/** Knockback (01 §12.2): ends any state but `minecart`/`dead`, sets the velocity, `hurt` for `stunTicks`. */
export function applyKnockback(b: PlayerBody, vx: number, vy: number, stunTicks: number, mods: MoveModifiers = defaultModifiers()): void {
  if (b.state === 'minecart' || b.state === 'dead') return;
  if (b.state === 'dash' || b.state === 'slide') endDashOrSlide(b, mods);
  if (b.state === 'wallSlide') leaveWall(b);
  if (b.forced) { b.forced.endReason = 'knockback'; b.lastForced = b.forced; b.forced = null; }   // 01 §12.2
  b.vx = vx;
  b.vy = vy;
  b.dashIframes = false;
  b.steerLockTicks = 0;
  b.jumpCuttable = false;
  if (vy < 0) {
    b.coyoteValid = false;
    b.grounded = false;
  }
  b.hurtTicks = stunTicks;
  setState(b, 'hurt', 0);
}

/** The body becomes `dead` (01 §5.4): it keeps falling and sliding but ignores input. */
export function setDead(b: PlayerBody): void {
  detachCart(b);
  b.dashIframes = false;
  b.steerLockTicks = 0;
  b.jumpCuttable = false;
  setState(b, 'dead', 0);
}

/** 01 §3 step 1: would a jump or dash pressed now be accepted? Tried on a copy of the body. */
function pressWouldAct(b: PlayerBody, input: InputState, g: TileGrid, mods: MoveModifiers): boolean {
  const trial: PlayerBody = { ...b, pt: b.pt + 1 };
  if (input.dash.pressed) {
    trial.dashPressPt = trial.pt;
    if (tryStartDash({ ...trial }, input, g, mods)) return true;
  }
  if (input.jump.pressed) {
    trial.jumpPressPt = trial.pt;
    trial.jumpPressFresh = true;
    if (tryJump(trial, input, g, mods)) return true;
  }
  return false;
}

/** Step 6: horizontal velocity by state (01 §5). Dash and slide keep their speed. */
function horizontalVelocity(b: PlayerBody, input: InputState, mods: MoveModifiers): void {
  if (b.steerLockTicks > 0) {
    // Wall-jump steering lock: vx is not changed by input, accel, decel or decay (01 §8.3).
    b.steerLockTicks -= 1;
    if (b.state === 'ground' || b.state === 'air' || b.state === 'crawl') return;
  }
  switch (b.state) {
    case 'ground': steer(b, input.moveX, runMaxEff(b, mods), b.onIce ? ICE_RATES : GROUND_RATES, mods); break;
    case 'air': steer(b, input.moveX, runMaxEff(b, mods), AIR_RATES, mods); break;
    case 'crawl': steer(b, input.moveX, runMaxEff(b, mods, MOVE.CRAWL_MAX), b.onIce ? ICE_RATES : GROUND_RATES, mods); break;
    case 'wallSlide': case 'diveWindup': case 'diveFall': case 'diveLand': b.vx = 0; break;
    case 'hurt': case 'dead':
      // Input ignored: the no-input decel for the surface (01 §5.4, §12.2).
      b.vx = approach(b.vx, 0, (b.grounded ? b.onIce ? TERRAIN.ICE_DECEL : MOVE.GROUND_DECEL : MOVE.AIR_DECEL) * TICK);
      break;
    default: break;
  }
}

/** Step 7: vertical velocity by state (01 §5.4). */
function verticalVelocity(b: PlayerBody, input: InputState, mods: MoveModifiers): void {
  switch (b.state) {
    case 'ground': case 'crawl': case 'dash': case 'slide': case 'diveWindup': case 'diveLand': b.vy = 0; break;
    case 'diveFall': b.vy = MOVE.DIVE_SPEED; break;
    case 'air': {
      const cap = b.inWater ? TERRAIN.WATER_MAX_FALL : mods.maxFallOverride ?? (input.moveY === 1 ? MOVE.MAX_FALL_DOWN_HELD : MOVE.MAX_FALL);
      b.vy = fall(b.vy, MOVE.GRAVITY * mods.gravityMult, cap);
      break;
    }
    case 'wallSlide':
      b.vy = fall(b.vy, MOVE.GRAVITY, input.moveY === 1 ? MOVE.WALL_SLIDE_MAX_DOWN_HELD : MOVE.WALL_SLIDE_MAX);
      break;
    case 'hurt': case 'dead':
      b.vy = b.grounded && b.vy >= 0 ? 0 : fall(b.vy, MOVE.GRAVITY, b.state === 'hurt' && b.inWater ? TERRAIN.WATER_MAX_FALL : MOVE.MAX_FALL);
      break;
    default: break;
  }
}

/** Landing (01 §5.5). */
function land(b: PlayerBody, ev: MoveEvent[]): void {
  b.landSpeed = b.vy;
  b.vy = 0;
  b.jumpCuttable = false;
  setState(b, 'ground', 0);
  ev.push('land');
}

/** Step 9: grounded check, landing and leaving the ground (01 §5.5), wall hits, ledge grab, wall slide, crawl. */
function afterMove(b: PlayerBody, input: InputState, g: TileGrid, mods: MoveModifiers, hitWall: boolean, ev: MoveEvent[]): boolean {
  const wasGrounded = b.grounded;
  const grounded = isGrounded(b, g, b.vy) || (b.state === 'diveLand' && b.inWater);
  b.grounded = grounded;

  let dashWallDir: -1 | 0 | 1 = 0;
  if (hitWall && (b.state === 'dash' || b.state === 'slide')) {
    // 01 §7.3 / §9.2: hitting a wall ends the dash or slide with vx = 0.
    const wasSlide = b.state === 'slide';
    if (!wasSlide) dashWallDir = b.facing;
    ev.push(endDashOrSlide(b, mods));
    b.vx = 0;
    if (wasSlide && grounded && !standingFits(b, g)) setState(b, 'crawl', 0);
    else setState(b, grounded ? 'ground' : 'air', 0);
  }

  if (grounded) {
    if (b.state === 'wallSlide') leaveWall(b);
    if (b.state === 'air' || b.state === 'wallSlide') land(b, ev);
    else if ((b.state === 'hurt' || b.state === 'dead') && !wasGrounded) {
      b.landSpeed = b.vy;
      b.vy = 0;
      ev.push('land');
    } else if (b.state === 'diveFall') {
      b.landSpeed = b.vy;
      b.vy = 0;
      setState(b, 'diveLand', 0);
      ev.push('diveLand');
    }
    b.lastGroundPt = b.pt;
    b.lastGroundY = b.y;
    if (b.state !== 'dash' && b.state !== 'slide') {
      // Standing on the ground refreshes both (a landing, or a dash that ended on the ground).
      b.airDashAvailable = true;
      b.doubleJumpAvailable = true;
    }
    if (b.state === 'crawl' && standingFits(b, g)) setState(b, 'ground', 0);
  } else {
    // Leaving the ground without a jump (walking, dashing or sliding off): coyote time starts.
    if (wasGrounded) b.coyoteValid = true;
    if (b.state === 'ground' || b.state === 'crawl' || b.state === 'diveLand') setState(b, 'air', 0);
    else if (b.state === 'slide') {
      ev.push(endDashOrSlide(b, mods));     // 01 §9.2: slide ends, vx kept
      setState(b, 'air', 0);
    }
  }

  if (checkLedgeGrab(b, input, g, mods, dashWallDir)) {
    ev.push('ledgeGrab');
    return true;
  }
  updateWallSlide(b, input, g);
  return false;
}

/** Step 10: facing follows moveX in the free-moving states unless combat locked it. */
function updateFacing(b: PlayerBody, input: InputState, mods: MoveModifiers): void {
  // Facing follows moveX even during the wall-jump steering lock; only velocity is locked (01 §8.3).
  if (mods.facingLocked || input.moveX === 0) return;
  if (b.state === 'ground' || b.state === 'air' || b.state === 'crawl') b.facing = input.moveX;
}

/** Step 10: box size. Low in slide/crawl; otherwise grows back to 12 × 28 once it fits (01 §2.2). */
function updateBox(b: PlayerBody, g: TileGrid): void {
  if (b.state === 'slide' || b.state === 'crawl') b.h = MOVE.BOX_H_LOW;
  else if (b.h !== MOVE.BOX_H && boxFree(g, b.x, b.y, MOVE.BOX_W, MOVE.BOX_H)) b.h = MOVE.BOX_H;
}

/** Runs one movement tick for the player (01 §3). Returns this tick's movement events. */
export function stepPlayer(b: PlayerBody, input: InputState, g: TileGrid, mods: MoveModifiers, ctx: MoveContext): MoveEvent[] {
  const ev: MoveEvent[] = [];
  updateSurfaces(b, g, ev);
  // 1. Hit-stop: frozen, unless a jump or dash pressed now can happen (then hit-stop ends and the move runs).
  if (b.hitStopTicks > 0) {
    if ((input.jump.pressed || input.dash.pressed) && pressWouldAct(b, input, g, mods)) {
      b.hitStopTicks = 0;
    } else {
      b.hitStopTicks -= 1;
      if (input.jump.pressed) b.jumpPressPt = b.pt;    // buffered, stamped with the frozen pt
      if (input.dash.pressed) b.dashPressPt = b.pt;
      return ev;
    }
  }
  // 2. Advance; end timed states.
  b.pt += 1;
  b.stateTicks += 1;
  if (b.state === 'hurt' && b.stateTicks > b.hurtTicks) setState(b, b.grounded ? 'ground' : 'air', 1);
  const ended = stepDashOrSlide(b, g, mods);
  if (ended) ev.push(ended);
  stepDivePhases(b);
  forcedTimeAndCancels(b, input, g, mods);
  // 3. Record presses.
  if (input.jump.pressed) {
    b.jumpPressPt = b.pt;
    b.jumpPressFresh = true;
  }
  if (input.dash.pressed) b.dashPressPt = b.pt;
  // 5. Actions.
  const dashEvent = tryStartDash(b, input, g, mods);
  if (dashEvent) ev.push(dashEvent);
  const stateBeforeJump = b.state;
  const jumpEvent = tryJump(b, input, g, mods);
  if (jumpEvent) {
    if (stateBeforeJump === 'dash') ev.push('dashEnd');
    if (stateBeforeJump === 'slide') ev.push('slideEnd');
    ev.push(jumpEvent);
  } else {
    const stateBeforeDive = b.state;
    const diveEvent = tryStartDive(b, input, ctx);
    if (diveEvent) {
      if (stateBeforeDive === 'dash') ev.push(endDashOrSlide(b, mods));
      ev.push(diveEvent);
    }
    applyJumpCut(b, input);
  }
  if (b.state === 'ledgeClimb') {
    // 6–9. The climb is scripted and skips velocity, collision and push-out (01 §10.2).
    stepLedgeClimb(b);
  } else {
    const vxStart = b.vx, vyStart = b.vy;
    // 6–7. Velocities.
    if (b.state === 'forced') forcedVelocity(b);
    else {
      horizontalVelocity(b, input, mods);
      verticalVelocity(b, input, mods);
    }
    b.vx = clampAbs(b.vx, MOVE.MAX_SPEED);
    b.vy = clampAbs(b.vy, MOVE.MAX_SPEED);
    if (b.vy >= 0) b.jumpCuttable = false;
    // 8. Move (trapezoid rule, 01 §2.4).
    const dx = ((vxStart + b.vx) / 2) * TICK;
    const dy = ((vyStart + b.vy) / 2) * TICK;
    const hitWall = moveX(b, g, dx, b.state !== 'diveFall') === 'wall';
    if (hitWall) b.vx = 0;
    const ignoresInput = b.state === 'hurt' || b.state === 'dead';
    if (moveY(b, g, dy, { dropping: jumpEvent === 'dropThrough', preferDir: ignoresInput ? 0 : input.moveX }) === 'bonk') {
      b.vy = 0;
      b.jumpCuttable = false;
    }
    if (b.state === 'air' && vyStart < 0 && b.vy >= 0) oneWayApexSnap(b, g);
    // 9. After move.
    if (b.state === 'forced') forcedAfterMove(b, g, mods, hitWall);
    else {
      const grabbed = afterMove(b, input, g, mods, hitWall, ev);
      if (!grabbed) pushOut(b, g);
    }
  }
  // 10. Facing and box (a ForcedMove keeps its box).
  updateFacing(b, input, mods);
  if (b.state !== 'forced') updateBox(b, g);
  updateSurfaces(b, g, ev);
  if (b.state === 'diveFall' && b.inWater) {
    b.landSpeed = b.vy; b.vx = 0; b.vy = 0;
    b.grounded = true; b.jumpCuttable = false;
    b.lastGroundPt = b.pt; b.lastGroundY = b.y;
    b.airDashAvailable = b.doubleJumpAvailable = true;
    setState(b, 'diveLand', 0); ev.push('diveLand');
  }
  b.jumpPressFresh = false;
  return ev;
}
