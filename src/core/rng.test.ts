import { describe, it, expect } from 'vitest';
import { fnv1a32, mulberry32, deriveSeed, Rng } from './rng.ts';

describe('rng', () => {
  it('fnv1a32 matches the reference values', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });
  it('mulberry32: same seed same numbers, different seeds differ, all in [0, 1)', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const xs = [a(), a(), a(), a(), a()];
    expect([b(), b(), b(), b(), b()]).toEqual(xs);
    expect([c(), c(), c(), c(), c()]).not.toEqual(xs);
    for (const x of xs) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
  it('deriveSeed separates streams and keys, and never returns 0', () => {
    const s = fnv1a32('ABCD1234');
    expect(deriveSeed(s, 'enemyAI', 1)).not.toBe(deriveSeed(s, 'enemyAI', 2));
    expect(deriveSeed(s, 'enemyAI', 1)).not.toBe(deriveSeed(s, 'combat', 1));
    expect(deriveSeed(s, 'enemyAI', 1)).toBe(fnv1a32(`${s}:enemyAI:1`) || 1);
  });
  it('drawing from one stream never shifts another (06 test 3)', () => {
    const s = 12345;
    const fresh = new Rng(deriveSeed(s, 'enemyAI', 2)).next();
    const stage1 = new Rng(deriveSeed(s, 'enemyAI', 1));
    for (let i = 0; i < 50; i++) stage1.next();
    expect(new Rng(deriveSeed(s, 'enemyAI', 2)).next()).toBe(fresh);
  });
  it('int(n) is in [0, n)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) { const v = r.int(5); expect(Number.isInteger(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(5); }
  });
  it('pickWeighted draws exactly one number and follows the weights', () => {
    const r = new Rng(99), ref = new Rng(99);
    r.pickWeighted([{ item: 'a', weight: 2 }, { item: 'b', weight: 1 }]);
    ref.next();
    expect(r.next()).toBe(ref.next());
    let a = 0;
    const rr = new Rng(2024);
    for (let i = 0; i < 30000; i++) if (rr.pickWeighted([{ item: 'a', weight: 2 }, { item: 'b', weight: 1 }]) === 'a') a++;
    expect(a / 30000).toBeGreaterThan(2 / 3 - 0.02);
    expect(a / 30000).toBeLessThan(2 / 3 + 0.02);
  });
});
