import { describe, it, expect } from 'vitest';
import { MOVEMENT_TEST } from './movementTest.ts';

describe('MOVEMENT_TEST level', () => {
  const g = MOVEMENT_TEST.grid;
  it('is 120 x 30 tiles', () => { expect([g.w, g.h]).toEqual([120, 30]); });
  it('spawn stands on the floor in free space', () => {
    expect(MOVEMENT_TEST.spawn).toEqual({ x: 72, y: 432 });
    expect(g.isSolidPx(72, 432)).toBe(true); expect(g.isSolidPx(72, 431)).toBe(false);
  });
  it('ledges are 80 px and 96 px above the floor', () => {
    expect(g.kindAt(24, 22)).toBe('solid'); expect(g.kindAt(24, 21)).toBe('empty');   // 432 - 22*16 = 80
    expect(g.kindAt(31, 21)).toBe('solid'); expect(g.kindAt(31, 20)).toBe('empty');   // 432 - 21*16 = 96
  });
  it('the tunnel under the wall is exactly 16 px high', () => {
    for (let x = 40; x <= 47; x++) { expect(g.kindAt(x, 25)).toBe('solid'); expect(g.kindAt(x, 26)).toBe('empty'); }
  });
  it('the 64 px shaft has a 32 px opening on the left and a platform at row 5', () => {
    expect(g.kindAt(53, 24)).toBe('solid'); expect(g.kindAt(53, 25)).toBe('empty'); expect(g.kindAt(53, 26)).toBe('empty');
    expect(g.kindAt(58, 26)).toBe('solid'); expect(g.kindAt(58, 6)).toBe('solid');
    for (let x = 54; x <= 57; x++) for (let y = 5; y <= 26; y++) expect(g.kindAt(x, y)).toBe('empty');   // 4 tiles = 64 px
    for (let x = 59; x <= 60; x++) expect(g.kindAt(x, 20)).toBe('empty');
    for (let x = 58; x <= 75; x++) expect(g.kindAt(x, 5)).toBe('solid');
  });
  it('has the one-way platforms and the low overhang', () => {
    expect(g.kindAt(80, 24)).toBe('oneway'); expect(g.kindAt(87, 20)).toBe('oneway'); expect(g.kindAt(84, 16)).toBe('oneway');
    expect(g.kindAt(95, 23)).toBe('solid'); expect(g.kindAt(95, 24)).toBe('empty');
  });
  it('the pit is 128 px wide with a floor', () => {
    for (let x = 104; x <= 111; x++) { expect(g.kindAt(x, 27)).toBe('empty'); expect(g.kindAt(x, 29)).toBe('solid'); }
    expect(g.kindAt(103, 27)).toBe('solid'); expect(g.kindAt(112, 27)).toBe('solid');
  });
});
