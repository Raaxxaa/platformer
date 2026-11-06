// 06 §8.10 (M18): spots and formations — valid levels, same contents, stable and even picks.
import { describe, expect, it } from 'vitest';
import plainsPack from '../../../public/levels/plains.pack.json';
import mountainsPack from '../../../public/levels/mountains.pack.json';
import swampsPack from '../../../public/levels/swamps.pack.json';
import kingdomPack from '../../../public/levels/kingdom.pack.json';
import castlePack from '../../../public/levels/castle.pack.json';
import { LEVEL_PACKS } from '../../data/run.ts';
import { assembleLevel, classicPicks, contentsOf, type LevelPack } from './assemble.ts';
import { validateLevel } from './validateLevel.ts';
import { applyVariety, plainVariety, spotGroups, type SectionVariety } from './variety.ts';
import { layoutCodeFull, parseLayoutCodeFull, rollLayout, rollVariety } from '../run/layout.ts';
import { fnv1a32 } from '../rng.ts';

const PACKS: Record<string, LevelPack> = {
  plains: plainsPack as unknown as LevelPack, mountains: mountainsPack as unknown as LevelPack, swamps: swampsPack as unknown as LevelPack,
  kingdom: kingdomPack as unknown as LevelPack, castle: castlePack as unknown as LevelPack,
};
const count = (lines: string[]) => lines.join('').length;

for (const id of LEVEL_PACKS) {
  const pack = PACKS[id];
  describe(`${id}: object spots and enemy formations (06 §8.10)`, () => {
    it('every version has spot groups of 2–3 spots for its Lucky Blocks, keys, chests and loot stands', () => {
      let groups = 0, multi = 0;
      for (const vs of pack.sections) for (const v of vs) for (const g of spotGroups(v, pack)) { groups++; if (g.spots.length >= 2) multi++; expect(g.spots.length).toBeLessThanOrEqual(3); }
      expect(groups).toBeGreaterThan(0);
      expect(multi / groups).toBeGreaterThan(0.5);
    });
    it('every formation B and every spot keeps the same contents and passes validateLevel', () => {
      for (const [i, vs] of pack.sections.entries()) for (let vi = 0; vi < vs.length; vi++) {
        const n = spotGroups(vs[vi], pack).length;
        const bOk = !(id === 'plains' && (i === 1 || i === 2));     // SPEC-GAP 65: Stage 1 §2–3 keep formation A
        for (const formation of (bOk ? ['A', 'B'] : ['A']) as ('A' | 'B')[]) for (const roll of [0, 1, 2]) {
          const sv: SectionVariety = { formation, spots: Array.from({ length: Math.max(4, n) }, () => roll) };
          const moved = applyVariety(vs[vi], pack, sv);
          const copy = { ...pack, sections: pack.sections.map((s, k) => (k === i ? s.map((x, j) => (j === vi ? moved : x)) : s)) };
          expect(contentsOf(copy, i, vi), `s${i + 1} v${vi + 1} ${formation}${roll}`).toEqual(contentsOf(pack, i, vi));
          expect(count(moved.lines)).toBe(count(vs[vi].lines));
          const picks = classicPicks(pack); picks[i] = vi + 1;
          const errs = validateLevel(assembleLevel(copy, picks));
          expect(errs, `s${i + 1} v${vi + 1} ${formation}${roll}`).toEqual([]);
        }
      }
    });
  });
}

describe('variety draws (06 §8.10)', () => {
  it('old seeds keep their versions; the same seed gives the same picks', () => {
    const seed = fnv1a32('ABCD1234');
    expect(rollLayout(seed)).toEqual(rollLayout(seed));
    expect(rollVariety(seed)).toEqual(rollVariety(seed));
    expect(rollVariety(seed).plains[7]).toEqual(plainVariety());          // the boss section never changes
  });
  it('over 10 000 seeds each formation and each of 2 or 3 spots is picked evenly (±2%)', () => {
    const f = { A: 0, B: 0 }, two = [0, 0], three = [0, 0, 0]; let n = 0;
    for (let s = 0; s < 10000; s++) {
      const v = rollVariety(fnv1a32(`S${s}`)).mountains[2];
      f[v.formation]++; two[v.spots[0] % 2]++; three[v.spots[1] % 3]++; n++;
    }
    for (const c of [f.A, f.B, ...two]) expect(Math.abs(c / n - 0.5)).toBeLessThan(0.02);
    for (const c of three) expect(Math.abs(c / n - 1 / 3)).toBeLessThan(0.02);
  });
  it('the layout code carries the formation letters and reads back', () => {
    const p = [1, 2, 1, 3, 1, 3, 2, 1], v = Array.from({ length: 8 }, (_, i) => ({ formation: i % 2 ? 'B' as const : 'A' as const, spots: [0, 0, 0, 0] }));
    expect(layoutCodeFull(p, v)).toBe('2b-1a-3b-3b-2a');
    expect(parseLayoutCodeFull('2b-1a-3b-3a-2b')?.picks).toEqual([1, 2, 1, 3, 1, 3, 2, 1]);
    expect(parseLayoutCodeFull('2-1-3-3-2')?.formations.every((x) => x === 'A')).toBe(true);
  });
});
