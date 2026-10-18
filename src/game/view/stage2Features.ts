// Stage2 terrain/effect drawing. Pure helpers have no Phaser runtime dependency.
import type Phaser from 'phaser';
import type { LevelObject } from '../../core/level/loadLevel.ts';
import type { TileGrid } from '../../core/level/tiles.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { TICK_RATE, TILE_SIZE } from '../../core/tuning.ts';
import { DEPTH, TILESET, VIEW } from '../../data/art.ts';
import { STAGE2_VIEW as S } from '../../data/stage2View.ts';
import { fireflyPosition } from './darkness.ts';
import type { TickEvent } from './vfx.ts';

export interface Rail { x: number; y: number }
const supportsRail = (kind: string) => kind === 'solid' || kind === 'ice' || kind === 'oneway';

/** A gap does not reset the previous rail height. Stop columns are excluded. */
export function rails(grid: TileGrid, objects: readonly LevelObject[]): Rail[] {
  const result: Rail[] = [], stops = objects.filter((o) => o.type === 'minecart_stop');
  for (const cart of objects.filter((o) => o.type === 'minecart')) {
    const dir = Number(cart.props.dir ?? 1) < 0 ? -1 : 1;
    let previousY = cart.y;
    for (let tx = Math.floor(cart.x / TILE_SIZE); tx >= 0 && tx < grid.w; tx += dir) {
      const x = tx * TILE_SIZE;
      if (stops.some((stop) => x < stop.x + stop.w && x + TILE_SIZE > stop.x)) break;
      const top = Math.max(0, Math.ceil((previousY - S.rails.up) / TILE_SIZE));
      const bottom = Math.min(grid.h - 1, Math.floor((previousY + S.rails.down) / TILE_SIZE));
      for (let ty = top; ty <= bottom; ty++) {
        if (!supportsRail(grid.kindAt(tx, ty)) || grid.isSolidTile(tx, ty - 1)) continue;
        previousY = ty * TILE_SIZE;
        result.push({ x, y: previousY });
        break;
      }
    }
  }
  return result;
}

export function waterFrame(tick: number, tx: number): number {
  return ((Math.floor(tick * S.water.fps / TICK_RATE) + tx) % S.water.frames + S.water.frames) % S.water.frames;
}

export interface FeatureMarker { x: number; y: number; w: number }
/** Fixed targets come from their live attack state, never the current player position. */
export function featureMarkers(w: GameWorld): FeatureMarker[] {
  const out: FeatureMarker[] = w.fallingRocks.markers.map((m) => ({ x: m.x, y: m.floorY, w: S.rockMarkerWidth }));
  for (const e of w.enemies) {
    const a = e.ai.attack;
    if (e.dead || !a || a.phase !== 'tele') continue;
    if (a.def.id === 'root_snare' && e.swamp?.marker) out.push({ ...e.swamp.marker, w: a.def.hit!.box.w });
    if (a.def.id === 'ceiling_drop' && e.guardian?.marker) out.push({ ...e.guardian.marker, w: a.def.hit!.box.w });
    if (a.def.id === 'stone_spikes' && a.def.hit) out.push({ x: e.x + a.def.hit.box.dx * e.facing, y: e.y, w: a.def.hit.box.w });
  }
  return out;
}

export function markerStyle(w: GameWorld, marker: FeatureMarker, viewSeconds: number): { color: number; alpha: number } {
  const last = S.marker.solidLast * TICK_RATE;
  let go = w.fallingRocks.markers.some((m) => m.x === marker.x && m.floorY === marker.y && m.ticks <= last);
  for (const e of w.enemies) {
    const a = e.ai.attack;
    if (e.dead || a?.phase !== 'tele' || a.len - a.t > last) continue;
    const target = a.def.id === 'root_snare' ? e.swamp?.marker : a.def.id === 'ceiling_drop' ? e.guardian?.marker
      : a.def.id === 'stone_spikes' && a.def.hit ? { x: e.x + a.def.hit.box.dx * e.facing, y: e.y } : null;
    if (target?.x === marker.x && target.y === marker.y) go = true;
  }
  const pulse = S.marker.minAlpha + (S.marker.maxAlpha - S.marker.minAlpha) * (1 + Math.sin(viewSeconds * Math.PI * 2 * S.marker.hz)) / 2;
  return go ? { color: S.marker.go, alpha: 1 } : { color: S.marker.color, alpha: pulse };
}

