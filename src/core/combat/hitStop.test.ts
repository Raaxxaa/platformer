import { describe, it, expect } from 'vitest';
import { meleeHitStopTicks, maxStop } from './hitStop.ts';

describe('hit-stop (02 §4.1, checklist 10)', () => {
  it('converts seconds to ticks with crit and kill bonuses, capped at 0.125 s', () => {
    expect(meleeHitStopTicks(0.10, false, false)).toBe(12);
    expect(meleeHitStopTicks(0.10, true, false)).toBe(15);
    expect(meleeHitStopTicks(0.10, true, true)).toBe(15);
    expect(meleeHitStopTicks(0.025, false, false)).toBe(3);
    expect(meleeHitStopTicks(0.05, false, true)).toBe(9);
  });
  it('never adds: the larger remaining value wins', () => {
    expect(maxStop(5, 3)).toBe(5);
    expect(maxStop(2, 9)).toBe(9);
  });
});
