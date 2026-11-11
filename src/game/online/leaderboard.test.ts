// 06 §14.3 (M18, M19): the leaderboard against a fake server — the best time of the day or week, sent again only when
// faster; the M19 `submit_score` function, and the M18 table before the SQL is run; offline queue; blocked names.
import { describe, expect, it } from 'vitest';
import { defaultSave, type SaveData } from '../../core/save/schema.ts';
import { blockedName, rankOf, scoreToSend, validName } from '../../core/run/leaderboard.ts';
import { dailyStanding, fetchBoard, flushQueue, submitBest } from './leaderboard.ts';

const cfg = { url: 'https://x.supabase.co', anonKey: 'anon' } as never;
type Row = Record<string, unknown>;
/** `m19`: the server has submit_score and the kind column; otherwise it is the M18 table. */
function server(opts: { fail?: boolean; m19?: boolean } = {}) {
  const rows: Row[] = [], calls: { method: string; url: string; body?: Row }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const body = init.body ? JSON.parse(String(init.body)) as Row : undefined;
    calls.push({ method: init.method!, url, body });
    if (opts.fail) throw new Error('offline');
    if (url.includes('/rpc/submit_score')) {
      if (!opts.m19) return new Response('', { status: 404 });
      const r = { kind: body!.p_kind, day: body!.p_day, name: body!.p_name, ticks: body!.p_ticks, class: body!.p_class, weapon: body!.p_weapon, road: body!.p_road, assist: body!.p_assist };
      const old = rows.find((x) => x.kind === r.kind && x.day === r.day && x.name === r.name);
      if (!old) rows.push(r); else if ((r.ticks as number) < (old.ticks as number)) Object.assign(old, r);
      return new Response(null, { status: 204 });
    }
    if (init.method === 'POST') {
      if (rows.some((r) => r.day === body!.day && r.name === body!.name)) return new Response('', { status: 409 });
      rows.push({ kind: 'daily', ...body }); return new Response('', { status: 201 });
    }
    if (!opts.m19 && url.includes('kind=eq.')) return new Response('{"message":"column kind does not exist"}', { status: 400 });
    const day = /day=eq\.(\d+)/.exec(url)![1], assist = /assist=eq\.(\w+)/.exec(url)![1] === 'true', kind = /kind=eq\.(\w+)/.exec(url)?.[1] ?? 'daily';
    return new Response(JSON.stringify(rows.filter((r) => r.kind === kind && r.day === day && r.assist === assist).sort((a, b) => (a.ticks as number) - (b.ticks as number))), { status: 200 });
  }) as unknown as typeof fetch;
  return { rows, calls, f };
}
function saveWith(best: number | null, name: string | null = 'Ana_1'): { get: () => SaveData; update: (fn: (s: SaveData) => void) => void } {
  const s = defaultSave(); s.settings.online.name = name;
  s.daily['20261112'] = { official: null, bestTicks: best, attempts: 3 };
  return { get: () => s, update: (fn) => fn(s) };
}
const kit = { cls: 'tank', weapon: 'war_maul' };