function waterSurface(w: GameWorld): number | null {
  const tx = Math.floor(w.body.x / TILE_SIZE);
  let ty = Math.floor((w.body.y - 1) / TILE_SIZE);
  if (w.grid.baseKindAt(tx, ty) !== 'water') return null;
  while (ty > 0 && w.grid.baseKindAt(tx, ty - 1) === 'water') ty--;
  return ty * TILE_SIZE;
}

export interface WaterEffect { id: number; kind: 'splash' | 'ripple'; x: number; y: number; born: number }
export class WaterFx {
  list: WaterEffect[] = [];
  private nextId = 0;
  private lastTick = -Infinity;
  private lastRipple = -Infinity;
  private lastSurface: number | null = null;
  private readonly seenEvents = new Map<string, number>();

  update(w: GameWorld, events: readonly TickEvent[]): void {
    if (w.tick < this.lastTick) { this.list = []; this.lastRipple = -Infinity; this.lastSurface = null; this.seenEvents.clear(); }
    this.lastTick = w.tick;
    const surface = waterSurface(w);
    if (surface !== null) this.lastSurface = surface;
    this.list = this.list.filter((fx) => w.tick - fx.born < TICK_RATE * S[fx.kind].frames / S[fx.kind].fps);
    const maxLife = TICK_RATE * Math.max(S.splash.frames / S.splash.fps, S.ripple.frames / S.ripple.fps);
    for (const [key, tick] of this.seenEvents) if (tick < w.tick - maxLife) this.seenEvents.delete(key);
    const landedTicks = new Set(events.filter(({ e }) => e.t === 'move' && (e.e === 'land' || e.e === 'diveLand')).map(({ tick }) => tick));
    for (const { tick, e } of events) {
      // The water dive zeros vy on impact. Only its same-tick landing may supply landSpeed.
      const speed = Math.max(Math.abs(w.body.vy), landedTicks.has(tick) ? Math.abs(w.body.landSpeed) : 0);
      if (e.t === 'move' && (e.e === 'enterWater' || e.e === 'exitWater') && speed > S.splash.speed) {
        const key = `${tick}/${e.e}`;
        if (this.seenEvents.has(key)) continue;
        this.seenEvents.set(key, tick);
        this.list.push({ id: this.nextId++, kind: 'splash', x: w.body.x, y: surface ?? this.lastSurface ?? w.body.y, born: tick });
      }
    }
    if (w.body.inWater && w.body.vx !== 0 && w.tick - this.lastRipple >= S.ripple.every * TICK_RATE) {
      this.lastRipple = w.tick;
      this.list.push({ id: this.nextId++, kind: 'ripple', x: w.body.x, y: surface ?? w.body.y, born: w.tick });
    }
  }
}

interface Fallback { w: number; h: number; color: number; alpha?: number; ox?: number; oy?: number }

export class Stage2FeatureView {
  private readonly scene: Phaser.Scene;
  private readonly railPoints: Rail[];
  private readonly graphics = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly sprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly seen = new Set<string>();
  private readonly waterFx = new WaterFx();
  private readonly bodyTypes: Map<string, string>;
  private readonly sheet: string;
  private readonly waterCells: { tx: number; ty: number; surface: boolean }[] = [];
  private waterKey = '';
  private waterVisible: { tx: number; ty: number; surface: boolean }[] = [];
  private destroyed = false;

  constructor(scene: Phaser.Scene, w: GameWorld) {
    this.scene = scene;
    this.railPoints = rails(w.grid, w.level?.objects ?? []);
    this.bodyTypes = new Map((w.level?.objects ?? []).filter((o) => ['cracked_wall', 'blink_block', 'collapsing_platform'].includes(o.type))
      .map((o) => [String(o.props.id ?? `${o.type}#${o.id}`), o.type]));
    const biome = w.level?.biome ?? 'plains';
    this.sheet = `tiles_${biome}_sheet`;
    for (let ty = 0; ty < w.grid.h; ty++) for (let tx = 0; tx < w.grid.w; tx++) {
      if (w.grid.baseKindAt(tx, ty) === 'water') this.waterCells.push({ tx, ty, surface: w.grid.baseKindAt(tx, ty - 1) !== 'water' });
    }
    for (const depth of [DEPTH.terrain, DEPTH.vfx, DEPTH.water, DEPTH.markers, DEPTH.enemies]) this.graphics.set(depth, scene.add.graphics().setDepth(depth));
    scene.events.once('shutdown', this.destroy, this);
  }

  private viewport(): { x: number; y: number; w: number; h: number } {
    const c = this.scene.cameras.main;
    const zoom = c.zoom || 1, w = VIEW.w / zoom, h = VIEW.h / zoom;
    return { x: c.scrollX + (VIEW.w - w) / 2, y: c.scrollY + (VIEW.h - h) / 2, w, h };
  }

