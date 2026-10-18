import { MOUNTAIN as M } from '../../data/mountains.ts';
import { boxFree, isGrounded } from '../physics/collide.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { STAGE_SCALING, TICK, VIEW_H, VIEW_W } from '../tuning.ts';
import { enemyCenter, type EnemyState } from './enemy.ts';
import type { AttackHooks } from './attack.ts';
function state(e: EnemyState) { return e.mountain ??= { waypointTicks: 0, blinkTicks: 0 }; }
export function wardCandidates(w: GameWorld, shaman: EnemyState): EnemyState[] {
  const center = enemyCenter(shaman);
  return w.enemies.filter((e) => e !== shaman && !e.dead && !e.dormant && e.spawnInTicks === 0 && e.def.tier !== 'dummy' && e.def.tier !== 'target' && e.def.tier !== 'boss'
    && Math.hypot(enemyCenter(e).x - center.x, enemyCenter(e).y - center.y) <= M.wardRange)
    .sort((a, b) => Number(b.def.id === 'goblin_miner') - Number(a.def.id === 'goblin_miner') || a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id);
}
export function grantStoneWard(w: GameWorld, shaman: EnemyState): void {
  for (const e of wardCandidates(w, shaman).slice(0, M.wardTargets))
    e.ward = { hp: Math.round(M.wardBaseHP * STAGE_SCALING[w.stage].mobHp), ticks: M.wardTicks, sourceId: shaman.id };
}
/** Engaged bat movement; attack choice still uses the shared token/cooldown layer. */
export function stepMountainAi(w: GameWorld, e: EnemyState): boolean {
  if (e.def.id !== 'bat_swarm')
    return false;
  const rt = state(e);
  rt.waypointTicks -= 1;
  if (!rt.waypoint || rt.waypointTicks <= 0) {
    rt.waypoint = { x: w.body.x + M.batXMin + w.rng.enemyAI.int(M.batXMax - M.batXMin + 1), y: w.body.y - w.body.h / 2 + M.batYMin + w.rng.enemyAI.int(M.batYMax - M.batYMin + 1) };
    rt.waypointTicks = M.batWaypointTicks;
  }
  const c = enemyCenter(e), dx = rt.waypoint.x - c.x, dy = rt.waypoint.y - c.y, d = Math.hypot(dx, dy), speed = Math.min(e.def.fly!, d / TICK);
  e.vx = d ? dx / d * speed : 0;
  e.vy = d ? dy / d * speed : 0;
  return true;
}
function blinkSpot(w: GameWorld, e: EnemyState): {
  x: number;
  y: number;
} | null {
  const own = e.x >= w.body.x ? 1 : -1;
  for (const side of [own, -own]) {
    const x = w.body.x + side * M.blinkDistance;
    for (let d = 0; d <= M.blinkGroundScan; d++) {
      const y = e.y + d, box = { x, y, w: e.def.hurtbox.w, h: e.def.hurtbox.h, remX: 0, remY: 0 };
      if (x - box.w / 2 < w.camera.x || x + box.w / 2 > w.camera.x + VIEW_W || y - box.h < w.camera.y || y > w.camera.y + VIEW_H)
        continue;
      if (boxFree(w.grid, x, y, box.w, box.h) && isGrounded(box, w.grid, 0))
        return { x, y };
    }
  }
  return null;
}
/** Blink is hittable during its fade. Interruptions cancel its pending teleport. */
export function stepMountainReaction(w: GameWorld, e: EnemyState): boolean {
  if (e.def.id !== 'goblin_shaman')
    return false;
  const rt = state(e);
  if (e.dead || e.control || e.status.frozen || e.knockback) {
    rt.blinkTicks = 0;
    return false;
  }
  if (rt.blinkTicks > 0) {
    e.vx = 0;
    rt.blinkTicks -= 1;
    if (rt.blinkTicks === 0) {
      const to = blinkSpot(w, e);
      if (to) {
        e.x = to.x;
        e.y = to.y;
        e.remX = e.remY = 0;
        e.grounded = true;
      }
    }
    return true;
  }
  if (!e.aware || e.ai.attack || (e.ai.cooldowns.get('blink_away') ?? 0) > 0 || Math.abs(w.body.x - e.x) > M.blinkRange)
    return false;
  e.ai.cooldowns.set('blink_away', M.blinkCooldownTicks);
  rt.blinkTicks = M.blinkTicks;
  e.vx = 0;
  return true;
}
export function mountainAttackHooks(e: EnemyState): AttackHooks | null {
  const attack = e.ai.attack?.def;
  if (e.def.id === 'goblin_shaman' && attack?.id === 'stone_ward')
    return { onActStart: grantStoneWard };
  if (e.def.id !== 'bat_swarm' || attack?.id !== 'dive_bite')
    return null;
  return {
    onActStart(w, en) { const c = enemyCenter(en), dx = w.body.x - c.x, dy = w.body.y - w.body.h / 2 - c.y, d = Math.hypot(dx, dy) || 1; en.vx = dx / d * M.batDiveSpeed; en.vy = dy / d * M.batDiveSpeed; },
    onActTick(_w, en) { return en.hitWall; },
    onRecStart(w, en) { state(en).waypointTicks = 0; stepMountainAi(w, en); },
    onRecTick(w, en) { stepMountainAi(w, en); },
  };
}
