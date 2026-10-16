// Measuring helpers for movement tests.
import type { InputState } from '../input.ts';
import type { PlayerBody } from '../player/body.ts';
import type { InputSpec, PlayerSim } from '../sim/playerSim.ts';

/** Highest rise above the starting feet y (start − min y) while `run` steps the sim. */
export function peakRise(sim: PlayerSim, run: () => void): number {
  const startY = sim.body.y;
  let minY = startY;
  const original = sim.step;
  sim.step = (input: InputState) => {
    const events = original.call(sim, input);
    minY = Math.min(minY, sim.body.y);
    return events;
  };
  try {
    run();
  } finally {
    sim.step = original;
  }
  return startY - minY;
}

/** Steps holding `spec` until `pred` holds; returns the number of ticks taken, or -1 after `max` ticks. */
export function ticksUntil(sim: PlayerSim, spec: InputSpec, pred: (b: PlayerBody) => boolean, max = 2000): number {
  for (let n = 1; n <= max; n++) {
    sim.stepSpec(spec);
    if (pred(sim.body)) return n;
  }
  return -1;
}
