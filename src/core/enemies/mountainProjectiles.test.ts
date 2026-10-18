import { describe, expect, it } from 'vitest';
import { ENEMY_PROJECTILES } from '../../data/enemyProjectiles.ts';
import { clearSpentGroups } from '../combat/playerProjectiles.ts';
import { resolveEnemyHits } from '../combat/resolve.ts';
import { gridFromRects } from '../level/build.ts';
import { Bodies } from '../physics/bodies.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { COMBAT } from '../tuning.ts';
import { spawnEnemyProjectile, stepProjectiles } from './projectiles.ts';

function world(oneway = false, stage: 1 | 2 = 2) {
  const grid = gridFromRects(60, 30, [
    { x0: 0, y0: 20, x1: 59, y1: 29, kind: 'solid' },
    ...(oneway ? [{ x0: 0, y0: 16, x1: 59, y1: 16, kind: 'oneway' as const }] : []),
  ]);
  return new GameWorld({ grid, spawn: { x: 500, y: 320 }, stage, enemies: [{ enemy: 'bandit_archer', x: 400, y: 320, facing: 1 }] });
}
function bomb(w: GameWorld, at = { x: 420, y: 240 }) {
  const p = spawnEnemyProjectile(w, w.enemies[0], ENEMY_PROJECTILES.bomb!, 'arc', 0, at);
  w.enemies[0].dead = true;
  return p;
}
function landBomb(w: GameWorld, x = 528) {
  const p = bomb(w, { x, y: 315 }); p.vx = 0; p.vy = 240;
  stepProjectiles(w); expect(p.arc?.landed).toBe(true); expect(p.arc?.fuseTicks).toBe(60);
  return p;
}

