// The Daily challenge (06 §14.1, M15): one run a day, the same seed, kit, layouts and Dragon roll for everyone (UTC day).
import { CLASS_IDS, STARTING_KITS } from '../../data/classes.ts';
import { CLASS_NAME } from '../../data/classes.ts';
import { WEAPON_NAME } from '../../data/uiText.ts';
import type { ClassId } from '../abilities/types.ts';
import type { WeaponId } from '../combat/types.ts';
import { deriveSeed, fnv1a32, Rng } from '../rng.ts';
import type { Road } from '../save/schema.ts';
import { TWISTS, type TwistId } from '../../data/twists.ts';

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
/** 06 §14.1 (M18): the third draw of the same stream picks the twist. */
export function dailyTwist(seedText: string): TwistId {
  const rng = new Rng(deriveSeed(fnv1a32(seedText), 'daily', 'run'));
  rng.next(); rng.next();
  return TWISTS[Math.floor(rng.next() * TWISTS.length)];
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

/** A Daily run's end (history snapshot) into `save.daily` (06 §14.1). Quits count like restarts. */
export function recordDailyEnd(book: DailyBook, ended: { mode?: string; seedText: string; result: string; runTicks: number; stageReached: number; splits: (number | null)[]; road: Road | null; assist?: boolean }): DailyBook {
  if (ended.mode !== 'daily' || !ended.seedText.startsWith('DAILY-')) return book;
  const day = ended.seedText.slice(6);
  if (ended.result === 'restart' || ended.result === 'quit') return recordDaily(book, day, { result: 'restart', ticks: ended.runTicks });
  return recordDaily(book, day, { result: ended.result === 'complete' ? 'complete' : 'death', ticks: ended.runTicks, stageReached: ended.stageReached,
    splits: [...ended.splits], road: ended.road, assist: ended.assist === true });
}

/** The share text for a Daily run as it ends (death or finish), compared against the other days' best splits. */
export function dailyShareFor(book: DailyBook, run: { daily?: string; seedText: string; startKit: { cls: ClassId; weapon: WeaponId } | null; runTicks: number; stage: number;
  splits: (number | null)[]; road: Road | null }, result: 'complete' | 'death', assist: boolean): string | null {
  if (!run.daily || !run.startKit) return null;
  const others: DailyBook = { ...book }; delete others[run.daily];
  const r: DailyResult = { result, ticks: run.runTicks, stageReached: Math.max(1, run.stage), splits: [...run.splits], road: run.road, assist };
  return dailyShareText(run.daily, run.startKit, r, bestDailySegments(others, run.road));
}

/** 06 §14.1 (M18) seed challenge: any seed played like a daily; never official. Its own best per seed, last 50. */
export const SEED_CHALLENGE = { keep: 50, pastDays: 30 } as const;
export interface SeedBest { seed: string; ticks: number }
export function recordSeedBest(bests: SeedBest[], seed: string, ticks: number): { bests: SeedBest[]; isNew: boolean } {
  const old = bests.find((b) => b.seed === seed);
  const isNew = !old || ticks < old.ticks;
  const out = [{ seed, ticks: isNew ? ticks : old!.ticks }, ...bests.filter((b) => b.seed !== seed)].slice(0, SEED_CHALLENGE.keep);
  return { bests: out, isNew };
}
/** The last `n` UTC days before today, newest first (`YYYYMMDD`). */
export function pastDays(now: Date, n: number = SEED_CHALLENGE.pastDays): string[] {
  return Array.from({ length: n }, (_, i) => dailyDay(new Date(now.getTime() - (i + 1) * 86_400_000)));
}
/** A seed the challenge accepts: a typed seed (A–Z, 0–9, up to 12) or a day's `DAILY-YYYYMMDD`. */
export const challengeSeed = (raw: string): string | null => {
  const s = raw.trim().toUpperCase();
  return /^[A-Z0-9]{1,12}$/.test(s) || /^DAILY-\d{8}$/.test(s) ? s : null;
};
