// Version-1 save types (06 §15.2; Training progress is required by §12.4).
import type { AbilityId, BondId, ClassId, HybridId } from '../abilities/types.ts';
import type { WeaponId, WeaponInstance } from '../combat/types.ts';
export interface StartKit { cls: ClassId; weapon: WeaponId }
export type Road = 'mountain' | 'forest';
export type PbKey = `${ClassId}|${Road}`;
export interface KitSummary { weapons: (WeaponInstance | null)[]; abilities: ({ id: AbilityId; level: number } | null)[]; displayName: string }
export interface PbRecord { ticks: number; splits: [number, number, number, number]; date: string; seedText: string; kit: KitSummary }
export interface RunStats { kills: number; eliteKills: number; goldEarned: number; chestsOpened: number; luckyBlocksBroken: number; damageTaken: number; flasksDrunk: number }
export interface RunRecord { date: string; startClass: ClassId; startWeapon: WeaponId; road: Road | null; seedText: string; seeded: boolean;
  result: 'complete' | 'death' | 'restart' | 'quit'; stageReached: 1 | 2 | 3 | 4; sectionReached: number; runTicks: number; splits: (number | null)[];
  cause: string | null; dragon: 'absent' | 'skipped' | 'escaped' | 'killed'; kit: KitSummary; stats: RunStats }
export type ActionId = 'left' | 'right' | 'up' | 'down' | 'jump' | 'dash' | 'attack1' | 'attack2' | 'ability1' | 'ability2' | 'heal' | 'interact' | 'restart' | 'pause';
export interface SettingsData { volume: { master: number; music: number; sfx: number }; showTimer: boolean; screenShake: boolean; damageNumbers: boolean;
  promptStyle: 'auto' | 'keyboard' | 'xbox' | 'playstation'; bindings: { keyboard: Record<ActionId, [string | null, string | null]>; gamepad: Record<ActionId, number | null> } }
export interface SaveData {
  v: 1; settings: SettingsData; lastKit: StartKit | null; lastRoad: Road; typedSeed: string | null; training: number[];
  progress: { levelsReached: string[]; stage1Cleared: boolean; classesDiscovered: (BondId | HybridId)[] };
  unlocks: { blueprints: (WeaponId | AbilityId)[]; startWeapons: Partial<Record<ClassId, WeaponId[]>> };
  stats: { runsStarted: number; runsCompleted: number; deaths: number; dragonsKilled: number };
  pbs: Partial<Record<PbKey, PbRecord>>; bestSegments: Partial<Record<PbKey, [number | null, number | null, number | null, number | null]>>;
  practiceBests: Record<string, number>; history: RunRecord[];
}
export { defaultSettings, defaultSave } from '../../data/save.ts';
