import type { EnemyState } from '../enemies/enemy.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { MOUNTAIN } from '../../data/mountains.ts';
import type { HitGroup } from './hitGroups.ts';
/** All direct and secondary damage reaches the barrier after final rounding (04 §4). */
export function applyEnemyDamage(e: EnemyState, damage: number): void {
  if (e.ward) {
    const absorbed = Math.min(e.ward.hp, damage);
    e.ward.hp -= absorbed;
    damage -= absorbed;
    if (e.ward.hp <= 0)
      e.ward = null;
  }
  e.hp -= damage;
}
export function enemyGuarded(w: GameWorld, g: HitGroup, e: EnemyState): boolean {
  const guard = e.def.guard;
  if(e.def.id==='stone_colossus'&&e.control?.type==='stagger')return false;
  if (!guard || e.def.noFacing)
    return false;
  if (guard.when === 'stance') {                         // Black Knight Bulwark (04 §11)
    if (!(e.kingdom && e.kingdom.bulwarkTicks > 0 && w.tick >= e.kingdom.bulwarkFrom))
      return false;
  } else if (guard.when === 'notAttacking') {
    if (e.control || e.status.frozen)
      return false;
    // Soldier: the shield is down only during its own Sword Thrust; other attacks keep it up (04 §6).
    if (guard.downDuring ? guard.downDuring.includes(e.ai.attack?.def.id ?? '') : e.ai.attack)
      return false;
  }
  if (w.dive && (w.dive.descentId === g.id || w.dive.impactId === g.id))
    return false;
  const sourceX = g.kind === 'shot' ? g.rect.x + g.rect.w / 2 : w.body.x;
  const sourceY = g.kind === 'shot' ? g.rect.y + g.rect.h / 2 : w.body.y - w.body.h / 2;
  if (guard.bypassAbove && sourceY < e.y - e.def.hurtbox.h)
    return false;
  const dx = sourceX - e.x;
  return Math.abs(dx) < MOUNTAIN.guardFrontalSlop || Math.sign(dx) === e.facing;
}