describe('online leaderboard (06 §14.3, M19)', () => {
  it('names: 3–12 of A–Z a–z 0–9 _, and none from the blocked list (any case, also inside a name)', () => {
    for (const n of ['abc', 'A_b_9', 'ABCDEFGHIJKL']) expect(validName(n)).toBe(true);
    for (const n of ['ab', 'ABCDEFGHIJKLM', 'a b', 'é12', 'ShitHead', 'xxNAZIxx', 'Ad_min']) expect(validName(n)).toBe(false);
    expect(blockedName('Hitler99')).toBe(true); expect(blockedName('Sparrow')).toBe(false);
  });
  it('the day\'s best is sent through submit_score, and again only when it gets faster', async () => {
    const srv = server({ m19: true }), s = saveWith(30000);
    expect(await submitBest('daily', '20261112', kit, 'mountains', s.get, s.update, srv.f, cfg)).toBe('ok');
    expect(srv.calls[0].url).toContain('/rest/v1/rpc/submit_score');
    expect(srv.calls[0].body).toEqual({ p_kind: 'daily', p_day: '20261112', p_name: 'Ana_1', p_ticks: 30000, p_class: 'tank', p_weapon: 'war_maul', p_road: 'mountains', p_assist: false });
    expect(s.get().daily['20261112'].sentTicks).toBe(30000);
    expect(await submitBest('daily', '20261112', kit, 'mountains', s.get, s.update, srv.f, cfg)).toBe('none');
    s.get().daily['20261112'].bestTicks = 28000;
    expect(await submitBest('daily', '20261112', kit, 'mountains', s.get, s.update, srv.f, cfg)).toBe('ok');
    expect(srv.rows).toHaveLength(1); expect(srv.rows[0].ticks).toBe(28000);
    expect(scoreToSend('daily', saveWith(null).get().daily, '20261112', 'Ana_1', kit, 'plains')).toBeNull();
  });
  it('weekly rows carry kind weekly', async () => {
    const srv = server({ m19: true }), s = saveWith(null); s.get().weekly['20261109'] = { official: null, bestTicks: 62000, attempts: 1 };
    expect(await submitBest('weekly', '20261109', kit, 'forest', s.get, s.update, srv.f, cfg)).toBe('ok');
    expect(srv.rows[0]).toMatchObject({ kind: 'weekly', day: '20261109', ticks: 62000 });
    expect((await fetchBoard('weekly', '20261109', false, 50, srv.f, cfg))?.map((r) => r.ticks)).toEqual([62000]);
  });
  it('before the M19 SQL: a daily row is inserted the M18 way and the board reads without kind', async () => {
    const srv = server(), s = saveWith(30000);
    expect(await submitBest('daily', '20261112', kit, 'plains', s.get, s.update, srv.f, cfg)).toBe('ok');
    expect(srv.rows).toHaveLength(1);
    expect((await fetchBoard('daily', '20261112', false, 50, srv.f, cfg))?.map((r) => r.name)).toEqual(['Ana_1']);
  });
  it('offline: the row is queued and retried later, exactly one row', async () => {
    const off = server({ fail: true }), s = saveWith(30000);
    expect(await submitBest('daily', '20261112', kit, 'plains', s.get, s.update, off.f, cfg)).toBe('failed');
    expect(s.get().onlineQueue?.ticks).toBe(30000); expect(s.get().daily['20261112'].sentTicks).toBeUndefined();
    const on = server({ m19: true });
    expect(await flushQueue(s.get, s.update, on.f, cfg)).toBe('ok');
    expect(on.rows).toHaveLength(1); expect(s.get().onlineQueue).toBeNull();
    expect(await flushQueue(s.get, s.update, on.f, cfg)).toBe('none');
  });
  it('nothing is sent with no URL or the switch off', async () => {
    const srv = server({ m19: true }), s = saveWith(30000);
    expect(await submitBest('daily', '20261112', kit, 'plains', s.get, s.update, srv.f, { url: '', anonKey: '' } as never)).toBe('none');
    s.get().settings.online.enabled = false;
    expect(await submitBest('daily', '20261112', kit, 'plains', s.get, s.update, srv.f, cfg)).toBe('none');
    expect(srv.calls).toEqual([]);
  });
  it('rank of N and the top lists; assisted runs listed separately', async () => {
    const srv = server({ m19: true });
    srv.rows.push({ kind: 'daily', day: '20261112', name: 'a', ticks: 20000, assist: false }, { kind: 'daily', day: '20261112', name: 'b', ticks: 40000, assist: false }, { kind: 'daily', day: '20261112', name: 'c', ticks: 1, assist: true });
    expect(await dailyStanding('daily', '20261112', 30000, false, srv.f, cfg)).toMatchObject({ rank: 2, of: 2 });
    expect((await fetchBoard('daily', '20261112', true, 50, srv.f, cfg))?.map((r) => r.name)).toEqual(['c']);
    expect(rankOf([{ ticks: 5 }, { ticks: 5 }], 5)).toEqual({ rank: 1, of: 2 });
  });
});
