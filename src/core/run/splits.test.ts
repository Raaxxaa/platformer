import { describe, expect, it } from 'vitest';
import { createRunState, type RunState } from './runState.ts';
import { comparisonPb, recordSplit, savePersonalBest, type RunRecords } from './splits.ts';
import type { KitSummary, PbRecord } from '../save/schema.ts';

const kit = (): KitSummary => ({ displayName: 'Gladiator', weapons: [{ weaponId: 'greatsword', grade: 'A', element: 'fire', perk: 'keen' }, null], abilities: [{ id: 'blade_dash', level: 3 }, { id: 'shockwave', level: 2 }] });
const pb = (ticks: number, splits: [number, number, number, number] = [100, 300, 600, ticks]): PbRecord => ({ ticks, splits, date: '2026-01-01T00:00:00.000Z', seedText: 'OLD', kit: kit() });
const records = (): RunRecords => ({ pbs: {}, bestSegments: {} });
function run(): RunState {
  const r = createRunState('RANDOM'); r.startKit = { cls: 'tank', weapon: 'war_maul' }; return r;
}

describe('PB comparison (06 §5.3)', () => {
  it('before choosing a road uses the faster final PB for the original starting class', () => {
    const r = run(), s = records();
    s.pbs['tank|mountain'] = pb(1000, [50, 300, 600, 1000]);
    s.pbs['tank|forest'] = pb(900, [150, 300, 600, 900]);
    s.pbs['wizard|forest'] = pb(500);
    expect(comparisonPb(r, s)).toBe(s.pbs['tank|forest']);
    s.pbs['tank|forest'] = pb(1200); expect(comparisonPb(r, s)).toBe(s.pbs['tank|mountain']);
  });
  it('after choosing a road uses only that road key, never a level id or the other road', () => {
    const r = run(), s = records(); r.road = 'forest'; s.pbs['tank|mountain'] = pb(500);
    expect(comparisonPb(r, s)).toBeNull();
    s.pbs['tank|forest'] = pb(1000); expect(comparisonPb(r, s)).toBe(s.pbs['tank|forest']);
    r.road = 'mountain'; expect(comparisonPb(r, s)).toBe(s.pbs['tank|mountain']);
  });
  it('returns no comparison with no records or no start kit; ties choose Mountain consistently', () => {
    const r = run(), s = records(); expect(comparisonPb(r, s)).toBeNull();
    s.pbs['tank|forest'] = pb(1000); s.pbs['tank|mountain'] = pb(1000);
    expect(comparisonPb(r, s)).toBe(s.pbs['tank|mountain']);
    r.startKit = null; expect(comparisonPb(r, s)).toBeNull();
  });
});

