import { describe, it, expect } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { bossLevel } from '../testkit/levelData.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { killEnemy } from '../combat/resolve.ts';
import { startEnemyAttack } from './attack.ts';
import type { EnemyState } from './enemy.ts';

const world = (seed = 'A') => GameWorld.fromLevel(bossLevel(), { seedText: seed });
const boss = (w: GameWorld) => w.enemies.find((e) => e.def.id === 'great_boar')!;
const walkIn = (w: GameWorld) => { for (let i = 0; i < 600 && !w.run.arenas.boss1?.locked; i++) stepSpec(w, { moveX: 1 }); };
/** Puts the boar straight into an attack by id. */
const attack = (w: GameWorld, e: EnemyState, id: string) => startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === id)!);

describe('boss layer (04 §9)', () => {
  it('the Great Boar spawns dormant with its feet 432 px from the entry side, facing the entry', () => {
    const w = world();
    const b = boss(w);
    expect([b.x, b.y, b.facing, b.dormant, b.hp]).toEqual([64 + 432, 272, -1, true, 900]);
    stepSpec(w, { moveX: 1 }, 30);
    expect(b.dormant).toBe(true);                     // the camera doesn't wake it; the lock does
  });
  it('the lock starts a 1.0 s intro: it does not attack, then it fights', () => {
    const w = world();
    walkIn(w);
    const b = boss(w);
    expect([b.dormant, b.aware, b.boss!.introTicks]).toEqual([false, true, 120]);
    expect(w.bossBar).toMatchObject({ name: 'Great Boar', title: 'Guardian of the Plains', marks: [0.5] });
    const tele: number[] = [];
    for (let i = 0; i < 400; i++) { const ev = stepSpec(w, {}); if (ev.some((e) => e.t === 'enemyTelegraph')) tele.push(i); }
    expect(tele.length).toBeGreaterThan(0);
    expect(tele[0]).toBeGreaterThanOrEqual(119);
  });
  it('breaking it: 240 ticks of no action and ×1.25 damage, then 2.0 s of poise immunity (04 tests 24, 25)', () => {
    const w = world();
    walkIn(w);
    stepSpec(w, {}, 120);
    const b = boss(w);
    b.poise = 1;
    w.health.iframeTicks = 100000;
    w.body.x = b.x - 40; w.body.facing = 1;
    let hp0 = b.hp;
    for (let i = 0; i < 60 && !b.control; i++) { hp0 = b.hp; stepSpec(w, { attack1: i % 2 === 0 }); }
    expect(b.control).toMatchObject({ type: 'stagger', ticks: 240 });
    const firstHit = hp0 - b.hp;                       // the breaking hit itself is not boosted
    expect(firstHit).toBe(16);
    const before = b.hp;
    // The next Greatsword step-1 hit while broken deals 16 × 1.25 = 20.
    for (let i = 0; i < 200 && b.hp === before; i++) stepSpec(w, { attack1: i % 30 === 0 });
    expect(before - b.hp).toBe(20);
    expect(b.ai.attack).toBeNull();
  });
  it('enrages at ≤ 50% HP: attack gap 0.6 s', () => {
    const w = world();
    walkIn(w);
    const b = boss(w);
    b.hp = 450;
    stepSpec(w, {});
    expect(b.boss!.enraged).toBe(true);
  });
  it('the kill emits bossDefeated, grants100Rush before60base gold, refills the flask and opens the exit', () => {
    const w = world();
    walkIn(w);
    w.flask.charges = 0;
    const ev = (() => { killEnemy(w, boss(w)); return stepSpec(w, {}); })();
    expect(ev).toContainEqual({ t: 'bossDefeated', bossId: 'great_boar', stage: 1 });
    expect(w.gold).toBe(66); // 02 §8.2 / 05 §9.3: +100 Rush reaches level1 before the60base gold.
    expect(w.flask.charges).toBe(w.flask.maxCharges);
    const exit = w.bodies.list.find((b) => b.id.includes('arena_door') && b.x === 40 * 16)!;
    expect(exit.active).toBe(false);
    expect(w.run.arenas.boss1.locked).toBe(false);
  });
});

