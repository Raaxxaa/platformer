// Online leaderboard rules (06 §14.3, M18; M19: Daily Sprint and Weekly Run, best time counts). Pure.
import type { DailyBook } from './daily.ts';
import { BLOCKED_NAMES } from '../../data/blockedNames.ts';

export type BoardKind = 'daily' | 'weekly';
export interface ScoreRow { kind: BoardKind; day: string; name: string; ticks: number; class: string; weapon: string; road: string; assist: boolean }
export interface BoardRow { name: string; ticks: number; class: string; weapon: string; road: string }
/** 3–12 of A–Z a–z 0–9 _, and nothing from the blocked list (case-insensitive, also inside the name). */
export const validName = (n: string): boolean => /^[A-Za-z0-9_]{3,12}$/.test(n) && !blockedName(n);
export const blockedName = (n: string): boolean => { const low = n.toLowerCase().replace(/_/g, ''); return BLOCKED_NAMES.some((w) => low.includes(w)); };

/** The row to send for a day or week: its best time, when it is faster than what is already on the board. */
export function scoreToSend(kind: BoardKind, book: DailyBook, key: string, name: string | null, kit: { cls: string; weapon: string }, road: string): ScoreRow | null {
  const e = book[key];
  if (!e || e.bestTicks === null || !name || !validName(name)) return null;
  if (e.sentTicks !== undefined && e.sentTicks <= e.bestTicks) return null;
  return { kind, day: key, name, ticks: e.bestTicks, class: kit.cls, weapon: kit.weapon, road, assist: e.bestAssist === true };
}
/** `#rank of N` for a time among a day's rows (ties share the better rank). */
export function rankOf(rows: readonly { ticks: number }[], ticks: number): { rank: number; of: number } {
  return { rank: rows.filter((r) => r.ticks < ticks).length + 1, of: rows.length };
}
