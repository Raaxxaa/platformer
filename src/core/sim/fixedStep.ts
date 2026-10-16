import { MAX_FRAME_SECONDS, TICK_RATE } from '../tuning.ts';

/** Millionths of a tick: integer bookkeeping so 2 × (1/120) s is always exactly 2 ticks. */
const UNITS_PER_TICK = 1_000_000;

/**
 * Turns real frame time into whole 120 Hz ticks (00-README "Simulation").
 * The remainder carries to the next frame; one frame never counts for more than `maxFrameSeconds`.
 */
export class FixedStepper {
  private acc = 0;
  private readonly maxFrameSeconds: number;

  constructor(maxFrameSeconds = MAX_FRAME_SECONDS) {
    this.maxFrameSeconds = maxFrameSeconds;
  }

  /** Adds a frame's elapsed time and returns how many ticks to run now. */
  advance(dtSeconds: number): number {
    if (!(dtSeconds > 0)) return 0;
    const dt = Math.min(dtSeconds, this.maxFrameSeconds);
    this.acc += Math.round(dt * TICK_RATE * UNITS_PER_TICK);
    const n = Math.floor(this.acc / UNITS_PER_TICK);
    this.acc -= n * UNITS_PER_TICK;
    return n;
  }
}
