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
  w.abilityEntities = w.abilityEntities.filter((e) => e.step(w));
}
