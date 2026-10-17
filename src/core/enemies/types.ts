// Enemy data shapes (04 §15). Names copied from the spec.
import type { Box } from '../combat/types.ts';

export type EnemyId =
  | 'wolf' | 'bandit' | 'bandit_archer' | 'wild_boar' | 'bandit_brute'
  | 'bat_swarm' | 'goblin_miner' | 'rock_golem' | 'ram' | 'goblin_shaman'
  | 'bog_zombie' | 'giant_spider' | 'wisp' | 'swamp_witch' | 'treant'
  | 'soldier' | 'crossbowman' | 'war_hound' | 'battle_mage' | 'knight'
  | 'royal_guard' | 'gargoyle' | 'castle_mage' | 'living_armor' | 'royal_executioner'
  | 'spiderling' | 'training_dummy' | 'sparring_dummy' | 'straw_target'
  | 'great_boar' | 'stone_colossus' | 'spider_queen' | 'black_knight' | 'enemy_king' | 'dragon';
export type EnemyProjectileId = 'enemy_arrow' | 'bomb' | 'brute_wave' | 'hex_bolt' | 'potion' | 'enemy_bolt' | 'fireball'
  | 'arcane_bolt' | 'shockwave' | 'falling_rock' | 'venom_glob' | 'dark_wave' | 'royal_orb' | 'falling_sword' | 'fire_rain';
export type SizeClass = 'small' | 'medium' | 'large' | 'boss';
export type Tier = 'regular' | 'elite' | 'boss' | 'summon' | 'dummy' | 'target';   // target: the straw target (04 §2.12)
export type PlayerStatusId = 'burning' | 'poisoned' | 'chilled' | 'rooted';
export type { Box };
export interface EnemyHit {
  box: Box; damage: number;                     // base (Stage 1)
  playerKb?: [number, number]; status?: { id: PlayerStatusId; duration?: number; stacks?: number };
  unblockable?: boolean; rehit?: number; maxHits?: number;
}
export interface EnemyAttackDef {
  id: string; phases?: number[];
  use: { minX: number; maxX: number; minDY?: number; maxDY?: number; behind?: boolean };
  weight?: number; cooldown: number; token: 'melee' | 'ranged' | 'none';
  telegraph: number; active: number; recovery: number;
  hit?: EnemyHit;
  move?: { dist: number; time: number };
  leap?: { vx: number; vy: number } | { jumpToX: number };
  shots?: { projectile: EnemyProjectileId; angles: number[]; aim: 'player' | 'facing' | 'arc' }[];
  chain?: { telegraph: number; active: number; hit: EnemyHit; move?: { dist: number; time: number }; phases?: number[] }[];
}
/** 04 §9: shared boss data. */
export interface BossDef {
  breakTime: number; breakMult: number;            // s, step-6 target multiplier while broken
  attackGapEnraged: number;                         // s
  enrageAt: number;                                 // HP fraction
  bar: { name: string; title: string; marks: number[] };
}
export interface EnemyDef {
  id: EnemyId; tier: Tier; size: SizeClass; elite: boolean;
  hurtbox: { w: number; h: number };
  hp: number; poiseMax: number; kbResist: number;
  walk: number; chase: number; fly?: number;
  flying?: boolean; ghost?: boolean; dropsLedges?: boolean; waterWalker?: boolean; stationary?: boolean;
  notice: { range: number; rangeY: number; time: number };
  preferred: [number, number]; attackGap: number; turnDelay: number;
  backOff?: number;             // walks away only when closer than this (default: the preferred band's min)
  boss?: BossDef;
  noFacing?: boolean; blocksPlayer?: boolean;
  guard?: { guardMult: number; when: 'always' | 'notAttacking' | 'stance'; bypassAbove: boolean };
  armor?: { mult: number; heavyIgnores: boolean };
  revives?: number; gold: number; itemRoll: 'none' | 'elite'; blueprintRoll: boolean;
  hpBar: 'damaged' | 'always' | 'boss';
  attacks: EnemyAttackDef[];
}
export interface EnemyProjectileDef {
  id: EnemyProjectileId; w: number; h: number;
  motion: 'straight' | 'arc' | 'floorWave' | 'falling'; speed?: number; arcTime?: number;
  range?: number; life?: number; homing?: { radius: number; turnRate: number };
  hit: EnemyHit; blast?: { w: number; h: number; fuse: number };
  puddle?: { w: number; h: number; life: number; status: PlayerStatusId };
}
/** A level spawn (06 objects; M2 levels write these directly). */
export interface EnemySpawn { enemy: EnemyId; x: number; y: number; facing: 1 | -1; patrol?: number; group?: string }
