// Stage 4 King's Castle: mobs, elite and the Enemy King (04 §7, §12). Stage-1 base values; scaling is applied at spawn.
import type { EnemyDef } from '../core/enemies/types.ts';
import { ENEMY, ticks } from '../core/tuning.ts';

const REGULAR = { tier: 'regular', elite: false, attackGap: ENEMY.ATTACK_GAP_REGULAR, turnDelay: 0, itemRoll: 'none', blueprintRoll: false, hpBar: 'damaged' } as const;

export const ROYAL_GUARD: EnemyDef = {
  ...REGULAR, id: 'royal_guard', size: 'medium', hurtbox: { w: 14, h: 30 }, hp: 50, poiseMax: 30, kbResist: 0.3,
  walk: 50, chase: 80, notice: { range: 176, rangeY: ENEMY.NOTICE_RANGE_Y, time: 0.45 }, preferred: [56, 80], backOff: 40, gold: 5,
  attacks: [
    { id: 'halberd_thrust', use: { minX: 40, maxX: 88 }, cooldown: 1.6, token: 'melee', telegraph: 0.55, active: 0.12, recovery: 0.50,
      hit: { box: { dx: 46, dy: -18, w: 72, h: 10 }, damage: 13 } },
    { id: 'halberd_sweep', use: { minX: 0, maxX: 56 }, cooldown: 3.0, token: 'melee', telegraph: 0.65, active: 0.15, recovery: 0.70,
      hit: { box: { dx: 24, dy: -16, w: 64, h: 32 }, damage: 14, playerKb: [260, -200] } },
  ],
};

export const GARGOYLE: EnemyDef = {
  ...REGULAR, id: 'gargoyle', size: 'medium', hurtbox: { w: 20, h: 22 }, hp: 40, poiseMax: 20, kbResist: 0.2,
  walk: 0, chase: 0, fly: 120, flying: true, notice: { range: 96, rangeY: 96, time: 0 }, preferred: [0, 0], gold: 5,
  attacks: [
    { id: 'swoop', use: { minX: 0, maxX: 9999, minDY: -9999, maxDY: 9999 }, cooldown: 2.0, token: 'melee', telegraph: 0.50, active: 0.60, recovery: 0.50,
      hit: { box: { dx: 0, dy: -11, w: 24, h: 20 }, damage: 12 } },
  ],
};

export const CASTLE_MAGE: EnemyDef = {
  ...REGULAR, id: 'castle_mage', size: 'medium', hurtbox: { w: 14, h: 28 }, hp: 35, poiseMax: 10, kbResist: 0.1,
  walk: 45, chase: 60, notice: { range: 224, rangeY: ENEMY.NOTICE_RANGE_Y, time: 0.50 }, preferred: [144, 224], gold: 5,
  attacks: [
    // Ward: Tele 0.6, channel (Act, up to 6.0 s), Rec 0.4. The 8.0 s CD starts when the ward ends, so the CD here is 8.0 - Rec.
    { id: 'ward', use: { minX: 0, maxX: 0 }, cooldown: 7.6, token: 'none', telegraph: 0.60, active: 6.0, recovery: 0.40 },
    { id: 'arcane_bolts', use: { minX: 64, maxX: 256 }, cooldown: 2.6, token: 'ranged', telegraph: 0.55, active: 0, recovery: 0.50,
      shots: [{ projectile: 'arcane_bolt', angles: [-10, 0, 10], aim: 'player' }] },
  ],
};

export const LIVING_ARMOR: EnemyDef = {
  ...REGULAR, id: 'living_armor', size: 'medium', hurtbox: { w: 16, h: 30 }, hp: 45, poiseMax: 25, kbResist: 0.4,
  walk: 40, chase: 70, notice: { range: 160, rangeY: ENEMY.NOTICE_RANGE_Y, time: 0.50 }, preferred: [20, 40], gold: 5, revives: 1,
  attacks: [
    { id: 'sword_slash', use: { minX: 0, maxX: 44 }, cooldown: 1.4, token: 'melee', telegraph: 0.50, active: 0.10, recovery: 0.50,
      hit: { box: { dx: 22, dy: -16, w: 36, h: 28 }, damage: 12 } },
    { id: 'overhead_chop', use: { minX: 0, maxX: 48 }, cooldown: 3.0, token: 'melee', telegraph: 0.70, active: 0.12, recovery: 0.70,
      hit: { box: { dx: 24, dy: -14, w: 32, h: 28 }, damage: 15, playerKb: [260, -200] } },
  ],
};

export const ROYAL_EXECUTIONER: EnemyDef = {
  id: 'royal_executioner', tier: 'elite', elite: true, size: 'large', hurtbox: { w: 22, h: 40 }, hp: 170, poiseMax: 80, kbResist: 0.7,
  walk: 45, chase: 75, notice: { range: 176, rangeY: ENEMY.NOTICE_RANGE_Y, time: 0.50 }, preferred: [32, 56], gold: 20,
  attackGap: ENEMY.ATTACK_GAP_ELITE, turnDelay: 0, itemRoll: 'elite', blueprintRoll: true, hpBar: 'always',
  attacks: [
    { id: 'overhead_chop', use: { minX: 0, maxX: 60 }, cooldown: 2.2, token: 'melee', telegraph: 0.75, active: 0.12, recovery: 0.80,
      hit: { box: { dx: 32, dy: -20, w: 48, h: 40 }, damage: 22, playerKb: [280, -220] } },
    { id: 'whirling_axe', use: { minX: 0, maxX: 72 }, cooldown: 5.0, token: 'melee', telegraph: 0.70, active: 1.20, recovery: 0.90,
      move: { dist: 72, time: 1.2 }, hit: { box: { dx: 0, dy: -20, w: 80, h: 40 }, damage: 10, rehit: 0.3, maxHits: 3 } },
    { id: 'leap_chop', use: { minX: 96, maxX: 224 }, cooldown: 4.5, token: 'melee', telegraph: 0.65, active: ENEMY.LEAP_MAX, recovery: 0.80,
      leap: { jumpToX: 0.6 }, hit: { box: { dx: 0, dy: -20, w: 64, h: 40 }, damage: 22, playerKb: [300, -220] } },
  ],
};

