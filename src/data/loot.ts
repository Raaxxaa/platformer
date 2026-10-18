// Loot numbers from 05: grade odds (§3), element weights (§4.3), perks (§4.4), names (§4.5), Lucky Block (§7),
// curses (§8), Ambush packs (§7.5).
import type { ElementId, Grade, WeaponId } from '../core/combat/types.ts';
import type { EnemyId } from '../core/enemies/types.ts';

export type StageIndex = 1 | 2 | 3 | 4;
export type GradeWeights = Record<Grade, number>;
export const GRADES: readonly Grade[] = ['F', 'C', 'B', 'A', 'S'];
const row = (F: number, C: number, B: number, A: number, S: number): GradeWeights => ({ F, C, B, A, S });

export const GRADE_ODDS: Record<'free' | 'key' | 'cursed', Record<StageIndex, GradeWeights>> = {
  free: { 1: row(50, 35, 10, 4, 1), 2: row(30, 38, 20, 9, 3), 3: row(12, 32, 33, 18, 5), 4: row(0, 15, 37, 36, 12) },
  key: { 1: row(35, 38, 18, 7, 2), 2: row(15, 41, 28, 12, 4), 3: row(0, 32, 41, 21, 6), 4: row(0, 3, 45, 39, 13) },
  cursed: { 1: row(0, 20, 50, 25, 5), 2: row(0, 3, 60, 30, 7), 3: row(0, 0, 52, 39, 9), 4: row(0, 0, 27, 57, 16) },
};
export const FIXED_ODDS: Record<'dragon' | 'jackpot' | 'blackKnight', GradeWeights> = {
  dragon: row(0, 0, 0, 75, 25), jackpot: row(0, 0, 0, 85, 15), blackKnight: row(0, 0, 60, 31, 9),
};

export const ELEMENTS: readonly ElementId[] = ['fire', 'ice', 'lightning', 'poison', 'wind'];
/** §4.3, order fire, ice, lightning, poison, wind. */
export const ELEMENT_WEIGHTS = { default: [20, 20, 20, 20, 20], storm_hammer: [15, 15, 40, 15, 15] } as const;
/** 02 §6.1: element level from grade. */
export const ELEMENT_LEVEL: Partial<Record<Grade, 1 | 2 | 3>> = { B: 1, A: 2, S: 3 };

/** §4.2 / §4.6 class lean chance. */
export const LEAN = 0.35;
/** §5.1 'any' loot spot: ability chance; §5.2 key chest item B ability chance. */
export const ANY_ABILITY_CHANCE = 0.35;
export const KEY_CHEST_ABILITY_CHANCE = 0.5;
/** §5.2 item offsets from the chest x. */
export const KEY_CHEST_ITEM_DX = 16;

export type PerkId = 'quick' | 'keen' | 'brutal' | 'finisher' | 'leeching' | 'fleet' | 'sturdy' | 'greedy';
export interface PerkDef { id: PerkId; name: string; scope: 'weapon' | 'carried'; value: number }
/** §4.4, in table order (rPerk × 8 indexes it). Finisher's threshold is FINISHER_HP. */
export const PERKS: readonly PerkDef[] = [
  { id: 'quick', name: 'Quick', scope: 'weapon', value: 0.15 },
  { id: 'keen', name: 'Keen', scope: 'weapon', value: 0.12 },
  { id: 'brutal', name: 'Brutal', scope: 'weapon', value: 0.15 },
  { id: 'finisher', name: 'Finisher', scope: 'weapon', value: 0.40 },
  { id: 'leeching', name: 'Leeching', scope: 'weapon', value: 40 },
  { id: 'fleet', name: 'Fleet', scope: 'carried', value: 0.08 },
  { id: 'sturdy', name: 'Sturdy', scope: 'carried', value: 0.90 },
  { id: 'greedy', name: 'Greedy', scope: 'weapon', value: 50 },
];
export const FINISHER_HP = 0.30;

