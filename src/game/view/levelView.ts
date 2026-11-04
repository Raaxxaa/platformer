// Level art (08 §9, §10.1, §8): terrain tiles, auto-deco, parallax, doors and guide arrows. Reads state; never changes it.
import type Phaser from 'phaser';
import { decoTile, terrainTile } from '../../core/level/autotile.ts';
import type { LevelObject } from '../../core/level/loadLevel.ts';
import type { TileGrid } from '../../core/level/tiles.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { TICK_RATE } from '../../core/tuning.ts';
import { OBJECT_FRAMES } from '../../data/animKeys.ts';
import { DEPTH, DOOR, PARALLAX, TILESET, VIEW } from '../../data/art.ts';
import { BIOME } from '../assets/loadAssets.ts';
import { BIOME_VIEW as B } from '../../data/biomeView.ts';

/** Terrain (blob autotiles) at depth 20 and auto-deco at depth 10 (08 §9.2–9.4). */
export function drawTerrain(scene: Phaser.Scene, grid: TileGrid, biome: string = BIOME, autoDeco = true): void {
  const key = `tiles_${biome}`;
  if (!scene.textures.exists(key)) {
    const g = scene.add.graphics().setDepth(DEPTH.terrain);
    // Consecutive tiles form one rectangle, so a tall road does not need thousands of objects.
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w;) {
      const kind = grid.baseKindAt(x, y);
      const start = x++;
      while (x < grid.w && grid.baseKindAt(x, y) === kind) x++;
      if (kind === 'empty' || kind === 'water') continue;
      const color = kind.startsWith('spike') ? B.terrain.spike : B.terrain[kind as 'solid' | 'ice' | 'oneway'];
      g.fillStyle(color).fillRect(start * TILESET.tile, y * TILESET.tile, (x - start) * TILESET.tile, kind === 'oneway' ? B.onewayHeight : TILESET.tile);
    }
    return;
  }
  const terrain: number[][] = [], deco: number[][] = [];
  for (let ty = 0; ty < grid.h; ty++) {
    const t: number[] = [], d: number[] = [];
    for (let tx = 0; tx < grid.w; tx++) {
      t.push(terrainTile(grid, tx, ty)?.index ?? -1);
      d.push(autoDeco ? decoTile(grid, tx, ty) ?? -1 : -1);
    }
    terrain.push(t); deco.push(d);
  }
  for (const [data, depth] of [[deco, DEPTH.deco], [terrain, DEPTH.terrain]] as const) {
    const map = scene.make.tilemap({ data: data as number[][], tileWidth: TILESET.tile, tileHeight: TILESET.tile });
    const set = map.addTilesetImage(key, key, TILESET.tile, TILESET.tile, TILESET.margin, TILESET.spacing)!;
    map.createLayer(0, set, 0, 0)!.setDepth(depth);
  }
}

