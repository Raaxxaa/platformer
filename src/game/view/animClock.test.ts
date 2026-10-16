import { describe, it, expect } from 'vitest';
import { AnimClock, phaseFrame, runFps, timeFrame, type AnimDef } from './animClock.ts';

const loop: AnimDef = { key: 'x_idle', atlas: 'a', frames: ['0', '1', '2', '3'], mode: 'loop', fps: 6 };
const once: AnimDef = { key: 'x_death', atlas: 'a', frames: ['0', '1', '2', '3'], mode: 'once', fps: 10 };
const atk: AnimDef = { key: 'x_atk', atlas: 'a', frames: ['0', '1', '2', '3', '4', '5'], mode: 'phase', segments: [
  { phase: 'tele', frames: [0, 1] }, { phase: 'act', frames: [2, 3], loopFps: 12 }, { phase: 'rec', frames: [4, 5] }] };

describe('animation clocks (08 §5.1)', () => {
  it('loop wraps and once holds the last frame', () => {
    expect(timeFrame(loop, 0)).toBe(0);
    expect(timeFrame(loop, 0.5)).toBe(3);
    expect(timeFrame(loop, 0.7)).toBe(0);
    expect(timeFrame(once, 0.25)).toBe(2);
    expect(timeFrame(once, 9)).toBe(3);
  });
  it('phase anims split each phase evenly over its frames', () => {
    expect(phaseFrame(atk, 'tele', 0, 54)).toBe(0);
    expect(phaseFrame(atk, 'tele', 27, 54)).toBe(1);
    expect(phaseFrame(atk, 'tele', 54, 54)).toBe(1);
    expect(phaseFrame(atk, 'rec', 10, 48)).toBe(4);
  });
  it('a looping act segment cycles at its own fps; a by-vy segment picks rising or falling', () => {
    expect(phaseFrame(atk, 'act', 0, 100)).toBe(2);
    expect(phaseFrame(atk, 'act', 10, 100)).toBe(3);                // 10 ticks at 12 fps = frame 1
    expect(phaseFrame(atk, 'act', 20, 100)).toBe(2);
    const leap: AnimDef = { ...atk, segments: [{ phase: 'act', frames: [2, 3], byVy: true }] };
    expect(phaseFrame(leap, 'act', 5, 100, -50)).toBe(2);
    expect(phaseFrame(leap, 'act', 5, 100, 50)).toBe(3);
  });
  it('run speed: 14 fps at 170 px/s, clamped to 8–24', () => {
    expect(runFps(170)).toBe(14);
    expect(runFps(10)).toBe(8);
    expect(runFps(1000)).toBe(24);
  });
});

describe('V1 Task 2 pins', () => {
  it('a 3-frame Tele segment at 50% progress shows frame 1', () => {
    const d: AnimDef = { key: 'k', atlas: 'a', frames: ['0', '1', '2', '3'], mode: 'phase', segments: [{ phase: 'tele', frames: [0, 1, 2] }, { phase: 'act', frames: [3] }] };
    expect(phaseFrame(d, 'tele', 30, 60)).toBe(1);
  });
  it('frames do not advance while the entity is in hit-stop', () => {
    const c = new AnimClock();
    c.advance('idle', 0, false);
    c.advance('idle', 12, false);
    expect(c.t).toBeCloseTo(0.1);
    expect(c.advance('idle', 24, true)).toBe(0);
    expect(c.t).toBeCloseTo(0.1);
    c.advance('idle', 36, false);
    expect(c.t).toBeCloseTo(0.2);
  });
  it('a new key restarts the clock', () => {
    const c = new AnimClock();
    c.advance('idle', 0, false); c.advance('idle', 60, false);
    c.advance('run', 61, false);
    expect(c.t).toBe(0);
  });
});
