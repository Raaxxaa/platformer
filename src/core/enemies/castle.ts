// Stage 4 specials (04 §7, §12): Gargoyle stone form and Swoop, Castle Mage Ward, Living Armor revive,
// and the Enemy King's Royal Decree, Blade Rain and Throne Beam.
import { CASTLE as C } from '../../data/castle.ts';
import { ENEMY_PROJECTILES } from '../../data/enemyProjectiles.ts';
import { newStatus } from '../combat/status.ts';
import { boxFree } from '../physics/collide.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { ENEMY } from '../tuning.ts';
import { cancelEnemyAttack, removeEnemyGroups, spawnAttackGroup, startEnemyAttack, type AttackHooks } from './attack.ts';
import { lineOfSight } from './awareness.ts';
import { enemyCenter, type EnemyState } from './enemy.ts';
import { dropMarkedRocks } from './greatBoar.ts';
import type { EnemyHit } from './types.ts';

export interface CastleState {
  /** Gargoyle */
  stone: boolean; crackTicks: number; farTicks: number; returning: boolean; swoopTo: { x: number; y: number } | null;
  /** Castle Mage: the warded ally; Ward target side: the mage that wards this enemy. */
  wardTarget: number | null; wardedBy: number | null;
  /** Living Armor */
  revivesUsed: number; pileTicks: number; riseTicks: number; diveKill: boolean;
  /** Enemy King: guard id per summon point; Throne Beam height */
  decreeGuards: (number | null)[]; beamHigh: boolean;
}

export function castleState(e: EnemyState): CastleState {
  return e.castle ??= { stone: e.def.id === 'gargoyle', crackTicks: 0, farTicks: 0, returning: false, swoopTo: null, wardTarget: null, wardedBy: null,
    revivesUsed: 0, pileTicks: 0, riseTicks: 0, diveKill: false, decreeGuards: [], beamHigh: false };
}

export const isPile = (e: EnemyState): boolean => !!e.castle && e.castle.pileTicks > 0;
export const isStone = (e: EnemyState): boolean => e.castle?.stone === true;

/** Target multiplier from stone form and a Castle Mage ward (04 §7). */
export function castleTargetMult(e: EnemyState): number {
  return (isStone(e) ? C.gargoyle.stoneMult : 1) * (e.castle?.wardedBy != null ? C.ward.mult : 1);
}

export function isDiveGroup(w: GameWorld, id: number): boolean {
  return !!w.dive && (w.dive.descentId === id || w.dive.impactId === id);
}

// ------------------------------------------------------------------------------------------------ Gargoyle
function wake(w: GameWorld, e: EnemyState): void {
  const s = castleState(e);
  s.stone = false; s.crackTicks = C.gargoyle.crackTicks; s.farTicks = 0; s.returning = false;
  e.aware = true; e.noticeT = 0; e.ai.state = 'engage';
  void w;
}

/** A Gargoyle that takes player damage wakes (04 §7). */
export function onCastleDamaged(w: GameWorld, e: EnemyState): void {
  if (e.def.id === 'gargoyle' && isStone(e)) wake(w, e);
}

export function gargoyleHoverPoint(w: GameWorld, e: EnemyState): { x: number; y: number } {
  const side = e.x >= w.body.x ? 1 : -1;
  return { x: w.body.x + side * C.gargoyle.hoverToward, y: w.body.y - C.gargoyle.hoverAbove };
}
export function gargoyleAtHover(w: GameWorld, e: EnemyState): boolean {
  const p = gargoyleHoverPoint(w, e);
  return Math.hypot(p.x - e.x, p.y - e.y) <= C.gargoyle.hoverSnap;
}

