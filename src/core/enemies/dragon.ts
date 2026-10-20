// The Dragon (04 §9, §13): perched in the side arena, ground moves, Wing Gust and Hop, color specials, the phase 2 air loop,
// passive when the player leaves. Scripted flight: in the air the body moves by hand (no gravity, no tile collision).
import { DRAGON as D, DRAGONS, type DragonColor } from '../../data/dragon.ts';
import { ENEMY_PROJECTILES } from '../../data/enemyProjectiles.ts';
import { moveX } from '../physics/collide.ts';
import { boxToWorld, overlaps } from '../combat/hitGroups.ts';
import { applyPlayerStatus } from '../combat/playerStatus.ts';
import { playerRect } from '../combat/resolve.ts';
import type { ArenaRt } from '../run/arenas.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { TICK } from '../tuning.ts';
import { finishEnemyAct, removeEnemyGroups, spawnAttackGroup, startEnemyAttack, type AttackHooks } from './attack.ts';
import { spawnEnemy, type EnemyState } from './enemy.ts';
import { dropMarkedRocks } from './greatBoar.ts';
import { spawnEnemyProjectile } from './projectiles.ts';
import type { EnemyHit } from './types.ts';

export type DragonMode = 'ground' | 'rise' | 'air' | 'takeoff' | 'falling';

/** A timed area: a marker from `markFrom`, then a hit box (or poison cloud) between `start` and `end` (world ticks). */
export interface DragonEffect {
  kind: 'spike' | 'bolt' | 'cloud';
  x: number | null; markFrom: number; start: number; end: number; sampleAt?: number;
  groupId: number | null; nextStatus: number;
}

export interface DragonState {
  color: DragonColor;
  awake: boolean; passive: boolean; outsideTicks: number;
  mode: DragonMode; segTicks: number; untouchable: boolean;
  markerX: number | null; markerLocked: boolean;
  gustBoost: boolean; gustSpeed: number; hopping: boolean; hopDir: 1 | -1; strafeTo: number;
  effects: DragonEffect[];
}

export function dragonState(e: EnemyState): DragonState { return e.dragon!; }
const isDragon = (e: EnemyState): boolean => !!e.dragon;
const arenaOf = (w: GameWorld, e: EnemyState) => w.arenas.get(e.boss!.arenaId)!.rect;
const floorOf = (w: GameWorld, e: EnemyState) => { const a = arenaOf(w, e); return a.y + a.h; };
const hoverOf = (w: GameWorld, e: EnemyState) => floorOf(w, e) - D.hoverAbove;
export const dragonDef = (e: EnemyState) => e.def.attacks.find((a) => a.id === 'color_special')!;

/** 04 §9.2: perched at the side arena's center x, on its floor, facing the opening (left). Dormant until the player enters. */
export function spawnDragon(w: GameWorld, a: ArenaRt, color: DragonColor): EnemyState {
  const e = spawnEnemy(w, { enemy: 'dragon', x: Math.round(a.rect.x + a.rect.w / 2), y: a.rect.y + a.rect.h, facing: -1 });
  e.def = DRAGONS[color];
  e.boss = { arenaId: a.id, introTicks: 0, enraged: false, phase: 1, transitionTicks: 0 };
  e.dragon = { color, awake: false, passive: false, outsideTicks: 0, mode: 'ground', segTicks: 0, untouchable: false, markerX: null, markerLocked: false,
    gustBoost: false, gustSpeed: 0, hopping: false, hopDir: 1, strafeTo: 0, effects: [] };
  w.enemies.push(e);
  return e;
}

const inArena = (w: GameWorld, e: EnemyState): boolean => {
  const r = arenaOf(w, e), x = w.body.x, y = w.body.y - w.body.h / 2;
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
};

// ------------------------------------------------------------------------------------------------ world step
function clearEffects(w: GameWorld, e: EnemyState): void {
  const d = dragonState(e);
  for (const f of d.effects) if (f.groupId !== null) w.hitGroups = w.hitGroups.filter((g) => g.id !== f.groupId);
  d.effects = [];
}

function goPassive(w: GameWorld, e: EnemyState): void {
  const d = dragonState(e), r = arenaOf(w, e);
  d.passive = true;
  if (e.ai.attack) { e.ai.attack = null; e.token = null; }
  removeEnemyGroups(w, e); clearEffects(w, e);
  w.projectiles = w.projectiles.filter((p) => p.owner !== e.id); w.hitGroups = w.hitGroups.filter((g) => g.owner !== e.id);
  w.rockMarkers = w.rockMarkers.filter((m) => m.owner !== e.id); w.puddles = w.puddles.filter((p) => p.owner !== e.id);
  e.x = r.x + r.w / 2; e.y = r.y + r.h; e.remX = e.remY = 0; e.vx = e.vy = 0; e.grounded = true;
  d.mode = 'ground'; d.untouchable = false; e.ai.state = 'engage'; e.control = null;
}

