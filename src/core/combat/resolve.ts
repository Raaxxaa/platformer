// 02 §2.1 steps 7a, 7b and 9: hit resolution and deaths.
import { lootOnKill } from '../loot/sources.ts';
import { addGoldTenths, killGoldTenths } from '../economy/gold.ts';
import { blueprintOnKill, grantKingUnlocks } from '../loot/blueprintItems.ts';
import { critChance } from '../loot/perks.ts';
import { statCount } from '../economy/stats.ts';
import { enemyDamageA, enemyHittable, enemyRect, type EnemyState } from '../enemies/enemy.ts';
import { removeEnemyGroups, cancelEnemyAttack } from '../enemies/attack.ts';
import { clearBossEffects, onBossKilled } from '../enemies/boss.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { BOSS, COMBAT, ELEMENT, ENEMY, RUSH, ticks } from '../tuning.ts';
import { playerHitDamage } from './damage.ts';
import { applyEnemyKnockback, applyLaunch, applyPull, controlOrPoise, damagePoise, isCommitted } from './enemyReactions.ts';
import { afterHit, guaranteedCrit, hitBonus, kbDir, onLanding, targetMult } from './hitMods.ts';
import { elementOf, lightningChain } from './elements.ts';
import { applyBurn, applyElementHit, creditKillSource, shatterMult, spreadBurn, windMults } from './status.ts';
import { hasBuff, hitLuckyBlocks, onCurseKill } from '../loot/lucky.ts';
import { LUCKY_FX } from '../../data/loot.ts';
import { elementBonus } from './elements.ts';
import { hurtPlayer } from './health.ts';
import { refundDash } from '../player/dash.ts';
import { canHit, markHit, overlaps, type HitGroup, type Rect } from './hitGroups.ts';
import { maxStop, meleeHitStopTicks } from './hitStop.ts';
import { addRush, rushLevel } from './rush.ts';
import { TRAINING } from '../../data/enemies.ts';
import { applyEnemyDamage, enemyGuarded } from './enemyDamage.ts';
import { MOUNTAIN } from '../../data/mountains.ts';
import { removePlayerProjectile } from './playerProjectiles.ts';
import { applyPlayerStatus } from './playerStatus.ts';

/** The player hurtbox as a rect. */
export function playerRect(w: GameWorld): Rect {
  const b = w.body;
  return { x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h };
}

function hittable(e: EnemyState): boolean {
  return enemyHittable(e);
}

/** An enemy reaches 0 HP: it dies, its attack and boxes go, and step 9 runs its on-kill effects. */
export function killEnemy(w: GameWorld, e: EnemyState): void {
  e.hp = 0;
  e.dead = true;
  e.deathTicks = e.def.boss ? BOSS.DEATH_ANIM_TICKS : ENEMY.DEATH_ANIM_TICKS;
  cancelEnemyAttack(w, e);
  removeEnemyGroups(w, e);
  if(e.boss)clearBossEffects(w,e); // 02 §2.1: player-first ties remove every owned attack before7b.
  w.pendingDeaths.push(e);
}

