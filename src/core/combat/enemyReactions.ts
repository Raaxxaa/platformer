// Hit reactions on enemies: knockback, poise and stagger, control effects (02 §4.2–4.4).
import { cancelEnemyAttack } from '../enemies/attack.ts';
import type { EnemyState } from '../enemies/enemy.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { BOSS, COMBAT, ENEMY, ticks } from '../tuning.ts';
import { BOND } from '../../data/classes.ts';

/** Committed: in the Tele or Act of an attack (02 §4.2). */
export function isCommitted(e: EnemyState): boolean {
  const a = e.ai.attack;
  return a !== null && (a.phase === 'tele' || a.phase === 'act');
}

export function applyEnemyKnockback(e: EnemyState, kb: [number, number], dir: 1 | -1): void {
  if (e.ward) return;
  const k = 1 - e.def.kbResist;
  if (k <= 0) return;
  e.vx = dir * kb[0] * k;
  e.vy = kb[1] * k;
  e.knockback = true;
  if (e.vy < 0) e.grounded = false;
}

/** Removes poise; returns true if this hit staggers the enemy (02 §4.3). */
export function damagePoise(w: GameWorld, e: EnemyState, amount: number, heavy: boolean): boolean {
  if (e.ward) return false;
  e.noPoiseHitTicks = 0;
  if (e.control?.type === 'stagger') return false;     // locked at 0; no extension
  if (e.poiseImmuneTicks > 0) return false;
  e.poise -= amount;
  if (e.poise > 0) return false;
  e.poise = 0;
  cancelEnemyAttack(w, e);
  // Bosses Break for a fixed time instead (04 §9.1): heavy hits don't lengthen it.
  // Iron Will (03 §5.3) doubles the heavy stagger.
  const heavyMult = w.classState.bond === 'iron_will' ? BOND.IRON_WILL_STAGGER_MULT : 1;
  const n = e.def.boss ? ticks(e.def.boss.breakTime) : heavy ? Math.round(COMBAT.STAGGER_HEAVY_TICKS * heavyMult) : COMBAT.STAGGER_TICKS;
  if(e.def.boss && !e.grounded)e.vy=Math.max(0,e.vy); // 04 §9.1: airborne Break falls instead of continuing its leap upward.
  e.control = { type: 'stagger', ticks: n };
  return true;
}

/** Stun / knockdown / pin / dazed: elites ×0.5 (02 §4.4); replaces only a shorter remaining effect. Returns true if applied. */
export function applyControl(w: GameWorld, e: EnemyState, type: 'knockdown' | 'dazed' | 'stun' | 'pin', seconds: number): boolean {
  const n = ticks(seconds * (e.def.elite && type !== 'dazed' ? COMBAT.ELITE_CONTROL_MULT : 1));
  if (e.control && e.control.ticks >= n) return false;
  cancelEnemyAttack(w, e);
  e.control = { type, ticks: n };
  if (type === 'pin') { e.vx = 0; e.vy = 0; e.knockback = false; }
  return true;
}

/** 02 §4.4 Launch: small and medium only (else normal knockback); bosses immune. Cannot act until it lands + 0.2 s. */
export function applyLaunch(w: GameWorld, e: EnemyState, kb: [number, number], dir: 1 | -1): void {
  if (e.def.boss || e.def.size === 'boss') return;
  applyEnemyKnockback(e, kb, dir);
  if (e.def.size === 'large') return;
  cancelEnemyAttack(w, e);
  e.control = { type: 'launch', ticks: COMBAT.LAUNCH_LAND_TICKS, landed: false };
}

/** 02 §4.4 Pull: small and medium move toward a point and cannot act; ends within 4 px or after 0.3 s. */
export function applyPull(w: GameWorld, e: EnemyState, to: { x: number; y: number; speed: number }, thenStun = 0): boolean {
  if (e.def.boss || e.def.size === 'boss' || e.def.size === 'large') return false;
  cancelEnemyAttack(w, e);
  e.knockback = false;
  e.control = { type: 'pull', ticks: COMBAT.PULL_MAX_TICKS, to, thenStun };
  return true;
}

/** Bosses are immune to Stun and Knockdown: they take 30 poise damage instead (02 §4.4). */
export function controlOrPoise(w: GameWorld, e: EnemyState, type: 'knockdown' | 'stun', seconds: number): void {
  if (e.def.boss) { damagePoise(w, e, COMBAT.BOSS_CONTROL_POISE, false); return; }
  applyControl(w, e, type, seconds);
}

/** Per enemy-time tick: control timers, poise refill, elite poise immunity, dummy heal. */
export function stepEnemyReactions(e: EnemyState): void {
  if (e.control && !(e.control.type === 'launch' && !e.control.landed)) {
    e.control.ticks -= 1;
    if (e.control.type === 'pull' && e.control.ticks <= 0 && e.control.thenStun) {
      const s = e.control.thenStun;
      e.control = null;
      e.vx = 0; e.vy = 0;
      e.control = { type: 'stun', ticks: s };
    } else if (e.control.ticks <= 0) {
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
