// World hooks for the collection (09 §3–§4): first kills unlock accessories, meeting an enemy type is remembered.
// Nothing here changes the simulation; it only emits events the browser session saves.
import type { EnemyState } from '../enemies/enemy.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { noteSeen, unlockOnKill } from './unlocks.ts';

/** A player kill (`processDeaths`, after the rewards): the first kill of a type unlocks its accessory. */
export function unlockCosmeticOnKill(w: GameWorld, e: EnemyState): void {
  const id = unlockOnKill(w.cosmetics, e.def.id, e.dragon?.color);
  if (id) w.events.push({ t: 'cosmeticUnlocked', id, source: 'kill' });
}

/** Each tick: a type that has become aware of the player is "met" (04 §2.4). */
export function stepSeenEnemies(w: GameWorld): void {
  for (const e of w.enemies) if (e.aware && !e.dead && noteSeen(w.cosmetics, e.def.id)) w.events.push({ t: 'enemySeen', enemy: e.def.id });
}