describe('split recording and best segments (06 §5.2–5.3)', () => {
  it('records the current cumulative tick once and uses the faster PB before road choice', () => {
    const r = run(), s = records(); r.runTicks = 120;
    s.pbs['tank|mountain'] = pb(1000, [100, 300, 600, 1000]); s.pbs['tank|forest'] = pb(900, [150, 300, 600, 900]);
    expect(recordSplit(r, 1, s)).toEqual({ index: 1, runTicks: 120, segmentTicks: 120, deltaTicks: -30, bestSegment: true });
    r.runTicks = 999; expect(recordSplit(r, 1, s)).toBeNull(); expect(r.splits).toEqual([120, null, null, null]);
  });
  it('includes the preceding exit, village, menu and inn time in segment 2', () => {
    const r = run(), s = records(); r.runTicks = 1000; recordSplit(r, 1, s);
    // 120 exit ticks + 300 village ticks + 240 menu ticks + 120 sleep ticks + 600 Stage 2 ticks.
    r.road = 'forest'; r.runTicks += 120 + 300 + 240 + 120 + 600;
    s.pbs['tank|forest'] = pb(9000, [900, 2500, 6000, 9000]);
    expect(recordSplit(r, 2, s)).toEqual({ index: 2, runTicks: 2380, segmentTicks: 1380, deltaTicks: -120, bestSegment: true });
    expect(s.bestSegments['tank|forest']).toEqual([1000, 1380, null, null]);
    expect(s.bestSegments['tank|mountain']).toEqual([1000, null, null, null]);
  });
  it('uses null delta without a PB; first segment writes both keys even if the run later dies', () => {
    const r = run(), s = records(); r.runTicks = 2400;
    expect(recordSplit(r, 1, s)).toMatchObject({ deltaTicks: null, bestSegment: true }); r.phase = 'dead';
    expect(s.bestSegments).toEqual({ 'tank|mountain': [2400, null, null, null], 'tank|forest': [2400, null, null, null] });
    expect(s.bestSegments['tank|mountain']).not.toBe(s.bestSegments['tank|forest']); expect(s.pbs).toEqual({});
  });
  it('only improves each stored segment; ties and slower segments keep the old best', () => {
    const s = records(); s.bestSegments['tank|mountain'] = [100, 200, null, null]; s.bestSegments['tank|forest'] = [300, 400, null, null];
    const first = run(); first.runTicks = 200;
    expect(recordSplit(first, 1, s)?.bestSegment).toBe(true);
    expect(s.bestSegments['tank|mountain']?.[0]).toBe(100); expect(s.bestSegments['tank|forest']?.[0]).toBe(200);
    const tied = run(); tied.runTicks = 200; expect(recordSplit(tied, 1, s)?.bestSegment).toBe(false);
    tied.road = 'forest'; tied.runTicks = 700; expect(recordSplit(tied, 2, s)?.bestSegment).toBe(false);
    expect(s.bestSegments['tank|forest']?.[1]).toBe(400);
  });
  it.each(['seeded', 'practice'] as const)('%s runs compare deltas and segments but never write records', (mode) => {
    const r = run(), s = records(); r.seeded = mode === 'seeded'; r.runTicks = 80;
    s.pbs['tank|mountain'] = pb(1000); s.bestSegments['tank|mountain'] = [100, null, null, null];
    const before = structuredClone(s);
    expect(recordSplit(r, 1, s, mode === 'practice')).toEqual({ index: 1, runTicks: 80, segmentTicks: 80, deltaTicks: -20, bestSegment: true });
    expect(s).toEqual(before); expect(r.splits[0]).toBe(80);
  });
  it('records legacy runs without a start kit, with no PB, record write or best flag', () => {
    const r = createRunState('LEGACY'), s = records(); r.runTicks = 120;
    expect(recordSplit(r, 1, s)).toEqual({ index: 1, runTicks: 120, segmentTicks: 120, deltaTicks: null, bestSegment: false });
    expect(s).toEqual(records());
  });
  it('rejects invalid indices and a missing previous split without changing state', () => {
    const r = run(), s = records(); r.runTicks = 100;
    for (const index of [0, 5, -1, 1.5, Number.NaN, 2]) expect(recordSplit(r, index, s)).toBeNull();
    expect(r.splits).toEqual([null, null, null, null]); expect(s).toEqual(records());
  });
  it('does not accept a fifth split if an invalid runtime array grows beyond its typed tuple', () => {
    const r = run(), s = records(); r.splits = [100, 200, 300, 400]; r.splits.push(null); r.runTicks = 500;
    expect(recordSplit(r, 5, s)).toBeNull(); expect(r.splits.at(-1)).toBeNull();
  });
  it('writes later segments only to the chosen road, and leaves other classes alone', () => {
    const r = run(), s = records(); r.road = 'forest'; r.splits = [100, 300, null, null]; r.runTicks = 600;
    s.bestSegments['wizard|forest'] = [1, 2, 3, 4];
    expect(recordSplit(r, 3, s)?.segmentTicks).toBe(300);
    expect(s.bestSegments['tank|forest']).toEqual([null, null, 300, null]);
    expect(s.bestSegments['tank|mountain']).toBeUndefined(); expect(s.bestSegments['wizard|forest']).toEqual([1, 2, 3, 4]);
  });
});

describe('full-run PB saving (06 §5.3)', () => {
  const complete = () => { const r = run(); r.phase = 'runComplete'; r.road = 'forest'; r.splits = [100, 300, 600, 1000]; r.runTicks = 1200; return r; };
  it('saves the final split time under the original class and road with injected date and a copied kit', () => {
    const r = complete(), s = records(), current = kit(), date = '2026-10-17T12:34:56.000Z';
    current.displayName = 'Storm Caller';
    expect(savePersonalBest(r, s, date, current)).toBe(true);
    expect(s.pbs).toEqual({ 'tank|forest': { ticks: 1000, splits: [100, 300, 600, 1000], date, seedText: 'RANDOM', kit: current } });
    r.splits[0] = 999; current.weapons[0]!.grade = 'F'; current.abilities[0]!.level = 1;
    expect(s.pbs['tank|forest']?.splits[0]).toBe(100); expect(s.pbs['tank|forest']?.kit.weapons[0]?.grade).toBe('A');
    expect(s.pbs['tank|forest']?.kit.abilities[0]?.level).toBe(3);
  });
  it('replaces only a strictly slower PB; a tie or slower run changes nothing', () => {
    const r = complete(), s = records(); s.pbs['tank|forest'] = pb(1500);
    expect(savePersonalBest(r, s, 'NEW', kit())).toBe(true);
    const before = structuredClone(s); expect(savePersonalBest(r, s, 'TIE', kit())).toBe(false); expect(s).toEqual(before);
    r.splits[3] = 2000; expect(savePersonalBest(r, s, 'SLOW', kit())).toBe(false); expect(s).toEqual(before);
  });
  it.each(['seeded', 'practice', 'runSoFar', 'dead', 'missingRoad', 'missingKit', 'missingSplit', 'invalidSplit', 'extraSplit'] as const)('refuses %s without changing any records', (mode) => {
    const r = complete(), s = records();
    if (mode === 'seeded') r.seeded = true;
    if (mode === 'runSoFar' || mode === 'dead') r.phase = mode;
    if (mode === 'missingRoad') r.road = null;
    if (mode === 'missingKit') r.startKit = null;
    if (mode === 'missingSplit') r.splits[1] = null;
    if (mode === 'invalidSplit') r.splits[2] = Number.NaN;
    if (mode === 'extraSplit') r.splits.push(1500);
    const before = structuredClone(s);
    expect(savePersonalBest(r, s, 'DATE', kit(), mode === 'practice')).toBe(false); expect(s).toEqual(before);
  });
});
