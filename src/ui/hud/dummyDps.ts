// 07 §5.8 Training Dummy DPS readout. Pure: hits are { tick, amount } in world ticks.
import { TICK_RATE } from '../../core/tuning.ts';

export const DPS = { windowS: 5.0, minS: 1.0, hideAfterS: 3.0 } as const;

/** round(sum in the last 5.0 s ÷ clamp(now − oldest hit in that window, 1.0, 5.0)); null when hidden (3.0 s after the last hit). */
export function dummyDps(hits: readonly { tick: number; amount: number }[], now: number): number | null {
  const recent = hits.filter((h) => now - h.tick <= DPS.windowS * TICK_RATE);
  if (!recent.length) return null;
  const last = Math.max(...recent.map((h) => h.tick));
  if (now - last > DPS.hideAfterS * TICK_RATE) return null;
  const oldest = Math.min(...recent.map((h) => h.tick));
  const span = Math.min(DPS.windowS, Math.max(DPS.minS, (now - oldest) / TICK_RATE));
  return Math.round(recent.reduce((s, h) => s + h.amount, 0) / span);
}
