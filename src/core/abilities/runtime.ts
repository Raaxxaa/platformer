// The player's ability runtime (03 §14) and loadouts (kits, 03 §3).
import type { WeaponInstance } from '../combat/types.ts';
import { ABILITIES } from '../../data/abilities.ts';
import { STARTING_KITS } from '../../data/classes.ts';
import { THIRD_START_WEAPON } from '../../data/save.ts';
import type { AbilityId, AbilityLevel, AbilityRuntime, AbilitySlot, ClassId } from './types.ts';
import type { WeaponId } from '../combat/types.ts';

export const NO_PRESS = -Infinity;

export function createAbilityRuntime(slots: [AbilitySlot | null, AbilitySlot | null]): AbilityRuntime {
  return {
    slots, pressTick: [NO_PRESS, NO_PRESS], link: null, cast: null, swapChoice: null,
    eagleEyeBudget: 0, lockpickUsedThisStage: false, gladiatorReadyTick: -100000, shotPrimed: false, meleePrimed: false,
  };
}

/** A fresh ability at `level` with full charges (03 §7.1). */
export function newAbility(id: AbilityId, level: AbilityLevel = 1): AbilitySlot {
  const def = ABILITIES[id];
  return { id, level, charges: def ? def.levels[level - 1].charges : 1, rechargeLeft: 0 };
}

/** A C-grade weapon with no element or perk (M4: every weapon). */
export function newWeapon(id: WeaponId): WeaponInstance {
  return { weaponId: id, grade: 'C', element: null, perk: null };
}

export interface Loadout {
  weapons: [WeaponInstance | null, WeaponInstance | null];
  abilities: [AbilitySlot | null, AbilitySlot | null];
}

/** The M2 test loadout: Greatsword + War Maul, no abilities. */
export function defaultLoadout(): Loadout {
  return { weapons: [newWeapon('greatsword'), newWeapon('war_maul')], abilities: [null, null] };
}

/** 03 §3: the starting ability at Lv1 in slot 1, the picked weapon at C in slot 1. */
export function kitLoadout(cls: ClassId, weapon: WeaponId): Loadout {
  const kit = STARTING_KITS[cls];
  if (!kit.weapons.includes(weapon) && THIRD_START_WEAPON[cls] !== weapon) throw new Error(`${weapon} is not a ${cls} starting weapon`);
  return { weapons: [newWeapon(weapon), null], abilities: [newAbility(kit.ability), null] };
}

export function cloneLoadout(l: Loadout): Loadout {
  return { weapons: [l.weapons[0] && { ...l.weapons[0] }, l.weapons[1] && { ...l.weapons[1] }], abilities: [l.abilities[0] && { ...l.abilities[0] }, l.abilities[1] && { ...l.abilities[1] }] };
}