/** Hover movement (replaces the preferred band). True while this enemy is a Gargoyle. */
export function stepCastleAi(w: GameWorld, e: EnemyState): boolean {
  if (e.def.id !== 'gargoyle') return false;
  const p = gargoyleHoverPoint(w, e), dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
  if (d <= C.gargoyle.hoverSnap) { e.vx = 0; e.vy = 0; return true; }
  const speed = Math.min(e.def.fly!, d * 120);
  e.vx = dx / d * speed; e.vy = dy / d * speed;
  return true;
}

function stepGargoyle(w: GameWorld, e: EnemyState): boolean {
  const s = castleState(e);
  if (s.stone) {
    e.vx = 0; e.vy = 0;
    const c = enemyCenter(e), pc = { x: w.body.x, y: w.body.y - w.body.h / 2 };
    if (Math.hypot(pc.x - c.x, pc.y - c.y) <= C.gargoyle.wakeRange && lineOfSight(w, c.x, c.y, pc.x, pc.y)) wake(w, e);
    return true;
  }
  if (s.crackTicks > 0) { s.crackTicks--; e.vx = 0; e.vy = 0; return true; }
  if (e.ai.attack) return false;
  const c = enemyCenter(e);
  s.farTicks = Math.hypot(w.body.x - c.x, w.body.y - w.body.h / 2 - c.y) > C.gargoyle.farRange ? s.farTicks + 1 : 0;
  if (s.farTicks >= C.gargoyle.farTicks && e.waveArena === null) s.returning = true;
  if (s.returning) {
    const dx = e.spawn.x - e.x, dy = e.spawn.y - e.y, d = Math.hypot(dx, dy);
    if (d <= 2) { e.x = e.spawn.x; e.y = e.spawn.y; e.remX = e.remY = 0; e.vx = e.vy = 0; s.stone = true; s.returning = false; e.aware = false; e.ai.state = 'idle'; return true; }
    const speed = Math.min(e.def.fly!, d * 120);
    e.vx = dx / d * speed; e.vy = dy / d * speed;
    return true;
  }
  return false;
}

// ------------------------------------------------------------------------------------------------ Castle Mage Ward
export function wardCandidate(w: GameWorld, mage: EnemyState): EnemyState | null {
  const mc = enemyCenter(mage);
  let best: EnemyState | null = null;
  for (const o of w.enemies) {
    if (o === mage || o.dead || o.dormant || o.spawnInTicks > 0 || o.def.tier === 'boss' || o.def.tier === 'dummy' || o.def.tier === 'target' || isPile(o) || o.castle?.wardedBy != null) continue;
    const oc = enemyCenter(o);
    if (Math.hypot(oc.x - mc.x, oc.y - mc.y) > C.ward.range || !lineOfSight(w, mc.x, mc.y, oc.x, oc.y)) continue;
    if (!best || o.hp > best.hp || (o.hp === best.hp && o.id < best.id)) best = o;
  }
  return best;
}

function endWard(w: GameWorld, mage: EnemyState): void {
  const s = mage.castle;
  if (!s || s.wardTarget === null) return;
  const ally = w.enemies.find((o) => o.id === s.wardTarget);
  if (ally?.castle && ally.castle.wardedBy === mage.id) ally.castle.wardedBy = null;
  s.wardTarget = null;
}

// ------------------------------------------------------------------------------------------------ Living Armor
/** The first HP-0 collapses instead of dying (04 §7). Returns true when the death was absorbed. */
export function collapseArmor(w: GameWorld, e: EnemyState): boolean {
  if (!e.def.revives) return false;
  const s = castleState(e);
  if (isPile(e)) { if (s.diveKill) return false; e.hp = 0; return true; }
  if (s.revivesUsed >= e.def.revives) return false;
  s.revivesUsed++;
  cancelEnemyAttack(w, e); removeEnemyGroups(w, e);
  e.status = newStatus(); e.control = null; e.knockback = false; e.token = null; e.vx = 0; e.hp = 0; e.ward = null;
  s.pileTicks = C.armor.pileTicks;
  return true;
}