/** Three camera-fixed parallax layers over a sky-top fill (08 §10.1). */
export class Parallax {
  private readonly layers: { sprite: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Rectangle; set: keyof typeof PARALLAX; index: number; cave: boolean }[] = [];
  private readonly levelHeightPx: number;
  private readonly biome: keyof typeof PARALLAX;
  caveAlpha = 0;
  constructor(scene: Phaser.Scene, levelHeightPx: number, biome: keyof typeof PARALLAX = BIOME) {
    this.levelHeightPx = levelHeightPx;
    this.biome = biome;
    const set = PARALLAX[biome];
    scene.cameras.main.setBackgroundColor(set.skyTop);
    const make = (id: keyof typeof PARALLAX, cave: boolean) => {
      if (![0, 1, 2].every(i => scene.textures.exists(`bg_${id}_${i}`))) {
        const sprite = scene.add.rectangle(0, 0, VIEW.w, VIEW.h, cave ? B.cave : B.background).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.parallax[0] + (cave ? 0.5 : 0));
        this.layers.push({ sprite, set: id, index: 0, cave });
        return;
      }
      for (let i = 0; i < set.layers.length; i++) {
        const sprite = scene.add.tileSprite(0, 0, VIEW.w, VIEW.h, `bg_${id}_${i}`).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.parallax[i] + (cave ? 0.5 : 0));
        this.layers.push({ sprite, set: id, index: i, cave });
      }
    };
    make(biome, false);
    if (biome === 'mountains') make('mountains_cave', true);
    this.update(0, 0, 0);
  }
  setVisible(on: boolean): void {
    for (const s of this.layers) s.sprite.setVisible(on);
  }

  update(camX: number, camY: number, seconds = 0): void {
    const target = this.biome === 'mountains' && camY + VIEW.h / 2 >= this.levelHeightPx * B.caveStartFraction ? 1 : 0;
    const step = Math.max(0, seconds) / B.caveFadeSeconds;
    this.caveAlpha = this.caveAlpha < target ? Math.min(target, this.caveAlpha + step) : Math.max(target, this.caveAlpha - step);
    this.layers.forEach(({ sprite, set, index, cave }) => {
      sprite.setAlpha(cave ? this.caveAlpha : 1 - this.caveAlpha);
      if ('tilePositionX' in sprite) {
        sprite.tilePositionX = Math.round(camX * PARALLAX[set].layers[index].fx);
        sprite.y = Math.round((this.levelHeightPx - VIEW.h - camY) * PARALLAX[set].layers[index].fy);
      }
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

/** M17 Mountain caves: wall torches on the labyrinth's main route and the Dragon nest's decoration (06 §8.9, §9.4).
 * ART12 draws them (`torch_00`, `nest_00`, ...); until then they are simple shapes. Decoration only. */
export function drawCaveDecor(scene: Phaser.Scene, objects: LevelObject[]): void {
  const atlas = scene.textures.exists('objects') ? scene.textures.get('objects') : null;
  for (const o of objects) {
    const frame = CAVE_DECOR[o.type];
    if (!frame) continue;
    if (atlas?.has(frame)) { scene.add.image(o.x, o.y, 'objects', frame).setOrigin(0.5, o.type === 'torch' ? 0.5 : 1).setDepth(DEPTH.doors - 1); continue; }
    const g = scene.add.graphics().setDepth(DEPTH.doors - 1);
    if (o.type === 'torch') { g.fillStyle(0x5a3a24).fillRect(o.x - 1, o.y - 2, 3, 8); g.fillStyle(0xff7a2e).fillRect(o.x - 2, o.y - 7, 5, 5); g.fillStyle(0xffd86b).fillRect(o.x - 1, o.y - 6, 3, 3); }
    if (o.type === 'nest') { g.fillStyle(0x6e4731).fillEllipse(o.x, o.y - 5, 72, 12); g.fillStyle(0x3d2a1e).fillEllipse(o.x, o.y - 7, 52, 6); }
    if (o.type === 'eggshells') { g.fillStyle(0xeeeae0).fillTriangle(o.x - 6, o.y, o.x - 2, o.y - 6, o.x + 1, o.y); g.fillTriangle(o.x + 2, o.y, o.x + 5, o.y - 4, o.x + 8, o.y); }
    if (o.type === 'bones') { g.fillStyle(0xd9d2b8).fillRect(o.x - 10, o.y - 3, 20, 3); g.fillRect(o.x - 4, o.y - 8, 3, 8); }
    if (o.type === 'scorch') g.fillStyle(0x1d1a24, 0.7).fillEllipse(o.x, o.y - 1, 48, 6);
    if (o.type === 'coin_pile') { g.fillStyle(0xd8a82a).fillTriangle(o.x - 12, o.y, o.x, o.y - 10, o.x + 12, o.y); g.fillStyle(0xffd34a).fillRect(o.x - 2, o.y - 7, 3, 2); }
  }
}
const CAVE_DECOR: Record<string, string> = { torch: 'torch_00', nest: 'nest_00', eggshells: 'eggshells_00', bones: 'bones_00', scorch: 'scorch_00', coin_pile: 'coin_pile_00' };

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
