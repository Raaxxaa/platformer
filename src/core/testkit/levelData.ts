// Builds LevelData in tests from ASCII rows (06 §13.3 characters) and objects in px.
import type { LevelData, LevelObject } from '../level/loadLevel.ts';

const GID: Record<string, number> = { '.': 0, '#': 1, '=': 2, I: 3, '~': 4, '^': 5, v: 6, '<': 7, '>': 8 };

export function levelFrom(rows: string[], objects: Omit<LevelObject, 'id'>[], id: LevelData['id'] = 'plains'): LevelData {
  const h = rows.length, w = rows[0].length;
  const tiles = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => { tiles[y * w + x] = GID[c] ?? 0; }));
  return { id, kind: 'stage', stage: 1, biome: id, widthTiles: w, heightTiles: h, tiles,
    objects: objects.map((o, i) => ({ ...o, id: i + 1 })) };
}

export const T = 16;
/** A point object at tile (tx, ty) with a feet anchor. */
export const feet = (type: string, tx: number, ty: number, props: LevelObject['props'] = {}): Omit<LevelObject, 'id'> =>
  ({ type, x: tx * T + 8, y: ty * T + 16, w: 0, h: 0, props });
/** A rect object in tiles. */
export const rect = (type: string, tx: number, ty: number, tw: number, th: number, props: LevelObject['props'] = {}): Omit<LevelObject, 'id'> =>
  ({ type, x: tx * T, y: ty * T, w: tw * T, h: th * T, props });

/** 46 × 20 tiles. Boss arena boss1: inner x 4–39, y 3–16 (576 × 224 px); entry door x 3, exit door x 40 (rows 14–16); floor row 17. */
export function bossLevel() {
  const rows: string[] = [];
  for (let y = 0; y < 20; y++) {
    let r = '';
    for (let x = 0; x < 46; x++) {
      const wall = (x === 3 || x === 40) && y <= 13;
      const ceil = y === 2 && x >= 3 && x <= 40;
      r += y >= 17 || wall || ceil || x === 0 || x === 45 ? '#' : '.';
    }
    rows.push(r);
  }
  return levelFrom(rows, [
    feet('player_start', 1, 16),
    rect('arena', 4, 3, 36, 14, { id: 'boss1', kind: 'boss', boss: 'great_boar', entry: 'left' }),
    rect('arena_door', 3, 14, 1, 3, { arena: 'boss1', role: 'entry' }),
    rect('arena_door', 40, 14, 1, 3, { arena: 'boss1', role: 'exit' }),
  ]);
}
