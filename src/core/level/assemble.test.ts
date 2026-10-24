import { describe, expect, it } from 'vitest';
import plainsJson from '../../../public/levels/plains.json';
import plainsPack from '../../../public/levels/plains.pack.json';
import { allPicks, assembleLevel, classicPicks, contentsOf, mainPathLength, type LevelPack } from './assemble.ts';
import { loadLevel } from './loadLevel.ts';
import { validateLevel } from './validateLevel.ts';
import { routeLint } from './routeLint.ts';

const pack = plainsPack as unknown as LevelPack;
const strip = (d: ReturnType<typeof loadLevel>) => ({ ...d, tiles: Array.from(d.tiles) });

describe('section assembly (06 §8.7)', () => {
  it('the classic picks give exactly public/levels/plains.json', () => {
    expect(strip(assembleLevel(pack, classicPicks(pack)))).toEqual(strip(loadLevel(plainsJson)));
  });
  it('every version keeps v1 entry and exit heights and the open seam', () => {
    for (const [i, vs] of pack.sections.entries()) for (const v of vs) {
      expect([i, v.entry[1], v.exit[1]]).toEqual([i, vs[0].entry[1], vs[0].exit[1]]);
      // Floor row at both anchors, 4 open rows above (join test).
      for (const [ax, ay] of [v.entry, v.exit]) {
        expect('#='.includes(v.lines[ay][ax]), `s${i + 1} floor at ${ax},${ay}`).toBe(true);
        for (let k = 1; k <= 4; k++) expect('#=~'.includes(v.lines[ay - k][ax] ?? '#'), `s${i + 1} open ${ax},${ay - k}`).toBe(false);
      }
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

describe('every Plains version in place (06 §8.7)', async () => {
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
        const b = createPlayerBody(p.x, Math.floor(p.y / 16) * 16 + 16);
        const fits = boxFree(g, b.x, b.y, b.w, b.h) || boxFree(g, b.x, b.y, b.w, MOVE.BOX_H_LOW);
        if (!fits || !isGrounded(b, g, 0)) bad.push(`vertex ${k} (${Math.floor(p.x / 16)}, ${Math.floor(p.y / 16)})`);
      });
      expect(bad).toEqual([]);
      expect(perSection(d)).toEqual(classic);
    });
  }
});

describe('the Old Grove hollow can be climbed out of (06 §8.5 single-jump limits)', async () => {
  const { kindAt } = await import('./loadLevel.ts');
  const { ROUTE } = await import('../tuning.ts');
  /** Standing cells reachable by single jumps (rise 3 onto a plank, 5 onto ground), falls up to 8 across; 2 tiles of head room. */
  function reachable(d: ReturnType<typeof assembleLevel>, from: [number, number]): Set<string> {
    const solid = (k: string) => k === 'solid' || k === 'ice';
    const stand = (k: string) => solid(k) || k === 'oneway';
    const feet = (x: number, y: number) => kindAt(d, x, y) === 'empty' && kindAt(d, x, y - 1) === 'empty' && stand(kindAt(d, x, y + 1));
    const open = (x: number, y0: number, y1: number) => { for (let y = y0; y <= y1; y++) if (solid(kindAt(d, x, y))) return false; return true; };
    const seen = new Set<string>([from.join()]), todo: [number, number][] = [from];
    while (todo.length) {
      const [ax, ay] = todo.pop()!;
      for (let bx = ax - 8; bx <= ax + 8; bx++) for (let by = ay - 6; by <= ay + 30; by++) {
        if (seen.has(`${bx},${by}`) || !feet(bx, by)) continue;
        const rise = ay - by, dx = Math.abs(bx - ax);
        const max = kindAt(d, bx, by + 1) === 'oneway' ? ROUTE.ONEWAY_RISE : ROUTE.RISE;
        if (rise > max || (rise > 0 && dx > 4) || (rise <= 0 && dx > 8)) continue;
        // Head room: straight up in A's column to B's head, and B's own column.
        if (rise > 0 && !(open(ax, by - 2, ay - 1) && open(bx, by - 2, by))) continue;
        if (rise <= 0 && !open(bx, by - 2, by)) continue;
        seen.add(`${bx},${by}`); todo.push([bx, by]);
      }
    }
    return seen;
  }
  // v1's hollow (the original) is climbed by wall-jumping its tall left wall, which this single-jump check can't model.
  for (const v of [2, 3]) {
    it(`v${v}: from the hollow floor you can reach the road again`, () => {
      const picks = classicPicks(pack); picks[3] = v;
      const d = assembleLevel(pack, picks);
      const s4 = d.objects.find((o) => o.type === 'section' && o.props.index === 4)!;
      const chest = d.objects.find((o) => o.type === 'key_chest' && o.x >= s4.x && o.x < s4.x + s4.w && o.y > 40 * 16)!;
      const start: [number, number] = [Math.floor(chest.x / 16), Math.floor(chest.y / 16) - 1];
      const got = reachable(d, start);
      const road = [...got].map((k) => k.split(',').map(Number)).filter(([x, y]) => y === 37 && x >= s4.x / 16 && x < (s4.x + s4.w) / 16);
      expect(road.length, `v${v}: no way back up to the road`).toBeGreaterThan(0);
    });
  }
});
