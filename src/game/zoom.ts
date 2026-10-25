import { VIEW_W, VIEW_H } from '../core/tuning.ts';

export const GAME_WIDTH = VIEW_W;
export const GAME_HEIGHT = VIEW_H;

/** True on phones and tablets (the main pointer is a finger), where the screen is fitted instead of whole-number scaled. */
export const isTouchDevice = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

/**
 * The 640 × 360 game's scale for a window (00-README, 07 §8.6): the largest whole number that fits, but on touch
 * devices, and whenever that would be below 2, the screen is fitted with a fractional scale (nearest-neighbor stays on).
 */
export function computeZoom(windowW: number, windowH: number, touch = false): number {
  const fit = Math.min(windowW / GAME_WIDTH, windowH / GAME_HEIGHT);
  const whole = Math.max(1, Math.floor(fit));
  return touch || whole < 2 ? Math.max(0.25, fit) : whole;
}
/** Portrait (taller than wide): the game pauses and asks for landscape (07 §8.6). */
export const isPortrait = (windowW: number, windowH: number): boolean => windowH > windowW;
