// Small worlds for unit tests.
import { gridFromRects } from '../level/build.ts';
import type { TileGrid } from '../level/tiles.ts';
import { TILE_SIZE } from '../tuning.ts';

/** Feet y when standing on flatWorld()'s floor. */
export function FLOOR_Y(hTiles = 30): number {
  return (hTiles - 3) * TILE_SIZE;
}

/** Empty world with a 3-tile solid floor at the bottom. */
export function flatWorld(wTiles = 60, hTiles = 30): TileGrid {
  return gridFromRects(wTiles, hTiles, [{ x0: 0, y0: hTiles - 3, x1: wTiles - 1, y1: hTiles - 1, kind: 'solid' }]);
}
