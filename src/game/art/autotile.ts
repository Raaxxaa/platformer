// Blob autotiling and tile picking (08 §9.2–9.4). Pure: no Phaser.
import type { TileGrid } from '../../core/level/tiles.ts';
import { TILESET } from '../../data/art.ts';

const N = 1, NE = 2, E = 4, SE = 8, S = 16, SW = 32, W = 64, NW = 128;

/** Cosmetic hash from 08 §9.2 (never core RNG). */
export function hash2(x: number, y: number, salt: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Keep each diagonal bit only if both neighbouring cardinal bits are set. */
export function reduceMask(m: number): number {
  let r = m & (N | E | S | W);
  if ((m & NE) && (m & N) && (m & E)) r |= NE;
  if ((m & SE) && (m & S) && (m & E)) r |= SE;
  if ((m & SW) && (m & S) && (m & W)) r |= SW;
  if ((m & NW) && (m & N) && (m & W)) r |= NW;
  return r;
}

/** The 47 reduced masks, sorted ascending: blob index = position. */
export const BLOB_MASKS: readonly number[] = [...new Set(Array.from({ length: 256 }, (_, m) => reduceMask(m)))].sort((a, b) => a - b);
const BLOB_INDEX = new Map(BLOB_MASKS.map((m, i) => [m, i]));

export function blobIndex(mask: number): number {
  return BLOB_INDEX.get(reduceMask(mask))!;
}

export const ONEWAY_COL = TILESET.onewayCols;
const SPIKE_COL: Partial<Record<string, number>> = TILESET.spikeCols;

function filled(g: TileGrid, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= g.w || ty >= g.h) return true;
  const k = g.baseKindAt(tx, ty);
  return k === 'solid' || k === 'ice';
}

export function onewayPiece(g: TileGrid, tx: number, ty: number): number {
  const l = tx > 0 && g.baseKindAt(tx - 1, ty) === 'oneway';
  const r = tx < g.w - 1 && g.baseKindAt(tx + 1, ty) === 'oneway';
  return l && r ? ONEWAY_COL.middle : l ? ONEWAY_COL.right : r ? ONEWAY_COL.left : ONEWAY_COL.single;
}

/** The tileset index for a terrain cell, or null when the cell draws nothing. */
export function terrainTile(g: TileGrid, tx: number, ty: number): { index: number } | null {
  const k = g.baseKindAt(tx, ty);
  const spike = SPIKE_COL[k];
  if (spike !== undefined) return { index: TILESET.onewayRow * TILESET.columns + spike };
  if (k === 'oneway') return { index: TILESET.onewayRow * TILESET.columns + onewayPiece(g, tx, ty) };
  if (k !== 'solid' && k !== 'ice') return null;
  const base = k === 'ice' ? TILESET.iceRow * TILESET.columns : 0;
  let m = 0;
  if (filled(g, tx, ty - 1)) m |= N;
  if (filled(g, tx + 1, ty - 1)) m |= NE;
  if (filled(g, tx + 1, ty)) m |= E;
  if (filled(g, tx + 1, ty + 1)) m |= SE;
  if (filled(g, tx, ty + 1)) m |= S;
  if (filled(g, tx - 1, ty + 1)) m |= SW;
  if (filled(g, tx - 1, ty)) m |= W;
  if (filled(g, tx - 1, ty - 1)) m |= NW;
  const i = blobIndex(m);
  if (i === BLOB_MASKS.length - 1 && k === 'solid') {
    const v = hash2(tx, ty, 1) % TILESET.fullVariants;
    if (v > 0) return { index: TILESET.onewayRow * TILESET.columns + (v - 1) };
  }
  return { index: base + i };
}

/** 08 §9.4 auto-decoration for an empty cell: a tileset index or null. */
export function decoTile(g: TileGrid, tx: number, ty: number): number | null {
  if (g.baseKindAt(tx, ty) !== 'empty') return null;
  const T = TILESET;
  if (ty + 1 < g.h && filled(g, tx, ty + 1) && hash2(tx, ty, 3) % 100 < T.topDecoChance)
    return T.topDecoRow * T.columns + T.topDecoCol + (hash2(tx, ty, 2) % T.topDecoCount);
  if (ty > 0 && filled(g, tx, ty - 1) && hash2(tx, ty, 5) % 100 < T.hangDecoChance)
    return T.hangDecoRow * T.columns + T.hangDecoCol + (hash2(tx, ty, 4) % T.hangDecoCount);
  return null;
}
