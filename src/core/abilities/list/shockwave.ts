// Shockwave (03 §9.1): a cast; on its effect tick a 2R × 44 slam around the feet that launches.
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility } from '../abilitySystem.ts';
import { abilityHit, addAbilityGroup, newInstance, oneTick } from '../helpers.ts';

const A = ABILITY.shockwave;

registerAbility('shockwave', {
  effect(w, c) {
    const b = w.body, R = c.row.R as number;
    oneTick(w, addAbilityGroup(w, c, abilityHit(c, 'slam', c.row.damage as number), { x: b.x - R, y: b.y + A.dy - A.h / 2, w: 2 * R, h: A.h }, newInstance(w), { kbFromX: b.x }));
  },
});
