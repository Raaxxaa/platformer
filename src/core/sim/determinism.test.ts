import { describe, it, expect } from 'vitest';
import { PlayerSim, specToInput, type InputSpec } from './playerSim.ts';
import { FixedStepper } from './fixedStep.ts';
import { MOVEMENT_TEST } from '../../data/levels/movementTest.ts';
import type { InputState } from '../input.ts';

const TICKS = 10_000;

/** A 10,000-tick input recording from a fixed-seed LCG (directions, jump, dash, down + attack1). */
function recording(): InputState[] {
  let seed = 0xc0ffee;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const out: InputState[] = [];
  let prev: InputSpec = {};
  let spec: InputSpec = {};
  for (let t = 0; t < TICKS; t++) {
    if (t % 5 === 0) {
      const r = rand();
      const down = rand() < 0.2;
      spec = {
        moveX: r < 0.55 ? 1 : r < 0.75 ? 0 : -1,
        moveY: down ? 1 : rand() < 0.05 ? -1 : 0,
        jump: rand() < 0.25,
        dash: rand() < 0.15,
        attack1: down && rand() < 0.5,
      };
    }
    out.push(specToInput(prev, spec));
    prev = spec;
  }
  return out;
}

const snapshot = (sim: PlayerSim) => JSON.stringify({ body: sim.body, camera: sim.camera });

describe('determinism (checklist 30)', () => {
  it('the same recording gives identical body and camera on every tick', () => {
    const rec = recording();
    const a = new PlayerSim(MOVEMENT_TEST.grid, MOVEMENT_TEST.spawn);
    const b = new PlayerSim(MOVEMENT_TEST.grid, MOVEMENT_TEST.spawn);
    const states = new Set<string>();
    for (let t = 0; t < TICKS; t++) {
      const ea = a.step(rec[t]);
      const eb = b.step(rec[t]);
      expect(eb).toEqual(ea);
      const sa = snapshot(a);
      if (sa !== snapshot(b)) expect(snapshot(b)).toBe(sa);   // only build the diff on a mismatch
      states.add(a.body.state);
    }
    // the recording exercises most of the movement set
    for (const s of ['ground', 'air', 'dash', 'slide', 'wallSlide', 'diveWindup', 'diveFall', 'diveLand']) expect(states).toContain(s);
  });

  it('delivering the ticks through FixedStepper at 60 Hz and 144 Hz gives the same final state', () => {
    const rec = recording();
    const reference = new PlayerSim(MOVEMENT_TEST.grid, MOVEMENT_TEST.spawn);
    for (const input of rec) reference.step(input);

    for (const hz of [60, 144]) {
      const sim = new PlayerSim(MOVEMENT_TEST.grid, MOVEMENT_TEST.spawn);
      const stepper = new FixedStepper();
      let next = 0;
      while (next < TICKS) {
        const n = stepper.advance(1 / hz);
        for (let i = 0; i < n && next < TICKS; i++) sim.step(rec[next++]);
      }
      expect(snapshot(sim)).toBe(snapshot(reference));
    }
  });
});
