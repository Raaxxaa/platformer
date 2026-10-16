// Phaser views that draw core state with the generated art (08). They read state; they never change it.
import Phaser from 'phaser';
import { BOSS, COMBAT, ENEMY, TICK_RATE } from '../../core/tuning.ts';
import type { EnemyState } from '../../core/enemies/enemy.ts';
import type { PlayerBody } from '../../core/player/body.ts';
import type { TileGrid } from '../../core/level/tiles.ts';
import { ANCHOR, ANIM, DEPTH, OVERLAY, PARALLAX, TILESET, TRIM_TINT, VIEW } from '../../data/art.ts';
import { AnimClock, phaseFrame, runFps, timeFrame, walkFps, type AnimDef } from '../view/animClock.ts';
import { decoTile, terrainTile } from './autotile.ts';

/** The player outfit while there are no classes yet. */
// SPEC-GAP: no class or starting kit exists before M5, so the outfit is fixed to the Swordsman with Neutral trims.
export const OUTFIT = 'swordsman';
import { BIOME } from '../assets/loadAssets.ts';

export function animTable(scene: Phaser.Scene): Map<string, AnimDef> {
  const list = scene.cache.json.get('anims') as AnimDef[];
  // Player outfits share anim keys ('idle', 'run'): keep them apart as `idle#swordsman`. Boss atlases hold
  // unprefixed keys ('idle'): they become `<bossId>_idle` like regular enemies. Projectiles become `proj_<id>`.
  const keyOf = (a: AnimDef) => a.atlas.startsWith('player_') ? `${a.key}#${a.atlas.slice('player_'.length)}`
    : a.atlas.startsWith('boss_') ? `${a.atlas.slice('boss_'.length)}_${a.key}`
    : a.atlas === 'projectiles' ? `proj_${a.key}` : a.key;
  return new Map(list.map((a) => [keyOf(a), a]));
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
    this.sprite = scene.add.sprite(0, 0, atlas, frame).setDepth(DEPTH.enemies + (e.boss ? 1 : 0)).setVisible(this.hasArt);
    this.overlay = scene.add.sprite(0, 0, atlas, frame).setDepth(DEPTH.enemies).setTintMode(Phaser.TintModes.FILL).setVisible(false);
  }

  private pick(): { key: string; frame: number; alpha: number } {
    const e = this.e, id = e.def.id;
    const has = (k: string) => this.anims.has(`${id}_${k}`);
    if (e.dead) {
      const def = this.anims.get(`${id}_death`)!;
      const i = timeFrame(def, this.clock.t);
      if (e.boss) return { key: 'death', frame: i, alpha: 1 };
      const last = def.frames.length - 1;
      const fadeStart = last / (def.fps ?? 1);
      const fade = i < last ? 1 : Math.max(0, 1 - (this.clock.t - fadeStart) * (def.fps ?? 1));
      return { key: 'death', frame: i, alpha: fade };
    }
    const c = e.control;
    if (e.boss && e.boss.introTicks > 0 && has('intro')) {        // intro: phase over 1.0 s (08 §7.4)
      const n = this.anims.get(`${id}_intro`)!.frames.length;
      return { key: 'intro', frame: Math.min(n - 1, Math.floor(((BOSS.INTRO_TICKS - e.boss.introTicks) / BOSS.INTRO_TICKS) * n)), alpha: 1 };
    }
    if (e.boss && c?.type === 'stagger' && has('break')) {        // break: f0 for 0.2 s, then [1, 2] at 4 fps
      const f = this.clock.t < ANIM.BREAK_F0 ? 0 : 1 + (Math.floor((this.clock.t - ANIM.BREAK_F0) * ANIM.BREAK_FPS) % 2);
      return { key: 'break', frame: f, alpha: 1 };
    }
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
    // Regular deaths last 0.4 s (04 §2.8); a boss's death animation plays its full 1.5 s (08 §7.4).
    const bossDeath = this.anims.get(`${e.def.id}_death`);
    const bossDeathDone = !!e.boss && !!bossDeath && this.clock.key === 'death' && this.clock.t >= bossDeath.frames.length / (bossDeath.fps ?? 1);
    if (e.dead && (e.boss ? bossDeathDone : e.deathTicks <= 0)) { this.sprite.setVisible(false); this.overlay.setVisible(false); return; }
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

/** Enemy projectiles: one sprite each, drawn facing right and rotated to the velocity in 22.5° steps (08 §11). */
export class ProjectileViews {
  private readonly sprites = new Map<number, Phaser.GameObjects.Sprite>();
  private readonly scene: Phaser.Scene;
  private readonly anims: Map<string, AnimDef>;
  constructor(scene: Phaser.Scene, anims: Map<string, AnimDef>) {
    this.scene = scene;
    this.anims = anims;
  }

  /** True if this projectile id has art (the rest stay boxes). */
  hasArt(id: string): boolean {
    return this.anims.has(`proj_${id}`);
  }

  update(list: { id: number; def: { id: string }; x: number; y: number; vx: number; vy: number }[], worldTick: number): void {
    const live = new Set<number>();
    for (const p of list) {
      const def = this.anims.get(`proj_${p.def.id}`);
      if (!def) continue;
      live.add(p.id);
      let s = this.sprites.get(p.id);
      if (!s) { s = this.scene.add.sprite(0, 0, def.atlas, def.frames[0]).setDepth(DEPTH.projectiles); this.sprites.set(p.id, s); }
      const i = def.mode === 'loop' ? timeFrame(def, worldTick / TICK_RATE) : 0;
      const step = (ANIM.PROJ_ANGLE_STEP * Math.PI) / 180;
      const ang = Math.round(Math.atan2(p.vy, p.vx) / step) * step;
      s.setFrame(def.frames[i]).setPosition(p.x, p.y).setRotation(ang);
    }
    for (const [id, s] of this.sprites) if (!live.has(id)) { s.destroy(); this.sprites.delete(id); }
  }
}
