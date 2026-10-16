// Hit reactions on enemies: knockback, poise and stagger, control effects (02 §4.2–4.4).
import { cancelEnemyAttack } from '../enemies/attack.ts';
import type { EnemyState } from '../enemies/enemy.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { BOSS, COMBAT, ENEMY, ticks } from '../tuning.ts';

/** Committed: in the Tele or Act of an attack (02 §4.2). */
export function isCommitted(e: EnemyState): boolean {
  const a = e.ai.attack;
  return a !== null && (a.phase === 'tele' || a.phase === 'act');
}

export function applyEnemyKnockback(e: EnemyState, kb: [number, number], dir: 1 | -1): void {
  const k = 1 - e.def.kbResist;
  if (k <= 0) return;
  e.vx = dir * kb[0] * k;
  e.vy = kb[1] * k;
  e.knockback = true;
  if (e.vy < 0) e.grounded = false;
}

/** Removes poise; returns true if this hit staggers the enemy (02 §4.3). */
export function damagePoise(w: GameWorld, e: EnemyState, amount: number, heavy: boolean): boolean {
  e.noPoiseHitTicks = 0;
  if (e.control?.type === 'stagger') return false;     // locked at 0; no extension
  if (e.poiseImmuneTicks > 0) return false;
  e.poise -= amount;
  if (e.poise > 0) return false;
  e.poise = 0;
  cancelEnemyAttack(w, e);
  // Bosses Break for a fixed time instead (04 §9.1): heavy hits don't lengthen it.
  const n = e.def.boss ? ticks(e.def.boss.breakTime) : heavy ? COMBAT.STAGGER_HEAVY_TICKS : COMBAT.STAGGER_TICKS;
  e.control = { type: 'stagger', ticks: n };
  return true;
}

/** Stun / knockdown / dazed: elites ×0.5 (02 §4.4); replaces only a shorter remaining effect. */
export function applyControl(w: GameWorld, e: EnemyState, type: 'knockdown' | 'dazed', seconds: number): void {
  const n = ticks(seconds * (e.def.elite && type !== 'dazed' ? COMBAT.ELITE_CONTROL_MULT : 1));
  if (e.control && e.control.ticks >= n) return;
  cancelEnemyAttack(w, e);
  e.control = { type, ticks: n };
}

/** Per enemy-time tick: control timers, poise refill, elite poise immunity, dummy heal. */
export function stepEnemyReactions(e: EnemyState): void {
  if (e.control) {
    e.control.ticks -= 1;
    if (e.control.ticks <= 0) {
      const wasStagger = e.control.type === 'stagger';
      e.control = null;
      if (wasStagger) {
        e.poise = e.def.poiseMax;
        if (e.def.elite) e.poiseImmuneTicks = COMBAT.ELITE_POISE_IMMUNE_TICKS;
        else if (e.def.boss) e.poiseImmuneTicks = BOSS.POISE_IMMUNE_TICKS;
      }
    }
  }
  if (e.poiseImmuneTicks > 0) e.poiseImmuneTicks -= 1;
  if (e.control?.type !== 'stagger') {
    e.noPoiseHitTicks += 1;
    if (e.noPoiseHitTicks >= COMBAT.POISE_REFILL_TICKS) e.poise = e.def.poiseMax;
  }
  e.damagedTicks += 1;
  if (e.def.tier === 'dummy' && e.damagedTicks >= ENEMY.DUMMY_HEAL_TICKS) e.hp = e.maxHp;
  if (e.hurtFlashTicks > 0) e.hurtFlashTicks -= 1;
}
