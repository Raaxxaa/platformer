// Blueprint rolls and unlock intents (05 §14). The world owns pickup, run snapshots and saving.
import type { AbilityId, ClassId } from '../abilities/types.ts';
import type { WeaponId } from '../combat/types.ts';
import { ABILITY_IDS } from '../../data/abilities.ts';
import { S_SUFFIX } from '../../data/loot.ts';
import { BLUEPRINT_IDS, BLUEPRINT_RULES, THIRD_START_WEAPON } from '../../data/save.ts';
import { sourceRng } from './pick.ts';

export type BlueprintId = WeaponId | AbilityId;
const CATALOG: readonly BlueprintId[] = [...Object.keys(S_SUFFIX) as WeaponId[], ...ABILITY_IDS];
const LOCKED = new Set<BlueprintId>(BLUEPRINT_IDS);
const LOCKED_IN_ORDER = CATALOG.filter((id) => LOCKED.has(id));

/** Full known catalog, independent of which items are playable in this build. Returns a new snapshot. */
export function unlockedCatalog(blueprints: readonly BlueprintId[], full = false): BlueprintId[] {
  const saved = new Set(blueprints);
  return CATALOG.filter((id) => full || !LOCKED.has(id) || saved.has(id));
}

/** Dropped includes uncollected blueprints; leaving one behind cannot cause a duplicate this run. */
export function candidates(unlocked: readonly BlueprintId[], dropped: readonly BlueprintId[]): BlueprintId[] {
  const excluded = new Set([...unlocked, ...dropped]);
  return LOCKED_IN_ORDER.filter((id) => !excluded.has(id));
}

export function rollBlueprint(seed: number, levelId: string, sourceId: string | number, kind: 'elite' | 'boss',
  unlocked: readonly BlueprintId[], dropped: readonly BlueprintId[]): BlueprintId | null {
  const pool = candidates(unlocked, dropped); if (!pool.length) return null;
  const rng = sourceRng(seed, 'blueprint', levelId, sourceId);
  const chance = kind === 'elite' ? BLUEPRINT_RULES.eliteChance : BLUEPRINT_RULES.bossChance;
  return rng() < chance ? pool[Math.floor(rng() * pool.length)] : null;
}

export interface KingUnlocks { blueprint: BlueprintId | null; startWeapon: WeaponId | null }
/** The King skips the chance draw. The save owner deduplicates starting-weapon unlocks. */
export function kingUnlocks(seed: number, startClass: ClassId, currentUnlocked: readonly BlueprintId[], dropped: readonly BlueprintId[],
  seeded = false, practice = false): KingUnlocks {
  if (practice) return { blueprint: null, startWeapon: null };
  const pool = seeded ? [] : candidates(currentUnlocked, dropped);
  const blueprint = pool.length ? pool[Math.floor(sourceRng(seed, 'blueprint', 'castle', 'enemy_king')() * pool.length)] : null;
  return { blueprint, startWeapon: THIRD_START_WEAPON[startClass] };
}
