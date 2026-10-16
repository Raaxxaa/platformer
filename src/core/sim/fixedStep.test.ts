import { describe, it, expect } from 'vitest';
import { FixedStepper } from './fixedStep.ts';

describe('FixedStepper', () => {
  it('runs 2 ticks for a 60 Hz frame', () => { expect(new FixedStepper().advance(1 / 60)).toBe(2); });
  it('runs exactly 120 ticks over 60 frames at 60 Hz', () => {
    const s = new FixedStepper(); let n = 0;
    for (let i = 0; i < 60; i++) n += s.advance(1 / 60);
    expect(n).toBe(120);
  });
  it('averages 120 ticks per second at 144 Hz', () => {
    const s = new FixedStepper(); let n = 0;
    for (let i = 0; i < 144; i++) n += s.advance(1 / 144);
    expect(n).toBeGreaterThanOrEqual(119); expect(n).toBeLessThanOrEqual(120);
  });
  it('carries the remainder', () => {
    const s = new FixedStepper();
    expect(s.advance(0.005)).toBe(0);   // 0.6 ticks
    expect(s.advance(0.005)).toBe(1);   // 1.2 ticks total
  });
  it('caps a long hitch at 0.25 s (30 ticks)', () => { expect(new FixedStepper().advance(3)).toBe(30); });
  it('ignores negative or NaN dt', () => {
    const s = new FixedStepper();
    expect(s.advance(-1)).toBe(0); expect(s.advance(Number.NaN)).toBe(0);
    expect(s.advance(1 / 120)).toBe(1);
  });
});
