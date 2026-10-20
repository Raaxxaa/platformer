// Stage 3 Enemy Kingdom: mobs, elite and the Black Knight (04 §6, §11). Stage-1 base values; scaling is applied at spawn.
import type { EnemyDef } from '../core/enemies/types.ts';
import { ENEMY } from '../core/tuning.ts';

const REGULAR = { tier: 'regular', elite: false, attackGap: ENEMY.ATTACK_GAP_REGULAR, turnDelay: 0, itemRoll: 'none', blueprintRoll: false, hpBar: 'damaged' } as const;

export const SOLDIER: EnemyDef = {
  ...REGULAR, id: 'soldier', size: 'medium', hurtbox: { w: 14, h: 28 }, hp: 45, poiseMax: 25, kbResist: 0.3,
  walk: 50, chase: 85, notice: { range: 176, rangeY: ENEMY.NOTICE_RANGE_Y, time: 0.45 }, preferred: [24, 40], gold: 4, turnDelay: 0.5,
  guard: { guardMult: 0.2, when: 'notAttacking', bypassAbove: false, downDuring: ['sword_thrust'] },
  attacks: [
    { id: 'sword_thrust', use: { minX: 0, maxX: 44 }, cooldown: 1.3, token: 'melee', telegraph: 0.50, active: 0.10, recovery: 0.45,
      hit: { box: { dx: 24, dy: -16, w: 36, h: 12 }, damage: 11 } },
    { id: 'shield_bash', use: { minX: 0, maxX: 28 }, cooldown: 2.5, token: 'melee', telegraph: 0.40, active: 0.10, recovery: 0.40,
      hit: { box: { dx: 14, dy: -14, w: 18, h: 26 }, damage: 8, playerKb: [320, -140] } },
  ],
};

export const CROSSBOWMAN: EnemyDef = {
  ...REGULAR, id: 'crossbowman', size: 'medium', hurtbox: { w: 14, h: 28 }, hp: 30, poiseMax: 10, kbResist: 0.1,
  walk: 0, chase: 0, perched: true, notice: { range: 288, rangeY: 160, time: 0.50 }, preferred: [0, 0], gold: 4,
  attacks: [
    { id: 'bolt', use: { minX: 48, maxX: 320, minDY: -160, maxDY: 160 }, cooldown: 2.2, token: 'ranged', telegraph: 0.70, active: 0, recovery: 0.60,
      shots: [{ projectile: 'enemy_bolt', angles: [0], aim: 'player', clampDeg: 45 }] },
    { id: 'kick', use: { minX: 0, maxX: 32 }, cooldown: 2.0, token: 'melee', telegraph: 0.35, active: 0.08, recovery: 0.40,
      hit: { box: { dx: 14, dy: -12, w: 18, h: 16 }, damage: 9, playerKb: [300, -160] } },
  ],
};

export const WAR_HOUND: EnemyDef = {
  ...REGULAR, id: 'war_hound', size: 'small', hurtbox: { w: 28, h: 18 }, hp: 28, poiseMax: 10, kbResist: 0,
  walk: 80, chase: 165, notice: { range: 192, rangeY: ENEMY.NOTICE_RANGE_Y, time: 0.30 }, preferred: [40, 64], gold: 3, dropsLedges: true,
  attacks: [
    { id: 'leap_bite', use: { minX: 40, maxX: 120 }, cooldown: 1.8, token: 'melee', telegraph: 0.40, active: ENEMY.LEAP_MAX, recovery: 0.40,
      leap: { vx: 340, vy: -200 }, hit: { box: { dx: 14, dy: -9, w: 22, h: 14 }, damage: 10 } },
    { id: 'snap', use: { minX: 0, maxX: 36 }, cooldown: 1.0, token: 'melee', telegraph: 0.35, active: 0.08, recovery: 0.35,
      hit: { box: { dx: 16, dy: -9, w: 20, h: 14 }, damage: 8 } },
  ],
};

export const BATTLE_MAGE: EnemyDef = {
  ...REGULAR, id: 'battle_mage', size: 'medium', hurtbox: { w: 14, h: 28 }, hp: 35, poiseMax: 10, kbResist: 0.1,
  walk: 45, chase: 60, notice: { range: 224, rangeY: ENEMY.NOTICE_RANGE_Y, time: 0.50 }, preferred: [128, 224], gold: 5,
  attacks: [
    { id: 'fireball', use: { minX: 80, maxX: 288 }, cooldown: 2.4, token: 'ranged', telegraph: 0.60, active: 0, recovery: 0.50,
      shots: [{ projectile: 'fireball', angles: [0], aim: 'player' }] },
    { id: 'flame_burst', use: { minX: 0, maxX: 48 }, cooldown: 3.0, token: 'melee', telegraph: 0.55, active: 0.15, recovery: 0.60,
      hit: { box: { dx: 0, dy: -20, w: 64, h: 40 }, damage: 13, status: { id: 'burning' } } },
  ],
};

