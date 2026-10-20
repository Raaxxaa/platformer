import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../data/enemies.ts';
import { ENEMY_PROJECTILES } from '../../data/enemyProjectiles.ts';
import { WEAPONS } from '../../data/weapons.ts';
import { killEnemy, processDeaths, resolvePlayerHits } from '../combat/resolve.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { STAGE_SCALING } from '../tuning.ts';
import { eligibleAttacks } from './ai.ts';
import { startEnemyAttack } from './attack.ts';
import { castleState, gargoyleAtHover, isPile } from './castle.ts';
import { enemyRect, type EnemyState } from './enemy.ts';
import type { EnemyId } from './types.ts';

function world(enemies: { enemy: EnemyId; x: number; y?: number; facing?: 1 | -1 }[]) {
  const w = arenaWorld({ stage: 4, enemies: enemies.map((e) => ({ enemy: e.enemy, x: e.x, y: e.y ?? 320, facing: e.facing ?? -1 })) });
  w.health.iframeTicks = 99999;
  for (const e of w.enemies) e.dormant = false;
  return w;
}
function strike(w: GameWorld, e: EnemyState, spec = WEAPONS.greatsword!.combo[0].hit!, id?: number) {
  w.hitGroups.push({ id: id ?? w.newId(), owner: 'player', kind: 'melee', rect: enemyRect(e), spec,
    active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: w.newId(), slot: 0 });
  const before = e.hp;
  w.playerFrozenAtTickStart = false;
  resolvePlayerHits(w);
  return before - e.hp;
}

describe('Stage 4 data (04 §7, §8)', () => {
  it('has the listed stats, scaled at spawn by the Stage 4 multipliers', () => {
    const d = (id: EnemyId) => ENEMIES[id]!;
    expect(['royal_guard', 'gargoyle', 'castle_mage', 'living_armor', 'royal_executioner'].map((id) => d(id as EnemyId).hp)).toEqual([50, 40, 35, 45, 170]);
    expect(d('royal_executioner').elite).toBe(true);
    expect(d('living_armor').revives).toBe(1);
    expect(d('gargoyle')).toMatchObject({ flying: true, fly: 120, notice: { range: 96, rangeY: 96, time: 0 } });
    const w = world([{ enemy: 'royal_guard', x: 400 }, { enemy: 'enemy_king', x: 500 }]);
    expect(w.enemies[0].maxHp).toBe(Math.round(50 * STAGE_SCALING[4].mobHp));
    expect(w.enemies[1].maxHp).toBe(3960);
  });
  it('has the projectiles of 04 §8', () => {
    expect(ENEMY_PROJECTILES.arcane_bolt).toMatchObject({ speed: 240, range: 300, w: 8 });
    expect(ENEMY_PROJECTILES.royal_orb).toMatchObject({ speed: 160, life: 3, homing: { radius: 200, turnRate: 45 } });
    expect(ENEMY_PROJECTILES.falling_sword).toMatchObject({ motion: 'falling', speed: 600, w: 12, h: 32 });
    expect(ENEMY_PROJECTILES.fire_rain).toMatchObject({ speed: 450, w: 16, h: 16 });
  });
  it('a Royal Orb vanishes after 3.0 s', () => {
    const w = world([{ enemy: 'enemy_king', x: 500 }]);
    const e = w.enemies[0];
    w.body.x = 100; w.body.y = 320; e.aware = true;
    startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'scepter_orbs')!);
    stepSpec(w, {}, 100);
    expect(w.projectiles.length).toBe(3);
    stepSpec(w, {}, 360);
    expect(w.projectiles.length).toBe(0);
  });
});

