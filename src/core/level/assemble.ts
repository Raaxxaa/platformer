// Section variants (06 §8.7): a level pack holds every version of every section; `assembleLevel` places the picked
// versions entry-on-exit and builds the LevelData exactly as tools/build_levels.py does (same cells, objects and ids).
import { TILE_SIZE as T } from '../tuning.ts';
import type { LevelData, LevelId, LevelObject } from './loadLevel.ts';

type Props = Record<string, string | number | boolean>;
export interface PackObject { type: string; x: number; y: number; w?: number; h?: number; props?: Props }
export interface SectionVersion {
  entry: [number, number]; exit: [number, number];
  lines: string[]; objects: PackObject[]; mainPath: [number, number][];
}
export interface LevelPack {
  levelId: LevelId; kind: LevelData['kind']; stage: LevelData['stage']; biome: string; height: number;
  origin: [number, number];
  legend: Record<string, { type: string } & Props>;
  /** Section numbers (1-based) with more than one version. */
  vary: number[];
  sections: SectionVersion[][];
}
/** One pick per section, 1-based version numbers, index = section − 1. */
export type Picks = number[];

const GID: Record<string, number> = { '.': 0, '#': 1, '=': 2, 'I': 3, '~': 4, '^': 5, 'v': 6, '<': 7, '>': 8 };
const SPECIAL: Record<string, [string, string, Props]> = {
  '%': ['.', 'collapsing_platform', { oneWay: false }], '&': ['.', 'collapsing_platform', { oneWay: true }],
  '+': ['.', 'cracked_wall', {}], '@': ['#', 'blink_block', {}],
};
const CENTER = new Set(['lucky_block', 'key', 'grapple_point', 'cannon', 'swinging_blade', 'firefly', 'guide_arrow']);

export const classicPicks = (p: LevelPack): Picks => p.sections.map(() => 1);

/** Every combination (3⁵ = 243 for a stage). */
export function allPicks(p: LevelPack): Picks[] {
  let out: Picks[] = [[]];
  for (const vs of p.sections) out = out.flatMap((pre) => vs.map((_, i) => [...pre, i + 1]));
  return out;
}

const widthOf = (v: SectionVersion) => Math.max(...v.lines.map((l) => l.length));

/** Horizontal runs, then identical runs stacked (build_levels.py merge_rects). */
function mergeRects(cells: [number, number][]): [number, number, number, number][] {
  const runs: [number, number, number][] = [];
  const ys = [...new Set(cells.map((c) => c[1]))].sort((a, b) => a - b);
  for (const y of ys) {
    const xs = cells.filter((c) => c[1] === y).map((c) => c[0]).sort((a, b) => a - b);
    let start = xs[0], prev = xs[0];
    for (const x of [...xs.slice(1), null]) {
      if (x !== null && x === prev + 1) { prev = x; continue; }
      runs.push([start, y, prev - start + 1]);
      if (x !== null) { start = x; prev = x; }
    }
  }
  const key = (r: [number, number, number]) => r.join(',');
  const runSet = new Set(runs.map(key));
  const used = new Set<string>();
  const rects: [number, number, number, number][] = [];
  for (const r of runs) {
    if (used.has(key(r))) continue;
    const [x, y, w] = r;
    let h = 1;
    while (runSet.has(key([x, y + h, w])) && !used.has(key([x, y + h, w]))) { used.add(key([x, y + h, w])); h += 1; }
    used.add(key(r));
    rects.push([x, y, w, h]);
  }
  return rects;
}

