import { describe, it, expect } from 'vitest';
import { PlayerSim } from '../sim/playerSim.ts';
import { flatWorld } from '../testkit/worlds.ts';
import { ticksUntil, peakRise } from '../testkit/measure.ts';
import { gridFromRects } from '../level/build.ts';
import { MOVEMENT_TEST } from '../../data/levels/movementTest.ts';
import { MOVE, TICK } from '../tuning.ts';
import { onDiveHit } from './dive.ts';
import type { MoveEvent } from './body.ts';

function inAir(y = 200): PlayerSim {
  return new PlayerSim(flatWorld(), { x: 300, y });
}

describe('dive slam (01 §11, checklist 21)', () => {
  it('down + attack1 in the air hovers 6 ticks, then falls at 600 px/s', () => {
    const sim = inAir();
    sim.body.vx = 120;
    const ev = sim.stepSpec({ moveY: 1, attack1: true });
    expect(ev).toContain('diveStart');
    expect(sim.body.state).toBe('diveWindup');
    const y0 = sim.body.y;
    for (let i = 2; i <= 6; i++) {
      sim.stepSpec({ moveY: 1, moveX: 1 });
      expect(sim.body.state).toBe('diveWindup');
      expect([sim.body.vx, sim.body.vy, sim.body.y]).toEqual([0, 0, y0]);
    }
    sim.stepSpec({ moveX: 1 });
    expect(sim.body.state).toBe('diveFall');
    expect(sim.body.vy).toBe(600);
    expect(sim.body.vx).toBe(0);
    sim.stepSpec({ moveX: 1 });
    expect(sim.body.y - y0).toBe(10);                  // 5 px per tick, no steering
  });
  it('lands into diveLand for 12 ticks, then ground', () => {
    const sim = inAir();
    sim.stepSpec({ moveY: 1, attack1: true });
    let ev: MoveEvent[] = [];
    for (let i = 0; i < 100 && sim.body.state !== 'diveLand'; i++) ev = sim.stepSpec({});
    expect(ev).toContain('diveLand');
    expect(sim.body.y).toBe(432);
    expect(sim.body.vy).toBe(0);
    for (let i = 1; i <= 12; i++) { sim.stepSpec({ moveX: 1 }); expect(sim.body.state).toBe('diveLand'); expect(sim.body.vx).toBe(0); }
    sim.stepSpec({ moveX: 1 });
    expect(sim.body.state).toBe('ground');
  });
  it('a jump cancels diveLand into a ground jump', () => {
    const sim = inAir();
    sim.stepSpec({ moveY: 1, attack1: true });
    ticksUntil(sim, {}, (b) => b.state === 'diveLand');
    sim.stepSpec({}, 2);
    expect(sim.stepSpec({ jump: true })).toContain('jump');
    expect(sim.body.state).toBe('air');
  });
  it('a dash cancels diveLand into a ground dash', () => {
    const sim = inAir();
    sim.stepSpec({ moveY: 1, attack1: true });
    ticksUntil(sim, {}, (b) => b.state === 'diveLand');
    expect(sim.stepSpec({ dash: true, moveX: 1 })).toContain('dashStart');
  });
  it('during windup or fall a jump runs the normal priority (double jump) and a dash starts an air dash', () => {
    const sim = inAir();
    sim.stepSpec({ moveY: 1, attack1: true }); sim.stepSpec({}, 8);
    expect(sim.body.state).toBe('diveFall');
    expect(sim.stepSpec({ jump: true })).toContain('doubleJump');
    const sim2 = inAir();
    sim2.stepSpec({ moveY: 1, attack1: true }); sim2.stepSpec({}, 2);
    expect(sim2.stepSpec({ dash: true, moveX: -1 })).toContain('dashStart');
    expect(sim2.body.vx).toBe(-400);
  });
  it('onDiveHit during diveFall bounces: vy -360, vx 0, air, both refreshes, not cuttable; a new dive can start at once', () => {
    const sim = inAir(100);
    sim.body.airDashAvailable = false;
    sim.body.doubleJumpAvailable = false;
    sim.stepSpec({ moveY: 1, attack1: true }); sim.stepSpec({}, 8);
    expect(onDiveHit(sim.body)).toBe('diveBounce');
    expect(sim.body).toMatchObject({ vy: -360, vx: 0, state: 'air', airDashAvailable: true, doubleJumpAvailable: true, jumpCuttable: false, coyoteValid: false });
    expect(sim.stepSpec({ moveY: 1, attack1: true })).toContain('diveStart');
  });
  it('a bounce is not cut by releasing jump and rises 43 px', () => {
    const sim = inAir(100);
    sim.stepSpec({ moveY: 1, attack1: true }); sim.stepSpec({}, 8);
    onDiveHit(sim.body);
    const rise = peakRise(sim, () => sim.stepSpec({}, 40));
    expect(rise).toBeGreaterThanOrEqual(42);
    expect(rise).toBeLessThanOrEqual(44);
  });
  it('onDiveHit outside diveFall does nothing', () => {
    const sim = inAir();
    expect(onDiveHit(sim.body)).toBeNull();
    expect(sim.body.state).toBe('air');
  });
  it('needs a usable weapon in the slot that was pressed', () => {
    const sim = inAir();
    sim.ctx.slotUsable = [false, true];
    expect(sim.stepSpec({ moveY: 1, attack1: true })).not.toContain('diveStart');
    sim.stepSpec({ moveY: 1 });
    expect(sim.stepSpec({ moveY: 1, attack2: true })).toContain('diveStart');
  });
  it('needs down held and the player airborne', () => {
    const sim = inAir();
    expect(sim.stepSpec({ attack1: true })).toEqual([]);
    const ground = new PlayerSim(flatWorld(), { x: 300, y: 432 });
    expect(ground.stepSpec({ moveY: 1, attack1: true })).toEqual([]);
  });
  it('works during coyote time, from a wall slide, and from an air dash (ending it)', () => {
    const g = gridFromRects(40, 30, [{ x0: 0, y0: 27, x1: 9, y1: 27, kind: 'solid' }, { x0: 0, y0: 29, x1: 39, y1: 29, kind: 'solid' }]);
    const coyote = new PlayerSim(g, { x: 140, y: 432 });
    ticksUntil(coyote, { moveX: 1 }, (b) => b.state === 'air');
    expect(coyote.stepSpec({ moveY: 1, attack1: true })).toContain('diveStart');

    const wall = new PlayerSim(gridFromRects(40, 30, [{ x0: 0, y0: 27, x1: 39, y1: 29, kind: 'solid' }, { x0: 20, y0: 0, x1: 20, y1: 26, kind: 'solid' }]), { x: 314, y: 200 });
    wall.stepSpec({ moveX: 1 }, 3);
    expect(wall.body.state).toBe('wallSlide');
    expect(wall.stepSpec({ moveX: 1, moveY: 1, attack1: true })).toContain('diveStart');

    const dash = inAir();
    dash.stepSpec({ dash: true, moveX: 1 }); dash.stepSpec({}, 3);
    const ev = dash.stepSpec({ moveY: 1, attack1: true });
    expect(ev).toEqual(expect.arrayContaining(['dashEnd', 'diveStart']));
    expect(dash.body.dashIframes).toBe(false);
    expect(dash.body.dashReadyPt).toBe(dash.body.pt + 42);
  });
  it('no dive on a tick where a jump started', () => {
    const sim = inAir();
    const ev = sim.stepSpec({ jump: true, moveY: 1, attack1: true });
    expect(ev).toContain('doubleJump');
    expect(ev).not.toContain('diveStart');
  });
  it('lands on one-way platforms', () => {
    const sim = new PlayerSim(MOVEMENT_TEST.grid, { x: 1300, y: 300 });
    sim.stepSpec({ moveY: 1, attack1: true });
    ticksUntil(sim, {}, (b) => b.state === 'diveLand');
    expect(sim.body.y).toBe(384);
  });
});

