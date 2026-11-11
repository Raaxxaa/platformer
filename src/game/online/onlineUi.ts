// Browser glue for the leaderboard (06 §14.3, M18): the name prompt, the board's data, the result standing.
import { recordsOff } from '../debug.ts';
import { pastDays, dailyDay } from '../../core/run/daily.ts';
import { validName } from '../../core/run/leaderboard.ts';
import { ONLINE } from '../../data/online.ts';
import type { BoardDeps } from '../../ui/screens/leaderboard.ts';
import { saveStore } from '../save/storage.ts';
import { dailyStanding, fetchBoard, flushQueue, onlineConfigured, submitDaily } from './leaderboard.ts';

/** Asks once for a name (the browser's text box); null if cancelled or invalid. */
export function askName(): string | null {
  const raw = typeof window !== 'undefined' ? window.prompt(ONLINE.namePrompt, saveStore().data.settings.online.name ?? '') : null;
  const name = raw?.trim() ?? '';
  if (!validName(name)) return null;
  saveStore().update((s) => { s.settings.online.name = name; });
  return name;
}
export function boardDeps(onClose: () => void): BoardDeps {
  const now = new Date();
  return {
    days: [dailyDay(now), ...pastDays(now)], fetch: (day, assist) => fetchBoard(day, assist, ONLINE.listTop),
    name: () => saveStore().data.settings.online.name, sending: () => saveStore().data.settings.online.enabled,
    setName: () => { askName(); }, toggleSending: () => saveStore().update((s) => { s.settings.online.enabled = !s.settings.online.enabled; }), onClose,
  };
}
/** On launch: retry the one queued score. */
export const retryQueued = (): void => { if (onlineConfigured() && !recordsOff()) void flushQueue(() => saveStore().data, (fn) => saveStore().update(fn)); };

/** After an official daily finishes: name (asked the first time), send once, then `#rank of N` and the top 10. */
export async function afterDailyFinish(day: string, kit: { cls: string; weapon: string }, ticks: number, assist: boolean):
  Promise<{ line: string; rows: Awaited<ReturnType<typeof dailyStanding>> extends infer T ? T extends { top: infer R } ? R : never : never; me: string | null } | null> {
  if (!onlineConfigured() || !saveStore().data.settings.online.enabled || recordsOff()) return null;
  if (!saveStore().data.settings.online.name && !askName()) return null;
  const sent = await submitDaily(day, kit, () => saveStore().data, (fn) => saveStore().update(fn));
  const st = await dailyStanding(day, ticks, assist);
  const me = saveStore().data.settings.online.name;
  if (!st) return { line: ONLINE.unavailable + (sent === 'failed' ? ' — your score will be sent next time' : ''), rows: null as never, me };
  return { line: `#${st.rank} of ${st.of}${assist ? ' (assisted)' : ''}`, rows: st.top as never, me };
}
