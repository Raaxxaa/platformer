import { describe, expect, it } from 'vitest';
import { newAbility, newWeapon } from './runtime.ts';
import type { AbilityLevel } from './types.ts';
import type { GameWorld, WorldEvent } from '../sim/gameWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { turrets } from './list/turret.ts';

function setup(level: AbilityLevel, foeX?: number): GameWorld {
  const w = arenaWorld({ enemies: foeX === undefined ? [] : [{ enemy: 'training_dummy', x: foeX, y: 320, facing: -1 }] });
  w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [newAbility('turret', level), null] });
  if (foeX !== undefined) { const e = w.enemies[0]; e.hp = e.maxHp = 100000; e.dormant = false; }
  stepSpec(w, {}, 2);
  w.body.facing = 1;
  return w;
}
const run = (w: GameWorld, spec: InputSpec, n = 1) => stepSpec(w, spec, n);
const hitsOn = (ev: WorldEvent[], id: number) => ev.filter((e): e is Extract<WorldEvent, { t: 'hit' }> => e.t === 'hit' && e.target === id).map((e) => e.amount);

describe('Turret (03 §10.2, checklist 22)', () => {
  it('Lv1 with a stationary enemy 150 px away: exactly 8 bolts hit it in the 8 s life, each for 12', () => {
    const w = setup(1, 200 + 150);
    const ev: WorldEvent[] = [...run(w, { ability1: true }, 1)];
    for (let i = 0; i < 120 * 9; i++) ev.push(...run(w, {}, 1));
    expect(hitsOn(ev, w.enemies[0].id)).toEqual([12, 12, 12, 12, 12, 12, 12, 12]);
    expect(turrets(w).length).toBe(0);                       // gone after 8 s
  });
  it('Lv5 places 2 turrets; more placements leave 2 and remove the oldest', () => {
    const w = setup(5);
    run(w, { ability1: true }, 1); run(w, {}, 15);
    const first = turrets(w).map((t) => t.id);
    expect(first.length).toBe(2);
    w.abilities.slots[0]!.charges = 1;
    run(w, { ability1: true }, 1); run(w, {}, 15);
    w.abilities.slots[0]!.charges = 1;
    run(w, { ability1: true }, 1); run(w, {}, 15);
    const now = turrets(w).map((t) => t.id);
    expect(now.length).toBe(2);
    expect(now.some((id) => first.includes(id))).toBe(false);
  });
  it('with no enemy within 256 px, no bolts are fired', () => {
    const w = setup(1, 200 + 300);
    const ev: WorldEvent[] = [...run(w, { ability1: true }, 1)];
    for (let i = 0; i < 120 * 4; i++) ev.push(...run(w, {}, 1));
    expect(hitsOn(ev, w.enemies[0].id)).toEqual([]);
    expect(w.abilityEntities.filter((e) => e.kind === 'turret_bolt').length).toBe(0);
  });
});
