// The Great Boar's specials (04 §10.1): charge to the wall, wall crash, rockfall, Stomp Quake waves.
import type { GameWorld } from '../sim/gameWorld.ts';
import { GREAT_BOAR, ticks } from '../tuning.ts';
import { ENEMY_PROJECTILES } from '../../data/enemyProjectiles.ts';
import { removeEnemyGroups, type AttackHooks } from './attack.ts';
import type { EnemyState } from './enemy.ts';
import { spawnEnemyProjectile } from './projectiles.ts';

export interface RockMarker { x: number; ticks: number; topY: number; owner: number }

function chargeSpeed(e: EnemyState): number {
  return e.boss?.enraged ? GREAT_BOAR.CHARGE_SPEED_ENRAGED : GREAT_BOAR.CHARGE_SPEED;
}

/** 3 rocks at x from `enemyAI`, uniform in the arena interior, at least 48 px apart (04 §10.1). */
function dropRocks(w: GameWorld, e: EnemyState): void {
  const a = w.arenas.get(e.boss!.arenaId);
  if (!a) return;
  const half = (ENEMY_PROJECTILES.falling_rock?.w ?? 0) / 2;
  const lo = a.rect.x + half, hi = a.rect.x + a.rect.w - half;
  const xs: number[] = [];
  for (let tries = 0; xs.length < GREAT_BOAR.ROCKS && tries < GREAT_BOAR.ROCK_TRIES; tries++) {
    const x = Math.round(lo + w.rng.enemyAI.next() * (hi - lo));
    if (xs.every((o) => Math.abs(o - x) >= GREAT_BOAR.ROCK_SPACING)) xs.push(x);
  }
  for (const x of xs) w.rockMarkers.push({ x, ticks: GREAT_BOAR.ROCK_MARKER_TICKS, topY: a.rect.y, owner: e.id });
}

function wallCrash(w: GameWorld, e: EnemyState): void {
  const a = e.ai.attack!;
  removeEnemyGroups(w, e);
  e.ai.cooldowns.set(a.def.id, ticks(a.def.cooldown));
  e.ai.attack = null;
  e.ai.state = 'engage';
  e.ai.gapTicks = 0;
  e.vx = 0;
  e.control = { type: 'dazed', ticks: e.boss?.enraged ? GREAT_BOAR.DAZE_ENRAGED_TICKS : GREAT_BOAR.DAZE_TICKS };
  w.requestShake(GREAT_BOAR.CRASH_SHAKE.amplitude, GREAT_BOAR.CRASH_SHAKE.seconds);
  if (e.boss?.enraged) dropRocks(w, e);
}

/** Markers count down; each then drops its rock from the arena top (world time). */
export function stepRockfall(w: GameWorld): void {
  const def = ENEMY_PROJECTILES.falling_rock;
  if (!def) return;
  for (const r of w.rockMarkers) r.ticks -= 1;
  for (const r of w.rockMarkers.filter((m) => m.ticks <= 0)) {
    const owner = w.enemies.find((e) => e.id === r.owner);
    if (!owner) continue;
    const p = spawnEnemyProjectile(w, owner, def, 'facing', 0, { x: r.x, y: r.topY + def.h / 2 });
    p.vx = 0;
    p.vy = def.speed ?? 0;
  }
  w.rockMarkers = w.rockMarkers.filter((m) => m.ticks > 0);
}

export function greatBoarHooks(e: EnemyState): AttackHooks {
  const def = e.ai.attack?.def;
  if (!def) return {};
  return {
    onActStart(w, en) {
      if (def.id === 'charge') en.vx = en.facing * chargeSpeed(en);
      for (const s of def.shots ?? []) {
        const pd = ENEMY_PROJECTILES[s.projectile];
        if (!pd) continue;
        for (const angle of s.angles) {
          const p = spawnEnemyProjectile(w, en, pd, 'facing', 0, { x: en.x, y: en.y });
          p.vx = (angle === 180 ? -1 : 1) * (pd.speed ?? 0);
        }
      }
    },
    onActTick(w, en) {
      if (def.id !== 'charge') return false;
      if (en.hitWall) { wallCrash(w, en); return true; }
      en.vx = en.facing * chargeSpeed(en);              // doesn't turn, ignores ledges
      return false;
    },
    onRecStart(_w, en) {
      en.vx = 0;
    },
  };
}
