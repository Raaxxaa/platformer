import { describe, expect, it } from 'vitest';
import { kitLoadout } from './abilities/runtime.ts';
import { onDiveEvents } from './combat/dive.ts';
import { firePlayerProjectile } from './combat/playerProjectiles.ts';
import { enemyRect, type EnemyState } from './enemies/enemy.ts';
import { startEnemyAttack } from './enemies/attack.ts';
import type { EnemySpawn } from './enemies/types.ts';
import { resolvePlayerHits } from './combat/resolve.ts';
import { applyBurn, stepStatuses } from './combat/status.ts';
import type { HitSpec } from './combat/types.ts';
import { emptyInput } from './input.ts';
import { arenaWorld, stepSpec } from './testkit/combatWorld.ts';
import type { GameWorld } from './sim/gameWorld.ts';
import { DIVE, WEAPONS } from '../data/weapons.ts';

function world(spawns: EnemySpawn[]) {
  const w = arenaWorld({ stage: 2, seed: 731, enemies: spawns });
  w.setLoadout(kitLoadout('swordsman', 'greatsword'));
  for (const e of w.enemies) {
    e.dormant = false;
    e.aware = true;
    e.ai.state = 'engage';
  }
  return w;
}

function strike(w: GameWorld, e: EnemyState, hit: HitSpec = WEAPONS.greatsword!.combo[0].hit!) {
  w.hitGroups.push({ id: w.newId(), owner: 'player', kind: hit.kind, rect: enemyRect(e), spec: hit,
    active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: w.newId(), slot: 0 });
  resolvePlayerHits(w);
}

const golem = () => world([{ enemy: 'rock_golem', x: 230, y: 320, facing: -1 }]);

