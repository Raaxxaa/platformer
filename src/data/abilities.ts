// Ability data (03 §7–§12). Level-row fields are named exactly as the 03 table headers.
// M4 plays 9 abilities; the other 8 have an id, name, class and kind only (their defs come in M9).
import type { AbilityDef, AbilityId, AbilityKind, AbilityLevelRow, ClassId } from '../core/abilities/types.ts';
import type { Box } from '../core/combat/types.ts';

export const ABILITY_INFO: Record<AbilityId, { name: string; cls: ClassId | null; kind: AbilityKind }> = {
  blade_dash: { name: 'Blade Dash', cls: 'swordsman', kind: 'move' },
  whirlwind: { name: 'Whirlwind', cls: 'swordsman', kind: 'move' },
  blade_flurry: { name: 'Blade Flurry', cls: 'swordsman', kind: 'instant' },
  riposte: { name: 'Riposte', cls: 'swordsman', kind: 'cast' },
  shockwave: { name: 'Shockwave', cls: 'tank', kind: 'cast' },
  shoulder_charge: { name: 'Shoulder Charge', cls: 'tank', kind: 'move' },
  rage: { name: 'Rage', cls: 'tank', kind: 'instant' },
  boulder_toss: { name: 'Boulder Toss', cls: 'tank', kind: 'cast' },
  arrow_rain: { name: 'Arrow Rain', cls: 'archer', kind: 'cast' },
  turret: { name: 'Turret', cls: 'archer', kind: 'cast' },
  grapple_arrow: { name: 'Grapple Arrow', cls: 'archer', kind: 'move' },
  hunters_mark: { name: "Hunter's Mark", cls: 'archer', kind: 'instant' },
  thunder_strike: { name: 'Thunder Strike', cls: 'wizard', kind: 'cast' },
  frost_burst: { name: 'Frost Burst', cls: 'wizard', kind: 'cast' },
  blink: { name: 'Blink', cls: 'wizard', kind: 'move' },
  time_slow: { name: 'Time Slow', cls: 'wizard', kind: 'instant' },
  vampire: { name: 'Vampire', cls: null, kind: 'passive' },
};
export const ABILITY_IDS = Object.keys(ABILITY_INFO) as AbilityId[];

type Rows = AbilityDef['levels'];
const rows = (cooldownS: number, list: Omit<AbilityLevelRow, 'cooldownS'>[]): Rows => list.map((r) => ({ cooldownS, ...r })) as Rows;
const base = (id: AbilityId): Pick<AbilityDef, 'id' | 'name' | 'cls' | 'kind' | 'startupS' | 'recoveryS' | 'groundMoveCap' | 'airGravityMult' | 'airHover' | 'dashAttack'> => ({
  id, ...ABILITY_INFO[id], startupS: 0, recoveryS: 0, groundMoveCap: 1, airGravityMult: 1, airHover: false, dashAttack: false,
});

