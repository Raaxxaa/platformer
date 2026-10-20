import { describe, it, expect } from 'vitest';
import { approach, clampAbs, roundHalfUp } from './math.ts';

describe('approach function', () => {
  it('approach(0, 10, 3) is 3', () => {
    expect(approach(0, 10, 3)).toBe(3);
  });

  it('approach(9, 10, 3) is 10 (does not pass target)', () => {
    expect(approach(9, 10, 3)).toBe(10);
  });

  it('approach(10, 0, 4) is 6', () => {
    expect(approach(10, 0, 4)).toBe(6);
  });

  it('approach(1, 0, 4) is 0', () => {
    expect(approach(1, 0, 4)).toBe(0);
  });

  it('approach(5, 5, 2) is 5', () => {
    expect(approach(5, 5, 2)).toBe(5);
  });
});

describe('clampAbs function', () => {
  it('clampAbs(7, 5) is 5', () => {
    expect(clampAbs(7, 5)).toBe(5);
  });

  it('clampAbs(-7, 5) is -5', () => {
    expect(clampAbs(-7, 5)).toBe(-5);
  });

  it('clampAbs(3, 5) is 3', () => {
    expect(clampAbs(3, 5)).toBe(3);
  });
});

describe('roundHalfUp function', () => {
  it('roundHalfUp(2.5) is 3', () => {
    expect(roundHalfUp(2.5)).toBe(3);
  });

  it('roundHalfUp(2.4) is 2', () => {
    expect(roundHalfUp(2.4)).toBe(2);
  });

  it('roundHalfUp(-2.5) is -2', () => {
    expect(roundHalfUp(-2.5)).toBe(-2);
  });

  it('roundHalfUp(0.1 + 0.2 + 0.2) is 1 (0.5 with float error rounds up)', () => {
    expect(roundHalfUp(0.1 + 0.2 + 0.2)).toBe(1);
  });
});
