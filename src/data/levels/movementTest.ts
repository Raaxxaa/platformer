// The M1 grey-box movement test level (plan M0-M1, Task 5). 120 × 30 tiles = 1920 × 480 px.
import { gridFromRects, type Rect } from '../../core/level/build.ts';
import type { TileGrid } from '../../core/level/tiles.ts';

const RECTS: Rect[] = [
  { x0: 0, y0: 27, x1: 119, y1: 29, kind: 'solid' },     // 1  floor (feet y 432)
  { x0: 0, y0: 0, x1: 0, y1: 29, kind: 'solid' },        // 2  left wall
  { x0: 119, y0: 0, x1: 119, y1: 29, kind: 'solid' },    // 2  right wall
  { x0: 24, y0: 22, x1: 27, y1: 26, kind: 'solid' },     // 3  ledge 80 px up (jump + ledge grab)
  { x0: 31, y0: 21, x1: 34, y1: 26, kind: 'solid' },     // 4  ledge 96 px up (needs the double jump)
  { x0: 40, y0: 18, x1: 47, y1: 25, kind: 'solid' },     // 5  wall with a 16 px tunnel under it (slide)
  { x0: 53, y0: 6, x1: 53, y1: 24, kind: 'solid' },      // 6  shaft left wall (32 px opening at the bottom)
  { x0: 60, y0: 6, x1: 60, y1: 26, kind: 'solid' },      // 7  shaft right wall (wall-jump up the 96 px shaft)
  { x0: 60, y0: 5, x1: 75, y1: 5, kind: 'solid' },       // 8  platform at the top of the shaft
  { x0: 80, y0: 24, x1: 84, y1: 24, kind: 'oneway' },    // 9  one-way platform 48 px up
  { x0: 87, y0: 20, x1: 91, y1: 20, kind: 'oneway' },    // 10 one-way 64 px above #9 (double jump)
  { x0: 80, y0: 16, x1: 84, y1: 16, kind: 'oneway' },    // 11 one-way 64 px above #10
  { x0: 95, y0: 23, x1: 99, y1: 23, kind: 'solid' },     // 12 low overhang, 48 px clearance
  { x0: 104, y0: 27, x1: 111, y1: 28, kind: 'empty' },   // 13 128 px pit with a floor at row 29 (dash-jump)
];

export const MOVEMENT_TEST: { grid: TileGrid; spawn: { x: number; y: number } } = {
  grid: gridFromRects(120, 30, RECTS),
  spawn: { x: 72, y: 432 },
};
