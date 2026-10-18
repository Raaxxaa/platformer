// Level art (08 §9, §10.1, §8): terrain tiles, auto-deco, parallax, doors and guide arrows. Reads state; never changes it.
import Phaser from 'phaser';
import { decoTile, terrainTile } from '../../core/level/autotile.ts';
import type { LevelObject } from '../../core/level/loadLevel.ts';
import type { TileGrid } from '../../core/level/tiles.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { TICK_RATE } from '../../core/tuning.ts';
import { OBJECT_FRAMES } from '../../data/animKeys.ts';
import { DEPTH, DOOR, PARALLAX, TILESET, VIEW } from '../../data/art.ts';
import { BIOME } from '../assets/loadAssets.ts';

/** Terrain (blob autotiles) at depth 20 and auto-deco at depth 10 (08 §9.2–9.4). */
export function drawTerrain(scene: Phaser.Scene, grid: TileGrid, biome: string = BIOME, autoDeco = true): void {
  const terrain: number[][] = [], deco: number[][] = [];
  for (let ty = 0; ty < grid.h; ty++) {
    const t: number[] = [], d: number[] = [];
    for (let tx = 0; tx < grid.w; tx++) {
      t.push(terrainTile(grid, tx, ty)?.index ?? -1);
      d.push(autoDeco ? decoTile(grid, tx, ty) ?? -1 : -1);
    }
    terrain.push(t); deco.push(d);
  }
  const key = `tiles_${biome}`;
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
  private readonly biome: keyof typeof PARALLAX;
  constructor(scene: Phaser.Scene, levelHeightPx: number, biome: keyof typeof PARALLAX = BIOME) {
    this.levelHeightPx = levelHeightPx;
    this.biome = biome;
    const set = PARALLAX[biome];
    scene.cameras.main.setBackgroundColor(set.skyTop);
    for (let i = 0; i < 3; i++) {
      this.layers.push(scene.add.tileSprite(0, 0, VIEW.w, VIEW.h, `bg_${biome}_${i}`).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.parallax[i]));
    }
  }
  setVisible(on: boolean): void {
    for (const s of this.layers) s.setVisible(on);
  }

  update(camX: number, camY: number): void {
    const set = PARALLAX[this.biome];
    this.layers.forEach((s, i) => {
      s.tilePositionX = Math.round(camX * set.layers[i].fx);
      s.y = Math.round((this.levelHeightPx - VIEW.h - camY) * set.layers[i].fy);
    });
  }
}

/** Guide arrow frame for an angle in degrees (y down): 8 pre-drawn directions, counter-clockwise from right (08 §8). */
export function arrowFrame(angleDeg: number): string {
  const k = ((8 - Math.round(angleDeg / 45)) % 8 + 8) % 8;
  return OBJECT_FRAMES.guideArrow[k];
}

/** Guide arrows: one static sprite each at depth 30. */
export function drawGuideArrows(scene: Phaser.Scene, objects: LevelObject[]): void {
  for (const a of objects.filter((o) => o.type === 'guide_arrow')) {
    scene.add.image(a.x, a.y, 'objects', arrowFrame(Number(a.props.angle ?? 0))).setDepth(DEPTH.doors);
  }
}

/**
 * Arena and timed doors: a cap, middle pieces and a bottom, 16 px wide (08 §8). Opening and closing slide 48 px
 * in 0.15 s (view time). The timed door's cap shows its lamps: pending, open or missed.
 */
export class DoorViews {
  private readonly doors = new Map<string, { parts: Phaser.GameObjects.Image[]; open: number; active: boolean; lastTick: number }>();
  private readonly scene: Phaser.Scene;
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  update(w: GameWorld): void {
    for (const b of w.bodies.list) {
      const timed = w.timedDoors.some((t) => t.id === b.id);
      if (!timed && !b.id.startsWith('arena_door')) continue;
      let d = this.doors.get(b.id);
      const F = timed ? OBJECT_FRAMES.timedDoor : OBJECT_FRAMES.arenaDoor;
      if (!d) {
        const rows = Math.max(1, Math.round(b.h / TILESET.tile));
        const parts = Array.from({ length: rows }, (_, i) => {
          const frame = i === 0 ? (timed ? OBJECT_FRAMES.timedDoor.cap.pending : OBJECT_FRAMES.arenaDoor.cap) : i === rows - 1 ? F.bottom : F.mid;
          return this.scene.add.image(0, 0, 'objects', frame).setOrigin(0, 0).setDepth(DEPTH.doors);
        });
        d = { parts, open: b.active ? 0 : 1, active: b.active, lastTick: w.tick };
        this.doors.set(b.id, d);
      }
      // Slide toward the body's state (a restart can snap it back).
      const dt = Math.max(0, w.tick - d.lastTick) / TICK_RATE;
      if (w.tick < d.lastTick) d.open = b.active ? 0 : 1;
      d.lastTick = w.tick;
      const target = b.active ? 0 : 1;
      const step = dt / DOOR.slideTime;
      d.open = d.open < target ? Math.min(target, d.open + step) : Math.max(target, d.open - step);
      const lift = Math.round(d.open * DOOR.slide);
      if (timed) {
        const state = w.run.timedDoors[b.id] ?? 'pending';
        d.parts[0].setFrame(OBJECT_FRAMES.timedDoor.cap[state as 'pending' | 'open' | 'missed']);
      }
      d.parts.forEach((p, i) => p.setPosition(b.x, b.y + i * TILESET.tile - lift).setAlpha(1 - d.open).setVisible(d.open < 1));
    }
  }
}
