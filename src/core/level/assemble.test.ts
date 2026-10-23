import { describe, expect, it } from 'vitest';
import plainsJson from '../../../public/levels/plains.json';
import plainsPack from '../../../public/levels/plains.pack.json';
import mountainsJson from '../../../public/levels/mountains.json';
import mountainsPack from '../../../public/levels/mountains.pack.json';
import swampsJson from '../../../public/levels/swamps.json';
import swampsPack from '../../../public/levels/swamps.pack.json';
import kingdomJson from '../../../public/levels/kingdom.json';
import kingdomPack from '../../../public/levels/kingdom.pack.json';
import castleJson from '../../../public/levels/castle.json';
import castlePack from '../../../public/levels/castle.pack.json';
import { LEVEL_PACKS } from '../../data/run.ts';
import { allPicks, assembleLevel, classicPicks, contentsOf, mainPathLength, type LevelPack } from './assemble.ts';
import { loadLevel } from './loadLevel.ts';
import { validateLevel } from './validateLevel.ts';
import { routeLint } from './routeLint.ts';

const ALL: Record<string, { json: unknown; pack: LevelPack }> = {
  plains: { json: plainsJson, pack: plainsPack as unknown as LevelPack },
  mountains: { json: mountainsJson, pack: mountainsPack as unknown as LevelPack },
  swamps: { json: swampsJson, pack: swampsPack as unknown as LevelPack },
  kingdom: { json: kingdomJson, pack: kingdomPack as unknown as LevelPack },
  castle: { json: castleJson, pack: castlePack as unknown as LevelPack },
};
const strip = (d: ReturnType<typeof loadLevel>) => ({ ...d, tiles: Array.from(d.tiles) });
/** Open rows above an anchor, counted up to 4 (the join test). */
const openAbove = (lines: string[], [ax, ay]: [number, number]) => {
  let n = 0;
  while (n < 4 && !'#=~'.includes(lines[ay - n - 1]?.[ax] ?? '#')) n++;
  return n;
};

for (const id of LEVEL_PACKS) {
  const { json, pack } = ALL[id];
  describe(`${id}: section assembly (06 §8.7)`, () => {
    it('every varying section has 3 versions, the others only v1', () => {
      expect(pack.sections.map((vs, i) => (pack.vary.includes(i + 1) ? vs.length : -vs.length))).toEqual(pack.sections.map((_, i) => (pack.vary.includes(i + 1) ? 3 : -1)));
    });
    it(`the classic picks give exactly public/levels/${id}.json`, () => {
      expect(strip(assembleLevel(pack, classicPicks(pack)))).toEqual(strip(loadLevel(json as never)));
    });
    it('every version keeps v1 entry and exit heights and an open seam', () => {
      for (const [i, vs] of pack.sections.entries()) for (const v of vs) {
        expect([i, v.entry[1], v.exit[1]]).toEqual([i, vs[0].entry[1], vs[0].exit[1]]);
        // Floor row at both anchors, and at least as many open rows above (up to 4) as v1 has.
        for (const k of ['entry', 'exit'] as const) {
          const [ax, ay] = v[k];
          expect('#='.includes(v.lines[ay][ax]), `s${i + 1} floor at ${ax},${ay}`).toBe(true);
          expect(openAbove(v.lines, v[k]), `s${i + 1} open rows at ${k} ${ax},${ay}`).toBeGreaterThanOrEqual(openAbove(vs[0].lines, vs[0][k]));
        }
        expect(Math.max(...v.lines.map((l) => l.length)), `s${i + 1} width`).toBe(Math.max(...vs[0].lines.map((l) => l.length)));
        expect(v.lines.length, `s${i + 1} height`).toBe(vs[0].lines.length);
      }
    });
    it('every version has the same contents as v1 and a main path within ±10%', () => {
      for (const [i, vs] of pack.sections.entries()) {
        const c1 = contentsOf(pack, i, 0), l1 = mainPathLength(vs[0]);
        for (let v = 1; v < vs.length; v++) {
          expect(contentsOf(pack, i, v), `s${i + 1} v${v + 1}`).toEqual(c1);
          expect(Math.abs(mainPathLength(vs[v]) / l1 - 1), `s${i + 1} v${v + 1} length`).toBeLessThanOrEqual(0.1);
        }
      }
    });
    it('all combinations validate and pass routeLint', () => {
      const picks = allPicks(pack);
      expect(picks.length).toBe(pack.sections.reduce((n, vs) => n * vs.length, 1));
      for (const p of picks) {
        const d = assembleLevel(pack, p);
        expect([p.join(''), ...validateLevel(d)]).toEqual([p.join('')]);
        expect([p.join(''), ...routeLint(d)]).toEqual([p.join('')]);
      }
    }, 600_000);
  });

  describe(`every ${id} version in place (06 §8.7)`, async () => {
    const { levelGrid } = await import('./loadLevel.ts');
    const { sectionAt } = await import('./routeLint.ts');
    const { boxFree, isGrounded } = await import('../physics/collide.ts');
    const { createPlayerBody } = await import('../player/body.ts');
    const { MOVE } = await import('../tuning.ts');
    const perSection = (d: ReturnType<typeof assembleLevel>) => {
      const got: Record<number, string[]> = {};
      for (const o of d.objects.filter((x) => x.type === 'enemy' || x.type === 'hint' || ['lucky_block', 'key', 'key_chest', 'cursed_chest', 'timed_chest', 'merchant_spot', 'loot_stand'].includes(x.type))) {
        const s = sectionAt(d, o.x + o.w / 2, o.y + (o.h ? o.h / 2 : -1));
        (got[s] ??= []).push(`${o.type}:${o.props.enemy ?? o.props.action ?? ''}`);
      }
      for (const k of Object.keys(got)) got[Number(k)].sort();
      return got;
    };
    const classic = perSection(assembleLevel(pack, classicPicks(pack)));
    for (const [i, vs] of pack.sections.entries()) for (let v = 1; v < vs.length; v++) {
      it(`s${i + 1} v${v + 1}: path vertices standable, contents in the section`, () => {
        const picks = classicPicks(pack); picks[i] = v + 1;
        const d = assembleLevel(pack, picks), g = levelGrid(d);
        const bad: string[] = [];
        d.objects.find((o) => o.type === 'main_path')!.points!.forEach((p, k) => {
          if (sectionAt(d, p.x, p.y) !== i + 1) return;
          if (id === 'mountains' && i === 5) return;   // the minecart ride: the path is the cart's rail, not standing cells
          const b = createPlayerBody(p.x, Math.floor(p.y / 16) * 16 + 16);
          const fits = boxFree(g, b.x, b.y, b.w, b.h) || boxFree(g, b.x, b.y, b.w, MOVE.BOX_H_LOW);
          if (!fits || !isGrounded(b, g, 0)) bad.push(`vertex ${k} (${Math.floor(p.x / 16)}, ${Math.floor(p.y / 16)})`);
        });
        expect(bad).toEqual([]);
        expect(perSection(d)).toEqual(classic);
      });
    }
  });
}
