import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { arenaWorld } from '../../core/testkit/combatWorld.ts';
import { firePlayerProjectile } from '../../core/combat/playerProjectiles.ts';
import { newWeapon } from '../../core/abilities/runtime.ts';
import { spawnEnemyProjectile } from '../../core/enemies/projectiles.ts';
import { ENEMY_PROJECTILES } from '../../data/enemyProjectiles.ts';
import { DEPTH, VIEW } from '../../data/art.ts';
import { alphaAt, DarknessView, worldLights } from './darkness.ts';

const BOMB = ENEMY_PROJECTILES.bomb!;
const zone = { id: 1, x: 0, y: 0, w: 600, h: 600, lightRadius: 112 };

describe('darkness mask (08 §10.2)', () => {
  it('pins the four checklist light distances without multiplying overlapping alpha', () => {
    const light = { x: 200, y: 200, radius: 112 };
    expect([50, 80, 100, 130].map((d) => alphaAt(200 + d, 200, [zone], [light]))).toEqual([0, 0.4, 0.65, 0.82]);
    expect(alphaAt(280, 200, [zone], [light, light])).toBe(0.4);
  });

  it('keeps exact radius boundaries inclusive and uses the lowest overlapping light alpha', () => {
    const light = { x: 200, y: 200, radius: 100 };
    expect([60, 85, 100, 101].map((d) => alphaAt(200 + d, 200, [zone], [light]))).toEqual([0, 0.4, 0.65, 0.82]);
    expect(alphaAt(280, 200, [zone], [light, { x: 280, y: 200, radius: 10 }])).toBe(0);
  });

  it('ramps the outer32pixels in four8pixel steps on all four edges', () => {
    expect([0, 7, 8, 15, 16, 23, 24, 31, 32].map((x) => alphaAt(x, 100, [zone], []))).toEqual([0.2, 0.2, 0.4, 0.4, 0.6, 0.6, 0.82, 0.82, 0.82]);
    expect(alphaAt(100, 8, [zone], [])).toBe(0.4);
    expect(alphaAt(591, 100, [zone], [])).toBe(0.4);
    expect(alphaAt(100, 591, [zone], [])).toBe(0.4);
    expect(alphaAt(-1, 100, [zone], [])).toBe(0);
    expect(alphaAt(600, 100, [zone], [])).toBe(0);
  });

  it('never darkens an already lighter zone edge and keeps player radii local to their zones', () => {
    expect(alphaAt(8, 200, [zone], [{ x: 108, y: 200, radius: 100 }])).toBe(0.4);
    const other = { ...zone, id: 2, x: 700, lightRadius: 20 };
    expect(alphaAt(800, 200, [zone, other], [{ x: 800, y: 200, radius: 112, zoneId: 1 }])).toBe(0.82);
  });

  it('uses each zone player radius and a living Wisp32 light without changing the world', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'wisp', x: 400, y: 250, facing: 1 }] });
    w.darkZones = [zone, { ...zone, id: 2, lightRadius: 80 }];
    const before = JSON.stringify({ body: w.body, zones: w.darkZones, enemies: w.enemies });
    const lights = worldLights(w, 0);
    expect(lights.filter((l) => l.zoneId !== undefined).map((l) => l.radius)).toEqual([112, 80]);
    expect(lights).toContainEqual({ x: 400, y: 250 - w.enemies[0].def.hurtbox.h / 2, radius: 32 });
    expect(JSON.stringify({ body: w.body, zones: w.darkZones, enemies: w.enemies })).toBe(before);
    w.enemies[0].dead = true;
    expect(worldLights(w, 0).filter((l) => l.zoneId === undefined)).toEqual([]);
  });

  it('drifts fireflies within six pixels and repeats after three view seconds', () => {
    const w = arenaWorld(); w.fireflies = [{ id: 42, x: 200, y: 200, radius: 48 }];
    const a = worldLights(w, 0)[0], b = worldLights(w, 0.75)[0], loop = worldLights(w, 3)[0];
    expect(a.radius).toBe(48); expect(b).not.toEqual(a);
    expect(Math.abs(b.x - 200)).toBeLessThanOrEqual(6); expect(Math.abs(b.y - 200)).toBeLessThanOrEqual(6);
    expect(loop.x).toBeCloseTo(a.x); expect(loop.y).toBeCloseTo(a.y);
  });

  it('lights fire-element player shots and enemy fireballs, while ordinary shots stay dark', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'goblin_miner', x: 400, y: 320, facing: -1 }] });
    w.combat.slots[0] = { ...newWeapon('staff'), element: 'fire' };
    const shot = firePlayerProjectile(w, 0, 1, 'staff_bolt', 0)!;
    const flame = spawnEnemyProjectile(w, w.enemies[0], { ...BOMB, id: 'fireball', motion: 'straight' }, 'facing', 0);
    spawnEnemyProjectile(w, w.enemies[0], BOMB, 'arc', 0);
    expect(worldLights(w, 0)).toEqual([{ x: flame.x, y: flame.y, radius: 24 }, { x: shot.x, y: shot.y, radius: 24 }]);
    w.combat.slots[0]!.element = null;
    expect(worldLights(w, 0)).toHaveLength(1);
  });
});

