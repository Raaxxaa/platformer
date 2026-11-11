// Browser glue for the leaderboard (06 §14.3, M18): the name prompt, the board's data, the result standing.
import { recordsOff } from '../debug.ts';
import { pastDays, dailyDay } from '../../core/run/daily.ts';
import { validName } from '../../core/run/leaderboard.ts';
import { ONLINE } from '../../data/online.ts';
import type { BoardDeps } from '../../ui/screens/leaderboard.ts';
import { saveStore } from '../save/storage.ts';
import { dailyStanding, fetchBoard, flushQueue, onlineConfigured, submitBest } from './leaderboard.ts';
import { NAME_PRIVACY } from '../../data/blockedNames.ts';
import type { BoardKind } from '../../core/run/leaderboard.ts';
import { weekOf } from '../../core/run/sprint.ts';

/** Asks once for a name (the browser's text box); null if cancelled or invalid. */
export function askName(): string | null {
  const raw = typeof window !== 'undefined' ? window.prompt(`${ONLINE.namePrompt}\n${NAME_PRIVACY}`, saveStore().data.settings.online.name ?? '') : null;
  const name = raw?.trim() ?? '';
  if (!validName(name)) return null;
  saveStore().update((s) => { s.settings.online.name = name; });
  return name;
}
export function boardDeps(onClose: () => void): BoardDeps {
  const now = new Date();
  return {
    days: [dailyDay(now), ...pastDays(now)],
    // Weekly boards: this week's Monday and the weeks before it (one per 7 days back).
    weeks: Array.from({ length: ONLINE.pastWeeks }, (_, i) => weekOf(new Date(now.getTime() - i * 7 * 86_400_000))),
    fetch: (kind, day, assist) => fetchBoard(kind, day, assist, ONLINE.listTop),
    name: () => saveStore().data.settings.online.name, sending: () => saveStore().data.settings.online.enabled,
    setName: () => { askName(); }, toggleSending: () => saveStore().update((s) => { s.settings.online.enabled = !s.settings.online.enabled; }), onClose,
  };
}
/** On launch: retry the one queued score. */
export const retryQueued = (): void => { if (onlineConfigured() && !recordsOff()) void flushQueue(() => saveStore().data, (fn) => saveStore().update(fn)); };

/** After a Sprint clear or a finished Weekly (06 §14.1a): name (asked the first time), send the best if it improved,
 * then `#rank of N` and the top 10. */
export async function afterDailyFinish(kind: BoardKind, day: string, kit: { cls: string; weapon: string }, ticks: number, assist: boolean, road: string):
  Promise<{ line: string; rows: Awaited<ReturnType<typeof dailyStanding>> extends infer T ? T extends { top: infer R } ? R : never : never; me: string | null } | null> {
  if (!onlineConfigured() || !saveStore().data.settings.online.enabled || recordsOff()) return null;
  if (!saveStore().data.settings.online.name && !askName()) return null;
  const sent = await submitBest(kind, day, kit, road, () => saveStore().data, (fn) => saveStore().update(fn));
  const st = await dailyStanding(kind, day, ticks, assist);
  const me = saveStore().data.settings.online.name;
  if (!st) return { line: ONLINE.unavailable + (sent === 'failed' ? ' — your score will be sent next time' : ''), rows: null as never, me };
  return { line: `#${st.rank} of ${st.of}${assist ? ' (assisted)' : ''}`, rows: st.top as never, me };
}
