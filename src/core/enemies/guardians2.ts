// Stage 2 Guardian movement, markers, impacts and forced Brood (04 §10.2–10.3).
import type { GameWorld } from '../sim/gameWorld.ts';
import type { EnemyState } from './enemy.ts';
import { GUARDIANS2 } from '../../data/guardians2.ts';
import { ENEMY_PROJECTILES } from '../../data/enemyProjectiles.ts';
import { spawnBrood, livingSpiderlings } from './spiderlings.ts';
import { spawnVenomSpit, spawnEnemyProjectile } from './projectiles.ts';
import { finishEnemyAct, spawnAttackGroup, startEnemyAttack, type AttackHooks } from './attack.ts';
import { dropMarkedRocks } from './greatBoar.ts';
import { KINGDOM } from '../../data/kingdom.ts';
import { CASTLE } from '../../data/castle.ts';

const LANDING = ['leap_slam', 'ceiling_drop', 'leap_chop', 'shockwave_slam'];

export interface GuardianState {
  marker: { x: number; y: number } | null;
  floorY: number;
  ceilingFeet: number;
  broodDone: boolean[];
  broodPending: number;
}

export const createGuardianState = (): GuardianState => ({
  marker: null, floorY: 0, ceilingFeet: 0,
  broodDone: GUARDIANS2.broodThresholds.map(() => false), broodPending: 0,
});

function state(e: EnemyState): GuardianState { return e.guardian ??= createGuardianState(); }
function bounds(w: GameWorld, e: EnemyState) { return e.boss ? w.arenas.get(e.boss.arenaId)?.rect : undefined; }

function targetX(w: GameWorld, e: EnemyState, x: number): number {
  const a = bounds(w, e);
  return a ? Math.max(a.x + GUARDIANS2.wallInset, Math.min(a.x + a.w - GUARDIANS2.wallInset, x)) : x;
}

export function guardianTeleStart(w: GameWorld, e: EnemyState): void {
  const id = e.ai.attack?.def.id;
  if (e.def.id === 'stone_colossus' && id === 'rock_rain') {
    const a = bounds(w, e);
    if (!a) return;
    const offsets = e.boss?.enraged ? GUARDIANS2.rainOffsetsEnraged : GUARDIANS2.rainOffsets;
    for (const dx of offsets) w.rockMarkers.push({
      x: targetX(w, e, w.body.x + dx), topY: a.y, owner: e.id,
      ticks: e.ai.attack!.len, damage: GUARDIANS2.rainDamage, attack: 'rock_rain',
    });
  }
  if (e.def.id === 'spider_queen' && id === 'ceiling_drop') {
    const g = state(e);
    g.floorY = e.y;
    g.ceilingFeet = (bounds(w, e)?.y ?? e.y) + e.def.hurtbox.h;
    g.marker = null;
    e.vy = 0;
  }
}

export function cancelGuardianAttack(w: GameWorld, e: EnemyState): void {
  if (e.guardian) e.guardian.marker = null;
  if (e.ai.attack?.def.id === 'rock_rain') w.rockMarkers = w.rockMarkers.filter(r => r.owner !== e.id);
}

/** Threshold intentions survive Break and simultaneous threshold crossings. */
export function queueQueenBroods(e: EnemyState): void {
  if (e.def.id !== 'spider_queen' || e.dead) return;
  const g = state(e);
  GUARDIANS2.broodThresholds.forEach((threshold, i) => {
    if (!g.broodDone[i] && e.hp <= e.maxHp * threshold) {
      g.broodDone[i] = true;
      g.broodPending++;
    }
  });
}

export function stepGuardianSpecial(w: GameWorld, e: EnemyState): boolean {
  if (e.def.id !== 'spider_queen') return false;
  const g = state(e);
  if (!e.ai.attack && g.broodPending > 0) {
    g.broodPending--;
    startEnemyAttack(w, e, e.def.attacks.find(a => a.id === 'brood')!);
    return true;
  }
  return false;
}

export function queenBroodEligible(w: GameWorld, e: EnemyState): boolean { return livingSpiderlings(w, e).length < 2; }

