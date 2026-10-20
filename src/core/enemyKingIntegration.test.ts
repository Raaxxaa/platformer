import { describe, expect, it } from 'vitest';
import { GameWorld } from './sim/gameWorld.ts';
import { levelFrom, feet, rect } from './testkit/levelData.ts';
import { stepSpec } from './testkit/combatWorld.ts';
import { enemyRect, type EnemyState } from './enemies/enemy.ts';
import { startEnemyAttack } from './enemies/attack.ts';
import { killEnemy, processDeaths, resolvePlayerHits } from './combat/resolve.ts';
import { stepBossPhases } from './enemies/boss.ts';
import { defaultSave } from './save/schema.ts';
import { WEAPONS } from '../data/weapons.ts';
import { hurtPlayer } from './combat/health.ts';

function world(opts: { seeded?: boolean; practice?: boolean; cls?: 'swordsman' | 'tank'; weapon?: 'greatsword' | 'war_maul' } = {}) {
  const width = 50, floor = 21;
  const rows = Array.from({ length: 26 }, (_, y) => Array.from({ length: width }, (_, x) => {
    if (y >= floor || x === 0 || x === width - 1 || (y === 1 && x >= 3 && x <= 44) || ((x === 3 || x === 44) && y < floor - 3)) return '#';
    return '.';
  }).join(''));
  const level = levelFrom(rows, [feet('player_start', 1, floor - 1),
    rect('arena', 4, 2, 40, 19, { id: 'throne', kind: 'boss', boss: 'enemy_king', entry: 'left' }),
    rect('arena_door', 3, floor - 3, 1, 3, { arena: 'throne', role: 'entry' }),
    rect('arena_door', 44, floor - 3, 1, 3, { arena: 'throne', role: 'exit' }),
    feet('summon_point', 7, floor - 1, { arena: 'throne' }), feet('summon_point', 40, floor - 1, { arena: 'throne' }),
  ], 'castle');
  level.stage = 4;
  const w = GameWorld.fromLevel(level, { seedText: 'KING', seeded: opts.seeded, practice: opts.practice, startKit: { cls: opts.cls ?? 'swordsman', weapon: opts.weapon ?? 'greatsword' }, records: defaultSave() });
  w.run.road = 'mountain';
  w.run.splits = [3600, 7200, 10800, null];
  w.run.runTicks = 14000;
  w.health.iframeTicks = 100000;
  return w;
}
const king = (w: GameWorld) => w.enemies.find((e) => e.def.id === 'enemy_king')!;
function enter(w: GameWorld) {
  for (let n = 0; n < 300 && !w.run.arenas.throne.locked; n++) stepSpec(w, { moveX: 1 });
  expect(w.run.arenas.throne.locked).toBe(true);
  stepSpec(w, {}, 125);
}
function strike(w: GameWorld, e: EnemyState, spec = WEAPONS.greatsword!.combo[0].hit!) {
  w.hitGroups.push({ id: w.newId(), owner: 'player', kind: 'melee', rect: enemyRect(e), spec,
    active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: w.newId(), slot: 0 });
  const before = e.hp;
  w.playerFrozenAtTickStart = false;
  resolvePlayerHits(w);
  return before - e.hp;
}
const atk = (e: EnemyState, id: string) => e.def.attacks.find((a) => a.id === id)!;
/** Drops the HP to a fraction and runs the phase check; the King is free to transition. */
function hpTo(w: GameWorld, e: EnemyState, fraction: number) { e.hp = Math.floor(e.maxHp * fraction); stepBossPhases(w); }

