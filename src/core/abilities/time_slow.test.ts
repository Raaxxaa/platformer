import { describe, expect, it } from 'vitest';
import { newAbility, newWeapon } from './runtime.ts';
import type { AbilityLevel } from './types.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { enemyActs } from '../combat/status.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { timeSlow } from './list/time_slow.ts';

function setup(level: AbilityLevel = 1, withWolf = false): GameWorld {
  const w = arenaWorld({ enemies: withWolf ? [{ enemy: 'wolf', x: 370, y: 320, facing: -1 }] : [] });
  w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [newAbility('time_slow', level), null] });
  if (withWolf) { const e = w.enemies[0]; e.hp = e.maxHp = 100000; e.dormant = false; }
  stepSpec(w, {}, 2);
  return w;
}
const run = (w: GameWorld, spec: InputSpec, n = 1) => stepSpec(w, spec, n);

describe('Time Slow (03 §11.4, checklist 29)', () => {
  it('an enemy acts on 42 of 120 ticks at x0.35, and every tick at x1', () => {
    const w = setup(1, true);
    const e = w.enemies[0];
    let slow = 0, normal = 0;
    for (let i = 0; i < 120; i++) { if (enemyActs(e, 0.35)) slow += 1; }
    e.status.timeAcc = 0;
    for (let i = 0; i < 120; i++) { if (enemyActs(e)) normal += 1; }
    expect(slow).toBeGreaterThanOrEqual(41);
    expect(slow).toBeLessThanOrEqual(43);
    expect(normal).toBe(120);
  });
  it('a chasing enemy covers about 35% of the distance while slowed; the run timer is not slowed', () => {
    const dist = (slowed: boolean) => {
      const w = setup(1, true);
      run(w, {}, 80);                                          // let it notice the player
      if (slowed) run(w, { ability1: true }, 1); else run(w, {}, 1);
      const x0 = w.enemies[0].x, t0 = w.run.runTicks;
      run(w, {}, 40);
      expect(w.run.runTicks - t0).toBe(40);
      return x0 - w.enemies[0].x;
    };
    const free = dist(false), slow = dist(true);
    expect(free).toBeGreaterThan(40);
    expect(slow / free).toBeGreaterThan(0.28);
    expect(slow / free).toBeLessThan(0.42);
  });
  it('Lv1 lasts 360 player ticks, then worldTimeScale is back to 1', () => {
    const w = setup();
    run(w, { ability1: true }, 1);
    expect(w.worldTimeScale).toBe(0.35);
    run(w, {}, 350);
    expect(w.worldTimeScale).toBe(0.35);
    run(w, {}, 15);
    expect(w.worldTimeScale).toBe(1);
    expect(timeSlow(w)).toBeUndefined();
  });
  it('recasting restarts the duration and does not stack', () => {
    const w = setup();
    run(w, { ability1: true }, 1);
    run(w, {}, 200);
    w.abilities.slots[0]!.charges = 1;
    run(w, { ability1: true }, 1);
    expect(w.abilityEntities.filter((e) => e.kind === 'time_slow').length).toBe(1);
    expect(w.worldTimeScale).toBe(0.35);
    expect(timeSlow(w)!.left).toBeGreaterThan(350);
  });
});
