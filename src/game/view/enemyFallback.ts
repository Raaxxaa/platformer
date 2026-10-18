import type { EnemyState } from '../../core/enemies/enemy.ts';
import { enemyRect } from '../../core/enemies/enemy.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { TILE_SIZE } from '../../core/tuning.ts';

/** One shared visibility decision for sprites, grey bodies, warnings and darkness glints. */
export function enemyDrawing(w: GameWorld, e: EnemyState) {
  const hidden = !!e.swamp?.submerged;
  const r = enemyRect(e);
  let threadTop: number | null = null;
  if (!hidden && !e.dead && e.swamp?.hanging) {
    const tx = Math.floor(e.x / TILE_SIZE);
    for (let ty = Math.floor(r.y / TILE_SIZE) - 1; ty >= 0; ty--) {
      if (w.grid.isSolidTile(tx, ty)) { threadTop = (ty + 1) * TILE_SIZE; break; }
    }
    threadTop ??= 0;
  }
  return {
    hidden, bubble: hidden && !e.dead, threadTop,
    glint: !hidden && !e.dead && w.darkZones.some(z => e.x >= z.x && e.x < z.x + z.w && r.y >= z.y && r.y < z.y + z.h),
    warning: !hidden && !e.dead && e.ai.attack?.phase === 'tele',
  };
}
