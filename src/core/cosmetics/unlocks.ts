// Unlock bookkeeping (09 §3–§4). Pure: the world keeps one CosmeticState; the browser session writes the save on the events.
import type { EnemyId } from '../enemies/types.ts';
import { ACCESSORIES, type CosmeticId, type DragonColorId } from '../../data/cosmetics.ts';

export interface CosmeticState { owned: Set<CosmeticId>; seen: Set<EnemyId> }
export const newCosmeticState = (owned: readonly CosmeticId[] = [], seen: readonly EnemyId[] = []): CosmeticState => ({ owned: new Set(owned), seen: new Set(seen) });

const BY_ENEMY = new Map(ACCESSORIES.filter((a) => !a.dragon).map((a) => [a.enemy, a.id]));
const BY_DRAGON = new Map(ACCESSORIES.filter((a) => a.dragon).map((a) => [a.dragon!, a.id]));

/** The accessory an enemy type gives (the Dragon: one per color), or null for types that give none. */
export function accessoryFor(enemy: EnemyId, dragonColor?: DragonColorId): CosmeticId | null {
  if (enemy === 'dragon') return dragonColor ? BY_DRAGON.get(dragonColor) ?? null : null;
  return BY_ENEMY.get(enemy) ?? null;
}

/** A player kill of `enemy`: returns the newly unlocked accessory, or null (already owned, or none for this type). */
export function unlockOnKill(s: CosmeticState, enemy: EnemyId, dragonColor?: DragonColorId): CosmeticId | null {
  const id = accessoryFor(enemy, dragonColor);
  if (!id || s.owned.has(id)) return null;
  s.owned.add(id);
  return id;
}

/** An enemy type became aware of the player (04 §2.4): the collection's hints use it. True the first time. */
export function noteSeen(s: CosmeticState, enemy: EnemyId): boolean {
  if (!accessoryFor(enemy) && enemy !== 'dragon') return false;
  if (s.seen.has(enemy)) return false;
  s.seen.add(enemy);
  return true;
}
