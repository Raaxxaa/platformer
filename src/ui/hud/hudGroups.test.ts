import { describe, expect, it } from 'vitest';
import { shiftGroup } from './hudGroups.ts';

describe('HUD group shifting (07 §4.1a)', () => {
  it('shifts each part by the group offset once, follows parts its owner moves, and can move back', () => {
    const a = { x: 10, y: 300 }, b = { x: 40, y: 310 };
    shiftGroup([a, b], 500, -276); expect(a).toEqual({ x: 510, y: 24 }); expect(b).toEqual({ x: 540, y: 34 });
    shiftGroup([a, b], 500, -276); expect(a).toEqual({ x: 510, y: 24 });          // no pile-up
    b.x = 50; b.y = 310;                                                          // the owner redrew it at its §4.1 place
    shiftGroup([a, b], 500, -276); expect(b).toEqual({ x: 550, y: 34 });
    shiftGroup([a, b], 0, 0); expect(a).toEqual({ x: 10, y: 300 });
  });
});
