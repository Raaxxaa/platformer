// Shoulder Charge (03 §9.2): charge with super armor; small/medium are knocked aside, large or boss stops it.
import { addSuperArmor } from '../../combat/health.ts';
import { boxToWorld } from '../../combat/hitGroups.ts';
import { endForcedMove, startForcedMove } from '../../player/forcedMove.ts';
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility } from '../abilitySystem.ts';
import { abilityHit, addAbilityGroup, attachToMove, linkedValue, newInstance } from '../helpers.ts';
import { ticks } from '../../tuning.ts';
import type { GameWorld } from '../../sim/gameWorld.ts';

const A = ABILITY.shoulderCharge;
const OWNER = 'ability:shoulder_charge';

/** Cracked walls (06) break here once a stage has them; M4 stages have none. */
export function breakCrackedWalls(_w: GameWorld, _dir: 1 | -1): void {}

addSuperArmor((w) => w.body.forced?.owner === OWNER);

registerAbility('shoulder_charge', {
  start(w, c) {
    const b = w.body;
    b.facing = c.dir;
    startForcedMove(b, { vx: c.dir * A.vx, vy: 0, durationS: (c.row.ticks as number) / 120, gravity: false, endOnWall: true, endVelocity: 'clampToRun', cancelByJump: true, cancelByDash: true }, OWNER);
    breakCrackedWalls(w, c.dir);
    const stun = c.row.stunS as number;
    const spec = abilityHit(c, 'charge', c.row.damage as number, stun > 0 ? { control: { type: 'stun', duration: linkedValue(c, ticks(stun)) / 120 } } : {});
    addAbilityGroup(w, c, spec, boxToWorld(A.box, b.x, b.y, b.facing), newInstance(w), {
      noPlayerStop: true, dashAttack: true, dir: c.dir, follow: attachToMove(OWNER, A.box),
      onHit: (ww, g, e) => {
        if (e.def.size !== 'large' && e.def.size !== 'boss') return;
        // A large enemy or boss ends the charge at once with vx = 0.
        if (ww.body.forced?.owner === OWNER) endForcedMove(ww.body, ww.grid, ww.mods, 'hit');
        ww.body.vx = 0;
        g.active = false;
      },
    });
    return true;
  },
});
