// Shared grey-box drawing (placeholder art for M1–M2).
import Phaser from 'phaser';
import type { TileGrid } from '../core/level/tiles.ts';
import type { MoveStateId } from '../core/player/body.ts';
import { TILE_SIZE } from '../core/tuning.ts';

export const COLOR = {
  solid: 0x4a4f63,
  oneway: 0x8a90a8,
  hurtbox: 0x00ff00,
} as const;
const ONEWAY_STRIP = 4;   // px, one-way tiles are drawn as a strip at the tile top
export const NOSE = 3;    // px, marks the facing side

export const STATE_COLOR: Record<MoveStateId, number> = {
  ground: 0xe8e8f0, air: 0x9ad0ff, dash: 0xffd84a, slide: 0xffd84a, wallSlide: 0x7affb0, ledgeClimb: 0xff9a3c,
  diveWindup: 0xff5a5a, diveFall: 0xff5a5a, diveLand: 0xff5a5a, crawl: 0xc08aff,
  hurt: 0xe8e8f0, forced: 0xe8e8f0, minecart: 0xe8e8f0, dead: 0xe8e8f0,
};

/** Solid tiles as merged row runs; one-way tiles as a strip at the tile top. */
export function drawLevel(scene: Phaser.Scene, grid: TileGrid): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  for (let ty = 0; ty < grid.h; ty++) {
    let tx = 0;
    while (tx < grid.w) {
      if (grid.isSolidTile(tx, ty)) {
        const start = tx;
        while (tx < grid.w && grid.isSolidTile(tx, ty)) tx++;
        g.fillStyle(COLOR.solid, 1).fillRect(start * TILE_SIZE, ty * TILE_SIZE, (tx - start) * TILE_SIZE, TILE_SIZE);
      } else {
        if (grid.kindAt(tx, ty) === 'oneway') g.fillStyle(COLOR.oneway, 1).fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, ONEWAY_STRIP);
        tx++;
      }
    }
  }
  return g;
}
