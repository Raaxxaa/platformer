// Grapple Arrow (03 §10.3): an instant rope to a grapple point, an enemy or a wall; a miss recharges in 1 s.
import { applyPull } from '../../combat/enemyReactions.ts';
import { enemyCenter, enemyHittable, enemyRect, type EnemyState } from '../../enemies/enemy.ts';
import { startForcedMove } from '../../player/forcedMove.ts';
import { startGrapplePull } from '../../player/grapple.ts';
import { setState } from '../../player/body.ts';
import type { GameWorld } from '../../sim/gameWorld.ts';
import { ticks } from '../../tuning.ts';
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility, type ActivationCtx } from '../abilitySystem.ts';
import { abilityHit, addAbilityGroup, lineOfSight, newInstance, oneTick } from '../helpers.ts';

const A = ABILITY.grappleArrow;
const OWNER = 'ability:grapple_arrow';

/** 03 §10.3 aim: up-forward 45 degrees, straight up, or horizontal toward h. Never down. */
function aimOf(c: ActivationCtx): { x: number; y: number } {
  const { moveX, moveY } = c.input;
  const h = moveX !== 0 ? moveX : c.dir;
  if (moveY === -1) return moveX !== 0 ? { x: h * A.diag, y: -A.diag } : { x: 0, y: -1 };
  return { x: h, y: 0 };
}

const angleDeg = (dx: number, dy: number, a: { x: number; y: number }): number =>
  (Math.acos(Math.max(-1, Math.min(1, (dx * a.x + dy * a.y) / (Math.hypot(dx, dy) || 1)))) * 180) / Math.PI;

const smallOrMedium = (e: EnemyState): boolean => !e.def.boss && (e.def.size === 'small' || e.def.size === 'medium');

/** The enemy hit on the activation tick; small and medium are pulled and stunned, large ones pull the player instead. */
function hookEnemy(w: GameWorld, c: ActivationCtx, e: EnemyState, speed: number, rooted: boolean): boolean {
  const b = w.body, f = b.facing;
  const stun = ticks(A.stunS * (c.linked ? A.linkedStunMult : 1));
  const g = addAbilityGroup(w, c, abilityHit(c, 'rope', c.row.damage as number), enemyRect(e), newInstance(w), { kbFromX: b.x });
  oneTick(w, g);
  if (smallOrMedium(e)) {
    const feetTo = { x: b.x + f * A.pullDx, y: b.y - e.def.hurtbox.h / 2 };
    const d = Math.hypot(feetTo.x - e.x, feetTo.y - (e.y - e.def.hurtbox.h / 2));
    g.onHit = (ww, _g, en, info) => { if (!info.killed) applyPull(ww, en, { ...feetTo, speed: Math.max(A.pullMinSpeed, d / A.pullTimeS) }, stun); };
    return true;
  }
  if (rooted) return true;                                              // the player cannot be pulled: damage only
  const ec = enemyCenter(e), bc = { x: b.x, y: b.y - b.h / 2 };
  const dist = Math.hypot(ec.x - bc.x, ec.y - bc.y);
  startForcedMove(b, { vx: 0, vy: 0, target: ec, speed, arriveDist: A.arriveDist, durationS: dist / speed + A.durationPadS, gravity: false, endOnWall: true, endVelocity: 'zero', cancelByJump: true, cancelByDash: true }, OWNER);
  // On arrival: vx = 0, vy = -150, state air.
  w.abilityEntities.push({
    id: w.newId(), kind: 'grapple_arrival',
    step: (ww) => {
      const bb = ww.body;
      if (bb.forced?.owner === OWNER) return true;
      if (bb.lastForced?.owner === OWNER && bb.lastForced.endReason === 'arrived') { bb.vx = 0; bb.vy = A.arriveVy; bb.grounded = false; setState(bb, 'air', 0); }
      return false;
    },
  });
  return true;
}

registerAbility('grapple_arrow', {
  start(w, c) {
    const b = w.body, cx = b.x, cy = b.y - b.h / 2, range = c.row.rangePx as number, speed = c.row.pullSpeed as number;
    const aim = aimOf(c), rooted = w.playerStatus.rooted > 0;
    const pullTime = (d: number) => d / speed + A.durationPadS;
    // 1. Grapple points within 35 degrees of the aim: the nearest.
    if (!rooted) {
      let best: { d: number; x: number; y: number } | null = null;
      for (const p of w.grapplePoints) {
        const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
        if (d > range || angleDeg(dx, dy, aim) > A.pointDeg || !lineOfSight(w, cx, cy, p.x, p.y)) continue;
        if (!best || d < best.d) best = { d, x: p.x, y: p.y };
      }
      if (best) { startGrapplePull(b, best, speed, pullTime(best.d), 'point'); return true; }
    }
    // 2. Enemies whose center is within 20 degrees of the aim: the nearest.
    const live = w.enemies.filter(enemyHittable);
    let foe: { d: number; e: EnemyState } | null = null;
    for (const e of live) {
      const ec = enemyCenter(e), dx = ec.x - cx, dy = ec.y - cy, d = Math.hypot(dx, dy);
      if (d > range || angleDeg(dx, dy, aim) > A.enemyDeg || !lineOfSight(w, cx, cy, ec.x, ec.y)) continue;
      if (!foe || d < foe.d || (d === foe.d && e.id < foe.e.id)) foe = { d, e };
    }
    // 3. Raycast along the aim: the first enemy hurtbox or the first solid tile.
    let wall: { x: number; y: number; d: number } | null = null;
    if (!foe) {
      let last = { x: cx, y: cy };
      for (let i = 1; i <= range; i++) {
        const x = cx + aim.x * i, y = cy + aim.y * i;
        const hit = live.find((e) => { const r = enemyRect(e); return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; });
        if (hit) { foe = { d: i, e: hit }; break; }
        if (w.grid.isSolidPx(Math.floor(x), Math.floor(y))) { wall = { ...last, d: i - 1 }; break; }
        last = { x, y };
      }
    }
    if (foe) {
      hookEnemy(w, c, foe.e, speed, rooted);
      return true;
    }
    if (wall && !rooted) { startGrapplePull(b, wall, speed, pullTime(wall.d), 'wall'); return true; }
    c.rechargeOverride = A.missRechargeTicks;                           // 4. a miss: the charge is spent, back in 1.0 s
    return true;
  },
});
