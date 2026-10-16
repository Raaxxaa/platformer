import { describe, it, expect } from 'vitest';
import { boxToWorld, overlaps, sweep, canHit, markHit, type HitGroup } from './hitGroups.ts';
import type { HitSpec } from './types.ts';

const spec = (extra: Partial<HitSpec> = {}): HitSpec => ({ damage: 10, kb: [0, 0], poise: 0, hitStop: 0, kind: 'melee', ...extra });
const group = (s: HitSpec): HitGroup => ({
  id: 1, owner: 'player', kind: s.kind, rect: { x: 0, y: 0, w: 10, h: 10 }, spec: s, active: true,
  lastHitTick: new Map(), hitCount: new Map(), attackInstance: 1,
});

describe('hit groups (02 §2)', () => {
  it('boxToWorld centers the box on the feet offset and mirrors dx', () => {
    expect(boxToWorld({ dx: 22, dy: -16, w: 40, h: 28 }, 100, 200, 1)).toEqual({ x: 102, y: 170, w: 40, h: 28 });
    expect(boxToWorld({ dx: 22, dy: -16, w: 40, h: 28 }, 100, 200, -1)).toEqual({ x: 58, y: 170, w: 40, h: 28 });
  });
  it('touching edges do not overlap; a 1 px overlap does', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(overlaps(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
    expect(overlaps(a, { x: 0, y: 10, w: 5, h: 5 })).toBe(false);
    expect(overlaps(a, { x: 9, y: 9, w: 5, h: 5 })).toBe(true);
  });
  it('sweep is the union of two boxes', () => {
    expect(sweep({ x: 0, y: 0, w: 4, h: 4 }, { x: 10, y: -2, w: 4, h: 4 })).toEqual({ x: 0, y: -2, w: 14, h: 6 });
  });
  it('a group hits a target once', () => {
    const g = group(spec());
    expect(canHit(g, 5, 100)).toBe(true);
    markHit(g, 5, 100);
    expect(canHit(g, 5, 101)).toBe(false);
    expect(canHit(g, 5, 10000)).toBe(false);
    expect(canHit(g, 6, 101)).toBe(true);
  });
  it('rehit 0.25 allows another hit after 30 ticks; maxHits caps it', () => {
    const g = group(spec({ rehit: 0.25, maxHits: 2, multiHit: true }));
    markHit(g, 5, 100);
    expect(canHit(g, 5, 129)).toBe(false);
    expect(canHit(g, 5, 130)).toBe(true);
    markHit(g, 5, 130);
    expect(canHit(g, 5, 200)).toBe(false);
  });
});
