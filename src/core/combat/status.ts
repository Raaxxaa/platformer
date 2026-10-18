// Enemy element statuses (02 §6.2–6.7): Burn, Chill / Freeze / Shatter, Poison, Wind kill refund. Lightning is in elements.ts.
import { enemyCenter, enemyHittable, type EnemyState } from '../enemies/enemy.ts';
import { roundHalfUp } from '../math.ts';
import { refundDash } from '../player/dash.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { ELEMENT, ticks } from '../tuning.ts';
import type { ElementOnHit } from './elements.ts';
import { elementBonus } from './elements.ts';
import { killEnemy } from './resolve.ts';
import type { WeaponInstance } from './types.ts';
import { applyEnemyDamage } from './enemyDamage.ts';

export interface EnemyStatus {
  burn: { perTick: number; left: number; next: number; spread: number; src: WeaponInstance | null } | null;
  chill: { scale: number; left: number } | null;
  frost: { stacks: number; clear: number };
  frozen: { left: number; level: 1 | 2 | 3 } | null;
  freezeImmune: number;
  poison: { stacks: number[]; left: number; next: number; src: WeaponInstance | null } | null;
  /** Chill time accumulator: the enemy acts on a tick when it reaches 1 (02 §6.3 timeScale). */
  timeAcc: number;
}

export const newStatus = (): EnemyStatus => ({ burn: null, chill: null, frost: { stacks: 0, clear: 0 }, frozen: null, freezeImmune: 0, poison: null, timeAcc: 0 });

const isBoss = (e: EnemyState) => e.def.tier === 'boss';

/** Applies the element of one direct hit (after its damage). `mult` = the hit's target multipliers. */
export function applyElementHit(w: GameWorld, e: EnemyState, el: ElementOnHit, procBase: number, mult: number, srcIndex: number | null,
  src: WeaponInstance | null = null): void {
  void srcIndex;
  const s = e.status, k = el.level - 1, bonus = 1 + elementBonus(w);
  if (el.id === 'fire') applyBurn(e, ELEMENT.BURN.pct[k] * bonus * procBase * mult, ELEMENT.BURN.spread[k], src);
  else if (el.id === 'ice') {
    const raw = ELEMENT.ICE.scale[k], scale = isBoss(e) ? 1 - (1 - raw) / 2 : raw;
    s.chill = { scale: Math.min(scale, s.chill?.scale ?? 1), left: ticks(ELEMENT.ICE.chillS) };
    if (isBoss(e) || s.freezeImmune > 0 || s.frozen) return;
    s.frost = { stacks: s.frost.stacks + 1, clear: ticks(ELEMENT.ICE.stackClearS) };
    if (s.frost.stacks >= ELEMENT.ICE.stacks[k]) {
      s.frozen = { left: ticks(e.def.elite ? ELEMENT.ICE.freezeS.elite : ELEMENT.ICE.freezeS.regular), level: el.level };
      s.frost.stacks = 0;
      e.vx = 0;
    }
  } else if (el.id === 'poison') {
    const v = ELEMENT.POISON.pct[k] * bonus * procBase * mult, max = ELEMENT.POISON.max[k];
    const p = s.poison ?? { stacks: [], left: 0, next: ticks(ELEMENT.POISON.intervalS), src };
    if (p.stacks.length < max) p.stacks.push(v);
    else {
      const weakest = p.stacks.indexOf(Math.min(...p.stacks));
      if (v > p.stacks[weakest]) p.stacks[weakest] = v;
    }
    p.left = ticks(ELEMENT.POISON.expireS);
    p.src = src;
    s.poison = p;
  }
}

/** One Burn: the larger per-tick value, a fresh 3.0 s (02 §6.2). Firestarter calls this too. */
export function applyBurn(e: EnemyState, perTick: number, spread: number, src: WeaponInstance | null): void {
  const b = e.status.burn;
  e.status.burn = {
    perTick: Math.max(perTick, b?.perTick ?? 0), left: ticks(ELEMENT.BURN.durationS),
    next: b ? b.next : ticks(ELEMENT.BURN.intervalS), spread: Math.max(spread, b?.spread ?? 0), src: src ?? b?.src ?? null,
  };
}