function effectRect(w: GameWorld, e: EnemyState, f: DragonEffect): { x: number; y: number; w: number; h: number } {
  const r = arenaOf(w, e), floor = r.y + r.h, x = f.x ?? e.x;
  if (f.kind === 'spike') return { x: x - D.ice.w / 2, y: floor - D.ice.h, w: D.ice.w, h: D.ice.h };
  if (f.kind === 'bolt') return { x: x - D.thunder.w / 2, y: r.y, w: D.thunder.w, h: r.h };
  return { x: x - D.toxic.w / 2, y: floor - D.toxic.h, w: D.toxic.w, h: D.toxic.h };
}

function effectHit(color: DragonColor, kind: DragonEffect['kind']): EnemyHit {
  const dummy = { dx: 0, dy: 0, w: 1, h: 1 };
  if (kind === 'spike') return { box: dummy, damage: D.ice.damage, status: { id: 'chilled' } };
  if (kind === 'bolt') return { box: dummy, damage: D.thunder.damage, unblockable: true };
  void color;
  return { box: dummy, damage: 0 };
}

function stepEffects(w: GameWorld, e: EnemyState): void {
  const d = dragonState(e), alive: DragonEffect[] = [];
  for (const f of d.effects) {
    if (f.sampleAt !== undefined && w.tick >= f.sampleAt && f.x === null) f.x = w.body.x;       // a bolt marks the player's x when its marker starts
    if (f.kind === 'cloud' && w.tick >= f.start && f.x !== null) f.x += Math.sign(w.body.x - f.x) * Math.min(Math.abs(w.body.x - f.x), D.toxic.drift * TICK);
    if (w.tick >= f.end) { if (f.groupId !== null) w.hitGroups = w.hitGroups.filter((g) => g.id !== f.groupId); continue; }
    alive.push(f);
    if (w.tick < f.start || f.x === null) continue;
    const rect = effectRect(w, e, f);
    if (f.kind === 'cloud') {
      if (overlaps(rect, playerRect(w)) && w.tick >= f.nextStatus && !w.health.dead) { applyPlayerStatus(w, 'poisoned', 1); f.nextStatus = w.tick + D.toxic.statusEveryTicks; }
      continue;
    }
    if (f.groupId === null) {
      const id = w.newId(), hit = effectHit(d.color, f.kind);
      f.groupId = id;
      w.hitGroups.push({ id, owner: e.id, kind: 'shot', rect, spec: { damage: hit.damage, kb: [0, 0], poise: 0, hitStop: 0, kind: 'shot' }, enemyHit: hit,
        active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: id, dir: w.body.x >= rect.x ? 1 : -1 });
    }
  }
  d.effects = alive;
}

/** Wake, passive and effect timers. Called once per tick after the arena step. */
export function stepDragonWorld(w: GameWorld): void {
  for (const e of w.enemies) {
    if (!isDragon(e) || e.dead) continue;
    const d = dragonState(e), inside = inArena(w, e);
    if (!d.awake) {
      if (inside && !w.health.dead) {
        d.awake = true; e.dormant = false; e.aware = true; e.ai.state = 'engage'; e.boss!.introTicks = 120;     // wakes with a 1.0 s intro
      }
      continue;
    }
    if (inside) { d.outsideTicks = 0; if (d.passive) d.passive = false; }                                          // resumes with no intro
    else if (++d.outsideTicks >= D.passiveTicks && !d.passive) goPassive(w, e);
    stepEffects(w, e);
    if (d.mode === 'ground' && d.untouchable) d.untouchable = false;
  }
}

