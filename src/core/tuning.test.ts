import { describe, it, expect } from 'vitest';
import { TICK_RATE, TICK, ticks } from './tuning.ts';

describe('tuning', () => {
  it('runs at 120 ticks per second', () => {
    expect(TICK_RATE).toBe(120);
    expect(TICK).toBeCloseTo(1 / 120, 12);
  });
  it('converts seconds to ticks with Math.round', () => {
    expect(ticks(0.15)).toBe(18);
    expect(ticks(0.35)).toBe(42);
    expect(ticks(0.10)).toBe(12);
    expect(ticks(0.05)).toBe(6);
  });
});
