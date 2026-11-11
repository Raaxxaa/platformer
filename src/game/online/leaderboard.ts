// Online daily leaderboard client (06 §14.3, M18): Supabase's REST API with the public anon key.
// Only the §14.3 fields leave the device. With no URL configured nothing is sent and the board is hidden.
import { ONLINE } from '../../data/online.ts';
import { rankOf, scoreToSend, type BoardKind, type BoardRow, type ScoreRow } from '../../core/run/leaderboard.ts';
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

/** Sends a row through the database function `submit_score` (M19: it keeps only the fastest time per kind, day and
 * name). Before the M19 SQL is run that function is missing (404): a daily row is then inserted the M18 way.
 * 'ok' when stored, 'taken' when the name already has a row that day (old table only), 'failed' when offline or refused. */
export async function postScore(row: ScoreRow, f: Fetch = fetch, cfg: Cfg = live()): Promise<'ok' | 'taken' | 'failed'> {
  if (!onlineConfigured(cfg)) return 'failed';
  const body = { p_kind: row.kind, p_day: row.day, p_name: row.name, p_ticks: row.ticks, p_class: row.class, p_weapon: row.weapon, p_road: row.road, p_assist: row.assist };
  const r = await timed(f, `${cfg.url}/rest/v1/rpc/submit_score`, { method: 'POST', headers: headers(cfg), body: JSON.stringify(body) });
  if (!r) return 'failed';
  if (r.ok) return 'ok';
  if (r.status !== 404 || row.kind !== 'daily') return 'failed';
  const { kind: _k, ...old } = row;
  const o = await timed(f, `${cfg.url}/rest/v1/${ONLINE.table}`, { method: 'POST', headers: { ...headers(cfg), Prefer: 'return=minimal' }, body: JSON.stringify(old) });
  if (!o) return 'failed';
  if (o.status === 409) return 'taken';
  return o.ok ? 'ok' : 'failed';
}
/** A day's (or week's) list, fastest first: normal runs or assisted runs (listed separately). Null when unavailable. */
export async function fetchBoard(kind: BoardKind, day: string, assist: boolean, limit: number, f: Fetch = fetch, cfg: Cfg = live()): Promise<BoardRow[] | null> {
  if (!onlineConfigured(cfg)) return null;
  const base = `day=eq.${day}&assist=eq.${assist}&order=ticks.asc,created_at.asc&limit=${limit}&select=name,ticks,class,weapon,road`;
  const get = async (q: string) => {
    const r = await timed(f, `${cfg.url}/rest/v1/${ONLINE.table}?${q}`, { method: 'GET', headers: headers(cfg) });
    if (!r) return { rows: null, status: 0 };
    if (!r.ok) return { rows: null, status: r.status };
    try { const rows = await r.json() as BoardRow[]; return { rows: Array.isArray(rows) ? rows : null, status: r.status }; } catch { return { rows: null, status: r.status }; }
  };
  const a = await get(`kind=eq.${kind}&${base}`);
  if (a.rows || a.status !== 400 || kind !== 'daily') return a.rows;
  return (await get(base)).rows;                                   // the table before the M19 SQL has no `kind`
}

const bookOf = (s: SaveData, kind: BoardKind) => (kind === 'daily' ? s.daily : s.weekly);
/** Sends the queued row, if any: on success that best is marked sent and the queue empties; a failure keeps it queued. */
export async function flushQueue(getSave: () => SaveData, update: (fn: (s: SaveData) => void) => void, f: Fetch = fetch, cfg: Cfg = live()): Promise<'ok' | 'taken' | 'failed' | 'none'> {
  const row = getSave().onlineQueue;
  if (!row || !onlineConfigured(cfg) || !getSave().settings.online.enabled) return 'none';
  const r = await postScore(row, f, cfg);
  if (r === 'ok' || r === 'taken') update((s) => { s.onlineQueue = null; const e = bookOf(s, row.kind ?? 'daily')[row.day]; if (e) e.sentTicks = row.ticks; });
  return r;
}
/** After a Sprint clear or a finished Weekly: queue the day's best if it beats what was sent, and try to send it. */
export async function submitBest(kind: BoardKind, key: string, kit: { cls: string; weapon: string }, road: string, getSave: () => SaveData,
  update: (fn: (s: SaveData) => void) => void, f: Fetch = fetch, cfg: Cfg = live()): Promise<'ok' | 'taken' | 'failed' | 'none'> {
  const s = getSave(); if (!onlineConfigured(cfg) || !s.settings.online.enabled) return 'none';
  const row = scoreToSend(kind, bookOf(s, kind), key, s.settings.online.name, kit, road);
  if (!row) return 'none';
  update((x) => { x.onlineQueue = row; });
  return flushQueue(getSave, update, f, cfg);
}
/** `#rank of N` and the top rows for the result screen. */
export async function dailyStanding(kind: BoardKind, day: string, ticks: number, assist: boolean, f: Fetch = fetch, cfg: Cfg = live()): Promise<{ rank: number; of: number; top: BoardRow[] } | null> {
  const rows = await fetchBoard(kind, day, assist, 1000, f, cfg); if (!rows) return null;
  return { ...rankOf(rows, ticks), top: rows.slice(0, ONLINE.resultTop) };
}
