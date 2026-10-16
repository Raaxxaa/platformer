import { describe, it, expect } from 'vitest';
import { boxFree, moveX, moveY, isGrounded, pushOut, roundHalfAwayFromZero, type AABBBody } from './collide.ts';
import { gridFromRects } from '../level/build.ts';
import { flatWorld } from '../testkit/worlds.ts';

function body(x: number, y: number, h = 28): AABBBody {
  return { x, y, w: 12, h, remX: 0, remY: 0 };
}
const DOWN = { dropping: false, preferDir: 0 as const };

describe('roundHalfAwayFromZero', () => {
  it('rounds halves away from zero', () => {
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
    expect(roundHalfAwayFromZero(0.49)).toBe(0);
    expect(roundHalfAwayFromZero(-0.49)).toBe(-0);
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
  });
});

describe('boxFree', () => {
  it('checks [x - w/2, x + w/2) × [y - h, y)', () => {
    const g = flatWorld();
    expect(boxFree(g, 100, 432, 12, 28)).toBe(true);
    expect(boxFree(g, 100, 433, 12, 28)).toBe(false);
    // tile at x 160..175: a box whose right edge is 160 (exclusive) is free
    const g2 = gridFromRects(20, 20, [{ x0: 10, y0: 0, x1: 10, y1: 19, kind: 'solid' }]);
    expect(boxFree(g2, 154, 100, 12, 28)).toBe(true);
    expect(boxFree(g2, 155, 100, 12, 28)).toBe(false);
  });
});

describe('moveY landing', () => {
  for (const step of [3.7, 5, 0.2]) {
    it(`lands exactly on the floor at ${step} px/tick (checklist 41)`, () => {
      const g = flatWorld(); const b = body(100, 300);
      let r: string = 'free';
      for (let i = 0; i < 5000 && r !== 'landed'; i++) {
        r = moveY(b, g, step, DOWN);
        expect(b.y).toBeLessThanOrEqual(432);
      }
      expect(r).toBe('landed');
      expect(b.y).toBe(432);
      expect(b.remY).toBe(0);
    });
  }
});

describe('moveX', () => {
  it('600 px/s (5 px/tick) never tunnels through a 1-tile wall', () => {
    const g = gridFromRects(30, 20, [{ x0: 0, y0: 17, x1: 29, y1: 19, kind: 'solid' }, { x0: 15, y0: 0, x1: 15, y1: 16, kind: 'solid' }]);
    const b = body(100, 272);
    let r: string = 'free';
    for (let i = 0; i < 100 && r === 'free'; i++) r = moveX(b, g, 5, false);
    expect(r).toBe('wall');
    expect(b.x + 6).toBe(240);    // touching the wall face at x 240
    expect(b.remX).toBe(0);
  });
  it('moves by whole pixels and keeps the remainder in [-0.5, 0.5]', () => {
    const g = flatWorld(); const b = body(100, 432);
    moveX(b, g, 1.3, false); expect(b.x).toBe(101); expect(b.remX).toBeCloseTo(0.3, 10);
    moveX(b, g, -1.9, false); expect(b.x).toBe(99); expect(b.remX).toBeCloseTo(0.4, 10);
  });
  it('steps up onto a 4 px high block', () => {
    // block tile at x 160..175, top y 160; body feet 4 px below the top
    const g = gridFromRects(30, 30, [{ x0: 10, y0: 10, x1: 12, y1: 12, kind: 'solid' }]);
    const b = body(154, 164);
    expect(moveX(b, g, 1, true)).toBe('free');
    expect([b.x, b.y]).toEqual([155, 160]);
  });
  it('does not step up a 5 px block', () => {
    const g = gridFromRects(30, 30, [{ x0: 10, y0: 10, x1: 12, y1: 12, kind: 'solid' }]);
    const b = body(154, 165);
    expect(moveX(b, g, 1, true)).toBe('wall');
    expect([b.x, b.y]).toEqual([154, 165]);
  });
  it('skips step-up when allowStepUp is false', () => {
    const g = gridFromRects(30, 30, [{ x0: 10, y0: 10, x1: 12, y1: 12, kind: 'solid' }]);
    const b = body(154, 164);
    expect(moveX(b, g, 1, false)).toBe('wall');
    expect([b.x, b.y]).toEqual([154, 164]);
  });
  it('steps up to the left too', () => {
    const g = gridFromRects(30, 30, [{ x0: 10, y0: 10, x1: 12, y1: 12, kind: 'solid' }]);
    const b = body(214, 162);   // left edge 208 touches the block's right face (208)
    expect(moveX(b, g, -1, true)).toBe('free');
    expect([b.x, b.y]).toEqual([213, 160]);
  });
});

