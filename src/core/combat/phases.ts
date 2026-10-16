import { TICK_RATE } from '../tuning.ts';

/** Attack phase length in ticks (02 §9.9): max(1, round(s × 120 / atkSpeed)); a phase of 0 stays 0. */
export function phaseTicks(seconds: number, atkSpeed: number): number {
  if (seconds === 0) return 0;
  return Math.max(1, Math.round((seconds * TICK_RATE) / atkSpeed));
}
