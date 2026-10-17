// Building items (05 §4): the 5-draw weapon roll, class lean, element, perk, names, and the 2-draw ability roll.
import { newAbility } from '../abilities/runtime.ts';
import type { AbilityId, AbilitySlot, ClassId } from '../abilities/types.ts';
import type { ElementId, WeaponId, WeaponInstance } from '../combat/types.ts';
import { ABILITIES, ABILITY_IDS, ABILITY_INFO } from '../../data/abilities.ts';
import { WEAPON_CLASSES } from '../../data/classes.ts';
import { ELEMENT_WEIGHTS, ELEMENT_WORD, ELEMENTS, LEAN, PERKS, S_PREFIX, S_SUFFIX, type GradeWeights } from '../../data/loot.ts';
import { WEAPONS } from '../../data/weapons.ts';
import { pick, pickGrade, type Rng } from './pick.ts';

/** 02 §14 WeaponId order. */
export const WEAPON_ORDER = Object.keys(S_SUFFIX) as WeaponId[];

// SPEC-GAP: pool limited to implemented items until M9 (the design chat's choice; not in SPEC-GAPS.md).
/** §4.2 pool: unlocked ∩ implemented, in WeaponId order, minus exclusions. */
export const weaponPool = (exclude: readonly WeaponId[] = []): WeaponId[] => WEAPON_ORDER.filter((id) => WEAPONS[id] && !exclude.includes(id));
/** §4.6 pool: unlocked ∩ implemented, in AbilityId order, minus carried and excluded. */
export const abilityPool = (carried: readonly AbilityId[], exclude: readonly AbilityId[] = []): AbilityId[] =>
  ABILITY_IDS.filter((id) => ABILITIES[id] && !carried.includes(id) && !exclude.includes(id));

export interface WeaponRollOpts { exclude?: readonly WeaponId[]; forcedElement?: ElementId }

/** §4.1: always exactly 5 draws — grade, rLean, rType, element, rPerk. */
export function rollWeapon(rng: Rng, table: GradeWeights, carried: readonly ClassId[], opts: WeaponRollOpts = {}): WeaponInstance {
  const grade = pickGrade(table, rng);
  const rLean = rng(), rType = rng();
  const pool = weaponPool(opts.exclude);
  const lean = pool.filter((id) => WEAPON_CLASSES[id].some((c) => carried.includes(c)));
  const list = carried.length && lean.length && rLean < LEAN ? lean : pool;
  const weaponId = list[Math.floor(rType * list.length)];
  const weights = weaponId === 'storm_hammer' ? ELEMENT_WEIGHTS.storm_hammer : ELEMENT_WEIGHTS.default;
  const drawn = pick(ELEMENTS.map((e, i) => [e, weights[i]] as const), rng);
  const rPerk = rng();
  const hasElement = grade === 'B' || grade === 'A' || grade === 'S';
  return {
    weaponId, grade,
    element: hasElement ? opts.forcedElement ?? drawn : null,
    perk: grade === 'A' || grade === 'S' ? PERKS[Math.floor(rPerk * PERKS.length)].id : null,
  };
}

/** §4.6: always both draws; null only if the pool is empty (the source then gives a weapon). */
export function rollAbility(rng: Rng, carriedIds: readonly AbilityId[], carried: readonly ClassId[], exclude: readonly AbilityId[] = []): AbilitySlot | null {
  const rLean = rng(), rType = rng();
  const pool = abilityPool(carriedIds, exclude);
  if (!pool.length) return null;
  const lean = pool.filter((id) => { const c = ABILITY_INFO[id].cls; return c !== null && carried.includes(c); });
  const list = carried.length && lean.length && rLean < LEAN ? lean : pool;
  return newAbility(list[Math.floor(rType * list.length)]);
}

/** §4.5 names. */
export function itemName(w: WeaponInstance): string {
  const base = w.weaponId.split('_').map((p) => p[0].toUpperCase() + p.slice(1)).join(' ');
  if (!w.element || w.grade === 'F' || w.grade === 'C') return base;
  if (w.grade === 'S') return S_PREFIX[w.element] + S_SUFFIX[w.weaponId];
  return `${ELEMENT_WORD[w.element]} ${base}`;
}
