import { describe, it, expect } from 'vitest';
import { gridFromRects } from './build.ts';
import { flatWorld, FLOOR_Y } from '../testkit/worlds.ts';

describe('TileGrid', () => {
  it('outside the map is solid', () => {
    const g = flatWorld();
    expect(g.kindAt(-1, 0)).toBe('solid');
    expect(g.kindAt(0, 999)).toBe('solid');
    expect(g.kindAt(60, 5)).toBe('solid');
    expect(g.kindAt(0, -1)).toBe('solid');
    expect(g.isSolidPx(-1, 100)).toBe(true);
  });
  it('maps pixels to tiles', () => {
    const g = flatWorld();
    expect(g.isSolidPx(16, 432)).toBe(true);
    expect(g.isSolidPx(16, 431)).toBe(false);
    expect(FLOOR_Y()).toBe(432);
    expect([g.w, g.h, g.widthPx, g.heightPx]).toEqual([60, 30, 960, 480]);
  });
  it('ice is solid, one-way is not', () => {
    const g = gridFromRects(4, 4, [{ x0: 0, y0: 0, x1: 0, y1: 0, kind: 'ice' }, { x0: 1, y0: 0, x1: 1, y1: 0, kind: 'oneway' }]);
    expect(g.isSolidPx(5, 5)).toBe(true);
    expect(g.isSolidPx(20, 0)).toBe(false);
  });
  it('isOneWayTopPx is true only on the top pixel row of a one-way tile', () => {
    const g = gridFromRects(4, 4, [{ x0: 1, y0: 2, x1: 2, y1: 2, kind: 'oneway' }]);
    expect(g.isOneWayTopPx(20, 32)).toBe(true);
    expect(g.isOneWayTopPx(47, 32)).toBe(true);
    expect(g.isOneWayTopPx(20, 33)).toBe(false);
    expect(g.isOneWayTopPx(20, 31)).toBe(false);
    expect(g.isOneWayTopPx(5, 32)).toBe(false);
  });
  it('later rects overwrite earlier ones', () => {
    const g = gridFromRects(10, 10, [
      { x0: 0, y0: 0, x1: 9, y1: 9, kind: 'solid' },
      { x0: 2, y0: 2, x1: 3, y1: 3, kind: 'empty' },
    ]);
    expect(g.kindAt(2, 2)).toBe('empty');
    expect(g.kindAt(3, 3)).toBe('empty');
    expect(g.kindAt(4, 4)).toBe('solid');
  });
});