export const KNIGHT: EnemyDef = {
  id: 'knight', tier: 'elite', elite: true, size: 'large', hurtbox: { w: 18, h: 36 }, hp: 160, poiseMax: 80, kbResist: 0.7,
  walk: 45, chase: 70, notice: { range: 176, rangeY: ENEMY.NOTICE_RANGE_Y, time: 0.50 }, preferred: [32, 52], gold: 20,
  attackGap: ENEMY.ATTACK_GAP_ELITE, turnDelay: 0, itemRoll: 'elite', blueprintRoll: true, hpBar: 'always',
  armor: { mult: 0.75, heavyIgnores: true },
  attacks: [
    { id: 'sword_combo', use: { minX: 0, maxX: 52 }, cooldown: 2.0, token: 'melee', telegraph: 0.55, active: 0.10, recovery: 0.70,
      hit: { box: { dx: 26, dy: -18, w: 44, h: 30 }, damage: 18 },
      chain: [{ telegraph: 0.30, active: 0.12, hit: { box: { dx: 28, dy: -16, w: 48, h: 26 }, damage: 20, playerKb: [300, -180] } }] },
    { id: 'charging_thrust', use: { minX: 64, maxX: 176 }, cooldown: 4.0, token: 'melee', telegraph: 0.70, active: 0.35, recovery: 0.80,
      move: { dist: 160, time: 0.35 }, hit: { box: { dx: 22, dy: -18, w: 36, h: 14 }, damage: 22, playerKb: [340, -160] } },
  ],
};

const SLASH = { dx: 30, dy: -22, w: 52, h: 40 };
export const BLACK_KNIGHT: EnemyDef = {
  id: 'black_knight', tier: 'boss', elite: false, size: 'boss', hurtbox: { w: 22, h: 44 }, hp: 1200, poiseMax: 180, kbResist: 1.0,
  walk: 70, chase: 70, notice: { range: 9999, rangeY: 9999, time: 0 }, preferred: [40, 64], gold: 80,
  attackGap: 0.9, turnDelay: 0, itemRoll: 'none', blueprintRoll: true, hpBar: 'boss',
  guard: { guardMult: 0.1, when: 'stance', bypassAbove: false },
  boss: { breakTime: 3.0, breakMult: 1.5, attackGapEnraged: 0.6, enrageAt: 0.5, transition: true, enragedSpeedMult: 1.2,
    bar: { name: 'The Black Knight', title: 'Champion of the King', marks: [0.5] } },
  attacks: [
    { id: 'triple_slash', use: { minX: 0, maxX: 64 }, cooldown: 2.5, token: 'none', telegraph: 0.55, active: 0.10, recovery: 0.80,
      move: { dist: 16, time: 0.1 }, hit: { box: SLASH, damage: 16 },
      chain: [
        { telegraph: 0.30, active: 0.10, move: { dist: 16, time: 0.1 }, hit: { box: SLASH, damage: 16 } },
        { telegraph: 0.30, active: 0.10, move: { dist: 16, time: 0.1 }, hit: { box: { dx: 34, dy: -20, w: 60, h: 44 }, damage: 22, playerKb: [300, -200] } },
        { telegraph: 0.30, active: 0.12, phases: [2], hit: { box: { dx: 0, dy: -22, w: 96, h: 44 }, damage: 24, playerKb: [320, -220] } },
      ] },
    { id: 'lunge_thrust', use: { minX: 96, maxX: 320 }, cooldown: 4.0, token: 'none', telegraph: 0.60, active: 0.30, recovery: 0.70,
      move: { dist: 224, time: 0.3 }, hit: { box: { dx: 26, dy: -22, w: 44, h: 14 }, damage: 20, playerKb: [360, -160] } },
    { id: 'shield_bash', use: { minX: 0, maxX: 40 }, cooldown: 3.0, token: 'none', telegraph: 0.45, active: 0.10, recovery: 0.50,
      hit: { box: { dx: 18, dy: -22, w: 24, h: 40 }, damage: 15, playerKb: [380, -180], unblockable: true } },
    { id: 'dark_wave', phases: [2], use: { minX: 96, maxX: 480 }, cooldown: 3.5, token: 'none', telegraph: 0.60, active: 0, recovery: 0.60,
      shots: [{ projectile: 'dark_wave', angles: [0], aim: 'facing' }] },
    { id: 'leap_slam', phases: [2], use: { minX: 64, maxX: 9999 }, cooldown: 5.0, token: 'none', telegraph: 0.60, active: ENEMY.LEAP_MAX, recovery: 0.90,
      leap: { jumpToX: 0.7 }, hit: { box: { dx: 0, dy: -14, w: 96, h: 28 }, damage: 24, playerKb: [300, -240] } },
  ],
};

/** Stage 3 special rules (04 §6, §11). */
export const KINGDOM = {
  packBandStep: 24,                                 // War Hound band shifts by this per packIndex
  aimTrackS: 0.5, aimLockS: 0.2,                    // Crossbowman: the aim line tracks, then locks
  teleportRange: 64, teleportDistance: 176, teleportFadeOutS: 0.3, teleportFadeInS: 0.3, teleportCooldownS: 5.0,
  teleportGroundScan: 64,
  bulwarkS: 1.0, bulwarkCooldownS: { 1: 6.0, 2: 4.0 }, bulwarkBashRange: 48,
  transitionS: 1.0,
  leapWaveSpeed: 260, leapWaveRange: 128, darkWaveDx: 20,
  lootInset: 32, abilityDx: 24,
} as const;
