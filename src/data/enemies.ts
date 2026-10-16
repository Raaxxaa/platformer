// Stage 1 enemies and the Training Dummy (04 §3, §2.10). Stage-1 base values; scaling is applied at spawn.
import type { EnemyDef, EnemyId } from '../core/enemies/types.ts';
import { ENEMY } from '../core/tuning.ts';

const REGULAR = { tier: 'regular', elite: false, attackGap: ENEMY.ATTACK_GAP_REGULAR, turnDelay: 0, itemRoll: 'none', blueprintRoll: false, hpBar: 'damaged' } as const;

export const ENEMIES: Partial<Record<EnemyId, EnemyDef>> & Record<'wolf' | 'bandit' | 'bandit_archer' | 'wild_boar' | 'bandit_brute' | 'training_dummy' | 'great_boar', EnemyDef> = {
  wolf: {
    ...REGULAR, id: 'wolf', size: 'small', hurtbox: { w: 28, h: 16 }, hp: 30, poiseMax: 10, kbResist: 0,
    walk: 60, chase: 150, notice: { range: 176, rangeY: ENEMY.NOTICE_RANGE_Y, time: 0.35 }, preferred: [72, 112], gold: 3, dropsLedges: true,
    attacks: [
      { id: 'lunge_bite', use: { minX: 48, maxX: 112, minDY: -24, maxDY: 16 }, cooldown: 1.6, token: 'melee',
        telegraph: 0.40, active: ENEMY.LEAP_MAX, recovery: 0.45, leap: { vx: 320, vy: -180 },
        hit: { box: { dx: 14, dy: -8, w: 22, h: 14 }, damage: 10 } },
      { id: 'snap', use: { minX: 0, maxX: 40 }, cooldown: 1.0, token: 'melee', telegraph: 0.35, active: 0.10, recovery: 0.35,
        hit: { box: { dx: 16, dy: -8, w: 20, h: 14 }, damage: 8 } },
    ],
  },
  bandit: {
    ...REGULAR, id: 'bandit', size: 'medium', hurtbox: { w: 14, h: 28 }, hp: 40, poiseMax: 20, kbResist: 0.1,
    walk: 50, chase: 95, notice: { range: 160, rangeY: ENEMY.NOTICE_RANGE_Y, time: 0.45 }, preferred: [20, 32], gold: 4,
    attacks: [
      { id: 'slash', use: { minX: 0, maxX: 36 }, weight: 2, cooldown: 1.2, token: 'melee', telegraph: 0.45, active: 0.10, recovery: 0.40,
        hit: { box: { dx: 20, dy: -14, w: 32, h: 24 }, damage: 10 } },
      { id: 'lunge_stab', use: { minX: 40, maxX: 80 }, cooldown: 3.0, token: 'melee', telegraph: 0.50, active: 0.20, recovery: 0.50,
        move: { dist: 64, time: 0.2 }, hit: { box: { dx: 18, dy: -14, w: 28, h: 10 }, damage: 12 } },
    ],
  },
  bandit_archer: {
    ...REGULAR, id: 'bandit_archer', size: 'medium', hurtbox: { w: 14, h: 28 }, hp: 28, poiseMax: 10, kbResist: 0.1,
    walk: 50, chase: 70, notice: { range: 240, rangeY: ENEMY.NOTICE_RANGE_Y, time: 0.50 }, preferred: [120, 220], backOff: 96, gold: 4,
    attacks: [
      { id: 'arrow', use: { minX: 64, maxX: 240, minDY: ENEMY.RANGED_DY_MIN, maxDY: ENEMY.RANGED_DY_MAX }, cooldown: 1.8, token: 'ranged',
        telegraph: 0.60, active: 0, recovery: 0.50, shots: [{ projectile: 'enemy_arrow', angles: [0], aim: 'player' }] },
      { id: 'kick', use: { minX: 0, maxX: 32 }, cooldown: 2.0, token: 'melee', telegraph: 0.35, active: 0.08, recovery: 0.40,
        hit: { box: { dx: 14, dy: -12, w: 18, h: 16 }, damage: 8, playerKb: [260, -120] } },
    ],
  },
  wild_boar: {
    ...REGULAR, id: 'wild_boar', size: 'medium', hurtbox: { w: 30, h: 20 }, hp: 45, poiseMax: 30, kbResist: 0.3,
    walk: 40, chase: 70, notice: { range: 192, rangeY: ENEMY.NOTICE_RANGE_Y, time: 0.40 }, preferred: [24, 200], gold: 4,
    attacks: [
      { id: 'charge', use: { minX: 32, maxX: 256, minDY: -16, maxDY: 16 }, cooldown: 2.5, token: 'melee', telegraph: 0.60, active: 0.90, recovery: 0.60,
        move: { dist: 270, time: 0.90 }, hit: { box: { dx: 14, dy: -10, w: 24, h: 18 }, damage: 12, playerKb: [300, -200] } },
      { id: 'tusk_jab', use: { minX: 0, maxX: 28 }, cooldown: 1.5, token: 'melee', telegraph: 0.45, active: 0.10, recovery: 0.45,
        hit: { box: { dx: 14, dy: -10, w: 22, h: 18 }, damage: 10 } },
    ],
  },
  bandit_brute: {
    id: 'bandit_brute', tier: 'elite', elite: true, size: 'large', hurtbox: { w: 24, h: 40 }, hp: 160, poiseMax: 70, kbResist: 0.7,
    walk: 40, chase: 70, notice: { range: 160, rangeY: ENEMY.NOTICE_RANGE_Y, time: 0.50 }, preferred: [24, 40], gold: 20,
    attackGap: ENEMY.ATTACK_GAP_ELITE, turnDelay: 0, itemRoll: 'elite', blueprintRoll: true, hpBar: 'always',
    attacks: [
      { id: 'club_swing', use: { minX: 0, maxX: 48 }, cooldown: 1.4, token: 'melee', telegraph: 0.55, active: 0.12, recovery: 0.55,
        hit: { box: { dx: 26, dy: -20, w: 44, h: 36 }, damage: 18, playerKb: [260, -160] } },
      { id: 'overhead_smash', use: { minX: 0, maxX: 56 }, cooldown: 3.5, token: 'melee', telegraph: 0.80, active: 0.10, recovery: 0.80,
        hit: { box: { dx: 30, dy: -12, w: 40, h: 24 }, damage: 22, playerKb: [300, -240] },
        shots: [{ projectile: 'brute_wave', angles: [0], aim: 'facing' }] },
    ],
  },
  // 04 §9.1, §10.1. Bosses: always aware, no tokens, kbResist 1.0.
  great_boar: {
    id: 'great_boar', tier: 'boss', elite: false, size: 'boss', hurtbox: { w: 64, h: 40 }, hp: 900, poiseMax: 150, kbResist: 1.0,
    walk: 70, chase: 70, notice: { range: 9999, rangeY: 9999, time: 0 }, preferred: [0, 72], gold: 60,
    attackGap: 1.0, turnDelay: 0, itemRoll: 'none', blueprintRoll: false, hpBar: 'boss',
    boss: { breakTime: 2.0, breakMult: 1.25, attackGapEnraged: 0.6, enrageAt: 0.5,
      bar: { name: 'Great Boar', title: 'Guardian of the Plains', marks: [0.5] } },
    attacks: [
      // Charge: 380 px/s (440 enraged) until it hits a wall, at most 2.0 s; doesn't turn, ignores ledges.
      { id: 'charge', use: { minX: 96, maxX: 9999 }, cooldown: 3.0, token: 'none', telegraph: 0.75, active: 2.0, recovery: 0.50,
        move: { dist: 760, time: 2.0 }, hit: { box: { dx: 28, dy: -20, w: 40, h: 36 }, damage: 20, playerKb: [360, -260] } },
      { id: 'tusk_toss', use: { minX: 0, maxX: 72 }, cooldown: 2.5, token: 'none', telegraph: 0.55, active: 0.15, recovery: 0.60,
        hit: { box: { dx: 36, dy: -24, w: 48, h: 48 }, damage: 18, playerKb: [200, -420] } },
      // Stomp Quake: the close box and 2 shockwaves (one each way, from its feet) on the same Act tick.
      { id: 'stomp_quake', use: { minX: 0, maxX: 9999 }, cooldown: 5.0, token: 'none', telegraph: 0.70, active: 0.10, recovery: 0.70,
        hit: { box: { dx: 0, dy: -8, w: 96, h: 16 }, damage: 18, playerKb: [260, -200] },
        shots: [{ projectile: 'shockwave', angles: [0, 180], aim: 'facing' }] },
    ],
  },
  training_dummy: {
    id: 'training_dummy', tier: 'dummy', elite: false, size: 'medium', hurtbox: { w: 16, h: 32 }, hp: 9999, poiseMax: 50, kbResist: 1.0,
    walk: 0, chase: 0, notice: { range: 0, rangeY: 0, time: 0 }, preferred: [0, 0], attackGap: 0, turnDelay: 0, stationary: true,
    gold: 0, itemRoll: 'none', blueprintRoll: false, hpBar: 'damaged', attacks: [],
  },
};
