import { describe, expect, it } from 'vitest';
import { gridFromRects } from '../level/build.ts';
import { Bodies } from '../physics/bodies.ts';
import { PlayerSim } from '../sim/playerSim.ts';
const water = () => new PlayerSim(gridFromRects(160, 100, [
  { x0: 0, y0: 20, x1: 159, y1: 99, kind: 'solid' },
  { x0: 0, y0: 0, x1: 100, y1: 19, kind: 'water' },
]), { x: 200, y: 320 });
const ice = () => new PlayerSim(gridFromRects(160, 30, [{ x0: 0, y0: 20, x1: 159, y1: 29, kind: 'ice' }]), { x: 200, y: 320 });
describe('water and ice (01 §13.2–3)', () => {
  it('a real dive lands on water entry, keeps its12tick impact lag, and can water-jump out', () => {
    const make=()=>new PlayerSim(gridFromRects(80,30,[{x0:0,y0:20,x1:79,y1:29,kind:'solid'},{x0:0,y0:18,x1:79,y1:19,kind:'water'}]),{x:200,y:270});
    for(const jump of [false,true]){
      const s=make();s.stepSpec({attack1:true,moveY:1});let events:string[]=[];
      for(let n=0;n<20 && s.body.state!=='diveLand';n++)events.push(...s.stepSpec({}));
      expect(events).toContain('diveLand');expect(events).toContain('enterWater');expect(s.body.y).toBeLessThan(320);const y=s.body.y;
      if(jump){expect(s.stepSpec({jump:true})).toContain('jump');expect(s.body.vy).toBe(-327.5);}
      else {s.stepSpec({},12);expect(s.body.state).toBe('diveLand');expect(s.body.y).toBe(y);s.stepSpec({});expect(s.body.state).toBe('air');}
    }
  });
  it('hurt bodies keep the water fall cap while the dead body follows its normal death fall', () => {
    const s=water();s.body.y=30;s.body.state='hurt';s.body.grounded=false;s.body.hurtTicks=100;s.body.vy=160;
    s.stepSpec({},5);expect(s.body.vy).toBe(160);
    s.body.state='dead';s.stepSpec({},5);expect(s.body.vy).toBe(222.5);
  });
  it('water emits only on entry/exit and caps run at85 with a38–39px jump', () => {
    const s = water();
    expect(s.stepSpec({ moveX: 1 }, 30)).toEqual(['enterWater']);
    expect(s.body.vx).toBe(85);
    const floor = s.body.y;
    let peak = floor;
    s.stepSpec({ jump: true });
    for (let n = 0; n < 60; n++) {
      s.stepSpec({ jump: true });
      peak = Math.min(peak, s.body.y);
    }
    expect(floor - peak).toBeGreaterThanOrEqual(38);
    expect(floor - peak).toBeLessThanOrEqual(39);
    s.body.x = 1700;
    expect(s.stepSpec({})).toContain('exitWater');
    expect(s.stepSpec({})).not.toContain('exitWater');
  });
  it('water dash moves60px and naturally returns to water max; falls cap160', () => {
    const s = water();
    const x = s.body.x;
    s.stepSpec({ dash: true }, 18);
    expect(s.body.x - x).toBe(60);
    s.stepSpec({ moveX: 1 });
    expect(s.body.vx).toBe(85);
    s.body.y = 30;
    s.body.state = 'air';
    s.body.grounded = false;
    s.body.vy = 0;
    s.stepSpec({ moveY: 1 }, 20);
    expect(s.body.vy).toBe(160);
  });
  it('ice uses450accel/200decel/900turn and carries slide speed with1px/s overspeed decay', () => {
    const s = ice();
    s.stepSpec({ moveX: 1 });
    expect(s.body.vx).toBe(3.75);
    s.body.vx = 170;
    s.stepSpec({});
    expect(s.body.vx).toBeCloseTo(170 - 200 / 120);
    s.stepSpec({ moveX: -1 });
    expect(s.body.vx).toBeCloseTo(170 - 200 / 120 - 7.5);
    s.stepSpec({ dash: true, moveY: 1, moveX: 1 }, 36);
    s.stepSpec({ moveX: 1 });
    expect(s.body.vx).toBe(329);
    s.stepSpec({ moveX: 1 });
    expect(s.body.vx).toBe(328);
    s.stepSpec({ jump: true, moveX: 1 });
    expect(s.body.onIce).toBe(false);
    const vx = s.body.vx;
    s.stepSpec({ moveX: 1 });
    expect(s.body.vx).toBe(vx - 5);
  });
  it('body ice retains its surface and an edge support counts when center has no floor', () => {
    const g = gridFromRects(20, 30, []);
    const bs = new Bodies(20, 30);
    g.bodies = bs;
    bs.add({ id: 'ice', x: 160, y: 320, w: 32, h: 16, active: true, oneWay: false, surface: 'ice', grabbable: true, noTeleport: false });
    const s = new PlayerSim(g, { x: 157, y: 320 });
    s.stepSpec({ moveX: 1 });
    expect(s.body.onIce).toBe(true);
    expect(s.body.vx).toBe(3.75);
    expect(g.kindAt(10, 20)).toBe('ice');
  });
});