// ------------------------------------------------------------------------------------------------ body (scripted flight)
/** Air, rise, take-off and fall: the body moves by hand. Returns true when it did. */
export function stepDragonBody(w: GameWorld, e: EnemyState): boolean {
  if (!isDragon(e)) return false;
  const d = dragonState(e), r = arenaOf(w, e), floor = floorOf(w, e);
  if (d.mode === 'ground') {
    const half = e.def.hurtbox.w / 2;
    if (e.x < r.x + half) e.x = r.x + half; else if (e.x > r.x + r.w - half) e.x = r.x + r.w - half;       // never leaves the arena
    return false;
  }
  const hover = hoverOf(w, e);
  if (d.mode === 'rise' || d.mode === 'takeoff') {
    e.vy = -(floor - hover) / ((d.mode === 'rise' ? D.transitionRiseTicks : D.takeoffTicks) * TICK);
    if (e.y + e.vy * TICK <= hover) { e.y = hover; e.vy = 0; d.mode = 'air'; d.segTicks = 0; }
  } else if (d.mode === 'falling' && e.vy < D.fallSpeed && !e.ai.attack) e.vy = D.fallSpeed;
  e.x = Math.max(r.x + D.wallInset, Math.min(r.x + r.w - D.wallInset, e.x + e.vx * TICK));
  e.y += e.vy * TICK;
  e.remX = e.remY = 0; e.grounded = false;
  d.untouchable = e.y - e.def.hurtbox.h < r.y;                                  // above the arena top: not hittable (04 §13.1)
  if (d.mode === 'falling' && e.y >= floor) {
    e.y = floor; e.vy = 0; e.vx = 0; e.grounded = true; d.mode = 'ground'; d.segTicks = 0; d.untouchable = false;
    if (e.control?.type === 'stagger' && e.control.ticks > 1e5) e.control.ticks = Math.round(e.def.boss!.breakTime * 120);   // the Break starts when it lands
  }
  return true;
}

/** After the body moved: a Dive Bomb finishes its Act on landing. */
export function afterDragonBody(w: GameWorld, e: EnemyState): void {
  const a = e.ai.attack;
  if (isDragon(e) && a?.phase === 'act' && a.def.id === 'dive_bomb' && e.grounded) finishEnemyAct(w, e, dragonAttackHooks(e) ?? {});
}

/** The air segment ends in a forced Dive Bomb; a broken dragon in the air falls (04 §13.1). Hook after damagePoise. */
export function onDragonBreak(e: EnemyState): void {
  const d = e.dragon;
  if (!d || d.mode === 'ground') return;
  d.mode = 'falling'; e.control!.ticks = 1e6; e.vx = 0; e.vy = D.fallSpeed;
}

/** Phase 2 starts with a 1.0 s transition in which it takes off. */
export function onDragonPhase(e: EnemyState): void {
  const d = e.dragon;
  if (d && e.boss!.phase >= 2) { d.mode = 'rise'; d.segTicks = 0; }
}

// ------------------------------------------------------------------------------------------------ AI
/** Air hover (follows the player's x at 140 px/s, 96 px to its own side). True while it owns movement. */
export function stepDragonAi(w: GameWorld, e: EnemyState): boolean {
  if (!isDragon(e)) return false;
  const d = dragonState(e);
  if (d.mode !== 'air') return d.mode !== 'ground';
  const tx = w.body.x + (e.x >= w.body.x ? 1 : -1) * D.hoverOffset, dx = tx - e.x;
  e.vx = Math.sign(dx) * Math.min(D.hoverSpeed, Math.abs(dx) / TICK); e.vy = 0;
  return true;
}

const GROUND_ONLY = ['breath', 'claw_swipe', 'tail_sweep', 'wing_gust'], AIR_ONLY = ['dive_bomb', 'strafing_breath'];
/** Which attacks the Dragon may start now: ground moves on the ground, dives and strafes in the air, the special in both. */
export function dragonAllows(w: GameWorld, e: EnemyState, id: string): boolean {
  const d = dragonState(e);
  if (d.passive || d.mode === 'rise' || d.mode === 'takeoff' || d.mode === 'falling') return false;
  if (GROUND_ONLY.includes(id)) return d.mode === 'ground';
  if (AIR_ONLY.includes(id)) return d.mode === 'air';
  if (id === 'tail_sweep') return d.mode === 'ground';
  void w;
  return true;
}
export function dragonBehind(w: GameWorld, e: EnemyState): boolean { return Math.sign(w.body.x - e.x) === -e.facing; }
export const dragonWeightMult = (e: EnemyState, id: string): number => (e.dragon?.gustBoost && id === 'breath' ? 3 : 1);

