import { describe, it, expect } from 'vitest';
import { routeLint } from './routeLint.ts';
import { levelFrom, rect } from '../testkit/levelData.ts';
import type { LevelObject } from './loadLevel.ts';

/** 40 × 20 tiles; floor row 15; section 2 is x 0–19, section 3 is x 20–39. `extra` adds tile rects. */
function lvl(path: [number, number][], blocks: [number, number, number, number, string][] = []) {
  const rows = Array.from({ length: 20 }, (_, y) => (y >= 15 ? '#'.repeat(40) : '.'.repeat(40)).split(''));
  for (const [x0, y0, x1, y1, c] of blocks) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) rows[y][x] = c;
  const pts = path.map(([tx, ty]) => ({ x: tx * 16 + 8, y: ty * 16 + 8 }));
  const mainPath: Omit<LevelObject, 'id'> = { type: 'main_path', x: pts[0].x, y: pts[0].y, w: 0, h: 0, points: pts, props: {} };
  return levelFrom(rows.map((r) => r.join('')), [rect('section', 0, 0, 20, 20, { index: 2 }), rect('section', 20, 0, 20, 20, { index: 3 }), mainPath]);
}

describe('routeLint (06 §8.5)', () => {
  it('a 6-tile rise in section 2 is flagged; a 5-tile rise is fine', () => {
    expect(routeLint(lvl([[2, 14], [8, 8]], [[8, 9, 12, 14, '#']]))).toEqual(['section 2, vertex 1: rise of 6 tiles (max 5)']);
    expect(routeLint(lvl([[2, 14], [8, 9]], [[8, 10, 12, 14, '#']]))).toEqual([]);
  });
  it('a 6-tile rise in section 3 is fine (double jump), 8 is not', () => {
    expect(routeLint(lvl([[22, 14], [28, 8]], [[28, 9, 32, 14, '#']]))).toEqual([]);
    expect(routeLint(lvl([[22, 14], [28, 6]], [[28, 7, 32, 14, '#']]))).toEqual(['section 3, vertex 1: rise of 8 tiles (max 7)']);
  });
  it('a rise onto a one-way platform is limited to 3 tiles (6 from section 3)', () => {
    expect(routeLint(lvl([[2, 14], [6, 10]], [[5, 11, 8, 11, '=']]))).toEqual(['section 2, vertex 1: rise of 4 tiles onto a one-way platform (max 3)']);
    expect(routeLint(lvl([[2, 14], [6, 11]], [[5, 12, 8, 12, '=']]))).toEqual([]);
    expect(routeLint(lvl([[22, 14], [26, 8]], [[25, 9, 28, 9, '=']]))).toEqual([]);
  });
  it('a gap of 5 tiles in section 2 is flagged, 4 is fine; 5 is fine in section 3', () => {
    expect(routeLint(lvl([[2, 14], [10, 14]], [[4, 15, 8, 16, '.']]))).toEqual(['section 2, vertex 1: gap of 5 tiles (max 4)']);
    expect(routeLint(lvl([[2, 14], [10, 14]], [[4, 15, 7, 16, '.']]))).toEqual([]);
    expect(routeLint(lvl([[22, 14], [30, 14]], [[24, 15, 28, 16, '.']]))).toEqual([]);
  });
  it('a vertex inside a solid tile is flagged', () => {
    expect(routeLint(lvl([[2, 14], [6, 15]]))).toContain('section 2, vertex 1: inside a solid tile');
  });
  it('a climb up a wall-jump shaft (walls 3–5 tiles apart) has no rise limit', () => {
    // Walls at x 24 and x 29 (4 tiles inside), rows 2–14; climb from the floor to row 2 on top of the right wall.
    expect(routeLint(lvl([[26, 14], [26, 4]], [[24, 2, 24, 12, '#'], [29, 2, 29, 14, '#'], [25, 5, 25, 5, '#']]))).toEqual([]);
  });
});
