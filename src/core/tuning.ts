// Every gameplay number lives here (00-README "Tuning constants").

/** Simulation rate: fixed 120 ticks per second (00-README "Simulation"). */
export const TICK_RATE = 120;
/** Length of one tick in seconds. */
export const TICK = 1 / TICK_RATE;

/** Converts a duration in seconds to whole ticks, once, here. */
export function ticks(seconds: number): number {
  return Math.round(seconds * TICK_RATE);
}
