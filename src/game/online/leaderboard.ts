// Online daily leaderboard client (06 §14.3, M18): Supabase's REST API with the public anon key.
// Only the §14.3 fields leave the device. With no URL configured nothing is sent and the board is hidden.
import { ONLINE } from '../../data/online.ts';
import { rankOf, scoreToSend, type BoardRow, type ScoreRow } from '../../core/run/leaderboard.ts';
import type { SaveData } from '../../core/save/schema.ts';

type Fetch = typeof fetch;
type Cfg = { url: string; anonKey: string };
/** `?debug=1&online=<url>` points the game at a test server (e2e); otherwise `src/data/online.ts`. */
function live(): Cfg {
  if (typeof window === 'undefined') return ONLINE;
  const q = new URLSearchParams(window.location.search), u = q.get('debug') === '1' ? q.get('online') : null;
  return u ? { url: u, anonKey: 'test' } : ONLINE;
}
export const onlineConfigured = (cfg: Cfg = live()): boolean => !!cfg.url && !!cfg.anonKey;
// New-style publishable keys go in the apikey header only (they are not JWTs).
const headers = (cfg: Cfg) => ({ apikey: cfg.anonKey, 'Content-Type': 'application/json' });

async function timed(f: Fetch, url: string, init: RequestInit): Promise<Response | null> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), ONLINE.timeoutMs) : null;
  try { return await f(url, { ...init, signal: ctl?.signal }); } catch { return null; } finally { if (t) clearTimeout(t); }
}

/** 'ok' when stored, 'taken' when that name already has a score that day (409), 'failed' when offline or refused. */
export async function postScore(row: ScoreRow, f: Fetch = fetch, cfg: Cfg = live()): Promise<'ok' | 'taken' | 'failed'> {
  if (!onlineConfigured(cfg)) return 'failed';
  const r = await timed(f, `${cfg.url}/rest/v1/${ONLINE.table}`, { method: 'POST', headers: { ...headers(cfg), Prefer: 'return=minimal' }, body: JSON.stringify(row) });
  if (!r) return 'failed';
  if (r.status === 409) return 'taken';
  return r.ok ? 'ok' : 'failed';
}
/** A day's list, fastest first: normal runs or assisted runs (listed separately). Null when unavailable. */
export async function fetchBoard(day: string, assist: boolean, limit: number, f: Fetch = fetch, cfg: Cfg = live()): Promise<BoardRow[] | null> {
  if (!onlineConfigured(cfg)) return null;
  const q = `day=eq.${day}&assist=eq.${assist}&order=ticks.asc,created_at.asc&limit=${limit}&select=name,ticks,class,weapon,road`;
  const r = await timed(f, `${cfg.url}/rest/v1/${ONLINE.table}?${q}`, { method: 'GET', headers: headers(cfg) });
  if (!r || !r.ok) return null;
  try { const rows = await r.json() as BoardRow[]; return Array.isArray(rows) ? rows : null; } catch { return null; }
}

/** Sends the queued row, if any: on success the day is marked sent and the queue empties; a failure keeps it queued. */
export async function flushQueue(getSave: () => SaveData, update: (fn: (s: SaveData) => void) => void, f: Fetch = fetch, cfg: Cfg = live()): Promise<'ok' | 'taken' | 'failed' | 'none'> {
  const row = getSave().onlineQueue;
  if (!row || !onlineConfigured(cfg) || !getSave().settings.online.enabled) return 'none';
  const r = await postScore(row, f, cfg);
  if (r === 'ok' || r === 'taken') update((s) => { s.onlineQueue = null; if (s.daily[row.day]) s.daily[row.day].sent = true; });
  return r;
}
/** After an official daily finishes: queue its row (once) and try to send it. */
export async function submitDaily(day: string, kit: { cls: string; weapon: string }, getSave: () => SaveData, update: (fn: (s: SaveData) => void) => void,
  f: Fetch = fetch, cfg: Cfg = live()): Promise<'ok' | 'taken' | 'failed' | 'none'> {
  const s = getSave(); if (!onlineConfigured(cfg) || !s.settings.online.enabled) return 'none';
  const row = scoreToSend(s.daily, day, s.settings.online.name, kit);
  if (!row) return 'none';
  update((x) => { x.onlineQueue = row; });
  return flushQueue(getSave, update, f, cfg);
}
/** `#rank of N` and the top rows for the result screen. */
export async function dailyStanding(day: string, ticks: number, assist: boolean, f: Fetch = fetch, cfg: Cfg = live()): Promise<{ rank: number; of: number; top: BoardRow[] } | null> {
  const rows = await fetchBoard(day, assist, 1000, f, cfg); if (!rows) return null;
  return { ...rankOf(rows, ticks), top: rows.slice(0, ONLINE.resultTop) };
}