export const ABILITIES: Partial<Record<AbilityId, AbilityDef>> = {
  blade_dash: {
    ...base('blade_dash'), dashAttack: true,
    hits: { dash: { damage: 0, kb: [120, -60], poise: 20, hitStop: 0.05, kind: 'melee' } },
    levels: rows(6, [{ damage: 30, charges: 1 }, { damage: 40, charges: 1 }, { damage: 52, charges: 1 }, { damage: 66, charges: 1 }, { damage: 82, charges: 2 }]),
  },
  whirlwind: {
    ...base('whirlwind'),
    hits: { spin: { damage: 0, kb: [60, -20], poise: 6, hitStop: 0.025, kind: 'melee', multiHit: true, rehit: 0.15 } },
    levels: rows(8, [
      { damagePerHit: 10, durationS: 0.60, maxHits: 4, pull: false, charges: 1 },
      { damagePerHit: 11, durationS: 0.75, maxHits: 5, pull: false, charges: 1 },
      { damagePerHit: 12, durationS: 0.90, maxHits: 6, pull: false, charges: 1 },
      { damagePerHit: 13, durationS: 1.05, maxHits: 7, pull: false, charges: 1 },
      { damagePerHit: 14, durationS: 1.20, maxHits: 8, pull: true, charges: 1 },
    ]),
  },
  blade_flurry: {
    ...base('blade_flurry'),
    hits: { blade: { damage: 0, kb: [40, -10], poise: 3, hitStop: 0, kind: 'shot', multiHit: true, rehit: 0.75 } },
    levels: rows(14, [
      { blades: 2, durationS: 4.0, damagePerHit: 5, charges: 1 }, { blades: 2, durationS: 5.0, damagePerHit: 5, charges: 1 },
      { blades: 3, durationS: 5.0, damagePerHit: 5, charges: 1 }, { blades: 3, durationS: 6.0, damagePerHit: 5, charges: 1 },
      { blades: 4, durationS: 6.0, damagePerHit: 5, charges: 1 },
    ]),
  },
  shockwave: {
    ...base('shockwave'), startupS: 0.20, recoveryS: 0.25, groundMoveCap: 0, airGravityMult: 0.5, airHover: true,
    hits: { slam: { damage: 0, kb: [80, -320], poise: 40, hitStop: 0.075, kind: 'shot', control: { type: 'launch', duration: 0 } } },
    levels: rows(9, [{ damage: 40, R: 56, charges: 1 }, { damage: 54, R: 64, charges: 1 }, { damage: 70, R: 72, charges: 1 }, { damage: 88, R: 84, charges: 1 }, { damage: 110, R: 96, charges: 1 }]),
  },
  shoulder_charge: {
    ...base('shoulder_charge'), dashAttack: true,
    hits: { charge: { damage: 0, kb: [300, -180], poise: 35, hitStop: 0.05, kind: 'melee' } },
    levels: rows(7, [
      { damage: 25, distancePx: 96, ticks: 32, stunS: 0, charges: 1 },
      { damage: 32, distancePx: 108, ticks: 36, stunS: 0, charges: 1 },
      { damage: 40, distancePx: 120, ticks: 40, stunS: 0, charges: 1 },
      { damage: 50, distancePx: 132, ticks: 44, stunS: 0, charges: 1 },
      { damage: 62, distancePx: 144, ticks: 48, stunS: 1.0, charges: 1 },
    ]),
  },
  arrow_rain: {
    ...base('arrow_rain'), startupS: 0.15, recoveryS: 0.15, groundMoveCap: 0.5, airGravityMult: 0.5,
    hits: { wave: { damage: 0, kb: [20, 0], poise: 5, hitStop: 0.025, kind: 'shot' } },
    levels: rows(10, [
      { waves: 5, damagePerWave: 10, widthPx: 96, charges: 1 }, { waves: 6, damagePerWave: 11, widthPx: 112, charges: 1 },
      { waves: 7, damagePerWave: 12, widthPx: 128, charges: 1 }, { waves: 8, damagePerWave: 13, widthPx: 144, charges: 1 },
      { waves: 10, damagePerWave: 14, widthPx: 160, charges: 1 },
    ]),
  },
  hunters_mark: {
    ...base('hunters_mark'), hits: {},
    levels: rows(12, [
      { marks: 1, radiusPx: 192, durationS: 8, charges: 1 }, { marks: 1, radiusPx: 224, durationS: 10, charges: 1 },
      { marks: 2, radiusPx: 224, durationS: 10, charges: 1 }, { marks: 2, radiusPx: 256, durationS: 12, charges: 1 },
      { marks: 3, radiusPx: 256, durationS: 12, charges: 1 },
    ]),
  },
  rage: {
    ...base('rage'), hits: {},
    levels: rows(18, [{ damageBonus: 0.30, charges: 1 }, { damageBonus: 0.37, charges: 1 }, { damageBonus: 0.45, charges: 1 }, { damageBonus: 0.52, charges: 1 }, { damageBonus: 0.60, charges: 1 }]),
  },
  thunder_strike: {
    ...base('thunder_strike'), startupS: 0.15, recoveryS: 0.20, groundMoveCap: 0.3, airGravityMult: 0.3,
    hits: { bolt: { damage: 0, kb: [0, -100], poise: 15, hitStop: 0.05, kind: 'shot' } },
    levels: rows(8, [{ bolts: 2, damagePerBolt: 25, charges: 1 }, { bolts: 3, damagePerBolt: 23, charges: 1 }, { bolts: 4, damagePerBolt: 22, charges: 1 }, { bolts: 5, damagePerBolt: 22, charges: 1 }, { bolts: 6, damagePerBolt: 23, charges: 1 }]),
  },
  frost_burst: {
    ...base('frost_burst'), startupS: 0.10, recoveryS: 0.20, groundMoveCap: 0, airGravityMult: 0.5, airHover: true,
    hits: { burst: { damage: 0, kb: [60, -20], poise: 10, hitStop: 0.05, kind: 'shot' } },
    levels: rows(12, [
      { damage: 20, radiusPx: 56, freezeS: 1.5, freezeLevel: 1, charges: 1 }, { damage: 26, radiusPx: 64, freezeS: 1.8, freezeLevel: 1, charges: 1 },
      { damage: 33, radiusPx: 72, freezeS: 2.1, freezeLevel: 2, charges: 1 }, { damage: 42, radiusPx: 80, freezeS: 2.5, freezeLevel: 2, charges: 1 },
      { damage: 52, radiusPx: 96, freezeS: 3.0, freezeLevel: 3, charges: 1 },
    ]),
  },
  blink: {
    ...base('blink'), hits: {},
    levels: rows(5, [{ distancePx: 64, charges: 1 }, { distancePx: 72, charges: 1 }, { distancePx: 80, charges: 1 }, { distancePx: 88, charges: 1 }, { distancePx: 96, charges: 2 }]),
  },
  vampire: {
    ...base('vampire'), groundMoveCap: 1, hits: {},
    levels: rows(0, [{ tenths: 20, charges: 1 }, { tenths: 25, charges: 1 }, { tenths: 30, charges: 1 }, { tenths: 40, charges: 1 }, { tenths: 50, charges: 1 }]),
  },
};

/** Geometry and motion numbers from 03 §7–§12 (not per level). */
export const ABILITY = {
  BUFFER_TICKS: 18,
  bladeDash: { vx: 480, ticks: 24, box: { dx: 0, dy: -14, w: 28, h: 32 } as Box },
  whirlwind: { vx: 120, box: { dx: 0, dy: -16, w: 48, h: 32 } as Box, pullRadius: 64, pullSpeed: 120 },
  bladeFlurry: { radius: 28, degPerS: 450, size: 10 },
  shockwave: { dy: -18, h: 44 },
  shoulderCharge: { vx: 360, box: { dx: 14, dy: -14, w: 20, h: 28 } as Box, crackedReach: 4 },
  arrowRain: { near: 16, top: 96, bottom: 32, waveTicks: 24, scanDy: -14 },
  rage: { durationS: 6.0, linkedMult: 1.5 },
  hunterMark: { mult: 1.30, linkedMult: 1.45 },
  thunderStrike: { reach: 224, vReach: 112, boltTicks: 12, box: { dx: 0, dy: -80, w: 24, h: 160 } as Box, colStart: 48, colStep: 32, colDrop: 160 },
  frostBurst: { dy: -14, chillLevel: 1, eliteMult: 0.5, linkedFreezeMult: 1.5 },
  blink: { diag: 0.7071, minMove: 8, iframeTicks: 18 },
} as const;
