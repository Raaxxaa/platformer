import { describe, it, expect } from 'vitest';
import { PlayerSim } from '../sim/playerSim.ts';
import { flatWorld } from '../testkit/worlds.ts';
import { ticksUntil } from '../testkit/measure.ts';
import { gridFromRects } from '../level/build.ts';
import { MOVEMENT_TEST } from '../../data/levels/movementTest.ts';
import { refundDash } from './dash.ts';
import type { MoveEvent } from './body.ts';

function simOnFlat(x = 200): PlayerSim {
  const sim = new PlayerSim(flatWorld(), { x, y: 432 });
  sim.stepSpec({}, 2);
  return sim;
}

describe('dash (01 §7, checklist 5, 6, 9)', () => {
  it('a ground dash moves exactly 60 px over 18 ticks with i-frames on exactly those ticks', () => {
    const sim = simOnFlat();
    const x0 = sim.body.x;
    const ev = sim.stepSpec({ dash: true });
    expect(ev).toContain('dashStart');
    expect(sim.body.state).toBe('dash');
    const iframes: boolean[] = [sim.body.dashIframes];
    for (let i = 2; i <= 18; i++) { sim.stepSpec({}); iframes.push(sim.body.dashIframes); }
    expect(sim.body.x - x0).toBe(60);
    expect(iframes.every(Boolean)).toBe(true);
    const ev19 = sim.stepSpec({});
    expect(ev19).toContain('dashEnd');
    expect(sim.body.dashIframes).toBe(false);
    expect(sim.body.state).toBe('ground');
  });
  it('dash distance is still 60 px with +45% move speed', () => {
    const sim = simOnFlat();
    sim.mods.speedPercents = [0.45];
    const x0 = sim.body.x;
    sim.stepSpec({ dash: true }); sim.stepSpec({}, 17);
    expect(sim.body.x - x0).toBe(60);
  });
  it('goes the way of moveX, else the way the player faces', () => {
    const sim = simOnFlat();
    sim.stepSpec({ moveX: -1 }); sim.stepSpec({}, 20);
    sim.stepSpec({ dash: true });
    expect(sim.body.vx).toBe(-400);
    expect(sim.body.facing).toBe(-1);
  });
  it('an air dash keeps vy 0 and y unchanged on every dash tick', () => {
    const sim = simOnFlat();
    sim.stepSpec({ jump: true }, 10);
    sim.stepSpec({ dash: true, moveX: 1 });
    const y0 = sim.body.y;
    expect(sim.body.vy).toBe(0);
    expect(sim.body.airDashAvailable).toBe(false);
    for (let i = 2; i <= 18; i++) {
      sim.stepSpec({ moveX: 1 });
      expect(sim.body.vy).toBe(0);
      expect(sim.body.y).toBe(y0);
    }
    sim.stepSpec({ moveX: 1 });
    expect(sim.body.state).toBe('air');
  });
  it('a second air dash in the same airtime is refused; after landing a dash waits for the 42-tick cooldown (checklist 7)', () => {
    const sim = simOnFlat();
    sim.stepSpec({ jump: true }, 8);
    sim.stepSpec({ dash: true, jump: true });
    ticksUntil(sim, { jump: true }, (b) => b.state !== 'dash');
    const endPt = sim.body.pt;
    expect(sim.body.dashReadyPt).toBe(endPt + 42);
    // a fresh press in the air: refused (no air dash), even once the cooldown is over
    let starts = 0;
    for (let i = 0; i < 60 && sim.body.state !== 'ground'; i++) {
      starts += sim.stepSpec({ dash: i % 2 === 0 }).filter((e) => e === 'dashStart').length;
    }
    expect(starts).toBe(0);
    expect(sim.body.state).toBe('ground');
    expect(sim.body.pt).toBeLessThan(endPt + 42);
    let firstDashPt = -1;
    for (let i = 0; i < 80 && firstDashPt < 0; i++) {
      if (sim.stepSpec({ dash: i % 2 === 0 }).includes('dashStart')) firstDashPt = sim.body.pt;
    }
    expect(firstDashPt).toBe(endPt + 42);
  });
  it('buffer: a press 6 ticks before the cooldown ends fires on the first ready tick; 13 ticks before does not (checklist 8)', () => {
    for (const early of [6, 13]) {
      const sim = simOnFlat(100);
      sim.stepSpec({ dash: true }); sim.stepSpec({}, 18);
      const ready = sim.body.dashReadyPt;
      while (sim.body.pt < ready - early - 1) sim.stepSpec({});
      sim.stepSpec({ dash: true });
      expect(sim.body.pt).toBe(ready - early);
      let startPt = -1;
      for (let i = 0; i < 40; i++) if (sim.stepSpec({}).includes('dashStart')) startPt = sim.body.pt;
      expect(startPt).toBe(early === 6 ? ready : -1);
    }
  });
  it('never slows you down: vx = dir × max(400, speed already going that way)', () => {
    const sim = simOnFlat();
    sim.body.vx = 500;
    sim.stepSpec({ moveX: 1, dash: true });
    expect(sim.body.vx).toBe(500);
    expect(sim.body.preDashSpeed).toBe(500);
    const sim2 = simOnFlat();
    sim2.body.vx = 300;
    sim2.stepSpec({ moveX: 1, dash: true });
    expect(sim2.body.vx).toBe(400);
    const sim3 = simOnFlat();
    sim3.body.vx = 500;
    sim3.stepSpec({ moveX: -1, dash: true });   // the other way: no carry
    expect(sim3.body.vx).toBe(-400);
  });
  it('the natural end clamps |vx| to max(run max, pre-dash speed)', () => {
    const sim = simOnFlat();
    sim.stepSpec({ moveX: 1, dash: true }); sim.stepSpec({ moveX: 1 }, 17);
    expect(sim.body.vx).toBe(400);
    sim.stepSpec({ moveX: 1 });
    expect(sim.body.vx).toBeLessThanOrEqual(170);
  });
  it('a dash-jump on dash tick 1 lands 136-140 px from the jump point (checklist 14)', () => {
    const sim = simOnFlat(100);
    const x0 = sim.body.x;
    const ev = sim.stepSpec({ moveX: 1, dash: true, jump: true });
    expect(ev).toEqual(expect.arrayContaining(['dashStart', 'dashEnd', 'jump']));
    expect(sim.body.dashIframes).toBe(false);
    expect(sim.body.dashReadyPt).toBe(sim.body.pt + 42);
    ticksUntil(sim, { moveX: 1, jump: true }, (b) => b.state === 'ground');
    const d = sim.body.x - x0;
    expect(d).toBeGreaterThanOrEqual(136);
    expect(d).toBeLessThanOrEqual(140);
  });
  it('hitting a wall ends the dash with vx 0 and starts the cooldown', () => {
    const g = gridFromRects(40, 30, [{ x0: 0, y0: 27, x1: 39, y1: 29, kind: 'solid' }, { x0: 20, y0: 0, x1: 20, y1: 26, kind: 'solid' }]);
    const sim = new PlayerSim(g, { x: 300, y: 432 });
    sim.stepSpec({ dash: true, moveX: 1 });
    let ev: MoveEvent[] = [];
    for (let i = 0; i < 18 && sim.body.state === 'dash'; i++) ev = sim.stepSpec({});
    expect(ev).toContain('dashEnd');
    expect(sim.body.state).toBe('ground');
    expect(sim.body.vx).toBe(0);
    expect(sim.body.x + 6).toBe(320);
    expect(sim.body.dashReadyPt).toBe(sim.body.pt + 42);
  });
  it('a ground dash off a ledge continues straight without using the air dash; coyote starts', () => {
    const g = gridFromRects(40, 30, [{ x0: 0, y0: 20, x1: 9, y1: 20, kind: 'solid' }, { x0: 0, y0: 27, x1: 39, y1: 29, kind: 'solid' }]);
    const sim = new PlayerSim(g, { x: 150, y: 320 });
    sim.stepSpec({ dash: true, moveX: 1 });
    for (let i = 0; i < 17; i++) { sim.stepSpec({}); expect(sim.body.y).toBe(320); }
    expect(sim.body.grounded).toBe(false);
    expect(sim.body.airDashAvailable).toBe(true);
    expect(sim.body.coyoteValid).toBe(true);
  });
  it('dashCooldownMult 0.8 → 34 ticks, 1.6 → 67, 2 → 84 (checklist 35)', () => {
    for (const [mult, cd] of [[1, 42], [0.8, 34], [1.6, 67], [2, 84]]) {
      const sim = simOnFlat();
      sim.mods.dashCooldownMult = mult;
      sim.stepSpec({ dash: true }); sim.stepSpec({}, 18);
      expect(sim.body.dashReadyPt - sim.body.pt).toBe(cd);
    }
  });
  it('refundDash makes a dash available right away', () => {
    const sim = simOnFlat();
    sim.stepSpec({ jump: true }, 6);
    sim.stepSpec({ dash: true, jump: true }); sim.stepSpec({ jump: true }, 18);
    expect(sim.body.airDashAvailable).toBe(false);
    refundDash(sim.body);
    expect(sim.body.airDashAvailable).toBe(true);
    expect(sim.body.dashReadyPt).toBe(sim.body.pt);
    expect(sim.stepSpec({ dash: true })).toContain('dashStart');
  });
  it('is refused when canDash is false or rooted', () => {
    const sim = simOnFlat();
    sim.mods.canDash = false;
    expect(sim.stepSpec({ dash: true })).toEqual([]);
    const sim2 = simOnFlat();
    sim2.mods.rooted = true;
    expect(sim2.stepSpec({ dash: true })).toEqual([]);
  });
});

