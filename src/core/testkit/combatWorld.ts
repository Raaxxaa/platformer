// Combat test helpers.
import { gridFromRects } from '../level/build.ts';
import { GameWorld, type Stage, type WorldEvent } from '../sim/gameWorld.ts';
import type { EnemySpawn } from '../enemies/types.ts';
import { specToInput, type InputSpec } from '../sim/playerSim.ts';

/** A flat 60 × 23 tile arena (floor rows 20–22, walls at x 0 and 59); the player spawns at x 200, feet y 320. */
export function arenaWorld(opts: { stage?: Stage; seed?: number; enemies?: EnemySpawn[] } = {}): GameWorld {
  const grid = gridFromRects(60, 23, [
    { x0: 0, y0: 20, x1: 59, y1: 22, kind: 'solid' },
    { x0: 0, y0: 0, x1: 0, y1: 22, kind: 'solid' },
    { x0: 59, y0: 0, x1: 59, y1: 22, kind: 'solid' },
  ]);
  return new GameWorld({ grid, spawn: { x: 200, y: 320 }, stage: opts.stage, runSeed: opts.seed, enemies: opts.enemies });
}

const prevSpecs = new WeakMap<GameWorld, InputSpec>();

/** Steps `n` ticks holding `spec` (buttons pressed on the first tick only); returns all events. */
export function stepSpec(w: GameWorld, spec: InputSpec, n = 1): WorldEvent[] {
  const out: WorldEvent[] = [];
  for (let i = 0; i < n; i++) {
    w.step(specToInput(prevSpecs.get(w) ?? {}, spec));
    prevSpecs.set(w, spec);
    out.push(...w.events);
  }
  return out;
}
