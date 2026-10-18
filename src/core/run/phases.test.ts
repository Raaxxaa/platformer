import { describe, expect, it } from 'vitest';
import { createRunState, stepClocks, type RunPhase } from './runState.ts';
import { beginTransition, completeLoading, pauseRun, resumeRun, simulatesWorld, stepTransition } from './phases.ts';

describe('full run phases (06 §2.1–2.2, checklist 7–8)', () => {
  it.each<RunPhase>(['title', 'homeVillage', 'loading', 'paused', 'dead', 'runComplete'])('%s does not count run time', (phase) => {
    const r = createRunState('A'); r.phase = phase;
    stepClocks(r);
    expect([r.runTicks, r.stageTicks]).toEqual([0, 0]);
  });
  it.each<RunPhase>(['stage', 'statPick', 'village', 'routeChoice'])('%s counts run time; only stage and statPick count stage time', (phase) => {
    const r = createRunState('A'); r.phase = phase;
    stepClocks(r);
    expect(r.runTicks).toBe(1);
    expect(r.stageTicks).toBe(phase === 'stage' || phase === 'statPick' ? 1 : 0);
  });
  it.each<RunPhase>(['title', 'transition', 'loading', 'statPick', 'routeChoice', 'paused', 'runComplete'])('%s freezes the world', (phase) => {
    expect(simulatesWorld(phase)).toBe(false);
  });
  it.each<RunPhase>(['homeVillage', 'stage', 'village', 'dead'])('%s permits world simulation', (phase) => {
    expect(simulatesWorld(phase)).toBe(true);
  });
  it('stage exit has 60 fade-out ticks, untimed loading, and 60 fade-in ticks', () => {
    const r = createRunState('A');
    beginTransition(r, 'stageExit', { phase: 'village', levelId: 'crossroads', stage: 0 });
    for (let i = 0; i < 59; i++) { stepClocks(r); expect(stepTransition(r)).toBeNull(); }
    stepClocks(r);
    expect(stepTransition(r)).toBe('load');
    expect(r.phase).toBe('loading');
    for (let i = 0; i < 500; i++) stepClocks(r);
    expect(r.runTicks).toBe(60);
    completeLoading(r);
    for (let i = 0; i < 59; i++) { stepClocks(r); expect(stepTransition(r)).toBeNull(); }
    stepClocks(r);
    expect(stepTransition(r)).toBe('arrive');
    expect([r.phase, r.levelId, r.stage, r.runTicks, r.stageTicks]).toEqual(['village', 'crossroads', 0, 120, 0]);
  });
  it.each(['homeGate', 'toHome'] as const)('%s has a full untimed fade', (kind) => {
    const r = createRunState('A');
    beginTransition(r, kind, { phase: kind === 'homeGate' ? 'stage' : 'homeVillage', levelId: kind === 'homeGate' ? 'plains' : 'home', stage: kind === 'homeGate' ? 1 : 0 });
    for (let i = 0; i < 60; i++) { stepClocks(r); stepTransition(r); }
    completeLoading(r);
    for (let i = 0; i < 60; i++) { stepClocks(r); stepTransition(r); }
    expect(r.runTicks).toBe(0);
  });
  it('instant restart is a cut, followed by an untimed 30-tick fade in', () => {
    const r = createRunState('A');
    beginTransition(r, 'restart', { phase: 'stage', levelId: 'plains', stage: 1 });
    expect(r.phase).toBe('loading');
    completeLoading(r);
    for (let i = 0; i < 29; i++) { stepClocks(r); stepTransition(r); }
    expect(r.phase).toBe('transition');
    stepClocks(r); stepTransition(r);
    expect(r.phase).toBe('stage');
    expect(r.runTicks).toBe(0);
  });
  it('pause and resume retain the exact phase and transition counter', () => {
    const r = createRunState('A');
    beginTransition(r, 'sleep', { phase: 'stage', levelId: 'mountains', stage: 2 });
    stepTransition(r);
    const before = structuredClone(r.transition);
    pauseRun(r); pauseRun(r);
    stepClocks(r); stepTransition(r);
    expect(r.phase).toBe('paused');
    expect(r.transition).toEqual(before);
    resumeRun(r);
    expect(r.phase).toBe('transition');
  });
});
