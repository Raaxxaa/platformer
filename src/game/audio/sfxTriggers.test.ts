import { describe, expect, it } from 'vitest';
import type { GameWorld, WorldEvent } from '../../core/sim/gameWorld.ts';
import { arenaWorld, stepSpec } from '../../core/testkit/combatWorld.ts';
import type { InputSpec } from '../../core/sim/playerSim.ts';
import { SfxWatch } from './sfxTriggers.ts';

/** Steps one tick at a time like the scene, collecting sound ids per render. */
function run(w: GameWorld, watch: SfxWatch, spec: InputSpec, n: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const ev: WorldEvent[] = stepSpec(w, spec, 1);
    ids.push(...watch.collect(w, ev.map((e) => ({ tick: w.tick, e }))).map((r) => r.id));
  }
  return ids;
}

describe('sound triggers (08 §13.3)', () => {
  it('jump, land and a Greatsword swing', () => {
    const w = arenaWorld(), watch = new SfxWatch();
    run(w, watch, {}, 5);
    const jump = run(w, watch, { jump: true }, 1);
    expect(jump).toContain('jump');
    const air = run(w, watch, {}, 120);
    expect(air).toContain('land');
    const swing = [...run(w, watch, { attack1: true }, 1), ...run(w, watch, {}, 90)];
    expect(swing.filter((s) => s === 'swing_heavy').length).toBe(1);
  });
  it('a wolf becoming aware growls once, from its position', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'wolf', x: 320, y: 320, facing: -1 }] }), watch = new SfxWatch();
    const ids = run(w, watch, {}, 240);
    expect(ids.filter((s) => s === 'vo_wolf').length).toBe(1);
  });
  it('a Training Yard station check plays ui_confirm', () => {
    const w = arenaWorld(), watch = new SfxWatch();
    const ids = watch.collect(w, [{ tick: 1, e: { t: 'stationDone', id: 1 } }]).map((r) => r.id);
    expect(ids).toContain('ui_confirm');
  });
  it('class events: abilities, link, fizzle, not ready, class changes, a wall broken, a lightning chain', () => {
    const w = arenaWorld(), watch = new SfxWatch();
    const ids = (e: object) => watch.collect(w, [{ tick: 1, e: e as never }]).map((r) => r.id);
    expect(ids({ t: 'abilityUsed', slot: 0, id: 'blade_dash', linked: false })).toContain('ab_blade_dash');
    expect(ids({ t: 'abilityLinked', slot: 1 })).toContain('ab_link');
    expect(ids({ t: 'abilityFizzle', slot: 0 })).toContain('ab_fizzle');
    expect(ids({ t: 'abilityNotReady', slot: 0 })).toContain('ab_not_ready');
    expect(ids({ t: 'classChanged', displayName: 'Tank', bond: null, hybrid: null })).toContain('class_change');
    expect(ids({ t: 'classDiscovered', id: 'thief' })).toContain('class_discovered');
    expect(ids({ t: 'wallBroken' })).toContain('wall_break');
    expect(ids({ t: 'hit', target: 3, amount: 4, crit: false, heavy: false, chainFrom: 2 })).toContain('zap');
  });
  it('a bow shot and a Storm Hammer throw out and back', async () => {
    const { newWeapon } = await import('../../core/abilities/runtime.ts');
    const w = arenaWorld(), watch = new SfxWatch();
    w.setLoadout({ weapons: [newWeapon('bow'), newWeapon('storm_hammer')], abilities: [null, null] });
    run(w, watch, {}, 3);
    expect([...run(w, watch, { attack1: true }, 1), ...run(w, watch, {}, 30)]).toContain('shot_bow');
    run(w, watch, {}, 60);
    const t = [...run(w, watch, { moveY: -1, attack2: true }, 1), ...run(w, watch, {}, 400)];
    expect(t).toEqual(expect.arrayContaining(['hammer_throw', 'hammer_return', 'hammer_catch']));
  });
});
