// Enemy projectiles: straight/homing shots, arc bombs and floor waves (04 §2.7, §8).
import { ENEMY_ARC } from '../../data/mountainProjectiles.ts';
import { boxToWorld, overlaps, sweep, type Rect } from '../combat/hitGroups.ts';
import { playerRect } from '../combat/resolve.ts';
import { boxFree } from '../physics/collide.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { ENEMY, TICK, TILE_SIZE, ticks } from '../tuning.ts';
import type { EnemyState } from './enemy.ts';
import type { EnemyProjectileDef } from './types.ts';


export interface EnemyProjectile {
  id: number; def: EnemyProjectileDef; owner: number;
  x: number; y: number;            // box center
  vx: number; vy: number;
  /** Last horizontal travel direction; grounded bombs keep their throw direction. */
  dir: 1 | -1;
  traveled: number;
  groupId: number;
  arc?: { landed: boolean; fuseTicks: number };
}

function rectOf(p: EnemyProjectile): Rect {
  return { x: p.x - p.def.w / 2, y: p.y - p.def.h / 2, w: p.def.w, h: p.def.h };
}

/** Spawns a projectile for enemy `e`. Straight shots start at the 04 §2.7 spawn point; floor waves at `at` (feet). */
export function spawnEnemyProjectile(w: GameWorld, e: EnemyState, def: EnemyProjectileDef, aim: 'player' | 'facing' | 'arc', angleDeg: number,
  at?: { x: number; y: number }): EnemyProjectile {
  const speed = def.speed ?? 0;
  let x: number, y: number, vx: number, vy: number;
  if (def.motion === 'floorWave') {
    const feet = at ?? boxToWorld({ dx: ENEMY.WAVE_SPAWN_DX, dy: 0, w: 0, h: 0 }, e.x, e.y, e.facing);
    x = feet.x; y = feet.y - def.h / 2;
    vx = e.facing * speed; vy = 0;
  } else {
    x = at?.x ?? e.x + e.facing * (e.def.hurtbox.w / 2 + 4);
    y = at?.y ?? e.y - 0.6 * e.def.hurtbox.h;
    let ang = (angleDeg * Math.PI) / 180;
    if (def.motion === 'arc') {
      const time = def.arcTime!;
      vx = Math.max(-ENEMY_ARC.maxVx, Math.min(ENEMY_ARC.maxVx, (w.body.x - x) / time));
      vy = (w.body.y - y - 0.5 * ENEMY_ARC.gravity * time * time) / time;
    } else {
      if (aim === 'player') {
        const tx = w.body.x, ty = w.body.y - w.body.h / 2;
        const a = Math.atan2(ty - y, (tx - x) * e.facing);
        const lim = (ENEMY.AIM_CLAMP_DEG * Math.PI) / 180;
        ang += Math.max(-lim, Math.min(lim, a));
      }
      vx = e.facing * Math.cos(ang) * speed;
      vy = Math.sin(ang) * speed;
    }
  }
  const id = w.newId();
  const p: EnemyProjectile = { id, def, owner: e.id, x, y, vx, vy, dir: vx === 0 ? e.facing : vx < 0 ? -1 : 1, traveled: 0, groupId: id };
  if (def.motion === 'arc') p.arc = { landed: false, fuseTicks: 0 };
  w.projectiles.push(p);
  w.hitGroups.push({
    id, owner: e.id, kind: 'shot', rect: rectOf(p), spec: { damage: def.hit.damage, kb: [0, 0], poise: 0, hitStop: 0, kind: 'shot' },
    enemyHit: def.hit, active: def.id !== 'bomb', lastHitTick: new Map(), hitCount: new Map(), attackInstance: id, dir: p.dir,
  });
  return p;
}

export function removeProjectile(w: GameWorld, p: EnemyProjectile): void {
  w.projectiles = w.projectiles.filter((q) => q !== p);
  w.hitGroups = w.hitGroups.filter((g) => g.id !== p.groupId);
}

function hasSupport(w: GameWorld, px: number, feetY: number): boolean {
  return w.grid.isSolidPx(px, feetY) || (feetY % TILE_SIZE === 0 && w.grid.kindAt(Math.floor(px / TILE_SIZE), feetY / TILE_SIZE) === 'oneway');
}

/** Replace the bomb with one one-tick enemy blast. Damage remains in normal hit resolution. */
function explodeBomb(w: GameWorld, p: EnemyProjectile): void {
  const blast = p.def.blast!;
  removeProjectile(w, p);
  const id = w.newId();
  w.hitGroups.push({
    id, owner: p.owner, kind: 'shot', rect: { x: p.x - blast.w / 2, y: p.y - blast.h / 2, w: blast.w, h: blast.h },
    spec: { damage: p.def.hit.damage, kb: [0, 0], poise: 0, hitStop: 0, kind: 'shot' }, enemyHit: p.def.hit,
    active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: p.id, dir: p.dir,
  });
  w.blasts.push(id);
}

