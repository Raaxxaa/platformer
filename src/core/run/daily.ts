// The Daily challenge (06 §14.1, M15): one run a day, the same seed, kit, layouts and Dragon roll for everyone (UTC day).
import { CLASS_IDS, STARTING_KITS } from '../../data/classes.ts';
import { CLASS_NAME } from '../../data/classes.ts';
import { WEAPON_NAME } from '../../data/uiText.ts';
import type { ClassId } from '../abilities/types.ts';
import type { WeaponId } from '../combat/types.ts';
import { deriveSeed, fnv1a32, Rng } from '../rng.ts';
import type { Road } from '../save/schema.ts';

export const DAILY = { keepDays: 60, freeRestartTicks: 30 * 120 } as const;

/** `YYYYMMDD` of a moment, in UTC. */
export const dailyDay = (now: Date): string =>
  `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
export const dailySeed = (day: string): string => `DAILY-${day}`;

/** The kit drawn from the seed: stream `daily` (scope run): class, then one of its two starting weapons. */
export function dailyKit(seedText: string): { cls: ClassId; weapon: WeaponId } {
  const rng = new Rng(deriveSeed(fnv1a32(seedText), 'daily', 'run'));
  const cls = CLASS_IDS[Math.floor(rng.next() * 4)];
  const weapon = STARTING_KITS[cls].weapons[Math.floor(rng.next() * 2)];
  return { cls, weapon };
}

export interface DailyResult { result: 'complete' | 'death'; ticks: number; stageReached: number; splits: (number | null)[]; road: Road | null; assist: boolean }
export interface DailyEntry { official: DailyResult | null; bestTicks: number | null; attempts: number; bestSplits?: Record<string, (number | null)[]> }
export type DailyBook = Record<string, DailyEntry>;

/** Records an attempt (06 §14.1): the first attempt of the day is official, except a restart in its first 30 s. */
export function recordDaily(book: DailyBook, day: string, r: DailyResult | { result: 'restart'; ticks: number }): DailyBook {
  const out: DailyBook = structuredClone(book);
  const e = out[day] ??= { official: null, bestTicks: null, attempts: 0 };
  if (r.result === 'restart' && r.ticks < DAILY.freeRestartTicks && e.official === null) return prune(out);
  e.attempts += 1;
  if (r.result !== 'restart') {
    if (e.official === null) e.official = r;
    if (r.result === 'complete' && (e.bestTicks === null || r.ticks < e.bestTicks)) e.bestTicks = r.ticks;
  } else if (e.official === null) e.official = { result: 'death', ticks: r.ticks, stageReached: 1, splits: [null, null, null, null], road: null, assist: false };
  return prune(out);
}
function prune(book: DailyBook): DailyBook {
  const days = Object.keys(book).sort();
  for (const d of days.slice(0, Math.max(0, days.length - DAILY.keepDays))) delete book[d];
  return book;
}

const fmt = (ticks: number): string => {
  const cs = Math.floor((ticks * 100) / 120), m = Math.floor(cs / 6000), s = Math.floor((cs % 6000) / 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};

/** The share text (06 §14.1). One square per split: green if faster than the best daily split on any day with the same road,
 * red if slower, grey if none. */
export function dailyShareText(day: string, kit: { cls: ClassId; weapon: WeaponId }, r: DailyResult, bestSplits: (number | null)[]): string {
  const date = `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;
  const road = r.road === 'forest' ? 'Forest' : r.road === 'mountain' ? 'Mountain' : '—';
  const squares = r.splits.map((s, i) => {
    if (s === null) return '';
    const seg = s - (i === 0 ? 0 : r.splits[i - 1] ?? 0), best = bestSplits[i];
    return best === null || best === undefined ? '⬜' : seg <= best ? '🟩' : '🟥';
  }).join('');
  const outcome = r.result === 'complete' ? fmt(r.ticks) : `💀 Stage ${r.stageReached}`;
  return `RUSHBLADE Daily ${date} · ${CLASS_NAME[kit.cls]} (${WEAPON_NAME(kit.weapon)}) · ${road} · ${outcome}${squares ? ` · ${squares}` : ''}${r.assist ? ' (assist)' : ''}`;
}

/** The best segment per split across every day with this road (for the share squares). */
export function bestDailySegments(book: DailyBook, road: Road | null): (number | null)[] {
  const best: (number | null)[] = [null, null, null, null];
  for (const e of Object.values(book)) for (const r of [e.official]) {
    if (!r || r.road !== road) continue;
    r.splits.forEach((s, i) => { if (s === null) return; const seg = s - (i === 0 ? 0 : r.splits[i - 1] ?? 0); if (best[i] === null || seg < best[i]!) best[i] = seg; });
  }
  return best;
}
