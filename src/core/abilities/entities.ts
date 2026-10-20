// Ability entities (03 §1 "world ticks"): zones, delayed bolts, marks. Each one ticks itself every world tick.
import type { GameWorld } from '../sim/gameWorld.ts';

export interface AbilityEntity {
  id: number;
  kind: string;
  /** One world tick. Return false when the entity is done. */
  step(w: GameWorld): boolean;
  /** For the view and tests. */
  view?(): Record<string, unknown>;
}

export function stepAbilityEntities(w: GameWorld): void {
  // Ability groups that switched off (their move ended) go; one-tick groups go with the blasts.
  w.hitGroups = w.hitGroups.filter((g) => !(g.ability !== undefined && !g.active));
  // An entity may spawn new ones while it steps (Boulder Toss shards): they join the list and first step next tick.
  const cur = w.abilityEntities, n = cur.length;
  const kept = cur.filter((e) => e.step(w));
  w.abilityEntities = kept.concat(cur.slice(n));
}
