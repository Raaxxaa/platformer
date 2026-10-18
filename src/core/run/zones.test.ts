import { describe, it, expect } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { feet, levelFrom, rect } from '../testkit/levelData.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { timedDoorTimeLeft } from './timedDoors.ts';

/** 60 × 12 tiles, floor at row 10. Timed door td1 at x 30 (rows 7–9), side left; hint `dash` x 4–8; sections 1 (x 0–19) and 2 (x 20–59); exit x 56–58. */
function zoneLevel() {
  const rows = Array.from({ length: 12 }, (_, y) => (y >= 10 ? '#'.repeat(60) : '#' + '.'.repeat(58) + '#'));
  return levelFrom(rows, [
    feet('player_start', 2, 9),
    rect('timed_door', 30, 7, 1, 3, { id: 'td1', side: 'left', timeLimit: 120 }),
    rect('hint', 4, 6, 5, 4, { action: 'dash' }),
    rect('section', 0, 0, 20, 12, { index: 1 }),
    rect('section', 20, 0, 40, 12, { index: 2 }),
    rect('exit', 56, 7, 3, 3),
  ]);
}
const world = () => GameWorld.fromLevel(zoneLevel(), { seedText: 'A' });
/** Walks right until the player's center x reaches `x`. */
const walkTo = (w: GameWorld, x: number) => { for (let i = 0; i < 2000 && w.body.x < x; i++) stepSpec(w, { moveX: 1 }); };

describe('timed doors (06 §9.5, test 17)', () => {
  it('opens when entered at stageTicks 14 400', () => {
    const w = world();
    walkTo(w, 400);
    w.run.stageTicks = 14400 - 1;               // the step adds one before the check
    const ev = stepSpec(w, { moveX: 1 });
    // The trigger is the 48 px strip left of the door: x 432–480. Walk into it.
    let opened = ev.some((e) => e.t === 'timedDoorOpened');
    for (let i = 0; i < 200 && !opened; i++) {
      w.run.stageTicks = 14400 - 1;
      opened = stepSpec(w, { moveX: 1 }).some((e) => e.t === 'timedDoorOpened');
    }
    expect(opened).toBe(true);
    expect(w.run.timedDoors.td1).toBe('open');
    expect(w.bodies.get('td1')!.active).toBe(false);
  });
  it('stays shut when entered at 14 401', () => {
    const w = world();
    walkTo(w, 400);
    let missed = false;
    for (let i = 0; i < 200 && !missed; i++) {
      w.run.stageTicks = 14400;
      missed = stepSpec(w, { moveX: 1 }).some((e) => e.t === 'timedDoorMissed');
    }
    expect(missed).toBe(true);
    expect(w.run.timedDoors.td1).toBe('missed');
    expect(w.bodies.get('td1')!.active).toBe(true);
    w.run.stageTicks = 0;
    stepSpec(w, { moveX: -1 }, 30); stepSpec(w, { moveX: 1 }, 60);
    expect(w.run.timedDoors.td1).toBe('missed');      // decided for the rest of the stage
  });
  it('shows the seconds left before it is decided, never below 0', () => {
    const w = world();
    w.run.stageTicks = 1200;
    expect(timedDoorTimeLeft(w, 'td1')).toBe(110);
    w.run.stageTicks = 20000;
    expect(timedDoorTimeLeft(w, 'td1')).toBe(0);
  });
});

describe('hints, sections and exit (06 §13.4)', () => {
  it('entering hint zone dash sets activeHint; leaving clears it', () => {
    const w = world();
    expect(w.activeHint).toBeNull();
    walkTo(w, 5 * 16);
    expect(w.activeHint).toBe('dash');
    walkTo(w, 10 * 16);
    expect(w.activeHint).toBeNull();
  });
  it('sectionReached only goes up', () => {
    const w = world();
    stepSpec(w, {});
    expect(w.run.sectionReached).toBe(1);
    walkTo(w, 22 * 16);
    expect(w.run.sectionReached).toBe(2);
    for (let i = 0; i < 300; i++) stepSpec(w, { moveX: -1 });
    expect(w.body.x).toBeLessThan(20 * 16);
    expect(w.run.sectionReached).toBe(2);
  });
  it('the exit is ignored before the boss and choice, then starts the village transition', () => {
    const w = world();
    w.bodies.setActive('td1', false);
    walkTo(w, 57 * 16);
    expect(w.run.phase).toBe('stage');
    w.run.splits[0] = 1234;
    stepSpec(w, {});
    expect(w.run.phase).toBe('stage');
    w.run.statPickDone = true;
    stepSpec(w, {});
    expect(w.run.phase).toBe('transition');
    expect(w.run.transition?.target.levelId).toBe('crossroads');
  });
});