function fakeScene() {
  const context = { createImageData: vi.fn((w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) })), putImageData: vi.fn((_image: ImageData, _x: number, _y: number) => {}) };
  const canvas = { getContext: () => context, refresh: vi.fn() };
  const rt = { setOrigin: vi.fn().mockReturnThis(), setScrollFactor: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(), clear: vi.fn().mockReturnThis(), stamp: vi.fn().mockReturnThis(), render: vi.fn(), destroy: vi.fn() };
  const scene = { add: { renderTexture: vi.fn(() => rt) }, textures: { createCanvas: vi.fn(() => canvas), remove: vi.fn() }, cameras: { main: { scrollX: 0, scrollY: 0 } }, events: { once: vi.fn(), off: vi.fn() } };
  return { scene: scene as unknown as Phaser.Scene, raw: scene, rt, context, canvas };
}

describe('DarknessView lifecycle', () => {
  it('owns a640x360 screen-fixed RenderTexture below markers and cleans up once', () => {
    const f = fakeScene(), view = new DarknessView(f.scene);
    expect(VIEW).toEqual({ w: 640, h: 360 }); expect(DEPTH.darkness).toBe(85);
    expect(f.raw.add.renderTexture).toHaveBeenCalledWith(0, 0, VIEW.w, VIEW.h);
    expect(f.rt.setDepth).toHaveBeenCalledWith(DEPTH.darkness);
    expect(f.rt.setScrollFactor).toHaveBeenCalledWith(0);
    expect(f.raw.events.once).toHaveBeenCalledWith('shutdown', expect.any(Function), view);
    view.destroy(); view.destroy();
    expect(f.rt.destroy).toHaveBeenCalledTimes(1); expect(f.raw.textures.remove).toHaveBeenCalledTimes(1);
  });

  it('rasterizes MIN alpha, refreshes when lights move and avoids uploads for unchanged frames', () => {
    const f = fakeScene(), view = new DarknessView(f.scene), w = arenaWorld();
    w.darkZones = [zone]; w.body.x = 200; w.body.y = 214; w.body.h = 28;
    view.update(w, 0);
    const pixels = f.context.putImageData.mock.calls[0][0] as unknown as ImageData;
    expect(pixels.data[(200 * VIEW.w + 280) * 4 + 3]).toBe(Math.round(0.4 * 255));
    expect(pixels.data[(200 * VIEW.w + 200) * 4 + 3]).toBe(0);
    view.update(w, 0);
    expect(f.canvas.refresh).toHaveBeenCalledTimes(1);
    w.body.x += 10; view.update(w, 0);
    expect(f.canvas.refresh).toHaveBeenCalledTimes(2); expect(f.rt.render).toHaveBeenCalledTimes(2);
    view.destroy();
  });

  it('matches exact point sampling after camera movement and when firefly lights overlap', () => {
    const f = fakeScene(), view = new DarknessView(f.scene), w = arenaWorld();
    w.darkZones = [zone]; w.body.x = 200; w.body.y = 214; w.body.h = 28;
    w.fireflies = [{ id: 1, x: 260, y: 180, radius: 50 }, { id: 2, x: 260, y: 180, radius: 50 }];
    for (const camX of [0, 40]) {
      f.raw.cameras.main.scrollX = camX;
      view.update(w, 0);
      const pixels = f.context.putImageData.mock.calls.at(-1)![0] as unknown as ImageData;
      const lights = worldLights(w, 0);
      for (const [x, y] of [[1, 100], [8, 100], [200, 200], [280, 200], [300, 186], [400, 200]]) {
        expect(pixels.data[(y * VIEW.w + x) * 4 + 3]).toBe(Math.round(alphaAt(x + camX + 0.5, y + 0.5, w.darkZones, lights) * 255));
      }
    }
    expect(f.canvas.refresh).toHaveBeenCalledTimes(2);
    view.destroy();
  });

  it('hides outside all dark zones and ignores updates after scene shutdown', () => {
    const f = fakeScene(), view = new DarknessView(f.scene), w = arenaWorld();
    w.darkZones = [zone]; view.update(w, 0);
    f.raw.cameras.main.scrollX = 700; view.update(w, 0);
    expect(f.rt.setVisible).toHaveBeenLastCalledWith(false);
    expect(f.canvas.refresh).toHaveBeenCalledTimes(1);
    const shutdown = f.raw.events.once.mock.calls[0];
    (shutdown[1] as () => void).call(shutdown[2]);
    f.raw.cameras.main.scrollX = 0; view.update(w, 0);
    expect(f.canvas.refresh).toHaveBeenCalledTimes(1);
    expect(f.rt.destroy).toHaveBeenCalledTimes(1);
  });

  it('disables the screen mask for an overview and resumes its current world mask afterward', () => {
    const f = fakeScene(), view = new DarknessView(f.scene), w = arenaWorld();
    w.darkZones = [zone];
    view.setVisible(false); view.update(w, 0);
    expect(f.rt.setVisible).toHaveBeenLastCalledWith(false);
    expect(f.canvas.refresh).not.toHaveBeenCalled();
    view.setVisible(true); view.update(w, 0);
    expect(f.rt.setVisible).toHaveBeenLastCalledWith(true);
    expect(f.canvas.refresh).toHaveBeenCalledTimes(1);
    view.destroy();
  });
});
