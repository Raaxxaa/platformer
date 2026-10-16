// Phaser views for the level art: terrain tiles and parallax (08 §9–10). They read state; they never change it.
import Phaser from 'phaser';
import type { TileGrid } from '../../core/level/tiles.ts';
import { DEPTH, PARALLAX, TILESET, VIEW } from '../../data/art.ts';
import { BIOME } from '../assets/loadAssets.ts';
import { decoTile, terrainTile } from './autotile.ts';

/** Terrain (blob autotiles) at depth 20 and auto-deco at depth 10 (08 §9.2–9.4). */
export function drawTerrain(scene: Phaser.Scene, grid: TileGrid): void {
  const terrain: number[][] = [], deco: number[][] = [];
  for (let ty = 0; ty < grid.h; ty++) {
    const t: number[] = [], d: number[] = [];
    for (let tx = 0; tx < grid.w; tx++) {
      t.push(terrainTile(grid, tx, ty)?.index ?? -1);
      d.push(decoTile(grid, tx, ty) ?? -1);
    }
    terrain.push(t); deco.push(d);
  }
  const key = `tiles_${BIOME}`;
  for (const [data, depth] of [[deco, DEPTH.deco], [terrain, DEPTH.terrain]] as const) {
    const map = scene.make.tilemap({ data: data as number[][], tileWidth: TILESET.tile, tileHeight: TILESET.tile });
    const set = map.addTilesetImage(key, key, TILESET.tile, TILESET.tile, TILESET.margin, TILESET.spacing)!;
    map.createLayer(0, set, 0, 0)!.setDepth(depth);
  }
}

/** Three camera-fixed parallax layers over a sky-top fill (08 §10.1). */
export class Parallax {
  private readonly layers: Phaser.GameObjects.TileSprite[] = [];
  private readonly levelHeightPx: number;
  constructor(scene: Phaser.Scene, levelHeightPx: number) {
    this.levelHeightPx = levelHeightPx;
    const set = PARALLAX[BIOME];
    scene.cameras.main.setBackgroundColor(set.skyTop);
    for (let i = 0; i < 3; i++) {
      this.layers.push(scene.add.tileSprite(0, 0, VIEW.w, VIEW.h, `bg_${BIOME}_${i}`).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.parallax[i]));
    }
  }
  setVisible(on: boolean): void {
    for (const s of this.layers) s.setVisible(on);
  }

  update(camX: number, camY: number): void {
    const set = PARALLAX[BIOME];
    this.layers.forEach((s, i) => {
      s.tilePositionX = Math.round(camX * set.layers[i].fx);
      s.y = Math.round((this.levelHeightPx - VIEW.h - camY) * set.layers[i].fy);
    });
  }
}
