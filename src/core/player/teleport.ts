// teleport(dx, dy) (01 §12.4): Blink. Passes thin walls, never noTeleport bodies or the camera bounds.
import type { TileGrid } from '../level/tiles.ts';
import { boxFree, isGrounded } from '../physics/collide.ts';
import { detachCart, type PlayerBody } from './body.ts';

export interface TeleportResult { ok: boolean; dx: number; dy: number }
interface Rect { x: number; y: number; w: number; h: number }

function boxRect(b: PlayerBody, x: number, y: number): Rect {
  return { x: x - b.w / 2, y: y - b.h, w: b.w, h: b.h };
}
const overlaps = (a: Rect, c: Rect) => a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;

/**
 * Moves the player by up to (dx, dy). The path is clamped before any active `noTeleport` body or the camera bounds,
 * then steps back 1 px at a time toward the start until the box fits. Fails (no move) when only the start fits.
 */
export function teleport(b: PlayerBody, g: TileGrid, dx: number, dy: number, bounds: Rect): TeleportResult {
  detachCart(b);
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return { ok: false, dx: 0, dy: 0 };
  const sx = b.x, sy = b.y;
  const blockers = (g.bodies?.list ?? []).filter((x) => x.active && x.noTeleport);
  const inside = (r: Rect) => r.x >= bounds.x && r.y >= bounds.y && r.x + r.w <= bounds.x + bounds.w && r.y + r.h <= bounds.y + bounds.h;
  // 1. Clamp the line: walk forward until the box would touch a noTeleport body or leave the bounds.
  let reach = 0;
  for (let i = 1; i <= steps; i++) {
    const x = sx + Math.round((dx * i) / steps), y = sy + Math.round((dy * i) / steps);
    const r = boxRect(b, x, y);
    if (!inside(r) || blockers.some((k) => overlaps(r, k))) break;
    reach = i;
  }
  // 2. Step back toward the start until the box is free.
  for (let i = reach; i >= 1; i--) {
    const x = sx + Math.round((dx * i) / steps), y = sy + Math.round((dy * i) / steps);
    if (boxFree(g, x, y, b.w, b.h)) {
      b.x = x; b.y = y; b.remX = 0; b.remY = 0;
      b.vy = 0;
      b.grounded = isGrounded(b, g, 0);
      return { ok: true, dx: x - sx, dy: y - sy };
    }
  }
  return { ok: false, dx: 0, dy: 0 };
}
