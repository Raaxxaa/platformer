import { describe, it, expect } from 'vitest';
import { PlayerSim } from '../sim/playerSim.ts';
import { flatWorld } from '../testkit/worlds.ts';
import { ticksUntil } from '../testkit/measure.ts';
import { applyKnockback, setDead } from './movement.ts';
import { MOVE, TICK } from '../tuning.ts';

function simOnFlat(x = 300): PlayerSim {
  const sim = new PlayerSim(flatWorld(), { x, y: 432 });
  sim.stepSpec({}, 2);
  return sim;
}

describe('hit-stop (01 §3 step 1, checklist 31)', () => {
  it('freezes the player; a dash pressed on hit-stop tick 3 with the dash ready ends it and moves that tick', () => {
    const sim = simOnFlat();
    sim.body.hitStopTicks = 12;
    const x0 = sim.body.x, pt0 = sim.body.pt;
    sim.stepSpec({ moveX: 1 }, 2);
    expect([sim.body.x, sim.body.pt, sim.body.hitStopTicks]).toEqual([x0, pt0, 10]);
    const ev = sim.stepSpec({ moveX: 1, dash: true });
    expect(ev).toContain('dashStart');
    expect(sim.body.hitStopTicks).toBe(0);
    expect(sim.body.x).toBeGreaterThan(x0);
  });
  it('with the dash on cooldown the press does not end hit-stop; it runs all 12 ticks and stays buffered', () => {
    const sim = simOnFlat();
    sim.body.dashReadyPt = sim.body.pt + 5;
    sim.body.hitStopTicks = 12;
    const x0 = sim.body.x, pt0 = sim.body.pt;
    sim.stepSpec({}, 2);
    expect(sim.stepSpec({ dash: true })).toEqual([]);
    expect(sim.body.dashPressPt).toBe(pt0);
    sim.stepSpec({}, 9);
    expect([sim.body.x, sim.body.pt, sim.body.hitStopTicks]).toEqual([x0, pt0, 0]);
    let fired = -1;
    for (let i = 1; i <= 10 && fired < 0; i++) if (sim.stepSpec({}).includes('dashStart')) fired = sim.body.pt;
    expect(fired).toBe(pt0 + 5);                       // the buffered press fires once the cooldown ends
  });
  it('a jump press that can happen also ends hit-stop', () => {
    const sim = simOnFlat();
    sim.body.hitStopTicks = 9;
    sim.stepSpec({});
    expect(sim.stepSpec({ jump: true })).toContain('jump');
    expect(sim.body.hitStopTicks).toBe(0);
  });
});

describe('knockback and hurt (01 §12.2)', () => {
  it('sets the velocity, ignores input for the stun, then returns to air or ground', () => {
    const sim = simOnFlat();
    sim.stepSpec({ dash: true });
    applyKnockback(sim.body, 180, -160, 24);
    expect(sim.body.state).toBe('hurt');
    expect(sim.body.dashIframes).toBe(false);
    const x0 = sim.body.x;
    for (let i = 1; i <= 24; i++) {
      sim.stepSpec({ moveX: -1, jump: i === 3, dash: i === 5 });
      expect(sim.body.state).toBe('hurt');
      expect(sim.body.vx).toBeGreaterThanOrEqual(0);   // holding left does nothing (air decel 900: 180 → 0 in 24 ticks)
    }
    expect(sim.body.x).toBeGreaterThan(x0);
    sim.stepSpec({});
    expect(['air', 'ground']).toContain(sim.body.state);
  });
  it('in hurt, horizontal speed uses the no-input decel and gravity applies', () => {
    const sim = simOnFlat();
    applyKnockback(sim.body, 180, -160, 24);
    sim.stepSpec({ moveX: 1 });
    expect(sim.body.vx).toBeCloseTo(180 - MOVE.AIR_DECEL * TICK, 9);
    expect(sim.body.vy).toBeCloseTo(-160 + MOVE.GRAVITY * TICK, 9);
  });
});

describe('dead body (01 §5.4, checklist 39)', () => {
  it('falls at most 400 px/s, lands on the floor and ignores input', () => {
    const sim = new PlayerSim(flatWorld(), { x: 300, y: 100 });
    setDead(sim.body);
    let maxVy = 0;
    const events: string[] = [];
    for (let i = 0; i < 200; i++) {
      events.push(...sim.stepSpec({ moveX: 1, moveY: 1, jump: i % 2 === 0, dash: i % 3 === 0, attack1: true }));
      maxVy = Math.max(maxVy, sim.body.vy);
    }
    expect(maxVy).toBe(400);
    expect(sim.body.state).toBe('dead');
    expect(sim.body.y).toBe(432);
    expect(sim.body.x).toBe(300);
    expect(events.filter((e) => e !== 'land')).toEqual([]);
    expect(events).toContain('land');
  });
  it('slides to a stop on the ground with the no-input decel', () => {
    const sim = simOnFlat();
    sim.body.vx = 170;
    setDead(sim.body);
    expect(ticksUntil(sim, { moveX: 1 }, (b) => b.vx === 0)).toBe(9);
  });
});
