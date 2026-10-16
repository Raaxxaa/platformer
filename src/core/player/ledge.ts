// Automatic ledge grab and climb (01 §10).
import type { InputState } from '../input.ts';
import type { TileGrid } from '../level/tiles.ts';
import { boxFree } from '../physics/collide.ts';
import { MOVE, TILE_SIZE } from '../tuning.ts';
import { setState, type PlayerBody } from './body.ts';
import type { MoveModifiers } from './modifiers.ts';

/** True if any solid pixel lies in [x0, x1) × [y0, y1). */
function rectBlocked(g: TileGrid, x0: number, y0: number, x1: number, y1: number): boolean {
  return !boxFree(g, (x0 + x1) / 2, y1, x1 - x0, y1 - y0);
}

/** A grabbable ledge on `side`: the wall face column F and the ledge top L, or null (01 §10.1 checks 4–5). */
function findLedge(b: PlayerBody, g: TileGrid, side: 1 | -1): { face: number; top: number } | null {
  // Check 4: a wall within 0–2 px at any row of the box …
  const firstOutside = side > 0 ? b.x + b.w / 2 : b.x - b.w / 2 - 1;
  let tx = -1;
  for (let d = 0; d <= MOVE.LEDGE_GRAB_GAP && tx < 0; d++) {
    const col = firstOutside + side * d;
    if (rectBlocked(g, col, b.y - b.h, col + 1, b.y)) tx = Math.floor(col / TILE_SIZE);
  }
  if (tx < 0) return null;
  // … with a ledge: a solid tile whose top L is 5–24 px above the feet and has no solid tile on top.
  let top = -1;
  for (let ty = Math.ceil((b.y - MOVE.LEDGE_WINDOW_MAX) / TILE_SIZE); ty * TILE_SIZE <= b.y - MOVE.LEDGE_WINDOW_MIN; ty++) {
    if (g.isSolidTile(tx, ty) && !g.isSolidTile(tx, ty - 1)) top = ty * TILE_SIZE;
  }
  if (top < 0) return null;
  const face = side > 0 ? tx * TILE_SIZE : (tx + 1) * TILE_SIZE;
  // Check 5: room for the hang, the climb path and the standing spot, and the snapped box is free.
  const back = MOVE.LEDGE_ROOM_BACK, fwd = MOVE.LEDGE_ROOM_FORWARD;
  const [rx0, rx1] = side > 0 ? [face - back, face + fwd] : [face - fwd, face + back];
  if (rectBlocked(g, rx0, top - MOVE.BOX_H, rx1, top)) return null;
  if (!boxFree(g, face - side * (MOVE.BOX_W / 2), b.y, MOVE.BOX_W, MOVE.BOX_H)) return null;
  return { face, top };
}

/**
 * §3 step 9 ledge grab check (01 §10.1). `dashWallDir` is the dash's direction if a dash hit
 * a wall this tick, else 0. On a grab the body snaps to the wall and enters `ledgeClimb`.
 */
export function checkLedgeGrab(b: PlayerBody, input: InputState, g: TileGrid, mods: MoveModifiers, dashWallDir: -1 | 0 | 1 = 0): boolean {
  if (!(b.state === 'air' || b.state === 'wallSlide' || dashWallDir !== 0)) return false;
  if (b.vy < 0 || mods.rooted) return false;
  const side = dashWallDir !== 0 ? dashWallDir : input.moveX;
  if (side === 0) return false;
  const ledge = findLedge(b, g, side);
  if (!ledge) return false;

  b.x = ledge.face - side * (MOVE.BOX_W / 2);
  b.vx = 0;
  b.vy = 0;
  b.remX = 0;
  b.remY = 0;
  b.h = MOVE.BOX_H;
  b.facing = side;
  b.grounded = false;
  b.climbFromX = b.x;
  b.climbFromY = b.y;
  b.climbTop = ledge.top;
  b.climbStandX = ledge.face + side * MOVE.LEDGE_STAND_OFFSET;
  setState(b, 'ledgeClimb', 0);
  return true;
}

/** Finishing the climb is a landing on the ledge: standing spot, `ground`, both refreshes. */
export function finishClimb(b: PlayerBody): void {
  b.x = b.climbStandX;
  b.y = b.climbTop;
  b.vx = 0;
  b.vy = 0;
  b.grounded = true;
  b.lastGroundPt = b.pt;
  b.lastGroundY = b.y;
  b.airDashAvailable = true;
  b.doubleJumpAvailable = true;
  setState(b, 'ground', 1);
}

/** The climb's scripted motion, no collision checks (01 §10.2): up for 12 ticks, then over for 6. */
export function stepLedgeClimb(b: PlayerBody): void {
  const k = b.stateTicks;
  const up = MOVE.LEDGE_CLIMB_UP_TICKS, over = MOVE.LEDGE_CLIMB_OVER_TICKS;
  if (k <= up) {
    b.y = Math.round(b.climbFromY + ((b.climbTop - b.climbFromY) * k) / up);
  } else {
    b.y = b.climbTop;
    b.x = Math.round(b.climbFromX + ((b.climbStandX - b.climbFromX) * (k - up)) / over);
  }
  if (k >= up + over) finishClimb(b);
}