describe('The Enemy King (04 §9, §12)', () => {
  it('has 3,960 HP at Stage 4, a 640 x 304 arena, the boss bar with two marks and a 1.0 s intro', () => {
    const w = world(), e = king(w);
    expect(e.maxHp).toBe(3960);
    const arena = w.arenas.get('throne')!;
    expect([arena.rect.w, arena.rect.h]).toEqual([640, 304]);
    for (let n = 0; n < 300 && !w.run.arenas.throne.locked; n++) stepSpec(w, { moveX: 1 });
    expect(e.boss?.introTicks).toBeGreaterThan(110);
    expect(w.bossBar).toMatchObject({ name: 'The Enemy King', marks: [0.66, 0.33] });
  });

  it('changes phase at 66% and 33%, with a 1.0 s transition, the listed attack gaps and walk speeds', () => {
    const w = world(), e = king(w);
    enter(w);
    expect(e.boss!.phase).toBe(1);
    w.body.x = e.x - 200; w.body.y = e.y;
    e.ai.attack = null; e.ai.gapTicks = 0; e.ai.state = 'engage';
    for (const a of e.def.attacks) e.ai.cooldowns.set(a.id, 99999);
    stepSpec(w, {}, 2);
    expect(Math.abs(e.vx)).toBeCloseTo(80, 5);
    hpTo(w, e, 0.65);
    expect([e.boss!.phase, e.boss!.transitionTicks]).toEqual([2, 120]);
    expect(e.boss!.entered).toEqual([2]);
    w.body.x = e.x - 30; const poise = e.poise; strike(w, e); expect(e.poise).toBe(poise);     // no poise damage during the transition
    hpTo(w, e, 0.5);
    expect(e.boss!.phase).toBe(2);
    stepSpec(w, {}, 140);
    hpTo(w, e, 0.32);
    expect([e.boss!.phase, e.boss!.transitionTicks]).toEqual([3, 120]);
    e.boss!.transitionTicks = 0; e.ai.attack = null;
    startEnemyAttack(w, e, atk(e, 'crown_cleave'));
    for (let i = 0; i < 400 && e.ai.attack; i++) stepSpec(w, {});
    expect(e.ai.gapTicks).toBeGreaterThan(50);
    expect(e.ai.gapTicks).toBeLessThanOrEqual(60);              // 0.5 s in phase 3
  });

  it('phase skip goes straight to phase 3 with one transition and a single Royal Decree', () => {
    const w = world(), e = king(w);
    enter(w);
    hpTo(w, e, 0.2);
    expect(e.boss!.phase).toBe(3);
    expect(e.boss!.entered).toEqual([3]);
    stepSpec(w, {}, 125);
    stepSpec(w, {}, 2);
    expect(e.ai.attack?.def.id).toBe('royal_decree');
    stepSpec(w, {}, 130);
    const guards = w.enemies.filter((g) => g.def.id === 'royal_guard');
    expect(guards).toHaveLength(2);
    expect(guards.map((g) => Math.round(g.x)).sort((a, b) => a - b)).toEqual([7 * 16 + 8, 40 * 16 + 8]);
    for (const g of guards) expect([g.noRewards, g.summonOwner, g.aware, g.maxHp]).toEqual([true, e.id, true, Math.round(50 * 2.4)]);
    expect(e.boss!.entered).toEqual([]);
  });

  it('Royal Decree skips a point whose guard from an earlier Decree is still alive', () => {
    const w = world(), e = king(w);
    enter(w);
    hpTo(w, e, 0.6); stepSpec(w, {}, 125 + 130);
    let guards = w.enemies.filter((g) => g.def.id === 'royal_guard');
    expect(guards).toHaveLength(2);
    guards[0].dead = true;                                       // one guard fell, the other lives
    e.ai.attack = null;
    hpTo(w, e, 0.3); stepSpec(w, {}, 125 + 130);
    guards = w.enemies.filter((g) => g.def.id === 'royal_guard' && !g.dead);
    expect(guards).toHaveLength(2);                              // only the dead point got a new guard
    expect(w.enemies.filter((g) => g.def.id === 'royal_guard')).toHaveLength(3);
  });

  it('Scepter Orbs fire 3 orbs in phase 1 and 5 in phases 2 and 3', () => {
    const w = world(), e = king(w);
    enter(w);
    w.body.x = e.x - 250; w.body.y = e.y;
    e.facing = -1;
    startEnemyAttack(w, e, atk(e, 'scepter_orbs'));
    stepSpec(w, {}, 90);
    expect(w.projectiles).toHaveLength(3);
    w.projectiles = []; e.ai.attack = null;
    startEnemyAttack(w, e, atk(e, 'scepter_orbs_wide'));
    stepSpec(w, {}, 90);
    expect(w.projectiles).toHaveLength(5);
    expect(e.def.attacks.filter((a) => a.phases?.includes(1)).map((a) => a.id)).not.toContain('scepter_orbs_wide');
  });

  it('Blade Rain marks 6 swords from the Tele start and drops them when the Tele ends', () => {
    const w = world(), e = king(w);
    enter(w);
    w.body.x = 300; w.body.y = e.y;
    startEnemyAttack(w, e, atk(e, 'blade_rain'));
    expect(w.rockMarkers).toHaveLength(6);
    expect(w.rockMarkers.map((m) => m.x)).toEqual([300, 380, 220, 460, 140, 540]);
    stepSpec(w, {}, 118);
    expect(w.projectiles).toHaveLength(0);
    stepSpec(w, {}, 4);
    expect(w.projectiles.filter((p) => p.def.id === 'falling_sword')).toHaveLength(6);
    expect(w.rockMarkers).toHaveLength(0);
  });

  it('Blade Rain markers clamp 16 px inside the walls', () => {
    const w = world(), e = king(w);
    enter(w);
    w.body.x = 100; w.body.y = e.y;
    startEnemyAttack(w, e, atk(e, 'blade_rain'));
    const a = w.arenas.get('throne')!.rect;
    for (const m of w.rockMarkers) expect(m.x).toBeGreaterThanOrEqual(a.x + 16);
    expect(w.rockMarkers.map((m) => m.x)).toContain(a.x + 16);
  });

  it('Throne Beam: fades 0.3 s, reappears 48 px from the farther wall facing the player, then a one-hit unblockable full-width beam at the rolled height', () => {
    const w = world(), e = king(w);
    enter(w);
    w.body.x = 160; w.body.y = e.y;                             // near the left wall: the right wall is farther
    startEnemyAttack(w, e, atk(e, 'throne_beam'));
    stepSpec(w, {}, 40);
    const a = w.arenas.get('throne')!.rect;
    expect(Math.round(e.x)).toBe(a.x + a.w - 48);
    expect(e.facing).toBe(-1);
    stepSpec(w, {}, 112);                                       // to the end of the 1.2 s Tele
    const beam = w.hitGroups.find((g) => g.owner === e.id && g.enemyHit?.unblockable);
    expect(beam).toBeDefined();
    const high = e.castle!.beamHigh;
    expect([beam!.rect.y + beam!.rect.h, beam!.rect.h]).toEqual(high ? [e.y - 18, 26] : [e.y, 16]);
    expect(beam!.rect.x).toBeLessThanOrEqual(a.x + 1);          // reaches the far wall
    expect(beam!.enemyHit!.damage).toBe(26);
  });

  it('Throne Beam height is 50/50 from the enemyAI stream', () => {
    let high = 0;
    for (let i = 0; i < 40; i++) {
      const w = world(), e = king(w);
      enter(w);
      for (let k = 0; k < i; k++) w.rng.enemyAI.next();
      startEnemyAttack(w, e, atk(e, 'throne_beam'));
      if (e.castle!.beamHigh) high++;
    }
    expect(high).toBeGreaterThan(8); expect(high).toBeLessThan(32);
  });

  it('Shockwave Slam lands with a 96 px box and sends two waves to the walls', () => {
    const w = world(), e = king(w);
    enter(w);
    e.boss!.phase = 2; e.boss!.enraged = true;
    w.body.x = e.x - 200; w.body.y = e.y;
    startEnemyAttack(w, e, atk(e, 'shockwave_slam'));
    for (let i = 0; i < 300 && e.ai.attack?.phase !== 'rec'; i++) stepSpec(w, {});
    const waves = w.projectiles.filter((p) => p.def.id === 'shockwave');
    expect(waves).toHaveLength(2);
    expect(waves[0].def).toMatchObject({ speed: 280, h: 20 });
    expect(waves[0].def.range).toBeUndefined();
  });
});

