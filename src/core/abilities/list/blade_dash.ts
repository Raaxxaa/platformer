// Blade Dash (03 §8.1): a 96 px slicing dash with i-frames; separate from the normal dash.
import { ticks } from '../../tuning.ts';
import { startForcedMove } from '../../player/forcedMove.ts';
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility } from '../abilitySystem.ts';
import { abilityHit, addAbilityGroup, attachToMove, newInstance } from '../helpers.ts';
import { boxToWorld } from '../../combat/hitGroups.ts';

const A = ABILITY.bladeDash;
const OWNER = 'ability:blade_dash';

registerAbility('blade_dash', {
  start(w, c) {
    const b = w.body;
    b.facing = c.dir;
    startForcedMove(b, { vx: c.dir * A.vx, vy: 0, durationS: A.ticks / 120, gravity: false, endOnWall: true, endVelocity: 'clampToRun', cancelByJump: true, cancelByDash: true }, OWNER);
    w.health.abilityIframeTicks = Math.max(w.health.abilityIframeTicks, ticks(A.ticks / 120));
    addAbilityGroup(w, c, abilityHit(c, 'dash', c.row.damage as number), boxToWorld(A.box, b.x, b.y, b.facing), newInstance(w),
      { noPlayerStop: true, dashAttack: true, follow: attachToMove(OWNER, A.box) });
    return true;
  },
});