function solidBox(w: GameWorld, x: number, y: number, width: number, height: number): boolean {
  for (let ty = Math.floor((y - height / 2) / TILE_SIZE); ty < Math.ceil((y + height / 2) / TILE_SIZE); ty++) {
    for (let tx = Math.floor((x - width / 2) / TILE_SIZE); tx < Math.ceil((x + width / 2) / TILE_SIZE); tx++) {
      if (w.grid.isSolidTile(tx, ty)) return true;
    }
  }
  return false;
}

function landingTop(w: GameWorld, p: EnemyProjectile, nextY: number): number | null {
  const bottom = p.y + p.def.h / 2, nextBottom = nextY + p.def.h / 2;
  for (let ty = Math.floor(bottom / TILE_SIZE); ty <= Math.floor(nextBottom / TILE_SIZE); ty++) {
    const top = ty * TILE_SIZE;
    if (bottom > top || nextBottom < top) continue;
    for (let tx = Math.floor((p.x - p.def.w / 2) / TILE_SIZE); tx < Math.ceil((p.x + p.def.w / 2) / TILE_SIZE); tx++) {
      if (w.grid.isSolidTile(tx, ty) || w.grid.kindAt(tx, ty) === 'oneway') return top;
    }
  }
  return null;
}

function moveArc(w: GameWorld, p: EnemyProjectile, dt: number): void {
  const dx = p.vx * dt, dy = p.vy * dt + 0.5 * ENEMY_ARC.gravity * dt * dt;
  p.vy += ENEMY_ARC.gravity * dt;
  // Sample at most one pixel per substep so a fast falling arc cannot tunnel through a platform.
  const count = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let i = 0; i < count; i++) {
    const nx = p.x + dx / count;
    if (solidBox(w, nx, p.y, p.def.w, p.def.h)) p.vx = 0;
    else p.x = nx;
    const ny = p.y + dy / count;
    const top = dy >= 0 ? landingTop(w, p, ny) : null;
    if (top !== null) {
      p.y = top - p.def.h / 2; p.vx = 0; p.vy = 0;
      p.arc!.landed = true; p.arc!.fuseTicks = ticks(p.def.blast!.fuse);
      return;
    }
    if (solidBox(w, p.x, ny, p.def.w, p.def.h)) p.vy = 0;
    else p.y = ny;
  }
}

function home(w: GameWorld, p: EnemyProjectile, dt: number): void {
  const homing = p.def.homing;
  if (!homing) return;
  const dx = w.body.x - p.x, dy = w.body.y - w.body.h / 2 - p.y;
  if (Math.hypot(dx, dy) > homing.radius) return;
  const angle = Math.atan2(p.vy, p.vx), target = Math.atan2(dy, dx);
  const delta = Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
  const limit = homing.turnRate * Math.PI / 180 * dt;
  const next = angle + Math.max(-limit, Math.min(limit, delta));
  const speed = p.def.speed ?? Math.hypot(p.vx, p.vy);
  p.vx = Math.cos(next) * speed; p.vy = Math.sin(next) * speed;
}

function syncDirection(w: GameWorld, p: EnemyProjectile): void {
  if (p.vx !== 0) p.dir = p.vx < 0 ? -1 : 1;
  const group = w.hitGroups.find((g) => g.id === p.groupId);
  if (group) group.dir = p.dir;
}

/** Step 6: move every projectile, test terrain and range; the hit group becomes the swept box. */
export function stepProjectiles(w: GameWorld): void {
  const scale = w.worldTimeScale;
  if (scale <= 0) return;
  const dt = TICK * scale;
  for (const p of [...w.projectiles]) {
    const prev = rectOf(p);
    if (p.arc) {
      syncDirection(w, p);
      if (p.arc.landed) {
        p.arc.fuseTicks -= scale;
        if (p.arc.fuseTicks <= 0) explodeBomb(w, p);
        continue;
      }
      moveArc(w, p, dt);
      if (overlaps(sweep(prev, rectOf(p)), playerRect(w))) explodeBomb(w, p);
      continue;
    }
    home(w, p, dt);
    syncDirection(w, p);
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (p.def.motion === 'floorWave') {
      const feet = ny + p.def.h / 2;
      const front = nx + Math.sign(p.vx) * (p.def.w / 2) - (p.vx < 0 ? 0 : 1);
      if (!boxFree(w.grid, nx, feet, p.def.w, p.def.h) || !hasSupport(w, Math.floor(front), feet)) { removeProjectile(w, p); continue; }
    } else if (!boxFree(w.grid, nx, ny + p.def.h / 2, p.def.w, p.def.h)) {
      removeProjectile(w, p);
      continue;
    }
    p.traveled += Math.hypot(nx - p.x, ny - p.y);
    p.x = nx; p.y = ny;
    if (p.def.range !== undefined && p.traveled >= p.def.range) { removeProjectile(w, p); continue; }
    const g = w.hitGroups.find((h) => h.id === p.groupId);
    if (g) g.rect = sweep(prev, rectOf(p));
  }
}
