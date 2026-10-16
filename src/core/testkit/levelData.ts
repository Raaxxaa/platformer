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
