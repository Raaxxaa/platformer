// Falling-rock level hazards (06 §10): fixed-step state only, no enemy targets or damage scaling.
import { FALLING_ROCKS as R } from '../../data/hazards.ts';
import { overlaps, type Rect } from '../combat/hitGroups.ts';
import type { LevelObject } from '../level/loadLevel.ts';
import type { TileGrid } from '../level/tiles.ts';
import { TICK, TILE_SIZE, ticks } from '../tuning.ts';

export interface FallingRocksZone extends Rect {
  id: number;
  intervalTicks: number;
  inside: boolean;
  remaining: number;
}
export interface FallingRockMarker {
  id: number;
  zoneId: number;
  /** Horizontal center, floor top, and zone top, in world pixels. */
  x: number;
  floorY: number;
  topY: number;
  ticks: number;
}
export interface FallingRock {
  id: number;
  zoneId: number;
  /** Horizontal center and top edge, in world pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface FallingRocksState {
  zones: FallingRocksZone[];
  markers: FallingRockMarker[];
  rocks: FallingRock[];
  nextId: number;
}

export function createFallingRocks(objects: readonly LevelObject[]): FallingRocksState {
  return {
    zones: objects.filter((o) => o.type === 'falling_rocks').map((o) => {
      const interval = Number(o.props.interval);
      return { id: o.id, x: o.x, y: o.y, w: o.w, h: o.h,
        intervalTicks: Number.isFinite(interval) && interval > 0 ? Math.max(1, ticks(interval)) : R.intervalTicks,
        inside: false, remaining: R.firstMarkTicks };
    }),
    markers: [], rocks: [], nextId: 1,
  };
}

function floorBelow(grid: TileGrid, x: number, feetY: number): number {
  const tx = Math.floor(x / TILE_SIZE);
  for (let ty = Math.max(0, Math.floor(feetY / TILE_SIZE)); ty < grid.h; ty++) {
    if (grid.isSolidTile(tx, ty)) return ty * TILE_SIZE;
  }
  return grid.heightPx;
}

/** First solid hit by the falling box; one-way tiles/bodies are intentionally ignored. */
function stopTop(grid: TileGrid, rock: FallingRock, targetY: number): number | null {
  const x0 = Math.floor((rock.x - rock.w / 2) / TILE_SIZE);
  const x1 = Math.ceil((rock.x + rock.w / 2) / TILE_SIZE) - 1;
  const y0 = Math.floor(rock.y / TILE_SIZE);
  const y1 = Math.ceil((targetY + rock.h) / TILE_SIZE) - 1;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (grid.isSolidTile(tx, ty)) return Math.max(rock.y, ty * TILE_SIZE - rock.h);
    }
  }
  return null;
}

/**
 * Advance one 120 Hz world tick. True means at least one rock touched the player.
 * The owner applies R.damage through the hazard hurt pipeline, including hurt i-frames.
 */
export function stepFallingRocks(state: FallingRocksState, grid: TileGrid, playerBox: Rect, worldTimeScale: number): boolean {
  if (!Number.isFinite(worldTimeScale) || worldTimeScale <= 0) return false;
  let hit = false;
  const moving: FallingRock[] = [];
  for (const rock of state.rocks) {
    const targetY = rock.y + R.speed * TICK * worldTimeScale;
    const solidY = stopTop(grid, rock, targetY);
    const endY = solidY ?? targetY;
    // Sweep only as far as the first solid, so a rock cannot hit through a floor.
    if (overlaps({ x: rock.x - rock.w / 2, y: rock.y, w: rock.w, h: endY - rock.y + rock.h }, playerBox)) hit = true;
    if (solidY === null) { rock.y = targetY; moving.push(rock); }
  }
  state.rocks = moving;

  const waiting: FallingRockMarker[] = [];
  for (const marker of state.markers) {
    marker.ticks -= worldTimeScale;
    if (marker.ticks > 0) waiting.push(marker);
    else state.rocks.push({ id: marker.id, zoneId: marker.zoneId, x: marker.x, y: marker.topY, w: R.size, h: R.size });
  }
  state.markers = waiting;

  const centerX = playerBox.x + playerBox.w / 2, centerY = playerBox.y + playerBox.h / 2;
  for (const zone of state.zones) {
    const inside = centerX >= zone.x && centerX < zone.x + zone.w && centerY >= zone.y && centerY < zone.y + zone.h;
    if (!inside) { zone.inside = false; zone.remaining = R.firstMarkTicks; continue; }
    if (!zone.inside) { zone.inside = true; zone.remaining = R.firstMarkTicks; }
    zone.remaining -= worldTimeScale;
    while (zone.remaining <= 0) {
      const x = zone.w >= R.inset * 2 ? Math.max(zone.x + R.inset, Math.min(zone.x + zone.w - R.inset, centerX)) : zone.x + zone.w / 2;
      state.markers.push({ id: state.nextId++, zoneId: zone.id, x, floorY: floorBelow(grid, x, playerBox.y + playerBox.h), topY: zone.y, ticks: R.warningTicks });
      zone.remaining += zone.intervalTicks;
    }
  }
  return hit;
}
