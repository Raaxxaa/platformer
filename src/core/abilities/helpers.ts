// Shared pieces for ability files (03 §7.8): hit groups that skip grade and match, the link bonus, attached boxes.
import { boxToWorld, type HitGroup, type Rect } from '../combat/hitGroups.ts';
import type { Box, HitSpec } from '../combat/types.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { BOND } from '../../data/classes.ts';
import type { ActivationCtx } from './abilitySystem.ts';

/** The ability's hit spec with this level's damage. */
export function abilityHit(c: ActivationCtx, key: string, damage: number, extra: Partial<HitSpec> = {}): HitSpec {
  return { ...c.def.hits[key], damage, ...extra };
}

/** A fresh attack instance (shared with weapons: Rush, the hit streak and hybrids count instances). */
export function newInstance(w: GameWorld): number {
  return w.combat.nextAttackInstance++;
}

/** An ability hit group: kind from the spec, link bonus +0.50 (03 §5.1), no grade or match. */
export function addAbilityGroup(w: GameWorld, c: ActivationCtx, spec: HitSpec, rect: Rect, instance: number, extra: Partial<HitGroup> = {}): HitGroup {
  const g: HitGroup = {
    id: w.newId(), owner: 'player', kind: spec.kind, rect, spec, active: true, lastHitTick: new Map(), hitCount: new Map(),
    attackInstance: instance, ability: c.ability.id, bonus: c.linked ? BOND.LINK_DAMAGE_BONUS : 0, ...extra,
  };
  w.hitGroups.push(g);
  return g;
}

/** A box attached to the player for as long as this ability's ForcedMove runs; then the group switches off. */
export function attachToMove(owner: string, box: Box): HitGroup['follow'] {
  return (w, g) => {
    const b = w.body;
    if (b.forced?.owner !== owner) { g.active = false; return; }
    g.rect = boxToWorld(box, b.x, b.y, b.facing);
  };
}

/** A one-tick group (03: "active 1 tick"): it is cleared with the blasts at the next step 6. */
export function oneTick(w: GameWorld, g: HitGroup): HitGroup {
  w.blasts.push(g.id);
  return g;
}

/** Non-damage values of a linked activation are ×1.5, rounded (03 §5.1). */
export function linkedValue(c: ActivationCtx, v: number): number {
  return c.linked ? Math.round(v * BOND.LINK_VALUE_MULT) : v;
}

/** LOS (03 §1): the segment crosses no solid tile and no active non-one-way solid body (sampled every px). */
export function lineOfSight(w: GameWorld, x0: number, y0: number, x1: number, y1: number): boolean {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    if (w.grid.isSolidPx(Math.floor(x), Math.floor(y))) return false;
  }
  return true;
}