/** One player direct hit on one enemy (02 §3.1, §4). */
function applyPlayerHit(w: GameWorld, g: HitGroup, e: EnemyState): void {
  const spec = g.spec;
  const isWeapon = g.ability === undefined;
  const inst = g.slot !== undefined ? w.combat.slots[g.slot] : null;
  const matched = isWeapon && g.slot !== undefined && w.classState.weaponMatched[g.slot];
  if (w.noteLanding(g)) onLanding(w, g, e);                 // hit streak first: Blademaster's 3rd landing crits itself
  // 02 §3.2: a guaranteed crit, else roll the `combat` stream when critChance > 0 (Keen).
  const chance = critChance(w, isWeapon ? g.slot : undefined);
  const crit = guaranteedCrit(w, g, e) || (chance > 0 && w.rng.combat.next() < chance);
  // Shatter (02 §6.3): any direct hit on a Frozen enemy, as a target multiplier; it ends the freeze.
  const guarded = enemyGuarded(w,g,e), warded = e.ward !== null;
  const tMult = targetMult(w, g, e) * shatterMult(w, e, true) * (guarded ? e.def.guard!.guardMult : 1);
  const { damage, procBase } = playerHitDamage({
    base: spec.damage, grade: inst?.grade ?? 'C', matched, isWeapon, bonus: hitBonus(w, g, e), crit, targetMult: tMult,
  });
  applyEnemyDamage(e,damage);
  if (guarded && g.kind === 'melee') w.body.vx = -w.body.facing * MOUNTAIN.guardRecoil;
  if (guarded && g.kind === 'shot') {
    const p = w.playerProjectiles.find((p) => p.groupId === g.id);
    if (p) removePlayerProjectile(w,p);
    g.active = false;
  }
  e.lastPlayerHitTick = w.tick;
  e.damagedTicks = 0;
  e.everDamaged = true;
  e.hurtFlashTicks = ENEMY.HURT_FLASH_TICKS;
  const killed = e.def.tier !== 'dummy' && e.hp <= 0;
  if (e.def.tier === 'dummy' && e.hp < 1) e.hp = 1;
  // Element on the direct hit (02 §6): Lightning chains to 2 others right away.
  const el = elementOf(w, g);
  w.events.push({ t: 'hit', target: e.id, amount: damage, crit, heavy: !!spec.heavy, slot: g.slot, step: g.step, ability: g.ability, ...(el ? { element: el.id } : {}) });
  const killer = isWeapon ? inst : null;
  if (el?.id === 'lightning') lightningChain(w, e, el.level, procBase, (x) => targetMult(w, g, x), (x) => { killEnemy(w, x); creditKillSource(w, killer, x); });
  else if (el && el.id !== 'wind' && !killed) applyElementHit(w, e, el, procBase, tMult, null, killer);
  // Firestarter (05 §7.2): every weapon and ability direct hit burns at level 1 (a fire weapon's own burn keeps the higher value).
  if (hasBuff(w, 'firestarter') && !killed) applyBurn(e, ELEMENT.BURN.pct[LUCKY_FX.firestarterBurnLevel - 1] * (1 + elementBonus(w)) * procBase * tMult, ELEMENT.BURN.spread[0], killer);
  const wind = windMults(el);
  if (spec.heavy) w.shakeLevel('small');
  w.onPlayerLandedHit(g, e);
  // Hit-stop (02 §4.1): melee freezes both, a shot or a multi-hit group only the target.
  const stop = meleeHitStopTicks(spec.hitStop, crit, killed);
  e.hitStopTicks = maxStop(e.hitStopTicks, stop);
  if (g.kind === 'melee' && !spec.multiHit && !g.noPlayerStop) w.body.hitStopTicks = maxStop(w.body.hitStopTicks, stop);
  if (killed) {
    killEnemy(w, e);
    creditKillSource(w, killer, e);
    afterHit(w, g, e, { damage, killed });
    g.onHit?.(w, g, e, { damage, killed });
    return;
  }
  // Poise and stagger, then knockback (full if staggered; ignored if committed otherwise), then control.
  const committed = isCommitted(e);
  const staggered = !warded && damagePoise(w, e, spec.poise * wind.poise * (guarded && !spec.heavy ? MOUNTAIN.guardPoiseMult : 1), !!spec.heavy);
  const dir = kbDir(w, g, e);
  const frozen = e.control?.type === 'pin' || e.status.frozen !== null;    // Frozen takes no knockback (02 §6.3)
  const ctl = spec.control;
  const kb: [number, number] = [spec.kb[0] * wind.kb, spec.kb[1] * wind.kb];
  if (!warded && (!guarded || spec.heavy)) {
    if (ctl?.type === 'launch') applyLaunch(w, e, spec.kb, dir);
    else if (!frozen && (staggered || !committed)) applyEnemyKnockback(e, kb, dir);
  }
  if (ctl?.type === 'knockdown' || ctl?.type === 'stun') controlOrPoise(w, e, ctl.type, ctl.duration);
  else if (ctl?.type === 'pull' && g.pullTo) applyPull(w, e, g.pullTo);
  // Instant awareness: resolved while unaware, flips right after (04 §2.4).
  w.onEnemyHitByPlayer(e);
  afterHit(w, g, e, { damage, killed });
  g.onHit?.(w, g, e, { damage, killed });
}