function stepArmor(e: EnemyState): boolean {
  const s = castleState(e);
  if (s.pileTicks > 0) {
    e.vx = 0;
    if (--s.pileTicks === 0) { e.hp = Math.round(C.armor.reviveFraction * e.maxHp); e.poise = e.def.poiseMax; s.riseTicks = C.armor.riseTicks; }
    return true;
  }
  if (s.riseTicks > 0) {
    e.vx = 0;
    if (--s.riseTicks === 0) { e.aware = true; e.ai.state = 'engage'; }
    return true;
  }
  return false;
}

// ------------------------------------------------------------------------------------------------ Enemy King
function arenaOf(w: GameWorld, e: EnemyState) { return e.boss ? w.arenas.get(e.boss.arenaId)?.rect : undefined; }

function summonPoints(w: GameWorld, king: EnemyState): { x: number; y: number }[] {
  const a = arenaOf(w, king)!;
  const pts = (w.level?.objects ?? []).filter((o) => o.type === 'summon_point' && o.props.arena === king.boss!.arenaId).map((o) => ({ x: o.x, y: o.y }));
  return pts.length ? pts.sort((p, q) => p.x - q.x) : [{ x: a.x + 48, y: a.y + a.h }, { x: a.x + a.w - 48, y: a.y + a.h }];
}

function summonDecree(w: GameWorld, king: EnemyState): void {
  const s = castleState(king), pts = summonPoints(w, king), mid = arenaOf(w, king)!.x + arenaOf(w, king)!.w / 2;
  pts.forEach((p, i) => {
    const old = s.decreeGuards[i];
    if (old != null && w.enemies.some((o) => o.id === old && !o.dead)) return;       // that point's guard is still alive
    const g = w.spawnExtra({ enemy: 'royal_guard', x: p.x, y: p.y, facing: p.x < mid ? 1 : -1 });
    g.summonOwner = king.id; g.noRewards = true; g.aware = true; g.ai.state = 'engage'; g.spawnInTicks = ENEMY.SPAWN_IN_TICKS;
    s.decreeGuards[i] = g.id;
  });
}

/** Called from startEnemyAttack: markers that exist from the Tele start. */
export function castleTeleStart(w: GameWorld, e: EnemyState): void {
  const id = e.ai.attack?.def.id;
  if (e.def.id !== 'enemy_king') return;
  const a = arenaOf(w, e);
  if (id === 'blade_rain' && a) {
    for (const dx of C.king.swordXs) w.rockMarkers.push({
      x: Math.max(a.x + C.king.wallInset, Math.min(a.x + a.w - C.king.wallInset, Math.round(w.body.x + dx))), topY: a.y, owner: e.id,
      ticks: e.ai.attack!.len, attack: 'blade_rain', proj: 'falling_sword' });
  }
  if (id === 'throne_beam') castleState(e).beamHigh = w.rng.enemyAI.next() < 0.5;
}

/** Throne Beam: fade out for 0.3 s, then reappear 48 px from the wall farther from the player, facing them. */
export function castleTeleTick(w: GameWorld, e: EnemyState): void {
  const a = e.ai.attack!;
  if (e.def.id !== 'enemy_king' || a.def.id !== 'throne_beam' || (a.link ?? 0) !== 0 || a.t !== C.king.beamFadeTicks) return;
  const r = arenaOf(w, e);
  if (!r) return;
  const farLeft = w.body.x - r.x > r.x + r.w - w.body.x;      // the left wall is the farther one
  const x = farLeft ? r.x + C.king.beamWallInset : r.x + r.w - C.king.beamWallInset;
  if (boxFree(w.grid, x, e.y, e.def.hurtbox.w, e.def.hurtbox.h)) { e.x = x; e.remX = 0; }
  e.facing = w.body.x >= e.x ? 1 : -1;
}

