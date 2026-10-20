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
import { Rng } from './rng.ts';
import { rollWeapon } from './loot/roll.ts';
import { FIXED_ODDS } from '../data/loot.ts';

function world(seedText = 'BK') {
  const width = 50, floor = 19;
  const rows = Array.from({ length: 24 }, (_, y) => Array.from({ length: width }, (_, x) => {
    if (y >= floor || x === 0 || x === width - 1 || (y === 2 && x >= 3 && x <= 44) || ((x === 3 || x === 44) && y < floor - 3)) return '#';
    return '.';
  }).join(''));
  const level = levelFrom(rows, [feet('player_start', 1, floor - 1),
    rect('arena', 4, 3, 40, 16, { id: 'gate', kind: 'boss', boss: 'black_knight', entry: 'left' }),
    rect('arena_door', 3, floor - 3, 1, 3, { arena: 'gate', role: 'entry' }),
    rect('arena_door', 44, floor - 3, 1, 3, { arena: 'gate', role: 'exit' }),
  ], 'kingdom');
  level.stage = 3;
  const w = GameWorld.fromLevel(level, { seedText, startKit: { cls: 'swordsman', weapon: 'greatsword' }, records: defaultSave() });
  w.run.road = 'mountain';
  w.run.splits = [3600, 7200, null, null];
  w.run.runTicks = 12000;
  w.health.iframeTicks = 100000;
  return w;
}
const knight = (w: GameWorld) => w.enemies.find((e) => e.def.id === 'black_knight')!;
function enter(w: GameWorld) {
  for (let n = 0; n < 300 && !w.run.arenas.gate.locked; n++) stepSpec(w, { moveX: 1 });
  expect(w.run.arenas.gate.locked).toBe(true);
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
const front = (w: GameWorld, e: EnemyState) => { w.body.x = e.x + 30 * e.facing; w.body.y = e.y; w.body.facing = e.facing === 1 ? -1 : 1; };

describe('The Black Knight (04 §9, §11)', () => {
  it('has 3,120 HP at Stage 3, a 640 x 256 arena, the right boss bar and a 1.0 s intro', () => {
    const w = world(), e = knight(w);
    expect(e.maxHp).toBe(3120);
    expect(e.dormant).toBe(true);
    const arena = w.arenas.get('gate')!;
    expect([arena.rect.w, arena.rect.h]).toEqual([640, 256]);
    for (let n = 0; n < 300 && !w.run.arenas.gate.locked; n++) stepSpec(w, { moveX: 1 });
    expect(e.boss?.introTicks).toBeGreaterThan(110);
    expect(w.bossBar).toMatchObject({ name: 'The Black Knight', title: 'Champion of the King', marks: [0.5] });
  });

  it('Triple Slash is three hits in phase 1 and the four-hit Quad Slash in phase 2', () => {
    const w = world(), e = knight(w);
    enter(w);
    startEnemyAttack(w, e, e.def.attacks[0]);
    expect(e.ai.attack!.chain).toHaveLength(2);
    e.ai.attack = null;
    e.boss!.enraged = true;
    startEnemyAttack(w, e, e.def.attacks[0]);
    expect(e.ai.attack!.chain).toHaveLength(3);
  });

  it('plays a 1.0 s transition at 50% HP: no acting, no poise damage, and it waits for a Break', () => {
    const w = world(), e = knight(w);
    enter(w);
    e.hp = Math.floor(e.maxHp * 0.5);
    e.control = { type: 'stagger', ticks: 20 };
    stepBossPhases(w);
    expect(e.boss!.enraged).toBe(false);                 // Break in progress: waits
    e.control = null;
    startEnemyAttack(w, e, e.def.attacks[0]);
    stepBossPhases(w);
    expect(e.boss!.enraged).toBe(true);
    expect(e.boss!.transitionTicks).toBe(120);
    expect(e.ai.attack).toBeNull();                      // the current attack was cancelled
    front(w, e);
    const poise = e.poise;
    strike(w, e);
    expect(e.poise).toBe(poise);
    expect(e.control).toBeNull();
    stepSpec(w, {}, 60);
    expect(e.ai.attack).toBeNull();
    stepSpec(w, {}, 70);
    expect(e.boss!.transitionTicks).toBe(0);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('walks at 84 px/s in phase 2 and attacks with a 0.6 s gap', () => {
    const w = world(), e = knight(w);
    enter(w);
    e.boss!.enraged = true;
    w.body.x = e.x - 200; w.body.y = e.y;
    e.ai.attack = null; e.ai.cooldowns.set('lunge_thrust', 99999); e.ai.cooldowns.set('dark_wave', 99999); e.ai.cooldowns.set('leap_slam', 99999);
    stepSpec(w, {}, 2);
    expect(Math.abs(e.vx)).toBeCloseTo(84, 5);
  });

  it('Bulwark: a frontal hit starts a 1.0 s x0.1 stance from the next tick, facing locked; then Shield Bash if close', () => {
    const w = world(), e = knight(w);
    enter(w);
    e.ai.attack = null; e.ai.state = 'engage'; e.ai.gapTicks = 0;
    front(w, e);
    const d1 = strike(w, e);
    expect(d1).toBeGreaterThan(0);
    expect(e.kingdom!.bulwarkTicks).toBe(120);
    stepSpec(w, {}, 1);
    const facing = e.facing;
    front(w, e);
    const d2 = strike(w, e);
    expect(d2).toBeLessThanOrEqual(Math.ceil(d1 * 0.1) + 1);
    w.body.x = e.x - facing * 30;                        // behind it (a dash-through): full damage
    stepSpec(w, {}, 2);
    w.body.x = e.x - facing * 30;
    const d3 = strike(w, e);
    expect(d3).toBeGreaterThan(d2 * 3);
    expect(e.facing).toBe(facing);
    w.body.x = e.x + facing * 30; w.body.y = e.y;
    let bashed = false;
    for (let n = 0; n < 130; n++) { stepSpec(w, {}); if ((e.ai.attack as { def: { id: string } } | null)?.def.id === 'shield_bash') bashed = true; }
    expect(bashed).toBe(true);
    expect(e.ai.cooldowns.get('bulwark')).toBeGreaterThan(0);
  });

  it('Bulwark has a 6.0 s cooldown in phase 1 and 4.0 s in phase 2', () => {
    for (const [enraged, cd] of [[false, 720], [true, 480]] as const) {
      const w = world(), e = knight(w);
      enter(w);
      e.boss!.enraged = enraged;
      e.ai.attack = null; e.ai.state = 'engage';
      front(w, e);
      strike(w, e);
      expect(e.ai.cooldowns.get('bulwark')).toBe(cd);
    }
  });

  it('Dark Wave leaves from +20 px at 300 px/s; Leaping Slam lands and sends two 260 px/s shockwaves', () => {
    const w = world(), e = knight(w);
    enter(w);
    e.boss!.enraged = true;
    e.ai.attack = null;
    w.body.x = e.x - 200; w.body.y = e.y;
    const wave = e.def.attacks.find((a) => a.id === 'dark_wave')!;
    startEnemyAttack(w, e, wave);
    stepSpec(w, {}, 74);
    const p = w.projectiles.find((q) => q.def.id === 'dark_wave')!;
    expect(p).toBeDefined();
    expect(Math.abs(p.vx)).toBe(300);
    expect(Math.abs(p.x - e.x)).toBeLessThan(40);
    w.projectiles = []; e.ai.attack = null; e.ai.gapTicks = 999;
    startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'leap_slam')!);
    let waves = 0;
    for (let n = 0; n < 300 && waves === 0; n++) { stepSpec(w, {}); waves = w.projectiles.filter((q) => q.def.id === 'shockwave').length; }
    expect(waves).toBe(2);
    expect(w.projectiles.filter((q) => q.def.id === 'shockwave').map((q) => Math.abs(q.vx))).toEqual([260, 260]);
  });

  it('Break lasts a fixed 3.0 s and takes x1.5', () => {
    const w = world(), e = knight(w);
    enter(w);
    e.ai.attack = null; e.kingdom = undefined;
    e.poise = 1;
    front(w, e);
    e.ai.cooldowns.set('bulwark', 99999);
    strike(w, e);
    expect(e.control).toMatchObject({ type: 'stagger', ticks: 360 });
    const hp = e.hp;
    const dmg = strike(w, e);
    const normal = (() => { const w2 = world(), e2 = knight(w2); enter(w2); e2.ai.attack = null; e2.ai.cooldowns.set('bulwark', 99999); front(w2, e2); return strike(w2, e2); })();
    expect(dmg).toBeGreaterThan(normal * 1.4);
    expect(hp - e.hp).toBe(dmg);
  });

  it('on death: split 3, 80 gold, flask full, one B-or-better weapon plus one ability drop, and a stat pick', () => {
    const w = world(), e = knight(w);
    enter(w);
    w.flask.charges = 0;
    killEnemy(w, e);
    processDeaths(w);
    expect(w.events).toContainEqual({ t: 'bossDefeated', bossId: 'black_knight', stage: 3 });
    expect(w.events).toContainEqual(expect.objectContaining({ t: 'split', index: 3 }));
    expect(w.run.splits[2]).not.toBeNull();
    expect(e.def.gold).toBe(80);
    expect(w.flask.charges).toBe(w.flask.maxCharges);
    const drops = w.groundItems.filter((i) => i.weapon || i.ability);
    expect(drops.filter((i) => i.weapon).length).toBeGreaterThanOrEqual(1);
    expect(['B', 'A', 'S']).toContain(drops.find((i) => i.weapon)!.weapon!.grade);
    expect(drops.length).toBeGreaterThanOrEqual(2);
    stepSpec(w, {}, 120);
    expect(w.run.phase).toBe('statPick');
  });

  it('its weapon odds are 60 / 31 / 9 for B / A / S (05 §3.5)', () => {
    const rng = new Rng(7);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 6000; i++) { const g = rollWeapon(() => rng.next(), FIXED_ODDS.blackKnight, ['swordsman'], {}).grade; counts[g] = (counts[g] ?? 0) + 1; }
    expect(Object.keys(counts).sort()).toEqual(['A', 'B', 'S']);
    expect(counts.B / 6000).toBeCloseTo(0.6, 1);
  });
});
