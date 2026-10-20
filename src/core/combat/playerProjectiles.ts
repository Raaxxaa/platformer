// Player projectiles and explosions (02 §9.8, §10.4). Not slowed by the player's hit-stop.
import { boxFree } from '../physics/collide.ts';
import { enemyCenter, enemyHittable } from '../enemies/enemy.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { TICK, ticks } from '../tuning.ts';
import { PLAYER_PROJECTILES, PROJECTILE_SPAWN } from '../../data/playerProjectiles.ts';
import { WEAPON_SPECIAL } from '../../data/weapons.ts';
import { sweep, type HitGroup, type Rect } from './hitGroups.ts';
import type { HitSpec, ProjectileDef, ProjectileId } from './types.ts';

export interface PlayerProjectile {
  id: number; def: ProjectileDef; slot: 0 | 1; attackInstance: number;
  x: number; y: number;              // box center
  vx: number; vy: number;
  traveled: number;                  // px flown (Eagle Eye, 03 §5.4)
  age: number;                       // ticks alive (lifetime)
  hits: number;
  bonus: number;                     // additive bonus fixed at firing (Warden, link)
  groupId: number;
  opts: FireOpts;
}

/** Extra knobs a firing step may pass (hybrids, specials). */
export interface FireOpts {
  bonus?: number;
  /** Blast box multiplier (Arcane Archer orb ×1.5). */
  blastMult?: number;
  onHit?: HitGroup['onHit'];
  /** The combo step that fired it. */
  step?: number;
  /** S-grade signatures: replace the hit (Triple Shot side arrows), the pierce count (Impaler), pull (Singularity). */
  spec?: HitSpec;
  pierce?: number;
  singularity?: boolean;
  /** Start point (default: the 02 §9.8 spawn point) and a direction vector (default: facing + angle). */
  origin?: { x: number; y: number };
  velocity?: { vx: number; vy: number };
  /** Replaces the def's homing (Seeker Swarm). */
  homing?: { radius: number; turnRate: number };
  /** Replaces the def's lifetime, seconds. */
  lifetimeS?: number;
  /** Javelin Anchor (02 §13): its platforms last longer and three can exist. */
  platformLifeS?: number;
  platformMax?: number;
  /** Called when the projectile ends without exploding (wall or range): x, y of its end. */
  onEnd?: (w: GameWorld, p: PlayerProjectile, x: number, y: number) => void;
}

const rectOf = (p: PlayerProjectile): Rect => ({ x: p.x - p.def.w / 2, y: p.y - p.def.h / 2, w: p.def.w, h: p.def.h });

/** A blast that hits every enemy in its box once, on the tick it appears (02 §10.4). */
export function spawnBlast(w: GameWorld, x: number, y: number, size: { w: number; h: number }, hit: HitSpec, slot: 0 | 1 | undefined,
  attackInstance: number, extra: Partial<HitGroup> = {}): HitGroup {
  const g: HitGroup = {
    id: w.newId(), owner: 'player', kind: 'shot', rect: { x: x - size.w / 2, y: y - size.h / 2, w: size.w, h: size.h }, spec: hit,
    active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance, slot, kbFromX: x, ...extra,
  };
  w.hitGroups.push(g);
  w.blasts.push(g.id);
  return g;
}

function explode(w: GameWorld, p: PlayerProjectile): void {
  const m = p.opts.blastMult ?? 1;
  const b = p.def.blast!;
  spawnBlast(w, p.x, p.y, { w: b.w * m, h: b.h * m }, p.def.hit, p.slot, p.attackInstance, { bonus: p.bonus, projectile: p.id, traveled: p.traveled });
}

/** The projectile goes now; its group is only switched off (hit resolution may be looping over the list) and is
 *  cleared out at the next step 6. */
export function removePlayerProjectile(w: GameWorld, p: PlayerProjectile): void {
  w.playerProjectiles = w.playerProjectiles.filter((q) => q !== p);
  const g = w.hitGroups.find((x) => x.id === p.groupId);
  if (g) g.active = false;
}

/** The projectile ends against terrain or at its range: `onWall` (vanish or explode). */
function endProjectile(w: GameWorld, p: PlayerProjectile): void {
  if (p.def.onWall === 'explode' && p.def.blast) explode(w, p);
  else p.opts.onEnd?.(w, p, p.x, p.y);
  removePlayerProjectile(w, p);
}

/** 02 §9.8: spawns at +12, −18 from the feet in the facing direction; inside a wall it runs `onWall` at once. */
export function firePlayerProjectile(w: GameWorld, slot: 0 | 1, attackInstance: number, id: ProjectileId, angleDeg: number, opts: FireOpts = {}): PlayerProjectile | null {
  const def = PLAYER_PROJECTILES[id];
  if (!def) return null;
  const b = w.body, f = b.facing;
  const a = (angleDeg * Math.PI) / 180;
  const pid = w.newId();
  const p: PlayerProjectile = {
    id: pid, def, slot, attackInstance, x: opts.origin?.x ?? b.x + f * PROJECTILE_SPAWN.dx, y: opts.origin?.y ?? b.y + PROJECTILE_SPAWN.dy,
    vx: opts.velocity?.vx ?? f * Math.cos(a) * def.speed, vy: opts.velocity?.vy ?? Math.sin(a) * def.speed,
    traveled: 0, age: 0, hits: 0, bonus: opts.bonus ?? 0, groupId: pid, opts,
  };
  w.playerProjectiles.push(p);
  const g: HitGroup = {
    id: pid, owner: 'player', kind: 'shot', rect: rectOf(p), spec: opts.spec ?? def.hit, active: true, lastHitTick: new Map(), hitCount: new Map(),
    attackInstance, slot, dir: f, projectile: pid, bonus: p.bonus, traveled: 0, step: opts.step,
    contact: def.explodeOnEnemy ? (ww) => { explode(ww, p); removePlayerProjectile(ww, p); g.active = false; return true; } : undefined,
    onHit: (ww, gg, e, info) => {
      opts.onHit?.(ww, gg, e, info);
      p.hits += 1;
      if (p.hits > (opts.pierce ?? def.pierce)) { removePlayerProjectile(ww, p); gg.active = false; }
    },
  };
  w.hitGroups.push(g);
  if (!boxFree(w.grid, p.x, p.y + def.h / 2, def.w, def.h)) endProjectile(w, p);
  return p;
}

