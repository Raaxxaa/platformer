// Shared boss layer (04 §9): spawn, intro, break, enrage, boss bar, death.
import type { GameWorld } from '../sim/gameWorld.ts';
import { BOSS, ticks } from '../tuning.ts';
import { ENEMIES } from '../../data/enemies.ts';
import { spawnEnemy, type EnemyState } from './enemy.ts';
import type { EnemyId } from './types.ts';
import type { ArenaRt } from '../run/arenas.ts';

export interface BossState {
  arenaId: string;
  introTicks: number;                 // 1.0 s intro after the lock: no attacks
  enraged: boolean;
}

export interface BossBar { name: string; title: string; marks: number[]; hp: number; maxHp: number }

/** 04 §9.2: spawned at load, dormant, 75% of the arena width from the entry side, facing the entry, on the floor. */
export function spawnBoss(w: GameWorld, a: ArenaRt, bossId: EnemyId, entry: 'left' | 'right'): EnemyState | null {
  if (!ENEMIES[bossId]) return null;
  const x = entry === 'left' ? a.rect.x + a.rect.w * BOSS.SPAWN_FRACTION : a.rect.x + a.rect.w * (1 - BOSS.SPAWN_FRACTION);
  const e = spawnEnemy(w, { enemy: bossId, x: Math.round(x), y: a.rect.y + a.rect.h, facing: entry === 'left' ? -1 : 1 });
  e.boss = { arenaId: a.id, introTicks: 0, enraged: false };
  w.enemies.push(e);
  return e;
}

/** On the arena lock: the boss wakes, aware, and plays its 1.0 s intro (04 §9.2). */
export function wakeBoss(e: EnemyState): void {
  e.dormant = false;
  e.aware = true;
  e.ai.state = 'engage';
  e.boss!.introTicks = BOSS.INTRO_TICKS;
}

/** After step 9: enrage at ≤ 50% HP, at once and with no pause (04 §9.3). */
export function stepBossPhases(w: GameWorld): void {
  for (const e of w.enemies) {
    if (!e.boss || e.dead || e.boss.enraged) continue;
    const b = e.def.boss;
    if (b && e.hp <= e.maxHp * b.enrageAt) e.boss.enraged = true;
  }
}

/** Attack gap in ticks: the enraged value once enraged. */
export function bossAttackGapTicks(e: EnemyState): number | null {
  if (!e.boss?.enraged || !e.def.boss) return null;
  return ticks(e.def.boss.attackGapEnraged);
}

/** The boss of a locked boss arena, for the bar (07 draws it). */
export function bossBar(w: GameWorld): BossBar | null {
  for (const e of w.enemies) {
    if (!e.boss || e.dead || !e.def.boss || !w.run.arenas[e.boss.arenaId]?.locked) continue;
    return { ...e.def.boss.bar, hp: e.hp, maxHp: e.maxHp };
  }
  return null;
}

/** 04 §9.5–9.6 on the killing tick: bossDefeated, boss groups and projectiles go, flask to max, exit door opens. */
export function onBossKilled(w: GameWorld, e: EnemyState): void {
  w.hitGroups = w.hitGroups.filter((g) => g.owner !== e.id);
  w.projectiles = w.projectiles.filter((p) => p.owner !== e.id);
  w.rockMarkers = [];
  w.flask.charges = w.flask.maxCharges;
  w.events.push({ t: 'bossDefeated', bossId: e.def.id, stage: w.stage });
  w.onStageBossDefeated();
  const a = w.arenas.get(e.boss!.arenaId);
  if (a) {
    for (const id of a.exitDoorIds) w.setBodyActive(id, false);
    w.run.arenas[a.id].locked = false;
  }
}
