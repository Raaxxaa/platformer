// 06 §8.10 (M18): more variety per seed. Inside a picked section version, each spot object (Lucky Block, key, chests,
// loot stand) may sit at one of 2–3 spots, and enemies use formation A (as authored) or B (each one mirrored along
// its own floor). A spot or a mirrored place is only used where the column around it is the same as at the original
// tile and every column in between is too, so it is reached the same way, on the same floor, in the same section.
import { VARIETY } from '../../data/levelRules.ts';
import type { LevelPack, PackObject, SectionVersion } from './assemble.ts';

export type Formation = 'A' | 'B';
/** One section's draws: its formation and its spot rolls (each 0–5). */
export interface SectionVariety { formation: Formation; spots: number[] }
export const plainVariety = (): SectionVariety => ({ formation: 'A', spots: Array.from({ length: VARIETY.spotDraws }, () => 0) });

type Item = { ch: string | null; obj: number | null; col: number; row: number; type: string; props: Record<string, unknown> };

const at = (v: SectionVersion, col: number, row: number): string => (row < 0 || row >= v.lines.length ? '#' : v.lines[row][col] ?? '.');
function items(v: SectionVersion, pack: LevelPack): Item[] {
  const out: Item[] = [];
  v.lines.forEach((line, row) => { for (let col = 0; col < line.length; col++) {
    const l = pack.legend[line[col]]; if (l) { const { type, ...props } = l; out.push({ ch: line[col], obj: null, col, row, type, props }); }
  } });
  v.objects.forEach((o: PackObject, i) => { if (o.w === undefined) out.push({ ch: null, obj: i, col: o.x, row: o.y, type: o.type, props: o.props ?? {} }); });
  return out;
}
/** A column's shape around a row, with every marker read as air. */
function column(v: SectionVersion, pack: LevelPack, col: number, row: number): string {
  let s = '';
  for (let r = row - VARIETY.above; r <= row + VARIETY.below; r++) { const c = at(v, col, r); s += c in pack.legend ? '.' : c; }
  return s;
}
function blocked(v: SectionVersion, col: number, row: number): boolean {
  for (const o of v.objects) if (o.w !== undefined && o.type !== 'hint' && col >= o.x && col < o.x + o.w && row >= o.y && row < o.y + (o.h ?? 1)) return true;
  return col < 1 || col >= Math.max(...v.lines.map((l) => l.length)) - 1;
}
/** Columns from `col` towards `col + d` all share the original's shape: the same floor, no wall in between. */
function sameRun(v: SectionVersion, pack: LevelPack, col: number, row: number, d: number): boolean {
  const ref = column(v, pack, col, row), step = Math.sign(d);
  for (let c = col + step; c !== col + d + step; c += step) if (column(v, pack, c, row) !== ref || blocked(v, c, row)) return false;
  return true;
}

/** The spot groups of a version (06 §8.10), in reading order: each the original tile, then up to 2 more. */
export function spotGroups(v: SectionVersion, pack: LevelPack): { item: Item; spots: [number, number][] }[] {
  const all = items(v, pack), taken = new Set(all.map((i) => `${i.col},${i.row}`));
  const out: { item: Item; spots: [number, number][] }[] = [];
  for (const it of all) {
    if (!(VARIETY.spotTypes as readonly string[]).includes(it.type) || it.props.arena !== undefined) continue;
    const spots: [number, number][] = [[it.col, it.row]];
    for (const d of VARIETY.spotOffsets) {
      if (spots.length >= VARIETY.maxSpots) break;
      const c = it.col + d;
      if (taken.has(`${c},${it.row}`) || spots.some(([x]) => Math.abs(x - c) < 3) || !sameRun(v, pack, it.col, it.row, d)) continue;
      spots.push([c, it.row]); taken.add(`${c},${it.row}`);
    }
    out.push({ item: it, spots });
  }
  return out.sort((a, b) => a.item.row - b.item.row || a.item.col - b.item.col);
}

/** Formation B: each free enemy (not an arena wave) mirrored across its own floor run. */
function mirrored(v: SectionVersion, pack: LevelPack, it: Item, taken: Set<string>): number {
  let a = it.col, b = it.col;
  while (sameRun(v, pack, it.col, it.row, a - 1 - it.col)) a -= 1;
  while (sameRun(v, pack, it.col, it.row, b + 1 - it.col)) b += 1;
  const c = a + b - it.col;
  return taken.has(`${c},${it.row}`) ? it.col : c;
}

/** The version with this section's formation and spots applied (a copy; the pack is untouched). */
export function applyVariety(v: SectionVersion, pack: LevelPack, sv: SectionVariety): SectionVersion {
  if (sv.formation === 'A' && sv.spots.every((s) => s === 0)) return v;
  const out: SectionVersion = { ...v, lines: [...v.lines], objects: v.objects.map((o) => ({ ...o })) };
  const groups = spotGroups(v, pack);
  const moves: { it: Item; col: number }[] = [];
  groups.forEach((g, i) => { const roll = sv.spots[i] ?? 0; moves.push({ it: g.item, col: g.spots[roll % g.spots.length][0] }); });
  if (sv.formation === 'B') {
    const all = items(v, pack), taken = new Set(all.map((i) => `${i.col},${i.row}`));
    for (const g of groups) for (const [c, r] of g.spots) taken.add(`${c},${r}`);
    for (const it of all) {
      if (it.type !== 'enemy' || it.props.arena !== undefined || it.props.wave !== undefined) continue;
      const c = mirrored(v, pack, it, taken);
      if (c !== it.col) { taken.add(`${c},${it.row}`); moves.push({ it, col: c }); }
    }
  }
  // Clear every moved glyph first, then place, so moves never overwrite each other.
  for (const m of moves) if (m.it.ch !== null && m.col !== m.it.col) { const l = out.lines[m.it.row].split(''); l[m.it.col] = '.'; out.lines[m.it.row] = l.join(''); }
  for (const m of moves) {
    if (m.it.obj !== null) { if (m.col !== m.it.col) out.objects[m.it.obj] = { ...out.objects[m.it.obj], x: m.col }; continue; }
    const l = out.lines[m.it.row].split(''); l[m.col] = m.it.ch!; out.lines[m.it.row] = l.join('');
  }
  return out;
}
