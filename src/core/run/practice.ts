// Practice mode rules (06 §14). Pure: the Phaser layer supplies the save and the random pick.
import type { ClassId } from '../abilities/types.ts';
import { newAbility, newWeapon, kitLoadout, type Loadout } from '../abilities/runtime.ts';
import type { WeaponId } from '../combat/types.ts';
import { STARTING_KITS } from '../../data/classes.ts';
import { THIRD_START_WEAPON } from '../../data/save.ts';
import { PRACTICE_DRAGON, PRACTICE_ELEMENT, PRACTICE_LEVELS, PRACTICE_PRESET, PRACTICE_STAGE, type PracticeDragon, type PracticeLevelId } from '../../data/practice.ts';
import { DRAGON_ROLL } from '../../data/run.ts';
import type { DragonRoll } from './dragonRoll.ts';

export interface PracticeSetup { levelId: PracticeLevelId; cls: ClassId; weapon: WeaponId; dragon: PracticeDragon }
export type PracticeKey = `${PracticeLevelId}|${ClassId}`;
export const practiceKey = (levelId: PracticeLevelId, cls: ClassId): PracticeKey => `${levelId}|${cls}`;

/** `plains` is always available; the rest come from `levelsReached` (06 §14). Always in the menu's order. */
export function practiceLevels(levelsReached: readonly string[]): PracticeLevelId[] {
  return PRACTICE_LEVELS.filter((id) => id === 'plains' || levelsReached.includes(id));
}
/** The class's starting weapons: 2, or 3 once the third is unlocked. */
export function practiceWeapons(cls: ClassId, unlocked: Partial<Record<ClassId, readonly string[]>>): WeaponId[] {
  const list: WeaponId[] = [...STARTING_KITS[cls].weapons];
  if (unlocked[cls]?.includes(THIRD_START_WEAPON[cls])) list.push(THIRD_START_WEAPON[cls]);
  return list;
}
/** The Dragon option only exists for Stages 2 and 3 (07 §7.4). */
export const dragonAllowed = (levelId: PracticeLevelId): boolean => PRACTICE_STAGE[levelId] === 2 || PRACTICE_STAGE[levelId] === 3;

/** The fixed loadout for a stage (06 §14 table): kit weapon + kit ability, slot 2 empty. */
export function practiceLoadout(setup: PracticeSetup): Loadout {
  const p = PRACTICE_PRESET[PRACTICE_STAGE[setup.levelId]];
  const base = kitLoadout(setup.cls, setup.weapon);
  const weapon = newWeapon(setup.weapon); weapon.grade = p.grade; weapon.element = p.elemental ? PRACTICE_ELEMENT[setup.cls] : null;
  return { weapons: [weapon, null], abilities: [newAbility(base.abilities[0]!.id, p.abilityLevel), null] };
}
/** The Dragon in the side arena, or null when off or not a Stage 2 or 3 level. `pick` is a 0..1 roll for `random`. */
export function practiceDragon(setup: PracticeSetup, pick: number): DragonRoll | null {
  if (setup.dragon === 'off' || !dragonAllowed(setup.levelId)) return null;
  const colors = DRAGON_ROLL.colors;
  const color = setup.dragon === 'random' ? colors[Math.min(colors.length - 1, Math.floor(pick * colors.length))] : setup.dragon;
  return { present: true, stage: PRACTICE_STAGE[setup.levelId] as 2 | 3, color, outcome: 'absent' };
}
/** A faster time replaces the best (06 §14). Returns the new best and whether it changed. */
export function applyPracticeTime(bests: Record<string, number>, key: PracticeKey, ticks: number): { best: number; isNew: boolean } {
  const old = bests[key];
  if (old === undefined || ticks < old) { bests[key] = ticks; return { best: ticks, isNew: true }; }
  return { best: old, isNew: false };
}
export const isPracticeDragon = (v: string): v is PracticeDragon => (PRACTICE_DRAGON as readonly string[]).includes(v);