/** Per-tick specials: passive idling, the segment timers, the forced Dive Bomb and Wing Hop. True when it owns the tick. */
export function stepDragonSpecial(w: GameWorld, e: EnemyState): boolean {
  if (!isDragon(e)) return false;
  const d = dragonState(e);
  if (d.passive) { e.vx = 0; return true; }
  if (d.mode === 'rise' || d.mode === 'takeoff' || d.mode === 'falling') return true;
  if (e.ai.attack) return false;
  const phase2 = e.boss!.phase >= 2;
  if (d.mode === 'air') {
    d.segTicks++;
    if (d.segTicks >= D.segmentTicks) { startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'dive_bomb')!); return true; }
    return false;
  }
  if (phase2 && ++d.segTicks >= D.segmentTicks) { d.mode = 'takeoff'; d.segTicks = 0; e.vx = 0; return true; }
  // Wing Hop: the player behind it and far: hop 160 px toward them (CD 3.0 s).
  if (d.hopping) {
    e.vx = e.grounded ? 0 : e.vx;
    if (e.grounded) { d.hopping = false; e.facing = d.hopDir; e.ai.turnTicks = 0; }
    return d.hopping;
  }
  if (e.grounded && (e.ai.cooldowns.get('wing_hop') ?? 0) <= 0 && dragonBehind(w, e) && Math.abs(w.body.x - e.x) > D.hopMinX) {
    e.ai.cooldowns.set('wing_hop', D.hopCooldownTicks);
    d.hopping = true; d.hopDir = w.body.x > e.x ? 1 : -1;
    e.vx = d.hopDir * D.hopVx; e.vy = D.hopVy; e.grounded = false;
    return true;
  }
  return false;
}

// ------------------------------------------------------------------------------------------------ attacks
export function dragonTeleStart(w: GameWorld, e: EnemyState): void {
  if (!isDragon(e)) return;
  const d = dragonState(e), a = e.ai.attack!, id = a.def.id, r = arenaOf(w, e), floor = floorOf(w, e);
  if (id !== 'wing_gust') d.gustBoost = false;
  d.markerX = id === 'dive_bomb' ? w.body.x : null; d.markerLocked = false;
  if (id === 'strafing_breath') d.strafeTo = w.body.x - r.x > r.x + r.w - w.body.x ? r.x + D.wallInset : r.x + r.w - D.wallInset;   // the side farther from the player
  if (id !== 'color_special') return;
  const t0 = w.tick, end = t0 + a.len;
  if (d.color === 'red') {
    for (const dx of D.fireRain.offsets) w.rockMarkers.push({ x: Math.max(r.x + 8, Math.min(r.x + r.w - 8, Math.round(w.body.x + dx))), topY: r.y, owner: e.id,
      ticks: a.len, attack: 'fire_rain', proj: 'fire_rain' });
  } else if (d.color === 'white') {
    for (let i = 0; i < 4; i++) d.effects.push({ kind: 'spike', x: e.x + e.facing * (D.ice.first + D.ice.step * i), markFrom: t0, start: end + i * D.ice.delayTicks,
      end: end + i * D.ice.delayTicks + D.ice.activeTicks, groupId: null, nextStatus: 0 });
  } else if (d.color === 'storm') {
    for (let i = 0; i < 3; i++) {
      const strike = end + i * D.thunder.gapTicks;
      d.effects.push({ kind: 'bolt', x: i === 0 ? w.body.x : null, markFrom: strike - D.thunder.markerTicks, sampleAt: i === 0 ? undefined : strike - D.thunder.markerTicks,
        start: strike, end: strike + D.thunder.activeTicks, groupId: null, nextStatus: 0 });
    }
  }
  void floor;
}

export function dragonTeleTick(w: GameWorld, e: EnemyState): void {
  if (!isDragon(e)) return;
  const d = dragonState(e), a = e.ai.attack!, r = arenaOf(w, e);
  if (a.def.id === 'dive_bomb') {
    const top = r.y - D.dive.aboveTop;
    if (a.t <= D.dive.riseTicks) { e.vx = 0; e.vy = (top - hoverOf(w, e)) / (D.dive.riseTicks * TICK); }
    else {
      e.vy = 0; e.vx = 0;
      if (a.t <= D.dive.riseTicks + D.dive.followTicks) d.markerX = w.body.x;               // the 128 px floor marker follows for 0.8 s, then locks 0.3 s
      else d.markerLocked = true;
    }
  } else if (a.def.id === 'strafing_breath') {
    const left = Math.max(1, a.len - a.t + 1);
    e.vx = (d.strafeTo - e.x) / (left * TICK); e.vy = 0;
  }
}

