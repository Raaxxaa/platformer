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
});
