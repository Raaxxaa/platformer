import { describe, it, expect } from 'vitest';
import { gridFromRects } from '../level/build.ts';
import { createPlayerBody } from './body.ts';
import { defaultModifiers } from './modifiers.ts';
import { specToInput } from '../sim/playerSim.ts';
import { boardCart, createMinecart, landOnMinecart, stepMinecarts } from './minecart.ts';
import { startForcedMove } from './forcedMove.ts';
import { teleport } from './teleport.ts';
import { setDead, stepPlayer } from './movement.ts';
function fixture() {
  const g = gridFromRects(200, 50, [{ x0: 0, y0: 20, x1: 199, y1: 49, kind: 'solid' }]);
  const b = createPlayerBody(200, 320), c = createMinecart(1, 200, 320, 1), m = defaultModifiers();
  const step = (now = {}, prev = {}, stops: {
    x: number;
    y: number;
    w: number;
    h: number;
  }[] = []) => stepMinecarts([c], b, specToInput(prev, now), g, m, stops);
  return { g, b, c, m, step };
}
describe('minecart (01 §13.6)', () => {
  it('standing still at the cart top never auto-boards without a falling crossing', () => {
    const {b,c}=fixture();b.y=c.y-c.h;b.vy=0;b.grounded=false;b.state='air';
    expect(landOnMinecart([c],b,{x:b.x,y:b.y})).toBe(false);expect(b.cartId).toBe(null);
  });
  it('an airborne exit does not cut the player double jump on its launch tick', () => {
    const f = fixture(); boardCart(f.c, f.b); f.c.y = 200;
    const input = specToInput({}, { jump: true }); input.jump.held = false;
    const out = stepMinecarts([f.c], f.b, input, f.g, f.m, []);
    stepPlayer(f.b, out.input, f.g, f.m, { slotUsable: [true, true] });
    expect(f.b.vy).toBe(-333.5);
    stepPlayer(f.b, specToInput({ jump: true }, {}), f.g, f.m, { slotUsable: [true, true] });
    expect(f.b.vy).toBeCloseTo(-137.575);
  });
  it('waits, boards and reaches260 regardless of steering, water, attack caps or Time Slow', () => {
    const { b, c, m, step } = fixture();
    for (let n = 0; n < 100; n++)
      step();
    expect(c.x).toBe(200);
    expect(boardCart(c, b)).toBe(true);
    m.actionMoveMult = .25;
    b.inWater = true;
    for (let n = 0; n < 60; n++)
      step({ moveX: -1 });
    expect(c.vx).toBe(260);
    expect(b.x).toBe(c.x);
    expect(b.y).toBe(c.y - 8);
    expect(b.h).toBe(20);
  });
  it('ground/coyote jump stays aboard, cuts on release; airborne jump exits as a double jump', () => {
    const { b, c, step } = fixture();
    boardCart(c, b);
    expect(step({ jump: true }).events).toContain('cartJump');
    expect(c.vy).toBeLessThan(-400);
    expect(b.state).toBe('minecart');
    step({}, { jump: true });
    expect(c.vy).toBeGreaterThan(-200);
    const vx = c.vx;
    const out = step({ jump: true });
    expect(out.events).toContain('doubleJump');
    expect(b.state).toBe('air');
    expect(b.vy).toBe(-346);
    expect(b.vx).toBeGreaterThanOrEqual(vx);
    expect(b.doubleJumpAvailable).toBe(false);
  });
  it('air jump needs double jump, dash uses direction and air availability', () => {
    const { b, c, step } = fixture();
    boardCart(c, b);
    c.grounded = false;
    c.y = 200;
    b.doubleJumpAvailable = false;
    step({ jump: true });
    expect(b.state).toBe('minecart');
    b.airDashAvailable = false;
    step({ dash: true });
    expect(b.state).toBe('minecart');
    b.airDashAvailable = true;
    expect(step({ dash: true, moveX: -1 }).events).toContain('dashStart');
    expect(b.vx).toBe(-400);
    expect(b.airDashAvailable).toBe(false);
    expect(c.started).toBe(true);
  });
  it('stop crashes throw260/-300, refreshes, and respawns after exactly240ticks waiting', () => {
    const { b, c, step } = fixture();
    boardCart(c, b);
    for (let n = 0; n < 60; n++)
      step();
    const out = step({}, {}, [{ x: c.x - 20, y: 290, w: 40, h: 40 }]);
    expect(out.events).toContain('cartCrash');
    expect(b.state).toBe('air');
    expect(b.vx).toBe(260);
    expect(b.vy).toBe(-300);
    expect(b.h).toBe(28);
    for (let n = 0; n < 239; n++)
      step();
    expect(c.active).toBe(false);
    step();
    expect(c.active).toBe(true);
    expect(c.x).toBe(200);
    expect(c.started).toBe(false);
  });
  it('wall crashes while an empty rolling cart still moves and respawns', () => {
    const { g, b, c, step } = fixture();
    boardCart(c, b);
    step();
    b.cartId = null;
    b.state = 'air';
    const x = c.x;
    step();
    expect(c.x).toBeGreaterThanOrEqual(x);
    c.x = g.widthPx - c.w / 2;
    c.vx = 260;
    expect(step().events).toContain('cartCrash');
    expect(c.active).toBe(false);
  });
  it('falling feet board the top, and forced moves, teleports and death detach immediately', () => {
    const { g, b, c, m } = fixture();
    b.y = 308;
    b.vy = 200;
    b.grounded = false;
    b.state = 'air';
    const out = stepMinecarts([c], b, specToInput({}, {}), g, m, [], { x: 200, y: 303 });
    expect(out.events).toContain('cartBoard');
    expect(b.state).toBe('minecart');
    startForcedMove(b, { vx: 100, vy: 0, durationS: 1, gravity: false, endOnWall: true, endVelocity: 'zero', cancelByJump: true, cancelByDash: true }, 'test');
    expect(b.cartId).toBe(null);
    boardCart(c, b);
    teleport(b, g, 32, 0, { x: 0, y: 0, w: g.widthPx, h: g.heightPx });
    expect(b.cartId).toBe(null);
    expect(b.state).toBe('air');
    boardCart(c, b);
    setDead(b);
    expect(b.cartId).toBe(null);
    expect(b.state).toBe('dead');
  });
  it('lands on one-way floor and bonks ceiling without throwing rider', () => {
    const { b, c, m } = fixture();
    const g = gridFromRects(100, 30, [{ x0: 0, y0: 20, x1: 99, y1: 20, kind: 'oneway' }, { x0: 0, y0: 16, x1: 99, y1: 16, kind: 'solid' }]);
    c.y = 310;
    c.vy = 300;
    c.started = true;
    boardCart(c, b);
    for (let n = 0; n < 8; n++)
      stepMinecarts([c], b, specToInput({}, {}), g, m, []);
    expect(c.y).toBe(320);
    expect(c.grounded).toBe(true);
    c.vy = -420;
    c.grounded = false;
    for (let n = 0; n < 16; n++)
      stepMinecarts([c], b, specToInput({ jump: true }, { jump: true }), g, m, []);
    expect(c.vy).toBeGreaterThanOrEqual(0);
    expect(b.state).toBe('minecart');
  });
  it('buffers a refused dash until cooldown ends, and a cart jump is not cut on its press tick', () => {
    const { b, c, g, m } = fixture();
    boardCart(c, b);
    b.dashReadyPt = 6;
    let out = stepMinecarts([c], b, specToInput({}, { dash: true }), g, m, []);
    expect(out.events).not.toContain('dashStart');
    for (let n = 0; n < 5; n++)
      out = stepMinecarts([c], b, specToInput({ dash: true }, { dash: true }), g, m, []);
    expect(out.events).toContain('dashStart');
    expect(b.state).toBe('dash');
    const f = fixture();
    boardCart(f.c, f.b);
    const input = specToInput({}, { jump: true });
    input.jump.held = false;
    stepMinecarts([f.c], f.b, input, f.g, f.m, []);
    expect(f.c.vy).toBe(-407.5);
  });
  it('cart coyote jump works at12ticks but leaves with double jump at13', () => {
    for (const elapsed of [11, 12]) {
      const f = fixture();
      boardCart(f.c, f.b);
      f.c.y = 200;
      f.c.grounded = false;
      f.c.tick = elapsed;
      f.c.lastGroundTick = 0;
      f.c.coyoteValid = true;
      const out = f.step({ jump: true });
      expect(out.events).toContain(elapsed === 11 ? 'cartJump' : 'doubleJump');
      expect(f.b.state).toBe(elapsed === 11 ? 'minecart' : 'air');
    }
  });
  it('rider water state and splash edges update without slowing the cart', () => {
    const { b, c, m } = fixture();
    const g = gridFromRects(200, 50, [{ x0: 0, y0: 20, x1: 199, y1: 49, kind: 'solid' }, { x0: 14, y0: 17, x1: 60, y1: 19, kind: 'water' }]);
    boardCart(c, b);
    const events: string[] = [];
    for (let n = 0; n < 60; n++)
      events.push(...stepMinecarts([c], b, specToInput({}, {}), g, m, []).events);
    expect(events.filter((e) => e === 'enterWater')).toHaveLength(1);
    expect(b.inWater).toBe(true);
    expect(c.vx).toBe(260);
  });
});
