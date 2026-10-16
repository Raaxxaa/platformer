// Run time formats (06 §5.1). Ticks are 1/120 s; centiseconds round down.
import { TICK_RATE } from './tuning.ts';

const pad2 = (n: number) => String(n).padStart(2, '0');

function centis(ticks: number): number {
  return Math.floor((ticks * 100) / TICK_RATE);
}

/** `m:ss.cc` under an hour, `h:mm:ss.cc` from an hour. */
export function formatTime(ticks: number): string {
  const cs = centis(ticks);
  const c = cs % 100, s = Math.floor(cs / 100) % 60, m = Math.floor(cs / 6000) % 60, h = Math.floor(cs / 360000);
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}.${pad2(c)}` : `${m}:${pad2(s)}.${pad2(c)}`;
}

/** Always signed (`+`, `−` U+2212, or `±` for 0); `s.cc` under 60 s, else `m:ss.cc`. */
export function formatDelta(ticks: number): string {
  const sign = ticks > 0 ? '+' : ticks < 0 ? '−' : '±';
  const cs = centis(Math.abs(ticks));
  if (cs < 6000) return `${sign}${Math.floor(cs / 100)}.${pad2(cs % 100)}`;
  return `${sign}${formatTime(Math.abs(ticks))}`;
}
