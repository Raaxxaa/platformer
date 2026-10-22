import { rollLayout, type RunLayout } from './layout.ts';
// Run phases and clocks (06 §2, §5, §16). No clock, storage or random source lives here.
import { deriveSeed, fnv1a32, Rng } from '../rng.ts';
import { rollDragon, type DragonRoll } from './dragonRoll.ts';
import type { LevelId } from '../level/loadLevel.ts';
import type { RunTransition } from './phases.ts';
import type { Road, RunStats, StartKit } from '../save/schema.ts';
import { defaultRunStats } from '../../data/save.ts';
import type { BlueprintId } from '../loot/blueprints.ts';

export type RunPhase = 'title' | 'homeVillage' | 'transition' | 'loading' | 'stage' | 'statPick'
  | 'village' | 'routeChoice' | 'dead' | 'runComplete' | 'runSoFar' | 'paused';

export interface ArenaRunState { locked: boolean; wave: number; lockTick: number; cleared: boolean; clearTick: number | null }

export interface RunState {
  phase: RunPhase;
  pausedFrom: Exclude<RunPhase, 'paused'> | null;
  transition: RunTransition | null;
  seedText: string; runSeed: number;
  seeded: boolean;
  startKit: StartKit | null;
  started: boolean;
  endRecorded: boolean;
  stats: RunStats;
  goldEarnedTenths: number;
  lootUnlocked: BlueprintId[];
  blueprintsDropped: BlueprintId[];
  dragon: DragonRoll;
  road: Road | null;
  stage: 0 | 1 | 2 | 3 | 4; levelId: LevelId;
  /** 06 §8.7: the picked section versions per stage. */
  layout: RunLayout;
  runTicks: number; stageTicks: number;
  splits: [number | null, number | null, number | null, number | null];
  deathTick: number | null;
  sectionReached: number;
  arenas: Record<string, ArenaRunState>;
  timedDoors: Record<string, 'pending' | 'open' | 'missed'>;
  restartHoldTicks: number; restartNeedsRelease: boolean;
  /** Simulation tick of the Guardian death; statPick starts 120 ticks later. */
  bossDefeatedTick: number | null;
  statPickDone: boolean;
  /** What beating the Enemy King unlocked, for the victory screen (05 §14.2, §14.3). */
  winUnlocks: { blueprint: string | null; startWeapon: string | null };
}

export function createRunState(seedText: string, seeded = false): RunState {
  const runSeed = fnv1a32(seedText), dragonRng = new Rng(deriveSeed(runSeed, 'dragon', 'run'));
  return {
    phase: 'stage', pausedFrom: null, transition: null, seedText, runSeed, seeded, startKit: null, started: false, endRecorded: false, stats: defaultRunStats(), goldEarnedTenths: 0, lootUnlocked: [], blueprintsDropped: [], road: null, stage: 1, levelId: 'plains',
    dragon: rollDragon(() => dragonRng.next()), layout: rollLayout(runSeed), runTicks: 0, stageTicks: 0, splits: [null, null, null, null], deathTick: null, sectionReached: 0,
    arenas: {}, timedDoors: {}, restartHoldTicks: 0, restartNeedsRelease: false,
    bossDefeatedTick: null, statPickDone: false, winUnlocks: { blueprint: null, startWeapon: null },
  };
}

/** Phase clocks count even when world simulation is frozen (06 §5.1). */
export function stepClocks(r: RunState): void {
  if (r.phase === 'stage' || r.phase === 'statPick') { r.runTicks += 1; r.stageTicks += 1; }
  else if (r.phase === 'village' || r.phase === 'routeChoice' || (r.phase === 'transition' && r.transition?.timed)) r.runTicks += 1;
}
