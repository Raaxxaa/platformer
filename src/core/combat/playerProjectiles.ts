// Player projectiles and explosions (02 §9.8, §10.4). Not slowed by the player's hit-stop.
import { boxFree } from '../physics/collide.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { TICK } from '../tuning.ts';
import { PLAYER_PROJECTILES, PROJECTILE_SPAWN } from '../../data/playerProjectiles.ts';
import { sweep, type HitGroup, type Rect } from './hitGroups.ts';
import type { HitSpec, ProjectileDef, ProjectileId } from './types.ts';

export interface PlayerProjectile {
  id: number; def: ProjectileDef; slot: 0 | 1; attackInstance: number;
  x: number; y: number;              // box center
  vx: number; vy: number;
  traveled: number;                  // px flown (Eagle Eye, 03 §5.4)
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
  spawnBlast(w, p.x, p.y, { w: b.w * m, h: b.h * m }, p.def.hit, p.slot, p.attackInstance, { bonus: p.bonus, projectile: p.id });
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
    id: pid, def, slot, attackInstance, x: b.x + f * PROJECTILE_SPAWN.dx, y: b.y + PROJECTILE_SPAWN.dy,
    vx: f * Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, traveled: 0, hits: 0, bonus: opts.bonus ?? 0, groupId: pid, opts,
  };
  w.playerProjectiles.push(p);
  const g: HitGroup = {
    id: pid, owner: 'player', kind: 'shot', rect: rectOf(p), spec: def.hit, active: true, lastHitTick: new Map(), hitCount: new Map(),
    attackInstance, slot, dir: f, projectile: pid, bonus: p.bonus,
    contact: def.explodeOnEnemy ? (ww) => { explode(ww, p); removePlayerProjectile(ww, p); g.active = false; return true; } : undefined,
    onHit: (ww, gg, e, info) => {
      opts.onHit?.(ww, gg, e, info);
      p.hits += 1;
      if (p.hits > def.pierce) { removePlayerProjectile(ww, p); gg.active = false; }
    },
  };
  w.hitGroups.push(g);
  if (!boxFree(w.grid, p.x, p.y + def.h / 2, def.w, def.h)) endProjectile(w, p);
  return p;
}

/** Step 6: blasts from last tick go; projectiles move, test terrain and range; the hit group becomes the swept box. */
export function stepPlayerProjectiles(w: GameWorld): void {
  const gone = new Set(w.blasts);
  // Last tick's blasts, and the groups of projectiles that ended (a projectile's group id is its own id).
  w.hitGroups = w.hitGroups.filter((g) => !gone.has(g.id) && !(g.projectile === g.id && !g.active));
  w.blasts = [];
  for (const p of [...w.playerProjectiles]) {
    const prev = rectOf(p);
    p.vy += p.def.gravity * TICK;
    const nx = p.x + p.vx * TICK, ny = p.y + p.vy * TICK;
    if (!boxFree(w.grid, nx, ny + p.def.h / 2, p.def.w, p.def.h)) { endProjectile(w, p); continue; }
    p.traveled += Math.hypot(nx - p.x, ny - p.y);
    p.x = nx; p.y = ny;
    if (p.traveled >= p.def.range) { endProjectile(w, p); continue; }
    const g = w.hitGroups.find((h) => h.id === p.groupId);
    if (g) g.rect = sweep(prev, rectOf(p));
  }
}

/** Death / stage start: every player projectile and blast goes. */
export function clearPlayerProjectiles(w: GameWorld): void {
  const ids = new Set([...w.playerProjectiles.map((p) => p.groupId), ...w.blasts]);
  w.playerProjectiles = [];
  w.hitGroups = w.hitGroups.filter((g) => !ids.has(g.id));
  w.blasts = [];
}
