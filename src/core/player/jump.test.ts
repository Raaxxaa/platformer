import { describe, it, expect } from 'vitest';
import { PlayerSim } from '../sim/playerSim.ts';
import { flatWorld } from '../testkit/worlds.ts';
import { peakRise, ticksUntil } from '../testkit/measure.ts';
import { gridFromRects } from '../level/build.ts';
import { MOVE } from '../tuning.ts';
import type { MoveEvent } from './body.ts';

function simOnFlat(x = 200): PlayerSim {
  const sim = new PlayerSim(flatWorld(), { x, y: 432 });
  sim.stepSpec({}, 2);
  return sim;
}

describe('ground jump (01 §6.1, checklist 1)', () => {
  it('full jump peaks 56 px on tick 33 (±1)', () => {
    const sim = simOnFlat();
    let apexTick = -1;
    const rise = peakRise(sim, () => {
      for (let t = 1; t <= 80; t++) {
        sim.stepSpec({ jump: true });
        if (sim.body.vy < 0) apexTick = t;     // last tick still rising
      }
    });
    expect(rise).toBeGreaterThanOrEqual(55);
    expect(rise).toBeLessThanOrEqual(57);
    expect(apexTick).toBeGreaterThanOrEqual(32);
    expect(apexTick).toBeLessThanOrEqual(34);
    expect(sim.body.state).toBe('ground');
    expect(sim.body.y).toBe(432);
  });
  it('jump height is still 56 px with +45% move speed (checklist 9)', () => {
    const sim = simOnFlat();
    sim.mods.speedPercents = [0.45];
    const rise = peakRise(sim, () => sim.stepSpec({ jump: true }, 80));
    expect(rise).toBeGreaterThanOrEqual(55);
    expect(rise).toBeLessThanOrEqual(57);
  });
  it('emits jump on the press tick and sets jumpCuttable', () => {
    const sim = simOnFlat();
    const ev = sim.stepSpec({ jump: true });
    expect(ev).toContain('jump');
    expect(sim.body.vy).toBeLessThan(0);
    expect(sim.body.state).toBe('air');
    expect(sim.body.jumpCuttable).toBe(true);
    expect(sim.body.coyoteValid).toBe(false);
  });
  it('a jump keeps vx (running jump lands 92-94 px away at 170 px/s, checklist 14)', () => {
    const sim = simOnFlat(100);
    sim.stepSpec({ moveX: 1 }, 30);
    expect(sim.body.vx).toBe(170);
    const x0 = sim.body.x;
    sim.stepSpec({ moveX: 1, jump: true });
    expect(sim.body.vx).toBe(170);
    expect(ticksUntil(sim, { moveX: 1, jump: true }, (b) => b.state === 'ground')).toBeGreaterThan(0);
    const d = sim.body.x - x0;
    expect(d).toBeGreaterThanOrEqual(92);
    expect(d).toBeLessThanOrEqual(94);
  });
  it('is refused when canJump is false', () => {
    const sim = simOnFlat();
    sim.mods.canJump = false;
    expect(sim.stepSpec({ jump: true })).not.toContain('jump');
    expect(sim.body.state).toBe('ground');
  });
});

describe('jump cut (01 §6.3, checklist 2)', () => {
  it('a jump held for exactly 1 tick peaks 14 px', () => {
    const sim = simOnFlat();
    const rise = peakRise(sim, () => { sim.stepSpec({ jump: true }); sim.stepSpec({}, 60); });
    expect(rise).toBeGreaterThanOrEqual(13);
    expect(rise).toBeLessThanOrEqual(15);
  });
  it('releasing while rising multiplies vy by 0.45 once', () => {
    const sim = simOnFlat();
    sim.stepSpec({ jump: true }, 5);
    const vyBefore = sim.body.vy;
    sim.stepSpec({});
    expect(sim.body.vy).toBeCloseTo(vyBefore * MOVE.JUMP_CUT + MOVE.GRAVITY / 120, 9);
    expect(sim.body.jumpCuttable).toBe(false);
  });
  it('a press and release inside one tick still jumps, then cuts on the next tick', () => {
    const sim = simOnFlat();
    const input = { ...specless(), jump: { held: false, pressed: true, released: true } };
    expect(sim.step(input)).toContain('jump');
    const rise = peakRise(sim, () => sim.stepSpec({}, 60));
    expect(rise + 3).toBeGreaterThanOrEqual(13);   // first tick rose ~3 px before peakRise started
  });
  it('jumpCuttable clears at the apex', () => {
    const sim = simOnFlat();
    ticksUntil(sim, { jump: true }, (b) => b.vy >= 0);
    expect(sim.body.jumpCuttable).toBe(false);
  });
});

