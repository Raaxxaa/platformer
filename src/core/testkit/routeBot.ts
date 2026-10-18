// A simple greedy "bot" that plays the main path with real inputs (tests only). It walks toward the next
// main_path vertex and jumps, double-jumps, wall-jumps, slides and drops through as needed. It proves the
// geometry can be traversed with the moves the level teaches; it is not a speedrunner.
import { boxFree, isGrounded, supportIsOnlyOneWay } from '../physics/collide.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { specToInput, type InputSpec } from '../sim/playerSim.ts';
import { MOVE, TILE_SIZE } from '../tuning.ts';
import { killEnemy } from '../combat/resolve.ts';

export interface BotResult { reached: number; total: number; ticks: number; stuckAt: { x: number; y: number } | null; log: string[] }

const T = TILE_SIZE;

export function runRouteBot(w: GameWorld, opts: { maxTicksPerVertex?: number; clearFights?: boolean } = {}): BotResult {
  const pts = (w.level?.objects.find((o) => o.type === 'main_path')?.points ?? []).map((p) => ({ x: p.x, feet: Math.floor(p.y / T) * T + T }));
  const maxPer = opts.maxTicksPerVertex ?? 900;
  const log: string[] = [];
  let prev: InputSpec = {};
  let i = 1;
  let spent = 0;
  let jumpHeld = 0;
  let releaseNext = false;
  const step = (spec: InputSpec) => { w.step(specToInput(prev, spec)); prev = spec; };
  const start = w.tick;

  while (i < pts.length) {
    const b = w.body;
    const tgt = pts[i];
    if (opts.clearFights !== false) {
      w.health.iframeTicks = 1000;                         // the bot measures movement, not fighting
      w.health.hp = w.health.maxHp;
      // Arena waves and the boss die once they can be hit, so the doors open.
      for (const e of w.enemies) {
        const inLockedArena = (e.waveArena !== null && w.run.arenas[e.waveArena]?.locked) || (e.boss && w.run.arenas[e.boss.arenaId]?.locked);
        if (inLockedArena && !e.dead && e.spawnInTicks === 0 && !(e.boss && e.boss.introTicks > 0)) killEnemy(w, e);
      }
    }
    if (w.run.phase === 'statPick' && opts.clearFights !== false) w.confirmStatPick();
    if (w.run.phase === 'transition' || w.run.phase === 'loading' || w.run.phase === 'village') break;
    const dx = tgt.x - b.x;
    const above = b.y - tgt.feet;                          // > 0: the target is higher
    const grounded = isGrounded(b, w.grid, b.vy);
    // Reached: close enough and standing at the target height (or a little past it horizontally).
    if (Math.abs(dx) <= 6 && Math.abs(above) <= 2 && grounded) { i++; spent = 0; continue; }
    if (spent++ > maxPer) {
      log.push(`stuck going to vertex ${i} (${Math.floor(tgt.x / T)}, ${tgt.feet / T - 1}) from (${(b.x / T).toFixed(1)}, ${(b.y / T).toFixed(1)}) state ${b.state}`);
      return { reached: i - 1, total: pts.length - 1, ticks: w.tick - start, stuckAt: { x: b.x, y: b.y }, log };
    }
    const dir: -1 | 0 | 1 = Math.abs(dx) > 3 ? (dx > 0 ? 1 : -1) : 0;
    const spec: InputSpec = { moveX: dir };
    // Low ceiling ahead (slide tunnel): crawl through.
    const ahead = b.x + dir * (b.w / 2 + 4);
    const lowAhead = dir !== 0 && !boxFree(w.grid, ahead, b.y, b.w, MOVE.BOX_H) && boxFree(w.grid, ahead, b.y, b.w, MOVE.BOX_H_LOW);
    if (lowAhead || b.state === 'crawl') spec.moveY = 1;
    if (lowAhead && grounded && b.state !== 'crawl' && b.state !== 'slide') spec.dash = true;
    // Drop through a one-way branch when the target is below.
    const onOneWay = grounded && supportIsOnlyOneWay(b, w.grid);
    const wantDrop = onOneWay && above < -T && Math.abs(dx) < 3 * T;
    // Jumping: the target is higher, a wall blocks the way, or the ground ends ahead.
    const wallAhead = dir !== 0 && !boxFree(w.grid, b.x + dir * 3, b.y - 2, b.w, b.h);
    const noFloorAhead = dir !== 0 && grounded && !isGrounded({ ...b, x: b.x + dir * (b.w / 2 + 6) }, w.grid, 0) && above > -2 * T;
    let jump = false;
    if (releaseNext) { releaseNext = false; }
    else if (wantDrop) { spec.moveY = 1; jump = true; jumpHeld = 0; releaseNext = true; spec.moveX = 0; }
    else if (grounded && (above > 4 || wallAhead || noFloorAhead) && !lowAhead) { jump = true; jumpHeld = 1; }
    else if (b.state === 'wallSlide' && above > 4) { jump = true; jumpHeld = 1; spec.moveX = (-b.facing) as -1 | 1; }
    else if (!grounded && jumpHeld > 0 && b.vy < 0) { jump = true; jumpHeld++; }
    else if (!grounded && b.doubleJumpAvailable && b.vy > -60 && (above > 2 || (noFloorAhead && above > -T)) && jumpHeld === 0) { jump = true; jumpHeld = 1; }
    else jumpHeld = 0;
    if (jump && prev.jump && jumpHeld === 1) { jump = false; jumpHeld = 0; }    // a fresh press needs one released tick
    spec.jump = jump;
    // Air dash across long gaps when falling short.
    if (!grounded && b.airDashAvailable && b.vy > 0 && Math.abs(dx) > 3 * T && above > -T) spec.dash = true;
    step(spec);
  }
  return { reached: i - 1, total: pts.length - 1, ticks: w.tick - start, stuckAt: null, log };
}
