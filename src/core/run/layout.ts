// Run layout (06 §8.7): stream `layout`, scope 'run'; 25 draws, stages 1, 2 (both roads), 3, 4, sections 2, 3, 4, 6, 7.
import { deriveSeed, Rng } from '../rng.ts';
import type { Picks } from '../level/assemble.ts';
import { LAYOUT } from '../../data/levelRules.ts';
import type { StageLevelId } from '../../data/levelRules.ts';

export { LAYOUT };
export type RunLayout = Record<StageLevelId, Picks>;

export function rollLayout(runSeed: number): RunLayout {
  const rng = new Rng(deriveSeed(runSeed, 'layout', 'run'));
  const out = {} as RunLayout;
  for (const s of LAYOUT.stages) {
    const p: Picks = Array.from({ length: LAYOUT.sections }, () => 1);
    for (const n of LAYOUT.vary) p[n - 1] = 1 + Math.floor(rng.next() * LAYOUT.versions);
    out[s] = p;
  }
  return out;
}

export const classicLayout = (): Picks => Array.from({ length: LAYOUT.sections }, () => 1);

/** `2-1-3-3-2`: the varying sections' picks. */
export const layoutCode = (p: Picks): string => LAYOUT.vary.map((n) => p[n - 1] ?? 1).join('-');

/** `2-1-3-3-2`, `21332` or `classic` → picks; null if malformed. */
export function parseLayoutCode(code: string): Picks | null {
  if (code === 'classic') return classicLayout();
  const d = code.replace(/-/g, '');
  if (d.length !== LAYOUT.vary.length || !/^[1-3]+$/.test(d)) return null;
  const p = classicLayout();
  LAYOUT.vary.forEach((n, i) => { p[n - 1] = Number(d[i]); });
  return p;
}

/** Layout code per stage (06 §15.2 RunRecord). */
export function layoutCodes(l: RunLayout): Record<StageLevelId, string> {
  return Object.fromEntries(LAYOUT.stages.map((s) => [s, layoutCode(l[s] ?? classicLayout())])) as Record<StageLevelId, string>;
}
