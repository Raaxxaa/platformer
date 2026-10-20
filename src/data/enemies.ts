// Stage 1 enemies and the Training Dummy (04 §3, §2.10). Stage-1 base values; scaling is applied at spawn.
import type { EnemyDef, EnemyId } from '../core/enemies/types.ts';
import { ENEMY } from '../core/tuning.ts';
import { STONE_COLOSSUS, SPIDER_QUEEN } from './guardians2.ts';
import { SPIDERLING } from './spiderlings.ts';
import { ROYAL_GUARD, GARGOYLE, CASTLE_MAGE, LIVING_ARMOR, ROYAL_EXECUTIONER, ENEMY_KING } from './castle.ts';
import { SOLDIER, CROSSBOWMAN, WAR_HOUND, BATTLE_MAGE, KNIGHT, BLACK_KNIGHT } from './kingdom.ts';

const REGULAR = { tier: 'regular', elite: false, attackGap: ENEMY.ATTACK_GAP_REGULAR, turnDelay: 0, itemRoll: 'none', blueprintRoll: false, hpBar: 'damaged' } as const;

export const ENEMIES: Partial<Record<EnemyId, EnemyDef>> & Record<'wolf' | 'bandit' | 'bandit_archer' | 'wild_boar' | 'bandit_brute' | 'training_dummy' | 'sparring_dummy' | 'straw_target' | 'great_boar' | 'bat_swarm' | 'goblin_miner' | 'rock_golem' | 'ram' | 'goblin_shaman' | 'bog_zombie' | 'giant_spider' | 'wisp' | 'swamp_witch' | 'treant' | 'soldier' | 'crossbowman' | 'war_hound' | 'battle_mage' | 'knight' | 'black_knight' | 'royal_guard' | 'gargoyle' | 'castle_mage' | 'living_armor' | 'royal_executioner' | 'enemy_king', EnemyDef> = {
  royal_guard: ROYAL_GUARD, gargoyle: GARGOYLE, castle_mage: CASTLE_MAGE, living_armor: LIVING_ARMOR, royal_executioner: ROYAL_EXECUTIONER, enemy_king: ENEMY_KING,
  soldier: SOLDIER, crossbowman: CROSSBOWMAN, war_hound: WAR_HOUND, battle_mage: BATTLE_MAGE, knight: KNIGHT, black_knight: BLACK_KNIGHT,
  stone_colossus: STONE_COLOSSUS,
  spider_queen: SPIDER_QUEEN,
  spiderling: SPIDERLING,
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
  bat_swarm: {
    ...REGULAR, id: 'bat_swarm', size: 'small', hurtbox: { w: 24, h: 16 }, hp: 25, poiseMax: 0, kbResist: 0,
    walk: 0, chase: 0, fly: 110, flying: true, noFacing: true, notice: { range: 160, rangeY: 128, time: .30 }, preferred: [0, 0], gold: 3,
    attacks: [{ id: 'dive_bite', use: { minX: 0, maxX: 96, minDY: -96, maxDY: 96 }, cooldown: 1.5, token: 'melee', telegraph: .40, active: .50, recovery: .60,
      hit: { box: { dx: 0, dy: -8, w: 20, h: 14 }, damage: 8 } }],
  },
  goblin_miner: {
    ...REGULAR, id: 'goblin_miner', size: 'small', hurtbox: { w: 12, h: 20 }, hp: 30, poiseMax: 10, kbResist: 0,
    walk: 55, chase: 70, notice: { range: 192, rangeY: ENEMY.NOTICE_RANGE_Y, time: .45 }, preferred: [80, 180], gold: 4,
    attacks: [
      { id: 'bomb_toss', use: { minX: 48, maxX: 200 }, cooldown: 2.2, token: 'ranged', telegraph: .55, active: 0, recovery: .50,
        shots: [{ projectile: 'bomb', angles: [0], aim: 'arc' }] },
      { id: 'pick_swing', use: { minX: 0, maxX: 30 }, cooldown: 1.2, token: 'melee', telegraph: .40, active: .10, recovery: .40,
        hit: { box: { dx: 14, dy: -10, w: 20, h: 18 }, damage: 9 } },
    ],
  },
  rock_golem: {
    ...REGULAR, id: 'rock_golem', size: 'large', hurtbox: { w: 26, h: 32 }, hp: 60, poiseMax: 40, kbResist: .6,
    walk: 35, chase: 35, notice: { range: 128, rangeY: ENEMY.NOTICE_RANGE_Y, time: .60 }, preferred: [20, 40], gold: 5, turnDelay: .8,
    guard: { guardMult: .25, when: 'always', bypassAbove: true },
    attacks: [
      { id: 'fist_slam', use: { minX: 0, maxX: 44 }, cooldown: 1.6, token: 'melee', telegraph: .65, active: .12, recovery: .70,
        hit: { box: { dx: 24, dy: -10, w: 36, h: 20 }, damage: 14 } },
      { id: 'shoulder_ram', use: { minX: 48, maxX: 120 }, cooldown: 3, token: 'melee', telegraph: .60, active: .30, recovery: .70,
        move: { dist: 96, time: .3 }, hit: { box: { dx: 16, dy: -16, w: 24, h: 30 }, damage: 12, playerKb: [280, -180] } },
    ],
  },
  ram: {
    ...REGULAR, id: 'ram', size: 'medium', hurtbox: { w: 26, h: 22 }, hp: 40, poiseMax: 25, kbResist: .3,
    walk: 50, chase: 90, notice: { range: 176, rangeY: ENEMY.NOTICE_RANGE_Y, time: .40 }, preferred: [24, 56], gold: 4,
    attacks: [
      { id: 'headbutt', use: { minX: 0, maxX: 64 }, cooldown: 1.8, token: 'melee', telegraph: .55, active: .20, recovery: .60,
        move: { dist: 72, time: .2 }, hit: { box: { dx: 16, dy: -11, w: 22, h: 20 }, damage: 11, playerKb: [420, -220] } },
      { id: 'leap_butt', use: { minX: 0, maxX: 96, minDY: -64, maxDY: -24 }, cooldown: 3, token: 'melee', telegraph: .60, active: ENEMY.LEAP_MAX, recovery: .50,
        leap: { vx: 160, vy: -420 }, hit: { box: { dx: 16, dy: -11, w: 22, h: 20 }, damage: 11, playerKb: [420, -220] } },
    ],
  },
  goblin_shaman: {
    id: 'goblin_shaman', tier: 'elite', elite: true, size: 'large', hurtbox: { w: 14, h: 24 }, hp: 120, poiseMax: 50, kbResist: .5,
    walk: 50, chase: 60, notice: { range: 208, rangeY: ENEMY.NOTICE_RANGE_Y, time: .50 }, preferred: [120, 200], gold: 20,
    attackGap: ENEMY.ATTACK_GAP_ELITE, turnDelay: 0, itemRoll: 'elite', blueprintRoll: true, hpBar: 'always',
    attacks: [
      { id: 'stone_ward', use: { minX: 0, maxX: 0 }, cooldown: 7, token: 'none', telegraph: .60, active: 0, recovery: .40 },
      { id: 'hex_bolt', use: { minX: 48, maxX: 224 }, cooldown: 2, token: 'ranged', telegraph: .55, active: 0, recovery: .50,
        shots: [{ projectile: 'hex_bolt', angles: [0], aim: 'player' }] },
      { id: 'stone_spikes', use: { minX: 0, maxX: 64 }, cooldown: 4, token: 'melee', telegraph: .70, active: .20, recovery: .60,
        hit: { box: { dx: 36, dy: -12, w: 64, h: 24 }, damage: 20, playerKb: [200, -300] } },
    ],
  },
  bog_zombie: {
    ...REGULAR, id:'bog_zombie',size:'medium',hurtbox:{w:14,h:28},hp:45,poiseMax:20,kbResist:.2,walk:40,chase:40,
    notice:{range:128,rangeY:ENEMY.NOTICE_RANGE_Y,time:.60},preferred:[16,32],gold:4,waterWalker:true,
    attacks:[
      {id:'rise_swipe',use:{minX:0,maxX:0},cooldown:0,token:'none',telegraph:.80,active:.10,recovery:.40,hit:{box:{dx:0,dy:-14,w:24,h:28},damage:10}},
      {id:'claw',use:{minX:0,maxX:36},cooldown:1.4,token:'melee',telegraph:.50,active:.10,recovery:.50,hit:{box:{dx:18,dy:-16,w:28,h:24},damage:11}},
      {id:'grab_lunge',use:{minX:0,maxX:56},cooldown:3.5,token:'melee',telegraph:.60,active:.20,recovery:.70,move:{dist:40,time:.2},hit:{box:{dx:20,dy:-16,w:24,h:20},damage:13,status:{id:'poisoned',stacks:1}}},
    ],
  },
  giant_spider: {
    ...REGULAR,id:'giant_spider',size:'medium',hurtbox:{w:26,h:16},hp:35,poiseMax:15,kbResist:.2,walk:70,chase:110,
    notice:{range:160,rangeY:ENEMY.NOTICE_RANGE_Y,time:.40},preferred:[24,96],gold:4,
    attacks:[
      {id:'drop',use:{minX:0,maxX:0},cooldown:0,token:'none',telegraph:.35,active:0,recovery:.40,hit:{box:{dx:0,dy:-8,w:24,h:16},damage:12}},
      {id:'bite',use:{minX:0,maxX:32},cooldown:1.2,token:'melee',telegraph:.40,active:.10,recovery:.40,hit:{box:{dx:16,dy:-8,w:20,h:14},damage:9}},
      {id:'pounce',use:{minX:48,maxX:128},cooldown:2.5,token:'melee',telegraph:.50,active:ENEMY.LEAP_MAX,recovery:.50,leap:{vx:280,vy:-260},hit:{box:{dx:12,dy:-8,w:22,h:14},damage:11}},
    ],
  },
  wisp: {
    ...REGULAR,id:'wisp',size:'small',hurtbox:{w:14,h:14},hp:25,poiseMax:0,kbResist:0,walk:0,chase:0,fly:70,flying:true,ghost:true,noFacing:true,
    notice:{range:192,rangeY:128,time:.30},preferred:[0,0],gold:3,
    attacks:[{id:'detonate',use:{minX:0,maxX:40,minDY:-40,maxDY:40},cooldown:0,token:'melee',telegraph:.70,active:.10,recovery:0,hit:{box:{dx:0,dy:-7,w:72,h:72},damage:14,playerKb:[260,-200]}}],
  },
  swamp_witch: {
    ...REGULAR,id:'swamp_witch',size:'medium',hurtbox:{w:14,h:28},hp:32,poiseMax:10,kbResist:.1,walk:45,chase:60,
    notice:{range:224,rangeY:ENEMY.NOTICE_RANGE_Y,time:.50},preferred:[120,200],gold:4,
    attacks:[
      {id:'poison_potion',use:{minX:64,maxX:224},cooldown:2.6,token:'ranged',telegraph:.60,active:0,recovery:.50,shots:[{projectile:'potion',angles:[0],aim:'arc'}]},
      {id:'claw',use:{minX:0,maxX:28},cooldown:1.5,token:'melee',telegraph:.40,active:.10,recovery:.40,hit:{box:{dx:14,dy:-14,w:20,h:20},damage:8}},
    ],
  },
  treant: {
    id:'treant',tier:'elite',elite:true,size:'large',hurtbox:{w:30,h:52},hp:170,poiseMax:80,kbResist:.8,walk:30,chase:30,
    notice:{range:160,rangeY:ENEMY.NOTICE_RANGE_Y,time:.60},preferred:[32,64],gold:20,attackGap:ENEMY.ATTACK_GAP_ELITE,turnDelay:.6,itemRoll:'elite',blueprintRoll:true,hpBar:'always',
    attacks:[
      {id:'root_snare',use:{minX:0,maxX:224,minDY:-64,maxDY:64},cooldown:4,token:'none',telegraph:.80,active:.25,recovery:.60,gapAfter:1.2,hit:{box:{dx:0,dy:-20,w:40,h:40},damage:12,status:{id:'rooted',duration:1}}},
      {id:'branch_slam',use:{minX:0,maxX:64},cooldown:1.6,token:'melee',telegraph:.65,active:.12,recovery:.70,hit:{box:{dx:34,dy:-20,w:52,h:40},damage:20,playerKb:[280,-200]}},
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
  // 04 §2.11: the Training Dummy with a practice sword; swings while the player is within 64 px; 0 damage.
  sparring_dummy: {
    id: 'sparring_dummy', tier: 'dummy', elite: false, size: 'medium', hurtbox: { w: 16, h: 32 }, hp: 9999, poiseMax: 50, kbResist: 1.0,
    walk: 0, chase: 0, notice: { range: 0, rangeY: 0, time: 0 }, preferred: [0, 0], attackGap: 0, turnDelay: 0, stationary: true,
    gold: 0, itemRoll: 'none', blueprintRoll: false, hpBar: 'damaged',
    attacks: [{ id: 'practice_swing', use: { minX: 0, maxX: 64 }, cooldown: 0, token: 'none', telegraph: 0.6, active: 0.1, recovery: 1.3,
      hit: { box: { dx: 24, dy: -16, w: 40, h: 28 }, damage: 0, playerKb: [120, -80] } }],
  },
  // 04 §2.12: HP 1, never acts; Rush only; respawns 3.0 s after breaking.
  straw_target: {
    id: 'straw_target', tier: 'target', elite: false, size: 'small', hurtbox: { w: 12, h: 24 }, hp: 1, poiseMax: 0, kbResist: 1.0,
    walk: 0, chase: 0, notice: { range: 0, rangeY: 0, time: 0 }, preferred: [0, 0], attackGap: 0, turnDelay: 0, stationary: true,
    gold: 0, itemRoll: 'none', blueprintRoll: false, hpBar: 'damaged', attacks: [],
  },
};

/** 04 §2.11–2.12 timings. */
export const TRAINING = { sparringReach: 64, strawRespawnS: 3.0 } as const;
