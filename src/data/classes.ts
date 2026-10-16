// Class tags, starting kits, bond and hybrid names and numbers (03 §2–§6).
import type { AbilityId, BondId, ClassId, HybridId, StartingKit } from '../core/abilities/types.ts';
import type { WeaponId } from '../core/combat/types.ts';

export const CLASS_IDS: readonly ClassId[] = ['swordsman', 'tank', 'archer', 'wizard'];
export const CLASS_NAME: Record<ClassId, string> = { swordsman: 'Swordsman', tank: 'Tank', archer: 'Archer', wizard: 'Wizard' };
export const NO_CLASS_NAME = 'No Class';

/** 03 §2.1: every weapon's class tags (only the Storm Hammer has two). */
export const WEAPON_CLASSES: Record<WeaponId, ClassId[]> = {
  greatsword: ['swordsman'], katana: ['swordsman'], twin_daggers: ['swordsman'], spear: ['swordsman'], scythe: ['swordsman'],
  war_maul: ['tank'], iron_fists: ['tank'], giant_axe: ['tank'], flail: ['tank'], shield: ['tank'], storm_hammer: ['tank', 'wizard'],
  bow: ['archer'], crossbow: ['archer'], hand_cannon: ['archer'], javelin: ['archer'], throwing_knives: ['archer'],
  staff: ['wizard'], wand: ['wizard'], spell_tome: ['wizard'],
};

/** 03 §3. */
export const STARTING_KITS: Record<ClassId, StartingKit> = {
  swordsman: { cls: 'swordsman', ability: 'blade_dash', weapons: ['greatsword', 'katana'] },
  tank: { cls: 'tank', ability: 'shockwave', weapons: ['war_maul', 'iron_fists'] },
  archer: { cls: 'archer', ability: 'arrow_rain', weapons: ['bow', 'crossbow'] },
  wizard: { cls: 'wizard', ability: 'thunder_strike', weapons: ['storm_hammer', 'staff'] },
};

/** 03 §4.1 bonds and hybrids. Hybrid keys are the two class ids sorted by CLASS_IDS order. */
export const BONDS: Record<ClassId, { id: BondId; name: string }> = {
  swordsman: { id: 'blademaster', name: 'Blademaster' },
  tank: { id: 'iron_will', name: 'Iron Will' },
  archer: { id: 'eagle_eye', name: 'Eagle Eye' },
  wizard: { id: 'storm_caller', name: 'Storm Caller' },
};
export const HYBRIDS: Record<string, { id: HybridId; name: string }> = {
  'swordsman+archer': { id: 'thief', name: 'Thief' },
  'swordsman+tank': { id: 'gladiator', name: 'Gladiator' },
  'swordsman+wizard': { id: 'spellblade', name: 'Spellblade' },
  'tank+archer': { id: 'warden', name: 'Warden' },
  'tank+wizard': { id: 'thunderlord', name: 'Thunderlord' },
  'archer+wizard': { id: 'arcane_archer', name: 'Arcane Archer' },
};
export const HYBRID_NAME: Record<HybridId, string> = Object.fromEntries(Object.values(HYBRIDS).map((h) => [h.id, h.name])) as Record<HybridId, string>;

/** 03 §4.3 weapon match multiplier (02 §3.1 step 3). */
export const WEAPON_MATCH_MULT = 1.25;

/** 03 §5 bonds. */
export const BOND = {
  LINK_TICKS: 360,                    // 3.0 s, inclusive
  LINK_DAMAGE_BONUS: 0.50,            // additive pool
  LINK_VALUE_MULT: 1.5,               // non-damage values
  IRON_WILL_HP: 0.30, IRON_WILL_STAGGER_MULT: 2.0,
  EAGLE_EYE_RANGE: 128, EAGLE_EYE_FALL: 60, EAGLE_EYE_BUDGET_TICKS: 120,
  STORM_CALLER_RECHARGE: 0.25, STORM_CALLER_ELEMENT_BONUS: 0.25,
} as const;

/** 03 §6 hybrids. */
export const HYBRID = {
  THIEF_SPEED: 0.20, THIEF_NOTICE_TIME_MULT: 2.0,
  GLADIATOR_BONUS: 0.50, GLADIATOR_COOLDOWN_TICKS: 180, GLADIATOR_COMBO_WINDOW_S: 0.35,
  SPELLBLADE_TICKS: 60,
  WARDEN_BONUS: 0.50,
  THUNDERLORD_DELAY_TICKS: 12, THUNDERLORD_MAX_BOLTS: 3, THUNDERLORD_DAMAGE: 0.5,
  THUNDERLORD_BOX: { dx: 0, dy: -80, w: 24, h: 160 },
  THUNDERLORD_HIT: { kb: [0, -100] as [number, number], poise: 20, hitStop: 0.05 },
  ARCANE_BLAST: { w: 64, h: 64 }, ARCANE_BLAST_DAMAGE: 0.5, ARCANE_ORB_BLAST_MULT: 1.5,
  ARCANE_BLAST_HIT: { kb: [140, -60] as [number, number], poise: 20, hitStop: 0.05 },
} as const;

/** Abilities that are playable in M4 (the rest have ids and classes only). */
export const M4_ABILITIES: readonly AbilityId[] = ['blade_dash', 'whirlwind', 'shockwave', 'shoulder_charge', 'arrow_rain', 'hunters_mark', 'thunder_strike', 'blink', 'vampire'];
