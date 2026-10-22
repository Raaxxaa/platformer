// Practice mode (06 §14, 07 §7.4) and ghost replay numbers (06 §14). Preset rows are the spec's table.
import type { ClassId } from '../core/abilities/types.ts';
import type { ElementId, Grade } from '../core/combat/types.ts';

export type PracticeLevelId = 'plains' | 'mountains' | 'swamps' | 'kingdom' | 'castle';
export const PRACTICE_LEVELS: readonly PracticeLevelId[] = ['plains', 'mountains', 'swamps', 'kingdom', 'castle'];
/** 07 §7.4 labels. */
export const PRACTICE_LEVEL_NAME: Record<PracticeLevelId, string> = {
  plains: '1 · Plains & Forest', mountains: '2 · Caves & Mountains', swamps: '2 · Dark Forest & Swamps', kingdom: '3 · Enemy Kingdom', castle: "4 · King's Castle",
};
/** Which stage each level belongs to (06 §8.3). */
export const PRACTICE_STAGE: Record<PracticeLevelId, 1 | 2 | 3 | 4> = { plains: 1, mountains: 2, swamps: 2, kingdom: 3, castle: 4 };

/** 06 §14 preset loadout table. Ability 2 and weapon 2 are always empty; no stat upgrades or perks. */
export const PRACTICE_PRESET: Record<1 | 2 | 3 | 4, { grade: Grade; elemental: boolean; abilityLevel: 1 | 2 | 3; flask: number; hp: number; gold: number; keys: number }> = {
  1: { grade: 'C', elemental: false, abilityLevel: 1, flask: 2, hp: 100, gold: 0, keys: 0 },
  2: { grade: 'B', elemental: true, abilityLevel: 2, flask: 2, hp: 100, gold: 0, keys: 1 },
  3: { grade: 'B', elemental: true, abilityLevel: 3, flask: 3, hp: 100, gold: 0, keys: 1 },
  4: { grade: 'B', elemental: true, abilityLevel: 3, flask: 3, hp: 100, gold: 0, keys: 1 },
};
/** 06 §14: class element for the B weapon. */
export const PRACTICE_ELEMENT: Record<ClassId, ElementId> = { swordsman: 'fire', tank: 'lightning', archer: 'wind', wizard: 'lightning' };

export const PRACTICE_DRAGON = ['off', 'random', 'red', 'white', 'storm', 'green'] as const;
export type PracticeDragon = (typeof PRACTICE_DRAGON)[number];
export const PRACTICE_DRAGON_LABEL: Record<PracticeDragon, string> = { off: 'Off', random: 'Random color', red: 'Red', white: 'White', storm: 'Storm', green: 'Green' };

/** 07 §7.4 geometry: rows from y 80, 16 px apart, labels at x 160, values right-aligned at x 480. */
export const PRACTICE_UI = {
  panel: [112, 40, 416, 220] as const, titleY: 52, rowsY: 80, rowStep: 16, labelX: 160, valueX: 480, rowW: 336, hintY: 240,
  rows: ['stage', 'class', 'weapon', 'dragon', 'seed', 'best', 'start', 'back'] as const,
  labels: { stage: 'Stage', class: 'Class', weapon: 'Weapon', dragon: 'Dragon', seed: 'Seed', best: 'Best' },
  result: { titleY: 100, timeY: 124, bestY: 150, rowsY: 190, rowStep: 16, rowW: 160, rowH: 14, guardSeconds: 0.5, rows: ['Retry', 'Change setup', 'Title'], commands: ['retry', 'setup', 'title'] },
} as const;

/** 06 §14 ghost recording and storage. */
export const GHOST = { sampleTicks: 2, maxSamples: 12000, sampleBytes: 6, storageKey: 'rushblade.ghosts', version: 1, alpha: 0.4, maxCoord: 65535 } as const;
