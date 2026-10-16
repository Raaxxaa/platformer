// Enemy runtime state, spawning with stage scaling, and activation (04 §2.2–2.3).
import { roundHalfUp } from '../math.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { ENEMY, STAGE_SCALING, VIEW_H, VIEW_W } from '../tuning.ts';
import { ENEMIES } from '../../data/enemies.ts';
import type { EnemyAttackDef, EnemyDef, EnemySpawn } from './types.ts';

export type AiStateId = 'idle' | 'patrol' | 'alert' | 'engage' | 'attack' | 'return' | 'dazed';

export interface RunningAttack {
  def: EnemyAttackDef;
  phase: 'tele' | 'act' | 'rec';
  t: number;                       // ticks spent in the phase
  len: number;                     // phase length in ticks
  groupId: number | null;          // the attack's melee hit group while active
  moved: number;                   // px moved by an attack move
  hitDone: boolean;
}

export interface AiState {
  state: AiStateId;
  t: number;                       // ticks in the state
  gapTicks: number;                // attack-gap timer (counts down)
  cooldowns: Map<string, number>;  // ticks left per attack id
  attack: RunningAttack | null;
  patrolDir: 1 | -1;
  patrolWait: number;
  lostTicks: number;               // ticks the player has been beyond loseRange
  pendingAwareTicks: number;       // alert spread: becomes aware when this reaches 0 (−1 = none)
  backingOff: boolean;             // Wolf: back off after an attack
}

export interface EnemyState {
  id: number; def: EnemyDef;
  x: number; y: number; remX: number; remY: number; vx: number; vy: number;
  facing: 1 | -1;
  hp: number; maxHp: number;
  poise: number; poiseImmuneTicks: number; noPoiseHitTicks: number;
  aware: boolean; noticeT: number;
  ai: AiState;
  hitStopTicks: number;
  control: { type: 'stagger' | 'knockdown' | 'dazed'; ticks: number } | null;
  knockback: boolean;
  grounded: boolean;
  hitWall: boolean;                // moveX hit a wall this tick
  dormant: boolean; dead: boolean; deathTicks: number;
  spawn: EnemySpawn;
  lastPlayerHitTick: number;
  token: 'melee' | 'ranged' | null;
  damagedTicks: number;            // ticks since the last damage (dummy heal, HP bar)
  everDamaged: boolean;
  hurtFlashTicks: number;
}

/** Stage-scaled attack damage A (a float; 02 §3.3 rounds it). */
export function enemyDamageA(w: GameWorld, base: number): number {
  return base * STAGE_SCALING[w.stage].dmg;
}

export function spawnEnemy(w: GameWorld, s: EnemySpawn): EnemyState {
  const def = ENEMIES[s.enemy];
  if (!def) throw new Error(`unknown enemy ${s.enemy}`);
  const scale = def.tier === 'dummy' ? 1 : def.tier === 'boss' ? STAGE_SCALING[w.stage].bossHp : STAGE_SCALING[w.stage].mobHp;
  const maxHp = roundHalfUp(def.hp * scale);
  return {
    id: w.newId(), def, x: s.x, y: s.y, remX: 0, remY: 0, vx: 0, vy: 0, facing: s.facing,
    hp: maxHp, maxHp, poise: def.poiseMax, poiseImmuneTicks: 0, noPoiseHitTicks: 0,
    aware: false, noticeT: 0,
    ai: { state: s.patrol ? 'patrol' : 'idle', t: 0, gapTicks: 0, cooldowns: new Map(), attack: null, patrolDir: s.facing, patrolWait: 0, lostTicks: 0, pendingAwareTicks: -1, backingOff: false },
    hitStopTicks: 0, control: null, knockback: false, grounded: true, hitWall: false,
    dormant: true, dead: false, deathTicks: 0, spawn: s, lastPlayerHitTick: -100000, token: null,
    damagedTicks: 0, everDamaged: false, hurtFlashTicks: 0,
  };
}

/** 04 §2.2: a dormant enemy activates once its spawn point is in the camera view grown by 96 px. */
export function activateEnemies(w: GameWorld): void {
  const c = w.camera, m = ENEMY.ACTIVATION_MARGIN;
  for (const e of w.enemies) {
    if (!e.dormant) continue;
    const { x, y } = e.spawn;
    if (x >= c.x - m && x <= c.x + VIEW_W + m && y >= c.y - m && y <= c.y + VIEW_H + m) e.dormant = false;
  }
}

/** Hurtbox rect (top-left) of an enemy. */
export function enemyRect(e: EnemyState): { x: number; y: number; w: number; h: number } {
  const { w, h } = e.def.hurtbox;
  return { x: e.x - w / 2, y: e.y - h, w, h };
}

export function enemyCenter(e: EnemyState): { x: number; y: number } {
  return { x: e.x, y: e.y - e.def.hurtbox.h / 2 };
}
