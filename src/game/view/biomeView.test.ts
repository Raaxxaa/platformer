import { describe, it, expect } from 'vitest';
import { drawTerrain, Parallax } from './levelView.ts';
import { gridFromRects } from '../../core/level/build.ts';

function scene() {
  const rectangles: unknown[][] = [], images: string[] = [];
  const shape = () => ({ setOrigin() { return this; }, setScrollFactor() { return this; }, setDepth() { return this; }, setAlpha() { return this; }, setVisible() { return this; }, destroy() {} });
  const s = {
    textures: { exists: () => false },
    cameras: { main: { setBackgroundColor() {} } },
    add: {
      graphics: () => ({ ...shape(), fillStyle() { return this; }, fillRect(...r: unknown[]) { rectangles.push(r); return this; } }),
      rectangle: (...r: unknown[]) => { rectangles.push(r); return shape(); },
      tileSprite: (_x: number, _y: number, _w: number, _h: number, key: string) => { images.push(key); return { ...shape(), tilePositionX: 0, y: 0 }; },
    },
    make: { tilemap: () => { throw new Error('Missing art must use grey terrain'); } },
  };
  return { s: s as never, rectangles, images };
}

describe('biome art fallback (M7.1 Task6)', () => {
  it('draws supported terrain when ART7 is absent without loading Plains tiles or water in the terrain layer', () => {
    const { s, rectangles } = scene();
    const grid = gridFromRects(8, 8, [{ x0: 0, y0: 6, x1: 7, y1: 7, kind: 'solid' }, { x0: 2, y0: 5, x1: 3, y1: 5, kind: 'water' }]);
    drawTerrain(s, grid, 'swamps');
    expect(rectangles).toEqual([[0, 96, 128, 16], [0, 112, 128, 16]]);
  });
  it('uses a safe grey background for missing road art and crossfades caves over half a second', () => {
    const { s, rectangles, images } = scene();
    const p = new Parallax(s, 1000, 'mountains');
    p.update(0, 0, 0.25);
    expect(p.caveAlpha).toBe(0);
    p.update(0, 500, 0.25);
    expect(p.caveAlpha).toBe(0.5);
    p.update(0, 500, 0.25);
    expect(p.caveAlpha).toBe(1);
    p.update(0, 0, 0.1);
    expect(p.caveAlpha).toBeCloseTo(0.8);
    expect(images).toEqual([]);
    expect(rectangles.length).toBeGreaterThan(0);
  });
});