/** Shatter (02 §6.3): the next direct hit on a Frozen enemy is multiplied; it also ends the freeze. */
export function shatterMult(w: GameWorld, e: EnemyState, consume: boolean): number {
  const f = e.status.frozen;
  if (!f) return 1;
  const raw = ELEMENT.ICE.shatter[f.level - 1], m = 1 + (raw - 1) * (1 + elementBonus(w));
  if (consume) endFreeze(e);
  return m;
}

function endFreeze(e: EnemyState): void {
  e.status.frozen = null;
  e.status.freezeImmune = ticks(ELEMENT.ICE.immuneS);
}

/** Wind (02 §6.6): kills by a wind weapon refund the dash. Greedy gold etc. read the killing weapon elsewhere. */
export function creditKillSource(w: GameWorld, weapon: WeaponInstance | null, e?: EnemyState): void {
  if (e) e.killedBy = weapon;
  if (weapon?.element === 'wind') refundDash(w.body);
}

/** Wind knockback and poise multipliers for a hit's element. */
export function windMults(el: ElementOnHit | null): { kb: number; poise: number } {
  return el?.id === 'wind' ? { kb: ELEMENT.WIND.kb[el.level - 1], poise: ELEMENT.WIND.poise[el.level - 1] } : { kb: 1, poise: 1 };
}

function dot(w: GameWorld, e: EnemyState, amount: number, src: WeaponInstance | null): void {
  const dmg = Math.max(1, roundHalfUp(amount));
  applyEnemyDamage(e,dmg);
  e.damagedTicks = 0;
  e.everDamaged = true;
  if(e.hp>0)w.onEnemyHitByPlayer(e);
  w.events.push({ t: 'hit', target: e.id, amount: dmg, crit: false, heavy: false, dot: true });
  if (e.def.tier === 'dummy' && e.hp < 1) e.hp = 1;
  else if (e.hp <= 0 && !e.dead) { killEnemy(w, e); creditKillSource(w, src, e); }
}

/** Burn spread on death (02 §6.2): every living enemy within the radius gets a fresh full Burn. */
export function spreadBurn(w: GameWorld, dead: EnemyState): void {
  const b = dead.status.burn;
  if (!b) return;
  const c = enemyCenter(dead);
  for (const e of w.enemies) {
    if (e === dead || !enemyHittable(e)) continue;
    const ec = enemyCenter(e);
    if (Math.hypot(ec.x - c.x, ec.y - c.y) <= b.spread) {
      e.status.burn = { perTick: b.perTick, left: ticks(ELEMENT.BURN.durationS), next: ticks(ELEMENT.BURN.intervalS), spread: b.spread, src: b.src };
    }
  }
}

/** Status timers and damage-over-time, once per tick before enemies act. */
export function stepStatuses(w: GameWorld): void {
  for (const e of [...w.enemies].sort((a, b) => a.id - b.id)) {
    if (!enemyHittable(e)) continue;
    const s = e.status;
    if (s.burn) {
      s.burn.left -= 1;
      if (--s.burn.next <= 0) { s.burn.next = ticks(ELEMENT.BURN.intervalS); const src = s.burn.src; dot(w, e, s.burn.perTick, src); }
      if (s.burn && s.burn.left <= 0 && !e.dead) s.burn = null;
    }
    if (e.dead) continue;
    if (s.poison) {
      s.poison.left -= 1;
      if (--s.poison.next <= 0) { s.poison.next = ticks(ELEMENT.POISON.intervalS); dot(w, e, s.poison.stacks.reduce((a, b) => a + b, 0), s.poison.src); }
      if (s.poison && s.poison.left <= 0) s.poison = null;
    }
    if (e.dead) continue;
    if (s.chill && --s.chill.left <= 0) s.chill = null;
    if (s.frost.stacks > 0 && --s.frost.clear <= 0) s.frost.stacks = 0;
    if (s.frozen && --s.frozen.left <= 0) endFreeze(e);
    if (s.freezeImmune > 0) s.freezeImmune -= 1;
  }
}

/** 02 §6.3: may this enemy act this tick? Frozen: never. Chilled: on a fraction `scale` of ticks. */
export function enemyActs(e: EnemyState): boolean {
  if (e.status.frozen) return false;
  const scale = e.status.chill?.scale ?? 1;
  if (scale >= 1) { e.status.timeAcc = 0; return true; }
  e.status.timeAcc += scale;
  if (e.status.timeAcc >= 1) { e.status.timeAcc -= 1; return true; }
  return false;
}
