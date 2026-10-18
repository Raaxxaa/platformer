import type { TileGrid } from '../level/tiles.ts';
import { TILE_SIZE } from '../tuning.ts';
import type { MoveEvent, PlayerBody } from './body.ts';
/** Feet sample water; support under the center wins, then the nearest supported pixel (01 §13.2–3). */
export function updateSurfaces(b: PlayerBody, g: TileGrid, events?: MoveEvent[]): void {
  const water = g.kindAt(Math.floor(b.x / TILE_SIZE), Math.floor((b.y - 1) / TILE_SIZE)) === 'water';
  if (water !== b.inWater)
    events?.push(water ? 'enterWater' : 'exitWater');
  b.inWater = water;
  b.onIce = false;
  if (!b.grounded)
    return;
  for (let offset = 0; offset <= b.w / 2; offset++) {
    for (const x of offset === 0 ? [b.x] : [b.x - offset, b.x + offset - 1]) {
      if (g.isSolidPx(x, b.y) || g.isOneWayTopPx(x, b.y)) {
        const body = g.bodies?.list.find((s) => s.active && x >= s.x && x < s.x + s.w && b.y === s.y);
        b.onIce = body ? body.surface === 'ice' : g.kindAt(Math.floor(x / TILE_SIZE), Math.floor(b.y / TILE_SIZE)) === 'ice';
        return;
      }
    }
  }
}