describe('mountain enemy projectiles (04 §2.7, §4, §8)', () => {
  it('defines the exact bomb and Hex Bolt data', () => {
    expect(ENEMY_PROJECTILES.bomb).toMatchObject({ w: 8, h: 8, motion: 'arc', arcTime: 0.8, blast: { w: 56, h: 56, fuse: 0.5 }, hit: { damage: 13, playerKb: [240, -220] } });
    expect(ENEMY_PROJECTILES.hex_bolt).toMatchObject({ w: 10, h: 10, speed: 220, range: 320, homing: { radius: 160, turnRate: 60 }, hit: { damage: 18 } });
  });

  it('aims an arc at the player feet at Act start, clamps vx, and does not retarget after firing', () => {
    const w = world(); w.body.x = 900; w.body.y = 200;
    const p = bomb(w, { x: 400, y: 300 });
    expect(p.vx).toBe(260); expect(p.vy).toBeCloseTo((200 - 300 - 0.5 * 1000 * 0.8 ** 2) / 0.8);
    w.body.x = 100; w.body.y = 320; stepProjectiles(w); expect(p.vx).toBe(260);
    const left = bomb(w, { x: 700, y: 100 }); expect(left.vx).toBe(-260);
  });

  it('uses gravity 1000 and the global time factor for arc movement', () => {
    const w = world(); w.worldTimeScale = 0.5;
    const p = bomb(w, { x: 420, y: 180 }); const vy = p.vy, x = p.x, y = p.y;
    stepProjectiles(w);
    expect(p.vy).toBeCloseTo(vy + 1000 / 240);
    expect(p.x).toBeCloseTo(x + p.vx / 240);
    expect(p.y).toBeCloseTo(y + vy / 240 + 0.5 * 1000 / 240 ** 2);
  });

  it('passes upward through a one-way platform, lands while falling, then waits a full sixty-tick fuse', () => {
    const w = world(true); const p = bomb(w, { x: 700, y: 280 }); p.vx = 0; p.vy = -400;
    for (let i = 0; i < 20; i++) stepProjectiles(w);
    expect(p.y).toBeLessThan(252); expect(p.arc?.landed).toBe(false);
    for (let i = 0; i < 120 && !p.arc?.landed; i++) stepProjectiles(w);
    expect(p.y).toBe(252); expect(p.arc?.fuseTicks).toBe(60);
    for (let i = 0; i < 59; i++) stepProjectiles(w);
    expect(w.projectiles).toContain(p); expect(w.blasts).toHaveLength(0);
    stepProjectiles(w); expect(w.projectiles).not.toContain(p); expect(w.blasts).toHaveLength(1);
  });

  it('lands on active solid bodies and scales the grounded fuse', () => {
    const w = world(); w.grid.bodies = new Bodies(60, 30);
    w.grid.bodies.add({ id: 'ledge', x: 640, y: 256, w: 64, h: 16, oneWay: false, surface: 'normal', grabbable: false, noTeleport: false, active: true });
    const p = bomb(w, { x: 670, y: 249 }); p.vx = 0; p.vy = 480;
    stepProjectiles(w); expect(p.y).toBe(252); expect(p.arc?.landed).toBe(true);
    w.worldTimeScale = 0.5;
    for (let i = 0; i < 119; i++) stepProjectiles(w);
    expect(w.projectiles).toContain(p); expect(p.arc?.fuseTicks).toBe(0.5);
    stepProjectiles(w); expect(w.projectiles).not.toContain(p); expect(w.blasts).toHaveLength(1);
  });

  it('a flight touch creates one blast, which uses real Stage 2 damage and knockback without a direct hit', () => {
    const w = world(); const p = bomb(w, { x: 499, y: 304 }); p.vx = 120; p.vy = 0;
    expect(w.hitGroups.find((g) => g.id === p.groupId)?.active).toBe(false);
    const events = stepSpec(w, {});
    expect(w.health.hp).toBe(83); expect(events.filter((e) => e.t === 'hit' && e.target === 'player')).toHaveLength(1);
    expect(Math.abs(w.body.vx)).toBe(240); expect(w.body.vy).toBe(-220);
    expect(w.projectiles).toHaveLength(0); expect(w.blasts).toHaveLength(1);
    const blast = w.hitGroups.find((g) => w.blasts.includes(g.id))!;
    expect(blast).toMatchObject({ owner: w.enemies[0].id, kind: 'shot', rect: { w: 56, h: 56 }, enemyHit: { damage: 13, playerKb: [240, -220] } });
    stepSpec(w, {}, 180); expect(w.health.hp).toBe(83); expect(w.blasts).toHaveLength(0);
  });

  it('a grounded blast reaches beyond the eight-pixel bomb and hits the player at most once', () => {
    const w = world(); landBomb(w);
    for (let i = 0; i < 60; i++) stepProjectiles(w);
    resolveEnemyHits(w); expect(w.health.hp).toBe(83);
    w.health.iframeTicks = 0; resolveEnemyHits(w); expect(w.health.hp).toBe(83);
    clearSpentGroups(w); expect(w.hitGroups.filter((g) => g.owner !== 'player')).toHaveLength(0);
  });

  it('an invulnerable flight touch still spends the bomb and never leaves delayed damage behind', () => {
    const w = world(); const p = bomb(w, { x: 500, y: 304 }); p.vx = 0; p.vy = 0;
    w.health.abilityIframeTicks = 120; stepSpec(w, {});
    expect(w.projectiles).toHaveLength(0); expect(w.health.hp).toBe(100); expect(w.blasts).toHaveLength(1);
    w.health.abilityIframeTicks = 0; stepSpec(w, {}); expect(w.health.hp).toBe(100);
  });

  it('a rightward bomb touching just past the player center knocks right, and a landed bomb keeps its throw direction', () => {
    const airborne = world(); const flying = bomb(airborne, { x: 499, y: 304 }); flying.vx = 240; flying.vy = 0;
    stepSpec(airborne, {}); expect(airborne.health.hp).toBe(83); expect(airborne.body.vx).toBe(240);
    const grounded = world(); landBomb(grounded, 528);
    // The throw begins leftward; after landing vx is zero and the target stands to the right of the blast center.
    grounded.body.x = 550;
    for (let i = 0; i < 60; i++) stepProjectiles(grounded);
    resolveEnemyHits(grounded); expect(grounded.health.hp).toBe(83); expect(grounded.body.vx).toBe(-240);
  });

  it('a rightward Hex Bolt touching at the player center knocks right, including after homing changes direction', () => {
    const w = world(); w.enemies[0].dead = true;
    spawnEnemyProjectile(w, w.enemies[0], ENEMY_PROJECTILES.hex_bolt!, 'facing', 0, { x: 500, y: 304 });
    stepSpec(w, {}); expect(w.health.hp).toBeLessThan(100); expect(w.body.vx).toBe(COMBAT.HURT_KB_X);
    const turning = world(); turning.body.x = 600;
    const p = spawnEnemyProjectile(turning, turning.enemies[0], ENEMY_PROJECTILES.hex_bolt!, 'facing', 0, { x: 500, y: 200 });
    expect(turning.hitGroups.find((g) => g.id === p.groupId)?.dir).toBe(1);
    p.vx = -220; p.vy = 0; stepProjectiles(turning);
    expect(turning.hitGroups.find((g) => g.id === p.groupId)?.dir).toBe(-1);
  });

  it('turns a nearby Hex Bolt by at most 60 degrees per second while keeping speed 220', () => {
    for (const scale of [1, 0.5]) {
      const w = world(); w.worldTimeScale = scale;
      const p = spawnEnemyProjectile(w, w.enemies[0], ENEMY_PROJECTILES.hex_bolt!, 'facing', 0, { x: 500, y: 250 });
      stepProjectiles(w);
      expect(Math.atan2(p.vy, p.vx)).toBeCloseTo((60 / 120) * scale * Math.PI / 180);
      expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(220);
      expect(p.traveled).toBeCloseTo(220 / 120 * scale);
    }
  });

  it('does not home beyond radius 160 and still flies after its owner dies or is frozen', () => {
    const w = world(); w.body.x = 900;
    const e = w.enemies[0]; e.dead = true; e.hitStopTicks = 120; e.frozenAtTickStart = true;
    const p = spawnEnemyProjectile(w, e, ENEMY_PROJECTILES.hex_bolt!, 'facing', 0, { x: 500, y: 200 });
    stepProjectiles(w); expect(p.vy).toBe(0); expect(p.x).toBeCloseTo(500 + 220 / 120);
    p.traveled = 319; stepProjectiles(w); expect(w.projectiles).not.toContain(p);
  });

  it('scales existing arrows and floor waves globally as well as new projectiles', () => {
    const w = world(); w.worldTimeScale = 0.5;
    const arrow = spawnEnemyProjectile(w, w.enemies[0], ENEMY_PROJECTILES.enemy_arrow!, 'facing', 0, { x: 700, y: 200 });
    const wave = spawnEnemyProjectile(w, w.enemies[0], ENEMY_PROJECTILES.brute_wave!, 'facing', 0, { x: 700, y: 320 });
    stepProjectiles(w); expect(arrow.x).toBeCloseTo(701.25); expect(wave.x).toBe(701);
  });
});
