import { describe, expect, it } from 'vitest';
import { newAbility, newWeapon } from './runtime.ts';
import type { AbilityLevel } from './types.ts';
import type { GameWorld, WorldEvent } from '../sim/gameWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { bladeGroups } from './list/blade_flurry.ts';

function setup(level: AbilityLevel, withFoe = false): GameWorld {
  const w = arenaWorld({ enemies: withFoe ? [{ enemy: 'training_dummy', x: 216, y: 320, facing: -1 }] : [] });
  w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [newAbility('blade_flurry', level), null] });
  if (withFoe) { const e = w.enemies[0]; e.hp = e.maxHp = 100000; e.dormant = false; }
  stepSpec(w, {}, 2);
  return w;
}
const run = (w: GameWorld, spec: InputSpec, n = 1) => stepSpec(w, spec, n);

describe('Blade Flurry (03 §8.3)', () => {
  it('Lv1: the blades are gone after 480 ticks', () => {
    const w = setup(1);
    run(w, { ability1: true }, 1);
    expect(bladeGroups(w).length).toBe(2);
    run(w, {}, 470);
    expect(bladeGroups(w).length).toBe(2);
    run(w, {}, 12);
    expect(bladeGroups(w).length).toBe(0);
    expect(w.hitGroups.filter((g) => g.ability === 'blade_flurry').length).toBe(0);
  });
  it('Lv1: a touching enemy takes 5 per hit, about 10 hits in 4 s (2 blades, one hit per pass, at most 6 each)', () => {
    const w = setup(1, true);
    const amounts: number[] = [];
    const ev: WorldEvent[] = [...run(w, { ability1: true }, 1), ...run(w, {}, 485)];
    for (const e of ev) if (e.t === 'hit' && e.target === w.enemies[0].id) amounts.push(e.amount);
    expect(amounts.every((a) => a === 5)).toBe(true);
    expect(amounts.length).toBeGreaterThanOrEqual(8);
    expect(amounts.length).toBeLessThanOrEqual(12)   // 2 blades x (480 / 90 + 1);
  });
  it('Lv5 makes 4 blade groups, evenly spaced 28 px from the body center', () => {
    const w = setup(5);
    run(w, { ability1: true }, 1);
    const g = bladeGroups(w);
    expect(g.length).toBe(4);
    const cy = w.body.y - w.body.h / 2;
    for (const b of g) expect(Math.hypot(b.rect.x + 5 - w.body.x, b.rect.y + 5 - cy)).toBeCloseTo(28, 3);
  });
  it('recasting replaces the blades', () => {
    const w = setup(1);
    run(w, { ability1: true }, 1);
    w.abilities.slots[0]!.charges = 1;
    run(w, { ability1: true }, 1);
    run(w, {}, 2);
    expect(bladeGroups(w).length).toBe(2);
  });
});
