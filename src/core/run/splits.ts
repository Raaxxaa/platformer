// Cumulative splits, best segments and completed-run PBs (06 §5.2–5.3). No I/O or clock.
import type { KitSummary, PbKey, PbRecord, SaveData } from '../save/schema.ts';
import { RUN } from '../tuning.ts';
import type { RunState } from './runState.ts';

export type RunRecords = Pick<SaveData, 'pbs' | 'bestSegments'>;
export interface SplitResult { index: number; runTicks: number; segmentTicks: number; deltaTicks: number | null; bestSegment: boolean }

/** Before choosing a road, compare the starting class's faster completed run. */
export function comparisonPb(run: Pick<RunState, 'startKit' | 'road'>, records: RunRecords): PbRecord | null {
  const cls = run.startKit?.cls; if (!cls) return null;
  if (run.road) return records.pbs[`${cls}|${run.road}`] ?? null;
  const mountain = records.pbs[`${cls}|mountain`], forest = records.pbs[`${cls}|forest`];
  if (!mountain) return forest ?? null;
  if (!forest) return mountain;
  return mountain.ticks <= forest.ticks ? mountain : forest;
}

function segmentKeys(run: RunState, index: number): PbKey[] {
  const cls = run.startKit?.cls; if (!cls) return [];
  if (index === 1) return [`${cls}|mountain`, `${cls}|forest`];
  return run.road ? [`${cls}|${run.road}`] : [];
}

/** The phase owner calls once on a stage boss's death tick; indices are one-based. */
export function recordSplit(run: RunState, index: number, records: RunRecords, practice = false): SplitResult | null {
  if (!Number.isInteger(index) || index < 1 || index > RUN.STAGE_COUNT || index > run.splits.length) return null;
  const at = index - 1;
  if (run.splits[at] !== null) return null;
  const previous = at === 0 ? 0 : run.splits[at - 1]; if (previous === null) return null;
  const segmentTicks = run.runTicks - previous, comparison = comparisonPb(run, records);
  const keys = segmentKeys(run, index);
  const improved = keys.filter((key) => {
    const old = records.bestSegments[key]?.[at]; return old === undefined || old === null || segmentTicks < old;
  });
  run.splits[at] = run.runTicks;
  if (!run.seeded && !practice) {
    for (const key of improved) {
      const values = records.bestSegments[key] ?? run.splits.map(() => null) as NonNullable<RunRecords['bestSegments'][PbKey]>;
      values[at] = segmentTicks; records.bestSegments[key] = values;
    }
  }
  return { index, runTicks: run.runTicks, segmentTicks, deltaTicks: comparison ? run.runTicks - comparison.splits[at] : null, bestSegment: improved.length > 0 };
}

/** Saves only a fully completed, counting run. Date is supplied by the game layer. */
export function savePersonalBest(run: RunState, records: RunRecords, date: string, kit: KitSummary, practice = false): boolean {
  if (run.phase !== 'runComplete' || run.seeded || practice || !run.road || !run.startKit) return false;
  if (run.splits.length !== RUN.STAGE_COUNT || run.splits.some((value) => value === null || !Number.isFinite(value))) return false;
  const splits = run.splits as PbRecord['splits'], ticks = splits[splits.length - 1];
  const key: PbKey = `${run.startKit.cls}|${run.road}`, old = records.pbs[key];
  if (old && ticks >= old.ticks) return false;
  records.pbs[key] = {
    ticks, splits: [...splits], date, seedText: run.seedText,
    kit: { displayName: kit.displayName, weapons: kit.weapons.map((weapon) => weapon ? { ...weapon } : null), abilities: kit.abilities.map((ability) => ability ? { ...ability } : null) },
  };
  return true;
}
