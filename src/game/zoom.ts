import { VIEW_W, VIEW_H } from '../core/tuning.ts';

export const GAME_WIDTH = VIEW_W;
export const GAME_HEIGHT = VIEW_H;

/** Largest whole-number zoom at which the 640 × 360 game fits the window (never below 1). */
export function computeZoom(windowW: number, windowH: number): number {
  return Math.max(1, Math.floor(Math.min(windowW / GAME_WIDTH, windowH / GAME_HEIGHT)));
}
