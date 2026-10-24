// Save defaults and limits (06 §15, §12.4; 07 settings and controls).
import type { RunStats, SaveData, SettingsData } from '../core/save/schema.ts';
import type { AbilityId, ClassId } from '../core/abilities/types.ts';
import type { WeaponId } from '../core/combat/types.ts';
import { TICK_RATE } from '../core/tuning.ts';
import { defaultTouchSettings } from './touch.ts';

export const SAVE_RULES = {
  version: 1, seedMaxLength: 12, trainingStations: 17, historyLimit: 20,
  historyMinTicks: 30 * TICK_RATE, importMaxLength: 1_000_000, warningSeconds: 5.0,
  kitSlots: 2, abilityMaxLevel: 5, maxSection: 8, volumeMax: 100, volumeStep: 10, padMax: 15, padDpadStart: 12,
} as const;
export const SAVE_STAGE_IDS = ['plains', 'mountains', 'swamps', 'kingdom', 'castle'] as const;
export const BLUEPRINT_IDS: readonly (WeaponId | AbilityId)[] = ['scythe', 'flail', 'hand_cannon', 'javelin', 'spell_tome', 'riposte', 'boulder_toss', 'turret', 'time_slow'];
export const THIRD_START_WEAPON: Record<ClassId, WeaponId> = { swordsman: 'spear', tank: 'giant_axe', archer: 'throwing_knives', wizard: 'wand' };
export const BLUEPRINT_RULES = { eliteChance: 0.02, bossChance: 0.25 } as const;
export const defaultRunStats = (): RunStats => ({ kills: 0, eliteKills: 0, goldEarned: 0, chestsOpened: 0, luckyBlocksBroken: 0, damageTaken: 0, flasksDrunk: 0 });

export function defaultSettings(): SettingsData {
  return { volume: { master: 80, music: 70, sfx: 80 }, showTimer: true, screenShake: true, damageNumbers: true, promptStyle: 'auto', touch: defaultTouchSettings(),
    bindings: { keyboard: { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], jump: ['Space', null], dash: ['ShiftLeft', null], attack1: ['KeyJ', null], attack2: ['KeyK', null], ability1: ['KeyU', null], ability2: ['KeyI', null], heal: ['KeyQ', null], interact: ['KeyE', null], restart: ['KeyR', null], pause: ['Escape', 'KeyP'] },
      gamepad: { left: null, right: null, up: null, down: null, jump: 0, interact: 1, attack1: 2, attack2: 3, heal: 4, dash: 5, ability1: 6, ability2: 7, restart: 8, pause: 9 } } };
}

export function defaultSave(): SaveData {
  return { v: SAVE_RULES.version, settings: defaultSettings(), lastKit: null, lastRoad: 'mountain', typedSeed: null, training: [],
    progress: { levelsReached: ['plains'], stage1Cleared: false, classesDiscovered: [] }, unlocks: { blueprints: [], startWeapons: {} },
    stats: { runsStarted: 0, runsCompleted: 0, deaths: 0, dragonsKilled: 0 }, pbs: {}, bestSegments: {}, practiceBests: {}, history: [] };
}