  private visible(x: number, y: number, w: number, h: number): boolean {
    const c = this.viewport();
    return x + w >= c.x && y + h >= c.y && x <= c.x + c.w && y <= c.y + c.h;
  }

  /** Called after each fixed tick, so batched simulation keeps the event position and30tick ripple cadence. */
  onTick(w: GameWorld, events: readonly TickEvent[]): void {
    if (!this.destroyed) this.waterFx.update(w, events);
  }

  private visual(id: string, atlas: string, frame: string | number, x: number, y: number, depth: number, fallback: Fallback): void {
    const ox = fallback.ox ?? 0.5, oy = fallback.oy ?? 1;
    if (!this.visible(x - fallback.w * ox, y - fallback.h * oy, fallback.w, fallback.h)) return;
    if (this.scene.textures.exists(atlas) && this.scene.textures.get(atlas).has(String(frame))) {
      let image = this.sprites.get(id);
      if (!image) { image = this.scene.add.image(x, y, atlas, frame).setDepth(depth).setOrigin(ox, oy); this.sprites.set(id, image); }
      image.setTexture(atlas, frame).setPosition(Math.round(x), Math.round(y)).setAlpha(fallback.alpha ?? 1);
      this.seen.add(id);
    } else {
      this.graphics.get(depth)!.fillStyle(fallback.color, fallback.alpha ?? 1).fillRect(Math.round(x - fallback.w * ox), Math.round(y - fallback.h * oy), fallback.w, fallback.h);
    }
  }

