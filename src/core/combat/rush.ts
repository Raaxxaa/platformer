// Rush meter (02 §8).
import type { RushState, Weight } from './types.ts';
import { RUSH } from '../tuning.ts';

export function createRush(): RushState {
  return { value: 0, stillTime: 0, noGainTime: 0, floor: 0 };
}

/** Adds (or removes) Rush, clamped to [floor, 300]. A positive amount counts as a gain. */
export function addRushValue(r: RushState, amount: number): void {
  r.value = Math.max(r.floor, Math.min(RUSH.MAX, r.value + amount));
  if (amount > 0) r.noGainTime = 0;
}

export function rushLevel(r: RushState): 0 | 1 | 2 | 3 {
  return Math.min(3, Math.floor(r.value / RUSH.LEVEL_STEP)) as 0 | 1 | 2 | 3;
}

/** Rush attack-speed multiplier by weight (02 §8.3). */
export function rushAttackSpeed(level: 0 | 1 | 2 | 3, weight: Weight): number {
  return (weight === 'heavy' ? RUSH.ATTACK_SPEED_HEAVY : RUSH.ATTACK_SPEED_LIGHT_MEDIUM)[level];
}
