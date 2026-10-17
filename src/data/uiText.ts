// UI text and colors from 07 (§3.3 class colors, §9.1 style lines, §9.2 blurbs).
import type { AbilityId, ClassId, HybridId } from '../core/abilities/types.ts';
import type { WeaponId } from '../core/combat/types.ts';

export const CLASS_COLOR: Record<ClassId | 'neutral', number> = { swordsman: 0xff5a5a, tank: 0xff9a3c, archer: 0xa8d846, wizard: 0x42d9ff, neutral: 0x9d98b0 };
export const HYBRID_COLOR: Record<HybridId, number> = {
  thief: 0xc0a8ff, gladiator: 0xff7f50, spellblade: 0xff6ad5, warden: 0xd8b060, thunderlord: 0xffe24a, arcane_archer: 0x6af0c8,
};
export const UI_COLOR = { text: 0xffffff, textDim: 0x9d98b0, panel: 0x14121c, panelBorder: 0x3a3650, good: 0x6be36b, bad: 0xff5a5a, highlight: 0xffd84a } as const;

export const CLASS_STYLE: Record<ClassId, string> = {
  swordsman: 'Blades, fast combos, precise', tank: 'Heavy hitter. Slow, huge hits, tanky', archer: 'Ranged and mobile', wizard: 'Storm magic, Thor-style',
};

export const ABILITY_BLURB: Record<AbilityId, string> = {
  blade_dash: 'Extra dash that slices through enemies', whirlwind: 'Spin forward through enemies', blade_flurry: 'Swords spin around you',
  riposte: 'Block a hit, counter with a big slash', shockwave: 'Ground slam that knocks enemies up', shoulder_charge: 'Charge forward. Breaks cracked walls',
  rage: "More damage, can't be staggered", boulder_toss: 'Rip up a boulder and throw it', arrow_rain: 'Rain arrows on the area ahead',
  turret: 'Drop a ballista that shoots for you', grapple_arrow: 'Pull yourself to walls, or enemies to you', hunters_mark: 'Marked enemies take extra damage',
  thunder_strike: 'Call lightning on enemies ahead', frost_burst: 'Freeze enemies around you', blink: 'Teleport a short way, even through thin walls',
  time_slow: 'Slow everything except you', vampire: 'Always on: kills fill the flask more',
};

export const WEAPON_BLURB: Record<WeaponId, string> = {
  greatsword: '3rd hit is a huge cleave', katana: 'Hold: dash-slash through enemies', twin_daggers: 'Crits from behind', spear: 'Attack while dashing to lunge',
  scythe: 'Kills fill the flask more', war_maul: 'Dive slam makes a shockwave', iron_fists: 'Finisher uppercut launches you', giant_axe: 'Spin attack while moving',
  flail: 'Hold: huge hit that pulls enemies', shield: 'Block. Perfect parry stuns', bow: 'Hold: charged shot pierces', crossbow: 'Bolts pin enemies to walls',
  hand_cannon: 'Knocks you backward', javelin: 'Sticks in walls. Stand on it', throwing_knives: 'Throws 3 at once',
  storm_hammer: 'Up + attack: throw it, it comes back', staff: 'Hold: big exploding orb', wand: 'Shots home in a little', spell_tome: 'Ring of spinning runes',
};

export const WEAPON_NAME = (id: WeaponId) => id.split('_').map((p) => p[0].toUpperCase() + p.slice(1)).join(' ');

/** Training Yard station names, 1–17 (docs/levels/training-yard.md), for the checklist board. */
export const TRAINING_STATION_NAMES = [
  'Run and jump', 'Double jump', 'Dash', 'Wall jump', 'Ledge grab', 'Slide and crawl', 'Drop through', 'Dive slam',
  'Combo', 'Two weapons', 'Dodge', 'Heal', 'Abilities', 'Rush', 'Dash-jump', 'Slide-jump', 'Dive bounce',
] as const;
