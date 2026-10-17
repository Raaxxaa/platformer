// 05 §2.2 weighted pick and the per-source generator (§2.1).
import type { Grade } from '../combat/types.ts';
import { deriveSeed, mulberry32 } from '../rng.ts';
import { GRADES, type GradeWeights } from '../../data/loot.ts';

export type Rng = () => number;

/** `pick`: total = Σw; r = rng × total; first entry with r < w (weights of 0 never picked). */
export function pick<T>(entries: readonly (readonly [T, number])[], rng: Rng): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of entries) {
    if (w > 0 && r < w) return v;
    r -= w;
  }
  return [...entries].reverse().find(([, w]) => w > 0)![0];
}

export const pickGrade = (row: GradeWeights, rng: Rng): Grade => pick(GRADES.map((g) => [g, row[g]] as const), rng);

/** A fresh generator for one source: mulberry32(deriveSeed(runSeed, stream, ...keys)). */
export const sourceRng = (runSeed: number, stream: string, ...keys: (string | number)[]): Rng => mulberry32(deriveSeed(runSeed, stream, ...keys));
