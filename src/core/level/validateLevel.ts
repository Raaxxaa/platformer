// Level validation (06 §13.6). An empty list means the level is valid.
import { TILE_SIZE } from '../tuning.ts';
import { COMBAT_ARENA, LEVEL_RULES, MAIN_PATH, MERCHANT_FLOOR, STAGE_OBJECT_COUNTS, type StageLevelId } from '../../data/levelRules.ts';
import { kindAt, type LevelData, type LevelObject } from './loadLevel.ts';

/** Length of a polyline in tiles. */
export function pathLengthTiles(o: LevelObject): number {
  const p = o.points ?? [];
  let len = 0;
  for (let i = 1; i < p.length; i++) len += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
  return len / TILE_SIZE;
}

const inside = (x: number, y: number, r: LevelObject) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

export function validateLevel(d: LevelData): string[] {
  const errs: string[] = [];
  const of = (t: string) => d.objects.filter((o) => o.type === t);

  for (const o of d.objects) {
    if (!o.points && o.w > 0 && [o.x, o.y, o.w, o.h].some((v) => v % TILE_SIZE !== 0)) errs.push(`${o.type} #${o.id} is not tile-aligned`);
  }
  if (d.kind !== 'stage') {
    if (of('player_start').length !== 1) errs.push(`player_start: expected 1, found ${of('player_start').length}`);
    return errs;
  }
  const rule = LEVEL_RULES[d.id as StageLevelId];
  if (!rule) return [...errs, `unknown stage level ${d.id}`];

  // Counts (06 §8.4, §13.4 "Exactly").
  for (const [t, n] of Object.entries(STAGE_OBJECT_COUNTS)) {
    const found = of(t).length;
    if (found !== n) errs.push(`${t}: expected ${n}, found ${found}`);
  }
  const stands = of('loot_stand').map((o) => o.props.kind).sort();
  if (stands.length === 2 && (stands[0] !== 'ability' || stands[1] !== 'weapon')) errs.push(`loot_stand kinds: expected weapon + ability, found ${stands.join(', ')}`);
  const warnings = of('dragon_warning').length;
  if (warnings !== (rule.sideArena ? 1 : 0)) errs.push(`dragon_warning: expected ${rule.sideArena ? 1 : 0}, found ${warnings}`);
  const sections = of('section').map((o) => Number(o.props.index)).sort((a, b) => a - b);
  if (sections.join() !== '1,2,3,4,5,6,7,8') errs.push(`section indexes: expected 1–8, found ${sections.join(', ')}`);

  // Enemies (06 §8.2, 05 §9.5).
  const enemies = of('enemy');
  const allowed = new Set<string>([...Object.keys(rule.regularMix), rule.elite]);
  const counts = new Map<string, number>();
  for (const e of enemies) {
    const id = String(e.props.enemy);
    if (!allowed.has(id)) errs.push(`enemy #${e.id}: ${id} is not a ${d.id} enemy`);
    counts.set(id, (counts.get(id) ?? 0) + 1);
    if (Number(e.props.wave ?? 0) >= 1 && !e.props.arena) errs.push(`enemy #${e.id}: wave spawn without an arena`);
  }
  for (const [id, n] of Object.entries(rule.regularMix)) {
    if ((counts.get(id) ?? 0) !== n) errs.push(`${id}: expected ${n}, found ${counts.get(id) ?? 0}`);
  }
  if ((counts.get(rule.elite) ?? 0) !== rule.elites) errs.push(`${rule.elite}: expected ${rule.elites}, found ${counts.get(rule.elite) ?? 0}`);

  // Arenas (06 §9, 04 §9.2).
  const arenas = of('arena');
  const doors = of('arena_door');
  const combat = arenas.filter((a) => a.props.kind === 'combat');
  const boss = arenas.filter((a) => a.props.kind === 'boss');
  if (combat.length !== 1) errs.push(`combat arena: expected 1, found ${combat.length}`);
  if (boss.length !== 1) errs.push(`boss arena: expected 1, found ${boss.length}`);
  const side = arenas.filter((a) => a.props.kind === 'side').length;
  if (side !== (rule.sideArena ? 1 : 0)) errs.push(`side arena: expected ${rule.sideArena ? 1 : 0}, found ${side}`);
  for (const a of combat) {
    const tw = a.w / TILE_SIZE, th = a.h / TILE_SIZE;
    if (tw < COMBAT_ARENA.minW || tw > COMBAT_ARENA.maxW || th < COMBAT_ARENA.minH || th > COMBAT_ARENA.maxH) errs.push(`combat arena ${a.props.id}: ${tw}×${th} tiles is outside 34–40 × 14–20`);
    const n = doors.filter((dr) => dr.props.arena === a.props.id).length;
    if (n !== COMBAT_ARENA.doors) errs.push(`combat arena ${a.props.id}: expected ${COMBAT_ARENA.doors} doors, found ${n}`);
    for (const e of enemies) {
      if (Number(e.props.wave ?? 0) === 0 && inside(e.x, e.y - 1, a)) errs.push(`enemy #${e.id}: placed (non-wave) spawn inside combat arena ${a.props.id}`);
    }
  }
  for (const a of boss) {
    if (a.props.boss !== rule.boss) errs.push(`boss arena ${a.props.id}: boss is ${a.props.boss}, expected ${rule.boss}`);
    if (a.w !== rule.bossArena.w || a.h !== rule.bossArena.h) errs.push(`boss arena ${a.props.id}: ${a.w}×${a.h} px, expected ${rule.bossArena.w}×${rule.bossArena.h}`);
    const roles = doors.filter((dr) => dr.props.arena === a.props.id).map((dr) => dr.props.role).sort().join();
    if (roles !== 'entry,exit') errs.push(`boss arena ${a.props.id}: expected an entry and an exit door, found ${roles || 'none'}`);
  }
  for (const dr of doors) {
    if (!arenas.some((a) => a.props.id === dr.props.arena)) errs.push(`arena_door #${dr.id}: arena ${dr.props.arena} does not exist`);
  }

  // Timed doors and chests (06 §9.5).
  const doorIds = new Set(of('timed_door').map((o) => String(o.props.id)));
  for (const c of of('timed_chest')) if (!doorIds.has(String(c.props.door))) errs.push(`timed_chest #${c.id}: door ${c.props.door} does not exist`);

  // Blink blocks lie fully on solid tiles.
  for (const b of of('blink_block')) {
    for (let ty = b.y / TILE_SIZE; ty < (b.y + b.h) / TILE_SIZE; ty++)
      for (let tx = b.x / TILE_SIZE; tx < (b.x + b.w) / TILE_SIZE; tx++)
        if (kindAt(d, tx, ty) !== 'solid') { errs.push(`blink_block #${b.id}: tile (${tx}, ${ty}) is not solid`); ty = Infinity; break; }
  }

  // Merchant spot: flat open floor 112 px each side (06 §11.3).
  for (const m of of('merchant_spot')) {
    const floorTy = Math.floor(m.y / TILE_SIZE);
    let ok = true;
    for (let x = m.x - MERCHANT_FLOOR.side; x <= m.x + MERCHANT_FLOOR.side && ok; x += TILE_SIZE / 2) {
      const tx = Math.floor(x / TILE_SIZE);
      if (kindAt(d, tx, floorTy) !== 'solid') ok = false;
      for (let r = 1; r <= MERCHANT_FLOOR.openRows; r++) if (kindAt(d, tx, floorTy - r) !== 'empty') ok = false;
    }
    if (!ok) errs.push(`merchant_spot #${m.id}: needs ${MERCHANT_FLOOR.side} px of flat open floor on each side`);
  }

  // Main path and size.
  for (const p of of('main_path')) {
    const len = pathLengthTiles(p);
    if (len < MAIN_PATH.min || len > MAIN_PATH.max) errs.push(`main_path: ${len.toFixed(1)} tiles is outside ${MAIN_PATH.min}–${MAIN_PATH.max}`);
  }
  if (d.widthTiles > rule.maxSize.w || d.heightTiles > rule.maxSize.h) errs.push(`size ${d.widthTiles}×${d.heightTiles} is larger than ${rule.maxSize.w}×${rule.maxSize.h}`);
  return errs;
}