describe('one-way platforms and drop-through (01 §2.6, §2.7.3, §13.1, checklist 22)', () => {
  /** Standing on one-way platform #9 of the test level (top y 384). */
  function onOneWay(): PlayerSim {
    const sim = new PlayerSim(MOVEMENT_TEST.grid, { x: 1300, y: 384 });
    sim.stepSpec({}, 2);
    expect(sim.body.state).toBe('ground');
    return sim;
  }
  it('rising from below is not blocked, and falling onto it lands', () => {
    const sim = new PlayerSim(MOVEMENT_TEST.grid, { x: 1300, y: 432 });
    const rise = peakRise(sim, () => sim.stepSpec({ jump: true }, 100));
    expect(rise).toBeGreaterThanOrEqual(55);
    expect(sim.body.state).toBe('ground');
    expect(sim.body.y).toBe(384);
  });
  it('down + jump drops through: y + 1, air, vy 0 before gravity', () => {
    const sim = onOneWay();
    const ev = sim.stepSpec({ moveY: 1, jump: true });
    expect(ev).toEqual(['dropThrough']);
    expect(sim.body.state).toBe('air');
    expect(sim.body.y).toBe(385);
    expect(sim.body.vy).toBeCloseTo(MOVE.GRAVITY * TICK, 9);
    expect(sim.body.coyoteValid).toBe(false);
    ticksUntil(sim, { moveY: 1 }, (b) => b.state === 'ground');
    expect(sim.body.y).toBe(432);
  });
  it('no coyote jump after dropping through', () => {
    const sim = onOneWay();
    sim.stepSpec({ moveY: 1, jump: true }); sim.stepSpec({}, 2);
    expect(sim.stepSpec({ jump: true })).toEqual(['doubleJump']);
  });
  it('down + jump on solid ground is a normal jump', () => {
    const sim = new PlayerSim(flatWorld(), { x: 300, y: 432 });
    expect(sim.stepSpec({ moveY: 1, jump: true })).toEqual(['jump']);
  });
  it('a buffered press never drops through', () => {
    const sim = new PlayerSim(MOVEMENT_TEST.grid, { x: 1300, y: 330 });
    sim.body.doubleJumpAvailable = false;
    ticksUntil(sim, { moveY: 1 }, (b) => b.y >= 370);   // a few ticks above the platform
    const log: MoveEvent[] = [];
    log.push(...sim.stepSpec({ moveY: 1, jump: true }));
    for (let i = 0; i < 30; i++) log.push(...sim.stepSpec({ moveY: 1, jump: true }));
    expect(log).toContain('land');
    expect(log).toContain('jump');
    expect(log).not.toContain('dropThrough');
  });
  it('apex assist: an apex 1-6 px below a one-way top snaps onto it', () => {
    // find a jump-hold length whose peak is 43-46 px on flat ground (2-5 px short of a 48 px platform)
    let hold = -1, peak = 0;
    for (let k = 1; k <= 33 && hold < 0; k++) {
      const s = new PlayerSim(flatWorld(), { x: 300, y: 432 });
      peak = peakRise(s, () => { s.stepSpec({ jump: true }, k); s.stepSpec({}, 60); });
      if (peak >= 43 && peak <= 46) hold = k;
    }
    expect(hold).toBeGreaterThan(0);
    const g = gridFromRects(40, 30, [{ x0: 0, y0: 27, x1: 39, y1: 29, kind: 'solid' }, { x0: 15, y0: 24, x1: 22, y1: 24, kind: 'oneway' }]);
    const sim = new PlayerSim(g, { x: 300, y: 432 });
    sim.stepSpec({ jump: true }, hold);
    ticksUntil(sim, {}, (b) => b.state === 'ground');
    expect(sim.body.y).toBe(384);
  });
});
