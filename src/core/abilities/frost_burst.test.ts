import { describe, expect, it } from 'vitest';
import { newAbility, newWeapon } from './runtime.ts';
import type { AbilityLevel } from './types.ts';
import type { GameWorld, WorldEvent } from '../sim/gameWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import type { EnemyId } from '../enemies/types.ts';

interface Foe { id: EnemyId; x: number; y?: number; hp?: number }
function setup(level: AbilityLevel, foes: Foe[]): GameWorld {
  const w = arenaWorld({ enemies: foes.map((f) => ({ enemy: f.id, x: f.x, y: f.y ?? 320, facing: -1 })) });
  w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [newAbility('frost_burst', level), null] });
  foes.forEach((f, i) => { const e = w.enemies[i]; e.hp = e.maxHp = f.hp ?? 5000; e.dormant = false; });
  stepSpec(w, {}, 2);
  return w;
}
const run = (w: GameWorld, spec: InputSpec, n = 1) => stepSpec(w, spec, n);
const hitsOn = (ev: WorldEvent[], id: number) => ev.filter((e): e is Extract<WorldEvent, { t: 'hit' }> => e.t === 'hit' && e.target === id).map((e) => e.amount);
/** Casts and runs through the effect tick (startup 12 ticks). */
function cast(w: GameWorld): WorldEvent[] {
  return [...run(w, { ability1: true }, 1), ...run(w, {}, 13)];
}

describe('Frost Burst (03 §11.2, checklist 26)', () => {
  it('Lv1 hits an enemy 40 px away for 20 and freezes it 180 ticks (level 1)', () => {
    const w = setup(1, [{ id: 'training_dummy', x: 200 + 40 }]);
    const ev = cast(w);
    expect(hitsOn(ev, w.enemies[0].id)).toEqual([20]);
    const f = w.enemies[0].status.frozen!;
    expect(f.level).toBe(1);
    expect(f.left).toBeGreaterThan(170);
    expect(f.left).toBeLessThanOrEqual(180);
  });
  it('an elite is frozen for 90 ticks', () => {
    const w = setup(1, [{ id: 'bandit_brute', x: 240 }]);
    cast(w);
    const f = w.enemies[0].status.frozen!;
    expect(f.left).toBeGreaterThan(80);
    expect(f.left).toBeLessThanOrEqual(90);
  });
  it('an enemy 80 px away is not hit at Lv1', () => {
    const w = setup(1, [{ id: 'training_dummy', x: 280 }]);
    const ev = cast(w);
    expect(hitsOn(ev, w.enemies[0].id)).toEqual([]);
    expect(w.enemies[0].status.frozen).toBeNull();
  });
  it('a boss is not frozen; it is chilled instead', () => {
    const w = setup(1, [{ id: 'great_boar', x: 240 }]);
    cast(w);
    expect(w.enemies[0].status.frozen).toBeNull();
    expect(w.enemies[0].status.chill).not.toBeNull();
  });
  it('Lv5 stores freeze level 3', () => {
    const w = setup(5, [{ id: 'training_dummy', x: 240 }]);
    cast(w);
    expect(w.enemies[0].status.frozen!.level).toBe(3);
  });
});
