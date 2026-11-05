import { describe, expect, it } from 'vitest';
import { createRunState } from './runState.ts';
import { bestDailySegments, dailyDay, dailyKit, dailySeed, dailyShareText, challengeSeed, pastDays, recordDaily, recordDailyEnd, recordSeedBest, type DailyResult } from './daily.ts';

describe('Daily challenge (06 §14.1)', () => {
  it('the UTC date gives the seed DAILY-YYYYMMDD on every device', () => {
    expect(dailyDay(new Date('2026-11-04T23:30:00-05:00'))).toBe('20261105');
    expect(dailySeed('20261104')).toBe('DAILY-20261104');
  });
  it('the kit, the layout and the Dragon roll come from the seed (the same on every device)', () => {
    const a = dailyKit('DAILY-20261104'), b = dailyKit('DAILY-20261104');
    expect(a).toEqual(b);
    expect(['swordsman', 'tank', 'archer', 'wizard']).toContain(a.cls);
    const r1 = createRunState('DAILY-20261104', true), r2 = createRunState('DAILY-20261104', true);
    expect(r1.layout).toEqual(r2.layout); expect(r1.dragon).toEqual(r2.dragon);
    const kits = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(dailyKit(`DAILY-202611${String(i + 1).padStart(2, '0')}`))));
    expect(kits.size).toBeGreaterThan(3);
  });
  const done = (ticks: number, extra: Partial<DailyResult> = {}): DailyResult => ({ result: 'complete', ticks, stageReached: 4, splits: [1000, 2000, 3000, ticks], road: 'forest', assist: false, ...extra });
  it('the first attempt is official (a restart in its first 30 s does not count); bestTicks keeps the best finish', () => {
    let b = recordDaily({}, '20261104', { result: 'restart', ticks: 1200 });
    expect(b['20261104'].official).toBeNull(); expect(b['20261104'].attempts).toBe(0);
    b = recordDaily(b, '20261104', done(50000));
    b = recordDaily(b, '20261104', done(40000));
    expect(b['20261104'].official!.ticks).toBe(50000); expect(b['20261104'].bestTicks).toBe(40000); expect(b['20261104'].attempts).toBe(2);
  });
  it('keeps the last 60 days', () => {
    let b = {};
    for (let i = 0; i < 70; i++) b = recordDaily(b, `2026${String(100 + i)}x`.slice(0, 8) + i, done(1000));
    expect(Object.keys(b)).toHaveLength(60);
  });
  it('share text for a finished run, a death and an assisted run', () => {
    const kit = { cls: 'tank' as const, weapon: 'war_maul' as const };
    expect(dailyShareText('20261104', kit, done(62533, { splits: [1000, 3000, 5000, 62533] }), [900, 2100, null, 50000]))
      .toBe('RUSHBLADE Daily 2026-11-04 · Golden Hour · Tank (War Maul) · Forest · 8:41.10 · 🟥🟩⬜🟥');
    expect(dailyShareText('20261104', kit, { result: 'death', ticks: 9000, stageReached: 3, splits: [1000, 2000, null, null], road: 'mountain', assist: false }, [null, null, null, null]))
      .toBe('RUSHBLADE Daily 2026-11-04 · Golden Hour · Tank (War Maul) · Mountain · 💀 Stage 3 · ⬜⬜');
    expect(dailyShareText('20261104', kit, done(62533, { assist: true }), [null, null, null, null]).endsWith('(assist)')).toBe(true);
    expect(bestDailySegments({ a: { official: done(4000), bestTicks: null, attempts: 1 } }, 'forest')).toEqual([1000, 1000, 1000, 1000]);
  });
});

describe('recordDailyEnd', () => {
  const base = { mode: 'daily', seedText: 'DAILY-20261105', runTicks: 9000, stageReached: 2, splits: [4000, null, null, null], road: 'forest' as const };
  it('ignores normal runs; a death becomes official; a quick restart does not', () => {
    expect(recordDailyEnd({}, { ...base, mode: undefined, result: 'death' })).toEqual({});
    expect(recordDailyEnd({}, { ...base, result: 'restart', runTicks: 100 })['20261105']?.official ?? null).toBeNull();
    const b = recordDailyEnd({}, { ...base, result: 'death' });
    expect(b['20261105'].official).toMatchObject({ result: 'death', stageReached: 2, ticks: 9000 });
  });
});

describe('seed challenge (06 §14.1, M18)', () => {
  it('keeps the best per seed, newest first, at most 50', () => {
    let b = recordSeedBest([], 'ABC', 9000).bests;
    expect(recordSeedBest(b, 'ABC', 9500)).toEqual({ bests: [{ seed: 'ABC', ticks: 9000 }], isNew: false });
    b = recordSeedBest(b, 'ABC', 8000).bests; expect(b).toEqual([{ seed: 'ABC', ticks: 8000 }]);
    for (let i = 0; i < 60; i++) b = recordSeedBest(b, `S${i}`, 100).bests;
    expect(b).toHaveLength(50); expect(b[0].seed).toBe('S59');
  });
  it('past days are the 30 days before today; seeds are validated', () => {
    const d = pastDays(new Date('2026-11-05T12:00:00Z'));
    expect(d).toHaveLength(30); expect(d[0]).toBe('20261104'); expect(d[29]).toBe('20261006');
    expect(challengeSeed(' abc12 ')).toBe('ABC12'); expect(challengeSeed('daily-20261101')).toBe('DAILY-20261101');
    expect(challengeSeed('bad seed!')).toBeNull();
  });
});