/** The thread holds the Queen at the ceiling; ordinary gravity resumes on interruption. */
export function stepGuardianBody(w: GameWorld, e: EnemyState): boolean {
  const a = e.ai.attack;
  if (e.def.id !== 'spider_queen' || a?.def.id !== 'ceiling_drop' || a.phase !== 'tele') return false;
  const g = state(e), fraction = Math.min(1, a.t / GUARDIANS2.queenClimbTicks);
  e.y = g.floorY + (g.ceilingFeet - g.floorY) * fraction;
  e.remY = 0; e.vx = 0; e.vy = 0; e.grounded = false;
  if (a.t >= GUARDIANS2.queenClimbTicks && a.t <= GUARDIANS2.queenClimbTicks + GUARDIANS2.queenFollowTicks) {
    g.marker = { x: targetX(w, e, w.body.x), y: g.floorY };
  }
  return true;
}

export function afterGuardianBody(w: GameWorld, e: EnemyState): void {
  const a = e.ai.attack;
  if (a?.phase === 'act' && e.grounded && LANDING.includes(a.def.id)) {
    finishEnemyAct(w, e, guardianAttackHooks(e) ?? {});
  }
}

function impact(w: GameWorld, e: EnemyState): void {
  spawnAttackGroup(w, e);
  const id = e.ai.attack!.groupId;
  if (id === null) return;
  const g = w.hitGroups.find(g => g.id === id)!;
  g.box = undefined;
  w.blasts.push(id); // Fixed melee impact survives this tick and is removed before the next simulation tick.
}

export function guardianAttackHooks(e: EnemyState): AttackHooks | null {
  const def = e.ai.attack?.def;
  if (!def || !['stone_colossus', 'spider_queen', 'black_knight', 'royal_executioner', 'enemy_king'].includes(e.def.id)) return null;
  if (['black_knight', 'royal_executioner', 'enemy_king'].includes(e.def.id) && !LANDING.includes(def.id)) return null;   // their other moves use the shared hooks
  const landing = LANDING.includes(def.id);
  return {
    deferHit: landing, untilLanding: landing,
    onActStart(w, en) {
      if (def.leap && 'jumpToX' in def.leap) {
        const time = def.leap.jumpToX;
        en.vx = (targetX(w, en, w.body.x) - en.x) / time;
        en.vy = -GUARDIANS2.leapGravityHalf * time;
        en.grounded = false;
      } else if (def.id === 'ceiling_drop') {
        en.x = state(en).marker?.x ?? targetX(w, en, w.body.x);
        en.remX = 0; en.vx = 0; en.vy = GUARDIANS2.queenFallSpeed; en.grounded = false;
      } else if (def.id === 'rock_rain') dropMarkedRocks(w, r => r.owner === en.id && r.attack === 'rock_rain');
      else if (def.id === 'brood') spawnBrood(w, en);
      else if (def.id === 'venom_spit') spawnVenomSpit(w, en);
      else if (def.leap && 'vx' in def.leap) {
        en.vx = en.facing * def.leap.vx; en.vy = def.leap.vy; en.grounded = false;
      } else if (def.move) en.vx = en.facing * def.move.dist / def.move.time;
    },
    onActTick(_w, en) {
      if (landing) return false;
      if (def.leap) return en.ai.attack!.t > 1 && en.grounded;
      if (def.move) en.vx = en.facing * def.move.dist / def.move.time;
      return false;
    },
    onRecStart(w, en) {
      en.vx = 0;
      if (landing) impact(w, en);
      if (def.id === 'leap_slam' || def.id === 'shockwave_slam') {
        const base = ENEMY_PROJECTILES.shockwave!;
        const knight = en.def.id === 'black_knight', king = en.def.id === 'enemy_king';
        const pd = king
          ? { ...base, h: CASTLE.king.slamWaveH, speed: CASTLE.king.slamWaveSpeed, range: undefined, hit: { ...base.hit, damage: CASTLE.king.slamWaveDamage, playerKb: def.hit!.playerKb } }   // to the walls (04 §12)
          : { ...base, speed: knight ? KINGDOM.leapWaveSpeed : GUARDIANS2.leapWaveSpeed, range: knight ? KINGDOM.leapWaveRange : GUARDIANS2.leapWaveRange, hit: { ...base.hit, playerKb: def.hit!.playerKb } };
        for (const dir of [-1, 1] as const) {
          const p = spawnEnemyProjectile(w, en, pd, 'facing', 0, { x: en.x, y: en.y });
          p.vx = dir * pd.speed; p.dir = dir;
          const g = w.hitGroups.find(g => g.id === p.groupId);
          if (g) g.dir = dir;
        }
      }
      if (en.guardian) en.guardian.marker = null;
    },
  };
}
