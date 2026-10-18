import { describe, it, expect } from 'vitest';
import { createRunState, stepClocks } from './runState.ts';

describe('run clocks (06 §5.1)', () => {
  it('advance in stage and stop in dead', () => {
    const r = createRunState('ABC');
    stepClocks(r); stepClocks(r);
    expect([r.runTicks, r.stageTicks]).toEqual([2, 2]);
    r.phase = 'dead';
    stepClocks(r);
    expect([r.runTicks, r.stageTicks]).toEqual([2, 2]);
    r.phase = 'paused';
    stepClocks(r);
    expect(r.runTicks).toBe(2);
  });
  it('the run seed is fnv1a32 of the seed text', () => {
    expect(createRunState('ABC123').runSeed).toBe(createRunState('ABC123').runSeed);
    expect(createRunState('ABC123').runSeed).not.toBe(createRunState('ABC124').runSeed);
  });
});
