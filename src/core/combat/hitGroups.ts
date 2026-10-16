// Hit groups: world-space boxes and once-per-target bookkeeping (02 §2).
import { ticks } from '../tuning.ts';
import type { Box, HitSpec } from './types.ts';
import type { EnemyHit } from '../enemies/types.ts';

/** Axis-aligned rectangle, top-left corner, world px. */
export interface Rect { x: number; y: number; w: number; h: number }

export interface HitGroup {
  id: number;
  owner: 'player' | number;          // number = enemy id
  kind: 'melee' | 'shot';
  rect: Rect;
  spec: HitSpec;
  active: boolean;
  lastHitTick: Map<number, number>;
  hitCount: Map<number, number>;
  attackInstance: number;
  slot?: 0 | 1;
  box?: Box;                         // attached melee groups: recomputed from the owner's feet every tick
  enemyHit?: EnemyHit;               // enemy-owned groups: the attack's hit data
}

/** 02 §2.2: `box` is a center offset from the feet facing right; mirror dx when facing left. */
export function boxToWorld(box: Box, feetX: number, feetY: number, facing: 1 | -1): Rect {
  const cx = feetX + box.dx * facing;
  const cy = feetY + box.dy;
  return { x: cx - box.w / 2, y: cy - box.h / 2, w: box.w, h: box.h };
}

/** Strict overlap: touching edges do not count. */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** The union of two boxes (02 §2.3 swept box). */
export function sweep(prev: Rect, cur: Rect): Rect {
  const x = Math.min(prev.x, cur.x), y = Math.min(prev.y, cur.y);
  return { x, y, w: Math.max(prev.x + prev.w, cur.x + cur.w) - x, h: Math.max(prev.y + prev.h, cur.y + cur.h) - y };
}

/** 02 §2.3: once per target, unless `rehit` (then after `rehit` s, up to `maxHits`). */
export function canHit(g: HitGroup, targetId: number, tick: number): boolean {
  const last = g.lastHitTick.get(targetId);
  if (last === undefined) return true;
  if (g.spec.rehit === undefined) return false;
  if (g.spec.maxHits !== undefined && (g.hitCount.get(targetId) ?? 0) >= g.spec.maxHits) return false;
  return tick - last >= ticks(g.spec.rehit);
}

export function markHit(g: HitGroup, targetId: number, tick: number): void {
  g.lastHitTick.set(targetId, tick);
  g.hitCount.set(targetId, (g.hitCount.get(targetId) ?? 0) + 1);
}
