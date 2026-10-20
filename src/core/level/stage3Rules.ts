import { LEVEL_RULES, STAGE2_LEVEL as S2, STAGE3_LEVEL as S } from '../../data/levelRules.ts';
import { TILE_SIZE } from '../tuning.ts';
import { kindAt, type LevelData, type LevelObject } from './loadLevel.ts';

const contains = (o: LevelObject, x: number, y: number) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h;

/** Enemy Kingdom supplements (06 §8.2–8.4, §8.3 `kingdom` row, §9.4): regulars per section, cannons, rooftops, the side arena. */
export function stage3Errors(d: LevelData): string[] {
  if (d.id !== 'kingdom') return [];
  const errors: string[] = [];
  const rule = LEVEL_RULES.kingdom;
  const sections = d.objects.filter((o) => o.type === 'section');
  const section = (i: number) => sections.find((s) => Number(s.props.index) === i);
  for (const s of sections) {
    const index = Number(s.props.index), expected = S.regulars[index - 1];
    if (expected === undefined) continue;
    const count = d.objects.filter((o) => o.type === 'enemy' && Object.hasOwn(rule.regularMix, String(o.props.enemy)) && contains(s, o.x, o.y - 1)).length;
    if (count !== expected) errors.push(`section ${index}: expected ${expected} regulars, found ${count}`);
  }
  for (const index of S.cannonSections) {
    const s = section(index);
    const n = s ? d.objects.filter((o) => o.type === 'cannon' && contains(s, o.x, o.y)).length : 0;
    if (n < S.cannons) errors.push(`kingdom: section ${index} needs at least ${S.cannons} cannons, found ${n}`);
  }
  // §4: the skip route runs over rooftops at least 20 tiles above the street (the main path).
  const s4 = section(4), path = d.objects.find((o) => o.type === 'main_path')?.points ?? [];
  if (s4) {
    const street = Math.max(...path.filter((p) => contains(s4, p.x, p.y)).map((p) => Math.floor(p.y / TILE_SIZE)), 0);
    let roof = false;
    for (let y = s4.y / TILE_SIZE; y <= street - S.roofHeight && !roof; y++) {
      for (let x = s4.x / TILE_SIZE; x < (s4.x + s4.w) / TILE_SIZE && !roof; x++) {
        if (kindAt(d, x, y) === 'solid' && kindAt(d, x, y - 1) === 'empty' && kindAt(d, x, y - 2) === 'empty' && kindAt(d, x + 1, y) === 'solid') roof = true;
      }
    }
    if (!roof) errors.push(`kingdom: section 4 needs rooftops at least ${S.roofHeight} tiles above the street`);
  }
  for (const arena of d.objects.filter((o) => o.type === 'arena' && o.props.kind === 'side')) {
    if (arena.w !== S2.sideWidth * TILE_SIZE || arena.h !== S2.sideHeight * TILE_SIZE) errors.push(`side arena ${arena.props.id}: expected ${S2.sideWidth}×${S2.sideHeight} tiles`);
    if (!d.objects.some((o) => o.type === 'dragon_warning' && arena.x - o.x - o.w >= S2.warningDistance)) errors.push(`side arena ${arena.props.id}: warning must be at least ${S2.warningDistance} px before its opening`);
  }
  return errors;
}
