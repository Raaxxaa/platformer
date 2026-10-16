// Whirlwind (03 §8.2): spin forward at 120 px/s hitting every 0.15 s; Lv5 pulls small and medium enemies in.
import { applyPull } from '../../combat/enemyReactions.ts';
import { boxToWorld } from '../../combat/hitGroups.ts';
import { enemyCenter } from '../../enemies/enemy.ts';
import { startForcedMove } from '../../player/forcedMove.ts';
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility } from '../abilitySystem.ts';
import { abilityHit, addAbilityGroup, attachToMove, newInstance } from '../helpers.ts';

const A = ABILITY.whirlwind;
const OWNER = 'ability:whirlwind';

registerAbility('whirlwind', {
  start(w, c) {
    const b = w.body;
    b.facing = c.dir;
    startForcedMove(b, { vx: c.dir * A.vx, vy: 0, durationS: c.row.durationS as number, gravity: true, endOnWall: false, endVelocity: 'clampToRun', cancelByJump: true, cancelByDash: true }, OWNER);
    const follow = attachToMove(OWNER, A.box);
    const pull = c.row.pull === true;
    addAbilityGroup(w, c, abilityHit(c, 'spin', c.row.damagePerHit as number, { maxHits: c.row.maxHits as number }), boxToWorld(A.box, b.x, b.y, b.facing), newInstance(w), {
      follow: (ww, g) => {
        follow!(ww, g);
        if (!pull || !g.active) return;
        const bb = ww.body, cx = bb.x, cy = bb.y - bb.h / 2;
        for (const e of ww.enemies) {
          if (e.dead || e.dormant) continue;
          const ec = enemyCenter(e);
          if (Math.hypot(ec.x - cx, ec.y - cy) <= A.pullRadius) applyPull(ww, e, { x: cx, y: cy, speed: A.pullSpeed });
        }
      },
    });
    return true;
  },
});