describe('Gargoyle (04 §7)', () => {
  it('sleeps in stone form, takes x0.2 damage with no knockback or poise damage, and wakes when hit', () => {
    const w = world([{ enemy: 'gargoyle', x: 600, y: 200 }]);
    const e = w.enemies[0];
    expect(castleState(e).stone).toBe(true);
    stepSpec(w, {}, 5);
    expect(e.aware).toBe(false);
    const poise = e.poise;
    const dmg = strike(w, e);
    expect(dmg).toBeGreaterThan(0);
    expect(dmg).toBeLessThan(WEAPONS.greatsword!.combo[0].hit!.damage);
    expect(e.poise).toBe(poise);
    expect(e.knockback).toBe(false);
    expect(castleState(e).stone).toBe(false);
    expect(e.aware).toBe(true);
  });
  it('wakes when the player is within 96 px with line of sight, then cracks for 0.5 s before it can act', () => {
    const w = world([{ enemy: 'gargoyle', x: 330, y: 300 }]);
    const e = w.enemies[0];
    w.body.x = 250; w.body.y = 320;
    stepSpec(w, {}, 1);
    expect(castleState(e).stone).toBe(false);
    expect(castleState(e).crackTicks).toBeGreaterThan(50);
    stepSpec(w, {}, 40);
    expect(e.ai.attack).toBeNull();
  });
  it('stays asleep when the player is farther than 96 px', () => {
    const w = world([{ enemy: 'gargoyle', x: 500, y: 300 }]);
    stepSpec(w, {}, 30);
    expect(castleState(w.enemies[0]).stone).toBe(true);
  });
  it('hovers 72 px above the player feet and 48 px toward its own side, then Swoops down to the player', () => {
    const w = world([{ enemy: 'gargoyle', x: 330, y: 250 }]);
    const e = w.enemies[0];
    w.body.x = 290; w.body.y = 320;
    stepSpec(w, {}, 1);                                              // wakes
    let swooped = false;
    for (let i = 0; i < 600 && !swooped; i++) { stepSpec(w, {}, 1); swooped = e.ai.attack?.def.id === 'swoop'; }
    expect(swooped).toBe(true);
    expect(e.ai.attack!.phase).toBe('tele');
    expect(gargoyleAtHover(w, e)).toBe(true);
    expect(Math.abs(e.x - (290 + 48))).toBeLessThanOrEqual(8);
    expect(Math.abs(e.y - (320 - 72))).toBeLessThanOrEqual(8);
    const hover = e.y;
    stepSpec(w, {}, 80);                                             // Tele 0.5 s then the dive
    expect(e.y).toBeGreaterThan(hover);
    for (let i = 0; i < 80 && e.ai.attack?.phase !== 'rec'; i++) stepSpec(w, {}, 1);
    expect(e.y).toBeGreaterThanOrEqual(w.body.y - 6);
  });
  it('flies back to its perch and turns to stone when the player stays beyond 320 px for 6 s', () => {
    const w = world([{ enemy: 'gargoyle', x: 700, y: 300 }]);
    const e = w.enemies[0];
    w.body.x = 670; w.body.y = 320; stepSpec(w, {}, 100);
    expect(castleState(e).stone).toBe(false);
    w.body.x = 100; w.body.y = 320;
    castleState(e).farTicks = 6 * 120 - 3;                       // 5.975 s beyond 320 px so far
    stepSpec(w, {}, 1); expect(castleState(e).returning).toBe(false);
    stepSpec(w, {}, 3);
    expect(castleState(e).returning).toBe(true);
    for (let i = 0; i < 500; i++) { w.body.x = 100; w.body.y = 320; stepSpec(w, {}, 1); }
    expect(castleState(e).stone).toBe(true);
    expect(e.aware).toBe(false);
    expect([e.x, e.y]).toEqual([700, 300]);
  });
});

