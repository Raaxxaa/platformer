// Thunder Strike (03 §11.1): bolts every 0.1 s on enemies ahead (nearest first), or on fixed columns.
import { enemyCenter, enemyRect, type EnemyState } from '../../enemies/enemy.ts';
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility } from '../abilitySystem.ts';
import { abilityHit, addAbilityGroup, lineOfSight, newInstance, oneTick } from '../helpers.ts';

const A = ABILITY.thunderStrike;

registerAbility('thunder_strike', {
  effect(w, c) {
    const b = w.body, f = b.facing, x = b.x, feet = b.y, cy = b.y - b.h / 2;
    const live = (e: EnemyState) => !e.dead && !e.dormant;
    const cands = w.enemies.filter((e) => {
      if (!live(e)) return false;
      const ec = enemyCenter(e), ahead = (ec.x - x) * f;
      return ahead >= 0 && ahead <= A.reach && Math.abs(ec.y - cy) <= A.vReach && lineOfSight(w, x, cy, ec.x, ec.y);
    }).sort((a, z) => Math.abs(enemyCenter(a).x - x) - Math.abs(enemyCenter(z).x - x) || a.id - z.id);
    const bolts = c.row.bolts as number;
    const spec = abilityHit(c, 'bolt', c.row.damagePerBolt as number);
    const born = w.tick;
    let k = 0;
    const strike = (ww: typeof w) => {
      let target: EnemyState | null = null;
      if (cands.length) {
        for (let i = 0; i < cands.length && !target; i++) { const e = cands[(k + i) % cands.length]; if (live(e)) target = e; }
      }
      let bx: number, bottom: number;
      if (target) { bx = enemyCenter(target).x; bottom = enemyRect(target).y + enemyRect(target).h; }
      else {
        bx = x + f * (A.colStart + A.colStep * k);
        bottom = feet;
        for (let d = 0; d <= A.colDrop; d++) if (ww.grid.isSolidPx(Math.floor(bx), feet + d)) { bottom = feet + d; break; }
      }
      oneTick(ww, addAbilityGroup(ww, c, spec, { x: bx - A.box.w / 2, y: bottom - A.box.h, w: A.box.w, h: A.box.h }, newInstance(ww), { kbFromX: bx }));
      k += 1;
    };
    strike(w);                                               // bolt 0 on the effect tick
    if (bolts <= 1) return;
    w.abilityEntities.push({
      id: w.newId(), kind: 'thunder_strike',
      step: (ww) => {
        const t = ww.tick - born;                            // world ticks since the effect tick
        if (t > 0 && t % A.boltTicks === 0) strike(ww);
        return k < bolts;
      },
    });
  },
});
