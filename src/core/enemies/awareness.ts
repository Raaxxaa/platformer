// Noticing the player: sight, the notice timer, alert reaction and spread (04 §2.4).
import type { GameWorld } from '../sim/gameWorld.ts';
import { ENEMY, ticks } from '../tuning.ts';
import { enemyCenter, type EnemyState } from './enemy.ts';

/** dY = player hurtbox center y − enemy hurtbox center y (negative = player above). */
export function playerDY(w: GameWorld, e: EnemyState): number {
  return (w.body.y - w.body.h / 2) - enemyCenter(e).y;
}

/** Line of sight over solid tiles (one-way tiles never block), stepping the tile grid. */
export function lineOfSight(w: GameWorld, x0: number, y0: number, x1: number, y1: number): boolean {
  const dist = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const steps = Math.max(1, Math.ceil(dist / ENEMY.LOS_STEP));
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps, y = y0 + ((y1 - y0) * i) / steps;
    if (w.grid.isSolidPx(Math.floor(x), Math.floor(y))) return false;
  }
  return true;
}

/** 04 §2.4 "can see": range (half behind), vertical range, line of sight from the eye. */
export function canSee(w: GameWorld, e: EnemyState): boolean {
  const b = w.body;
  const n = e.def.notice;
  const dx = b.x - e.x;
  const behind = !e.def.noFacing && dx !== 0 && Math.sign(dx) === -e.facing;
  const range = n.range * w.noticeRangeMult * (behind ? 0.5 : 1);
  if (Math.abs(dx) > range) return false;
  if (Math.abs(playerDY(w, e)) > n.rangeY * w.noticeRangeMult) return false;
  return lineOfSight(w, e.x, e.y - e.def.hurtbox.h + 6, b.x, b.y - b.h / 2);
}

/** Becomes aware: shares with its group, spreads to unaware enemies within 128 px after 0.3 s. */
export function becomeAware(w: GameWorld, e: EnemyState, byHit: boolean): void {
  if (e.aware) return;
  e.aware = true;
  e.noticeT = 0;
  e.ai.pendingAwareAt = -1;
  e.ai.lostTicks = 0;
  if (!byHit && !e.ai.attack) {
    e.ai.state = 'alert';
    e.ai.t = 0;
    e.vx = 0;
    if (w.body.x !== e.x) e.facing = w.body.x > e.x ? 1 : -1;
  } else if (!e.ai.attack) {
    e.ai.state = 'engage';
  }
  const c = enemyCenter(e);
  for (const o of w.enemies) {
    if (o === e || o.dead || o.aware) continue;
    if (e.spawn.group && o.spawn.group === e.spawn.group) { becomeAware(w, o, false); continue; }
    const oc = enemyCenter(o);
    if (o.ai.pendingAwareAt < 0 && Math.hypot(oc.x - c.x, oc.y - c.y) <= ENEMY.ALERT_SPREAD_RANGE) o.ai.pendingAwareAt = w.tick + ENEMY.ALERT_SPREAD_TICKS;
  }
}

/** One enemy-time tick of noticing. */
export function stepAwareness(w: GameWorld, e: EnemyState): void {
  if (e.aware || e.def.tier === 'dummy') return;
  if (e.ai.pendingAwareAt >= 0 && w.tick >= e.ai.pendingAwareAt) { becomeAware(w, e, false); return; }
  if (canSee(w, e)) e.noticeT += 1;
  else e.noticeT = Math.max(0, e.noticeT - 1);
  if (e.noticeT >= ticks(e.def.notice.time * w.noticeTimeMult)) becomeAware(w, e, false);
}
