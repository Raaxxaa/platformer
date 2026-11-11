// Online daily leaderboard rules (06 §14.3, M18). Pure: what may be sent, and how a fetched list reads.
import type { DailyBook } from './daily.ts';

export interface ScoreRow { day: string; name: string; ticks: number; class: string; weapon: string; road: string; assist: boolean }
export interface BoardRow { name: string; ticks: number; class: string; weapon: string; road: string }
export const validName = (n: string): boolean => /^[A-Za-z0-9_]{3,12}$/.test(n);

/** The one row a day may send: its official attempt, only if it finished, and only once. */
export function scoreToSend(book: DailyBook, day: string, name: string | null, kit: { cls: string; weapon: string }): ScoreRow | null {
  const e = book[day], o = e?.official;
  if (!o || o.result !== 'complete' || e.sent || !name || !validName(name) || !o.road) return null;
  return { day, name, ticks: o.ticks, class: kit.cls, weapon: kit.weapon, road: o.road, assist: o.assist };
}
/** `#rank of N` for a time among a day's rows (ties share the better rank). */
export function rankOf(rows: readonly { ticks: number }[], ticks: number): { rank: number; of: number } {
  return { rank: rows.filter((r) => r.ticks < ticks).length + 1, of: rows.length };
}
