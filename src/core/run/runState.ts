// The run's state for M3 (06 §2, §5, §16): phases, clocks, splits, arenas and timed doors.
import { fnv1a32 } from '../rng.ts';

export type RunPhaseM3 = 'stage' | 'dead' | 'stageClear';

export interface ArenaRunState { locked: boolean; wave: number; lockTick: number; cleared: boolean; clearTick: number | null }

export interface RunState {
  phase: RunPhaseM3;
  seedText: string; runSeed: number;
  stage: 1; levelId: 'plains';
  runTicks: number; stageTicks: number;
  splits: [number | null, number | null, number | null, number | null];
  deathTick: number | null;
  sectionReached: number;
  arenas: Record<string, ArenaRunState>;
  timedDoors: Record<string, 'pending' | 'open' | 'missed'>;
  restartHoldTicks: number; restartNeedsRelease: boolean;
}

export function createRunState(seedText: string): RunState {
  return {
    phase: 'stage', seedText, runSeed: fnv1a32(seedText), stage: 1, levelId: 'plains',
    runTicks: 0, stageTicks: 0, splits: [null, null, null, null], deathTick: null, sectionReached: 0,
    arenas: {}, timedDoors: {}, restartHoldTicks: 0, restartNeedsRelease: false,
  };
}

/** Both clocks count only in `stage`, hit-stop included (the run logic runs every tick). */
export function stepClocks(r: RunState): void {
  if (r.phase !== 'stage') return;
  r.runTicks += 1;
  r.stageTicks += 1;
}
