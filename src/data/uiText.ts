// UI text and colors from 07 (§3.3 class colors, §9.1 style lines, §9.2 blurbs).
import type { AbilityId, ClassId, HybridId } from '../core/abilities/types.ts';
import type { Grade, WeaponId } from '../core/combat/types.ts';

export const CLASS_COLOR: Record<ClassId | 'neutral', number> = { swordsman: 0xff5a5a, tank: 0xff9a3c, archer: 0xa8d846, wizard: 0x42d9ff, neutral: 0x9d98b0 };
export const HYBRID_COLOR: Record<HybridId, number> = {
  thief: 0xc0a8ff, gladiator: 0xff7f50, spellblade: 0xff6ad5, warden: 0xd8b060, thunderlord: 0xffe24a, arcane_archer: 0x6af0c8,
};
/** 07 §3.1 palette. */
export const UI_COLOR = {
  ink: 0x0d0b14, panel: 0x1b1826, panelBorder: 0x4a4560, text: 0xf2efe6, textDim: 0x9d98b0, textOff: 0x5c5870, slotEmpty: 0x3a3648,
  good: 0x5ce06a, bad: 0xff4a4a, highlight: 0xffd34a,
} as const;
/** 07 §3.2 grade colors. */
export const GRADE_COLOR: Record<Grade, number> = { F: 0x9b9ba6, C: 0x5ad16a, B: 0x4a9dff, A: 0xb264ff, S: 0xffc93c };

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
/** 07 §3.1 tokens added for the full HUD. */
export const HUD_COLOR = {
  hp: 0xe5404a, hpLow: 0xff7080, flask: 0xff8fa0, rush: [0xffd34a, 0xffa83a, 0xff5a3a], curse: 0xd0306a, dimAlpha: 0.55,
} as const;

/** 07 §9.2 bond and hybrid blurbs (pause LOADOUT tab). */
export const BOND_BLURB: Record<string, string> = {
  Blademaster: 'Every 3rd hit crits. Kills reset your dash', 'Iron Will': '+30% max HP. No knockback while attacking',
  'Eagle Eye': 'Long shots always crit. Fall slowly while aiming', 'Storm Caller': 'Abilities recharge 25% faster. Stronger elements',
};
export const HYBRID_BLURB: Record<HybridId, string> = {
  thief: 'Faster and sneakier. Sneak hits crit. Open 1 chest free per stage', gladiator: 'Switching weapons keeps your combo and hits harder',
  spellblade: 'Melee hits shorten ability cooldowns', warden: 'Melee hits power up your next shot, and shots power up your next melee hit',
  thunderlord: 'Heavy hits call lightning', arcane_archer: 'Arrows carry lightning. Charged shots explode',
};
/** 07 §8.1 actions and their default keys, for the read-only CONTROLS tab. */
export const CONTROLS_LIST: readonly [string, string][] = [
  ['Left', 'A / ←'], ['Right', 'D / →'], ['Up', 'W / ↑'], ['Down', 'S / ↓'], ['Jump', 'Space'], ['Dash', 'Shift'],
  ['Attack 1', 'J'], ['Attack 2', 'K'], ['Ability 1', 'U'], ['Ability 2', 'I'], ['Heal', 'Q'], ['Interact', 'E'],
  ['Restart (hold)', 'R'], ['Pause', 'Esc / P'],
];

/** 07 §9.3 Lucky Block line 2 (values are 05's). */
export const LUCKY_LINE: Record<import('./loot.ts').LuckyId, string> = {
  swift: '+25% move speed this stage', golden_touch: 'Double gold from enemies this stage', firestarter: 'All your hits burn this stage',
  second_wind: 'Revive once with half HP this stage', overdrive: "Rush can't drop below level 2 this stage", bloodrush: 'Kills fill the flask double this stage',
  jackpot: 'A rare weapon drops!',
  heavy: '−20% move speed for 45 s', glass_bones: 'Take double damage for 45 s', leaky_pockets: 'Drop gold when hit for 45 s',
  ambush: 'Enemies all around you!', jammed: 'Dash cooldown doubled for 45 s', dry_flask: "Can't drink the flask for 45 s",
  butterfingers: 'Weapon 2 locked for 45 s',
};
/** 07 §9.3 curse lines. */
export const CURSE_LINE: Record<import('./loot.ts').CurseId, string> = {
  one_hit: 'You die in one hit until 10 kills', no_heal: "Can't drink the flask until 10 kills",
  heavy_feet: 'No double jump until 10 kills', hunted: 'Enemies are faster until 10 kills',
};
/** 07 §4.7, §6.8, §6.10 loot HUD timings (s). */
export const LOOT_HUD = {
  debuffBlinkS: 5, blinkHz: 4,
  bannerS: { lucky: 1.6, curse: 2.0, lifted: 1.2 },
  toastS: { keysFull: 2.0, lockpick: 2.0, purchase: 1.5 },
} as const;
