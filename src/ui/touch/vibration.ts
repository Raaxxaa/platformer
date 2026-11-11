// Vibration (07 §8.6): 12 ms when the player is hit, 25 ms on death, 8 ms on a parry. Never during menus.
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNativeApp } from './pwa.ts';
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
    if (e.t === 'parry') ms = Math.max(ms ?? 0, TOUCH.vibration.parry);
  }
  return ms;
}
/** Review P8: iPhones have no navigator.vibrate; the app uses Capacitor Haptics, Safari hides the setting. */
export function canVibrate(): boolean { return isNativeApp() || (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'); }
export function vibrate(ms: number): void {
  if (isNativeApp()) { void Haptics.impact({ style: ms >= TOUCH.vibration.death ? ImpactStyle.Heavy : ms >= TOUCH.vibration.hit ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {}); return; }
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}
