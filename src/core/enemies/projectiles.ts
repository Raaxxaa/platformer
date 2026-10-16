// Enemy projectiles: aimed straight shots and floor waves (04 §2.7, §8).
import { boxToWorld, sweep, type Rect } from '../combat/hitGroups.ts';
import { boxFree } from '../physics/collide.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { ENEMY, TICK, TILE_SIZE } from '../tuning.ts';
import type { EnemyState } from './enemy.ts';
import type { EnemyProjectileDef } from './types.ts';


export interface EnemyProjectile {
  id: number; def: EnemyProjectileDef; owner: number;
  x: number; y: number;            // box center
  vx: number; vy: number;
  traveled: number;
  groupId: number;
}

function rectOf(p: EnemyProjectile): Rect {
  return { x: p.x - p.def.w / 2, y: p.y - p.def.h / 2, w: p.def.w, h: p.def.h };
}

/** Spawns a projectile for enemy `e`. Straight shots start at the 04 §2.7 spawn point; floor waves at `at` (feet). */
export function spawnEnemyProjectile(w: GameWorld, e: EnemyState, def: EnemyProjectileDef, aim: 'player' | 'facing', angleDeg: number,
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
    if (aim === 'player') {
      const tx = w.body.x, ty = w.body.y - w.body.h / 2;
      const a = Math.atan2(ty - y, (tx - x) * e.facing);
      const lim = (ENEMY.AIM_CLAMP_DEG * Math.PI) / 180;
      ang += Math.max(-lim, Math.min(lim, a));
    }
    vx = e.facing * Math.cos(ang) * speed;
    vy = Math.sin(ang) * speed;
  }
  const id = w.newId();
  const p: EnemyProjectile = { id, def, owner: e.id, x, y, vx, vy, traveled: 0, groupId: id };
  w.projectiles.push(p);
  w.hitGroups.push({
    id, owner: e.id, kind: 'shot', rect: rectOf(p), spec: { damage: def.hit.damage, kb: [0, 0], poise: 0, hitStop: 0, kind: 'shot' },
    enemyHit: def.hit, active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: id,
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

/** Step 6: move every projectile, test terrain and range; the hit group becomes the swept box. */
export function stepProjectiles(w: GameWorld): void {
  for (const p of [...w.projectiles]) {
    const prev = rectOf(p);
    const nx = p.x + p.vx * TICK, ny = p.y + p.vy * TICK;
    const speed = Math.hypot(p.vx, p.vy);
    if (p.def.motion === 'floorWave') {
      const feet = ny + p.def.h / 2;
      const front = nx + Math.sign(p.vx) * (p.def.w / 2) - (p.vx < 0 ? 0 : 1);
      if (!boxFree(w.grid, nx, feet, p.def.w, p.def.h) || !hasSupport(w, Math.floor(front), feet)) { removeProjectile(w, p); continue; }
    } else if (!boxFree(w.grid, nx, ny + p.def.h / 2, p.def.w, p.def.h)) {
      removeProjectile(w, p);
      continue;
    }
    p.x = nx; p.y = ny;
    p.traveled += speed * TICK;
    if (p.def.range !== undefined && p.traveled > p.def.range) { removeProjectile(w, p); continue; }
    const g = w.hitGroups.find((h) => h.id === p.groupId);
    if (g) g.rect = sweep(prev, rectOf(p));
  }
}
