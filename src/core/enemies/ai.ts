// Enemy AI state machine: idle/patrol, alert, engage, attack, return (04 §2.5–2.6).
import { overlaps } from '../combat/hitGroups.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { TRAINING } from '../../data/enemies.ts';
import { ENEMY, VIEW_H, VIEW_W, ticks } from '../tuning.ts';
import { startEnemyAttack } from './attack.ts';
import { lineOfSight, playerDY } from './awareness.ts';
import { supportAhead } from './body.ts';
import { enemyCenter, type EnemyState } from './enemy.ts';
import type { EnemyAttackDef } from './types.ts';
import { stepMountainAi, wardCandidates } from './mountains.ts';
import { stepSwampFlight } from './swamps.ts';
import { GUARDIANS2 } from '../../data/guardians2.ts';
import { queenBroodEligible } from './guardians2.ts';
import { bossSpeedMult, preferredBand } from './kingdom.ts';
import { bossPhase } from './attack.ts';
import { dragonAllows, dragonBehind, dragonWeightMult, stepDragonAi } from './dragon.ts';
import { gargoyleAtHover, stepCastleAi, wardCandidate } from './castle.ts';

export function facePlayer(w: GameWorld, e: EnemyState): void {
  const dir = w.body.x > e.x ? 1 : -1;
  if (Math.abs(w.body.x - e.x) < 2 || dir === e.facing) { e.ai.turnTicks = 0; return; }
  const delay=e.def.id==='stone_colossus'&&e.boss?.enraged?GUARDIANS2.colossusTurnEnraged:e.def.turnDelay;
  if (e.ai.state !== 'alert' && delay > 0 && ++e.ai.turnTicks < ticks(delay)) return;
  e.facing = dir; e.ai.turnTicks = 0;
}

function isRanged(a: EnemyAttackDef): boolean {
  return (a.shots?.length ?? 0) > 0 && !a.hit;
}

/** 04 §2.6 eligibility: range, vertical window, cooldown, token, and for ranged attacks view + LOS. */
export function eligibleAttacks(w: GameWorld, e: EnemyState): EnemyAttackDef[] {
  const distX = Math.abs(w.body.x - e.x), dY = playerDY(w, e);
  const out: EnemyAttackDef[] = [];
  for (const a of e.def.attacks) {
    if(e.def.id==='spider_queen'&&a.id==='brood'&&!queenBroodEligible(w,e))continue;
    if (a.phases && !a.phases.includes(bossPhase(e))) continue;
    if(a.id==='rise_swipe'||a.id==='drop')continue;
    if (e.dragon && !dragonAllows(w, e, a.id)) continue;
    if (e.dragon && a.use.behind && !dragonBehind(w, e)) continue;
    if (e.def.id === 'gargoyle' && !gargoyleAtHover(w, e)) continue;       // Swoop starts from the hover point (04 §7)
    if (a.id === 'ward' && e.def.id === 'castle_mage') {
      if ((e.ai.cooldowns.get(a.id) ?? 0) <= 0 && wardCandidate(w, e)) out.push(a);
      continue;
    } // These attacks run only from their level-state trigger.
    if(e.def.id==='wisp'&&a.id==='detonate'&&Math.hypot(w.body.x-e.x,dY)>a.use.maxX)continue;
    if (a.id === 'stone_ward' && e.def.id === 'goblin_shaman') {
      if ((e.ai.cooldowns.get(a.id) ?? 0) <= 0 && wardCandidates(w,e).some((ally) => !ally.ward)) out.push(a);
      continue;
    }
    if (e.def.id === 'bat_swarm' && a.id === 'dive_bite' && Math.hypot(w.body.x - e.x, dY) > a.use.maxX) continue;
    const ranged = isRanged(a);
    const minDY = a.use.minDY ?? (ranged ? ENEMY.RANGED_DY_MIN : ENEMY.MELEE_DY_MIN);
    const maxDY = a.use.maxDY ?? (ranged ? ENEMY.RANGED_DY_MAX : ENEMY.MELEE_DY_MAX);
    if (distX < a.use.minX || distX > a.use.maxX || dY < minDY || dY > maxDY) continue;
    if ((e.ai.cooldowns.get(a.id) ?? 0) > 0) continue;
    if (a.token !== 'none' && !e.def.elite) {
      const held = w.enemies.filter((o) => o !== e && !o.dead && o.token === a.token).length;
      if (held >= (a.token === 'melee' ? ENEMY.MAX_TOKENS_MELEE : ENEMY.MAX_TOKENS_RANGED)) continue;
    }
    if (ranged) {
      const view = { x: w.camera.x, y: w.camera.y, w: VIEW_W, h: VIEW_H };
      const c = enemyCenter(e);
      if (!overlaps({ x: c.x, y: c.y, w: 1, h: 1 }, view)) continue;
      const sx = e.x + e.facing * (e.def.hurtbox.w / 2 + 4), sy = e.y - 0.6 * e.def.hurtbox.h;
      if (!lineOfSight(w, sx, sy, w.body.x, w.body.y - w.body.h / 2)) continue;
    }
    out.push(a);
  }
  return out;
}

