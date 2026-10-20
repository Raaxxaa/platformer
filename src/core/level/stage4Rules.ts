import { LEVEL_RULES, STAGE4_LEVEL as S } from '../../data/levelRules.ts';
import { TILE_SIZE } from '../tuning.ts';
import { kindAt, type LevelData, type LevelObject } from './loadLevel.ts';

const contains = (o: LevelObject, x: number, y: number) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h;

/** King's Castle supplements (06 §8.2-8.4, §8.3 `castle` row, 04 §9.2): regulars per section, blades, bridges, the cannon gallery, spikes in the floor, summon points. */
export function stage4Errors(d: LevelData): string[] {
  if (d.id !== 'castle') return [];
  const errors: string[] = [];
  const rule = LEVEL_RULES.castle;
  const sections = d.objects.filter((o) => o.type === 'section');
  const section = (i: number) => sections.find((s) => Number(s.props.index) === i);
  for (const s of sections) {
    const index = Number(s.props.index), expected = S.regulars[index - 1];
    if (expected === undefined) continue;
    const count = d.objects.filter((o) => o.type === 'enemy' && Object.hasOwn(rule.regularMix, String(o.props.enemy)) && contains(s, o.x, o.y - 1)).length;
    if (count !== expected) errors.push(`section ${index}: expected ${expected} regulars, found ${count}`);
  }
  const inSections = (o: LevelObject, list: readonly number[]) => list.some((i) => { const s = section(i); return !!s && contains(s, o.x, o.y); });
  const blades = d.objects.filter((o) => o.type === 'swinging_blade' && inSections(o, S.bladeSections)).length;
  if (blades < S.blades) errors.push(`castle: sections 3 and 6 need at least ${S.blades} swinging blades, found ${blades}`);
  const bridges = d.objects.filter((o) => o.type === 'collapsing_platform' && inSections(o, S.bladeSections)).length;
  if (bridges < S.bridges) errors.push(`castle: sections 3 and 6 need at least ${S.bridges} collapsing bridges, found ${bridges}`);
  const gs = section(S.gallerySection);
  const gallery = gs ? d.objects.filter((o) => o.type === 'cannon' && contains(gs, o.x, o.y)).length : 0;
  if (gallery < S.gallery) errors.push(`castle: section ${S.gallerySection} needs a cannon gallery of at least ${S.gallery} cannons, found ${gallery}`);
  // Spike floors: every spike tile sits in the ground (solid or spikes right under it).
  let spikes = 0;
  for (let y = 0; y < d.heightTiles - 1; y++) for (let x = 0; x < d.widthTiles; x++) {
    if (kindAt(d, x, y) !== 'spikeUp') continue;
    spikes++;
    const below = kindAt(d, x, y + 1);
    if (below !== 'solid' && below !== 'spikeUp') errors.push(`castle: spikes at tile (${x}, ${y}) float over ${below}`);
  }
  if (spikes === 0) errors.push('castle: needs spike floors');
  // Summon points of the King's arena: 2, 48 px from each wall (04 §9.2).
  for (const a of d.objects.filter((o) => o.type === 'arena' && o.props.kind === 'boss')) {
    const pts = d.objects.filter((o) => o.type === 'summon_point' && o.props.arena === a.props.id).sort((p, q) => p.x - q.x);
    if (pts.length !== 2 || Math.abs(pts[0].x - 8 - (a.x + S.summonInset - 8)) > 8 || Math.abs(a.x + a.w - pts[1].x - S.summonInset) > 8) errors.push(`boss arena ${a.props.id}: needs 2 summon points 48 px from the walls`);
  }
  void TILE_SIZE;
  return errors;
}
