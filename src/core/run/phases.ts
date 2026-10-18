// Pure phase/transition policy (06 §2). The scene acknowledges loading; loading is never timed.
import { RUN } from '../tuning.ts';
import type { LevelId } from '../level/loadLevel.ts';
import type { RunPhase, RunState } from './runState.ts';

export type TransitionKind = 'homeGate' | 'stageExit' | 'sleep' | 'restart' | 'toHome';
export interface PhaseTarget { phase: 'stage' | 'village' | 'homeVillage'; levelId: LevelId; stage: RunState['stage'] }
export interface RunTransition {
  kind: TransitionKind; target: PhaseTarget; part: 'out' | 'in'; left: number; timed: boolean;
}

export function simulatesWorld(phase: RunPhase): boolean {
  return phase === 'stage' || phase === 'homeVillage' || phase === 'village' || phase === 'dead';
}

export function canHoldRestart(phase: RunPhase): boolean {
  return phase === 'stage' || phase === 'statPick' || phase === 'village' || phase === 'routeChoice';
}

export function beginTransition(r: RunState, kind: TransitionKind, target: PhaseTarget): void {
  const cut = kind === 'restart';
  r.transition = { kind, target, part: cut ? 'in' : 'out', left: cut ? RUN.RESTART_FADE_TICKS : RUN.FADE_TICKS,
    timed: kind === 'stageExit' || kind === 'sleep' };
  r.phase = cut ? 'loading' : 'transition';
  r.restartHoldTicks = 0;
}

/** Called only once the scene has its level/assets. No loading duration is guessed by the core. */
export function completeLoading(r: RunState): void {
  const t = r.transition;
  if (r.phase !== 'loading' || !t) return;
  r.levelId = t.target.levelId;
  r.stage = t.target.stage;
  if (t.target.phase === 'stage') {
    r.stageTicks = 0;
    r.sectionReached = 0;
    r.bossDefeatedTick = null;
    r.statPickDone = false;
  }
  t.part = 'in';
  t.left = t.kind === 'restart' ? RUN.RESTART_FADE_TICKS : RUN.FADE_TICKS;
  r.phase = 'transition';
}

/** Run after stepClocks so the last fade tick counts in the phase being left. */
export function stepTransition(r: RunState): 'load' | 'arrive' | null {
  const t = r.transition;
  if (r.phase !== 'transition' || !t || --t.left > 0) return null;
  if (t.part === 'out') { r.phase = 'loading'; return 'load'; }
  r.phase = t.target.phase;
  r.transition = null;
  return 'arrive';
}

export function pauseRun(r: RunState): void {
  if (r.phase === 'paused') return;
  r.pausedFrom = r.phase;
  r.phase = 'paused';
}

export function resumeRun(r: RunState): void {
  if (r.phase !== 'paused' || !r.pausedFrom) return;
  r.phase = r.pausedFrom;
  r.pausedFrom = null;
}