const CLEAVE = { dx: 34, dy: -24, w: 60, h: 44 };
export const ENEMY_KING: EnemyDef = {
  id: 'enemy_king', tier: 'boss', elite: false, size: 'boss', hurtbox: { w: 24, h: 48 }, hp: 1100, poiseMax: 200, kbResist: 1.0,
  walk: 80, chase: 80, notice: { range: 9999, rangeY: 9999, time: 0 }, preferred: [48, 72], gold: 0,
  attackGap: 0.9, turnDelay: 0, itemRoll: 'none', blueprintRoll: false, hpBar: 'boss',
  boss: { breakTime: 3.0, breakMult: 1.5, attackGapEnraged: 0.7, enrageAt: 0.66, transition: true,
    phaseAt: [0.66, 0.33], attackGaps: [0.9, 0.7, 0.5], speedMults: [1, 1, 1.25],
    // SPEC-GAP: 04 §9.4 leaves the King's title open (GAME_PLAN 15.2).
    bar: { name: 'The Enemy King', title: 'Ruler of the Kingdom', marks: [0.66, 0.33] } },
  attacks: [
    { id: 'crown_cleave', use: { minX: 0, maxX: 72 }, cooldown: 2.5, token: 'none', telegraph: 0.55, active: 0.10, recovery: 0.80,
      hit: { box: CLEAVE, damage: 18 },
      chain: [{ telegraph: 0.30, active: 0.12, hit: { box: { dx: 36, dy: -20, w: 68, h: 40 }, damage: 22, playerKb: [300, -200] } }] },
    { id: 'royal_thrust', use: { minX: 96, maxX: 288 }, cooldown: 4.0, token: 'none', telegraph: 0.60, active: 0.30, recovery: 0.70,
      move: { dist: 192, time: 0.3 }, hit: { box: { dx: 30, dy: -22, w: 52, h: 14 }, damage: 20, playerKb: [360, -160] } },
    { id: 'scepter_orbs', phases: [1], use: { minX: 96, maxX: 9999 }, cooldown: 5.0, token: 'none', telegraph: 0.70, active: 0, recovery: 0.60,
      shots: [{ projectile: 'royal_orb', angles: [-20, 0, 20], aim: 'player' }] },
    { id: 'scepter_orbs_wide', phases: [2, 3], use: { minX: 96, maxX: 9999 }, cooldown: 5.0, token: 'none', telegraph: 0.70, active: 0, recovery: 0.60,
      shots: [{ projectile: 'royal_orb', angles: [-30, -15, 0, 15, 30], aim: 'player' }] },
    // Forced on entering phase 2 and 3 only (use is unreachable, so it is never picked).
    { id: 'royal_decree', phases: [2, 3], use: { minX: 99999, maxX: 99999 }, cooldown: 0, token: 'none', telegraph: 1.0, active: 0, recovery: 0.40 },
    { id: 'shockwave_slam', phases: [2, 3], use: { minX: 64, maxX: 9999 }, cooldown: 5.0, token: 'none', telegraph: 0.70, active: ENEMY.LEAP_MAX, recovery: 0.90,
      leap: { jumpToX: 0.7 }, hit: { box: { dx: 0, dy: -14, w: 96, h: 28 }, damage: 24, playerKb: [300, -240] } },
    { id: 'blade_rain', phases: [3], use: { minX: 0, maxX: 9999, minDY: -9999, maxDY: 9999 }, cooldown: 7.0, token: 'none', telegraph: 1.0, active: 0, recovery: 0.40 },
    { id: 'throne_beam', phases: [3], use: { minX: 0, maxX: 9999, minDY: -9999, maxDY: 9999 }, cooldown: 9.0, token: 'none', telegraph: 1.2, active: 0.35, recovery: 1.0,
      hit: { box: { dx: 0, dy: -8, w: 16, h: 16 }, damage: 26, playerKb: [240, -160], unblockable: true } },
  ],
};

/** Stage 4 special rules (04 §7, §12). */
export const CASTLE = {
  gargoyle: { stoneMult: 0.2, wakeRange: 96, crackTicks: ticks(0.5), hoverAbove: 72, hoverToward: 48, hoverSnap: 8, swoopSpeed: 360,
    farRange: 320, farTicks: ticks(6.0) },
  ward: { range: 192, maxApart: 256, ticks: ticks(6.0), mult: 0.5 },
  armor: { pileW: 20, pileH: 10, pileTicks: ticks(2.0), riseTicks: ticks(0.5), reviveFraction: 0.5 },
  king: { swordXs: [0, 80, -80, 160, -160, 240], wallInset: 16, summonPoints: 2, beamFadeTicks: ticks(0.3), beamWallInset: 48,
    beamLow: { top: -16, bottom: 0 }, beamHigh: { top: -44, bottom: -18 }, slamWaveSpeed: 280, slamWaveH: 20, slamWaveDamage: 16 },
} as const;