function beamHit(w: GameWorld, e: EnemyState): EnemyHit {
  const base = e.def.attacks.find((a) => a.id === 'throne_beam')!.hit!;
  const r = arenaOf(w, e)!, wall = e.facing > 0 ? r.x + r.w : r.x;
  const half = e.def.hurtbox.w / 2, len = Math.max(16, Math.abs(wall - e.x) - half);
  const band = castleState(e).beamHigh ? C.king.beamHigh : C.king.beamLow;
  return { ...base, box: { dx: half + len / 2, dy: (band.top + band.bottom) / 2, w: len, h: band.bottom - band.top } };
}
export function beamBand(e: EnemyState): { top: number; bottom: number } { return castleState(e).beamHigh ? C.king.beamHigh : C.king.beamLow; }

// ------------------------------------------------------------------------------------------------ per-tick and hooks
/** True when a special state owns this enemy's tick (waiting, stone, pile, forced Decree). */
export function stepCastleSpecial(w: GameWorld, e: EnemyState): boolean {
  if (e.def.id === 'gargoyle') return stepGargoyle(w, e);
  if (e.def.id === 'living_armor') return stepArmor(e);
  if (e.def.id === 'enemy_king' && e.boss && !e.ai.attack && e.boss.entered?.length) {
    e.boss.entered.shift();                                 // the phase entry fires once per phase actually entered
    startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'royal_decree')!);
    return true;
  }
  return false;
}

/** The attack ended early (stagger, control, death): a ward ends with it. */
export function cancelCastleAttack(w: GameWorld, e: EnemyState): void {
  if (e.def.id === 'castle_mage') endWard(w, e);
  if (e.castle) e.castle.swoopTo = null;
}

export function castleAttackHooks(e: EnemyState): AttackHooks | null {
  const def = e.ai.attack?.def;
  if (!def) return null;
  if (e.def.id === 'castle_mage' && def.id === 'ward') return {
    onActStart(w, en) {
      en.vx = 0;
      const ally = wardCandidate(w, en);
      if (ally) { castleState(en).wardTarget = ally.id; castleState(ally).wardedBy = en.id; }
    },
    onActTick(w, en) {
      en.vx = 0;
      const s = castleState(en), ally = w.enemies.find((o) => o.id === s.wardTarget);
      if (!ally || ally.dead || isPile(ally)) return true;
      const a = enemyCenter(en), b = enemyCenter(ally);
      return Math.hypot(a.x - b.x, a.y - b.y) > C.ward.maxApart;
    },
    onRecStart(w, en) { en.vx = 0; endWard(w, en); },
  };
  if (e.def.id === 'gargoyle' && def.id === 'swoop') return {
    onActStart(w, en) {
      const to = { x: w.body.x, y: w.body.y }, c = enemyCenter(en);
      castleState(en).swoopTo = to;
      const dx = to.x - c.x, dy = to.y - en.def.hurtbox.h / 2 - c.y, d = Math.hypot(dx, dy) || 1;
      en.vx = dx / d * C.gargoyle.swoopSpeed; en.vy = dy / d * C.gargoyle.swoopSpeed;
    },
    onActTick(_w, en) {
      const to = castleState(en).swoopTo;
      return en.hitWall || (!!to && en.y >= to.y);
    },
    onRecStart(_w, en) { en.vx = 0; en.vy = 0; castleState(en).swoopTo = null; },
  };
  if (e.def.id !== 'enemy_king') return null;
  if (def.id === 'royal_decree') return { onActStart: summonDecree, onRecStart(_w, en) { en.vx = 0; } };
  if (def.id === 'blade_rain') return {
    onActStart(w, en) { dropMarkedRocks(w, (r) => r.owner === en.id && r.attack === 'blade_rain'); },
    onRecStart(_w, en) { en.vx = 0; },
  };
  if (def.id === 'throne_beam') return {
    deferHit: true,
    onActStart(w, en) { en.vx = 0; spawnAttackGroup(w, en, beamHit(w, en)); },
    onRecStart(_w, en) { en.vx = 0; },
  };
  return null;
}

void ENEMY_PROJECTILES;
