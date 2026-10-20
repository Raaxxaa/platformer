// Axis-separated, pixel-by-pixel AABB collision against the tile grid (01 §2).
import type { TileGrid } from '../level/tiles.ts';
import { COLLIDE, TILE_SIZE } from '../tuning.ts';

/** x = horizontal center, y = feet (bottom edge); both whole pixels (01 §2.1). */
export interface AABBBody { x: number; y: number; w: number; h: number; remX: number; remY: number }

export interface MoveYOpts {
  /** Ignore one-way tops this move (the tick of a drop-through). */
  dropping: boolean;
  /** Side to try first for the ceiling nudge (the input's moveX; 0 = right first). */
  preferDir: -1 | 0 | 1;
}

/** Rounds to the nearest integer, halves away from zero, so left and right are symmetric. */
export function roundHalfAwayFromZero(v: number): number {
  return v < 0 ? -Math.round(-v) : Math.round(v);
}

/** True if no solid pixel lies in [x0, x1) × [y0, y1). */
function rectFree(g: TileGrid, x0: number, y0: number, x1: number, y1: number): boolean {
  if (x1 <= x0 || y1 <= y0) return true;
  const tx0 = Math.floor(x0 / TILE_SIZE), tx1 = Math.floor((x1 - 1) / TILE_SIZE);
  const ty0 = Math.floor(y0 / TILE_SIZE), ty1 = Math.floor((y1 - 1) / TILE_SIZE);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) if (g.isSolidTile(tx, ty)) return false;
  }
  return true;
}

/** True if no solid pixel lies in [x - w/2, x + w/2) × [y - h, y). */
export function boxFree(g: TileGrid, x: number, y: number, w: number, h: number): boolean {
  return rectFree(g, x - w / 2, y - h, x + w / 2, y);
}

/** Any solid pixel in pixel row `row` across [x0, x1). */
function rowHasSolid(g: TileGrid, x0: number, x1: number, row: number): boolean {
  return !rectFree(g, x0, row, x1, row + 1);
}

/** Any one-way tile whose top pixel row is `row`, across [x0, x1) (01 §2.6). */
function rowHasOneWayTop(g: TileGrid, x0: number, x1: number, row: number): boolean {
  if (g.pixelPlatformTop(x0, x1, row)) return true;                  // a Javelin platform (02 §10.5)
  if (row % TILE_SIZE !== 0) return false;
  for (let tx = Math.floor(x0 / TILE_SIZE); tx <= Math.floor((x1 - 1) / TILE_SIZE); tx++) {
    if (g.kindAt(tx, row / TILE_SIZE) === 'oneway') return true;
  }
  return false;
}

/** Step-up (01 §2.7.2): lift by 1..4 px onto what the feet clipped. Moves the body if it works. */
function stepUp(b: AABBBody, g: TileGrid, s: number): boolean {
  for (let d = 1; d <= COLLIDE.STEP_UP_MAX; d++) {
    if (boxFree(g, b.x, b.y - d, b.w, b.h) && boxFree(g, b.x + s, b.y - d, b.w, b.h)) {
      b.y -= d;
      b.x += s;
      return true;
    }
  }
  return false;
}

/** Ceiling nudge (01 §2.7.1): shift sideways by 1..4 px so rising can continue. Moves the body if it works. */
function ceilingNudge(b: AABBBody, g: TileGrid, preferDir: -1 | 0 | 1): boolean {
  const sides = preferDir === -1 ? [-1, 1] : [1, -1];
  for (let d = 1; d <= COLLIDE.CEILING_NUDGE_MAX; d++) {
    for (const side of sides) {
      const nx = b.x + side * d;
      if (boxFree(g, nx, b.y, b.w, b.h) && boxFree(g, nx, b.y - 1, b.w, b.h)) {
        b.x = nx;
        return true;
      }
    }
  }
  return false;
}

/** Horizontal move (01 §2.4). Returns 'wall' when blocked (remX is then 0). */
export function moveX(b: AABBBody, g: TileGrid, amount: number, allowStepUp: boolean): 'free' | 'wall' {
  b.remX += amount;
  const n = roundHalfAwayFromZero(b.remX);
  b.remX -= n;
  const s = Math.sign(n);
  for (let i = 0; i < Math.abs(n); i++) {
    if (boxFree(g, b.x + s, b.y, b.w, b.h)) {
      b.x += s;
    } else if (!(allowStepUp && stepUp(b, g, s))) {
      b.remX = 0;
      return 'wall';
    }
  }
  return 'free';
}

/**
 * Vertical move (01 §2.4, §2.6, §2.7.1). 'landed' = blocked moving down; 'bonk' = blocked moving up
 * with no nudge (remY is then 0; the caller zeroes vy and jumpCuttable).
 */
export function moveY(b: AABBBody, g: TileGrid, amount: number, opts: MoveYOpts): 'free' | 'landed' | 'bonk' {
  b.remY += amount;
  const n = roundHalfAwayFromZero(b.remY);
  b.remY -= n;
  const s = Math.sign(n);
  for (let i = 0; i < Math.abs(n); i++) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2;
    if (s > 0 && (rowHasSolid(g, x0, x1, b.y) || (!opts.dropping && rowHasOneWayTop(g, x0, x1, b.y)))) {
      b.remY = 0;
      return 'landed';
    }
    if (s < 0 && rowHasSolid(g, x0, x1, b.y - b.h - 1) && !ceilingNudge(b, g, opts.preferDir)) {
      b.remY = 0;
      return 'bonk';
    }
    b.y += s;
  }
  return 'free';
}

/** Grounded check (01 §2.5): vy >= 0 and a solid or one-way top directly under the feet. */
export function isGrounded(b: AABBBody, g: TileGrid, vy: number): boolean {
  if (vy < 0) return false;
  const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2;
  return rowHasSolid(g, x0, x1, b.y) || rowHasOneWayTop(g, x0, x1, b.y);
}

/** True if everything under the feet is one-way (no solid pixel in the row under the box). */
export function supportIsOnlyOneWay(b: AABBBody, g: TileGrid): boolean {
  const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2;
  return !rowHasSolid(g, x0, x1, b.y) && rowHasOneWayTop(g, x0, x1, b.y);
}

/**
 * One-way apex assist (01 §2.7.3), for the tick vy goes from < 0 to >= 0: if the feet are 1–6 px
 * below the top of a one-way tile under the box and the box fits standing on that top, snap onto it.
 */
export function oneWayApexSnap(b: AABBBody, g: TileGrid): boolean {
  const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2;
  for (let d = 1; d <= COLLIDE.APEX_ASSIST_MAX; d++) {
    const top = b.y - d;
    if (rowHasOneWayTop(g, x0, x1, top) && boxFree(g, b.x, top, b.w, b.h)) {
      b.y = top;
      b.remY = 0;
      return true;
    }
  }
  return false;
}

/**
 * Push-out (01 §2.8): if the box overlaps a solid, move it to the first free spot trying
 * up d, left d, right d, down d for d = 1..32. Returns false if nothing is free within 32 px.
 */
export function pushOut(b: AABBBody, g: TileGrid): boolean {
  if (boxFree(g, b.x, b.y, b.w, b.h)) return true;
  for (let d = 1; d <= COLLIDE.PUSH_OUT_MAX; d++) {
    const tries: [number, number][] = [[0, -d], [-d, 0], [d, 0], [0, d]];
    for (const [dx, dy] of tries) {
      if (boxFree(g, b.x + dx, b.y + dy, b.w, b.h)) {
        b.x += dx;
        b.y += dy;
        return true;
      }
    }
  }
  return false;
}
