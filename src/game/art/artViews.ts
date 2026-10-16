// Phaser views that draw core state with the generated art (08). They read state; they never change it.
import Phaser from 'phaser';
import { COMBAT, ENEMY, TICK_RATE } from '../../core/tuning.ts';
import type { EnemyState } from '../../core/enemies/enemy.ts';
import type { PlayerBody } from '../../core/player/body.ts';
import type { TileGrid } from '../../core/level/tiles.ts';
import { ANCHOR, ANIM, DEPTH, OVERLAY, PARALLAX, TILESET, TRIM_TINT, VIEW } from '../../data/art.ts';
import { phaseFrame, runFps, timeFrame, walkFps, type AnimDef } from './anims.ts';
import { decoTile, terrainTile } from './autotile.ts';

/** The player outfit while there are no classes yet. */
// SPEC-GAP: no class or starting kit exists before M5, so the outfit is fixed to the Swordsman with Neutral trims.
export const OUTFIT = 'swordsman';
const BIOME = 'plains';

/** Load everything the Plains art needs (08 §9.1, §10.1, §12.5). */
export function preloadArt(scene: Phaser.Scene): void {
  const l = scene.load;
  l.atlas('enemies_plains', 'assets/atlases/enemies_plains.png', 'assets/atlases/enemies_plains.json');
  l.atlas(`player_${OUTFIT}`, `assets/atlases/player_${OUTFIT}.png`, `assets/atlases/player_${OUTFIT}.json`);
  l.atlas(`player_${OUTFIT}_trim`, `assets/atlases/player_${OUTFIT}_trim.png`, `assets/atlases/player_${OUTFIT}_trim.json`);
  l.image(`tiles_${BIOME}`, `assets/tiles/tiles_${BIOME}.png`);
  for (let i = 0; i < 3; i++) l.image(`bg_${BIOME}_${i}`, `assets/bg/bg_${BIOME}_${i}.png`);
  l.json('anims', 'assets/anims.json');
}

export function animTable(scene: Phaser.Scene): Map<string, AnimDef> {
  const list = scene.cache.json.get('anims') as AnimDef[];
  // Player outfits share anim keys ('idle', 'run'): keep them apart as `idle#swordsman`.
  return new Map(list.map((a) => [a.atlas.startsWith('player_') ? `${a.key}#${a.atlas.slice('player_'.length)}` : a.key, a]));
}

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
  update(camX: number, camY: number): void {
    const set = PARALLAX[BIOME];
    this.layers.forEach((s, i) => {
      s.tilePositionX = Math.round(camX * set.layers[i].fx);
      s.y = Math.round((this.levelHeightPx - VIEW.h - camY) * set.layers[i].fy);
    });
  }
}

/** Ticks a view advanced since its last render, and the anim time it keeps (08 §5.1). */
class AnimClock {
  key = '';
  t = 0;            // seconds in the current anim
  runPhase = 0;     // speed-driven accumulator (frames)
  lastTick = -1;
  advance(key: string, worldTick: number, frozen: boolean): number {
    const dt = this.lastTick < 0 ? 0 : Math.max(0, worldTick - this.lastTick) / TICK_RATE;
    this.lastTick = worldTick;
    if (key !== this.key) { this.key = key; this.t = 0; this.runPhase = 0; return 0; }
    if (!frozen) this.t += dt;
    return frozen ? 0 : dt;
  }
}

/** Player: body + trim A + trim B, flipped together, plus a solid-fill overlay (08 §4.2, §5.3). */
export class PlayerView {
  private readonly parts: Phaser.GameObjects.Sprite[];
  private readonly overlay: Phaser.GameObjects.Sprite;
  private readonly clock = new AnimClock();
  private readonly anims: Map<string, AnimDef>;
  constructor(scene: Phaser.Scene, anims: Map<string, AnimDef>) {
    this.anims = anims;
    const body = `player_${OUTFIT}`, trim = `${body}_trim`;
    const origin = [0.5, (ANCHOR.human.h - ANCHOR.feetFromBottom) / ANCHOR.human.h] as const;
    this.parts = [
      scene.add.sprite(0, 0, body, 'idle_00'),
      scene.add.sprite(0, 0, trim, 'a/idle_00').setTint(TRIM_TINT.none),
      scene.add.sprite(0, 0, trim, 'b/idle_00').setTint(TRIM_TINT.none),
    ];
    this.overlay = scene.add.sprite(0, 0, body, 'idle_00').setTint(OVERLAY.hitFlash.color).setTintMode(Phaser.TintModes.FILL);
    for (const s of [...this.parts, this.overlay]) s.setOrigin(origin[0], origin[1]).setDepth(DEPTH.player);
  }

