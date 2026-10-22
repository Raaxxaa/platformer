import { describe, expect, it } from 'vitest';
import { deriveSeed, fnv1a32, Rng } from '../rng.ts';
import { createRunState } from './runState.ts';
import { LAYOUT, layoutCode, parseLayoutCode, rollLayout } from './layout.ts';

describe('layout picks (06 §8.7)', () => {
  it('the same seed gives the same picks; 25 draws in stage then section order', () => {
    const seed = fnv1a32('ABC');
    expect(rollLayout(seed)).toEqual(rollLayout(seed));
    const rng = new Rng(deriveSeed(seed, 'layout', 'run'));
    const draws = Array.from({ length: 25 }, () => 1 + Math.floor(rng.next() * 3));
    const l = rollLayout(seed);
    const flat = LAYOUT.stages.flatMap((s) => LAYOUT.vary.map((n) => l[s][n - 1]));
    expect(flat).toEqual(draws);
    expect(l.plains.length).toBe(8);
    expect([l.plains[0], l.plains[4], l.plains[7]]).toEqual([1, 1, 1]);
  });
  it('the layout code is the five varying picks', () => {
    expect(layoutCode([1, 2, 1, 3, 1, 3, 2, 1])).toBe('2-1-3-3-2');
    expect(parseLayoutCode('2-1-3-3-2')).toEqual([1, 2, 1, 3, 1, 3, 2, 1]);
    expect(parseLayoutCode('21332')).toEqual([1, 2, 1, 3, 1, 3, 2, 1]);
    expect(parseLayoutCode('classic')).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    expect(parseLayoutCode('9-9')).toBeNull();
  });
  it('the dragon draws are unchanged by adding layout; the run carries the layout', () => {
    const r = createRunState('XYZ');
    expect(r.layout.plains).toEqual(rollLayout(fnv1a32('XYZ')).plains);
  });
  it('each version is picked about a third of the time over 30 000 seeds', () => {
    const n = [0, 0, 0];
    for (let s = 0; s < 30000; s++) n[rollLayout(s * 2654435761 >>> 0).swamps[5] - 1] += 1;
    for (const k of n) expect(Math.abs(k / 30000 - 1 / 3)).toBeLessThan(0.01);
  });
});
