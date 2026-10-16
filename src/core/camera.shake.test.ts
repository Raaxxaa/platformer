import { describe, it, expect } from 'vitest';
import { createCamera, shake, shakeAmplitude, stepCamera } from './camera.ts';
import { createPlayerBody } from './player/body.ts';
import { Rng } from './rng.ts';

const setup = () => {
  const b = createPlayerBody(1000, 1000);
  const c = createCamera({ x: 0, y: 0, w: 4000, h: 4000 }, b);
  const r = new Rng(5);
  return { b, c, rand: () => r.next() };
};

describe('screen shake (01 §14.4, checklist 38)', () => {
  it('a small shake starts at 2 px and lasts 14 ticks; a medium one at 4 px for 30 ticks', () => {
    for (const [amp, dur, n] of [[2, 0.12, 14], [4, 0.25, 30]] as const) {
      const { b, c, rand } = setup();
      shake(c, amp, dur);
      expect(shakeAmplitude(c)).toBe(amp);
      for (let i = 0; i < n - 1; i++) stepCamera(c, b, rand);
      expect(shakeAmplitude(c)).toBeGreaterThan(0);
      stepCamera(c, b, rand);
      expect(shakeAmplitude(c)).toBe(0);
    }
  });
  it('the largest of A × remaining / duration wins, capped at 8 px; offsets stay within it', () => {
    const { b, c, rand } = setup();
    shake(c, 6, 1); shake(c, 20, 1);
    expect(shakeAmplitude(c)).toBe(8);
    for (let i = 0; i < 50; i++) {
      stepCamera(c, b, rand);
      expect(Math.abs(c.shakeX)).toBeLessThanOrEqual(8);
      expect(Math.abs(c.shakeY)).toBeLessThanOrEqual(8);
    }
  });
  it('with shake turned off the offset is always 0', () => {
    const { b, c, rand } = setup();
    c.shakeEnabled = false;
    shake(c, 4, 0.25);
    for (let i = 0; i < 20; i++) { stepCamera(c, b, rand); expect([c.shakeX, c.shakeY]).toEqual([0, 0]); }
  });
});
