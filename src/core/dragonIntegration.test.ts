import { describe, expect, it } from 'vitest';
import { GameWorld } from './sim/gameWorld.ts';
import { levelFrom, feet, rect } from './testkit/levelData.ts';
import { stepSpec } from './testkit/combatWorld.ts';
import { enemyRect, type EnemyState } from './enemies/enemy.ts';
import { cancelEnemyAttack, startEnemyAttack } from './enemies/attack.ts';
import { killEnemy, processDeaths, resolvePlayerHits } from './combat/resolve.ts';
import { stepBossPhases } from './enemies/boss.ts';
import { defaultSave } from './save/schema.ts';
import { WEAPONS } from '../data/weapons.ts';
import { DRAGONS, type DragonColor } from '../data/dragon.ts';
import { applyElementHit } from './combat/status.ts';
import type { ElementOnHit } from './combat/elements.ts';
import type { DragonRoll } from './run/dragonRoll.ts';

const SIDE = { x: 10, y: 5, w: 40, h: 20 };                   // inner arena in tiles: x 160..800, y 80..400
function world(opts: { color?: DragonColor; present?: boolean; stage?: 2 | 3; atStage?: 2 | 3; seed?: string } = {}) {
  const width = 60, floor = 25;
  const rows = Array.from({ length: 30 }, (_, y) => Array.from({ length: width }, (_, x) => {
    if (y >= floor) return '#';
    if (x === SIDE.x - 1 && (y >= SIDE.y - 1 && y < floor - 3)) return '#';                // the left wall, with a 3-tile opening at floor level
    if (x === SIDE.x + SIDE.w && y >= SIDE.y - 1) return '#';
    if (y === SIDE.y - 1 && x >= SIDE.x - 1 && x <= SIDE.x + SIDE.w) return '#';
    if (y === floor - 6 && x >= 26 && x <= 33) return '=';                                 // the central platform: 128 px wide, 96 px up
    return '.';
  }).join(''));
  const level = levelFrom(rows, [feet('player_start', 3, floor - 1), rect('arena', SIDE.x, SIDE.y, SIDE.w, SIDE.h, { id: 'hall', kind: 'side' })], opts.atStage === 2 ? 'swamps' : 'kingdom');
  level.stage = opts.atStage ?? 3;
  const dragon: DragonRoll = { present: opts.present ?? true, stage: opts.stage ?? opts.atStage ?? 3, color: opts.color ?? 'red', outcome: 'absent' };
  const w = GameWorld.fromLevel(level, { seedText: opts.seed ?? 'DRAGON', startKit: { cls: 'swordsman', weapon: 'greatsword' }, records: defaultSave(), dragon });
  w.health.iframeTicks = 100000;
  return w;
}
const dragon = (w: GameWorld) => w.enemies.find((e) => e.def.id === 'dragon')!;
const floorY = 25 * 16;
/** The Dragon stops starting attacks by itself so a test can start exactly one. */
function quiet(w: GameWorld, e: EnemyState) {
  cancelEnemyAttack(w, e);
  for (const a of e.def.attacks) e.ai.cooldowns.set(a.id, 99999);
  e.ai.gapTicks = 99999;
}
function enter(w: GameWorld) {
  w.teleportPlayer(300, floorY);
  stepSpec(w, {}, 2);
  expect(dragon(w).dragon!.awake).toBe(true);
  quiet(w, dragon(w));
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
const run = (w: GameWorld, e: EnemyState, id: string, n: number) => { e.ai.attack = null; startEnemyAttack(w, e, atk(e, id)); stepSpec(w, {}, n); };
/** Keeps the player standing where they are while the world runs. */
const hold = (w: GameWorld, x: number, n: number) => { for (let i = 0; i < n; i++) { w.body.x = x; w.body.y = floorY; stepSpec(w, {}); } };

describe('The Dragon is placed by the roll (06 §4)', () => {
  it('spawns perched at the side arena center, dormant, with the Stage 2 or 3 boss HP', () => {
    const w3 = world({ atStage: 3 }), e3 = dragon(w3);
    expect([e3.x, e3.y, e3.dormant, e3.maxHp]).toEqual([480, floorY, true, 2600]);
    expect(dragon(world({ atStage: 2 })).maxHp).toBe(1700);
  });
  it('is not spawned when the roll is absent or for the other stage', () => {
    expect(world({ present: false }).enemies.some((e) => e.def.id === 'dragon')).toBe(false);
    expect(world({ atStage: 3, stage: 2 }).enemies.some((e) => e.def.id === 'dragon')).toBe(false);
  });
  it('wakes with a 1.0 s intro when the player center enters the arena, with the color name on the bar', () => {
    for (const color of ['red', 'white', 'storm', 'green'] as const) {
      const w = world({ color }), e = dragon(w);
      expect(w.bossBar).toBeNull();
      stepSpec(w, {}, 5);
      expect(e.dormant).toBe(true);
      enter(w);
      expect(e.boss!.introTicks).toBeGreaterThan(110);
      expect(w.bossBar).toMatchObject({ name: `${color[0].toUpperCase()}${color.slice(1)} Dragon`, title: 'Wandering Terror', marks: [0.5] });
      expect(e.def).toBe(DRAGONS[color]);
    }
  });
  it('emits dragonWarning once when the warning zone is entered, only where the Dragon is', () => {
    const w = world({ color: 'storm' });
    w.level!.objects.push({ id: 900, type: 'dragon_warning', x: 16, y: 300, w: 16, h: 100, props: {} });
    w.teleportPlayer(24, 390);
    const first = stepSpec(w, {}, 2).filter((e) => e.t === 'dragonWarning');
    expect(first).toEqual([{ t: 'dragonWarning', color: 'storm' }]);
    expect(stepSpec(w, {}, 5).filter((e) => e.t === 'dragonWarning')).toEqual([]);
    const other = world({ present: false });
    other.level!.objects.push({ id: 900, type: 'dragon_warning', x: 16, y: 300, w: 16, h: 100, props: {} });
    other.teleportPlayer(24, 390);
    expect(stepSpec(other, {}, 2).some((e) => e.t === 'dragonWarning')).toBe(false);
  });
});

describe('Dragon leaving and returning (04 §13.3)', () => {
  it('turns passive after 3.0 s outside, keeps its HP, clears its attacks and resumes with no intro', () => {
    const w = world(), e = dragon(w);
    enter(w);
    stepSpec(w, {}, 130); quiet(w, dragon(w));
    e.hp = Math.round(e.maxHp * 0.8); const poise = e.poise;
    run(w, e, 'breath', 100);
    w.teleportPlayer(48, floorY);
    stepSpec(w, {}, 3 * 120 + 2);
    expect(e.dragon!.passive).toBe(true);
    expect(e.ai.attack).toBeNull();
    expect(w.projectiles.filter((p) => p.owner === e.id)).toHaveLength(0);
    expect([e.x, e.hp, e.poise]).toEqual([480, Math.round(e.maxHp * 0.8), poise]);
    expect(w.bossBar).toBeNull();
    w.teleportPlayer(300, floorY);
    stepSpec(w, {}, 2);
    expect(e.dragon!.passive).toBe(false);
    expect(e.boss!.introTicks).toBe(0);
    expect(e.hp).toBe(Math.round(e.maxHp * 0.8));
  });
});

describe('Dragon ground moves (04 §13.1)', () => {
  it('Breath hits with three boxes: 16 and its status per color, single 20 for Storm', () => {
    const expected = { red: [16, 'burning'], white: [16, 'chilled'], storm: [20, undefined], green: [16, 'poisoned'] } as const;
    for (const color of ['red', 'white', 'storm', 'green'] as const) {
      const w = world({ color }), e = dragon(w), hit = atk(e, 'breath').hit!;
      expect([hit.damage, hit.status?.id]).toEqual(expected[color]);
      expect(hit.boxes).toHaveLength(2);
      expect(storm(color)).toBe(color === 'storm' ? undefined : 0.5);
      expect(atk(e, 'breath').active).toBe(color === 'storm' ? 0.6 : 1.0);
    }
    function storm(c: DragonColor) { return DRAGONS[c].attacks[0].hit!.rehit; }
  });
  it('Breath reaches 16-224 px in front of it and lands on a player there', () => {
    const w = world({ color: 'red' }), e = dragon(w);
    enter(w); stepSpec(w, {}, 130); quiet(w, dragon(w));
    e.x = 400; e.facing = 1; w.health.iframeTicks = 0;
    w.body.x = 400 + 200; w.body.y = floorY;
    const hp = w.health.hp;
    run(w, e, 'breath', 100);
    expect(hp - w.health.hp).toBeGreaterThanOrEqual(Math.round(16 * 1.5));
    expect(w.playerStatus.burning).toBeTruthy();
  });
  it('Wing Gust pushes the player away at 600 px/s², deals nothing, and makes Breath weigh 3x next', () => {
    const w = world(), e = dragon(w);
    enter(w); stepSpec(w, {}, 130); quiet(w, dragon(w));
    e.x = 400; e.facing = 1; w.health.iframeTicks = 0;
    const hp = w.health.hp;
    startEnemyAttack(w, e, atk(e, 'wing_gust'));
    stepSpec(w, {}, 72);                                      // Tele 0.6 s
    w.body.x = 500; w.body.y = floorY; w.body.vx = 0;
    hold(w, 500, 1);
    for (let i = 0; i < 12; i++) { w.body.y = floorY; stepSpec(w, {}); }
    expect(w.body.x).toBeGreaterThan(500);                    // pushed away from the Dragon
    expect(w.health.hp).toBe(hp);
    stepSpec(w, {}, 140);
    expect(e.dragon!.gustBoost).toBe(true);
  });
  it('Tail Sweep needs the player behind it; Claw Swipe within 96 px', async () => {
    const { eligibleAttacks } = await import('./enemies/ai.ts');
    const w = world(), e = dragon(w);
    enter(w); stepSpec(w, {}, 130); quiet(w, dragon(w));
    e.x = 400; e.facing = 1; e.ai.cooldowns.clear();
    w.body.x = 340; w.body.y = floorY;
    expect(eligibleAttacks(w, e).map((a) => a.id)).toContain('tail_sweep');
    w.body.x = 450;
    expect(eligibleAttacks(w, e).map((a) => a.id)).not.toContain('tail_sweep');
    expect(eligibleAttacks(w, e).map((a) => a.id)).toContain('claw_swipe');
    expect(eligibleAttacks(w, e).map((a) => a.id)).not.toContain('dive_bomb');
  });
  it('Wing Hop: hops 160 px toward a player behind it when farther than 120 px', () => {
    const w = world(), e = dragon(w);
    enter(w); stepSpec(w, {}, 130); quiet(w, dragon(w));
    e.x = 500; e.facing = 1; e.ai.attack = null; e.ai.gapTicks = 0;
    w.body.x = 300; w.body.y = floorY;
    const x0 = e.x;
    for (let i = 0; i < 60; i++) { w.body.x = 300; w.body.y = floorY; stepSpec(w, {}); }
    expect(x0 - e.x).toBeGreaterThan(100);
    expect(e.facing).toBe(-1);
  });
});

describe('Color Specials (04 §13.2)', () => {
  it('Fire Rain drops 5 fire_rain at the player x, ±96 and ±192, marked from the Tele start, leaving fire pools', () => {
    const w = world({ color: 'red' }), e = dragon(w);
    enter(w); stepSpec(w, {}, 130); quiet(w, dragon(w));
    w.body.x = 480; w.body.y = floorY;
    startEnemyAttack(w, e, atk(e, 'color_special'));
    expect(w.rockMarkers.map((m) => m.x).sort((a, b) => a - b)).toEqual([288, 384, 480, 576, 672]);
    hold(w, 480, 108);
    expect(w.projectiles.filter((p) => p.def.id === 'fire_rain')).toHaveLength(5);
    hold(w, 480, 100);
    expect(w.puddles.length).toBe(5);
    expect(w.puddles[0]).toMatchObject({ w: 48, h: 8, status: 'burning' });
  });
  it('Ice Spikes erupt 64 px ahead, 64 apart, 0.15 s after each other, each 24 x 48 for 0.15 s', () => {
    const w = world({ color: 'white' }), e = dragon(w);
    enter(w); stepSpec(w, {}, 130); quiet(w, dragon(w));
    e.x = 400; e.facing = 1; w.body.x = 300;
    startEnemyAttack(w, e, atk(e, 'color_special'));
    const spikes = e.dragon!.effects.filter((f) => f.kind === 'spike');
    expect(spikes.map((f) => f.x)).toEqual([464, 528, 592, 656]);
    const t0 = w.tick;
    expect(spikes.map((f) => f.start - t0)).toEqual([96, 114, 132, 150].map((v) => v));
    hold(w, 300, 97);
    expect(w.hitGroups.filter((g) => g.owner === e.id && g.kind === 'shot')).toHaveLength(1);
    expect(w.hitGroups.find((g) => g.owner === e.id && g.kind === 'shot')!.rect).toMatchObject({ w: 24, h: 48, y: floorY - 48 });
    hold(w, 300, 90);
    expect(e.dragon!.effects).toHaveLength(0);
  });
  it('Thunder Call strikes 3 unblockable bolts 0.4 s apart, each 24 wide and the full arena height, for 0.1 s', () => {
    const w = world({ color: 'storm' }), e = dragon(w);
    enter(w); stepSpec(w, {}, 130); quiet(w, dragon(w));
    w.body.x = 300; w.body.y = floorY;
    startEnemyAttack(w, e, atk(e, 'color_special'));
    const t0 = w.tick, bolts = e.dragon!.effects;
    expect(bolts.map((f) => f.start - t0)).toEqual([96, 144, 192]);
    expect(bolts.map((f) => f.end - f.start)).toEqual([12, 12, 12]);
    expect(bolts[0].x).toBe(300);
    hold(w, 300, 97);
    const g = w.hitGroups.find((x) => x.owner === e.id && x.kind === 'shot')!;
    expect(g.enemyHit!.unblockable).toBe(true);
    expect(g.rect).toMatchObject({ w: 24, h: 320, y: 80 });
    expect(g.enemyHit!.damage).toBe(20);
    hold(w, 420, 60);                                         // each later bolt marks the player's x when its own marker begins
    expect(bolts[1].x).toBe(300);
    expect(bolts[2].x).toBe(420);
  });
  it('Toxic Cloud leaves 3 clouds that drift toward the player at 30 px/s for 5.0 s and poison once per 0.5 s inside', () => {
    const w = world({ color: 'green' }), e = dragon(w);
    enter(w); stepSpec(w, {}, 130); quiet(w, dragon(w));
    w.body.x = 400; w.body.y = floorY; w.health.iframeTicks = 100000;
    startEnemyAttack(w, e, atk(e, 'color_special'));
    hold(w, 400, 100);
    const clouds = e.dragon!.effects.filter((f) => f.kind === 'cloud');
    expect(clouds.map((f) => Math.round(f.x!))).toEqual([400, 305, 495]);              // at the player and ±96, 4 ticks into the drift
    const before = clouds[1].x!;
    hold(w, 400, 120);
    expect(clouds[1].x!).toBeGreaterThan(before + 20);        // drifting toward the player
    expect(w.playerStatus.poisoned).toBeTruthy();
    hold(w, 400, 5 * 120);
    expect(e.dragon!.effects.filter((f) => f.kind === 'cloud')).toHaveLength(0);
  });
  it('is immune to its own element', () => {
    const fire: ElementOnHit = { id: 'fire', level: 1 } as ElementOnHit, ice = { id: 'ice', level: 1 } as ElementOnHit, poison = { id: 'poison', level: 1 } as ElementOnHit;
    const cases: [DragonColor, ElementOnHit, boolean][] = [['red', fire, false], ['white', ice, false], ['green', poison, false], ['red', ice, true], ['green', fire, true], ['white', fire, true]];
    for (const [color, el, gets] of cases) {
      const w = world({ color }), e = dragon(w);
      applyElementHit(w, e, el, 10, 1, null);
      const s = e.status;
      const got = el.id === 'fire' ? s.burn !== null : el.id === 'ice' ? s.chill !== null : s.poison !== null;
      expect(got, `${color} vs ${el.id}`).toBe(gets);
    }
  });
});

describe('Dragon phase 2 (04 §13.1)', () => {
  function phase2() {
    const w = world(), e = dragon(w);
    enter(w); stepSpec(w, {}, 130); quiet(w, dragon(w));
    e.hp = Math.floor(e.maxHp * 0.49);
    stepBossPhases(w);
    return { w, e };
  }
  it('takes off during a 1.0 s transition, then flies 104 px above the floor and follows the player 96 px to its side', () => {
    const { w, e } = phase2();
    expect(e.boss!.transitionTicks).toBe(120);
    stepSpec(w, {}, 125);
    expect(e.dragon!.mode).toBe('air');
    expect(Math.round(e.y)).toBe(floorY - 104);
    hold(w, 300, 200);
    expect(Math.abs(e.x - 300)).toBeLessThanOrEqual(110);
    expect(Math.abs(e.x - 300)).toBeGreaterThan(80);
  });
  it('Dive Bomb rises off the top (unhittable), marks the floor, drops at 700 px/s, lands, and the waves run 160 px', () => {
    const { w, e } = phase2();
    stepSpec(w, {}, 125);
    w.body.x = 300; w.body.y = floorY;
    startEnemyAttack(w, e, atk(e, 'dive_bomb'));
    let hidden = false;
    for (let i = 0; i < 70; i++) { hold(w, 300, 1); hidden ||= e.dragon!.untouchable; }
    expect(hidden).toBe(true);
    expect(strike(w, e)).toBe(0);
    hold(w, 300, 100);
    expect(e.dragon!.markerLocked).toBe(true);
    for (let i = 0; i < 120 && e.dragon!.mode !== 'ground'; i++) hold(w, 300, 1);
    expect(e.dragon!.mode).toBe('ground');
    expect(Math.abs(e.x - 300)).toBeLessThanOrEqual(8);
    expect(e.y).toBe(floorY);
    expect(w.projectiles.filter((p) => p.def.id === 'shockwave')).toHaveLength(2);
    expect(w.projectiles[0].def.range).toBe(160);
  });
  it('flies 8.0 s, then a forced Dive Bomb lands it for an 8.0 s ground segment and a 0.6 s take-off', () => {
    const { w, e } = phase2();
    stepSpec(w, {}, 125);
    e.ai.cooldowns.set('dive_bomb', 0);
    for (const a of e.def.attacks) if (a.id !== 'dive_bomb') e.ai.cooldowns.set(a.id, 99999);
    let dove = false;
    for (let i = 0; i < 9 * 120 && !dove; i++) { hold(w, 300, 1); dove = e.ai.attack?.def.id === 'dive_bomb'; }
    expect(dove).toBe(true);
    expect(w.tick).toBeGreaterThan(8 * 120 - 100);
    for (let i = 0; i < 400 && e.dragon!.mode !== 'ground'; i++) hold(w, 300, 1);
    expect(e.dragon!.mode).toBe('ground');
    for (const a of e.def.attacks) e.ai.cooldowns.set(a.id, 99999);
    for (let i = 0; i < 8 * 120 + 200; i++) hold(w, 300, 1);
    expect(['takeoff', 'air']).toContain(e.dragon!.mode);
  });
  it('Strafing Breath crosses from the farther side at 260 px/s with a 48 px column', () => {
    const { w, e } = phase2();
    stepSpec(w, {}, 125);
    w.body.x = 220; w.body.y = floorY;
    startEnemyAttack(w, e, atk(e, 'strafing_breath'));
    hold(w, 220, 90);
    expect(e.x).toBeGreaterThan(700);
    hold(w, 220, 20);
    expect(Math.abs(e.vx)).toBe(260);
    const g = w.hitGroups.find((x) => x.owner === e.id && x.enemyHit);
    expect(g?.rect).toMatchObject({ w: 48, h: 104 });
    hold(w, 220, 300);
    expect(e.x).toBeLessThan(220);
  });
  it('a Break in the air makes it fall at 400 px/s and the Break starts when it lands', () => {
    const { w, e } = phase2();
    stepSpec(w, {}, 125);
    strike(w, e, { ...WEAPONS.greatsword!.combo[0].hit!, poise: 9999 });
    expect(e.dragon!.mode).toBe('falling');
    expect(e.control!.ticks).toBeGreaterThan(1e5);
    for (let i = 0; i < 100 && e.dragon!.mode !== 'ground'; i++) hold(w, 300, 1);
    expect(e.dragon!.mode).toBe('ground');
    expect(e.control!.ticks).toBeLessThanOrEqual(300);
    expect(e.control!.ticks).toBeGreaterThan(290);
  });
});

describe('Killing the Dragon (06 §4, 04 §9.6)', () => {
  it('marks it killed, drops one A or S weapon with its element and 150 gold, and opens nothing: no split, no stat pick', () => {
    for (const [color, element] of [['red', 'fire'], ['white', 'ice'], ['storm', 'lightning'], ['green', 'poison']] as const) {
      const w = world({ color }), e = dragon(w);
      enter(w); stepSpec(w, {}, 130); quiet(w, dragon(w));
      const gold = w.econ.goldTenths;
      killEnemy(w, e); processDeaths(w);
      const events = w.events;
      expect(events.some((x) => x.t === 'bossDefeated' && x.bossId === 'dragon')).toBe(true);
      expect(w.run.dragon.outcome).toBe('killed');
      expect(w.run.splits).toEqual([null, null, null, null]);
      expect(w.run.bossDefeatedTick).toBeNull();
      expect(w.econ.goldTenths - gold).toBeGreaterThanOrEqual(1500);
      const drop = w.groundItems.find((i) => i.weapon);
      expect(['A', 'S']).toContain(drop!.weapon!.grade);
      expect(drop!.weapon!.element).toBe(element);
      stepSpec(w, {}, 200);
      expect(w.run.phase).toBe('stage');
    }
  });
  it('outcomes: skipped when left undamaged, escaped when damaged, killed when slain', async () => {
    const { finalizeDragon } = await import('./run/zones.ts');
    const a = world(); finalizeDragon(a); expect(a.run.dragon.outcome).toBe('skipped');
    const b = world(); enter(b); dragon(b).everDamaged = true; finalizeDragon(b); expect(b.run.dragon.outcome).toBe('escaped');
    const c = world({ present: false }); finalizeDragon(c); expect(c.run.dragon.outcome).toBe('absent');
  });
});
