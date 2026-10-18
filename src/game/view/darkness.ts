// A screen-sized darkness mask (08 §10.2). Reads the world; never changes game state.
import type Phaser from 'phaser';
import type { DarkZone, Firefly } from '../../core/level/features.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { DEPTH, VIEW } from '../../data/art.ts';
import { DARKNESS } from '../../data/darkness.ts';

export interface DarknessLight {
  x: number;
  y: number;
  radius: number;
  /** A player's radius belongs to that zone. Other lights affect every zone. */
  zoneId?: number;
}

function zoneAlpha(x: number, y: number, zone: Readonly<DarkZone>): number {
  if (x < zone.x || y < zone.y || x >= zone.x + zone.w || y >= zone.y + zone.h) return 0;
  const edgeDistance = Math.min(x - zone.x, y - zone.y, zone.x + zone.w - x, zone.y + zone.h - y);
  const step = Math.min(DARKNESS.edgeAlphas.length - 1, Math.floor(edgeDistance / (DARKNESS.edge / DARKNESS.edgeAlphas.length)));
  return DARKNESS.edgeAlphas[step];
}

function lightAlpha(distanceSquared: number, radius: number): number {
  for (const band of DARKNESS.lightBands) {
    if (distanceSquared <= (radius * band.fraction) ** 2) return band.alpha;
  }
  return DARKNESS.alpha;
}

/** Exact point sampling for the art checklist and renderer parity tests. */
export function alphaAt(x: number, y: number, zones: readonly Readonly<DarkZone>[], lights: readonly Readonly<DarknessLight>[]): number {
  let alpha = 0;
  for (const zone of zones) {
    let local = zoneAlpha(x, y, zone);
    if (local === 0) continue;
    for (const light of lights) {
      if (light.zoneId !== undefined && light.zoneId !== zone.id) continue;
      local = Math.min(local, lightAlpha((x - light.x) ** 2 + (y - light.y) ** 2, light.radius));
    }
    alpha = Math.max(alpha, local);
  }
  return alpha;
}

export function fireflyPosition(fly: Readonly<Pick<Firefly, 'x' | 'y'>>, viewSeconds: number): { x: number; y: number } {
  const phase = viewSeconds * Math.PI * 2 / DARKNESS.fireflyPeriod;
  return { x: fly.x + Math.sin(phase) * DARKNESS.fireflyDrift, y: fly.y + Math.cos(phase) * DARKNESS.fireflyDrift };
}

/** Fireflies use view time, so their loop does not consume an RNG draw or alter their level anchors. */
export function worldLights(w: GameWorld, viewSeconds: number): DarknessLight[] {
  const lights: DarknessLight[] = w.darkZones.map((zone) => ({
    x: w.body.x, y: w.body.y - w.body.h / 2, radius: zone.lightRadius ?? DARKNESS.playerRadius, zoneId: zone.id,
  }));
  for (const fly of w.fireflies) {
    lights.push({ ...fireflyPosition(fly, viewSeconds), radius: fly.radius });
  }
  for (const enemy of w.enemies) {
    if (enemy.def.id === 'wisp' && !enemy.dead) lights.push({ x: enemy.x, y: enemy.y - enemy.def.hurtbox.h / 2, radius: DARKNESS.wispRadius });
  }
  for (const shot of w.projectiles) {
    if (DARKNESS.fireProjectileIds.some((id) => id === shot.def.id)) lights.push({ x: shot.x, y: shot.y, radius: DARKNESS.fireRadius });
  }
  for (const shot of w.playerProjectiles) {
    if (w.combat.slots[shot.slot]?.element === 'fire') lights.push({ x: shot.x, y: shot.y, radius: DARKNESS.fireRadius });
  }
  return lights;
}

interface ZoneRaster {
  id: number;
  left: number;
  top: number;
  width: number;
  height: number;
  base: Uint8Array;
  work: Uint8Array;
}

let nextTexture = 0;

