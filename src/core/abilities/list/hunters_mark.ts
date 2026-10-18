// Hunter's Mark (03 §10.4): mark the highest-HP enemies in range; player damage to them ×1.30 (linked ×1.45).
import { enemyCenter, enemyHittable } from '../../enemies/enemy.ts';
import { addHitMod } from '../../combat/hitMods.ts';
import type { GameWorld } from '../../sim/gameWorld.ts';
import { ticks } from '../../tuning.ts';
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility } from '../abilitySystem.ts';
import type { AbilityEntity } from '../entities.ts';

const A = ABILITY.hunterMark;

export interface MarkEntity extends AbilityEntity { kind: 'mark'; enemyId: number; mult: number; left: number }

export function marks(w: GameWorld): MarkEntity[] {
  return w.abilityEntities.filter((e): e is MarkEntity => e.kind === 'mark');
}

addHitMod({ targetMult: (w, _g, e) => marks(w).find((m) => m.enemyId === e.id)?.mult ?? 1 });

registerAbility('hunters_mark', {
  start(w, c) {
    const b = w.body, cx = b.x, cy = b.y - b.h / 2, r = c.row.radiusPx as number;
    const list = w.enemies
      .filter((e) => enemyHittable(e) && Math.hypot(enemyCenter(e).x - cx, enemyCenter(e).y - cy) <= r)
      .map((e) => ({ e, d: Math.hypot(enemyCenter(e).x - cx, enemyCenter(e).y - cy) }))
      .sort((a, z) => z.e.hp - a.e.hp || a.d - z.d || a.e.id - z.e.id);
    if (!list.length) return false;                           // fizzle: nothing spent
    w.abilityEntities = w.abilityEntities.filter((e) => e.kind !== 'mark');
    const mult = c.linked ? A.linkedMult : A.mult;
    for (const { e } of list.slice(0, c.row.marks as number)) {
      const m: MarkEntity = {
        id: w.newId(), kind: 'mark', enemyId: e.id, mult, left: ticks(c.row.durationS as number),
        step: (ww) => {
          m.left -= 1;
          const en = ww.enemies.find((x) => x.id === m.enemyId);
          return m.left > 0 && !!en && !en.dead;
        },
        view: () => ({ enemyId: m.enemyId, left: m.left }),
      };
      w.abilityEntities.push(m);
    }
    return true;
  },
});