/** Tick start: last tick's one-tick groups (blasts, slams, bolts) and the groups of ended projectiles go. */
export function clearSpentGroups(w: GameWorld): void {
  const gone = new Set(w.blasts);
  w.hitGroups = w.hitGroups.filter((g) => !gone.has(g.id) && !(g.projectile === g.id && !g.active));
  w.blasts = [];
}

/** 02 §10.4 homing: the nearest living enemy whose center is inside the radius and ahead; turn toward it by at most turnRate × TICK. */
function steerHoming(w: GameWorld, p: PlayerProjectile, h: { radius: number; turnRate: number }): void {
  let best: { x: number; y: number } | null = null, bestD = Infinity;
  for (const e of w.enemies) {
    if (!enemyHittable(e)) continue;
    const c = enemyCenter(e), dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy);
    if (d > h.radius || dx * p.vx + dy * p.vy <= 0 || d >= bestD) continue;
    best = c; bestD = d;
  }
  if (!best) return;
  const speed = Math.hypot(p.vx, p.vy);
  const cur = Math.atan2(p.vy, p.vx), want = Math.atan2(best.y - p.y, best.x - p.x);
  let diff = want - cur;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const max = (h.turnRate * Math.PI / 180) * TICK;
  const a = cur + Math.max(-max, Math.min(max, diff));
  p.vx = Math.cos(a) * speed; p.vy = Math.sin(a) * speed;
}

/** 02 §10.5 Javelin: a javelin that hits a solid tile flying more sideways than up or down sticks as a one-way platform. */
function stickJavelin(w: GameWorld, p: PlayerProjectile): boolean {
  const J = WEAPON_SPECIAL.javelinPlatform;
  const s = Math.sign(p.vx);
  const xBlocked = !boxFree(w.grid, p.x + p.vx * TICK, p.y + p.def.h / 2, p.def.w, p.def.h);     // a wall, not a floor or ceiling
  if (Math.abs(p.vx) <= Math.abs(p.vy) || s === 0 || !xBlocked) return false;
  const y = Math.round(p.y);
  let face = p.x + s * (p.def.w / 2);
  for (let k = 0; k < 8 && !w.grid.isSolidPx(Math.floor(s > 0 ? face : face - 1), y); k++) face += s;
  if (!w.grid.isSolidPx(Math.floor(s > 0 ? face : face - 1), y)) return false;
  face = Math.round(face);
  const max = p.opts.platformMax ?? J.max;
  const list = w.grid.pixelPlatforms;
  while (list.length >= max) list.shift();                                  // a 3rd removes the oldest
  list.push({ x: s > 0 ? face - J.w : face, y: Math.round(p.y + J.topOffset), w: J.w, h: J.h, born: w.tick, expireTick: w.tick + ticks(p.opts.platformLifeS ?? J.lifeS) });
  return true;
}

/** Javelin platforms that ran out go (they blink for their last second: the view reads `expireTick`). */
export function stepJavelinPlatforms(w: GameWorld): void {
  const list = w.grid.pixelPlatforms;
  if (list.length === 0) return;
  w.grid.pixelPlatforms = list.filter((q) => q.expireTick > w.tick);
}

/** Step 6: projectiles move, test terrain and range; the hit group becomes the swept box. */
export function stepPlayerProjectiles(w: GameWorld): void {
  stepJavelinPlatforms(w);
  for (const p of [...w.playerProjectiles]) {
    const prev = rectOf(p);
    const homing = p.opts.homing ?? p.def.homing;
    if (homing) steerHoming(w, p, homing);
    p.vy += p.def.gravity * TICK;
    p.age += 1;
    const lifeS = p.opts.lifetimeS ?? p.def.lifetime;
    if (lifeS !== undefined && p.age > ticks(lifeS)) { removePlayerProjectile(w, p); continue; }
    const nx = p.x + p.vx * TICK, ny = p.y + p.vy * TICK;
    if (!boxFree(w.grid, nx, ny + p.def.h / 2, p.def.w, p.def.h)) {
      if (p.def.onWall === 'stick' && stickJavelin(w, p)) removePlayerProjectile(w, p);
      else endProjectile(w, p);
      continue;
    }
    p.traveled += Math.hypot(nx - p.x, ny - p.y);
    p.x = nx; p.y = ny;
    if (p.traveled >= p.def.range) { endProjectile(w, p); continue; }
    const g = w.hitGroups.find((h) => h.id === p.groupId);
    if (g) { g.rect = sweep(prev, rectOf(p)); g.traveled = p.traveled; }
  }
}

/** Death / stage start: every player projectile and blast goes. */
export function clearPlayerProjectiles(w: GameWorld): void {
  const ids = new Set([...w.playerProjectiles.map((p) => p.groupId), ...w.blasts]);
  w.playerProjectiles = [];
  w.hitGroups = w.hitGroups.filter((g) => !ids.has(g.id));
  w.blasts = [];
}
