import { describe, expect, it } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { bladeAngle, bladeCenter, createBlades, stepBlades } from './swingingBlades.ts';

const obj = (props = {}) => [{ id: 1, type: 'swinging_blade', x: 200, y: 100, w: 0, h: 0, props }];

describe('Swinging blades (06 §10)', () => {
  it('hangs straight down at t = 0 and is at +60 degrees at t = 0.5 s with the defaults', () => {
    const [b] = createBlades(obj()).blades;
    expect(bladeAngle(b, 0)).toBeCloseTo(0, 9);
    expect(bladeAngle(b, 0.5) * 180 / Math.PI).toBeCloseTo(60, 6);
    expect(bladeCenter(b, 0)).toEqual({ x: 200, y: 164 });
    const c = bladeCenter(b, 0.5);
    expect(c.x).toBeCloseTo(200 + 64 * Math.sin(Math.PI / 3), 6);
    expect(c.y).toBeCloseTo(100 + 64 * Math.cos(Math.PI / 3), 6);
  });
  it('honors length, amplitude, period and phase', () => {
    const [b] = createBlades(obj({ length: 32, amplitude: 30, period: 4, phase: 0.25 })).blades;
    expect(bladeAngle(b, 0) * 180 / Math.PI).toBeCloseTo(30, 6);
    expect(bladeCenter(b, 0).y).toBeCloseTo(100 + 32 * Math.cos(Math.PI / 6), 6);
  });
  it('hits a player box it overlaps, once per 0.5 s, and stops while the world is frozen', () => {
    const s = createBlades(obj());
    const box = { x: 192, y: 150, w: 16, h: 28 };
    expect(stepBlades(s, box, 0)).toBeNull();
    expect(stepBlades(s, box, 1)).not.toBeNull();
    s.blades[0].rehit = 60;
    expect(stepBlades(s, box, 1)).toBeNull();
  });
  it('deals 20 unscaled damage in a level, even during a dash, and respects hurt i-frames', () => {
    const w = arenaWorld({ stage: 4 });
    w.blades = createBlades(obj());
    w.blades.blades[0].px = w.body.x; w.blades.blades[0].py = w.body.y - 64 - 14;
    const hp = w.health.hp;
    stepSpec(w, {});
    expect(hp - w.health.hp).toBe(20);
    const after = w.health.hp;
    stepSpec(w, {}, 30);
    expect(w.health.hp).toBe(after);                     // hurt i-frames and the 0.5 s rehit
  });
});
