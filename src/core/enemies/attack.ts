// Running an enemy attack: Tele → Act → Rec, its hit group, cooldown and token (04 §2.6).
import { boxToWorld } from '../combat/hitGroups.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { ticks } from '../tuning.ts';
import type { EnemyState } from './enemy.ts';
import type { EnemyAttackDef } from './types.ts';
import { bossAttackGapTicks } from './boss.ts';

function setCooldown(e: EnemyState, def: EnemyAttackDef): void {
  e.ai.cooldowns.set(def.id, ticks(def.cooldown));
}

function gapTicks(e: EnemyState): number {
  return bossAttackGapTicks(e) ?? ticks(e.def.attackGap);
}

export function removeEnemyGroups(w: GameWorld, e: EnemyState): void {
  w.hitGroups = w.hitGroups.filter((g) => !(g.owner === e.id && g.kind === 'melee'));
  if (e.ai.attack) e.ai.attack.groupId = null;
}

/** Starts an attack's telegraph: holds a token, locks facing, emits `enemyTelegraph`. */
export function startEnemyAttack(w: GameWorld, e: EnemyState, def: EnemyAttackDef): void {
  e.ai.attack = { def, phase: 'tele', t: 0, len: ticks(def.telegraph), groupId: null, moved: 0, hitDone: false };
  e.ai.state = 'attack';
  e.ai.t = 0;
  e.vx = 0;
  e.token = def.token === 'none' ? null : def.token;
  w.events.push({ t: 'enemyTelegraph', enemyId: e.id, attackId: def.id, duration: def.telegraph });
}

/** The attack ends early (stagger, control, death): its cooldown starts as if used (02 §4.3). */
export function cancelEnemyAttack(w: GameWorld, e: EnemyState): void {
  const a = e.ai.attack;
  if (!a) return;
  removeEnemyGroups(w, e);
  setCooldown(e, a.def);
  e.ai.attack = null;
  e.token = null;
  e.ai.state = 'engage';
  e.ai.t = 0;
  e.ai.gapTicks = 0;
  if (e.knockback === false) e.vx = 0;
}

function spawnAttackGroup(w: GameWorld, e: EnemyState): void {
  const a = e.ai.attack!;
  const hit = a.def.hit;
  if (!hit) return;
  const id = w.newId();
  a.groupId = id;
  w.hitGroups.push({
    id, owner: e.id, kind: 'melee', rect: boxToWorld(hit.box, e.x, e.y, e.facing),
    spec: { damage: hit.damage, kb: [0, 0], poise: 0, hitStop: 0, kind: 'melee', rehit: hit.rehit, maxHits: hit.maxHits },
    enemyHit: hit, box: hit.box, active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: id,
  });
}

/** Hooks called by specials (moves, leaps, shots) at phase changes. */
export interface AttackHooks {
  onActStart?(w: GameWorld, e: EnemyState): void;
  onActTick?(w: GameWorld, e: EnemyState): boolean;   // return true to end Act now
  onRecStart?(w: GameWorld, e: EnemyState): void;
}

/** One enemy-time tick of the running attack. Returns true when the attack finished this tick. */
export function stepEnemyAttack(w: GameWorld, e: EnemyState, hooks: AttackHooks = {}): boolean {
  const a = e.ai.attack!;
  a.t += 1;
  if (a.phase === 'tele') {
    if (a.t < a.len) return false;
    a.phase = 'act';
    a.t = 0;
    a.len = ticks(a.def.active);
    spawnAttackGroup(w, e);
    hooks.onActStart?.(w, e);
    if (a.len > 0) return false;
  }
  if (a.phase === 'act') {
    const endNow = hooks.onActTick?.(w, e) ?? false;
    if (!e.ai.attack) return true;                       // the hook ended the attack (e.g. the Boar's wall daze)
    if (!endNow && a.t < a.len) return false;
    removeEnemyGroups(w, e);
    e.token = null;
    a.phase = 'rec';
    a.t = 0;
    a.len = ticks(a.def.recovery);
    hooks.onRecStart?.(w, e);
    return false;
  }
  if (a.t < a.len) return false;
  setCooldown(e, a.def);
  e.ai.attack = null;
  e.ai.state = 'engage';
  e.ai.t = 0;
  e.ai.gapTicks = gapTicks(e);
  return true;
}

/** Attached enemy melee boxes follow their owner (02 §2.2). */
export function syncEnemyGroups(w: GameWorld): void {
  for (const g of w.hitGroups) {
    if (typeof g.owner !== 'number' || g.kind !== 'melee' || !g.box) continue;
    const e = w.enemies.find((x) => x.id === g.owner);
    if (e) g.rect = boxToWorld(g.box, e.x, e.y, e.facing);
  }
}
