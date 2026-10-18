// Enemy body: gravity, collision, ledges, knockback motion and separation (04 §2.1, 02 §4.2).
import { approach } from '../math.ts';
import { isGrounded, moveX, moveY, type AABBBody } from '../physics/collide.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { COMBAT, ENEMY, TICK, TILE_SIZE } from '../tuning.ts';
import type { EnemyState } from './enemy.ts';

function asBox(e: EnemyState): AABBBody {
  return { x: e.x, y: e.y, w: e.def.hurtbox.w, h: e.def.hurtbox.h, remX: e.remX, remY: e.remY };
}

function copyBack(e: EnemyState, b: AABBBody): void {
  e.x = b.x; e.y = b.y; e.remX = b.remX; e.remY = b.remY;
}

/** Is there solid or one-way support 1 px past the front edge, 1 px below the feet (04 §2.1)? */
export function supportAhead(w: GameWorld, e: EnemyState, dir: 1 | -1): boolean {
  const half = e.def.hurtbox.w / 2;
  const px = dir > 0 ? e.x + half : e.x - half - 1;
  return w.grid.isSolidPx(px, e.y) || (e.y % TILE_SIZE === 0 && w.grid.kindAt(Math.floor(px / TILE_SIZE), e.y / TILE_SIZE) === 'oneway');
}

/** May this enemy walk off the ledge ahead? Only `dropsLedges` enemies, and only when the player is lower. */
function mayDrop(w: GameWorld, e: EnemyState): boolean {
  return e.def.dropsLedges === true && w.body.y > e.y;
}

/** One enemy-time tick of movement. AI and attacks set `vx` before this; knockback owns it while active. */
export function stepEnemyBody(w: GameWorld, e: EnemyState): void {
  if (e.def.stationary) return;
  const c = e.control;
  if (c?.type === 'pin') { e.vx = 0; e.vy = 0; return; }                // held flush, no gravity (02 §4.4)
  if (c?.type === 'pull' && c.to) { stepPull(w, e); return; }
  if (e.knockback) {
    e.vx = approach(e.vx, 0, (e.grounded ? COMBAT.ENEMY_KB_DECAY_GROUND : COMBAT.ENEMY_KB_DECAY_AIR) * TICK);
    if (e.def.flying) e.vy = approach(e.vy, 0, COMBAT.ENEMY_KB_DECAY_GROUND * TICK);
  } else if (!e.def.flying && e.grounded && e.vx !== 0 && !e.ai.attack?.def.leap) {
    const dir: 1 | -1 = e.vx > 0 ? 1 : -1;
    if (!supportAhead(w, e, dir) && !mayDrop(w, e)) e.vx = 0;     // stop at the edge
  }
  // Flyers retain their AI's vertical velocity and pass through one-way platforms (04 §2.1).
  const vyStart = e.vy;
  if (!e.def.flying && (!e.grounded || e.vy < 0)) e.vy = Math.min(ENEMY.MAX_FALL, e.vy + ENEMY.GRAVITY * TICK);
  const box = asBox(e);
  if (moveX(box, w.grid, e.vx * TICK, true) === 'wall') {
    e.vx = 0;
    e.hitWall = true;
  }
  const r = moveY(box, w.grid, ((vyStart + e.vy) / 2) * TICK, { dropping: e.def.flying === true, preferDir: 0 });
  if (r === 'bonk') { e.vy = 0; if (e.def.flying) e.hitWall = true; }
  if (r === 'landed' && e.def.flying) { e.vy = 0; e.hitWall = true; }
  copyBack(e, box);
  e.grounded = !e.def.flying && isGrounded(box, w.grid, e.vy);
  if (e.grounded) e.vy = 0;
  if (c?.type === 'launch' && !c.landed && e.grounded) c.landed = true;     // acts again 0.2 s after landing
  if (e.knockback && (e.grounded || e.def.flying) && !e.control && Math.abs(e.vx) < COMBAT.ENEMY_KB_CONTROL_SPEED) {
    e.knockback = false;
    e.vx = 0;
  }
}

/** Pull (02 §4.4): straight toward the point at its speed, no gravity; ends within 4 px (then a stun if set). */
function stepPull(w: GameWorld, e: EnemyState): void {
  const c = e.control!, to = c.to!;
  const cy = e.y - e.def.hurtbox.h / 2;
  const dx = to.x - e.x, dy = to.y - cy, d = Math.hypot(dx, dy);
  const step = to.speed * TICK;
  const box = asBox(e);
  if (d <= COMBAT.PULL_ARRIVE || d <= step) {
    moveX(box, w.grid, dx, true);
    moveY(box, w.grid, dy, { dropping: false, preferDir: 0 });
    copyBack(e, box);
    e.vx = 0; e.vy = 0;
    e.control = c.thenStun ? { type: 'stun', ticks: c.thenStun } : null;
  } else {
    e.vx = (dx / d) * to.speed; e.vy = (dy / d) * to.speed;
    if (moveX(box, w.grid, e.vx * TICK, true) === 'wall') e.vx = 0;
    moveY(box, w.grid, e.vy * TICK, { dropping: false, preferDir: 0 });
    copyBack(e, box);
  }
  e.grounded = isGrounded(asBox(e), w.grid, e.vy);
}

/** Grounded non-boss enemies within 10 px push apart at 40 px/s each; lower id moves left on a tie. */
export function separateEnemies(w: GameWorld): void {
  const list = w.enemies.filter((e) => !e.dead && !e.dormant && e.grounded && e.def.size !== 'boss' && !e.def.stationary).sort((a, b) => a.id - b.id);
  const step = ENEMY.SEPARATION_SPEED * TICK;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.x - a.x;
      if (Math.abs(dx) >= ENEMY.SEPARATION_DIST) continue;
      const dirA: 1 | -1 = dx < 0 ? 1 : -1;
      for (const [e, d] of [[a, dirA], [b, -dirA]] as const) {
        const box = asBox(e);
        moveX(box, w.grid, d * step, false);
        copyBack(e, box);
      }
    }
  }
}
