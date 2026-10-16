export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 360;

/** Largest whole-number zoom at which the 640 × 360 game fits the window (never below 1). */
export function computeZoom(windowW: number, windowH: number): number {
  return Math.max(1, Math.floor(Math.min(windowW / GAME_WIDTH, windowH / GAME_HEIGHT)));
}