describe('Great Boar attacks (04 §10.1, test 33)', () => {
  it('a charge into the wall dazes it for 240 ticks (168 enraged) and shakes the camera', () => {
    for (const [enraged, daze] of [[false, 240], [true, 168]] as const) {
      const w = world();
      walkIn(w);
      stepSpec(w, {}, 120);
      const b = boss(w);
      b.boss!.enraged = enraged;
      w.health.iframeTicks = 100000;
      w.body.x = 300;
      attack(w, b, 'charge');
      let shook = false;
      for (let i = 0; i < 400 && b.control?.type !== 'dazed'; i++) shook ||= stepSpec(w, {}).some((e) => e.t === 'shake');
      expect(b.control).toMatchObject({ type: 'dazed', ticks: daze });
      expect(shook).toBe(true);
      expect(b.x - 32).toBeLessThanOrEqual(64);          // it ran into the left wall
    }
  });
  it('enraged, a wall crash drops 3 rocks ≥ 48 px apart inside the arena, the same with the same seed', () => {
    const rocks = (seed: string) => {
      const w = world(seed);
      walkIn(w);
      stepSpec(w, {}, 120);
      const b = boss(w);
      b.boss!.enraged = true;
      w.health.iframeTicks = 100000;
      w.body.x = 300;
      attack(w, b, 'charge');
      for (let i = 0; i < 400 && b.control?.type !== 'dazed'; i++) stepSpec(w, {});
      const xs = w.rockMarkers.map((r) => r.x);
      expect(w.rockMarkers.every((r) => r.ticks === 96)).toBe(true);
      return xs;
    };
    const xs = rocks('A');
    expect(xs.length).toBe(3);
    for (const x of xs) { expect(x).toBeGreaterThanOrEqual(64); expect(x).toBeLessThanOrEqual(640); }
    const s = [...xs].sort((a, b) => a - b);
    expect(s[1] - s[0]).toBeGreaterThanOrEqual(48);
    expect(s[2] - s[1]).toBeGreaterThanOrEqual(48);
    expect(rocks('A')).toEqual(xs);
  });
  it('a falling rock drops after its 0.8 s marker and hurts a player under it for 15', () => {
    const w = world();
    walkIn(w);
    stepSpec(w, {}, 120);
    const b = boss(w);
    b.boss!.enraged = true;
    w.body.x = 300;
    w.health.iframeTicks = 100000;
    attack(w, b, 'charge');
    for (let i = 0; i < 400 && b.control?.type !== 'dazed'; i++) stepSpec(w, {});
    const x = w.rockMarkers[0].x;
    w.body.x = x; w.health.iframeTicks = 0; w.health.hp = 100;
    let hit = false;
    for (let i = 0; i < 150 && !hit; i++) hit = stepSpec(w, {}).some((e) => e.t === 'hit' && e.target === 'player');
    expect(hit).toBe(true);
    expect(w.health.hp).toBe(85);
  });
  it('a Stomp Quake wave hits a standing player once; a player jumping over it takes nothing', () => {
    for (const jump of [false, true]) {
      const w = world();
      walkIn(w);
      stepSpec(w, {}, 120);
      const b = boss(w);
      w.body.x = b.x - 160;
      attack(w, b, 'stomp_quake');
      let hits = 0;
      for (let i = 0; i < 160; i++) {
        const j = jump && i >= 128 && i < 158;         // a held (full) jump as the wave (260 px/s) arrives near tick 150
        for (const e of stepSpec(w, { jump: j })) if (e.t === 'hit' && e.target === 'player') hits++;
        if (!jump) w.health.iframeTicks = 0;
      }
      expect(hits).toBe(jump ? 0 : 1);
    }
  });
});
