// Frost Burst (03 §11.2): a cast; on its effect tick a 2r x 2r box around the body center hits, then freezes each enemy hit.
import { addHitMod } from '../../combat/hitMods.ts';
import type { HitGroup } from '../../combat/hitGroups.ts';
import { ELEMENT, ticks } from '../../tuning.ts';
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility } from '../abilitySystem.ts';
import { abilityHit, addAbilityGroup, newInstance, oneTick } from '../helpers.ts';

const A = ABILITY.frostBurst;

/** What each Frost Burst group freezes with (set on the effect tick). */
const FREEZE = new WeakMap<HitGroup, { seconds: number; level: 1 | 2 | 3 }>();

// Freezing happens after the damage, so the burst never shatters its own targets.
addHitMod({
  afterHit(_w, g, e, info) {
    const f = FREEZE.get(g);
    if (!f || info.killed) return;
    const s = e.status, boss = e.def.tier === 'boss';
    if (boss || s.freezeImmune > 0) {
      const raw = ELEMENT.ICE.scale[A.chillLevel - 1], scale = boss ? 1 - (1 - raw) / 2 : raw;
      s.chill = { scale: Math.min(scale, s.chill?.scale ?? 1), left: ticks(ELEMENT.ICE.chillS) };
      return;
    }
    const left = ticks(f.seconds * (e.def.elite ? A.eliteMult : 1));
    s.frozen = { left: Math.max(left, s.frozen?.left ?? 0), level: f.level };
    s.frost.stacks = 0;
    e.vx = 0;
  },
});

registerAbility('frost_burst', {
  effect(w, c) {
    const b = w.body, r = c.row.radiusPx as number;
    const g = addAbilityGroup(w, c, abilityHit(c, 'burst', c.row.damage as number), { x: b.x - r, y: b.y + A.dy - r, w: 2 * r, h: 2 * r }, newInstance(w), { kbFromX: b.x });
    FREEZE.set(g, { seconds: (c.row.freezeS as number) * (c.linked ? A.linkedFreezeMult : 1), level: c.row.freezeLevel as 1 | 2 | 3 });
    oneTick(w, g);
  },
});
