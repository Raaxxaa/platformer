// Per-level rules for validation and run logic (06 §8–9, 04 §9.2, 05 §9.5).
import type { EnemyId } from '../core/enemies/types.ts';

export type StageLevelId = 'plains' | 'mountains' | 'swamps' | 'kingdom' | 'castle';

export interface LevelRule {
  stage: 1 | 2 | 3 | 4;
  maxSize: { w: number; h: number };                 // tiles (06 §8.3)
  regularMix: Partial<Record<EnemyId, number>>;       // exact per-type counts, waves included (05 §9.5)
  elite: EnemyId; elites: number;
  boss: EnemyId;
  bossArena: { w: number; h: number };               // px (04 §9.2)
  sideArena: boolean;                                // Stages 2–3 (06 §9.4)
  timeLimit: number;                                 // timed door default, s (06 §9.5)
}

export const LEVEL_RULES: Record<StageLevelId, LevelRule> = {
  plains: { stage: 1, maxSize: { w: 720, h: 96 }, regularMix: { wolf: 12, bandit: 10, bandit_archer: 9, wild_boar: 9 },
    elite: 'bandit_brute', elites: 4, boss: 'great_boar', bossArena: { w: 576, h: 224 }, sideArena: false, timeLimit: 120 },
  mountains: { stage: 2, maxSize: { w: 560, h: 176 }, regularMix: { bat_swarm: 8, goblin_miner: 10, rock_golem: 8, ram: 10 },
    elite: 'goblin_shaman', elites: 4, boss: 'stone_colossus', bossArena: { w: 576, h: 288 }, sideArena: true, timeLimit: 125 },
  swamps: { stage: 2, maxSize: { w: 720, h: 96 }, regularMix: { bog_zombie: 10, giant_spider: 12, wisp: 10, swamp_witch: 12 },
    elite: 'treant', elites: 4, boss: 'spider_queen', bossArena: { w: 512, h: 320 }, sideArena: true, timeLimit: 125 },
  kingdom: { stage: 3, maxSize: { w: 720, h: 112 }, regularMix: { soldier: 12, crossbowman: 10, war_hound: 12, battle_mage: 6 },
    elite: 'knight', elites: 4, boss: 'black_knight', bossArena: { w: 640, h: 256 }, sideArena: true, timeLimit: 130 },
  castle: { stage: 4, maxSize: { w: 640, h: 144 }, regularMix: { royal_guard: 12, gargoyle: 10, castle_mage: 8, living_armor: 10 },
    elite: 'royal_executioner', elites: 4, boss: 'enemy_king', bossArena: { w: 640, h: 304 }, sideArena: false, timeLimit: 135 },
};

/** 06 §9.2 combat arena: inner size range (tiles) and par time per stage (s). */
export const COMBAT_ARENA = { minW: 34, maxW: 40, minH: 14, maxH: 20, doors: 2, parTime: { 1: 20, 2: 24, 3: 29, 4: 32 } } as const;
// SPEC-GAP: Should the M7.1 Mountain arena be 20 tiles wide, or use 06 §9.2's 34–40 tile range?
// Use the exact world spec's 38 × 18 inner arena, matching validation and the shared three-wave layout.

/** Stage2 road differences and gimmicks (06 §8.2–8.5, §9.4). */
export const STAGE2_LEVEL = {
  regulars: { mountains:[0,10,2,8,9,3,4,0], swamps:[0,12,4,8,9,7,4,0] },
  climb:60, cartRun:120, waterFraction:.30,waterSections:[2,3,6],darkSections:[3,6],
  sideWidth:40,sideHeight:20,warningDistance:640,
} as const;

/** 06 §8.4 / §13.4 exact object counts for a stage level. */
export const STAGE_OBJECT_COUNTS: Record<string, number> = {
  player_start: 1, exit: 1, main_path: 1, section: 8, lucky_block: 4, loot_stand: 2, key: 2, key_chest: 3,
  cursed_chest: 1, timed_door: 1, timed_chest: 1, merchant_spot: 1,
};

/** 06 §13.6: main path length (tiles). */
export const MAIN_PATH = { min: 650, max: 730 } as const;
// SPEC-GAP: 06 §8.6 grew Stage 1's §2 (150–170) and §3 (120–140) but kept the 650–730 total; Plains gets the total
// shifted by the same +60 the two section minimums grew.
export const MAIN_PATH_BY_LEVEL: Partial<Record<string, { min: number; max: number }>> = { plains: { min: 710, max: 790 } };
/** 06 §11.3: merchant spot needs this much flat open floor on each side (px), and 3 open rows above. */
export const MERCHANT_FLOOR = { side: 112, openRows: 3 } as const;

/** 06 §8.6 early-game spacing (Stage 1 only): small groups with calm ground between them. Distances in tiles. */
export const EARLY_SPACING = {
  levels: ['plains'] as readonly string[],
  sections: [2, 3] as readonly number[],
  groupReach: 8,            // enemies within 8 tiles of each other (along x) form a group
  maxRegulars: 2,
  minGap: 24,               // edge to edge between two groups
  firstEnemy: 'bandit',
} as const;
