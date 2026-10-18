import { describe,it,expect } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { feet,levelFrom } from '../testkit/levelData.ts';
import { applyLucky } from './lucky.ts';

function world(id:'mountains'|'swamps',water=false){
  const rows=Array.from({length:24},(_,y)=>y>=20?'#'.repeat(100):y===19&&water?'~'.repeat(100):'.'.repeat(100));
  const d=levelFrom(rows,[feet('player_start',30,19)],id);d.stage=2;
  return GameWorld.fromLevel(d,{seedText:'AMBUSH'});
}
describe('Stage2 Ambush packs (05 §7.5)',()=>{
  it('Mountains spawns Miner,Ram,Bat in order with full60spawn-in and airborne Bat placement',()=>{
    const w=world('mountains');applyLucky(w,'ambush',0,0);
    expect(w.enemies.map(e=>e.def.id)).toEqual(['goblin_miner','ram','bat_swarm']);
    expect(w.enemies.map(e=>e.hp)).toEqual([42,56,35]);
    expect(w.enemies.every(e=>e.spawnInTicks===60&&e.aware&&!e.dormant&&!e.noRewards)).toBe(true);
    expect(w.enemies[2].y).toBe(w.body.y-72);
  });
  it('Swamp pack is already risen and grounded even when the Zombie spawns in water',()=>{
    const w=world('swamps',true);applyLucky(w,'ambush',0,0);
    expect(w.enemies.map(e=>e.def.id)).toEqual(['bog_zombie','giant_spider','swamp_witch']);
    expect(w.enemies[0].swamp?.submerged).toBe(false);expect(w.enemies[1].swamp?.hanging).toBe(false);
    expect(w.enemies.every(e=>e.y===320&&e.spawnInTicks===60&&!e.noRewards)).toBe(true);
  });
  it('skips a flyer when both named heights are blocked, without trying an extra mirrored spot',()=>{
    const w=world('mountains');w.camera.target={x:0,y:0,w:1600,h:384};
    w.addBody({id:'flyer-block',x:624,y:224,w:48,h:80,active:true,oneWay:false,surface:'normal',grabbable:false,noTeleport:false});
    applyLucky(w,'ambush',0,0);expect(w.enemies.map(e=>e.def.id)).toEqual(['goblin_miner','ram']);
  });
});
