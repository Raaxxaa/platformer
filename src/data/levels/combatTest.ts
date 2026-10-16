// The M2 grey-box combat test level (plan M2, Task 17). 100 × 23 tiles = 1600 × 368 px, floor feet y 320.
import { gridFromRects, type Rect } from '../../core/level/build.ts';
import type { TileGrid } from '../../core/level/tiles.ts';
import type { EnemySpawn } from '../../core/enemies/types.ts';

const RECTS: Rect[] = [
  { x0: 0, y0: 20, x1: 99, y1: 22, kind: 'solid' },     // 1 floor
  { x0: 0, y0: 0, x1: 0, y1: 22, kind: 'solid' },       // 2 left wall
  { x0: 99, y0: 0, x1: 99, y1: 22, kind: 'solid' },     // 2 right wall
  { x0: 30, y0: 16, x1: 36, y1: 16, kind: 'oneway' },   // 3 archer platform 64 px up
  { x0: 48, y0: 17, x1: 52, y1: 19, kind: 'solid' },    // 4 low block (ledge for enemies, cover from arrows)
  { x0: 70, y0: 12, x1: 71, y1: 19, kind: 'solid' },    // 5 wall the boar can charge into
];

const SPAWNS: EnemySpawn[] = [
  { enemy: 'training_dummy', x: 120, y: 320, facing: -1 },
  { enemy: 'wolf', x: 400, y: 320, facing: -1, group: 'pack' },
  { enemy: 'wolf', x: 430, y: 320, facing: -1, group: 'pack' },
  { enemy: 'wolf', x: 460, y: 320, facing: -1, group: 'pack' },
  { enemy: 'bandit', x: 600, y: 320, facing: -1, patrol: 32 },
  { enemy: 'bandit', x: 680, y: 320, facing: -1, patrol: 32 },
  { enemy: 'bandit_archer', x: 528, y: 256, facing: -1 },
  // SPEC-GAP: the plan wants 200+ px of flat run in front of the boar; with these rects it has 152 px to block #4
  // (left) and 120 px to wall #5 (right). Kept the listed positions: either way a charge ends in a wall.
  { enemy: 'wild_boar', x: 1000, y: 320, facing: -1 },
  { enemy: 'bandit_brute', x: 1400, y: 320, facing: -1 },
];

export const COMBAT_TEST: { grid: TileGrid; spawn: { x: number; y: number }; enemies: EnemySpawn[] } = {
  grid: gridFromRects(100, 23, RECTS),
  spawn: { x: 64, y: 320 },
  enemies: SPAWNS,
};