describe('moveY ceiling nudge (checklist 20)', () => {
  // ceiling tile x 80..95, y 160..175
  const g = gridFromRects(20, 30, [{ x0: 5, y0: 10, x1: 5, y1: 10, kind: 'solid' }]);
  it('nudges sideways when the head overlaps the corner by 4 px', () => {
    const b = body(78, 204);    // box x 72..83 overlaps the tile (80..95) by 4 px
    expect(moveY(b, g, -3, DOWN)).toBe('free');
    expect(b.x).toBe(74);
    expect(b.y).toBe(201);
  });
  it('still nudges the other way when the moveX side is blocked', () => {
    const b = body(78, 204);
    expect(moveY(b, g, -1, { dropping: false, preferDir: 1 })).toBe('free');
    expect(b.x).toBe(74);
  });
  it('bonks when the overlap is 5 px', () => {
    const b = body(79, 204);
    b.remY = -0.2;
    expect(moveY(b, g, -3, DOWN)).toBe('bonk');
    expect(b.x).toBe(79);
    expect(b.y).toBe(204);
    expect(b.remY).toBe(0);
  });
  it('a nudge to the right works when the ceiling corner is on the left', () => {
    const b = body(102, 204);   // box 96..107 vs tile 80..95: no overlap
    const b2 = body(97, 204);   // box 91..102 overlaps by 5 on the left
    const b3 = body(98, 204);   // box 92..103 overlaps by 4 on the left -> shift right by 4
    expect(moveY(b, g, -1, DOWN)).toBe('free');
    expect(moveY(b2, g, -1, DOWN)).toBe('bonk');
    expect(moveY(b3, g, -1, DOWN)).toBe('free');
    expect(b3.x).toBe(102);
  });
});

describe('one-way platforms', () => {
  // one-way tile row 10 (top y 160), x tiles 3..8 (48..143)
  const g = gridFromRects(20, 30, [{ x0: 0, y0: 27, x1: 19, y1: 29, kind: 'solid' }, { x0: 3, y0: 10, x1: 8, y1: 10, kind: 'oneway' }]);
  it('rising through a one-way tile is never blocked', () => {
    const b = body(80, 200);
    for (let i = 0; i < 20; i++) expect(moveY(b, g, -4, DOWN)).toBe('free');
    expect(b.y).toBe(120);
  });
  it('falling onto it lands with feet on its top', () => {
    const b = body(80, 150);
    let r: string = 'free';
    for (let i = 0; i < 20 && r !== 'landed'; i++) r = moveY(b, g, 3.3, DOWN);
    expect(r).toBe('landed');
    expect(b.y).toBe(160);
  });
  it('a body overlapping the platform from below falls through it', () => {
    const b = body(80, 165);
    expect(moveY(b, g, 4, DOWN)).toBe('free');
    expect(b.y).toBe(169);
  });
  it('with dropping: true it does not land on the platform it stands on', () => {
    const b = body(80, 160);
    expect(moveY(b, g, 3, { dropping: true, preferDir: 0 })).toBe('free');
    expect(b.y).toBe(163);
    const b2 = body(80, 160);
    expect(moveY(b2, g, 3, DOWN)).toBe('landed');
    expect(b2.y).toBe(160);
  });
  it('never blocks sideways movement', () => {
    const b = body(30, 170);     // overlapping the platform's row from below-left
    expect(moveX(b, g, 5, false)).toBe('free');
    expect(b.x).toBe(35);
  });
});

describe('isGrounded', () => {
  const g = gridFromRects(20, 30, [{ x0: 0, y0: 27, x1: 19, y1: 29, kind: 'solid' }, { x0: 3, y0: 10, x1: 8, y1: 10, kind: 'oneway' }]);
  it('true standing on the floor with vy 0', () => { expect(isGrounded(body(100, 432), g, 0)).toBe(true); });
  it('false while rising', () => { expect(isGrounded(body(100, 432), g, -10)).toBe(false); });
  it('false one pixel above the floor', () => { expect(isGrounded(body(100, 431), g, 0)).toBe(false); });
  it('true on a one-way top', () => { expect(isGrounded(body(80, 160), g, 0)).toBe(true); });
  it('true while any pixel of the box width is supported', () => {
    // ledge: floor only up to x 47 (tiles 0..2)
    const g2 = gridFromRects(20, 30, [{ x0: 0, y0: 27, x1: 2, y1: 29, kind: 'solid' }]);
    expect(isGrounded(body(53, 432), g2, 0)).toBe(true);    // box 47..58: pixel 47 supported
    expect(isGrounded(body(54, 432), g2, 0)).toBe(false);   // box 48..59
  });
});

describe('pushOut (01 §2.8)', () => {
  it('a body 3 px inside a wall from the left ends free', () => {
    const g = gridFromRects(30, 30, [{ x0: 0, y0: 27, x1: 29, y1: 29, kind: 'solid' }, { x0: 10, y0: 0, x1: 12, y1: 26, kind: 'solid' }]);
    const b = body(157, 432);    // box 151..162 overlaps the wall (160..) by 3
    expect(pushOut(b, g)).toBe(true);
    expect(boxFree(g, b.x, b.y, 12, 28)).toBe(true);
    expect([b.x, b.y]).toEqual([154, 432]);
  });
  it('tries up before left, right and down at the same distance', () => {
    // a block poking 2 px into the body's lower-left corner
    const g = gridFromRects(30, 30, [{ x0: 5, y0: 10, x1: 5, y1: 10, kind: 'solid' }]);   // 80..95 x 160..175
    const b = body(100, 162);    // box 94..105 x 134..161: overlaps the block by 2 px in x and 2 px in y
    expect(pushOut(b, g)).toBe(true);
    expect([b.x, b.y]).toEqual([100, 160]);
  });
  it('does nothing when the body is already free', () => {
    const g = flatWorld(); const b = body(100, 432);
    expect(pushOut(b, g)).toBe(true);
    expect([b.x, b.y]).toEqual([100, 432]);
  });
  it('gives up (returns false) if nothing is free within 32 px', () => {
    const g = gridFromRects(30, 30, [{ x0: 0, y0: 0, x1: 29, y1: 29, kind: 'solid' }]);
    const b = body(200, 200);
    expect(pushOut(b, g)).toBe(false);
    expect([b.x, b.y]).toEqual([200, 200]);
  });
});
