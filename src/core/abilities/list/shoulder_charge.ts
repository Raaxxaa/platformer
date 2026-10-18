// Shoulder Charge (03 §9.2): charge with super armor; small/medium are knocked aside, large or boss stops it.
import { addSuperArmor } from '../../combat/health.ts';
import { boxToWorld } from '../../combat/hitGroups.ts';
import { endForcedMove, startForcedMove } from '../../player/forcedMove.ts';
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility } from '../abilitySystem.ts';
import { abilityHit, addAbilityGroup, attachToMove, linkedValue, newInstance } from '../helpers.ts';
import { TERRAIN, ticks } from '../../tuning.ts';
import type { GameWorld } from '../../sim/gameWorld.ts';

const A = ABILITY.shoulderCharge;
const OWNER = 'ability:shoulder_charge';

/** Called at the start of every charge tick, before player collision (03 §9.2). */
export function breakCrackedWalls(w: GameWorld, dir: 1 | -1): void {
  const b = w.body;
  const left = b.x - b.w / 2 - (dir < 0 ? TERRAIN.CHARGE_WALL_REACH : 0);
  const right = b.x + b.w / 2 + (dir > 0 ? TERRAIN.CHARGE_WALL_REACH : 0);
  for (const o of w.level?.objects ?? []) if (o.type === 'cracked_wall') {
    const id = String(o.props.id ?? `${o.type}#${o.id}`), wall = w.bodies.get(id);
    if (wall?.active && left < wall.x + wall.w && right > wall.x && b.y - b.h < wall.y + wall.h && b.y > wall.y) w.bodies.setActive(id, false);
  }
}

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