  /** `hurtTicksAgo`: ticks since the last hurt (for the hit flash), or a large number. */
  update(b: PlayerBody, worldTick: number, iframeTicks: number, hurtTicksAgo: number): void {
    // Only idle and run poses exist in the ART1 atlas; air shows a run frame until jump/fall poses are drawn.
    const running = b.state === 'ground' && Math.abs(b.vx) > 1;
    const air = b.state !== 'ground' && b.state !== 'crawl' && b.state !== 'dead';
    const key = running || air ? 'run' : 'idle';
    const def = this.anims.get(`${key}#${OUTFIT}`)!;
    const dt = this.clock.advance(key, worldTick, b.hitStopTicks > 0);
    let i: number;
    if (key === 'run' && air) i = 2;
    else if (key === 'run') { this.clock.runPhase += runFps(b.vx) * dt; i = Math.floor(this.clock.runPhase) % def.frames.length; }
    else i = timeFrame(def, this.clock.t);
    const name = def.frames[i];
    const flip = b.facing < 0;
    const blink = iframeTicks > 0 && Math.floor(worldTick / COMBAT.IFRAME_BLINK_TICKS) % 2 === 0;
    this.parts.forEach((s, n) => {
      s.setFrame(n === 0 ? name : `${n === 1 ? 'a' : 'b'}/${name}`).setPosition(b.x, b.y).setFlipX(flip).setAlpha(blink ? 0.4 : 1);
    });
    const flash = hurtTicksAgo < OVERLAY.hitFlash.minTicks;
    this.overlay.setFrame(name).setPosition(b.x, b.y).setFlipX(flip).setVisible(flash);
  }

  destroy(): void {
    for (const s of [...this.parts, this.overlay]) s.destroy();
  }
}

/** One enemy: its anim chosen from core state (08 §7.1), the telegraph and hit-flash overlays (08 §5.3). */
export class EnemyView {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly overlay: Phaser.GameObjects.Sprite;
  private readonly clock = new AnimClock();
  readonly hasArt: boolean;
  private readonly anims: Map<string, AnimDef>;
  readonly e: EnemyState;
  constructor(scene: Phaser.Scene, anims: Map<string, AnimDef>, e: EnemyState) {
    this.anims = anims;
    this.e = e;
    const idle = anims.get(`${e.def.id}_idle`);
    this.hasArt = idle !== undefined;
    const atlas = idle?.atlas ?? 'enemies_plains';
    const frame = idle?.frames[0];
    this.sprite = scene.add.sprite(0, 0, atlas, frame).setDepth(DEPTH.enemies).setVisible(this.hasArt);
    this.overlay = scene.add.sprite(0, 0, atlas, frame).setDepth(DEPTH.enemies).setTintMode(Phaser.TintModes.FILL).setVisible(false);
  }

