import { describe, it, expect } from 'vitest';
import { PlayerSim } from '../sim/playerSim.ts';
import { ticksUntil } from '../testkit/measure.ts';
import { gridFromRects } from '../level/build.ts';
import { MOVEMENT_TEST } from '../../data/levels/movementTest.ts';
import type { MoveEvent } from './body.ts';

/** On the test level, standing against the 80 px ledge (wall face x 384, top y 352). */
function at80Ledge(): PlayerSim {
  const sim = new PlayerSim(MOVEMENT_TEST.grid, { x: 378, y: 432 });
  sim.stepSpec({ moveX: 1 }, 3);
  expect(sim.body.x).toBe(378);
  return sim;
}

/** Jumps holding toward the ledge until the grab; returns the tick count and events. */
function jumpUntilGrab(sim: PlayerSim): { tick: number; vyBefore: number } {
  for (let t = 1; t <= 80; t++) {
    const vyBefore = sim.body.vy;
    if (sim.stepSpec({ moveX: 1, jump: true }).includes('ledgeGrab')) return { tick: t, vyBefore };
  }
  return { tick: -1, vyBefore: 0 };
}

describe('ledge grab (01 §10, checklist 18, 19)', () => {
  it('a full jump beside the 80 px ledge grabs at the apex and stands on it 18 ticks later', () => {
    const sim = at80Ledge();
    const grab = jumpUntilGrab(sim);
    expect(grab.tick).toBeGreaterThan(30);
    expect(grab.vyBefore).toBeLessThan(0);              // the tick it stopped rising
    expect(sim.body.state).toBe('ledgeClimb');
    expect(sim.body.facing).toBe(1);
    expect(sim.body.x + 6).toBe(384);                   // snapped against the wall face
    expect([sim.body.vx, sim.body.vy]).toEqual([0, 0]);
    const events: MoveEvent[] = [];
    for (let i = 1; i <= 17; i++) { events.push(...sim.stepSpec({ moveX: 1, jump: true })); expect(sim.body.state).toBe('ledgeClimb'); }
    events.push(...sim.stepSpec({ moveX: 1, jump: true }));
    expect(sim.body.state).toBe('ground');
    expect(sim.body.y).toBe(352);
    expect(sim.body.x).toBe(392);                       // 8 px past the wall face
    expect(events).not.toContain('ledgeGrab');          // the event fires once
  });
  it('climbs up first (12 ticks), then over (6 ticks)', () => {
    const sim = at80Ledge();
    jumpUntilGrab(sim);
    const y0 = sim.body.y;
    sim.stepSpec({ moveX: 1 }, 12);
    expect(sim.body.y).toBe(352);
    expect(sim.body.x).toBe(378);
    expect(y0).toBeGreaterThan(352);
    sim.stepSpec({ moveX: 1 }, 3);
    expect(sim.body.x).toBe(385);
  });
  it('the 96 px ledge cannot be reached with one jump (checklist 19)', () => {
    const sim = new PlayerSim(MOVEMENT_TEST.grid, { x: 490, y: 432 });
    const ev = sim.stepSpec({ moveX: 1, jump: true }, 200);
    expect(ev).not.toContain('ledgeGrab');
    expect(sim.body.y).toBe(432);
  });
  it('the 96 px ledge can be reached with jump + double jump', () => {
    // Jump straight up 10 px from the wall (out of wall-jump range), double jump at the apex, drift in.
    const sim = new PlayerSim(MOVEMENT_TEST.grid, { x: 480, y: 432 });
    ticksUntil(sim, { jump: true }, (b) => b.vy >= 0);
    sim.stepSpec({});
    expect(sim.stepSpec({ moveX: 1, jump: true })).toContain('doubleJump');
    ticksUntil(sim, { moveX: 1, jump: true }, (b) => b.state === 'ground');
    expect(sim.body.state).toBe('ground');
    expect(sim.body.y).toBe(336);
    expect(sim.body.x).toBeGreaterThan(496);
  });
  it('grabs when the apex leaves the feet 10 px below the wall top (checklist 18)', () => {
    // wall face x 320, top y 304 (tile row 19); a mid-air double jump (40 px) from y 354 peaks at feet 314.
    // Start 4 px from the wall (out of wall-jump range) and drift into it while rising.
    const g = gridFromRects(40, 30, [{ x0: 0, y0: 27, x1: 39, y1: 29, kind: 'solid' }, { x0: 20, y0: 19, x1: 25, y1: 26, kind: 'solid' }]);
    const sim = new PlayerSim(g, { x: 310, y: 354 });
    let grabbedAt = -1, minY = 999;
    for (let t = 1; t <= 40 && grabbedAt < 0; t++) {
      if (sim.stepSpec({ moveX: 1, jump: true }).includes('ledgeGrab')) grabbedAt = sim.body.y;
      else minY = Math.min(minY, sim.body.y);
    }
    expect(minY).toBe(314);
    expect(grabbedAt).toBe(314);
    sim.stepSpec({ moveX: 1 }, 18);
    expect(sim.body.state).toBe('ground');
    expect([sim.body.x, sim.body.y]).toEqual([328, 304]);
  });
  it('no grab when a ceiling leaves no room to stand above the ledge', () => {
    // 80 px ledge (top 352) with a ceiling whose bottom is 16 px above it
    const g = gridFromRects(60, 30, [
      { x0: 0, y0: 27, x1: 59, y1: 29, kind: 'solid' },
      { x0: 24, y0: 22, x1: 27, y1: 26, kind: 'solid' },
      { x0: 23, y0: 20, x1: 28, y1: 20, kind: 'solid' },
    ]);
    const sim = new PlayerSim(g, { x: 378, y: 432 });
    expect(sim.stepSpec({ moveX: 1, jump: true }, 60)).not.toContain('ledgeGrab');
  });
  it('a jump during the climb snaps to the standing spot and does a ground jump at run speed', () => {
    const sim = at80Ledge();
    jumpUntilGrab(sim);
    sim.stepSpec({ moveX: 1 }, 4);
    const ev = sim.stepSpec({ moveX: 1, jump: true });
    expect(ev).toContain('jump');
    expect(sim.body.state).toBe('air');
    expect(sim.body.vx).toBe(170);
    expect(sim.body.y).toBeLessThan(352);
    expect(sim.body.x).toBeGreaterThanOrEqual(392);
  });
  it('a dash during the climb snaps to the standing spot and does a ground dash', () => {
    const sim = at80Ledge();
    jumpUntilGrab(sim);
    sim.stepSpec({ moveX: 1 }, 4);
    expect(sim.stepSpec({ moveX: 1, dash: true })).toContain('dashStart');
    expect(sim.body.state).toBe('dash');
    expect(sim.body.y).toBe(352);
    expect(sim.body.vx).toBe(400);
    expect(sim.body.grounded).toBe(true);
  });
  it('a ground dash into a 1-tile step grabs and climbs it', () => {
    const g = gridFromRects(40, 30, [{ x0: 0, y0: 27, x1: 39, y1: 29, kind: 'solid' }, { x0: 20, y0: 26, x1: 25, y1: 26, kind: 'solid' }]);
    const sim = new PlayerSim(g, { x: 280, y: 432 });
    sim.stepSpec({ moveX: 1, dash: true });
    const ev = sim.stepSpec({ moveX: 1 }, 18);
    expect(ev).toEqual(expect.arrayContaining(['dashEnd', 'ledgeGrab']));
    sim.stepSpec({ moveX: 1 }, 18);
    expect(sim.body.y).toBe(416);
  });
  it('walking into a 1-tile step does not grab', () => {
    const g = gridFromRects(40, 30, [{ x0: 0, y0: 27, x1: 39, y1: 29, kind: 'solid' }, { x0: 20, y0: 26, x1: 25, y1: 26, kind: 'solid' }]);
    const sim = new PlayerSim(g, { x: 280, y: 432 });
    expect(sim.stepSpec({ moveX: 1 }, 60)).not.toContain('ledgeGrab');
    expect(sim.body.y).toBe(432);
  });
  it('no grab while rooted', () => {
    const sim = at80Ledge();
    sim.stepSpec({ moveX: 1, jump: true }, 20);
    sim.mods.rooted = true;
    expect(sim.stepSpec({ moveX: 1, jump: true }, 40)).not.toContain('ledgeGrab');
  });
});