/** §4.5 names. */
export const ELEMENT_WORD: Record<ElementId, string> = { fire: 'Fire', ice: 'Ice', lightning: 'Lightning', poison: 'Poison', wind: 'Wind' };
export const S_PREFIX: Record<ElementId, string> = { fire: 'Sun', ice: 'Frost', lightning: 'Sky', poison: 'Venom', wind: 'Gale' };
export const S_SUFFIX: Record<WeaponId, string> = {
  greatsword: 'breaker', katana: 'fang', twin_daggers: 'sting', spear: 'piercer', scythe: 'reaper', war_maul: 'quake',
  iron_fists: 'fist', giant_axe: 'cleaver', flail: 'star', shield: 'ward', bow: 'bow', crossbow: 'bolt', hand_cannon: 'roar',
  javelin: 'lance', throwing_knives: 'shard', storm_hammer: 'splitter', staff: 'spire', wand: 'spark', spell_tome: 'rune',
};

export type LuckyId = 'swift' | 'golden_touch' | 'firestarter' | 'second_wind' | 'overdrive' | 'bloodrush' | 'jackpot'
  | 'heavy' | 'glass_bones' | 'leaky_pockets' | 'ambush' | 'jammed' | 'dry_flask' | 'butterfingers';
export interface LuckyDef { id: LuckyId; kind: 'buff' | 'debuff'; weight: number; duration: 'stage' | 'instant' | number; name: string }
/** §7.2–7.3, in table order. */
export const LUCKY: readonly LuckyDef[] = [
  { id: 'swift', kind: 'buff', weight: 15, duration: 'stage', name: 'Swift' },
  { id: 'golden_touch', kind: 'buff', weight: 15, duration: 'stage', name: 'Golden Touch' },
  { id: 'firestarter', kind: 'buff', weight: 15, duration: 'stage', name: 'Firestarter' },
  { id: 'second_wind', kind: 'buff', weight: 15, duration: 'stage', name: 'Second Wind' },
  { id: 'overdrive', kind: 'buff', weight: 15, duration: 'stage', name: 'Overdrive' },
  { id: 'bloodrush', kind: 'buff', weight: 15, duration: 'stage', name: 'Bloodrush' },
  { id: 'jackpot', kind: 'buff', weight: 10, duration: 'instant', name: 'Jackpot' },
  { id: 'heavy', kind: 'debuff', weight: 1, duration: 5400, name: 'Heavy' },
  { id: 'glass_bones', kind: 'debuff', weight: 1, duration: 5400, name: 'Glass Bones' },
  { id: 'leaky_pockets', kind: 'debuff', weight: 1, duration: 5400, name: 'Leaky Pockets' },
  { id: 'ambush', kind: 'debuff', weight: 1, duration: 'instant', name: 'Ambush' },
  { id: 'jammed', kind: 'debuff', weight: 1, duration: 5400, name: 'Jammed' },
  { id: 'dry_flask', kind: 'debuff', weight: 1, duration: 5400, name: 'Dry Flask' },
  { id: 'butterfingers', kind: 'debuff', weight: 1, duration: 5400, name: 'Butterfingers' },
];
/** §7.1 buff chance; with Lucky Charm (M7). */
export const LUCKY_BUFF_CHANCE = { base: 0.55, luckyCharm: 0.70 } as const;
/** §7.2–7.3 effect numbers. */
export const LUCKY_FX = {
  swiftSpeed: 0.25, heavySpeed: -0.20, glassBonesMult: 2, goldenTouchMult: 2, bloodrushMult: 2, overdriveFloor: 200,
  secondWindHpFrac: 0.5, secondWindIframeS: 2.0, jammedDashMult: 2, firestarterBurnLevel: 1,
} as const;

export type CurseId = 'one_hit' | 'no_heal' | 'heavy_feet' | 'hunted';
/** §8: `EXTRA_CURSES` off in v1 (the curse is always one_hit). */
export const EXTRA_CURSES = false;
export const CURSE_WEIGHTS: Record<CurseId, number> = { one_hit: 40, no_heal: 20, heavy_feet: 20, hunted: 20 };
export const CURSE_KILLS = 10;

/** §7.5 Ambush packs and placement. */
export const AMBUSH_PACKS: Record<string, EnemyId[]> = {
  plains: ['wolf', 'wolf', 'bandit'],
  mountains: ['goblin_miner','ram','bat_swarm'],
  swamps: ['bog_zombie','giant_spider','swamp_witch'],
} as Record<string, EnemyId[]>;
export const AMBUSH = { dx: [-96, 96, 160], above: 64, below: 128, inset: 16, flyerY: [72, 32] } as const;
