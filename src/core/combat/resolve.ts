// 02 §2.1 steps 7a, 7b and 9: hit resolution and deaths.
import { enemyCenter, enemyDamageA, enemyRect, type EnemyState } from '../enemies/enemy.ts';
import { removeEnemyGroups, cancelEnemyAttack } from '../enemies/attack.ts';
import { roundHalfUp } from '../math.ts';
import { onBossKilled } from '../enemies/boss.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { COMBAT, ENEMY } from '../tuning.ts';
import { playerHitDamage } from './damage.ts';
import { applyControl, applyEnemyKnockback, damagePoise, isCommitted } from './enemyReactions.ts';
import { hurtPlayer } from './health.ts';
import { canHit, markHit, overlaps, type HitGroup, type Rect } from './hitGroups.ts';
import { maxStop, meleeHitStopTicks } from './hitStop.ts';
import { rushGoldMult, rushLevel } from './rush.ts';

/** The player hurtbox as a rect. */
export function playerRect(w: GameWorld): Rect {
  const b = w.body;
  return { x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h };
}

function hittable(e: EnemyState): boolean {
  return !e.dead && !e.dormant && e.spawnInTicks === 0;
}

/** An enemy reaches 0 HP: it dies, its attack and boxes go, and step 9 runs its on-kill effects. */
export function killEnemy(w: GameWorld, e: EnemyState): void {
  e.hp = 0;
  e.dead = true;
  e.deathTicks = ENEMY.DEATH_ANIM_TICKS;
  cancelEnemyAttack(w, e);
  removeEnemyGroups(w, e);
  w.pendingDeaths.push(e);
}

/** One player direct hit on one enemy (02 §3.1, §4). */
function applyPlayerHit(w: GameWorld, g: HitGroup, e: EnemyState): void {
  const spec = g.spec;
  const grade = g.slot !== undefined ? w.combat.slots[g.slot]?.grade ?? 'C' : 'C';
  // A broken boss takes its break multiplier (04 §9.1, a step-6 target multiplier).
  const targetMult = e.def.boss && e.control?.type === 'stagger' ? e.def.boss.breakMult : 1;
  const { damage } = playerHitDamage({ base: spec.damage, grade, matched: false, isWeapon: true, targetMult });
  e.hp -= damage;
  e.lastPlayerHitTick = w.tick;
  e.damagedTicks = 0;
  e.everDamaged = true;
  e.hurtFlashTicks = ENEMY.HURT_FLASH_TICKS;
  const killed = e.def.tier !== 'dummy' && e.hp <= 0;
  if (e.def.tier === 'dummy' && e.hp < 1) e.hp = 1;
  w.events.push({ t: 'hit', target: e.id, amount: damage, crit: false, heavy: !!spec.heavy });
  if (spec.heavy) w.shakeLevel('small');
  w.onPlayerLandedHit(g, e);
  // Hit-stop: melee freezes both, a shot only the target.
  const stop = meleeHitStopTicks(spec.hitStop, false, killed);
  e.hitStopTicks = maxStop(e.hitStopTicks, stop);
  if (g.kind === 'melee' && !spec.multiHit) w.body.hitStopTicks = maxStop(w.body.hitStopTicks, stop);
  if (killed) {
    killEnemy(w, e);
    return;
  }
  // Poise and stagger, then knockback (full if staggered; ignored if committed otherwise).
  const committed = isCommitted(e);
  const staggered = damagePoise(w, e, spec.poise, !!spec.heavy);
  const c = enemyCenter(e).x;
  const dir: 1 | -1 = c === w.body.x ? w.body.facing : c > w.body.x ? 1 : -1;
  if (staggered || !committed) applyEnemyKnockback(e, spec.kb, dir);
  if (spec.control?.type === 'knockdown') applyControl(w, e, 'knockdown', spec.control.duration);
  // Instant awareness: resolved while unaware, flips right after (04 §2.4).
  w.onEnemyHitByPlayer(e);
}

/** 7a: player hit groups vs enemies, groups in creation order, targets by ascending id. */
export function resolvePlayerHits(w: GameWorld): void {
  if (w.health.dead) return;                               // no hits from a dead player
  const playerFrozen = w.playerFrozenAtTickStart;
  const targets = [...w.enemies].sort((a, b) => a.id - b.id);
  for (const g of [...w.hitGroups]) {
    if (g.owner !== 'player' || !g.active) continue;
    if (g.kind === 'melee' && playerFrozen) continue;      // a frozen melee box doesn't test overlap
    for (const e of targets) {
      if (!hittable(e) || !canHit(g, e.id, w.tick)) continue;
      if (!overlaps(g.rect, enemyRect(e))) continue;
      markHit(g, e.id, w.tick);
      applyPlayerHit(w, g, e);
    }
  }
}

/** 7b: enemy hit groups vs the player, in creation order. Ties already went to the player in 7a. */
export function resolveEnemyHits(w: GameWorld): void {
  const pr = playerRect(w);
  for (const g of [...w.hitGroups]) {
    if (typeof g.owner !== 'number' || !g.active || !g.enemyHit) continue;
    const owner = w.enemies.find((e) => e.id === g.owner);
    if (g.kind === 'melee' && (!owner || owner.dead || owner.frozenAtTickStart)) continue;
    if (!canHit(g, 0, w.tick) || !overlaps(g.rect, pr)) continue;
    const attackerCx = g.kind === 'melee' && owner ? owner.x : g.rect.x + g.rect.w / 2;
    const dealt = hurtPlayer(w, {
      kind: 'enemyHit', enemyId: g.owner, enemyDefId: owner?.def.id ?? 'enemy', damageA: enemyDamageA(w, g.enemyHit.damage),
      attackerCx, melee: g.kind === 'melee', playerKb: g.enemyHit.playerKb,
    });
    if (dealt === 0) continue;                                  // invulnerable: not marked, may hit later
    markHit(g, 0, w.tick);
    w.events.push({ t: 'hit', target: 'player', amount: dealt, crit: false, heavy: false });
    w.shakeLevel('small');
    if (g.kind === 'melee' && owner) owner.hitStopTicks = maxStop(owner.hitStopTicks, COMBAT.HURT_HIT_STOP_TICKS);
    w.onEnemyShotLanded(g);
  }
}

/** Step 9: on-kill effects in order of death (02 §3.5). */
export function processDeaths(w: GameWorld): void {
  for (const e of w.pendingDeaths) {
    const tier = e.def.elite ? 'elite' : 'regular';
    w.onPlayerKill(e, tier);
    // SPEC-GAP: M2 credits gold instantly; coins in M4
    w.gold += roundHalfUp(e.def.gold * rushGoldMult(rushLevel(w.rush)));
    w.events.push({ t: 'kill', enemyId: e.id, tier });
    if (e.boss) onBossKilled(w, e);
  }
  w.pendingDeaths = [];
}
