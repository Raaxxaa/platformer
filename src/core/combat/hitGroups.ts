// Hit groups: world-space boxes and once-per-target bookkeeping (02 §2).
import { ticks } from '../tuning.ts';
import type { Box, HitSpec } from './types.ts';
import type { EnemyHit } from '../enemies/types.ts';
import type { EnemyState } from '../enemies/enemy.ts';
import type { GameWorld } from '../sim/gameWorld.ts';

/** Axis-aligned rectangle, top-left corner, world px. */
export interface Rect { x: number; y: number; w: number; h: number }

export interface HitGroup {
  id: number;
  owner: 'player' | number;          // number = enemy id
  kind: 'melee' | 'shot';
  rect: Rect;
  /** A group made of several boxes (the Spell Tome's runes): a target is hit if any of them overlaps; `rect` is their bounds. */
  rects?: Rect[];
  spec: HitSpec;
  active: boolean;
  lastHitTick: Map<number, number>;
  hitCount: Map<number, number>;
  attackInstance: number;
  slot?: 0 | 1;
  step?: number;                     // the weapon combo step (0-based) that made it
  box?: Box;                         // attached melee groups: recomputed from the owner's feet every tick
  enemyHit?: EnemyHit;               // enemy-owned groups: the attack's hit data
  // Player groups beyond weapon swings:
  ability?: string;                  // an ability hit: skips grade and match (03 §7.8)
  bonus?: number;                    // extra additive bonus on every hit (link, Warden, Gladiator)
  dir?: 1 | -1;                      // knockback x direction (projectiles and waves: travel direction)
  kbFromX?: number;                  // knockback away from this x (explosions); default the player's x
  projectile?: number;               // the player projectile this group belongs to
  /** Overlap that is not a normal hit (an orb touching an enemy explodes instead). Returns true to skip the hit. */
  contact?: (w: GameWorld, g: HitGroup, e: EnemyState) => boolean;
  /** After a direct hit landed (pins, pulls, pierce counting...). */
  onHit?: (w: GameWorld, g: HitGroup, e: EnemyState, info: { damage: number; killed: boolean }) => void;
  /** Hit-stop on the player too? Melee groups without multiHit (02 §4.1); ability melee may opt out. */
  noPlayerStop?: boolean;
  /** Overrides the size/elite rules for a control effect (pull target point). */
  pullTo?: { x: number; y: number; speed: number };
  /** Distance its projectile (or thrown hammer) has flown; blasts keep their projectile's (Eagle Eye, 03 §5.4). */
  traveled?: number;
  /** Rush `dashAttack` (02 §8.2): Blade Dash and Shoulder Charge. */
  dashAttack?: boolean;
  /** Recomputes the rect after player movement (swept moving attacks). */
  follow?: (w: GameWorld, g: HitGroup) => void;
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

/** Does the group touch `r`: its `rect`, or any of its `rects`. */
export function groupOverlaps(g: HitGroup, r: Rect): boolean {
  return g.rects ? g.rects.some((q) => overlaps(q, r)) : overlaps(g.rect, r);
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
