import { emptyButton, type InputState } from '../input.ts';
import type { TileGrid } from '../level/tiles.ts';
import { approach } from '../math.ts';
import { isGrounded, moveX, moveY, pushOut, type AABBBody } from '../physics/collide.ts';
import { MOVE, TERRAIN, TICK } from '../tuning.ts';
import { detachCart, NEVER, setState, type MoveEvent, type PlayerBody } from './body.ts';
import { tryStartDash } from './dash.ts';
import type { MoveModifiers } from './modifiers.ts';
import { updateSurfaces } from './surfaces.ts';
export interface MinecartState extends AABBBody {
  id: number;
  spawnX: number;
  spawnY: number;
  dir: 1 | -1;
  vx: number;
  vy: number;
  active: boolean;
  started: boolean;
  grounded: boolean;
  rider: boolean;
  tick: number;
  lastGroundTick: number;
  coyoteValid: boolean;
  jumpPressTick: number;
  jumpCuttable: boolean;
  respawnTicks: number;
}
export interface CartStop {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const createMinecart = (id: number, x: number, y: number, dir: 1 | -1): MinecartState => ({
  id, x, y, spawnX: x, spawnY: y, dir, w: TERRAIN.CART_W, h: TERRAIN.CART_H, remX: 0, remY: 0,
  vx: 0, vy: 0, active: true, started: false, grounded: false, rider: false,
  tick: 0, lastGroundTick: NEVER, coyoteValid: false, jumpPressTick: NEVER, jumpCuttable: false, respawnTicks: 0,
});
const overlap = (a: AABBBody, r: CartStop) => a.x - a.w / 2 < r.x + r.w && a.x + a.w / 2 > r.x && a.y - a.h < r.y + r.h && a.y > r.y;
function lockPlayer(c: MinecartState, b: PlayerBody): void {
  b.x = c.x;
  b.y = c.y - TERRAIN.CART_SEAT;
  b.vx = c.vx;
  b.vy = c.vy;
  b.h = TERRAIN.CART_RIDER_H;
  b.grounded = c.grounded;
  b.jumpCuttable = false;
  b.facing = c.dir;
  b.onIce = false;
}
export function boardCart(c: MinecartState, b: PlayerBody): boolean {
  if (!c.active || b.state === 'dead' || b.cartId !== null)
    return false;
  c.started = true;
  c.rider = true;
  b.cartId = c.id;
  b.airDashAvailable = b.doubleJumpAvailable = true;
  b.dashIframes = false;
  setState(b, 'minecart', 0);
  lockPlayer(c, b);
  return true;
}
export function landOnMinecart(carts: readonly MinecartState[], b: PlayerBody, from: {
  x: number;
  y: number;
}): boolean {
  if (b.cartId !== null || b.state === 'dead' || b.state === 'forced' || b.vy <= 0)
    return false;
  const cart = carts.find((c) => c.active && !c.rider && from.y <= c.y - c.h && b.y >= c.y - c.h && Math.abs(b.x - c.x) < (b.w + c.w) / 2);
  return !!cart && boardCart(cart, b);
}
/** Carts have their own unscaled clock. A rider replaces the normal player movement tick. */
export function stepMinecarts(carts: MinecartState[], b: PlayerBody, input: InputState, g: TileGrid, mods: MoveModifiers, stops: readonly CartStop[], fallingFrom?: {
  x: number;
  y: number;
}): {
  events: MoveEvent[];
  handled: boolean;
  input: InputState;
} {
  const events: MoveEvent[] = [];
  let handled = false;
  let out = input;
  for (const c of carts) {
    c.rider = b.cartId === c.id && b.state === 'minecart';
    if (!c.active) {
      c.respawnTicks -= 1;
      if (c.respawnTicks <= 0)
        Object.assign(c, createMinecart(c.id, c.spawnX, c.spawnY, c.dir));
      continue;
    }
    c.tick += 1;
    c.grounded = isGrounded(c, g, c.vy);
    if (c.grounded) {
      c.lastGroundTick = c.tick;
      c.coyoteValid = true;
    }
    if (c.rider) {
      b.pt += 1;
      b.stateTicks += 1;
      let jumped = false;
      if (input.jump.pressed)
        c.jumpPressTick = c.tick;
      if (input.dash.pressed)
        b.dashPressPt = b.pt;
      const buffered = c.tick - c.jumpPressTick < MOVE.JUMP_BUFFER_TICKS;
      if (b.pt - b.dashPressPt < MOVE.DASH_BUFFER_TICKS && mods.canDash && !mods.rooted && b.pt >= b.dashReadyPt && (c.grounded || b.airDashAvailable)) {
        detachCart(b);
        b.grounded = c.grounded;
        b.facing = c.dir;
        b.vx = c.vx;
        const event = tryStartDash(b, { ...input, moveY: 0 }, g, mods);
        if (event) {
          events.push(event);
          b.stateTicks = 0;
          b.dashPressPt = NEVER;
          out = { ...input, dash: emptyButton() };
        }
        c.rider = false;
        b.pt -= 1; // The ordinary player movement tick advances it after an exit.
      }
      else if (buffered && mods.canJump && !mods.rooted) {
        if (c.grounded || (c.coyoteValid && c.tick - c.lastGroundTick <= MOVE.COYOTE_TICKS)) {
          c.vy = TERRAIN.CART_JUMP_V;
          c.grounded = false;
          c.coyoteValid = false;
          c.jumpCuttable = true;
          c.jumpPressTick = NEVER;
          jumped = true;
          events.push('cartJump');
        }
        else if (b.doubleJumpAvailable && mods.canDoubleJump) {
          detachCart(b);
          b.vx = c.vx;
          b.vy = MOVE.DOUBLE_JUMP_V;
          b.doubleJumpAvailable = false;
          b.jumpCuttable = true;
          b.coyoteValid = false;
          b.jumpPressPt = NEVER;
          c.rider = false;
          b.pt -= 1;
          c.jumpPressTick = NEVER;
          events.push('doubleJump');
          // Ordinary stepPlayer still runs this launch tick. A fresh jump cannot be cut until the next tick.
          out = { ...input, jump: { held: true, pressed: false, released: false } };
        }
      }
      if (c.rider && !jumped && c.jumpCuttable && !input.jump.held && c.vy < 0) {
        c.vy *= MOVE.JUMP_CUT;
        c.jumpCuttable = false;
      }
    }
    if (c.started) {
      const vx = c.vx, vy = c.vy;
      c.vx = approach(c.vx, c.dir * TERRAIN.CART_MAX, TERRAIN.CART_ACCEL * TICK);
      c.vy = c.grounded && c.vy >= 0 ? 0 : Math.min(TERRAIN.CART_MAX_FALL, c.vy + TERRAIN.CART_GRAVITY * TICK);
      const wall = moveX(c, g, (vx + c.vx) / 2 * TICK, true) === 'wall';
      if (moveY(c, g, (vy + c.vy) / 2 * TICK, { dropping: false, preferDir: c.dir }) === 'bonk') {
        c.vy = 0;
        c.jumpCuttable = false;
      }
      const wasGrounded = c.grounded;
      c.grounded = isGrounded(c, g, c.vy);
      if (c.grounded) {
        c.vy = 0;
        c.lastGroundTick = c.tick;
        c.coyoteValid = true;
      }
      else if (wasGrounded)
        c.coyoteValid = true;
      if (wall || stops.some((s) => overlap(c, s))) {
        if (c.rider) {
          lockPlayer(c, b);
          detachCart(b);
          b.vx = c.vx;
          b.vy = TERRAIN.CART_THROW_V;
          b.airDashAvailable = b.doubleJumpAvailable = true;
          pushOut(b, g);
          handled = true;
        }
        c.active = false;
        c.rider = false;
        c.respawnTicks = TERRAIN.CART_RESPAWN_TICKS;
        events.push('cartCrash');
      }
    }
    if (c.rider) {
      lockPlayer(c, b);
      handled = true;
    }
  }
  if (fallingFrom && landOnMinecart(carts, b, fallingFrom)) {
    events.push('cartBoard');
    handled = true;
  }
  if (handled)
    updateSurfaces(b, g, events);
  return { events, handled, input: out };
}
