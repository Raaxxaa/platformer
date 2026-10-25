// Vibration (07 §8.6): 12 ms when the player is hit, 25 ms on death, 8 ms on a parry. Never during menus.
import type { TouchSettings } from '../../core/save/schema.ts';
import type { WorldEvent } from '../../core/sim/gameWorld.ts';
import { TOUCH } from '../../data/touch.ts';

/** The pulse (ms) for this frame's events, or null. `active` = a run is being played with touch as the last device. */
export function vibrationFor(events: readonly WorldEvent[], s: Pick<TouchSettings, 'vibration'>, active: boolean): number | null {
  if (!s.vibration || !active) return null;
  let ms: number | null = null;
  for (const e of events) {
    if (e.t === 'playerDied') return TOUCH.vibration.death;
    if (e.t === 'hit' && e.target === 'player') ms = TOUCH.vibration.hit;
  }
  return ms;
}
export function vibrate(ms: number): void { try { navigator.vibrate?.(ms); } catch { /* not supported */ } }
