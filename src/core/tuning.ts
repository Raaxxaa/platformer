// Every gameplay number lives here (00-README "Tuning constants").

/** Simulation rate: fixed 120 ticks per second (00-README "Simulation"). */
export const TICK_RATE = 120;
/** Length of one tick in seconds. */
export const TICK = 1 / TICK_RATE;

/** Converts a duration in seconds to whole ticks, once, here. */
export function ticks(seconds: number): number {
  return Math.round(seconds * TICK_RATE);
}

/** Longest real frame the fixed-step loop catches up on; longer hitches are dropped (00-README). */
export const MAX_FRAME_SECONDS = 0.25;

/** Gamepad stick thresholds (01 §1.2 step 4). */
export const INPUT = {
  STICK_X: 0.30,
  STICK_Y: 0.60,
} as const;

/** Tile size in pixels (00-README "Units"). */
export const TILE_SIZE = 16;
/** Game view (resolution) in pixels (00-README "Units"). */
export const VIEW_W = 640;
export const VIEW_H = 360;
