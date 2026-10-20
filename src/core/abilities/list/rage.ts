// Rage (03 §9.3): 6.0 s of +damageBonus on every player direct hit, plus super armor. Recasting restarts it; no stacking.
import { addHitMod } from '../../combat/hitMods.ts';
import { addSuperArmor } from '../../combat/health.ts';
import type { GameWorld } from '../../sim/gameWorld.ts';
import { ticks } from '../../tuning.ts';
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility } from '../abilitySystem.ts';
import type { AbilityEntity } from '../entities.ts';

const A = ABILITY.rage;

export interface RageEntity extends AbilityEntity { kind: 'rage'; bonus: number; left: number }

export function rage(w: GameWorld): RageEntity | undefined {
  return w.abilityEntities.find((e): e is RageEntity => e.kind === 'rage');
}

addHitMod({ bonus: (w, g) => (g.owner === 'player' ? rage(w)?.bonus ?? 0 : 0) });
addSuperArmor((w) => !!rage(w));

registerAbility('rage', {
  start(w, c) {
    w.abilityEntities = w.abilityEntities.filter((e) => e.kind !== 'rage');   // restart, never stack
    const m: RageEntity = {
      id: w.newId(), kind: 'rage', bonus: (c.row.damageBonus as number) * (c.linked ? A.linkedMult : 1), left: ticks(A.durationS),
      // SPEC-GAP: "6.0 s (player ticks)": counted in player ticks, so hit-stop freezes the timer.
      step: (ww) => { if (ww.body.hitStopTicks <= 0) m.left -= 1; return m.left > 0; },
      view: () => ({ bonus: m.bonus, left: m.left }),
    };
    w.abilityEntities.push(m);
    return true;
  },
});
