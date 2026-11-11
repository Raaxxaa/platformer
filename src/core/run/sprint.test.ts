import { describe, expect, it } from 'vitest';
import { recordBest, sprintPick, sprintShareText, weekOf, weeklySeed, SPRINT_STAGES } from './sprint.ts';
import { dailyKit, dailySeed, dailyShareText } from './daily.ts';

describe('Daily Sprint (06 §14.1a)', () => {
  it('the stage is the first draw, then class, weapon and twist; the same everywhere; every stage reachable', () => {
    expect(sprintPick('DAILY-20261112')).toEqual(sprintPick('DAILY-20261112'));
    const seen = new Set<string>(); for (let d = 1; d <= 200; d++) seen.add(sprintPick(dailySeed(`2026${String(d).padStart(4, '0')}`)).stage);
    expect([...seen].sort()).toEqual([...SPRINT_STAGES].sort());
    // The stage draw comes first, so a Sprint's kit is not the old full-run daily's kit for the same seed (intended).
    let differ = 0; for (let d = 1; d <= 50; d++) { const s = dailySeed(`2026${String(d).padStart(4, '0')}`); if (sprintPick(s).cls !== dailyKit(s).cls) differ++; }
    expect(differ).toBeGreaterThan(0);
  });
  it('best of the day: unlimited attempts, the lowest time counts, deaths only add an attempt', () => {
    let r = recordBest({}, '20261112', 30000, 60); expect(r.isNew).toBe(true);
    r = recordBest(r.book, '20261112', null, 60); expect(r.isNew).toBe(false);
    r = recordBest(r.book, '20261112', 32000, 60); expect(r.isNew).toBe(false);
    r = recordBest(r.book, '20261112', 25000, 60); expect(r.isNew).toBe(true);
    expect(r.book['20261112']).toMatchObject({ bestTicks: 25000, attempts: 4 });
  });
  it('share text', () => {
    expect(sprintShareText('20261112', { stage: 'mountains', twist: 'glass_cannon', cls: 'tank', weapon: 'war_maul' }, 19328, false))
      .toBe('RUSHBLADE Daily 2026-11-12 · Mountains · Glass Cannon · Tank (War Maul) · 2:41.06');
  });
});

describe('Weekly Run (06 §14.1a)', () => {
  it('one seed per ISO week, on that Monday (UTC)', () => {
    expect(weekOf(new Date('2026-11-12T10:00:00Z'))).toEqual({ monday: '20261109', label: '2026-W46' });
    expect(weekOf(new Date('2026-11-15T23:59:00Z')).monday).toBe('20261109');
    expect(weekOf(new Date('2026-11-16T00:00:00Z')).monday).toBe('20261116');
    expect(weekOf(new Date('2027-01-01T12:00:00Z'))).toEqual({ monday: '20261228', label: '2026-W53' });
    expect(weeklySeed('20261109')).toBe('WEEKLY-20261109');
  });
  it('share text', () => {
    const t = dailyShareText('20261109', { cls: 'tank', weapon: 'war_maul' }, { result: 'complete', ticks: 62656, stageReached: 4, splits: [1, 2, 3, 62656], road: 'forest', assist: false }, [null, null, null, null], { label: '2026-W46', seed: 'WEEKLY-20261109' });
    expect(t).toMatch(/^RUSHBLADE Weekly 2026-W46 · .+ · Tank \(War Maul\) · Forest · 8:42\.13 · ⬜⬜⬜⬜$/);
  });
});
