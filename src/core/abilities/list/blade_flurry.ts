// Blade Flurry (03 §8.3): blades orbit the body center for durationS player ticks; each blade is its own multi-hit group.
import type { GameWorld } from '../../sim/gameWorld.ts';
import { TICK_RATE, ticks } from '../../tuning.ts';
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility } from '../abilitySystem.ts';
import type { AbilityEntity } from '../entities.ts';
import { abilityHit, addAbilityGroup, newInstance } from '../helpers.ts';
import type { HitGroup } from '../../combat/hitGroups.ts';

const A = ABILITY.bladeFlurry;

export interface FlurryEntity extends AbilityEntity { kind: 'flurry'; left: number; angle: number; groups: HitGroup[] }

export function flurry(w: GameWorld): FlurryEntity | undefined {
  return w.abilityEntities.find((e): e is FlurryEntity => e.kind === 'flurry');
}
/** Blade groups in play (for the view and tests). */
export function bladeGroups(w: GameWorld): HitGroup[] {
  return w.hitGroups.filter((g) => g.ability === 'blade_flurry' && g.active);
}

registerAbility('blade_flurry', {
  start(w, c) {
    const old = flurry(w);
    if (old) for (const g of old.groups) g.active = false;                    // recasting replaces the old blades
    w.abilityEntities = w.abilityEntities.filter((e) => e.kind !== 'flurry');
    const n = c.row.blades as number;
    const m: FlurryEntity = {
      id: w.newId(), kind: 'flurry', left: ticks(c.row.durationS as number), angle: 0, groups: [],
      // The duration counts player ticks: hit-stop freezes the blades too.
      step: (ww) => {
        if (ww.body.hitStopTicks > 0) return true;
        m.left -= 1;
        m.angle += A.degPerS / TICK_RATE;
        if (m.left <= 0) { for (const g of m.groups) g.active = false; return false; }
        return true;
      },
      view: () => ({ left: m.left, angle: m.angle, blades: n }),
    };
    const place = (ww: GameWorld, k: number) => {
      const a = ((k * 360) / n + m.angle) * (Math.PI / 180), b = ww.body;
      return { x: b.x + Math.cos(a) * A.radius - A.size / 2, y: b.y - b.h / 2 + Math.sin(a) * A.radius - A.size / 2, w: A.size, h: A.size };
    };
    for (let k = 0; k < n; k++) {
      m.groups.push(addAbilityGroup(w, c, abilityHit(c, 'blade', c.row.damagePerHit as number), place(w, k), newInstance(w), {
        follow: (ww, g) => { if (!ww.abilityEntities.includes(m)) g.active = false; else g.rect = place(ww, k); },
      }));
    }
    w.abilityEntities.push(m);
    return true;
  },
});
