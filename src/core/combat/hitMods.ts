// Who changes a player hit (02 §3.1 steps 4–6, §3.2): the additive bonus pool, guaranteed crits and target
// multipliers. Bonds, hybrids and abilities add their parts here (03 §5–§12).
import { enemyCenter, type EnemyState } from '../enemies/enemy.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import type { HitGroup } from './hitGroups.ts';
import { statValue } from '../economy/stats.ts';

export interface HitModSource {
  /** Before damage, on the landing (first direct hit) of an attack instance on an enemy. */
  landing?(w: GameWorld, g: HitGroup, e: EnemyState): void;
  /** After a direct hit's damage. */
  afterHit?(w: GameWorld, g: HitGroup, e: EnemyState, info: { damage: number; killed: boolean }): void;
  bonus?(w: GameWorld, g: HitGroup, e: EnemyState): number;
  crit?(w: GameWorld, g: HitGroup, e: EnemyState): boolean;
  targetMult?(w: GameWorld, g: HitGroup, e: EnemyState): number;
}
const SOURCES: HitModSource[] = [];

/** Bonds, hybrids and abilities register what they change. */
export function addHitMod(m: HitModSource): void {
  SOURCES.push(m);
}

export function onLanding(w: GameWorld, g: HitGroup, e: EnemyState): void {
  for (const m of SOURCES) m.landing?.(w, g, e);
}
export function afterHit(w: GameWorld, g: HitGroup, e: EnemyState, info: { damage: number; killed: boolean }): void {
  for (const m of SOURCES) m.afterHit?.(w, g, e, info);
}

/** Step 4: Σ attacker bonuses (the group's own, e.g. the link, plus every registered source). */
export function hitBonus(w: GameWorld, g: HitGroup, e: EnemyState): number {
  return statValue(w, 'might') + (g.bonus ?? 0) + (w.instanceBonus.get(g.attackInstance) ?? 0) + SOURCES.reduce((s, m) => s + (m.bonus?.(w, g, e) ?? 0), 0);
}

/** §3.2 guaranteed crits. */
export function guaranteedCrit(w: GameWorld, g: HitGroup, e: EnemyState): boolean {
  return SOURCES.some((m) => m.crit?.(w, g, e) ?? false);
}

/** Step 6: Π target multipliers (a broken boss, marks...). */
export function targetMult(w: GameWorld, g: HitGroup, e: EnemyState): number {
  const brk = e.def.boss && e.control?.type === 'stagger' ? e.def.boss.breakMult : 1;
  return SOURCES.reduce((p, m) => p * (m.targetMult?.(w, g, e) ?? 1), brk);
}

/** 02 §4.2 knockback x direction: travel direction for projectiles, else away from the source x. */
export function kbDir(w: GameWorld, g: HitGroup, e: EnemyState): 1 | -1 {
  if (g.dir) return g.dir;
  const sx = g.kbFromX ?? w.body.x;
  const c = enemyCenter(e).x;
  return c === sx ? w.body.facing : c > sx ? 1 : -1;
}
