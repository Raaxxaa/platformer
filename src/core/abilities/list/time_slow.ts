// Time Slow (03 §11.4): for durationS player ticks the world runs at x0.35 (enemies, enemy projectiles, hazards read `worldTimeScale`).
import type { GameWorld } from '../../sim/gameWorld.ts';
import { ticks } from '../../tuning.ts';
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility } from '../abilitySystem.ts';
import type { AbilityEntity } from '../entities.ts';
import { linkedValue } from '../helpers.ts';

const A = ABILITY.timeSlow;

export interface TimeSlowEntity extends AbilityEntity { kind: 'time_slow'; left: number }

export function timeSlow(w: GameWorld): TimeSlowEntity | undefined {
  return w.abilityEntities.find((e): e is TimeSlowEntity => e.kind === 'time_slow');
}

// SPEC-GAP: enemy status timers (burn, poison, chill, frozen) are not slowed yet (03 §11.4)
registerAbility('time_slow', {
  start(w, c) {
    w.abilityEntities = w.abilityEntities.filter((e) => e.kind !== 'time_slow');   // recasting restarts it; never stacks
    const m: TimeSlowEntity = {
      id: w.newId(), kind: 'time_slow', left: linkedValue(c, ticks(c.row.durationS as number)),
      step: (ww) => {
        if (ww.body.hitStopTicks <= 0) m.left -= 1;          // the duration counts player ticks
        if (m.left > 0) { ww.worldTimeScale = A.scale; return true; }
        ww.worldTimeScale = 1;
        return false;
      },
      view: () => ({ left: m.left }),
    };
    w.worldTimeScale = A.scale;
    w.abilityEntities.push(m);
    return true;
  },
});
