// Rush meter (02 §8).
import type { RushState } from './types.ts';
import { RUSH } from '../tuning.ts';

export function createRush(): RushState {
  return { value: 0, stillTime: 0, noGainTime: 0, floor: 0 };
}

/** Adds (or removes) Rush, clamped to [floor, 300]. A positive amount counts as a gain. */
export function addRushValue(r: RushState, amount: number): void {
  r.value = Math.max(r.floor, Math.min(RUSH.MAX, r.value + amount));
  if (amount > 0) r.noGainTime = 0;
}
