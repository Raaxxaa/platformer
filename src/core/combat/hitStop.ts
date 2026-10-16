// Hit-stop math (02 §4.1).
import { COMBAT, TICK_RATE } from '../tuning.ts';

/** Melee hit-stop in ticks: value + 0.025 crit + 0.025 kill, capped at 0.125 s. */
export function meleeHitStopTicks(valueS: number, crit: boolean, kill: boolean): number {
  const s = valueS + (crit ? COMBAT.HIT_STOP_CRIT_BONUS : 0) + (kill ? COMBAT.HIT_STOP_KILL_BONUS : 0);
  return Math.round(Math.min(s, COMBAT.HIT_STOP_CAP) * TICK_RATE);
}

/** Hit-stop never adds: the larger remaining value wins. */
export function maxStop(current: number, next: number): number {
  return Math.max(current, next);
}
