import { describe, expect, it } from 'vitest';
import { GameWorld } from './sim/gameWorld.ts';
import { levelFrom, feet, rect } from './testkit/levelData.ts';
import { stepSpec } from './testkit/combatWorld.ts';
import { enemyRect, type EnemyState } from './enemies/enemy.ts';
import { startEnemyAttack } from './enemies/attack.ts';
import { spawnEnemyProjectile } from './enemies/projectiles.ts';
import { killEnemy, processDeaths, resolvePlayerHits } from './combat/resolve.ts';
import { defaultSave } from './save/schema.ts';
import { WEAPONS } from '../data/weapons.ts';
import { ENEMY_PROJECTILES } from '../data/enemyProjectiles.ts';

type Guardian = 'stone_colossus' | 'spider_queen';
function world(id: Guardian, seedText = 'M71GUARDIAN') {
  const mountain = id === 'stone_colossus';
  const innerW = mountain ? 36 : 32, innerH = mountain ? 18 : 20;
  const width = innerW + 10, floor = innerH + 3, exitX = innerW + 4;
  const rows = Array.from({ length: floor + 3 }, (_, y) => Array.from({ length: width }, (_, x) => {
    if (y >= floor || x === 0 || x === width - 1 || (y === 2 && x >= 3 && x <= exitX)
      || ((x === 3 || x === exitX) && y < floor - 3)) return '#';
    if (y === floor - 6 && (mountain ? (x >= 4 && x < 8) || (x >= exitX - 4 && x < exitX)
      : (x >= 9 && x < 15) || (x >= 25 && x < 31))) return '=';
    return '.';
  }).join(''));
  const level = levelFrom(rows, [feet('player_start', 1, floor - 1),
    rect('arena', 4, 3, innerW, innerH, { id: 'boss2', kind: 'boss', boss: id, entry: 'left' }),
    rect('arena_door', 3, floor - 3, 1, 3, { arena: 'boss2', role: 'entry' }),
    rect('arena_door', exitX, floor - 3, 1, 3, { arena: 'boss2', role: 'exit' }),
  ], mountain ? 'mountains' : 'swamps');
  level.stage = 2;
  const w = GameWorld.fromLevel(level, { seedText, startKit: { cls: 'swordsman', weapon: 'greatsword' }, records: defaultSave() });
  w.run.road = mountain ? 'mountain' : 'forest';
  w.run.splits = [3600, null, null, null];
  w.run.runTicks = 9000;
  w.health.iframeTicks = 10000;
  return w;
}
function boss(w: GameWorld, id: Guardian) {
  const e = w.enemies.find((e) => e.def.id === id);
  expect(e).toBeDefined();
  return e!;
}
function enter(w: GameWorld) {
  for (let n = 0; n < 300 && !w.run.arenas.boss2.locked; n++) stepSpec(w, { moveX: 1 });
  expect(w.run.arenas.boss2.locked).toBe(true);
}
function strike(w: GameWorld, e: EnemyState) {
  const spec = WEAPONS.greatsword!.combo[0].hit!;
  w.hitGroups.push({ id: w.newId(), owner: 'player', kind: 'melee', rect: enemyRect(e), spec,
    active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: w.newId(), slot: 0 });
  resolvePlayerHits(w);
}
function brood() {
  const w = world('spider_queen'), queen = boss(w, 'spider_queen');
  enter(w);
  stepSpec(w, {}, 120);
  startEnemyAttack(w, queen, queen.def.attacks.find((a) => a.id === 'brood')!);
  stepSpec(w, {}, 96);
  const children = w.enemies.filter((e) => e.def.id === 'spiderling' && !e.dead);
  expect(children).toHaveLength(2);
  return { w, queen, children };
}