/** Cached zone edges plus bounded light passes preserve MIN alpha, including overlapping lights. */
export class DarknessView {
  private readonly scene: Phaser.Scene;
  private readonly textureKey = `darkness_view_${nextTexture++}`;
  private readonly canvas: Phaser.Textures.CanvasTexture;
  private readonly context: CanvasRenderingContext2D;
  private readonly pixels: ImageData;
  private readonly renderTexture: Phaser.GameObjects.RenderTexture;
  private cacheKey = '';
  private frameKey = '';
  private zones: ZoneRaster[] = [];
  private destroyed = false;
  private enabled = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.canvas = scene.textures.createCanvas(this.textureKey, VIEW.w, VIEW.h)!;
    this.context = this.canvas.getContext();
    this.pixels = this.context.createImageData(VIEW.w, VIEW.h);
    const data = this.pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = DARKNESS.color >>> 16;
      data[i + 1] = (DARKNESS.color >>> 8) & 255;
      data[i + 2] = DARKNESS.color & 255;
    }
    this.renderTexture = scene.add.renderTexture(0, 0, VIEW.w, VIEW.h).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.darkness);
    this.renderTexture.setVisible(false);
    scene.events.once('shutdown', this.destroy, this);
  }

  update(w: GameWorld, viewSeconds: number): void {
    if (this.destroyed || !this.enabled) return;
    const camera = this.scene.cameras.main, camX = Math.round(camera.scrollX), camY = Math.round(camera.scrollY);
    const key = JSON.stringify([camX, camY, w.darkZones]);
    if (key !== this.cacheKey) {
      this.cacheKey = key;
      this.zones = this.cacheZones(w.darkZones, camX, camY);
    }
    this.renderTexture.setVisible(this.zones.length > 0);
    if (this.zones.length === 0) { this.frameKey = ''; return; }
    const lights = worldLights(w, viewSeconds), frameKey = JSON.stringify([key, lights]);
    if (frameKey === this.frameKey) return;
    this.frameKey = frameKey;
    const data = this.pixels.data;
    for (let i = 3; i < data.length; i += 4) data[i] = 0;
    for (const zone of this.zones) {
      zone.work.set(zone.base);
      for (const light of lights) {
        if (light.zoneId !== undefined && light.zoneId !== zone.id) continue;
        const x = light.x - camX, y = light.y - camY;
        const left = Math.max(zone.left, Math.floor(x - light.radius)), right = Math.min(zone.left + zone.width, Math.ceil(x + light.radius));
        const top = Math.max(zone.top, Math.floor(y - light.radius)), bottom = Math.min(zone.top + zone.height, Math.ceil(y + light.radius));
        for (let py = top; py < bottom; py++) {
          for (let px = left; px < right; px++) {
            const i = (py - zone.top) * zone.width + px - zone.left;
            if (zone.work[i] === 0) continue;
            const alpha = Math.round(lightAlpha((px + 0.5 - x) ** 2 + (py + 0.5 - y) ** 2, light.radius) * 255);
            zone.work[i] = Math.min(zone.work[i], alpha);
          }
        }
      }
      for (let y = 0; y < zone.height; y++) {
        for (let x = 0; x < zone.width; x++) {
          const i = ((y + zone.top) * VIEW.w + x + zone.left) * 4 + 3;
          data[i] = Math.max(data[i], zone.work[y * zone.width + x]);
        }
      }
    }
    this.context.putImageData(this.pixels, 0, 0);
    this.canvas.refresh();
    this.renderTexture.clear().stamp(this.textureKey, undefined, 0, 0, { originX: 0, originY: 0 });
    // Phaser4 buffers RenderTexture commands until render() is called.
    this.renderTexture.render();
  }

  setVisible(on: boolean): void {
    this.enabled = on;
    if (!this.destroyed) this.renderTexture.setVisible(on && this.zones.length > 0);
  }

  private cacheZones(zones: readonly DarkZone[], camX: number, camY: number): ZoneRaster[] {
    const visible: ZoneRaster[] = [];
    for (const zone of zones) {
      const left = Math.max(0, Math.floor(zone.x - camX)), top = Math.max(0, Math.floor(zone.y - camY));
      const right = Math.min(VIEW.w, Math.ceil(zone.x + zone.w - camX)), bottom = Math.min(VIEW.h, Math.ceil(zone.y + zone.h - camY));
      const width = right - left, height = bottom - top;
      if (width <= 0 || height <= 0) continue;
      const base = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) base[y * width + x] = Math.round(zoneAlpha(camX + left + x + 0.5, camY + top + y + 0.5, zone) * 255);
      }
      visible.push({ id: zone.id, left, top, width, height, base, work: new Uint8Array(base.length) });
    }
    return visible;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off('shutdown', this.destroy, this);
    this.renderTexture.destroy();
    this.scene.textures.remove(this.textureKey);
    this.zones = [];
  }
}
