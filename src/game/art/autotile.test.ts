import { describe, it, expect } from 'vitest';
import { BLOB_MASKS, blobIndex, hash2, onewayPiece, reduceMask, terrainTile, ONEWAY_COL } from './autotile.ts';
import { gridFromRects } from '../../core/level/build.ts';

describe('blob autotiling (08 §9.2)', () => {
  it('the 256 masks reduce to exactly 47 values, sorted into blob indexes', () => {
    expect(BLOB_MASKS.length).toBe(47);
    expect(blobIndex(0)).toBe(0);
    expect(blobIndex(85)).toBe(21);
    expect(blobIndex(124)).toBe(31);
    expect(blobIndex(255)).toBe(46);
  });
  it('a diagonal bit only counts when both neighbouring cardinals are set', () => {
    expect(reduceMask(2)).toBe(0);             // NE alone
    expect(reduceMask(1 | 2)).toBe(1);         // N + NE without E
    expect(reduceMask(1 | 2 | 4)).toBe(7);
  });
  it('picks the right tile for a floor: top edge cells, and full-center variants by hash', () => {
    const g = gridFromRects(6, 4, [{ x0: 0, y0: 2, x1: 5, y1: 3, kind: 'solid' }]);
    // A top-row cell in the middle has W, E, S, SW, SE and the out-of-bounds bottom row is filled.
    const top = terrainTile(g, 2, 2)!;
    expect(top.index).toBe(blobIndex(4 | 8 | 16 | 32 | 64));
    // A buried cell (bottom row, everything around filled incl. out of bounds) is mask 255 → tile 46 or a variant.
    const full = terrainTile(g, 2, 3)!;
    const v = hash2(2, 3, 1) % 5;
    expect(full.index).toBe(v === 0 ? 46 : 3 * 16 + (v - 1));
    expect(terrainTile(g, 2, 0)).toBeNull();
  });
  it('one-way pieces: left end, middle, right end, single', () => {
    const g = gridFromRects(8, 3, [{ x0: 1, y0: 1, x1: 3, y1: 1, kind: 'oneway' }, { x0: 6, y0: 1, x1: 6, y1: 1, kind: 'oneway' }]);
    expect([1, 2, 3, 6].map((x) => onewayPiece(g, x, 1))).toEqual([ONEWAY_COL.left, ONEWAY_COL.middle, ONEWAY_COL.right, ONEWAY_COL.single]);
    expect(terrainTile(g, 2, 1)!.index).toBe(3 * 16 + ONEWAY_COL.middle);
  });
  it('ice cells use the ice blob (rows 4–6)', () => {
    const g = gridFromRects(4, 3, [{ x0: 1, y0: 1, x1: 1, y1: 1, kind: 'ice' }]);
    expect(terrainTile(g, 1, 1)!.index).toBe(4 * 16 + blobIndex(0));
  });
  it('hash2 is the spec function', () => {
    expect(hash2(0, 0, 0)).toBe(0);
    expect(hash2(3, 7, 1)).toBe(hash2(3, 7, 1));
    expect(hash2(3, 7, 1)).not.toBe(hash2(7, 3, 1));
  });
});
