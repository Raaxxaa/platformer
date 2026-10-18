import { SWAMP as S } from '../../data/swamps.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { TICK } from '../tuning.ts';
import { boxFree } from '../physics/collide.ts';
import { enemyCenter, type EnemyState } from './enemy.ts';
import { lineOfSight, playerDY } from './awareness.ts';
import { supportAhead } from './body.ts';
import { cancelEnemyAttack, startEnemyAttack, type AttackHooks } from './attack.ts';
import { killEnemy } from '../combat/resolve.ts';
/** Hidden/waiting states and reactions run before ordinary AI (04 §5). */
export function stepSwampSpecial(w: GameWorld, e: EnemyState): boolean {
  const s = e.swamp;
  if (!s)
    return false;
  if (s.submerged) {
    e.vx = e.vy = 0;
    if (Math.abs(w.body.x - e.x) <= S.zombieWakeX && Math.abs(playerDY(w, e)) <= S.zombieWakeY) {
      s.submerged = false;
      startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'rise_swipe')!);
    }
    return true;
  }
  if (s.hanging) {
    e.vx = e.vy = 0;
    const wasAttacking = e.ai.attack !== null;
    if (!e.ai.attack && Math.abs(w.body.x - e.x) <= S.spiderTriggerX && w.body.y - w.body.h / 2 > enemyCenter(e).y && lineOfSight(w, e.x, e.y - e.def.hurtbox.h / 2, w.body.x, w.body.y - w.body.h / 2))
      startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'drop')!);
    return !wasAttacking;
  }
  if (s.harmlessDrop) {
    if (e.grounded) {
      s.harmlessDrop = false;
      e.aware = true;
      e.ai.state = 'engage';
      e.vy = 0;
    }
    else
      e.vy = S.spiderFall;
    return true;
  }
  if (e.def.id === 'wisp' && !e.ai.attack && e.aware) {
    stepSwampFlight(w, e);
    return false; // Its shared attack choice still runs.
  }
  if (e.def.id !== 'swamp_witch')
    return false;
  if (e.control || e.status.frozen || e.knockback || e.dead) {
    s.reactionTicks = 0;
    s.hopActive = false;
    return false;
  }
  if (s.hopActive) {
    if (e.grounded) {
      s.hopActive = false;
      e.vx = 0;
    }
    return true;
  }
  if (s.reactionTicks > 0) {
    e.vx = 0;
    s.reactionTicks -= 1;
    if (s.reactionTicks === 0) {
      const away = w.body.x >= e.x ? -1 : 1;
      e.vx = away * S.witchHopVx;
      e.vy = S.witchHopVy;
      e.grounded = false;
      s.hopActive = true;
    }
    return true;
  }
  if (!e.aware || e.ai.attack || (e.ai.cooldowns.get('hex_hop') ?? 0) > 0 || Math.abs(w.body.x - e.x) > S.witchHopRange)
    return false;
  const away = w.body.x >= e.x ? -1 : 1;
  if (!e.grounded || !supportAhead(w, e, away) || !boxFree(w.grid, e.x + away, e.y, e.def.hurtbox.w, e.def.hurtbox.h))
    return false;
  s.reactionTicks = S.witchHopTicks;
  e.ai.cooldowns.set('hex_hop', S.witchHopCooldown);
  e.vx = 0;
  return true;
}
export function stepSwampFlight(w: GameWorld, e: EnemyState): boolean {
  if (e.def.id !== 'wisp')
    return false;
  const c = enemyCenter(e), dx = w.body.x - c.x, dy = w.body.y - w.body.h / 2 - c.y, d = Math.hypot(dx, dy), speed = Math.min(e.def.fly!, d / TICK);
  e.vx = d ? dx / d * speed : 0;
  e.vy = d ? dy / d * speed : 0;
  return true;
}
export function onSwampDamaged(w: GameWorld, e: EnemyState): void {
  const s = e.swamp;
  if (!s)
    return;
  if (s.hanging) {
    s.hanging = false;
    s.harmlessDrop = true;
    cancelEnemyAttack(w, e);
    e.control = null;
    e.knockback = false;
    e.vx = 0;
    e.vy = S.spiderFall;
    e.grounded = false;
    e.aware = true;
  }
}
export function swampAttackHooks(e: EnemyState): AttackHooks | null {
  const a = e.ai.attack?.def;
  if (!a)
    return null;
  if (e.def.id === 'bog_zombie' && a.id === 'rise_swipe')
    return { onRecStart(_w, en) { en.aware = true; } };
  if (e.def.id === 'giant_spider' && a.id === 'drop')
    return {
      onActStart(_w, en) { en.swamp!.hanging = false; en.grounded = false; en.vx = 0; en.vy = S.spiderFall; en.ai.attack!.len = Number.POSITIVE_INFINITY; },
      onActTick(_w, en) { return en.grounded; }, onRecStart(_w, en) { en.vy = 0; en.aware = true; },
    };
  if (e.def.id === 'wisp' && a.id === 'detonate')
    return {
      onActStart(w, en) { en.noRewards = true; en.vx = en.vy = 0; en.swamp!.detonating = true; en.swamp!.explosionId = en.ai.attack!.groupId; const g = w.hitGroups.find((g) => g.id === en.swamp!.explosionId); if (g) {
        g.kind = 'shot';
        g.box = undefined;
      } },
      onRecStart(w, en) { w.hitGroups = w.hitGroups.filter((g) => g.id !== en.swamp!.explosionId); en.noRewards = true; killEnemy(w, en); },
    };
  if (e.def.id === 'treant' && a.id === 'root_snare')
    return { onRecStart(_w, en) { en.swamp!.marker = null; } };
  return null;
}
