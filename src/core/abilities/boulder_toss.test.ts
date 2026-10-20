import { describe, expect, it } from 'vitest';
import { newAbility, newWeapon } from './runtime.ts';
import type { AbilityLevel } from './types.ts';
import type { GameWorld, WorldEvent } from '../sim/gameWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { lobs } from './list/boulder_toss.ts';

function setup(level: AbilityLevel, foeX?: number): GameWorld {
  const w = arenaWorld({ enemies: foeX === undefined ? [] : [{ enemy: 'training_dummy', x: foeX, y: 320, facing: -1 }] });
  w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [newAbility('boulder_toss', level), null] });
  if (foeX !== undefined) { const e = w.enemies[0]; e.hp = e.maxHp = 100000; e.dormant = false; }
  stepSpec(w, {}, 2);
  w.body.facing = 1;
  return w;
}
const run = (w: GameWorld, spec: InputSpec, n = 1) => stepSpec(w, spec, n);
const hitsOn = (ev: WorldEvent[], id: number) => ev.filter((e): e is Extract<WorldEvent, { t: 'hit' }> => e.t === 'hit' && e.target === id).map((e) => e.amount);

describe('Boulder Toss (03 §9.4)', () => {
  it('on flat ground the boulder lands about 220 px ahead and breaks', () => {
    const w = setup(1);
    const x0 = w.body.x;
    run(w, { ability1: true }, 1);
    let last = 0;
    for (let i = 0; i < 120 * 3; i++) {
      run(w, {}, 1);
      const b = lobs(w, 'boulder')[0];
      if (b) last = b.x - x0; else if (last) break;
    }
    expect(lobs(w, 'boulder').length).toBe(0);
    expect(last).toBeGreaterThanOrEqual(200);
    expect(last).toBeLessThanOrEqual(240);
  });
  it('Lv1 hits an enemy 170 px ahead, on the way down (the arc is above a dummy at 100 px) once for 45 and is gone', () => {
    const w = setup(1, 370);
    const ev = [...run(w, { ability1: true }, 1), ...run(w, {}, 100)];
    expect(hitsOn(ev, w.enemies[0].id)).toEqual([45]);
    expect(lobs(w, 'boulder').length).toBe(0);
    expect(lobs(w, 'boulder_shard').length).toBe(0);
  });
  it('Lv5 hitting an enemy makes 4 shards that never hit that enemy', () => {
    const w = setup(5, 370);
    const ev: WorldEvent[] = [...run(w, { ability1: true }, 1)];
    let seen = 0;
    for (let i = 0; i < 100; i++) { ev.push(...run(w, {}, 1)); seen = Math.max(seen, lobs(w, 'boulder_shard').length); }
    expect(seen).toBe(4);
    expect(hitsOn(ev, w.enemies[0].id)).toEqual([120]);
  });
  it('Lv5 landing on the ground shatters into 4 shards; Lv1 makes none', () => {
    const w = setup(5);
    run(w, { ability1: true }, 1);
    let seen = 0;
    for (let i = 0; i < 150; i++) { run(w, {}, 1); seen = Math.max(seen, lobs(w, 'boulder_shard').length); }
    expect(seen).toBe(4);
    const v = setup(1);
    run(v, { ability1: true }, 1);
    for (let i = 0; i < 150; i++) { run(v, {}, 1); expect(lobs(v, 'boulder_shard').length).toBe(0); }
  });
});
