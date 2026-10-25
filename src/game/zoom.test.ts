import { describe, it, expect } from 'vitest';
import { computeZoom, isPortrait } from './zoom.ts';
describe('computeZoom', () => {
  it('desktop above 2×: the largest whole number that fits (unchanged)', () => {
    expect(computeZoom(1280, 720)).toBe(2);
    expect(computeZoom(1920, 1080)).toBe(3);
    expect(computeZoom(2560, 1440)).toBe(4);
    expect(computeZoom(1919, 1080)).toBe(2);
  });
  it('below 2× a small window is fitted with a fractional scale (07 §8.6)', () => {
    expect(computeZoom(1000, 600)).toBeCloseTo(1.5625);
    expect(computeZoom(640, 360)).toBe(1);
    expect(computeZoom(1279, 719)).toBeCloseTo(719 / 360, 3);
  });
  it('touch devices fit the screen: phone 844 × 390, tablet 1024 × 768', () => {
    expect(computeZoom(844, 390, true)).toBeCloseTo(390 / 360);
    expect(computeZoom(1024, 768, true)).toBeCloseTo(1.6);
    expect(computeZoom(1280, 720, true)).toBe(2);
  });
  it('portrait is taller than wide', () => {
    expect(isPortrait(390, 844)).toBe(true); expect(isPortrait(844, 390)).toBe(false); expect(isPortrait(500, 500)).toBe(false);
  });
});
