// Class state: a pure function of the two ability slots and the two weapon slots (03 §4).
import type { AbilityId, ClassId, ClassState } from '../abilities/types.ts';
import type { WeaponId } from '../combat/types.ts';
import { ABILITY_INFO } from '../../data/abilities.ts';
import { BONDS, CLASS_IDS, CLASS_NAME, HYBRIDS, NO_CLASS_NAME, WEAPON_CLASSES } from '../../data/classes.ts';

export function computeClassState(abilities: readonly (AbilityId | null)[], weapons: readonly (WeaponId | null)[] = [null, null]): ClassState {
  const A: ClassId[] = [];
  for (const id of abilities) {
    const c = id ? ABILITY_INFO[id]?.cls ?? null : null;
    if (c) A.push(c);
  }
  const carried = CLASS_IDS.filter((c) => A.includes(c));
  let displayClass: ClassId | null = null, bond: ClassState['bond'] = null, bondName: string | null = null, hybrid: ClassState['hybrid'] = null;
  let displayName = NO_CLASS_NAME, connection = false;
  if (A.length === 1 || (A.length === 2 && A[0] === A[1])) {
    displayClass = A[0];
    displayName = CLASS_NAME[A[0]];
    if (A.length === 2) { connection = true; bond = BONDS[A[0]].id; bondName = BONDS[A[0]].name; }
  } else if (A.length === 2) {
    const h = HYBRIDS[`${carried[0]}+${carried[1]}`];
    hybrid = h.id;
    displayName = h.name;
  }
  const matched = (w: WeaponId | null) => !!w && WEAPON_CLASSES[w].some((c) => carried.includes(c));
  return {
    displayClass, displayName, connection, bond, bondName, hybrid, carriedClasses: carried,
    weaponMatched: [matched(weapons[0] ?? null), matched(weapons[1] ?? null)],
  };
}

/** Did the visible class change (03 §4.4: `classChanged` fires on displayName, bond or hybrid)? */
export function classChanged(a: ClassState, b: ClassState): boolean {
  return a.displayName !== b.displayName || a.bond !== b.bond || a.hybrid !== b.hybrid;
}