describe('slide and crawl (01 §9, checklist 10, 11)', () => {
  it('down + dash on the ground slides 99 px over 36 ticks with a 12 × 14 box', () => {
    const sim = simOnFlat();
    const x0 = sim.body.x;
    const ev = sim.stepSpec({ moveY: 1, dash: true });
    expect(ev).toContain('slideStart');
    expect(sim.body.state).toBe('slide');
    expect(sim.body.h).toBe(14);
    const ifr: boolean[] = [sim.body.dashIframes];
    for (let i = 2; i <= 36; i++) { sim.stepSpec({}); expect(sim.body.h).toBe(14); ifr.push(sim.body.dashIframes); }
    expect(sim.body.x - x0).toBe(99);
    expect(ifr.filter(Boolean).length).toBe(18);
    expect(ifr.slice(0, 18).every(Boolean)).toBe(true);
    const end = sim.stepSpec({});
    expect(end).toContain('slideEnd');
    expect(sim.body.state).toBe('ground');
    expect(sim.body.h).toBe(28);
    expect(sim.body.dashReadyPt).toBe(sim.body.pt + 42);
  });
  it('slides into the test level tunnel, crawls at 80 px/s, and stands up the first tick it fits', () => {
    const sim = new PlayerSim(MOVEMENT_TEST.grid, { x: 600, y: 432 });
    sim.stepSpec({ moveX: 1, moveY: 1, dash: true });
    sim.stepSpec({ moveX: 1 }, 35);
    expect(sim.body.x).toBe(699);
    sim.stepSpec({ moveX: 1 });
    expect(sim.body.state).toBe('crawl');                // standing up refused under the ceiling
    expect(sim.body.h).toBe(14);
    sim.stepSpec({ moveX: 1 }, 20);
    expect(sim.body.vx).toBe(80);
    const n = ticksUntil(sim, { moveX: 1 }, (b) => b.state !== 'crawl', 300);
    expect(n).toBeGreaterThan(0);
    expect(sim.body.state).toBe('ground');
    expect(sim.body.h).toBe(28);
    expect(sim.body.x).toBe(774);                       // first x where the 28 px box clears the ceiling (768)
  });
  it('a jump is refused in crawl and stays buffered until the player stands', () => {
    const sim = new PlayerSim(MOVEMENT_TEST.grid, { x: 600, y: 432 });
    sim.stepSpec({ moveX: 1, moveY: 1, dash: true });
    ticksUntil(sim, { moveX: 1 }, (b) => b.state === 'crawl' && b.x >= 767);
    expect(sim.stepSpec({ moveX: 1, jump: true })).not.toContain('jump');
    expect(sim.body.state).toBe('crawl');
    let groundTick = -1, jumpTick = -1;
    for (let t = 1; t <= 20; t++) {
      const ev = sim.stepSpec({ moveX: 1, jump: true });
      if (groundTick < 0 && sim.body.state === 'ground') groundTick = t;
      if (ev.includes('jump')) jumpTick = t;
    }
    expect(groundTick).toBeGreaterThan(0);
    expect(jumpTick).toBe(groundTick + 1);
  });
  it('a slide-jump keeps the slide speed when there is room to stand', () => {
    const sim = simOnFlat();
    sim.stepSpec({ moveX: 1, moveY: 1, dash: true }); sim.stepSpec({ moveX: 1 }, 3);
    const ev = sim.stepSpec({ moveX: 1, jump: true });
    expect(ev).toEqual(expect.arrayContaining(['slideEnd', 'jump']));
    expect(sim.body.h).toBe(28);
    expect(sim.body.vx).toBeGreaterThan(320);
  });
  it('sliding off a ledge ends the slide in the air with speed kept and coyote time', () => {
    const g = gridFromRects(40, 30, [{ x0: 0, y0: 20, x1: 9, y1: 20, kind: 'solid' }, { x0: 0, y0: 27, x1: 39, y1: 29, kind: 'solid' }]);
    const sim = new PlayerSim(g, { x: 150, y: 320 });
    sim.stepSpec({ moveY: 1, dash: true, moveX: 1 });
    let ev: MoveEvent[] = [];
    for (let i = 0; i < 10 && sim.body.state === 'slide'; i++) ev = sim.stepSpec({ moveX: 1 });
    expect(ev).toContain('slideEnd');
    expect(sim.body.state).toBe('air');
    expect(sim.body.vx).toBe(330);
    expect(sim.body.coyoteValid).toBe(true);
    sim.stepSpec({ moveX: 1 });
    expect(sim.body.h).toBe(28);     // box regrows once it fits
  });
  it('a dash from crawl is a new slide (down not needed)', () => {
    const sim = new PlayerSim(MOVEMENT_TEST.grid, { x: 600, y: 432 });
    sim.stepSpec({ moveX: 1, moveY: 1, dash: true });
    ticksUntil(sim, { moveX: 1 }, (b) => b.state === 'crawl');
    ticksUntil(sim, { moveX: 1 }, (b) => b.pt >= b.dashReadyPt);
    expect(sim.stepSpec({ moveX: 1, dash: true })).toContain('slideStart');
  });
});
