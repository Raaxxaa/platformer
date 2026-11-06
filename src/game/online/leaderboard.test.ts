// 06 §14.3 (M18): the leaderboard against a fake server — only the official finished daily, once; offline queue.
import { describe, expect, it } from 'vitest';
import { defaultSave, type SaveData } from '../../core/save/schema.ts';
import { rankOf, scoreToSend, validName } from '../../core/run/leaderboard.ts';
import { dailyStanding, fetchBoard, flushQueue, submitDaily } from './leaderboard.ts';

const cfg = { url: 'https://x.supabase.co', anonKey: 'anon' } as never;
function server(fail = false) {
  const rows: Record<string, unknown>[] = [], calls: { method: string; url: string; body?: unknown }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ method: init.method!, url, body: init.body ? JSON.parse(String(init.body)) : undefined });
    if (fail) throw new Error('offline');
    if (init.method === 'POST') {
      const b = JSON.parse(String(init.body));
      if (rows.some((r) => r.day === b.day && r.name === b.name)) return new Response('', { status: 409 });
      rows.push(b); return new Response('', { status: 201 });
    }
    const day = /day=eq\.(\d+)/.exec(url)![1], assist = /assist=eq\.(\w+)/.exec(url)![1] === 'true';
    return new Response(JSON.stringify(rows.filter((r) => r.day === day && r.assist === assist).sort((a, b) => (a.ticks as number) - (b.ticks as number))), { status: 200 });
  }) as unknown as typeof fetch;
  return { rows, calls, f };
}
function saveWith(result: 'complete' | 'death', name: string | null = 'Ana_1'): { get: () => SaveData; update: (fn: (s: SaveData) => void) => void } {
  const s = defaultSave(); s.settings.online.name = name;
  s.daily['20261105'] = { official: { result, ticks: 62000, stageReached: 4, splits: [1, 2, 3, 62000], road: 'forest', assist: false }, bestTicks: 62000, attempts: 1 };
  return { get: () => s, update: (fn) => fn(s) };
}
const kit = { cls: 'tank', weapon: 'war_maul' };

describe('online leaderboard (06 §14.3)', () => {
  it('names are 3–12 of A–Z a–z 0–9 _', () => {
    for (const n of ['abc', 'A_b_9', 'ABCDEFGHIJKL']) expect(validName(n)).toBe(true);
    for (const n of ['ab', 'ABCDEFGHIJKLM', 'a b', 'é12']) expect(validName(n)).toBe(false);
  });
  it('only the official finished daily is sent, once, with only the §14.3 fields', async () => {
    const srv = server(), s = saveWith('complete');
    expect(await submitDaily('20261105', kit, s.get, s.update, srv.f, cfg)).toBe('ok');
    expect(srv.calls[0].body).toEqual({ day: '20261105', name: 'Ana_1', ticks: 62000, class: 'tank', weapon: 'war_maul', road: 'forest', assist: false });
    expect(s.get().daily['20261105'].sent).toBe(true);
    expect(await submitDaily('20261105', kit, s.get, s.update, srv.f, cfg)).toBe('none');
    expect(srv.rows).toHaveLength(1);
    const d = saveWith('death'); expect(scoreToSend(d.get().daily, '20261105', 'Ana_1', kit)).toBeNull();
    expect(scoreToSend(saveWith('complete', null).get().daily, '20261105', null, kit)).toBeNull();
  });
  it('offline: the row is queued and retried later, exactly one row', async () => {
    const off = server(true), s = saveWith('complete');
    expect(await submitDaily('20261105', kit, s.get, s.update, off.f, cfg)).toBe('failed');
    expect(s.get().onlineQueue?.ticks).toBe(62000); expect(s.get().daily['20261105'].sent).toBeUndefined();
    const on = server();
    expect(await flushQueue(s.get, s.update, on.f, cfg)).toBe('ok');
    expect(on.rows).toHaveLength(1); expect(s.get().onlineQueue).toBeNull();
    expect(await flushQueue(s.get, s.update, on.f, cfg)).toBe('none');
  });
  it('nothing is sent with no URL or the switch off', async () => {
    const srv = server(), s = saveWith('complete');
    expect(await submitDaily('20261105', kit, s.get, s.update, srv.f, { url: '', anonKey: '' } as never)).toBe('none');
    s.get().settings.online.enabled = false;
    expect(await submitDaily('20261105', kit, s.get, s.update, srv.f, cfg)).toBe('none');
    expect(srv.calls).toEqual([]);
  });
  it('rank of N and the top lists; assisted runs listed separately', async () => {
    const srv = server();
    srv.rows.push({ day: '20261105', name: 'a', ticks: 50000, assist: false }, { day: '20261105', name: 'b', ticks: 70000, assist: false }, { day: '20261105', name: 'c', ticks: 1, assist: true });
    expect(await dailyStanding('20261105', 62000, false, srv.f, cfg)).toMatchObject({ rank: 2, of: 2 });
    expect((await fetchBoard('20261105', true, 50, srv.f, cfg))?.map((r) => r.name)).toEqual(['c']);
    expect(rankOf([{ ticks: 5 }, { ticks: 5 }], 5)).toEqual({ rank: 1, of: 2 });
  });
});
