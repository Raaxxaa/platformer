// Single-jump reach lint (06 §8.5). A platform floating in the air must have a step you can reach
// with ONE jump (rise up to ROUTE.ONEWAY_RISE onto a one-way platform, ROUTE.RISE onto a solid ledge)
// from ground or from another platform that is itself reachable. No double jump, wall jump or ability.
import { ROUTE, TILE_SIZE } from '../tuning.ts';
import { kindAt, type LevelData } from './loadLevel.ts';
import { sectionAt } from './routeLint.ts';

const solid = (k: string) => k === 'solid' || k === 'ice';
const standable = (k: string) => solid(k) || k === 'oneway';

/** Tiles a jump covers sideways: dash-jump gaps up to 7 tiles on level (06 §8.5, side paths), 4 when rising. */
const reachFor = (rise: number) => (rise >= 4 ? 3 : rise >= 1 ? 4 : 8);
/** Platforms with open air this many tiles under them are "floating"; terrain is solid below its surface. */
const AIR_UNDER = 4;

interface Spot { tx: number; ty: number }

const isFeet = (d: LevelData, tx: number, ty: number) => kindAt(d, tx, ty) === 'empty' && standable(kindAt(d, tx, ty + 1));
/** Things a player is meant to reach: loot, keys, chests and the exit. Main-path vertices count too. */
const GOALS = new Set(['key', 'key_chest', 'timed_chest', 'cursed_chest', 'lucky_block', 'loot_stand', 'merchant_spot', 'exit', 'ability_altar']);

/** `strict` uses the one-jump limits everywhere; otherwise sections from ROUTE.LATE_SECTION on get the double-jump limits. */
export function reachLint(d: LevelData, strict = true): string[] {
  const feet: Spot[] = [], byCol = new Map<number, Spot[]>();
  for (let ty = 0; ty < d.heightTiles - 1; ty++) for (let tx = 0; tx < d.widthTiles; tx++) {
    if (!isFeet(d, tx, ty)) continue;
    const c = { tx, ty }; feet.push(c);
    const l = byCol.get(tx); if (l) l.push(c); else byCol.set(tx, [c]);
  }
  const W = d.widthTiles, key = (c: Spot) => c.ty * W + c.tx;
  const floatingCell = (c: Spot) => {
    for (let y = c.ty + 2; y <= c.ty + 1 + AIR_UNDER; y++) if (kindAt(d, c.tx, y) === 'empty') return true;
    return false;
  };
  const runOf = (c: Spot): Spot[] => {
    const run = [c];
    for (let x = c.tx - 1; isFeet(d, x, c.ty); x--) run.push({ tx: x, ty: c.ty });
    for (let x = c.tx + 1; isFeet(d, x, c.ty); x++) run.push({ tx: x, ty: c.ty });
    return run;
  };
  // A run is a "platform" when every cell of it floats (bridges and ledges joined to terrain are ground).
  const runCache = new Map<number, Spot[] | null>();
  const platformRun = (c: Spot): Spot[] | null => {
    if (!runCache.has(key(c))) {
      const run = runOf(c), res = run.every(floatingCell) ? run : null;
      for (const r of run) runCache.set(key(r), res);
    }
    return runCache.get(key(c)) ?? null;
  };
  const late = (c: Spot) => !strict && sectionAt(d, c.tx * TILE_SIZE, c.ty * TILE_SIZE) >= ROUTE.LATE_SECTION;
  const maxRise = (b: Spot) => kindAt(d, b.tx, b.ty + 1) === 'oneway'
    ? (late(b) ? ROUTE.ONEWAY_RISE_LATE : ROUTE.ONEWAY_RISE) : (late(b) ? ROUTE.RISE_LATE : ROUTE.RISE);

  // Fixpoint: ground is reachable; a platform becomes reachable when one jump gets onto it from something reachable.
  const reach = new Set<number>(feet.filter((c) => !platformRun(c)).map(key));
  const canStep = (b: Spot): boolean => {
    for (let dx = -8; dx <= 8; dx++) for (const a of byCol.get(b.tx + dx) ?? []) {
      if (!reach.has(key(a))) continue;
      const rise = a.ty - b.ty;
      if (rise > maxRise(b) || Math.abs(dx) > reachFor(rise)) continue;
      if (rise > 0 && solid(kindAt(d, a.tx, a.ty - 1))) continue;   // no head room to jump
      return true;
    }
    return false;
  };
  for (let changed = true; changed;) {
    changed = false;
    for (const c of feet) if (!reach.has(key(c)) && canStep(c)) { reach.add(key(c)); changed = true; }
  }

  // Report only platforms that matter: one-way platforms, anything carrying a goal, short ledges (not roofs).
  const goals: Spot[] = [];
  for (const o of d.objects) {
    if (GOALS.has(o.type)) goals.push({ tx: Math.floor((o.x + o.w / 2) / TILE_SIZE), ty: Math.floor((o.y + o.h / 2) / TILE_SIZE) });
    if (o.type === 'main_path') for (const p of o.points ?? []) goals.push({ tx: Math.floor(p.x / TILE_SIZE), ty: Math.floor(p.y / TILE_SIZE) });
  }
  const bad = feet.filter((c) => {
    if (reach.has(key(c))) return false;
    const run = platformRun(c);
    if (!run) return false;
    const hasGoal = goals.some((g) => Math.abs(g.tx - c.tx) <= 1 && g.ty >= c.ty - 2 && g.ty <= c.ty);
    return hasGoal || kindAt(d, c.tx, c.ty + 1) === 'oneway' || run.length <= 10;
  });
  const out: string[] = [];
  bad.sort((p, q) => p.ty - q.ty || p.tx - q.tx);
  for (let i = 0; i < bad.length; i++) {
    let j = i;
    while (j + 1 < bad.length && bad[j + 1].ty === bad[i].ty && bad[j + 1].tx === bad[j].tx + 1) j++;
    out.push(`platform at tiles x ${bad[i].tx}-${bad[j].tx}, y ${bad[i].ty + 1} is too high to jump onto`);
    i = j;
  }
  return out;
}
