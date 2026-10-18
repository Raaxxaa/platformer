import type { EnemyDef } from '../core/enemies/types.ts';
import { ENEMY, ticks } from '../core/tuning.ts';

const GUARDIAN = {
  tier: 'boss', elite: false, size: 'boss', kbResist: 1,
  notice: { range: 9999, rangeY: 9999, time: 0 },
  gold: 60, itemRoll: 'none', blueprintRoll: true, hpBar: 'boss'
} as const;

export const STONE_COLOSSUS: EnemyDef = {
  ...GUARDIAN, id: 'stone_colossus', hurtbox: { w: 56, h: 72 }, hp: 900, poiseMax: 160,
  walk: 35, chase: 35, preferred: [0, 64], attackGap: 1.2, turnDelay: 1,
  guard: { guardMult: .25, when: 'always', bypassAbove: true },
  boss: {
    breakTime: 2, breakMult: 1.25, attackGapEnraged: .8, enrageAt: .5,
    bar: { name: 'Stone Colossus', title: 'Guardian of the Mountain', marks: [.5] }
  },
  attacks: [
    { id: 'fist_slam', use: { minX: 0, maxX: 80 }, telegraph: .70, active: .12, recovery: .80, cooldown: 2, token: 'none',
      hit: { box: { dx: 44, dy: -16, w: 56, h: 32 }, damage: 22, playerKb: [300, -200] } },
    { id: 'shoulder_ram', use: { minX: 64, maxX: 200 }, telegraph: .70, active: .40, recovery: .90, cooldown: 4, token: 'none',
      move: { dist: 160, time: .4 },
      hit: { box: { dx: 30, dy: -36, w: 32, h: 64 }, damage: 20, playerKb: [320, -180] } },
    { id: 'leap_slam', use: { minX: 96, maxX: 9999 }, telegraph: .80, active: ENEMY.LEAP_MAX, recovery: 1, cooldown: 6, token: 'none',
      leap: { jumpToX: .9 },
      hit: { box: { dx: 0, dy: -12, w: 120, h: 24 }, damage: 24, playerKb: [300, -260] } },
    { id: 'rock_rain', use: { minX: 0, maxX: 9999 }, telegraph: 1, active: .10, recovery: .80, cooldown: 8, token: 'none' },
  ],
};

export const SPIDER_QUEEN: EnemyDef = {
  ...GUARDIAN, id: 'spider_queen', hurtbox: { w: 64, h: 36 }, hp: 850, poiseMax: 150,
  walk: 90, chase: 90, preferred: [64, 160], attackGap: 1, turnDelay: 0,
  boss: {
    breakTime: 2, breakMult: 1.25, attackGapEnraged: .6, enrageAt: .5,
    bar: { name: 'Spider Queen', title: 'Guardian of the Swamp', marks: [.66, .5, .33] }
  },
  attacks: [
    { id: 'ceiling_drop', use: { minX: 0, maxX: 9999 }, telegraph: .6 + 1, active: ENEMY.LEAP_MAX, recovery: 1.20, cooldown: 7, token: 'none',
      hit: { box: { dx: 0, dy: -12, w: 96, h: 24 }, damage: 24, playerKb: [280, -240] } },
    { id: 'fang_strike', use: { minX: 0, maxX: 72 }, telegraph: .50, active: .12, recovery: .60, cooldown: 1.8, token: 'none',
      hit: { box: { dx: 40, dy: -14, w: 48, h: 28 }, damage: 18 } },
    { id: 'pounce', use: { minX: 80, maxX: 224 }, telegraph: .55, active: ENEMY.LEAP_MAX, recovery: .60, cooldown: 3, token: 'none',
      leap: { vx: 360, vy: -300 },
      hit: { box: { dx: 24, dy: -12, w: 48, h: 28 }, damage: 18, playerKb: [260, -200] } },
    { id: 'venom_spit', use: { minX: 64, maxX: 320 }, telegraph: .60, active: 0, recovery: .60, cooldown: 3.5, token: 'none',
      shots: [{ projectile: 'venom_glob', angles: [0], aim: 'arc' }] },
    { id: 'brood', use: { minX: 0, maxX: 9999 }, telegraph: .80, active: 0, recovery: .40, cooldown: 15, token: 'none' },
  ],
};

export const GUARDIANS2 = {
  wallInset: 16, lootInset: 32, colossusTurnEnraged: .6,
  leapGravityHalf: ENEMY.GRAVITY / 2, leapWaveSpeed: 240, leapWaveRange: 160,
  rainOffsets: [-128, -64, 0, 64, 128], rainOffsetsEnraged: [-192, -128, -64, 0, 64, 128, 192], rainDamage: 16,
  queenClimbTicks: ticks(.6), queenFollowTicks: ticks(.7), queenLockTicks: ticks(.3), queenFallSpeed: 600,
  broodThresholds: [.66, .33],
} as const;
