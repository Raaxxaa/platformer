// Run layout (06 §8.7): stream `layout`, scope 'run'; 25 draws, stages 1, 2 (both roads), 3, 4, sections 2, 3, 4, 6, 7.
import { deriveSeed, Rng } from '../rng.ts';
import type { Picks } from '../level/assemble.ts';
import { LAYOUT } from '../../data/levelRules.ts';
import type { StageLevelId } from '../../data/levelRules.ts';
import { VARIETY } from '../../data/levelRules.ts';
import { plainVariety, type Formation, type SectionVariety } from '../level/variety.ts';

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
export function layoutCodes(l: RunLayout, v?: RunVariety): Record<StageLevelId, string> {
  return Object.fromEntries(LAYOUT.stages.map((s) => [s, v ? layoutCodeFull(l[s] ?? classicLayout(), v[s]) : layoutCode(l[s] ?? classicLayout())])) as Record<StageLevelId, string>;
}

// 06 §8.10 (M18): after the 25 version draws, per stage (same order) and section 1–7, one formation draw then
// `spotDraws` spot draws. Always all draws, so the same seed gives the same picks on every device and road.
export type RunVariety = Record<StageLevelId, SectionVariety[]>;
export function rollVariety(runSeed: number): RunVariety {
  const rng = new Rng(deriveSeed(runSeed, 'layout', 'run'));
  for (let i = 0; i < LAYOUT.stages.length * LAYOUT.vary.length; i++) rng.next();
  const out = {} as RunVariety;
  for (const s of LAYOUT.stages) {
    out[s] = Array.from({ length: LAYOUT.sections }, () => plainVariety());
    for (const n of VARIETY.sections) {
      const formation = rng.next() < 0.5 ? 'A' : 'B';
      const spots = Array.from({ length: VARIETY.spotDraws }, () => Math.floor(rng.next() * VARIETY.spotRoll));
      out[s][n - 1] = { formation, spots };
    }
  }
  return out;
}
/** `2a-1b-3a-3a-2b`: the varying sections' versions with their formation letters. */
export const layoutCodeFull = (p: Picks, v?: SectionVariety[]): string =>
  LAYOUT.vary.map((n) => `${p[n - 1] ?? 1}${(v?.[n - 1]?.formation ?? 'A').toLowerCase()}`).join('-');
/** Reads `2a-1b-3a-3a-2b` (or the old `2-1-3-3-2`): versions, and formations (A where no letter). */
export function parseLayoutCodeFull(code: string): { picks: Picks; formations: Formation[] } | null {
  const parts = code === 'classic' ? LAYOUT.vary.map(() => '1') : code.includes('-') ? code.split('-') : code.match(/[1-3][abAB]?/g) ?? [];
  if (parts.length !== LAYOUT.vary.length || !parts.every((x) => /^[1-3][abAB]?$/.test(x))) return null;
  const picks = classicLayout(), formations: Formation[] = Array.from({ length: LAYOUT.sections }, () => 'A');
  LAYOUT.vary.forEach((n, i) => { picks[n - 1] = Number(parts[i][0]); if (/[bB]/.test(parts[i][1] ?? '')) formations[n - 1] = 'B'; });
  return { picks, formations };
}