describe('double jump (01 §6.2, checklist 2, 3)', () => {
  it('a 1-tick double jump rises 10 px', () => {
    const sim = simOnFlat();
    ticksUntil(sim, { jump: true }, (b) => b.vy >= 0);
    sim.stepSpec({});
    let ev: MoveEvent[] = [];
    const rise = peakRise(sim, () => { ev = sim.stepSpec({ jump: true }); sim.stepSpec({}, 40); });
    expect(ev).toContain('doubleJump');
    expect(rise).toBeGreaterThanOrEqual(9);
    expect(rise).toBeLessThanOrEqual(11);
  });
  it('a held double jump at the apex of a full jump peaks 96 px above the floor', () => {
    const sim = simOnFlat();
    const rise = peakRise(sim, () => {
      ticksUntil(sim, { jump: true }, (b) => b.vy >= 0);
      sim.stepSpec({});
      sim.stepSpec({ jump: true }, 60);
    });
    expect(rise).toBeGreaterThanOrEqual(95);
    expect(rise).toBeLessThanOrEqual(97);
  });
  it('only once per airtime, refreshed on landing', () => {
    const sim = simOnFlat();
    sim.stepSpec({ jump: true }, 10); sim.stepSpec({});
    expect(sim.stepSpec({ jump: true })).toContain('doubleJump');
    expect(sim.body.doubleJumpAvailable).toBe(false);
    sim.stepSpec({});
    expect(sim.stepSpec({ jump: true })).toEqual([]);
    ticksUntil(sim, {}, (b) => b.state === 'ground');
    expect(sim.body.doubleJumpAvailable).toBe(true);
  });
  it('is refused when canDoubleJump is false', () => {
    const sim = simOnFlat();
    sim.mods.canDoubleJump = false;
    sim.stepSpec({ jump: true }, 10); sim.stepSpec({});
    expect(sim.stepSpec({ jump: true })).not.toContain('doubleJump');
  });
});

describe('coyote time (01 §6.4, checklist 12)', () => {
  // upper floor tiles x 0..9 at row 17 (feet y 272); lower floor 10 tiles down
  const ledgeWorld = () => gridFromRects(40, 30, [
    { x0: 0, y0: 17, x1: 9, y1: 17, kind: 'solid' },
    { x0: 0, y0: 27, x1: 39, y1: 29, kind: 'solid' },
  ]);
  function walkOff(): { sim: PlayerSim; lastGround: number } {
    const sim = new PlayerSim(ledgeWorld(), { x: 100, y: 272 });
    ticksUntil(sim, { moveX: 1 }, (b) => b.state === 'air');
    expect(sim.body.coyoteValid).toBe(true);
    return { sim, lastGround: sim.body.lastGroundPt };
  }
  it('a jump pressed on the 12th tick after the last grounded tick is a ground jump', () => {
    const { sim, lastGround } = walkOff();
    while (sim.body.pt < lastGround + 11) sim.stepSpec({ moveX: 1 });
    const ev = sim.stepSpec({ moveX: 1, jump: true });
    expect(sim.body.pt - lastGround).toBe(12);
    expect(ev).toContain('jump');
    expect(sim.body.doubleJumpAvailable).toBe(true);
  });
  it('on the 13th tick it is a double jump', () => {
    const { sim, lastGround } = walkOff();
    while (sim.body.pt < lastGround + 12) sim.stepSpec({ moveX: 1 });
    const ev = sim.stepSpec({ moveX: 1, jump: true });
    expect(sim.body.pt - lastGround).toBe(13);
    expect(ev).toContain('doubleJump');
    expect(sim.body.doubleJumpAvailable).toBe(false);
  });
});