describe('Mountain enemies in the real Stage 2 world (04 §4)', () => {
  it('scales all five enemy HP values from their own stage', () => {
    const ids = ['bat_swarm', 'goblin_miner', 'rock_golem', 'ram', 'goblin_shaman'] as const;
    const w = world(ids.map((enemy, i) => ({ enemy, x: 400 + i * 60, y: 320, facing: -1 })));
    expect(w.enemies.map((e) => e.maxHp)).toEqual([35, 42, 84, 56, 168]);
  });

  it('a frontal matched C-grade hit deals 5, halves poise, blocks knockback and recoils the player', () => {
    const w = golem(), e = w.enemies[0];
    expect(w.classState.weaponMatched[0]).toBe(true);
    strike(w, e);
    expect(e.hp).toBe(79);
    expect(e.poise).toBe(32.5);
    expect(e.knockback).toBe(false);
    expect(e.vx).toBe(0);
    expect(w.body.vx).toBe(-120);
  });

  it('a hit from behind deals the full 20 and applies normal poise and knockback', () => {
    const w = golem(), e = w.enemies[0];
    w.body.x = 260;
    w.body.facing = -1;
    strike(w, e);
    expect(e.hp).toBe(64);
    expect(e.poise).toBe(25);
    expect(e.knockback).toBe(true);
  });

  it('a heavy frontal hit keeps full poise damage and knockback while armor still reduces damage', () => {
    const w = golem(), e = w.enemies[0];
    strike(w, e, { damage: 16, kb: [120, -40], poise: 15, hitStop: 0, kind: 'melee', heavy: true });
    expect(e.hp).toBe(79);
    expect(e.poise).toBe(25);
    expect(e.knockback).toBe(true);
  });

  it('a guarded frontal arrow stops even when it could normally pierce five enemies', () => {
    const w = golem();
    const arrow = firePlayerProjectile(w, 0, w.newId(), 'arrow', 0, { pierce: 5 })!;
    resolvePlayerHits(w);
    expect(w.playerProjectiles).not.toContain(arrow);
    expect(w.hitGroups.find((g) => g.id === arrow.groupId)?.active).toBe(false);
  });

  it('golem turning needs 96 continuous ticks on the other side and resets when the player returns', () => {
    const w = golem(), e = w.enemies[0];
    e.ai.gapTicks = 10000;
    w.body.x = 260;
    stepSpec(w, {}, 48);
    expect(e.facing).toBe(-1);
    w.body.x = 200;
    stepSpec(w, {});
    w.body.x = 260;
    stepSpec(w, {}, 95);
    expect(e.facing).toBe(-1);
    stepSpec(w, {});
    expect(e.facing).toBe(1);
  });

  it('a source above the hurtbox bypasses guard even on the facing side', () => {
    const w = golem(), e = w.enemies[0];
    w.body.y = 270;
    strike(w, e);
    expect(e.hp).toBe(64);
    expect(e.poise).toBe(25);
  });

  it('a real dive impact bypasses guard while its source is below the golem top', () => {
    const w = golem(), e = w.enemies[0];
    w.body.state = 'diveLand';
    w.dive = { slot: 0, def: DIVE.heavy, descentId: null, impactId: null, impactTicks: 0, hitEnemies: new Set() };
    onDiveEvents(w, ['diveLand'], emptyInput());
    resolvePlayerHits(w);
    expect(e.hp).toBe(51);
  });

  it('a real Ram headbutt deals Stage 2 damage and the specified ledge knockback', () => {
    const w = world([{ enemy: 'ram', x: 232, y: 320, facing: -1 }]);
    const e = w.enemies[0];
    startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'headbutt')!);
    let hit = false;
    for (let n = 0; n < 110 && !hit; n++) hit = stepSpec(w, {}).some((ev) => ev.t === 'hit' && ev.target === 'player');
    expect(hit).toBe(true);
    expect(w.health.hp).toBe(86);
    expect(w.body.vx).toBe(-420);
    expect(w.body.vy).toBe(-220);
  });

  it('a Bat survives a real hit, finishes stagger and knockback, then resumes waypoint flight', () => {
    const w = world([{ enemy: 'bat_swarm', x: 230, y: 290, facing: -1 }]);
    const bat = w.enemies[0];
    w.health.iframeTicks = 10000;
    bat.ai.cooldowns.set('dive_bite', 10000);
    strike(w, bat);
    expect(bat.hp).toBe(15);
    expect(bat.control?.type).toBe('stagger');
    expect(bat.knockback).toBe(true);
    stepSpec(w, {}, 100);
    expect(bat.dead).toBe(false);
    expect(bat.control).toBeNull();
    expect(bat.knockback).toBe(false);
    expect(bat.grounded).toBe(false);
    expect(Math.hypot(bat.vx, bat.vy)).toBeCloseTo(110);
  });

  it('a real Stone Ward cast protects HP, poise and knockback even when its barrier breaks', () => {
    const w = world([{ enemy: 'goblin_shaman', x: 500, y: 320, facing: -1 },
      { enemy: 'goblin_miner', x: 400, y: 320, facing: -1 }]);
    const [shaman, miner] = w.enemies;
    startEnemyAttack(w, shaman, shaman.def.attacks.find((a) => a.id === 'stone_ward')!);
    stepSpec(w, {}, 72);
    expect(miner.ward?.hp).toBe(28);
    expect(shaman.ward).toBeNull();
    const poise = miner.poise;
    strike(w, miner, { damage: 32, kb: [120, -40], poise: 100, hitStop: 0, kind: 'melee' });
    // The class match makes 32 base damage into 40; the barrier absorbs the first 28.
    expect(miner.hp).toBe(30);
    expect(miner.ward).toBeNull();
    expect(miner.poise).toBe(poise);
    expect(miner.knockback).toBe(false);
    expect(miner.control).toBeNull();
  });

  it('burn damage also drains a Stone Ward before enemy HP', () => {
    const w = world([{ enemy: 'goblin_shaman', x: 500, y: 320, facing: -1 },
      { enemy: 'goblin_miner', x: 400, y: 320, facing: -1 }]);
    const [shaman, miner] = w.enemies;
    startEnemyAttack(w, shaman, shaman.def.attacks.find((a) => a.id === 'stone_ward')!);
    stepSpec(w, {}, 72);
    applyBurn(miner, 40, 0, null);
    miner.status.burn!.next = 1;
    stepStatuses(w);
    expect(miner.hp).toBe(30);
    expect(miner.ward).toBeNull();
  });
});
