import { describe, it, expect } from 'vitest';
import { computeZoom } from './zoom.ts';
describe('computeZoom', () => {
  it('uses the largest whole number that fits', () => {
    expect(computeZoom(1280, 720)).toBe(2);
    expect(computeZoom(1920, 1080)).toBe(3);
    expect(computeZoom(2560, 1440)).toBe(4);
    expect(computeZoom(1000, 600)).toBe(1);
    expect(computeZoom(1919, 1080)).toBe(2);
  });
  it('never goes below 1', () => {
    expect(computeZoom(300, 200)).toBe(1);
  });
});
