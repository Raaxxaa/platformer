import { describe, expect, it } from 'vitest';
import { createRunState } from './runState.ts';
import { bestDailySegments, dailyDay, dailyKit, dailySeed, dailyShareText, recordDaily, type DailyResult } from './daily.ts';

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
      .toBe('RUSHBLADE Daily 2026-11-04 · Tank (War Maul) · Forest · 8:41.10 · 🟥🟩⬜🟥');
    expect(dailyShareText('20261104', kit, { result: 'death', ticks: 9000, stageReached: 3, splits: [1000, 2000, null, null], road: 'mountain', assist: false }, [null, null, null, null]))
      .toBe('RUSHBLADE Daily 2026-11-04 · Tank (War Maul) · Mountain · 💀 Stage 3 · ⬜⬜');
    expect(dailyShareText('20261104', kit, done(62533, { assist: true }), [null, null, null, null]).endsWith('(assist)')).toBe(true);
    expect(bestDailySegments({ a: { official: done(4000), bestTicks: null, attempts: 1 } }, 'forest')).toEqual([1000, 1000, 1000, 1000]);
  });
});
