import { TileGrid, type TileKind } from './tiles.ts';

/** A rectangle of tiles, inclusive tile coords. */
export type Rect = { x0: number; y0: number; x1: number; y1: number; kind: TileKind };

/** Builds a grid that starts all empty and applies `rects` in order (later rects overwrite). */
export function gridFromRects(w: number, h: number, rects: Rect[]): TileGrid {
  const kinds: TileKind[] = new Array<TileKind>(w * h).fill('empty');
  for (const r of rects) {
    for (let ty = Math.max(0, r.y0); ty <= Math.min(h - 1, r.y1); ty++) {
      for (let tx = Math.max(0, r.x0); tx <= Math.min(w - 1, r.x1); tx++) kinds[ty * w + tx] = r.kind;
    }
  }
  return new TileGrid(w, h, kinds);
}
