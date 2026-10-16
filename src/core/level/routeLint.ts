// Main-path movement-limit lint for level design (06 §8.5). Reports `section, vertex index, problem`.
import { ROUTE, TILE_SIZE } from '../tuning.ts';
import { kindAt, type LevelData } from './loadLevel.ts';

const standable = (k: string) => k === 'solid' || k === 'ice' || k === 'oneway';
const solid = (k: string) => k === 'solid' || k === 'ice';

/** True if the climb from A to B goes up a wall-jump shaft: walls 3–5 tiles apart around it. */
function inShaft(d: LevelData, ax: number, ay: number, bx: number, by: number): boolean {
  if (Math.abs(ax - bx) > ROUTE.SHAFT_MAX - 1) return false;   // the climb starts and ends between (or on) the walls
  const row = Math.round((ay + by) / 2);
  const cx = Math.round((ax + bx) / 2);
  let l = -1, r = -1;
  for (let x = cx; x >= cx - ROUTE.SHAFT_MAX - 1; x--) if (solid(kindAt(d, x, row))) { l = x; break; }
  for (let x = cx; x <= cx + ROUTE.SHAFT_MAX + 1; x++) if (solid(kindAt(d, x, row))) { r = x; break; }
  if (l < 0 || r < 0) return false;
  const inner = r - l - 1;
  return inner >= ROUTE.SHAFT_MIN && inner <= ROUTE.SHAFT_MAX;
}

export function sectionAt(d: LevelData, px: number, py: number): number {
  const s = d.objects.find((o) => o.type === 'section' && px >= o.x && px < o.x + o.w && py >= o.y && py < o.y + o.h);
  return s ? Number(s.props.index) : 0;
}

export function routeLint(d: LevelData): string[] {
  const path = d.objects.find((o) => o.type === 'main_path');
  if (!path?.points) return ['no main_path'];
  const pts = path.points.map((p) => ({ px: p.x, py: p.y, tx: Math.floor(p.x / TILE_SIZE), ty: Math.floor(p.y / TILE_SIZE) }));
  const out: string[] = [];
  pts.forEach((p, i) => {
    if (solid(kindAt(d, p.tx, p.ty))) out.push(`section ${sectionAt(d, p.px, p.py)}, vertex ${i}: inside a solid tile`);
  });
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const sec = sectionAt(d, b.px, b.py);
    const late = sec >= ROUTE.LATE_SECTION;
    const where = `section ${sec}, vertex ${i}`;
    const rise = a.ty - b.ty;
    if (rise > 0 && !inShaft(d, a.tx, a.ty, b.tx, b.ty)) {
      if (kindAt(d, b.tx, b.ty + 1) === 'oneway') {
        const max = late ? ROUTE.ONEWAY_RISE_LATE : ROUTE.ONEWAY_RISE;
        if (rise > max) out.push(`${where}: rise of ${rise} tiles onto a one-way platform (max ${max})`);
      } else {
        const max = late ? ROUTE.RISE_LATE : ROUTE.RISE;
        if (rise > max) out.push(`${where}: rise of ${rise} tiles (max ${max})`);
      }
    }
    // Gap: the longest run of columns between the two vertices with nothing to stand on between their heights.
    const top = Math.min(a.ty, b.ty) + 1, bottom = Math.max(a.ty, b.ty) + 1;
    let run = 0, worst = 0;
    for (let x = Math.min(a.tx, b.tx) + 1; x < Math.max(a.tx, b.tx); x++) {
      let ok = false;
      for (let y = top; y <= bottom && !ok; y++) ok = standable(kindAt(d, x, y));
      run = ok ? 0 : run + 1;
      worst = Math.max(worst, run);
    }
    const gapMax = late ? ROUTE.GAP_LATE : ROUTE.GAP;
    if (worst > gapMax) out.push(`${where}: gap of ${worst} tiles (max ${gapMax})`);
  }
  return out;
}
