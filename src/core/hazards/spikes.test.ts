import { describe, it, expect } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { gridFromRects } from '../level/build.ts';
import { stepSpec } from '../testkit/combatWorld.ts';

/** Floor at row 20 with a spikeUp strip at tiles 14–16 (x 224–272). */
function spikeWorld(): GameWorld {
  const grid = gridFromRects(40, 23, [
    { x0: 0, y0: 20, x1: 39, y1: 22, kind: 'solid' },
    { x0: 14, y0: 19, x1: 16, y1: 19, kind: 'spikeUp' },
    { x0: 0, y0: 0, x1: 0, y1: 22, kind: 'solid' }, { x0: 39, y0: 0, x1: 39, y1: 22, kind: 'solid' },
  ]);
  return new GameWorld({ grid, spawn: { x: 160, y: 320 } });
}

describe('spikes (01 §13.4, tests 23 and 36)', () => {
  it('touching spikeUp deals 20, pops vy −330 and starts the hurt i-frames', () => {
    const w = spikeWorld();
    const ev = stepSpec(w, { moveX: 1 }, 60);
    expect(w.health.hp).toBe(80);
    expect(ev.some((e) => e.t === 'move' && e.e === 'spikeHit')).toBe(true);
    expect(w.health.iframeTicks).toBeGreaterThan(0);
    expect(w.body.state).not.toBe('hurt');                          // no knockback or hitstun
  });
  it('the pop sets vy to −330 on the hit tick', () => {
    const w = spikeWorld();
    for (let i = 0; i < 60 && w.health.hp === 100; i++) stepSpec(w, { moveX: 1 });
    expect(w.body.vy).toBeCloseTo(-330 + 0, 0);
  });
  it('a dash does not protect; hurt i-frames do', () => {
    const w = spikeWorld();
    w.body.x = 200;
    stepSpec(w, { moveX: 1, dash: true }, 20);
    expect(w.health.hp).toBe(80);
    const w2 = spikeWorld();
    w2.health.iframeTicks = 1000;
    stepSpec(w2, { moveX: 1 }, 60);
    expect(w2.health.hp).toBe(100);
  });
  it('a spike death has cause spikes', () => {
    const w = spikeWorld();
    w.health.hp = 20;
    const ev = stepSpec(w, { moveX: 1 }, 60);
    expect(ev).toContainEqual({ t: 'playerDied', cause: 'spikes' });
  });
});
