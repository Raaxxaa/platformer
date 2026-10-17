import { describe, expect, it } from 'vitest';
import { computeClassState } from '../../core/classes/classState.ts';
import { TRIM_TINT } from '../../data/art.ts';
import { trimTints } from './trims.ts';

describe('trim tints (08 §3.4)', () => {
  it('no class, one class, a Connection, a hybrid', () => {
    expect(trimTints(computeClassState([null, null]))).toEqual([TRIM_TINT.none, TRIM_TINT.none]);
    expect(trimTints(computeClassState(['blink', null]))).toEqual([TRIM_TINT.wizard, TRIM_TINT.none]);
    expect(trimTints(computeClassState(['blink', 'thunder_strike']))).toEqual([TRIM_TINT.wizard, TRIM_TINT.wizard]);
    expect(trimTints(computeClassState(['arrow_rain', 'blade_dash']))).toEqual([TRIM_TINT.swordsman, TRIM_TINT.archer]);   // Thief = red + green
  });
});