function chooseAttack(w: GameWorld, e: EnemyState): EnemyAttackDef | null {
  let list = eligibleAttacks(w, e);
  if(e.boss&&list.length>1)list=list.filter(a=>a.id!==e.boss!.lastAttack);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  return w.rng.enemyAI.pickWeighted(list.map((a) => ({ item: a, weight: (a.weight ?? 1) * dragonWeightMult(e, a.id) })));
}

/** Walk toward x at `speed`; returns false if a wall or ledge stops it. */
function walkToward(e: EnemyState, targetX: number, speed: number): void {
  const dir: 1 | -1 = targetX > e.x ? 1 : -1;
  e.facing = dir;
  e.vx = dir * speed;
}

function stepPatrol(w: GameWorld, e: EnemyState): void {
  const p = e.spawn.patrol ?? 0;
  if (p === 0) { e.vx = 0; e.facing = e.spawn.facing; return; }
  if (e.ai.patrolWait > 0) { e.ai.patrolWait -= 1; e.vx = 0; return; }
  const end = e.spawn.x + p * e.ai.patrolDir;
  const blocked = e.hitWall || (e.grounded && !supportAhead(w, e, e.ai.patrolDir));
  if ((e.ai.patrolDir > 0 ? e.x >= end : e.x <= end) || blocked) {
    e.ai.patrolDir = (-e.ai.patrolDir) as 1 | -1;
    e.ai.patrolWait = ENEMY.PATROL_PAUSE_TICKS;
    e.vx = 0;
    return;
  }
  e.facing = e.ai.patrolDir;
  e.vx = e.ai.patrolDir * e.def.walk;
}

function stepEngage(w: GameWorld, e: EnemyState): void {
  const distX = Math.abs(w.body.x - e.x);
  const loseRange = Math.max(ENEMY.LOSE_RANGE_MIN, 2 * e.def.notice.range);
  e.ai.lostTicks = distX > loseRange ? e.ai.lostTicks + 1 : 0;
  if (e.ai.lostTicks >= ENEMY.RETURN_AFTER_TICKS && e.waveArena === null && e.def.tier!=='summon' && !e.boss) {   // waves and summons never return home (04 §2.2)
    e.ai.state = 'return';
    e.aware = false;
    e.noticeT = 0;
    return;
  }
  facePlayer(w, e);
  const [min, max] = preferredBand(w, e), speedMult = bossSpeedMult(e);
  // SPEC-GAP: 04 §3's Wolf "paces" after backing off is undefined; it stands in its band for now.
  const toward: 1 | -1 = w.body.x >= e.x ? 1 : -1;
  if (stepMountainAi(w, e) || stepSwampFlight(w,e) || stepCastleAi(w, e) || stepDragonAi(w, e)) { /* Flyers replace the ground preferred band (04 §4–5). */ }
  else if (distX > max) e.vx = toward * e.def.chase * speedMult;
  else if (distX < (e.def.backOff ?? min)) {
    const away = (-toward) as 1 | -1;
    const speed = (isRanged(e.def.attacks[0] ?? ({} as EnemyAttackDef)) ? e.def.walk : e.def.chase) * speedMult;
    e.vx = e.grounded && !supportAhead(w, e, away) ? 0 : away * speed;
  } else e.vx = 0;
  if (e.ai.gapTicks > 0 || w.health.dead || e.ai.turnTicks > 0) return;
  const a = chooseAttack(w, e);
  if (a) startEnemyAttack(w, e, a);
}

function stepReturn(w: GameWorld, e: EnemyState): void {
  const home = e.spawn.x;
  if (Math.abs(e.x - home) < 2 || e.hitWall) {
    e.vx = 0;
    e.ai.state = e.spawn.patrol ? 'patrol' : 'idle';
    e.facing = e.spawn.facing;
    return;
  }
  walkToward(e, home, e.def.walk);
  if (e.grounded && !supportAhead(w, e, e.facing)) { e.vx = 0; e.ai.state = 'idle'; }
}

/** One enemy-time tick of AI (not called while attacking, controlled or knocked back). */
export function stepAi(w: GameWorld, e: EnemyState): void {
  if (e.def.tier === 'dummy' || e.def.tier === 'target') return;
  e.ai.t += 1;
  switch (e.ai.state) {
    case 'idle': case 'patrol':
      if (e.aware) { e.ai.state = 'engage'; stepEngage(w, e); break; }
      if (e.noticeT > 0) { e.vx = 0; break; }         // noticing: stop and keep facing
      if (e.ai.state === 'patrol') stepPatrol(w, e);
      else { e.vx = 0; }
      break;
    case 'alert':
      e.vx = 0;
      facePlayer(w, e);
      if (e.ai.t >= ENEMY.ALERT_REACTION_TICKS) { e.ai.state = 'engage'; e.ai.t = 0; }
      break;
    case 'engage':
      stepEngage(w, e);
      break;
    case 'return':
      stepReturn(w, e);
      break;
    default:
      e.vx = 0;
  }
}


/** 04 §2.11 Sparring Dummy: never moves; while the player's center is within 64 px it swings (facing them at each Tele). */
export function stepSparring(w: GameWorld, e: EnemyState): void {
  const b = w.body;
  if (Math.abs(b.x - e.x) > TRAINING.sparringReach) return;
  facePlayer(w, e);
  startEnemyAttack(w, e, e.def.attacks[0]);
}