  private pick(): { key: string; frame: number; alpha: number } {
    const e = this.e, id = e.def.id;
    const has = (k: string) => this.anims.has(`${id}_${k}`);
    if (e.dead) {
      const def = this.anims.get(`${id}_death`)!;
      const i = timeFrame(def, this.clock.t);
      const last = def.frames.length - 1;
      const fadeStart = last / (def.fps ?? 1);
      const fade = i < last ? 1 : Math.max(0, 1 - (this.clock.t - fadeStart) * (def.fps ?? 1));
      return { key: 'death', frame: i, alpha: fade };
    }
    const c = e.control;
    if (c?.type === 'knockdown' && has('knockdown')) return { key: 'knockdown', frame: this.clock.t < ANIM.KNOCKDOWN_F0 ? 0 : 1, alpha: 1 };
    if (c?.type === 'dazed' && has('dazed')) return { key: 'dazed', frame: timeFrame(this.anims.get(`${id}_dazed`)!, this.clock.t), alpha: 1 };
    if (c) return { key: 'stagger', frame: timeFrame(this.anims.get(`${id}_stagger`)!, this.clock.t), alpha: 1 };
    if (e.knockback && has('hurt')) return { key: 'hurt', frame: 0, alpha: 1 };
    const a = e.ai.attack;
    if (a && has(`atk_${a.def.id}`)) {
      const def = this.anims.get(`${id}_atk_${a.def.id}`)!;
      return { key: `atk_${a.def.id}`, frame: phaseFrame(def, a.phase, a.t, a.len, e.vy), alpha: 1 };
    }
    if (Math.abs(e.vx) > 0.5 && has('walk')) {
      const def = this.anims.get(`${id}_walk`)!;
      return { key: 'walk', frame: Math.floor(this.clock.runPhase) % def.frames.length, alpha: 1 };
    }
    return { key: 'idle', frame: timeFrame(this.anims.get(`${id}_idle`)!, this.clock.t), alpha: 1 };
  }

  update(worldTick: number): void {
    const e = this.e;
    if (!this.hasArt) return;
    if (e.dead && e.deathTicks <= 0) { this.sprite.setVisible(false); this.overlay.setVisible(false); return; }
    const frozen = e.hitStopTicks > 0;
    // Pick once to learn the key, advance its clock, then pick again with the new time.
    const key0 = this.pick().key;
    const dt = this.clock.advance(key0, worldTick, frozen);
    if (key0 === 'walk') this.clock.runPhase += walkFps(e.vx, e.def.walk) * dt;
    const { key, frame, alpha } = this.pick();
    const def = this.anims.get(`${e.def.id}_${key}`)!;
    const name = def.frames[frame];
    const flip = !e.def.noFacing && e.facing < 0;
    const jiggle = frozen ? (worldTick % 2 === 0 ? 1 : -1) : 0;      // hit-stop jiggle (08 §5.3)
    for (const s of [this.sprite, this.overlay]) {
      s.setFrame(name);
      // Every character frame puts the feet at (w/2, h − 2) (08 §4.1), whatever its size.
      s.setOrigin(0.5, (s.frame.height - ANCHOR.feetFromBottom) / s.frame.height).setPosition(e.x + jiggle, e.y).setFlipX(flip);
    }
    this.sprite.setVisible(true).setAlpha(alpha);
    this.updateOverlay(worldTick, alpha);
  }

  private updateOverlay(worldTick: number, alpha: number): void {
    const e = this.e, o = this.overlay;
    const flashFor = Math.max(OVERLAY.hitFlash.minTicks, e.hitStopTicks);
    const a = e.ai.attack;
    if (worldTick - e.lastPlayerHitTick < flashFor && !e.dead) {
      o.setTint(OVERLAY.hitFlash.color).setAlpha(OVERLAY.hitFlash.alpha * alpha).setVisible(true);
    } else if (a && a.phase === 'tele' && !e.dead) {
      const left = a.len - a.t;
      if (left <= ENEMY.TELEGRAPH_FLASH_LAST_TICKS) {
        o.setTint(OVERLAY.telegraphGo.color).setAlpha(OVERLAY.telegraphGo.alpha).setVisible(true);
      } else {
        const T = OVERLAY.telegraph;
        const ph = ((a.t / TICK_RATE) % T.period) / T.period;               // triangle wave 0 → 1 → 0
        const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
        o.setTint(T.color).setAlpha(T.alphaMin + (T.alphaMax - T.alphaMin) * tri).setVisible(true);
      }
    } else o.setVisible(false);
  }

  destroy(): void {
    this.sprite.destroy();
    this.overlay.destroy();
  }
}
