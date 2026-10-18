import type Phaser from 'phaser';
import { describe,it,expect,vi } from 'vitest';
import { rails,waterFrame,featureMarkers,markerStyle,WaterFx,Stage2FeatureView } from './stage2Features.ts';
import mountainJson from '../../../public/levels/mountains.json';
import { levelGrid,loadLevel } from '../../core/level/loadLevel.ts';
import { gridFromRects } from '../../core/level/build.ts';
import { levelFrom,feet,rect } from '../../core/testkit/levelData.ts';
import { GameWorld } from '../../core/sim/gameWorld.ts';
import { stepSpec } from '../../core/testkit/combatWorld.ts';

function featureScene() {
  const graphics: Record<string, ReturnType<typeof vi.fn>>[] = [];
  const make = () => {
    const g = Object.fromEntries(['setDepth', 'clear', 'fillStyle', 'fillRect', 'lineStyle', 'strokeCircle', 'strokeEllipse', 'destroy'].map((key) => [key, vi.fn().mockReturnThis()]));
    graphics.push(g); return g;
  };
  const raw = { add: { graphics: vi.fn(make) }, textures: { exists: () => false }, cameras: { main: { scrollX: 0, scrollY: 0, zoom: 1 } }, events: { once: vi.fn(), off: vi.fn() } };
  return { scene: raw as unknown as Phaser.Scene, graphics };
}
describe('Stage2 feature drawing data (08 §9.3,§9.5,§11)',()=>{
  it('rails follow the topmost surface in the32up/48down window and leave a gap when no support exists',()=>{
    const grid=gridFromRects(10,20,[{x0:0,y0:10,x1:2,y1:10,kind:'solid'},{x0:3,y0:8,x1:3,y1:8,kind:'oneway'},{x0:5,y0:11,x1:9,y1:11,kind:'ice'}]);
    const d=levelFrom(Array(20).fill('.'.repeat(10)),[feet('minecart',0,9),rect('minecart_stop',8,9,1,4)]);
    expect(rails(grid,d.objects)).toEqual([{x:0,y:160},{x:16,y:160},{x:32,y:160},{x:48,y:128},{x:80,y:176},{x:96,y:176},{x:112,y:176}]);
    expect([waterFrame(0,0),waterFrame(0,1),waterFrame(20,0),waterFrame(80,0)]).toEqual([0,1,1,0]);
  });
  it('draws hazard floor warnings and fixed Snare/Queen markers above darkness',()=>{
    const w=new GameWorld({grid:gridFromRects(40,25,[{x0:0,y0:20,x1:39,y1:24,kind:'solid'}]),spawn:{x:200,y:320}});
    w.fallingRocks.markers.push({id:1,zoneId:1,x:200,floorY:320,topY:0,ticks:72});
    expect(featureMarkers(w)).toContainEqual({x:200,y:320,w:16});
    const e=w.spawnExtra({enemy:'treant',x:400,y:320,facing:-1});e.swamp!.marker={x:200,y:320};e.ai.attack={def:e.def.attacks[0],phase:'tele',t:1,len:96,groupId:null,moved:0,hitDone:false};
    expect(featureMarkers(w)).toContainEqual({x:200,y:320,w:40});
  });
  it('splash uses fast entry/exit only; moving in water emits one ripple per30ticks and effects expire',()=>{
    const w=new GameWorld({grid:gridFromRects(40,25,[{x0:0,y0:20,x1:39,y1:24,kind:'solid'}]),spawn:{x:200,y:320}}),fx=new WaterFx();
    w.body.vy=101;fx.update(w,[{tick:1,e:{t:'move',e:'enterWater'}}]);expect(fx.list.filter(f=>f.kind==='splash')).toHaveLength(1);
    w.tick=1;w.body.inWater=true;w.body.vx=50;fx.update(w,[]);expect(fx.list.filter(f=>f.kind==='ripple')).toHaveLength(1);
    w.tick=30;fx.update(w,[]);expect(fx.list.filter(f=>f.kind==='ripple')).toHaveLength(1);
    w.tick=31;fx.update(w,[]);expect(fx.list.filter(f=>f.kind==='ripple')).toHaveLength(1);
    w.body.inWater=false;w.body.vy=100;fx.update(w,[{tick:31,e:{t:'move',e:'exitWater'}}]);expect(fx.list.filter(f=>f.kind==='splash')).toHaveLength(0);
    w.tick=100;fx.update(w,[]);expect(fx.list).toHaveLength(0);
  });

  it('draws real Mountain rails through the last supported column before the cart stop',()=>{
    const d=loadLevel(mountainJson),points=rails(levelGrid(d),d.objects),stop=d.objects.find(o=>o.type==='minecart_stop')!;
    expect(points.at(-1)).toEqual({x:stop.x-16,y:144*16});
    expect(points.some(p=>p.x===325*16||p.x===326*16)).toBe(false);
  });

  it('keeps a Queen target fixed and makes the final18warningticks solid cream',()=>{
    const w=new GameWorld({grid:gridFromRects(40,25,[]),spawn:{x:200,y:320}}),queen=w.spawnExtra({enemy:'spider_queen',x:400,y:320,facing:-1});
    queen.guardian={marker:{x:240,y:320},floorY:320,ceilingFeet:36,broodDone:[false,false],broodPending:0};
    queen.ai.attack={def:queen.def.attacks.find(a=>a.id==='ceiling_drop')!,phase:'tele',t:174,len:192,groupId:null,moved:0,hitDone:false};
    w.body.x=500;
    expect(featureMarkers(w)).toContainEqual({x:240,y:320,w:96});
    expect(markerStyle(w,{x:240,y:320,w:96},0)).toEqual({color:0xfff4c8,alpha:1});
    queen.dead=true;expect(featureMarkers(w)).toEqual([]);
  });

  it('places wading ripples on the water surface instead of the solid floor under it',()=>{
    const grid=gridFromRects(40,25,[{x0:0,y0:19,x1:39,y1:19,kind:'water'},{x0:0,y0:20,x1:39,y1:24,kind:'solid'}]);
    const w=new GameWorld({grid,spawn:{x:200,y:320}}),fx=new WaterFx();w.body.inWater=true;w.body.vx=50;
    fx.update(w,[]);expect(fx.list[0].y).toBe(304);
  });

  it('owns and removes its view objects, culls distant water and never changes the grid',()=>{
    const rows=Array.from({length:23},(_,y)=>y===19?'~'.repeat(80):y>=20?'#'.repeat(80):'.'.repeat(80));
    const d=levelFrom(rows,[feet('player_start',3,19)],'swamps'),w=GameWorld.fromLevel(d, {seedText:'VIEW'}),before=Array.from(w.level!.tiles);
    const all:{clear:ReturnType<typeof vi.fn>;destroy:ReturnType<typeof vi.fn>;fillRect:ReturnType<typeof vi.fn>}[]=[];
    const graphics=()=>{const g={setDepth:vi.fn().mockReturnThis(),clear:vi.fn().mockReturnThis(),destroy:vi.fn(),fillStyle:vi.fn().mockReturnThis(),fillRect:vi.fn().mockReturnThis(),lineStyle:vi.fn().mockReturnThis(),strokeCircle:vi.fn().mockReturnThis()};all.push(g);return g;};
    const raw={add:{graphics:vi.fn(graphics)},textures:{exists:()=>false},cameras:{main:{scrollX:0,scrollY:0,zoom:1}},events:{once:vi.fn(),off:vi.fn()}},view=new Stage2FeatureView(raw as unknown as Phaser.Scene,w);
    view.update(w,[],0);expect(all[2].fillRect.mock.calls.length).toBeLessThanOrEqual(41);
    w.body.x=200;w.body.vy=101;view.onTick(w,[{tick:w.tick,e:{t:'move',e:'enterWater'}}]);
    w.body.x=400;w.body.vy=0;view.update(w,[],0);
    expect(all[1].fillRect).toHaveBeenCalledWith(188,288,24,16);
    const beforeZoom=all[2].fillRect.mock.calls.length;raw.cameras.main.zoom=0.5;view.update(w,[],0);
    expect(all[2].fillRect.mock.calls.length-beforeZoom).toBeGreaterThan(41);
    expect(Array.from(w.level!.tiles)).toEqual(before);
    view.destroy();view.destroy();expect(all.every(g=>g.destroy.mock.calls.length===1)).toBe(true);
  });

  it('captures a real fast water dive splash even after the impact resets vertical speed to zero', () => {
    const grid = gridFromRects(80, 30, [{ x0: 0, y0: 20, x1: 79, y1: 29, kind: 'solid' }, { x0: 0, y0: 18, x1: 79, y1: 19, kind: 'water' }]);
    const w = new GameWorld({ grid, spawn: { x: 200, y: 270 } }), f = featureScene(), view = new Stage2FeatureView(f.scene, w);
    let seenEntry = false, seenDive = false;
    for (let i = 0; i < 21 && w.body.state !== 'diveLand'; i++) {
      const events = stepSpec(w, i === 0 ? { attack1: true, moveY: 1 } : {});
      seenEntry ||= events.some((e) => e.t === 'move' && e.e === 'enterWater');
      seenDive ||= events.some((e) => e.t === 'move' && e.e === 'diveLand');
      view.onTick(w, events.map((e) => ({ tick: w.tick, e })));
    }
    expect(seenEntry).toBe(true); expect(seenDive).toBe(true);
    expect(w.body.vy).toBe(0); expect(w.body.landSpeed).toBe(600);
    view.update(w, [], 0);
    expect(f.graphics[1].fillRect).toHaveBeenCalledWith(188, 272, 24, 16);
    view.destroy();
  });

  it('ignores stale landing speed when a slow walk crosses into water', () => {
    const grid = gridFromRects(80, 30, [{ x0: 0, y0: 20, x1: 79, y1: 29, kind: 'solid' }, { x0: 10, y0: 18, x1: 79, y1: 19, kind: 'water' }]);
    const w = new GameWorld({ grid, spawn: { x: 150, y: 320 } }), f = featureScene(), view = new Stage2FeatureView(f.scene, w);
    w.body.landSpeed = 600;
    let entries = 0;
    for (let i = 0; i < 40 && entries === 0; i++) {
      const events = stepSpec(w, { moveX: 1 });
      entries += events.filter((e) => e.t === 'move' && e.e === 'enterWater').length;
      view.onTick(w, events.map((e) => ({ tick: w.tick, e })));
    }
    expect(entries).toBe(1); expect(w.body.vy).toBe(0);
    view.update(w, [], 0);
    expect(f.graphics[1].fillRect.mock.calls.some((call) => call[2] === 24 && call[3] === 16)).toBe(false);
    view.destroy();
  });

  it('draws a live Stone Ward barrier around its enemy and removes it on break or death', () => {
    const w = new GameWorld({ grid: gridFromRects(40, 25, []), spawn: { x: 200, y: 320 } });
    const e = w.spawnExtra({ enemy: 'rock_golem', x: 300, y: 320, facing: -1 }), f = featureScene(), view = new Stage2FeatureView(f.scene, w);
    e.ward = { hp: 35, ticks: 480, sourceId: 2 }; view.update(w, [], 0);
    const ellipseCalls = () => f.graphics.flatMap((g) => g.strokeEllipse.mock.calls);
    expect(ellipseCalls()).toContainEqual([300, 320 - e.def.hurtbox.h / 2, e.def.hurtbox.w + 6, e.def.hurtbox.h + 6]);
    for (const g of f.graphics) g.strokeEllipse.mockClear();
    e.ward = null; view.update(w, [], 0); expect(ellipseCalls()).toEqual([]);
    e.ward = { hp: 35, ticks: 480, sourceId: 2 }; e.dead = true;
    view.update(w, [], 0); expect(ellipseCalls()).toEqual([]);
    view.destroy();
  });
});
