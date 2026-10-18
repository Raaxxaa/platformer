import { SPIDERLING_RULES as S } from '../../data/spiderlings.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import type { EnemyState } from './enemy.ts';

/** Spawn-in summons count toward the cap. Dead summons and another Queen's brood do not. */
export function livingSpiderlings(w: GameWorld, queen: EnemyState): EnemyState[] {
  return w.enemies.filter((e) => e.def.id === 'spiderling' && e.summonOwner === queen.id && !e.dead);
}

export function spawnBrood(w: GameWorld, queen: EnemyState): EnemyState[] {
  if (queen.dead) return [];
  let room = S.maxAlive - livingSpiderlings(w, queen).length;
  const brood: EnemyState[] = [];
  for (const offset of S.offsets) {
    if (room <= 0) break;
    const x = queen.x + offset;
    const e = w.spawnExtra({ enemy: 'spiderling', x, y: queen.y, facing: w.body.x < x ? -1 : 1 });
    e.summonOwner = queen.id; e.noRewards = true; e.aware = true; e.ai.state = 'engage'; e.spawnInTicks = S.spawnInTicks;
    brood.push(e); room -= 1;
  }
  return brood;
}
