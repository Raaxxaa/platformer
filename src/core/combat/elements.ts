// Elements on weapon hits (02 §6). M4 has Lightning level 1 only (Storm Caller, Arcane Archer); the rest come with loot.
import { enemyCenter, type EnemyState } from '../enemies/enemy.ts';
import { roundHalfUp } from '../math.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { COMBAT } from '../tuning.ts';
import { BOND } from '../../data/classes.ts';
import type { HitGroup } from './hitGroups.ts';
import type { ElementId, Grade } from './types.ts';

export interface ElementOnHit { id: ElementId; level: 1 | 2 | 3 }

const GRADE_LEVEL: Partial<Record<Grade, 1 | 2 | 3>> = { B: 1, A: 2, S: 3 };

/** Hooks that give a weapon hit an element it doesn't have (Storm Caller, Arcane Archer). */
type ElementHook = (w: GameWorld, g: HitGroup) => ElementOnHit | null;
const HOOKS: ElementHook[] = [];
export function addElementHook(h: ElementHook): void {
  HOOKS.push(h);
}

/** 02 §6.1: the element of a weapon direct hit (ability hits carry none, 03 §7.8). */
export function elementOf(w: GameWorld, g: HitGroup): ElementOnHit | null {
  if (g.ability !== undefined || g.slot === undefined) return null;
  const inst = w.combat.slots[g.slot];
  if (!inst) return null;
  if (inst.element) return { id: inst.element, level: GRADE_LEVEL[inst.grade] ?? 1 };
  for (const h of HOOKS) { const e = h(w, g); if (e) return e; }
  return null;
}

/** 02 §6.1 Storm Caller bonus on element percentages. */
export function elementBonus(w: GameWorld): number {
  return w.classState.bond === 'storm_caller' ? BOND.STORM_CALLER_ELEMENT_BONUS : 0;
}

/**
 * 02 §6.4 Lightning chain after a lightning direct hit: up to 2 other living enemies within range of the hit target's
 * center, nearest first (ties: lower id), each take procBase × chain% as secondary damage (no crit, stop, kb, poise).
 */
export function lightningChain(w: GameWorld, target: EnemyState, level: 1 | 2 | 3, procBase: number, targetMult: (e: EnemyState) => number,
  onKill: (e: EnemyState) => void): void {
  const L = COMBAT.LIGHTNING[level - 1];
  const c = enemyCenter(target);
  const list = w.enemies
    .filter((e) => e !== target && !e.dead && !e.dormant && e.spawnInTicks === 0)
    .map((e) => ({ e, d: Math.hypot(enemyCenter(e).x - c.x, enemyCenter(e).y - c.y) }))
    .filter((x) => x.d <= L.range)
    .sort((a, b) => a.d - b.d || a.e.id - b.e.id)
    .slice(0, L.targets);
  const pct = L.pct * (1 + elementBonus(w));
  for (const { e } of list) {
    const dmg = Math.max(1, roundHalfUp(procBase * pct * targetMult(e)));
    e.hp -= dmg;
    e.damagedTicks = 0;
    e.everDamaged = true;
    w.events.push({ t: 'hit', target: e.id, amount: dmg, crit: false, heavy: false, chainFrom: target.id });
    if (e.def.tier === 'dummy' && e.hp < 1) e.hp = 1;
    else if (e.hp <= 0) onKill(e);
  }
}
