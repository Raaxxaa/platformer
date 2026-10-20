// Enemy runtime state, spawning with stage scaling, and activation (04 §2.2–2.3).
import { newStatus, type EnemyStatus } from '../combat/status.ts';
import { roundHalfUp } from '../math.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { ENEMY, STAGE_SCALING, TILE_SIZE, VIEW_H, VIEW_W } from '../tuning.ts';
import { ENEMIES } from '../../data/enemies.ts';
import type { EnemyAttackDef, EnemyDef, EnemySpawn } from './types.ts';
import type { BossState } from './boss.ts';
import type { GuardianState } from './guardians2.ts';

export type AiStateId = 'idle' | 'patrol' | 'alert' | 'engage' | 'attack' | 'return' | 'dazed';

/** Stagger and dazed (04) plus 02 §4.4's control effects. Launch counts down only after landing; pull moves to `to`. */
export interface EnemyControl {
  type: 'stagger' | 'knockdown' | 'dazed' | 'stun' | 'pin' | 'launch' | 'pull';
  ticks: number;
  landed?: boolean;
  to?: { x: number; y: number; speed: number };
  /** Stun to apply when a pull ends (Grapple Arrow). */
  thenStun?: number;
  /** What the thenStun time is: a plain stun (default) or a forced stagger that ignores poise (Flail, 02 §10.5). */
  thenType?: 'stun' | 'stagger';
}

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
  pendingAwareAt: number;          // alert spread: world tick to become aware at (−1 = none)
  backingOff: boolean;             // Wolf: back off after an attack
  turnTicks: number;
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
  frozenAtTickStart: boolean;      // in hit-stop when the tick began: its attack boxes don't test overlap (02 §2.1)
  control: EnemyControl | null;
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
  /** Arena waves: 0.5 s spawn-in, invulnerable and unable to act (04 §2.2). */
  spawnInTicks: number;
  /** Arena waves never return home (04 §2.2); `arena` is the arena id for the stuck rule (06 §9.2). */
  waveArena: string | null;
  outsideTicks: number;
  /** Bosses only (04 §9). */
  boss: BossState | null;
  /** Element statuses (02 §6). */
  status: EnemyStatus;
  /** The weapon whose hit or effect killed it (null: an ability or nothing), for Greedy and Wind (05 §4.4, 02 §6.6). */
  killedBy?: import('../combat/types.ts').WeaponInstance | null;
  /** 04 §2.9 elite item roll, made at stage load. */
  drop?: 'key' | 'ability' | null;
  ward: { hp: number; ticks: number; sourceId: number } | null;
  mountain?: { waypoint?: { x:number; y:number }; waypointTicks: number; blinkTicks: number };
  swamp?: { submerged: boolean; hanging: boolean; harmlessDrop: boolean; reactionTicks: number; hopActive: boolean; marker: { x:number; y:number } | null; detonating: boolean; explosionId: number | null };
  noRewards: boolean;
  summonOwner?: number;
  guardian?: GuardianState;
}

/** Stage-scaled attack damage A (a float; 02 §3.3 rounds it). */
export function enemyDamageA(w: GameWorld, base: number): number {
  return base * STAGE_SCALING[w.stage].dmg;
}

export function spawnEnemy(w: GameWorld, s: EnemySpawn): EnemyState {
  const def = ENEMIES[s.enemy];
  if (!def) throw new Error(`unknown enemy ${s.enemy}`);
  const scale = def.tier === 'dummy' || def.tier === 'target' ? 1 : def.tier === 'boss' ? STAGE_SCALING[w.stage].bossHp : STAGE_SCALING[w.stage].mobHp;
  const maxHp = roundHalfUp(def.hp * scale);
  return {
    id: w.newId(), def, x: s.x, y: s.y, remX: 0, remY: 0, vx: 0, vy: 0, facing: s.facing,
    hp: maxHp, maxHp, poise: def.poiseMax, poiseImmuneTicks: 0, noPoiseHitTicks: 0,
    aware: def.id === 'sparring_dummy', noticeT: 0,     // the sparring dummy is always aware (04 §2.11)
    ai: { state: s.patrol ? 'patrol' : 'idle', t: 0, gapTicks: 0, cooldowns: new Map(), attack: null, patrolDir: s.facing, patrolWait: 0, lostTicks: 0, pendingAwareAt: -1, backingOff: false, turnTicks: 0 },
    hitStopTicks: 0, frozenAtTickStart: false, control: null, knockback: false, grounded: true, hitWall: false,
    dormant: true, dead: false, deathTicks: 0, spawn: s, lastPlayerHitTick: -100000, token: null,
    damagedTicks: 0, everDamaged: false, hurtFlashTicks: 0, spawnInTicks: 0, waveArena: null, outsideTicks: 0, boss: null, status: newStatus(), ward: null, noRewards: def.tier==='summon',
    swamp: ['bog_zombie','giant_spider','wisp','swamp_witch','treant'].includes(def.id) ? {
      submerged: def.id==='bog_zombie' && (s.submerged ?? w.grid.kindAt(Math.floor(s.x/TILE_SIZE),Math.floor((s.y-1)/TILE_SIZE))==='water'),
      hanging: def.id==='giant_spider' && s.hang===true, harmlessDrop:false,reactionTicks:0,hopActive:false,marker:null,detonating:false,explosionId:null,
    } : undefined,
  };
}

/** 04 §2.2: a dormant enemy activates once its spawn point is in the camera view grown by 96 px. */
export function activateEnemies(w: GameWorld): void {
  const c = w.camera, m = ENEMY.ACTIVATION_MARGIN;
  for (const e of w.enemies) {
    if (!e.dormant || e.boss) continue;     // bosses wake on the arena lock (04 §9.2)
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

/** Invisible submerged enemies and irreversible explosions cannot be selected or damaged (04 §5). */
export function enemyHittable(e: EnemyState): boolean {
  return !e.dead && !e.dormant && e.spawnInTicks===0 && !e.swamp?.submerged && !e.swamp?.detonating;
}
