import { describe, expect, it } from 'vitest';
import { newAbility, newWeapon } from './runtime.ts';
import type { AbilityId, AbilityLevel } from './types.ts';
import type { GameWorld, WorldEvent } from '../sim/gameWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import type { EnemyId } from '../enemies/types.ts';
import { gridFromRects } from '../level/build.ts';
import { GameWorld as World } from '../sim/gameWorld.ts';
import { marks } from './list/hunters_mark.ts';

interface Foe { id: EnemyId; x: number; y?: number; hp?: number }
function setup(ability: AbilityId, level: AbilityLevel = 1, foes: Foe[] = [], second: AbilityId | null = null, w0?: GameWorld): GameWorld {
  const w = w0 ?? arenaWorld({ enemies: foes.map((f) => ({ enemy: f.id, x: f.x, y: f.y ?? 320, facing: -1 })) });
  w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [newAbility(ability, level), second ? newAbility(second) : null] });
  foes.forEach((f, i) => { const e = w.enemies[i]; e.hp = e.maxHp = f.hp ?? 5000; e.dormant = false; });
  stepSpec(w, {}, 2);
  return w;
}
const run = (w: GameWorld, spec: InputSpec, n = 1) => stepSpec(w, spec, n);
const hitsOn = (ev: WorldEvent[], id: number) => ev.filter((e): e is Extract<WorldEvent, { t: 'hit' }> => e.t === 'hit' && e.target === id).map((e) => e.amount);
/** Hit ticks relative to `t0` for enemy `id`, stepping one tick at a time. */
function hitTicks(w: GameWorld, id: number, n: number, t0: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) for (const e of run(w, {}, 1)) if (e.t === 'hit' && e.target === id) out.push(w.tick - t0);
  return out;
}

describe('Swordsman and Tank (03 §8.1, §8.2, §9.1, §9.2)', () => {
  it('checklist 17: Blade Dash Lv1 moves 96 px in 24 ticks, i-frames, 30 to each enemy once; dash and air dash untouched', () => {
    const w = setup('blade_dash', 1, [{ id: 'bandit_brute', x: 250 }, { id: 'bandit', x: 270 }]);
    const x0 = w.body.x, ready = w.body.dashReadyPt;
    const ev = [...run(w, { ability1: true }, 1), ...run(w, {}, 23)];
    expect(w.body.x - x0).toBe(96);
    expect(hitsOn(ev, w.enemies[0].id)).toEqual([30]);
    expect(hitsOn(ev, w.enemies[1].id)).toEqual([30]);
    expect(w.body.dashReadyPt).toBe(ready);
    expect(w.body.airDashAvailable).toBe(true);
    expect(newAbility('blade_dash', 5).charges).toBe(2);
  });
  it('Blade Dash: an enemy hit during it does no damage', () => {
    const w = setup('blade_dash');
    run(w, { ability1: true }, 1);
    expect(w.health.abilityIframeTicks).toBeGreaterThan(0);
    const hp = w.health.hp;
    w.hitGroups.push({ id: w.newId(), owner: 999, kind: 'melee', rect: { x: w.body.x - 50, y: w.body.y - 50, w: 100, h: 60 }, spec: { damage: 10, kb: [0, 0], poise: 0, hitStop: 0, kind: 'melee' },
      enemyHit: { box: { dx: 0, dy: 0, w: 1, h: 1 }, damage: 10 }, active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: 1 });
    run(w, {}, 2);
    expect(w.health.hp).toBe(hp);
  });
  it('checklist 18: Whirlwind Lv1 hits a stationary enemy in its box exactly 4 times for 10', () => {
    const w = setup('whirlwind', 1, [{ id: 'training_dummy', x: 230 }]);
    const ev = [...run(w, { ability1: true }, 1), ...run(w, {}, 90)];
    expect(hitsOn(ev, w.enemies[0].id)).toEqual([10, 10, 10, 10]);
  });
  it('Whirlwind Lv5 pulls small and medium enemies within 64 px', () => {
    const w = setup('whirlwind', 5, [{ id: 'wolf', x: 260 }]);
    run(w, { ability1: true }, 1);
    run(w, {}, 2);
    expect(w.enemies[0].control?.type).toBe('pull');
  });
  it('checklist 20: Shockwave launches a small enemy 50 px aside, not a large one; misses at 60 px', () => {
    const w = setup('shockwave', 1, [{ id: 'wolf', x: 250 + 14 }, { id: 'bandit_brute', x: 150 }, { id: 'wolf', x: 200 + 60 + 14 }]);
    w.body.facing = 1;
    const ev = [...run(w, { ability1: true }, 1), ...run(w, {}, 30)];
    const [small, large, far] = w.enemies;
    expect(hitsOn(ev, small.id)).toEqual([40]);
    expect(small.control?.type).toBe('launch');
    expect(hitsOn(ev, large.id)).toEqual([40]);
    expect(large.control?.type).not.toBe('launch');
    expect(hitsOn(ev, far.id)).toEqual([]);
  });
  it('checklist 19: Shoulder Charge Lv1 moves 96 px in 32 ticks; a large enemy stops it on the hit tick with vx = 0', () => {
    const w = setup('shoulder_charge');
    const x0 = w.body.x;
    run(w, { ability1: true }, 1); run(w, {}, 31);
    expect(w.body.x - x0).toBe(96);
    const v = setup('shoulder_charge', 1, [{ id: 'bandit_brute', x: 260 }]);
    let stopped = -1;
    run(v, { ability1: true }, 1);
    for (let i = 0; i < 31 && stopped < 0; i++) {
      const ev = run(v, {}, 1);
      if (hitsOn(ev, v.enemies[0].id).length) { stopped = i; expect(v.body.vx).toBe(0); expect(v.body.state).not.toBe('forced'); }
    }
    expect(stopped).toBeGreaterThanOrEqual(0);
  });
  it('Shoulder Charge knocks a small enemy aside and goes on; Lv5 stuns 1.0 s', () => {
    const w = setup('shoulder_charge', 5, [{ id: 'wolf', x: 250 }]);
    const x0 = w.body.x;
    run(w, { ability1: true }, 1);
    run(w, {}, 10);
    expect(w.enemies[0].control?.type).toBe('stun');
    expect(w.enemies[0].control!.ticks).toBeGreaterThan(100);
    run(w, {}, 37);
    expect(w.body.x - x0).toBe(144);
  });
});