describe('jump buffer (01 §6.4, checklist 13)', () => {
  function fallingSim(): PlayerSim {
    const sim = new PlayerSim(flatWorld(), { x: 200, y: 300 });
    sim.body.doubleJumpAvailable = false;
    return sim;
  }
  function landingTick(): number {
    const sim = fallingSim();
    return ticksUntil(sim, {}, (b) => b.state === 'ground');
  }
  function runWithPressAt(pressTick: number): MoveEvent[][] {
    const sim = fallingSim();
    const log: MoveEvent[][] = [];
    for (let t = 1; t <= 120; t++) log.push(sim.stepSpec({ jump: t === pressTick }));
    return log;
  }
  it('a press 10 ticks before the landing tick fires on the tick after landing', () => {
    const L = landingTick();
    const log = runWithPressAt(L - 10);
    const jumpTicks = log.flatMap((ev, i) => (ev.includes('jump') ? [i + 1] : []));
    expect(jumpTicks).toEqual([L + 1]);
  });
  it('a press 12 ticks before the landing tick does not fire', () => {
    const L = landingTick();
    const log = runWithPressAt(L - 12);
    expect(log.flat()).not.toContain('jump');
  });
});

describe('ceiling corner at player level (checklist 20)', () => {
  // ceiling tile x 160..175, y 352..367 above a flat floor at 432
  const world = () => gridFromRects(60, 30, [
    { x0: 0, y0: 27, x1: 59, y1: 29, kind: 'solid' },
    { x0: 10, y0: 22, x1: 10, y1: 22, kind: 'solid' },
  ]);
  it('a 4 px overlap nudges the player sideways and the jump continues', () => {
    const sim = new PlayerSim(world(), { x: 158, y: 432 });
    const rise = peakRise(sim, () => sim.stepSpec({ jump: true }, 60));
    expect(rise).toBeGreaterThanOrEqual(55);
    expect(sim.body.x).toBe(154);
  });
  it('a 5 px overlap bonks: vy becomes 0', () => {
    const sim = new PlayerSim(world(), { x: 159, y: 432 });
    let bonked = false;
    for (let i = 0; i < 40; i++) {
      const vyBefore = sim.body.vy;
      sim.stepSpec({ jump: true });
      if (vyBefore < -100 && sim.body.vy === 0) bonked = true;
    }
    expect(bonked).toBe(true);
    expect(sim.body.x).toBe(159);
  });
});

function specless() {
  const b = { held: false, pressed: false, released: false };
  return { moveX: 0 as const, moveY: 0 as const, jump: b, dash: b, attack1: b, attack2: b, ability1: b, ability2: b, heal: b, interact: b, restart: b, pause: b };
}

describe('low box in the air (01 §2.2)', () => {
  it('a double jump under a low ceiling keeps the 12 × 14 box until the 12 × 28 box fits', () => {
    // ceiling tile row 20 (bottom y 336); the body hangs in the air with its low box 2 px under it
    const g = gridFromRects(40, 30, [{ x0: 0, y0: 27, x1: 39, y1: 29, kind: 'solid' }, { x0: 0, y0: 20, x1: 39, y1: 20, kind: 'solid' }]);
    const sim = new PlayerSim(g, { x: 300, y: 352 });
    sim.body.h = 14;
    sim.stepSpec({});
    expect(sim.body.h).toBe(14);
    const y0 = sim.body.y;
    expect(sim.stepSpec({ jump: true })).toContain('doubleJump');
    expect(sim.body.h).toBe(14);
    expect(Math.abs(sim.body.y - y0)).toBeLessThanOrEqual(4);   // no push-out jump
  });
});