export function assembleLevel(pack: LevelPack, picks: Picks): LevelData {
  // Place: section 1 at the origin, each next entry anchor on the previous exit anchor.
  const placed: { x: number; y: number; v: SectionVersion }[] = [];
  let x = pack.origin[0], y = pack.origin[1];
  pack.sections.forEach((vs, i) => {
    const v = vs[(picks[i] ?? 1) - 1];
    if (!v) throw new Error(`assembleLevel: section ${i + 1} has no v${picks[i]}`);
    const prev = placed[i - 1];
    if (prev) { x = prev.x + prev.v.exit[0] + 1 - v.entry[0]; y = prev.y + prev.v.exit[1] - v.entry[1]; }
    placed.push({ x, y, v });
  });
  const x0 = Math.min(...placed.map((p) => p.x)), y0 = Math.min(...placed.map((p) => p.y));
  for (const p of placed) { p.x -= x0; p.y -= y0; }
  const W = Math.max(...placed.map((p) => p.x + widthOf(p.v)));
  const H = Math.max(pack.height, ...placed.map((p) => p.y + p.v.lines.length));

  // Cells (uncovered = solid), markers and special cells; later sections win.
  const grid = new Uint8Array(W * H).fill(1);
  const markers = new Map<number, { type: string } & Props>();
  const specials = new Map<number, string>();
  for (const p of placed) p.v.lines.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      const c = line[col];
      if (c === ' ') continue;
      const cx = p.x + col, cy = p.y + row, k = cy * W + cx;
      markers.delete(k); specials.delete(k);
      if (c in GID) grid[k] = GID[c];
      else if (c in SPECIAL) { grid[k] = GID[SPECIAL[c][0]]; specials.set(k, c); }
      else if (c in pack.legend) { grid[k] = 0; markers.set(k, pack.legend[c]); }
      else throw new Error(`assembleLevel: unknown character ${c}`);
    }
  });

  type Pt = { type: string; tx: number; ty: number; props: Props };
  const points: Pt[] = [];
  for (const [k, e] of markers) {
    const { type, ...props } = e;
    points.push({ type, tx: k % W, ty: Math.floor(k / W), props });
  }
  const rects: { type: string; x: number; y: number; w: number; h: number; props: Props }[] = [];
  const pathT: [number, number][] = [];
  const sections: typeof rects = [];
  placed.forEach((p, i) => {
    for (const o of p.v.objects) {
      if (o.w !== undefined) rects.push({ type: o.type, x: (o.x + p.x) * T, y: (o.y + p.y) * T, w: o.w * T, h: o.h! * T, props: { ...(o.props ?? {}) } });
      else points.push({ type: o.type, tx: o.x + p.x, ty: o.y + p.y, props: { ...(o.props ?? {}) } });
    }
    for (const [px, py] of p.v.mainPath) pathT.push([px + p.x, py + p.y]);
    sections.push({ type: 'section', x: p.x * T, y: p.y * T, w: widthOf(p.v) * T, h: p.v.lines.length * T, props: { index: i + 1 } });
  });
  rects.push(...sections);
  for (const c of ['%', '&', '+', '@']) {
    const cells = [...specials].filter(([, s]) => s === c).map(([k]) => [k % W, Math.floor(k / W)] as [number, number]);
    if (!cells.length) continue;
    const [, type, extra] = SPECIAL[c];
    let found: [number, number, number, number][];
    if (c === '%' || c === '&') {
      found = [];
      for (const yy of [...new Set(cells.map((q) => q[1]))].sort((a, b) => a - b)) {
        const xs = cells.filter((q) => q[1] === yy).map((q) => q[0]).sort((a, b) => a - b);
        let start = xs[0], prev = xs[0];
        for (const xx of [...xs.slice(1), null]) {
          if (xx !== null && xx === prev + 1) { prev = xx; continue; }
          found.push([start, yy, prev - start + 1, 1]);
          if (xx !== null) { start = xx; prev = xx; }
        }
      }
    } else found = mergeRects(cells);
    for (const [rx, ry, rw, rh] of found) rects.push({ type, x: rx * T, y: ry * T, w: rw * T, h: rh * T, props: { ...extra } });
  }

  const objects: LevelObject[] = [];
  let id = 1;
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  for (const p of [...points].sort((a, b) => a.ty - b.ty || a.tx - b.tx || cmp(a.type, b.type))) {
    const ax = p.tx * T + 8, ay = CENTER.has(p.type) ? p.ty * T + 8 : p.ty * T + 16;
    objects.push({ id: id++, type: p.type, x: ax, y: ay, w: 0, h: 0, props: p.props });
  }
  for (const r of rects) objects.push({ id: id++, type: r.type, x: r.x, y: r.y, w: r.w, h: r.h, props: r.props });
  if (pathT.length) {
    const pts = pathT.map(([tx, ty]) => ({ x: tx * T + 8, y: ty * T + 8 }));
    objects.push({ id: id++, type: 'main_path', x: pts[0].x, y: pts[0].y, w: 0, h: 0, points: pts, props: {} });
  }
  return { id: pack.levelId, kind: pack.kind, stage: pack.stage, biome: pack.biome, widthTiles: W, heightTiles: H, tiles: grid, objects };
}

/** What a version holds (06 §8.7): legend markers, objects (hints in order) and special cells. Positions don't count. */
export function contentsOf(pack: LevelPack, section: number, version: number): Record<string, unknown> {
  const v = pack.sections[section][version];
  const count = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1; };
  const markers: Record<string, number> = {}, specials: Record<string, number> = {}, objects: Record<string, number> = {};
  for (const line of v.lines) for (const c of line) {
    if (c in pack.legend) count(markers, JSON.stringify(pack.legend[c], Object.keys(pack.legend[c]).sort()));
    else if (c in SPECIAL) count(specials, c);
  }
  const hints: string[] = [];
  for (const o of v.objects) {
    if (o.type === 'hint') hints.push(String(o.props?.action));
    else count(objects, `${o.type}:${JSON.stringify(o.props ?? {}, Object.keys(o.props ?? {}).sort())}`);
  }
  return { markers, specials: { cracked: specials['+'] ?? 0, blink: specials['@'] ?? 0 }, objects, hints };
}

/** Main path length in tiles. */
export function mainPathLength(v: SectionVersion): number {
  let n = 0;
  for (let i = 1; i < v.mainPath.length; i++) n += Math.hypot(v.mainPath[i][0] - v.mainPath[i - 1][0], v.mainPath[i][1] - v.mainPath[i - 1][1]);
  return n;
}