describe.each(['stone_colossus', 'spider_queen'] as const)('Stage 2 Guardian %s (04 §9–10)', (id) => {
  it('uses Stage 2 boss HP, the real arena intro, and the correct boss bar', () => {
    const w = world(id), e = boss(w, id);
    expect(e.maxHp).toBe(id === 'stone_colossus' ? 1530 : 1445);
    expect(e.dormant).toBe(true);
    enter(w);
    expect(e.boss?.introTicks).toBe(120);
    expect(e.aware).toBe(true);
    expect(w.bossBar).toMatchObject({ name: id === 'stone_colossus' ? 'Stone Colossus' : 'Spider Queen',
      marks: id === 'stone_colossus' ? [0.5] : [0.66, 0.5, 0.33] });
  });

  it('records exact split 2, gives Guardian rewards, then opens the stat choice after 120 ticks', () => {
    const w = world(id), e = boss(w, id);
    enter(w);
    w.flask.charges = 0;
    w.flask.fillTenths = 137;
    w.rush.value = 0;
    const killTicks = w.run.runTicks;
    killEnemy(w, e);
    processDeaths(w);
    expect(w.events).toContainEqual({ t: 'bossDefeated', bossId: id, stage: 2 });
    expect(w.events).toContainEqual(expect.objectContaining({ t: 'split', index: 2, runTicks: killTicks, segmentTicks: killTicks - 3600 }));
    expect(w.run.splits[1]).toBe(killTicks);
    expect(e.def.gold).toBe(60);
    expect(w.rush.value).toBe(100);
    // 02 §3.5 adds Rush before gold; 05 §9.3 applies the new level-1 factor to the base 60.
    expect(w.econ.goldTenths).toBe(660);
    expect(w.flask.charges).toBe(w.flask.maxCharges);
    expect(w.flask.fillTenths).toBe(137);
    expect(w.groundItems.filter((i) => i.weapon)).toHaveLength(1);
    expect(w.run.arenas.boss2.locked).toBe(false);
    expect(w.bossBar).toBeNull();
    const road = id === 'stone_colossus' ? 'mountain' : 'forest';
    expect(w.records.bestSegments[`swordsman|${road}`]?.[1]).toBe(killTicks - 3600);
    expect(w.records.pbs).toEqual({});
    stepSpec(w, {}, 119);
    expect(w.run.phase).toBe('stage');
    stepSpec(w, {});
    expect(w.run.phase).toBe('statPick');
    expect(w.statPick?.offer).toHaveLength(3);
  });

  it('uses a real seeded blueprint roll and never drops more than one blueprint per kill', () => {
    let drops = 0;
    for (let n = 0; n < 16; n++) {
      const w = world(id, `M71GUARDIAN-${n}`), e = boss(w, id);
      killEnemy(w, e);
      processDeaths(w);
      const blueprints = w.groundItems.filter((i) => i.blueprint);
      expect(blueprints.length).toBeLessThanOrEqual(1);
      drops += blueprints.length;
    }
    expect(drops).toBeGreaterThan(0);
  });
});

it('the Colossus loses frontal armor during its fixed 240-tick Break', () => {
  const w = world('stone_colossus'), e = boss(w, 'stone_colossus');
  enter(w);
  w.body.x = e.x - 30;
  w.body.y = e.y;
  w.body.facing = 1;
  e.poise = 1;
  strike(w, e);
  expect(e.maxHp - e.hp).toBe(5);
  expect(e.control).toMatchObject({ type: 'stagger', ticks: 240 });
  const hp = e.hp;
  w.tick += 1;
  strike(w, e);
  expect(hp - e.hp).toBe(25);
  expect(e.control?.ticks).toBe(240);
});

it('a real Brood gives two Stage 2 Spiderlings all 60 invulnerable spawn-in ticks', () => {
  const { w, queen, children } = brood();
  for (const child of children) {
    expect(child).toMatchObject({ maxHp: 17, summonOwner: queen.id, noRewards: true, spawnInTicks: 60 });
    strike(w, child);
    expect(child.hp).toBe(17);
  }
  w.hitGroups = w.hitGroups.filter((g) => g.owner !== 'player');
  stepSpec(w, {}, 59);
  expect(children.map((e) => e.spawnInTicks)).toEqual([1, 1]);
  stepSpec(w, {});
  expect(children.map((e) => e.spawnInTicks)).toEqual([0, 0]);
});

it('a real player kill on a Spiderling gives no kill rewards', () => {
  const { w, children } = brood();
  stepSpec(w, {}, 60);
  w.rush.value = 0;
  w.flask.charges = 0;
  const kills = w.run.stats.kills, gold = w.econ.goldTenths, fill = w.flask.fillTenths;
  strike(w, children[0]);
  const hitRush = w.rush.value;
  processDeaths(w);
  expect(children[0].dead).toBe(true);
  expect(w.run.stats.kills).toBe(kills);
  expect(w.econ.goldTenths).toBe(gold);
  expect(w.flask.fillTenths).toBe(fill);
  expect(w.rush.value).toBe(hitRush);
});

it('Queen death clears her children and their effects on the killing tick without touching another owner', () => {
  const { w, queen, children } = brood();
  const other = w.spawnExtra({ enemy: 'goblin_miner', x: 32, y: queen.y, facing: 1 });
  const owners = new Set([queen.id, ...children.map((e) => e.id)]);
  for (const owner of [queen, children[0], other]) {
    spawnEnemyProjectile(w, owner, ENEMY_PROJECTILES.enemy_arrow!, 'facing', 0);
    w.puddles.push({ id: w.newId(), owner: owner.id, x: 100, y: queen.y - 8, w: 48, h: 8,
      left: 240, next: 60, status: 'poisoned' });
  }
  const kills = w.run.stats.kills;
  killEnemy(w, queen);
  processDeaths(w);
  expect(children.every((e) => e.dead)).toBe(true);
  expect(other.dead).toBe(false);
  expect(w.projectiles.some((p) => owners.has(p.owner))).toBe(false);
  expect(w.hitGroups.some((g) => typeof g.owner === 'number' && owners.has(g.owner))).toBe(false);
  expect(w.puddles.some((p) => owners.has(p.owner))).toBe(false);
  expect(w.projectiles.some((p) => p.owner === other.id)).toBe(true);
  expect(w.puddles.some((p) => p.owner === other.id)).toBe(true);
  expect(w.run.stats.kills).toBe(kills + 1);
});
