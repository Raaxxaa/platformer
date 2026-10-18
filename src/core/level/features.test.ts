import { describe, it, expect } from 'vitest';
import { buildLevelFeatures } from './features.ts';
import type { LevelObject } from './loadLevel.ts';
const object = (type: string, id: number, x: number, y: number, props: LevelObject['props'] = {}): LevelObject => ({ id, type, x, y, w: 64, h: 32, props });
describe('Stage2 point and visual-only level data', () => {
  it('retains grapple centers and dark/firefly bounds with exact defaults and overrides', () => {
    const f = buildLevelFeatures([object('grapple_point', 1, 100, 80), object('dark_zone', 2, 200, 100), object('dark_zone', 3, 300, 100, { lightRadius: 90 }), object('firefly', 4, 220, 110), object('firefly', 5, 330, 115, { radius: 32 })]);
    expect(f.grapplePoints).toEqual([{ id: 1, x: 100, y: 80, w: 16, h: 16 }]);
    expect(f.darkZones).toEqual([{ id: 2, x: 200, y: 100, w: 64, h: 32, lightRadius: 112 }, { id: 3, x: 300, y: 100, w: 64, h: 32, lightRadius: 90 }]);
    expect(f.fireflies).toEqual([{ id: 4, x: 220, y: 110, radius: 48 }, { id: 5, x: 330, y: 115, radius: 32 }]);
  });
});