describe('Beating the Enemy King completes the run (06 §2.6)', () => {
  it('records split 4, stops the run clock, opens the summary phase and emits runCompleted; nothing drops', () => {
    const w = world(), e = king(w);
    enter(w);
    const ticks = w.run.runTicks;
    killEnemy(w, e);
    const events = stepSpec(w, {});
    expect(w.run.phase).toBe('runComplete');
    expect(events.map((x) => x.t)).toEqual(expect.arrayContaining(['bossDefeated', 'split', 'runCompleted']));
    expect(w.run.splits[3]).toBeGreaterThanOrEqual(ticks);
    expect(w.run.splits[3]).not.toBeNull();
    stepSpec(w, {}, 60);
    expect(w.run.runTicks).toBe(w.run.splits[3]);
    expect(w.groundItems.filter((i) => !i.stand && !i.key && i.blueprint === undefined)).toHaveLength(0);
    expect(w.run.winUnlocks.startWeapon).toBe('spear');
  });

  it('unlocks the class third starting weapon: Tank gets the Giant Axe; a practice run unlocks nothing', () => {
    const t = world({ cls: 'tank', weapon: 'war_maul' }); enter(t); killEnemy(t, king(t)); const ev = stepSpec(t, {});
    expect(ev).toContainEqual({ t: 'startingWeaponUnlocked', cls: 'tank', weapon: 'giant_axe' });
    const p = world({ cls: 'tank', weapon: 'war_maul', practice: true }); enter(p); killEnemy(p, king(p));
    expect(stepSpec(p, {}).some((x) => x.t === 'startingWeaponUnlocked')).toBe(false);
  });

  it('wins over a player death on the same tick: no death is recorded', () => {
    const w = world(), e = king(w);
    enter(w);
    w.health.iframeTicks = 0;
    killEnemy(w, e);
    hurtPlayer(w, { kind: 'hazard', cause: 'hazard', damageA: 99999 });
    expect(w.run.phase).toBe('dead');
    w.events.push({ t: 'playerDied', cause: 'hazard' });
    processDeaths(w);
    expect(w.run.phase).toBe('runComplete');
    expect(w.events.some((x) => x.t === 'playerDied')).toBe(false);
    expect(w.events.some((x) => x.t === 'runCompleted')).toBe(true);
  });

  it('is ignored while dead: a King dying on a later tick during the death phase does not complete the run', () => {
    const w = world(), e = king(w);
    enter(w);
    w.health.iframeTicks = 0;
    hurtPlayer(w, { kind: 'hazard', cause: 'hazard', damageA: 99999 });
    w.tick += 5;
    killEnemy(w, e); processDeaths(w);
    expect(w.run.phase).toBe('dead');
    expect(w.run.splits[3]).toBeNull();
  });
});