describe('Castle Mage Ward (04 §7)', () => {
  function ward() {
    const w = world([{ enemy: 'castle_mage', x: 400 }, { enemy: 'royal_guard', x: 330 }, { enemy: 'royal_guard', x: 350 }]);
    const [mage, a, b] = w.enemies;
    mage.aware = true; mage.ai.state = 'engage'; a.aware = b.aware = true; a.hp = 60; b.hp = 80;
    w.body.x = 100; w.body.y = 320;
    return { w, mage, a, b };
  }
  it('is offered only with an unwarded ally in 192 px, and picks the highest HP', () => {
    const { w, mage, a, b } = ward();
    expect(eligibleAttacks(w, mage).some((x) => x.id === 'ward')).toBe(true);
    startEnemyAttack(w, mage, mage.def.attacks.find((x) => x.id === 'ward')!);
    stepSpec(w, {}, 80);
    expect(castleState(mage).wardTarget).toBe(b.id);
    expect(castleState(b).wardedBy).toBe(mage.id);
    expect(castleState(a).wardedBy).toBeNull();
    const far = world([{ enemy: 'castle_mage', x: 700 }, { enemy: 'royal_guard', x: 330 }]);
    expect(eligibleAttacks(far, far.enemies[0]).some((x) => x.id === 'ward')).toBe(false);
  });
  it('halves damage on the warded ally and ends when the mage is staggered or the ally is too far', () => {
    const { w, mage, b } = ward();
    startEnemyAttack(w, mage, mage.def.attacks.find((x) => x.id === 'ward')!);
    stepSpec(w, {}, 80);
    const hp = b.hp;
    const warded = strike(w, b, { ...WEAPONS.greatsword!.combo[0].hit!, poise: 0 });
    b.hp = hp; castleState(b).wardedBy = null;
    const plain = strike(w, b, { ...WEAPONS.greatsword!.combo[0].hit!, poise: 0 });
    expect(warded).toBeLessThan(plain);
    expect(Math.abs(warded * 2 - plain)).toBeLessThanOrEqual(1);
    castleState(b).wardedBy = mage.id;
    b.x = mage.x - 300;                                             // more than 256 px apart
    stepSpec(w, {}, 2);
    expect(castleState(b).wardedBy).toBeNull();
    expect(castleState(mage).wardTarget).toBeNull();
  });
  it('ends at once when the mage takes a Break', () => {
    const { w, mage, b } = ward();
    startEnemyAttack(w, mage, mage.def.attacks.find((x) => x.id === 'ward')!);
    stepSpec(w, {}, 80);
    expect(castleState(b).wardedBy).toBe(mage.id);
    strike(w, mage, { ...WEAPONS.greatsword!.combo[0].hit!, poise: 999 });
    expect(castleState(b).wardedBy).toBeNull();
  });
});

describe('Living Armor (04 §7)', () => {
  it('collapses on the first HP 0: not a kill, no rewards, then only a dive slam finishes the pile', () => {
    const w = world([{ enemy: 'living_armor', x: 330 }]);
    const e = w.enemies[0];
    e.hp = 1;
    strike(w, e);
    expect(e.dead).toBe(false);
    expect(isPile(e)).toBe(true);
    expect(w.pendingDeaths).toHaveLength(0);
    expect(enemyRect(e)).toMatchObject({ w: 20, h: 10 });
    const gold = w.econ.goldTenths;
    expect(strike(w, e)).toBe(0);                                     // a normal hit does nothing to the pile
    expect(e.dead).toBe(false);
    w.dive = { descentId: 777, impactId: 778 } as never;
    strike(w, e, WEAPONS.greatsword!.combo[0].hit!, 777);
    processDeaths(w);
    expect(e.dead).toBe(true);
    expect(w.econ.goldTenths).toBeGreaterThan(gold);
  });
  it('rises after 2.0 s with half HP, hittable but unable to act for 0.5 s, then dies for good the second time', () => {
    const w = world([{ enemy: 'living_armor', x: 330 }]);
    const e = w.enemies[0];
    w.body.x = 300; e.aware = true; e.ai.state = 'engage';
    killEnemy(w, e);
    expect(isPile(e)).toBe(true);
    stepSpec(w, {}, 239);
    expect(isPile(e)).toBe(true);
    stepSpec(w, {}, 2);
    expect(isPile(e)).toBe(false);
    expect(e.hp).toBe(Math.round(0.5 * e.maxHp));
    expect(castleState(e).riseTicks).toBeGreaterThan(50);
    stepSpec(w, {}, 80);
    expect(e.aware).toBe(true);
    killEnemy(w, e);
    expect(e.dead).toBe(true);
  });
});

describe('Royal Executioner (04 §7)', () => {
  it('Whirling Axe moves at 60 px/s for 1.2 s and hits at most 3 times, 0.3 s apart', () => {
    const w = world([{ enemy: 'royal_executioner', x: 330 }]);
    const e = w.enemies[0];
    e.aware = true; e.ai.state = 'engage'; w.body.x = 100; w.body.y = 320; w.health.iframeTicks = 0;
    e.facing = -1; w.body.x = 330 - 20;
    const def = e.def.attacks.find((a) => a.id === 'whirling_axe')!;
    expect(def.move).toEqual({ dist: 72, time: 1.2 });
    expect(def.hit).toMatchObject({ rehit: 0.3, maxHits: 3, damage: 10 });
    startEnemyAttack(w, e, def);
    const x0 = e.x;
    stepSpec(w, {}, 84 + 140);
    expect(Math.abs(e.x - x0)).toBeGreaterThan(60);
  });
});
