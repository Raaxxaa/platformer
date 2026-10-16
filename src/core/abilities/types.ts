// Class and ability data shapes (03 §14). Names copied exactly from the spec.
import type { HitSpec, WeaponId } from '../combat/types.ts';

export type ClassId = 'swordsman' | 'tank' | 'archer' | 'wizard';
export type AbilityId = 'blade_dash' | 'whirlwind' | 'blade_flurry' | 'riposte'
  | 'shockwave' | 'shoulder_charge' | 'rage' | 'boulder_toss'
  | 'arrow_rain' | 'turret' | 'grapple_arrow' | 'hunters_mark'
  | 'thunder_strike' | 'frost_burst' | 'blink' | 'time_slow' | 'vampire';
export type BondId = 'blademaster' | 'iron_will' | 'eagle_eye' | 'storm_caller';
export type HybridId = 'thief' | 'gladiator' | 'spellblade' | 'warden' | 'thunderlord' | 'arcane_archer';
export type AbilityKind = 'passive' | 'instant' | 'cast' | 'move';
export type AbilityLevel = 1 | 2 | 3 | 4 | 5;

export interface AbilityLevelRow {
  cooldownS: number;                  // 0 for vampire
  charges: 1 | 2;
  [field: string]: number | boolean;  // ability fields, named exactly as the §8–§12 table headers
}
export interface AbilityDef {
  id: AbilityId; name: string; cls: ClassId | null; kind: AbilityKind;
  startupS: number; recoveryS: number;             // §7.6; 0 for instant/move/passive
  groundMoveCap: number; airGravityMult: number; airHover: boolean;
  dashAttack: boolean;
  hits: Record<string, HitSpec>;                    // 02 §14; damage filled from the level row
  levels: [AbilityLevelRow, AbilityLevelRow, AbilityLevelRow, AbilityLevelRow, AbilityLevelRow];
}
export interface AbilitySlot { id: AbilityId; level: AbilityLevel; charges: number; rechargeLeft: number /* ticks */ }
export interface AbilityItem extends AbilitySlot { x: number; y: number }   // on the ground
export interface ClassState {
  displayClass: ClassId | null; displayName: string;
  connection: boolean; bond: BondId | null; bondName: string | null;
  hybrid: HybridId | null; carriedClasses: ClassId[];
  weaponMatched: [boolean, boolean];
}
export interface StartingKit { cls: ClassId; ability: AbilityId; weapons: [WeaponId, WeaponId] }
export interface AbilityRuntime {
  slots: [AbilitySlot | null, AbilitySlot | null];
  pressTick: [number, number];                      // −Infinity when no buffered press
  link: { fromSlot: 0 | 1; openedTick: number } | null;
  cast: { slot: 0 | 1; startTick: number; linked: boolean } | null;
  swapChoice: { itemId: string } | null;
  eagleEyeBudget: number; lockpickUsedThisStage: boolean;
  gladiatorReadyTick: number; shotPrimed: boolean; meleePrimed: boolean;
}

export type ClassEvent = 'abilityUsed' | 'abilityLinked' | 'abilityFizzle' | 'abilityNotReady'
  | 'classChanged' | 'classDiscovered' | 'riposteCounter' | 'lockpickUsed' | 'wallBroken';
