import { describe, expect, it } from 'vitest';
import { kitLoadout } from './abilities/runtime.ts';
import { processDeaths, resolvePlayerHits } from './combat/resolve.ts';
import { enemyRect, type EnemyState } from './enemies/enemy.ts';
import type { EnemySpawn } from './enemies/types.ts';
import { arenaWorld, stepSpec } from './testkit/combatWorld.ts';
import type { GameWorld } from './sim/gameWorld.ts';
import { WEAPONS } from '../data/weapons.ts';

function world(spawns: EnemySpawn[]) {
  const w = arenaWorld({ stage: 2, seed: 732, enemies: spawns });
  w.setLoadout(kitLoadout('swordsman', 'greatsword'));
  for (const e of w.enemies) { e.dormant = false; }
  return w;
}

function strike(w: GameWorld, e: EnemyState, damage = 16) {
  const spec = { ...WEAPONS.greatsword!.combo[0].hit!, damage };
  w.hitGroups.push({ id: w.newId(), owner: 'player', kind: 'melee', rect: enemyRect(e), spec,
    active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: w.newId(), slot: 0 });
  resolvePlayerHits(w);
}

describe('Swamp enemies in the real Stage 2 world (04 §5)', () => {
  it('a real flask sip removes poison, while canceling before the sip preserves it and the charge', () => {
    for (const cancel of [false, true]) {
      const w = world([]);
      w.health.hp = 50;
      w.playerStatus.poisoned = { stacks: 1, left: 480, next: 60, damageA: 1.3 };
      stepSpec(w, { heal: true }, cancel ? 28 : 29);
      expect(w.playerStatus.poisoned).not.toBeNull();
      expect(w.flask.charges).toBe(2);
      stepSpec(w, cancel ? { jump: true } : { heal: true });
      expect(w.flask.charges).toBe(cancel ? 2 : 1);
      if (cancel) expect(w.playerStatus.poisoned).not.toBeNull();
      else expect(w.playerStatus.poisoned).toBeNull();
    }
  });

  it('Rooted stops an existing dash and rejects fresh movement and jump input', () => {
    const w = world([]);
    stepSpec(w, { dash: true });
    expect(w.body.state).toBe('dash');
    const x = w.body.x;
    w.playerStatus.rooted = 120;
    stepSpec(w, { moveX: 1, jump: true }, 12);
    expect(w.body.x).toBe(x);
    expect(w.body.vx).toBe(0);
    expect(w.body.y).toBe(320);
  });

  it('uses all five Stage 2 HP values', () => {
    const ids = ['bog_zombie', 'giant_spider', 'wisp', 'swamp_witch', 'treant'] as const;
    const w = world(ids.map((enemy, i) => ({ enemy, x: 400 + i * 60, y: 320, facing: -1 })));
    expect(w.enemies.map((e) => e.maxHp)).toEqual([63, 49, 35, 45, 238]);
  });

  it('a submerged Zombie ignores hits, wakes near the player, and becomes hittable during its rise', () => {
    const w = world([{ enemy: 'bog_zombie', x: 400, y: 320, facing: -1, submerged: true }]);
    const zombie = w.enemies[0];
    strike(w, zombie);
    expect(zombie.hp).toBe(63);
    expect(zombie.aware).toBe(false);
    w.hitGroups = w.hitGroups.filter((g) => g.owner !== 'player');
    w.body.x = 350;
    stepSpec(w, {});
    expect(zombie.swamp?.submerged).toBe(false);
    expect(zombie.ai.attack?.def.id).toBe('rise_swipe');
    strike(w, zombie);
    expect(zombie.hp).toBe(43);
  });

  it('the Zombie rise gives all 96 warning ticks before its first 13-damage hit', () => {
    const w = world([{ enemy: 'bog_zombie', x: 200, y: 320, facing: -1, submerged: true }]);
    stepSpec(w, {});
    expect(w.enemies[0].ai.attack?.phase).toBe('tele');
    stepSpec(w, {}, 95);
    expect(w.health.hp).toBe(100);
    const events = stepSpec(w, {});
    expect(events).toContainEqual(expect.objectContaining({ t: 'hit', target: 'player', amount: 13 }));
    expect(w.health.hp).toBe(87);
  });

  it('hitting a hanging Spider makes it fall without a damaging Drop box', () => {
    const w = world([{ enemy: 'giant_spider', x: 230, y: 240, facing: -1, hang: true }]);
    const spider = w.enemies[0];
    strike(w, spider);
    expect(spider.hp).toBe(29);
    expect(spider.aware).toBe(true);
    expect(spider.swamp?.hanging).toBe(false);
    expect(spider.swamp?.harmlessDrop).toBe(true);
    w.body.x = 700;
    stepSpec(w, {}, 30);
    expect(spider.y).toBeGreaterThan(240);
    expect(w.hitGroups.some((g) => g.owner === spider.id && g.enemyHit)).toBe(false);
    expect(w.health.hp).toBe(100);
  });

  it('a Wisp that explodes gives no gold, flask, Rush or kill credit', () => {
    const w = world([{ enemy: 'wisp', x: 220, y: 313, facing: -1 }]);
    const wisp = w.enemies[0];
    wisp.aware = true;
    wisp.ai.state = 'engage';
    w.health.iframeTicks = 10000;
    w.flask.charges = 0;
    const events = [];
    for (let n = 0; n < 160 && !wisp.dead; n++) events.push(...stepSpec(w, {}));
    expect(wisp.dead).toBe(true);
    expect(w.econ.goldTenths).toBe(0);
    expect(w.flask.fillTenths).toBe(0);
    expect(w.rush.value).toBe(0);
    expect(w.run.stats.kills).toBe(0);
    expect(events.some((e) => e.t === 'kill')).toBe(false);
  });

  it('a Wisp killed by the player before exploding gives the normal 3 gold and 5 percent flask', () => {
    const w = world([{ enemy: 'wisp', x: 230, y: 313, facing: -1 }]);
    w.flask.charges = 0;
    strike(w, w.enemies[0], 32);
    const hitRush = w.rush.value;
    processDeaths(w);
    expect(w.enemies[0].dead).toBe(true);
    expect(w.econ.goldTenths).toBe(30);
    expect(w.flask.fillTenths).toBe(50);
    expect(w.rush.value - hitRush).toBe(15);
    expect(w.run.stats.kills).toBe(1);
  });

  it('the Treant root marker stays at its original point and misses a player who moves away', () => {
    const w = world([{ enemy: 'treant', x: 400, y: 320, facing: -1 }]);
    const treant = w.enemies[0];
    treant.aware = true;
    treant.ai.state = 'engage';
    treant.ai.cooldowns.set('branch_slam', 10000);
    stepSpec(w, {});
    expect(treant.ai.attack?.def.id).toBe('root_snare');
    expect(treant.swamp?.marker).toEqual({ x: 200, y: 320 });
    w.body.x = 500;
    stepSpec(w, {}, 100);
    expect(treant.swamp?.marker).toEqual({ x: 200, y: 320 });
    expect(w.playerStatus.rooted).toBe(0);
    expect(w.health.hp).toBe(100);
  });

  it('the Treant cannot start its next Branch Slam within 216 ticks after Root Snare lands', () => {
    const w = world([{ enemy: 'treant', x: 230, y: 320, facing: -1 }]);
    const treant = w.enemies[0];
    treant.aware = true;
    treant.ai.state = 'engage';
    treant.ai.cooldowns.set('branch_slam', 10000);
    stepSpec(w, {});
    expect(treant.ai.attack?.def.id).toBe('root_snare');
    treant.ai.cooldowns.set('branch_slam', 0);
    for (let n = 0; n < 110 && w.playerStatus.rooted === 0; n++) stepSpec(w, {});
    expect(w.playerStatus.rooted).toBe(120);
    const rootTick = w.tick;
    let branchTick = -1;
    for (let n = 0; n < 360; n++) {
      stepSpec(w, {});
      if (treant.ai.attack?.def.id === 'branch_slam') { branchTick = w.tick; break; }
    }
    expect(branchTick).toBeGreaterThanOrEqual(rootTick + 216);
  });
});
