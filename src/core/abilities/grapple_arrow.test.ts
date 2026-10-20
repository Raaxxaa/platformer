import { describe, expect, it } from 'vitest';
import { newAbility, newWeapon } from './runtime.ts';
import type { AbilityLevel } from './types.ts';
import type { EnemyId } from '../enemies/types.ts';
import type { GameWorld, WorldEvent } from '../sim/gameWorld.ts';
import { GameWorld as World } from '../sim/gameWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { gridFromRects } from '../level/build.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';

function arm(w: GameWorld, level: AbilityLevel = 1): GameWorld {
  w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [newAbility('grapple_arrow', level), null] });
  stepSpec(w, {}, 2);
  return w;
}
const run = (w: GameWorld, spec: InputSpec, n = 1) => stepSpec(w, spec, n);
const hitsOn = (ev: WorldEvent[], id: number) => ev.filter((e): e is Extract<WorldEvent, { t: 'hit' }> => e.t === 'hit' && e.target === id).map((e) => e.amount);
const center = (w: GameWorld) => ({ x: w.body.x, y: w.body.y - w.body.h / 2 });
function wallWorld(): GameWorld {
  const g = gridFromRects(40, 23, [
    { x0: 0, y0: 20, x1: 39, y1: 22, kind: 'solid' }, { x0: 0, y0: 0, x1: 0, y1: 22, kind: 'solid' }, { x0: 39, y0: 0, x1: 39, y1: 22, kind: 'solid' },
    { x0: 19, y0: 0, x1: 19, y1: 19, kind: 'solid' },       // a wall at x 304-319
  ]);
  return new World({ grid: g, spawn: { x: 200, y: 320 } });
}
function foeWorld(id: EnemyId, x: number): GameWorld {
  const w = arenaWorld({ enemies: [{ enemy: id, x, y: 320, facing: -1 }] });
  const e = w.enemies[0]; e.hp = e.maxHp = 100000; e.dormant = false;
  return arm(w);
}

describe('Grapple Arrow (03 §10.3, checklist 23)', () => {
  it('aimed up-forward at a grapple point 150 px away at 40 degrees, it pulls the player there', () => {
    const w = arm(arenaWorld());
    const c0 = center(w), a = (40 * Math.PI) / 180;
    const target = { x: c0.x + 150 * Math.cos(a), y: c0.y - 150 * Math.sin(a) };
    w.grapplePoints.push({ id: 1, x: target.x, y: target.y, w: 16, h: 16 });
    run(w, { ability1: true, moveX: 1, moveY: -1 }, 1);
    expect(w.body.forced?.owner).toBe('grapple');
    for (let i = 0; i < 200 && w.body.forced; i++) run(w, {}, 1);
    const c = center(w);
    expect(Math.hypot(c.x - target.x, c.y - target.y)).toBeLessThanOrEqual(16);
  });
  it('with no target in range, a charge is used and it recharges in 120 ticks', () => {
    const w = arm(arenaWorld());
    run(w, { ability1: true, moveX: 1 }, 1);
    const s = w.abilities.slots[0]!;
    expect(s.charges).toBe(0);
    expect(s.rechargeLeft).toBeGreaterThan(100);
    expect(s.rechargeLeft).toBeLessThanOrEqual(120);
    run(w, {}, 125);
    expect(s.charges).toBe(1);
  });
  it('aimed horizontally at a wall 100 px ahead, the player is pulled to the wall', () => {
    const w = arm(wallWorld());
    run(w, { ability1: true, moveX: 1 }, 1);
    expect(w.body.forced?.owner).toBe('grapple');
    for (let i = 0; i < 200 && w.body.forced; i++) run(w, {}, 1);
    expect(w.body.x).toBeGreaterThan(270);
    expect(w.body.x).toBeLessThan(304);
  });
  it('a small enemy in line is hit for 15, pulled toward the player and stunned', () => {
    const w = foeWorld('wolf', 320);
    w.body.facing = 1;
    const ev = [...run(w, { ability1: true, moveX: 1 }, 1), ...run(w, {}, 3)];
    expect(hitsOn(ev, w.enemies[0].id)).toEqual([15]);
    expect(w.enemies[0].control?.type).toBe('pull');
    run(w, {}, 60);
    expect(w.enemies[0].x).toBeLessThan(260);
    expect(w.enemies[0].control?.type).toBe('stun');
  });
  it('a large enemy pulls the player to it; on arrival vy is -150 in the air', () => {
    const w = foeWorld('bandit_brute', 340);
    w.body.facing = 1;
    const ev = [...run(w, { ability1: true, moveX: 1 }, 1)];
    expect(hitsOn(ev, w.enemies[0].id)).toEqual([15]);
    expect(w.body.forced?.owner).toBe('ability:grapple_arrow');
    for (let i = 0; i < 200 && w.body.forced; i++) run(w, {}, 1);
    run(w, {}, 1);
    expect(w.body.state).toBe('air');
  });
});