  update(w: GameWorld, events: readonly TickEvent[], viewSeconds: number): void {
    if (this.destroyed) return;
    for (const gfx of this.graphics.values()) gfx.clear();
    this.seen.clear();
    const terrain = this.graphics.get(DEPTH.terrain)!;
    for (const rail of this.railPoints) if (this.visible(rail.x, rail.y - S.rails.height, TILE_SIZE, S.rails.height)) {
      terrain.fillStyle(S.rails.tieColor).fillRect(rail.x, rail.y - S.rails.tieHeight, TILE_SIZE, S.rails.tieHeight);
      terrain.fillStyle(S.rails.color).fillRect(rail.x, rail.y - S.rails.height, TILE_SIZE, 1);
    }
    const c = this.viewport(), waterKey = `${Math.floor(c.x / TILE_SIZE)},${Math.floor(c.y / TILE_SIZE)},${c.w},${c.h}`;
    if (waterKey !== this.waterKey) {
      this.waterKey = waterKey;
      this.waterVisible = this.waterCells.filter((cell) => this.visible(cell.tx * TILE_SIZE, cell.ty * TILE_SIZE, TILE_SIZE, TILE_SIZE));
    }
    for (const cell of this.waterVisible) {
      const frame = S.water.row * TILESET.columns + (cell.surface ? 0 : S.water.bodyColumn) + waterFrame(w.tick, cell.tx);
      this.visual(`water/${cell.tx}/${cell.ty}`, this.sheet, frame, cell.tx * TILE_SIZE, cell.ty * TILE_SIZE, DEPTH.water,
        { w: TILE_SIZE, h: TILE_SIZE, color: S.water.fallback, alpha: S.water.alpha, ox: 0, oy: 0 });
    }
    for (const body of w.bodies.list) {
      const type = this.bodyTypes.get(body.id);
      if (!type) continue;
      const collapse = w.collapsingPlatforms.find((p) => p.id === body.id);
      if (!body.active && (!collapse || collapse.visualTicks <= 0)) continue;
      const age = collapse?.state === 'collapsed' ? Math.max(0, S.bodies.collapseLife - collapse.visualTicks / TICK_RATE) : 0;
      const shake = collapse?.state === 'shaking' ? (Math.floor(w.tick / S.bodies.shakeEvery) % 2 ? S.bodies.shake : -S.bodies.shake) : 0;
      const column = type === 'cracked_wall' ? S.bodies.crackedColumn : type === 'blink_block' ? S.bodies.blinkColumn : body.oneWay ? S.bodies.oneWayColumn : S.bodies.solidColumn;
      for (let y = 0; y < body.h; y += TILE_SIZE) for (let x = 0; x < body.w; x += TILE_SIZE) {
        this.visual(`body/${body.id}/${x}/${y}`, this.sheet, S.bodies.row * TILESET.columns + column,
          body.x + x + shake, body.y + y + S.bodies.collapseGravity * age ** 2 / 2, DEPTH.terrain,
          { w: TILE_SIZE, h: TILE_SIZE, color: S.bodies.fallback, alpha: 1 - age / S.bodies.collapseLife, ox: 0, oy: 0 });
      }
    }
    for (const cart of w.minecarts) if (cart.active) {
      const frame = Math.floor(viewSeconds * S.cart.fps * Math.abs(cart.vx) / S.cart.speed) % S.cart.frames;
      this.visual(`cart/${cart.id}`, 'objects', S.frames.cart[frame], cart.x, cart.y, DEPTH.terrain,
        { w: S.cart.w, h: S.cart.h, color: S.cart.color });
      if (!this.sprites.has(`cart/${cart.id}`) && this.visible(cart.x - S.cart.w / 2, cart.y - S.cart.h, S.cart.w, S.cart.h)) {
        terrain.fillStyle(S.cart.wheelColor).fillRect(cart.x - S.cart.w / 2 + S.cart.wheelInset, cart.y - S.cart.wheel, S.cart.wheel, S.cart.wheel)
          .fillRect(cart.x + S.cart.w / 2 - S.cart.wheelInset - S.cart.wheel, cart.y - S.cart.wheel, S.cart.wheel, S.cart.wheel);
      }
    }
    for (const point of w.grapplePoints) {
      if (!this.visible(point.x - point.w / 2, point.y - point.h / 2, point.w, point.h)) continue;
      terrain.lineStyle(S.grapple.width, S.grapple.color).strokeCircle(point.x, point.y, S.grapple.size / 2);
    }
    const wards = this.graphics.get(DEPTH.enemies)!;
    for (const enemy of w.enemies) {
      if (enemy.dead || !enemy.ward || enemy.ward.hp <= 0 || enemy.ward.ticks <= 0) continue;
      const width = enemy.def.hurtbox.w + S.ward.extra, height = enemy.def.hurtbox.h + S.ward.extra;
      const centerY = enemy.y - enemy.def.hurtbox.h / 2;
      if (this.visible(enemy.x - width / 2, centerY - height / 2, width, height)) {
        wards.lineStyle(S.ward.lineWidth, S.ward.color, S.ward.alpha).strokeEllipse(enemy.x, centerY, width, height);
      }
    }
    const fx = this.graphics.get(DEPTH.vfx)!;
    for (const fly of w.fireflies) {
      const p = fireflyPosition(fly, viewSeconds);
      if (this.visible(p.x, p.y, S.firefly.size, S.firefly.size)) fx.fillStyle(S.firefly.color).fillRect(Math.round(p.x), Math.round(p.y), S.firefly.size, S.firefly.size);
    }
    for (const puddle of w.puddles) this.visual(`puddle/${puddle.id}`, 'vfx', S.frames.puddle[Math.floor(viewSeconds * S.water.fps) % S.frames.puddle.length],
      puddle.x, puddle.y, DEPTH.vfx, { w: puddle.w, h: puddle.h, color: S.puddle.color, alpha: S.puddle.alpha, ox: 0, oy: 0 });
    for (const rock of w.fallingRocks.rocks) this.visual(`rock/${rock.id}`, 'projectiles', S.frames.rock, rock.x, rock.y, DEPTH.markers,
      { w: rock.w, h: rock.h, color: S.bodies.fallback, oy: 0 });
    const markerGfx = this.graphics.get(DEPTH.markers)!;
    for (const marker of featureMarkers(w)) if (this.visible(marker.x - marker.w / 2, marker.y - S.marker.height, marker.w, S.marker.height)) {
      const style = markerStyle(w, marker, viewSeconds);
      markerGfx.fillStyle(style.color, style.alpha).fillRect(Math.round(marker.x - marker.w / 2), marker.y - S.marker.height, marker.w, S.marker.height);
    }
    this.waterFx.update(w, events);
    for (const effect of this.waterFx.list) {
      const spec = S[effect.kind], frame = Math.min(spec.frames - 1, Math.floor(Math.max(0, w.tick - effect.born) * spec.fps / TICK_RATE));
      this.visual(`waterFx/${effect.id}`, 'vfx', `${S.frames[effect.kind]}${String(frame).padStart(2, '0')}`, effect.x, effect.y, DEPTH.vfx,
        { w: spec.w, h: spec.h, color: S.water.fallback, alpha: 1 - frame / spec.frames });
    }
    for (const [id, image] of this.sprites) if (!this.seen.has(id)) { image.destroy(); this.sprites.delete(id); }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off('shutdown', this.destroy, this);
    for (const gfx of this.graphics.values()) gfx.destroy();
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.graphics.clear(); this.sprites.clear(); this.waterFx.list = [];
  }
}
