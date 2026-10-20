// Cannons (06 §10): a level hazard, not an enemy. Fixed-step state only; damage is not stage-scaled.
import { CANNON as C } from '../../data/hazards.ts';
import { overlaps, type Rect } from '../combat/hitGroups.ts';
import type { LevelObject } from '../level/loadLevel.ts';
import type { TileGrid } from '../level/tiles.ts';
import { TICK, ticks } from '../tuning.ts';

export interface Cannon {
  id: number;
  /** The muzzle (the object's center point). */
  x: number; y: number;
  dir: 1 | -1;
  intervalTicks: number;
  offsetTicks: number;
  range: number;
  /** Has the cannon ever been inside the view area? The first shot comes `offset` s after that. */
  seen: boolean;
  /** Ticks until the next shot. */
  left: number;
}
export interface CannonBall { id: number; cannon: number; x: number; y: number; dir: 1 | -1; traveled: number }
export interface CannonsState { cannons: Cannon[]; balls: CannonBall[]; nextId: number }

export function createCannons(objects: readonly LevelObject[]): CannonsState {
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    cannons: objects.filter((o) => o.type === 'cannon').map((o) => ({
      id: o.id, x: o.x, y: o.y, dir: num(o.props.dir, 1) < 0 ? -1 : 1,
      intervalTicks: Math.max(1, ticks(num(o.props.interval, C.intervalS))), offsetTicks: ticks(num(o.props.offset, C.offsetS)),
      range: num(o.props.range, C.range), seen: false, left: 0,
    })),
    balls: [], nextId: 1,
  };
}

/** The muzzle flashes for the last 0.6 s before each shot (the telegraph). */
export function cannonFlashing(c: Cannon): boolean {
  return c.seen && c.left <= C.telegraphTicks;
}

function inActiveArea(c: Cannon, view: Rect): boolean {
  return c.x >= view.x - C.activeMargin && c.x <= view.x + view.w + C.activeMargin
    && c.y >= view.y - C.activeMargin && c.y <= view.y + view.h + C.activeMargin;
}

function solidAt(grid: TileGrid, x: number, y: number): boolean {
  const h = C.size / 2;
  return grid.isSolidPx(x - h, y - h) || grid.isSolidPx(x + h - 1, y - h) || grid.isSolidPx(x - h, y + h - 1) || grid.isSolidPx(x + h - 1, y + h - 1);
}

/** One world tick. Returns the ball that hit the player (and removes it), if any; the owner applies C.damage. */
export function stepCannons(state: CannonsState, grid: TileGrid, view: Rect, playerBox: Rect, worldTimeScale: number): CannonBall | null {
  if (!Number.isFinite(worldTimeScale) || worldTimeScale <= 0) return null;
  let hit: CannonBall | null = null;
  const alive: CannonBall[] = [], range = new Map(state.cannons.map((c) => [c.id, c.range]));
  for (const b of state.balls) {
    const step = C.speed * TICK * worldTimeScale;
    const nx = b.x + b.dir * step;
    // Sweep the whole step against the player; the ball then stops at solids (one-way tiles are ignored).
    const swept: Rect = { x: Math.min(b.x, nx) - C.size / 2, y: b.y - C.size / 2, w: Math.abs(nx - b.x) + C.size, h: C.size };
    const blocked = solidAt(grid, nx, b.y);
    if (!hit && overlaps(swept, playerBox)) { hit = b; continue; }
    b.traveled += step;
    if (blocked || b.traveled >= (range.get(b.cannon) ?? C.range)) continue;
    b.x = nx;
    alive.push(b);
  }
  state.balls = alive;
  for (const c of state.cannons) {
    if (!inActiveArea(c, view)) continue;
    if (!c.seen) { c.seen = true; c.left = c.offsetTicks; }
    c.left -= worldTimeScale;
    if (c.left <= 0) {
      state.balls.push({ id: state.nextId++, cannon: c.id, x: c.x + c.dir * C.muzzleDx, y: c.y, dir: c.dir, traveled: 0 });
      c.left += c.intervalTicks;
    }
  }
  return hit;
}