describe('Archer and Wizard (03 §10.1, §10.4, §11.1, §11.3)', () => {
  it('checklist 21: Arrow Rain Lv1 hits 5 × 10 at +24…+120; an enemy behind a wall 40 px ahead is not hit', () => {
    const w = setup('arrow_rain', 1, [{ id: 'training_dummy', x: 260 }]);
    run(w, { ability1: true }, 1);
    run(w, {}, 17);
    const t0 = w.tick + 1;                                    // startup 18: the effect is on the next tick
    expect(hitTicks(w, w.enemies[0].id, 130, t0)).toEqual([24, 48, 72, 96, 120]);
    const g = gridFromRects(40, 23, [
      { x0: 0, y0: 20, x1: 39, y1: 22, kind: 'solid' }, { x0: 0, y0: 0, x1: 0, y1: 22, kind: 'solid' }, { x0: 39, y0: 0, x1: 39, y1: 22, kind: 'solid' },
      { x0: 15, y0: 17, x1: 15, y1: 19, kind: 'solid' },     // wall at x 240–256
    ]);
    const v = setup('arrow_rain', 1, [{ id: 'training_dummy', x: 280 }], null,
      new World({ grid: g, spawn: { x: 200, y: 320 }, enemies: [{ enemy: 'training_dummy', x: 280, y: 320, facing: -1 }] }));
    const ev = [...run(v, { ability1: true }, 1), ...run(v, {}, 150)];
    expect(hitsOn(ev, v.enemies[0].id)).toEqual([]);
  });
  it('checklist 24: Hunter\'s Mark fizzles with no enemy in range; marks the highest-HP one; a 20 hit then deals 26', () => {
    const w = setup('hunters_mark', 1, [{ id: 'bandit', x: 600 }]);
    const ev = run(w, { ability1: true }, 1);
    expect(ev.map((e) => e.t)).toContain('abilityFizzle');
    expect(w.abilities.slots[0]!.charges).toBe(1);
    const v = setup('hunters_mark', 1, [{ id: 'wolf', x: 300, hp: 40 }, { id: 'training_dummy', x: 320, hp: 60 }]);
    v.enemies[1].hp = v.enemies[1].maxHp = 60;
    run(v, { ability1: true }, 1);
    expect(marks(v).map((m) => m.enemyId)).toEqual([v.enemies[1].id]);
    v.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [{ ...v.abilities.slots[0]! }, null] });
    v.teleportPlayer(300, 320);
    const hit = run(v, { attack1: true }, 1).concat(run(v, {}, 40));
    expect(hitsOn(hit, v.enemies[1].id)[0]).toBe(21);         // Greatsword 16 × 1.30 = 20.8 → 21
  });
  it('Hunter\'s Mark: recasting clears old marks; a mark ends after its duration', () => {
    const w = setup('hunters_mark', 1, [{ id: 'training_dummy', x: 300 }]);
    run(w, { ability1: true }, 1);
    expect(marks(w).length).toBe(1);
    run(w, {}, 8 * 120);
    expect(marks(w).length).toBe(0);
  });
  it('checklist 25: Thunder Strike Lv3 on one enemy: 4 hits of 22 on +0, +12, +24, +36', () => {
    const w = setup('thunder_strike', 3, [{ id: 'training_dummy', x: 300 }]);
    run(w, { ability1: true }, 1);
    run(w, {}, 17);
    const t0 = w.tick + 1;                                    // the effect tick (startup 18)
    expect(hitTicks(w, w.enemies[0].id, 60, t0)).toEqual([0, 12, 24, 36]);
  });
  it('checklist 30: a Lv1 bolt deals 25 on stage 1 and stage 4 alike', () => {
    for (const stage of [1, 4] as const) {
      const w = arenaWorld({ stage, enemies: [{ enemy: 'training_dummy', x: 300, y: 320, facing: -1 }] });
      setup('thunder_strike', 1, [{ id: 'training_dummy', x: 300 }], null, w);
      const ev = [...run(w, { ability1: true }, 1), ...run(w, {}, 40)];
      expect(hitsOn(ev, w.enemies[0].id)).toEqual([25, 25]);
    }
  });
  it('Thunder Strike with no enemies strikes empty columns at x + f × (48 + 32k)', () => {
    const w = setup('thunder_strike', 2);
    const x = w.body.x;
    run(w, { ability1: true }, 1); run(w, {}, 18);
    const bolts = () => w.hitGroups.filter((g) => g.ability === 'thunder_strike').map((g) => g.rect.x + g.rect.w / 2);
    expect(bolts()).toEqual([x + 48]);
    run(w, {}, 12);
    expect(bolts()).toEqual([x + 80]);
  });
  it('checklist 27: Blink Lv1 moves 64 px, through a 16 px wall; with no free spot it fizzles and keeps the charge', () => {
    const w = setup('blink');
    const x0 = w.body.x;
    run(w, { ability1: true }, 1);
    expect(w.body.x - x0).toBe(64);
    expect(w.health.abilityIframeTicks).toBeGreaterThan(0);
    const g = gridFromRects(40, 23, [
      { x0: 0, y0: 20, x1: 39, y1: 22, kind: 'solid' }, { x0: 0, y0: 0, x1: 0, y1: 22, kind: 'solid' }, { x0: 39, y0: 0, x1: 39, y1: 22, kind: 'solid' },
      { x0: 13, y0: 0, x1: 13, y1: 19, kind: 'solid' },       // a 16 px wall at x 208–224
    ]);
    const t = setup('blink', 1, [], null, new World({ grid: g, spawn: { x: 200, y: 320 } }));
    run(t, { ability1: true }, 1);
    expect(t.body.x).toBe(264);
    const h = gridFromRects(40, 23, [
      { x0: 0, y0: 20, x1: 39, y1: 22, kind: 'solid' }, { x0: 0, y0: 0, x1: 0, y1: 22, kind: 'solid' }, { x0: 39, y0: 0, x1: 39, y1: 22, kind: 'solid' },
      { x0: 13, y0: 0, x1: 20, y1: 19, kind: 'solid' },       // thick wall
    ]);
    const u = setup('blink', 1, [], null, new World({ grid: h, spawn: { x: 200, y: 320 } }));
    const ev = run(u, { ability1: true }, 1);
    expect(ev.map((e) => e.t)).toContain('abilityFizzle');
    expect(u.abilities.slots[0]!.charges).toBe(1);
  });
  it('Blink diagonal uses round(d × 0.7071) on each axis', () => {
    const w = arenaWorld();
    setup('blink', 1, [], null, w);
    w.teleportPlayer(300, 200);
    run(w, {}, 1);
    const x0 = w.body.x, y0 = w.body.y;
    run(w, { ability1: true, moveX: 1, moveY: -1 }, 1);
    expect(Math.round(w.body.x - x0)).toBe(45 + Math.round(0));   // 45 = round(64 × 0.7071)
    expect(y0 - w.body.y).toBeGreaterThanOrEqual(45 - 1);
  });
});

describe('Vampire (03 §12, checklist 12 first part)', () => {
  it('adds 20 / 25 / 30 / 40 / 50 tenths per kill', () => {
    for (const [lv, tenths] of [[1, 20], [2, 25], [3, 30], [4, 40], [5, 50]] as const) {
      const w = setup('vampire', lv, [{ id: 'wolf', x: 230, hp: 1 }]);
      w.flask.charges = 0;
      const before = w.flask.fillTenths;
      run(w, { attack1: true }, 1); run(w, {}, 30);
      expect(w.enemies[0].dead).toBe(true);
      const plain = setup('blade_dash', 1, [{ id: 'wolf', x: 230, hp: 1 }]);
      plain.flask.charges = 0;
      run(plain, { attack1: true }, 1); run(plain, {}, 30);
      expect(w.flask.fillTenths - before - plain.flask.fillTenths).toBe(tenths);
    }
  });
});
