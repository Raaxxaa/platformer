import { describe, it, expect } from 'vitest';
import { PlayerSim, specToInput, type InputSpec } from './playerSim.ts';
import { FixedStepper } from './fixedStep.ts';
import { MOVEMENT_TEST } from '../../data/levels/movementTest.ts';
import type { InputState } from '../input.ts';
import type { GameWorld } from './gameWorld.ts';

const TICKS = 10_000;

/** A 10,000-tick input recording from a fixed-seed LCG (directions, jump, dash, down + attack1). */
function recording(): InputState[] {
  let seed = 0xc0ffee;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const out: InputState[] = [];
  let prev: InputSpec = {};
  let spec: InputSpec = {};
  for (let t = 0; t < TICKS; t++) {
    if (t % 5 === 0) {
      const r = rand();
      const down = rand() < 0.2;
      spec = {
        moveX: r < 0.55 ? 1 : r < 0.75 ? 0 : -1,
        moveY: down ? 1 : rand() < 0.05 ? -1 : 0,
        jump: rand() < 0.25,
        dash: rand() < 0.15,
        attack1: down && rand() < 0.5,
      };
    }
    out.push(specToInput(prev, spec));
    prev = spec;
  }
  return out;
}

const snapshot = (sim: PlayerSim) => JSON.stringify({ body: sim.body, camera: sim.camera });

describe('determinism (checklist 30)', () => {
  it('the same recording gives identical body and camera on every tick', () => {
    const rec = recording();
    const a = new PlayerSim(MOVEMENT_TEST.grid, MOVEMENT_TEST.spawn);
    const b = new PlayerSim(MOVEMENT_TEST.grid, MOVEMENT_TEST.spawn);
    const states = new Set<string>();
    for (let t = 0; t < TICKS; t++) {
      const ea = a.step(rec[t]);
      const eb = b.step(rec[t]);
      expect(eb).toEqual(ea);
      const sa = snapshot(a);
      if (sa !== snapshot(b)) expect(snapshot(b)).toBe(sa);   // only build the diff on a mismatch
      states.add(a.body.state);
    }
    // the recording exercises most of the movement set
    for (const s of ['ground', 'air', 'dash', 'slide', 'wallSlide', 'diveWindup', 'diveFall', 'diveLand']) expect(states).toContain(s);
  });

  it('delivering the ticks through FixedStepper at 60 Hz and 144 Hz gives the same final state', () => {
    const rec = recording();
    const reference = new PlayerSim(MOVEMENT_TEST.grid, MOVEMENT_TEST.spawn);
    for (const input of rec) reference.step(input);

    for (const hz of [60, 144]) {
      const sim = new PlayerSim(MOVEMENT_TEST.grid, MOVEMENT_TEST.spawn);
      const stepper = new FixedStepper();
      let next = 0;
      while (next < TICKS) {
        const n = stepper.advance(1 / hz);
        for (let i = 0; i < n && next < TICKS; i++) sim.step(rec[next++]);
      }
      expect(snapshot(sim)).toBe(snapshot(reference));
    }
  });
});

describe('determinism with every M4 ability and weapon (M4 Task 16)', () => {
  it('two worlds given the same script stay identical on every tick', async () => {
    const { arenaWorld } = await import('../testkit/combatWorld.ts');
    const { newAbility, newWeapon } = await import('../abilities/runtime.ts');
    const { M4_ABILITIES } = await import('../../data/classes.ts');
    const { WEAPONS } = await import('../../data/weapons.ts');
    const weapons = Object.keys(WEAPONS) as (keyof typeof WEAPONS)[];
    const enemies = [
      { enemy: 'training_dummy' as const, x: 420, y: 320, facing: -1 as const },
      { enemy: 'wolf' as const, x: 560, y: 320, facing: -1 as const },
      { enemy: 'bandit' as const, x: 700, y: 320, facing: -1 as const },
    ];
    const worlds = [arenaWorld({ seed: 7, enemies }), arenaWorld({ seed: 7, enemies })];
    let seed = 0xbadc0de;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    let prev: InputSpec = {}, spec: InputSpec = {};
    const used = new Set<string>();
    const PER = 300;                                          // ticks per loadout
    const n = Math.max(M4_ABILITIES.length, weapons.length) * PER * 2;
    for (let t = 0; t < n; t++) {
      if (t % PER === 0) {
        // A new loadout: two abilities and two weapons, cycling so every one gets used.
        const k = t / PER;
        const ab = [M4_ABILITIES[k % M4_ABILITIES.length], M4_ABILITIES[(k + 3) % M4_ABILITIES.length]];
        const wp = [weapons[k % weapons.length], weapons[(k + 5) % weapons.length]];
        for (const w of worlds) {
          w.setLoadout({ weapons: [newWeapon(wp[0]), newWeapon(wp[1])], abilities: [newAbility(ab[0]), newAbility(ab[1])] });
          w.health.hp = w.health.maxHp;
        }
      }
      if (t % 6 === 0) {
        const r = rand();
        spec = {
          moveX: r < 0.45 ? 1 : r < 0.75 ? -1 : 0, moveY: rand() < 0.1 ? -1 : rand() < 0.1 ? 1 : 0,
          jump: rand() < 0.15, dash: rand() < 0.08, attack1: rand() < 0.35, attack2: rand() < 0.25,
          ability1: rand() < 0.08, ability2: rand() < 0.08,
        };
      }
      const input = specToInput(prev, spec);
      prev = spec;
      for (const w of worlds) w.step(input);
      const evA = JSON.stringify(worlds[0].events), evB = JSON.stringify(worlds[1].events);
      if (evA !== evB) expect(evB).toBe(evA);
      for (const e of worlds[0].events) if (e.t === 'abilityUsed') used.add(e.id);
      const cur = worlds[0].combat.current;
      if (cur) used.add(worlds[0].combat.slots[cur.slot]?.weaponId ?? '');
      if (t % 60 === 0) {
        const snap = (w: GameWorld) => JSON.stringify({ body: w.body, hp: w.health.hp, enemies: w.enemies.map((e) => [e.id, e.x, e.y, e.hp]), abilities: w.abilities.slots, rush: w.rush.value });
        expect(snap(worlds[1])).toBe(snap(worlds[0]));
      }
    }
    for (const id of M4_ABILITIES) if (id !== 'vampire') expect(used, id).toContain(id);
    for (const id of weapons) expect(used, id).toContain(id);
  });
});
