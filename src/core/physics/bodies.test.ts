import { describe, it, expect } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import type { SolidBody } from './bodies.ts';

const door = (x: number, active: boolean): SolidBody => ({ id: 'd1', x, y: 272, w: 16, h: 48, oneWay: false, surface: 'normal', grabbable: false, noTeleport: true, active });

describe('solid bodies (01 §13, §13.9)', () => {
  it('an active door blocks walking; an inactive one does not', () => {
    const w = arenaWorld();
    w.addBody(door(240, true));
    stepSpec(w, { moveX: 1 }, 120);
    expect(w.body.x).toBe(240 - w.body.w / 2);
    const w2 = arenaWorld();
    w2.addBody(door(240, false));
    stepSpec(w2, { moveX: 1 }, 120);
    expect(w2.body.x).toBeGreaterThan(260);
  });
  it('activating a door on top of the player pushes the player out', () => {
    const w = arenaWorld();
    w.addBody(door(192, false));          // covers x 192–208; the player stands at x 200
    w.setBodyActive('d1', true);
    const b = w.body;
    expect(b.x + b.w / 2 <= 192 || b.x - b.w / 2 >= 208 || b.y <= 272).toBe(true);
  });
  it('enemies are blocked by doors too', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'bandit', x: 400, y: 320, facing: -1 }] });
    const e = w.enemies[0];
    e.dormant = false; e.aware = true; e.ai.state = 'engage';
    w.health.iframeTicks = 100000;
    w.addBody(door(320, true));
    stepSpec(w, {}, 300);
    expect(e.x - e.def.hurtbox.w / 2).toBeGreaterThanOrEqual(336);
  });
});