/** 7a: player hit groups vs enemies, groups in creation order, targets by ascending id. */
export function resolvePlayerHits(w: GameWorld): void {
  if (w.health.dead) return;                               // no hits from a dead player
  const playerFrozen = w.playerFrozenAtTickStart;
  const targets = [...w.enemies].sort((a, b) => a.id - b.id);
  // Index loop: a group made during 7a (an orb's blast) is resolved on the same tick.
  for (let i = 0; i < w.hitGroups.length; i++) {
    const g = w.hitGroups[i];
    if (g.owner !== 'player' || !g.active) continue;
    if (g.kind === 'melee' && playerFrozen && !g.ability) continue;   // a frozen melee box doesn't test overlap
    for (const e of targets) {
      if (!g.active) break;                                 // a projectile that stopped
      if (!hittable(e) || !canHit(g, e.id, w.tick)) continue;
      if (!overlaps(g.rect, enemyRect(e))) continue;
      if (!enemyGuarded(w,g,e) && g.contact?.(w, g, e)) continue;
      markHit(g, e.id, w.tick);
      applyPlayerHit(w, g, e);
    }
  }
  hitLuckyBlocks(w);
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
      attackerCx, melee: g.kind === 'melee', playerKb: g.enemyHit.playerKb, travelDir: g.dir,
    });
    if (dealt === 0) continue;                                  // invulnerable: not marked, may hit later
    if(g.enemyHit.status)applyPlayerStatus(w,g.enemyHit.status.id,g.enemyHit.status.stacks??1,g.enemyHit.status.duration);
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
    spreadBurn(w, e);                                           // 02 §6.2: a burning enemy that dies (any cause) spreads it
    if(e.noRewards)continue;
    if (e.def.tier === 'target') {
      // Straw target (04 §2.12): Rush only (a regular kill), no gold or flask; back in 3.0 s.
      addRush(w, RUSH.KILL_REGULAR);
      w.respawns.push({ spawn: { enemy: e.def.id, x: e.spawn.x, y: e.spawn.y, facing: e.spawn.facing }, at: w.tick + ticks(TRAINING.strawRespawnS) });
      continue;
    }
    const tier = e.def.elite ? 'elite' : 'regular';
    w.onPlayerKill(e, tier);
    // 05 §9.3: kill gold at once, in tenths (Golden Touch, Greedy on the killing weapon).
    addGoldTenths(w, killGoldTenths({
      gold: e.def.gold, rushLevel: rushLevel(w.rush), goldenTouch: w.econ.buffs.includes('golden_touch'), prospector: statCount(w, 'prospector'),
      greedy: e.killedBy?.perk === 'greedy',
    }), 'kill');
    w.events.push({ t: 'kill', enemyId: e.id, tier });
    lootOnKill(w, e);
    blueprintOnKill(w, e);
    if (e.def.id === 'enemy_king') grantKingUnlocks(w);
    onCurseKill(w);
    if (e.boss) onBossKilled(w, e);
  }
  // Blademaster (03 §5.2): kills reset the dash; several kills on one tick = one call.
  if (w.pendingDeaths.some((e) => !e.noRewards && e.def.tier !== 'target') && w.classState.bond === 'blademaster') refundDash(w.body);
  w.pendingDeaths = [];
}
