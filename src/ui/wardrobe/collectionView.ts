// The collection grid, shared by the wardrobe's Collection tab and the Records LOOKS tab (09 §6).
import type Phaser from 'phaser';
import { UI_COLOR } from '../../data/uiText.ts';
import type { CollectionEntry } from './collection.ts';

export interface GridSpec { x: number; y: number; cols: number; cell: number; icon: number }

/** Owned items in full color; the rest a dark silhouette. Returns each cell's rectangle for tap targets. */
export function drawCollectionGrid(scene: Phaser.Scene, c: Phaser.GameObjects.Container, entries: readonly CollectionEntry[], g: GridSpec,
  selected: number | null): { x: number; y: number; w: number; h: number; i: number }[] {
  const gfx = scene.add.graphics(); c.add(gfx);
  const cells: { x: number; y: number; w: number; h: number; i: number }[] = [];
  entries.forEach((e, i) => {
    const x = g.x + (i % g.cols) * g.cell, y = g.y + Math.floor(i / g.cols) * g.cell, off = (g.cell - g.icon) / 2;
    gfx.fillStyle(UI_COLOR.ink, 1).fillRect(x + 1, y + 1, g.cell - 2, g.cell - 2);
    if (selected === i) gfx.lineStyle(1, UI_COLOR.highlight, 1).strokeRect(x + 0.5, y + 0.5, g.cell - 1, g.cell - 1);
    // PLACEHOLDER until ART10 icons: a colored square (owned) or a near-black one (not owned).
    gfx.fillStyle(e.owned ? e.hex : 0x3c364a, 1).fillRect(x + off, y + off, g.icon, g.icon);
    cells.push({ x, y, w: g.cell, h: g.cell, i });
  });
  return cells;
}
