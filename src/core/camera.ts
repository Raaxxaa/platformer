// Follow camera: look-ahead, air slack, fall look-down, smoothing, margins, bounds (01 §14).
// M1 covers §14.1–14.3 snapping; camera zones, the bounds blend and shake come later.
import { approach } from './math.ts';
import type { PlayerBody } from './player/body.ts';
import { CAMERA, TICK, VIEW_H, VIEW_W } from './tuning.ts';

export interface CameraBounds { x: number; y: number; w: number; h: number }

export interface CameraState {
  x: number; y: number;      // rounded top-left scroll, what the renderer uses
  cx: number; cy: number;    // unrounded view center
  anchorY: number;           // feet height the camera follows vertically
  lookX: number;             // horizontal look-ahead, px
  lookDown: number;          // fall look-down, px
  bounds: CameraBounds;
  lastPx: number; lastPy: number;   // player position last tick, for the snap distance
  shakes: { amplitude: number; remaining: number; duration: number }[];
  shakeX: number; shakeY: number;   // offset added after clamping (01 §14.4)
  shakeEnabled: boolean;            // the screen-shake setting (07)
}

const SMOOTH_X = 1 - Math.exp(-TICK / CAMERA.TAU_X);
const SMOOTH_Y = 1 - Math.exp(-TICK / CAMERA.TAU_Y);

function lookTarget(b: PlayerBody): number {
  if (Math.abs(b.vx) < CAMERA.LOOK_IDLE_SPEED) return b.facing * CAMERA.LOOK_IDLE;
  return Math.max(-CAMERA.LOOK_AHEAD_MAX, Math.min(CAMERA.LOOK_AHEAD_MAX, b.vx * CAMERA.LOOK_AHEAD_K));
}

/** Grounded, wall sliding and climbing set the anchor to the feet (01 §14.2 step 1). */
function anchorFollowsFeet(b: PlayerBody): boolean {
  return b.grounded || b.state === 'wallSlide' || b.state === 'ledgeClimb';
}

/** Clamp a center coordinate so the view stays inside [lo, lo + size); center it if the bounds are smaller. */
function clampCenter(c: number, lo: number, size: number, view: number): number {
  if (size <= view) return lo + size / 2;
  return Math.max(lo + view / 2, Math.min(lo + size - view / 2, c));
}

/** Steps 4–6: edge margins, bounds clamp, rounding. */
function finish(c: CameraState, b: PlayerBody): void {
  const halfW = VIEW_W / 2, halfH = VIEW_H / 2;
  c.cx = Math.max(b.x + b.w / 2 + CAMERA.MARGIN_X - halfW, Math.min(b.x - b.w / 2 - CAMERA.MARGIN_X + halfW, c.cx));
  c.cy = Math.max(b.y + CAMERA.MARGIN_Y - halfH, Math.min(b.y - b.h - CAMERA.MARGIN_Y + halfH, c.cy));
  c.cx = clampCenter(c.cx, c.bounds.x, c.bounds.w, VIEW_W);
  c.cy = clampCenter(c.cy, c.bounds.y, c.bounds.h, VIEW_H);
  c.x = Math.round(c.cx - halfW);
  c.y = Math.round(c.cy - halfH);
  c.lastPx = b.x;
  c.lastPy = b.y;
}

/** Places the camera on the player with no smoothing; look-ahead and look-down reset (01 §14.3). */
export function snapCamera(c: CameraState, b: PlayerBody): void {
  c.anchorY = b.y;
  c.lookX = 0;
  c.lookDown = 0;
  c.cx = b.x;
  c.cy = c.anchorY - CAMERA.FEET_OFFSET;
  finish(c, b);
}

export function createCamera(bounds: CameraBounds, b: PlayerBody): CameraState {
  const c: CameraState = { x: 0, y: 0, cx: 0, cy: 0, anchorY: b.y, lookX: 0, lookDown: 0, bounds: { ...bounds }, lastPx: b.x, lastPy: b.y,
    shakes: [], shakeX: 0, shakeY: 0, shakeEnabled: true };
  snapCamera(c, b);
  return c;
}

/** camera.shake(amplitude, seconds) (01 §14.4). */
export function shake(c: CameraState, amplitude: number, seconds: number): void {
  const n = Math.max(1, Math.round(seconds / TICK));
  c.shakes.push({ amplitude, remaining: n, duration: n });
}

/** The amplitude in use now: the largest A × remaining / duration, capped at 8 px. */
export function shakeAmplitude(c: CameraState): number {
  let a = 0;
  for (const s of c.shakes) a = Math.max(a, (s.amplitude * s.remaining) / s.duration);
  return Math.min(CAMERA.SHAKE_MAX, a);
}

/** Shake offset for this tick, then the shakes age by one tick. Draws from `rand` only while shaking. */
function stepShake(c: CameraState, rand: () => number): void {
  const amp = shakeAmplitude(c);
  if (amp > 0 && c.shakeEnabled) {
    c.shakeX = Math.round((rand() * 2 - 1) * amp);
    c.shakeY = Math.round((rand() * 2 - 1) * amp);
  } else {
    c.shakeX = 0;
    c.shakeY = 0;
  }
  for (const s of c.shakes) s.remaining -= 1;
  c.shakes = c.shakes.filter((s) => s.remaining > 0);
}

/** One camera tick, after the player's (01 §14.2). `rand` is the `cosmetic` stream (shake only). */
export function stepCamera(c: CameraState, b: PlayerBody, rand: () => number = () => 0.5): void {
  stepShake(c, rand);
  if (Math.hypot(b.x - c.lastPx, b.y - c.lastPy) > CAMERA.SNAP_DIST) {
    snapCamera(c, b);
    return;
  }
  // 1. Anchor: feet on the ground; in the air follow falls at once, rises only past the slack.
  if (anchorFollowsFeet(b) || b.y > c.anchorY) c.anchorY = b.y;
  else if (b.y < c.anchorY - CAMERA.AIR_UP_SLACK) c.anchorY = b.y + CAMERA.AIR_UP_SLACK;
  // Look-ahead and look-down move linearly toward their targets.
  c.lookX = approach(c.lookX, lookTarget(b), CAMERA.LOOK_RATE * TICK);
  // Look down only when falling fast below the last grounded height (a normal jump never dips the camera).
  const fallingBelow = b.vy >= CAMERA.LOOK_DOWN_VY && b.y > b.lastGroundY;
  const downTarget = fallingBelow || b.state === 'diveFall' ? CAMERA.LOOK_DOWN : 0;
  c.lookDown = approach(c.lookDown, downTarget, CAMERA.LOOK_DOWN_RATE * TICK);
  // 2–3. Desired center, smoothed.
  c.cx += (b.x + c.lookX - c.cx) * SMOOTH_X;
  c.cy += (c.anchorY - CAMERA.FEET_OFFSET + c.lookDown - c.cy) * SMOOTH_Y;
  // 4–6.
  finish(c, b);
}