export function cancelDragonAttack(w: GameWorld, e: EnemyState): void {
  if (!isDragon(e)) return;
  const d = dragonState(e);
  if (e.ai.attack?.def.id === 'color_special' && d.color === 'red') w.rockMarkers = w.rockMarkers.filter((m) => m.owner !== e.id);
  if (e.ai.attack?.def.id === 'dive_bomb' || e.ai.attack?.def.id === 'strafing_breath') e.vx = 0;
  if (e.ai.attack?.def.id === 'dive_bomb' && d.mode === 'air') { e.vy = 0; if (e.y < hoverOf(w, e)) e.y = hoverOf(w, e); }
}

function wingGustTick(w: GameWorld, e: EnemyState): void {
  const z = D.gust.zone, rect = boxToWorld({ dx: z.dx, dy: z.dy, w: z.w, h: z.h }, e.x, e.y, e.facing), b = w.body;
  if (!overlaps(rect, playerRect(w)) || b.state === 'dash' || b.forced || b.state === 'minecart') { dragonState(e).gustSpeed = 0; return; }
  const away = Math.sign(b.x - e.x) || e.facing, d = dragonState(e);
  d.gustSpeed = Math.min(D.gust.cap, d.gustSpeed + D.gust.accel);                           // 600 px/s² while the speed away is under 240
  moveX(b, w.grid, away * d.gustSpeed * TICK, false);
}

function diveImpact(w: GameWorld, e: EnemyState): void {
  spawnAttackGroup(w, e);
  const id = e.ai.attack!.groupId;
  if (id !== null) { const g = w.hitGroups.find((x) => x.id === id)!; g.box = undefined; w.blasts.push(id); }
  const base = ENEMY_PROJECTILES.shockwave!, pd = { ...base, speed: D.dive.waveSpeed, range: D.dive.waveRange, hit: { ...base.hit, damage: D.dive.waveDamage, playerKb: e.ai.attack!.def.hit!.playerKb } };
  for (const dir of [-1, 1] as const) {
    const p = spawnEnemyProjectile(w, e, pd, 'facing', 0, { x: e.x, y: e.y });
    p.vx = dir * pd.speed; p.dir = dir;
    const g = w.hitGroups.find((x) => x.id === p.groupId);
    if (g) g.dir = dir;
  }
}

export function dragonAttackHooks(e: EnemyState): AttackHooks | null {
  const def = e.ai.attack?.def;
  if (!def || !isDragon(e)) return null;
  const d = dragonState(e);
  if (def.id === 'wing_gust') return {
    onActStart(_w, en) { en.vx = 0; },
    onActTick(w, en) { wingGustTick(w, en); return false; },
    onRecStart(_w, en) { en.vx = 0; dragonState(en).gustBoost = true; },
  };
  if (def.id === 'color_special') return {
    onActStart(w, en) {
      en.vx = 0;
      if (d.color === 'red') dropMarkedRocks(w, (r) => r.owner === en.id && r.attack === 'fire_rain');
      if (d.color === 'green') {
        const t = w.tick;
        for (const dx of D.toxic.offsets) d.effects.push({ kind: 'cloud', x: Math.max(arenaOf(w, en).x + 32, Math.min(arenaOf(w, en).x + arenaOf(w, en).w - 32, w.body.x + dx)),
          markFrom: t, start: t, end: t + D.toxic.lifeTicks, groupId: null, nextStatus: t });
      }
    },
    onRecStart(_w, en) { en.vx = 0; },
  };
  if (def.id === 'dive_bomb') return {
    deferHit: true, untilLanding: true,
    onActStart(w, en) {
      const r = arenaOf(w, en);
      en.x = Math.max(r.x + D.wallInset, Math.min(r.x + r.w - D.wallInset, d.markerX ?? w.body.x)); en.y = r.y - D.dive.aboveTop; en.remX = en.remY = 0;
      en.vx = 0; en.vy = D.dive.speed; d.mode = 'falling';
    },
    onActTick() { return false; },
    onRecStart(w, en) { en.vx = en.vy = 0; d.mode = 'ground'; d.segTicks = 0; diveImpact(w, en); },
  };
  if (def.id === 'strafing_breath') return {
    onActStart(w, en) {
      const r = arenaOf(w, en);
      d.strafeTo = en.x < r.x + r.w / 2 ? r.x + r.w - D.wallInset : r.x + D.wallInset;
      en.facing = d.strafeTo > en.x ? 1 : -1; en.vx = en.facing * D.strafe.speed; en.vy = 0;
    },
    onActTick(_w, en) { en.vx = en.facing * D.strafe.speed; return en.facing > 0 ? en.x >= d.strafeTo - 2 : en.x <= d.strafeTo + 2; },
    onRecStart(_w, en) { en.vx = 0; },
  };
  return null;
}
