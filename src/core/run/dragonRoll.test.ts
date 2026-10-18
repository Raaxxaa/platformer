import { describe,it,expect,vi } from 'vitest';
import { rollDragon } from './dragonRoll.ts';
import { createRunState } from './runState.ts';
import { deriveSeed,fnv1a32,Rng } from '../rng.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { captureWorld } from './session.ts';
import { feet,levelFrom } from '../testkit/levelData.ts';

describe('deferred Dragon run roll (06 §4, M7.1 global constraint)',()=>{
  it('always draws present,stage,color in order, even when absent',()=>{
    for(const present of [.2999,.3]){
      const values=[present,.4999,.75],rng=vi.fn(()=>values.shift()!);
      expect(rollDragon(rng)).toEqual({present:present<.3,stage:2,color:'green',outcome:'absent'});expect(rng).toHaveBeenCalledTimes(3);
    }
    const values=[0,.5,0];expect(rollDragon(()=>values.shift()!)).toMatchObject({stage:3,color:'red'});
  });
  it('uses the isolated dragon/run scope, survives world carry and changes only on a new run',()=>{
    const seed='DRAGON',r=new Rng(deriveSeed(fnv1a32(seed),'dragon','run'));
    expect(createRunState(seed).dragon).toEqual(rollDragon(()=>r.next()));
    const data=levelFrom(['..........','..........','##########'],[feet('player_start',2,1)]);
    const world=GameWorld.fromLevel(data,{seedText:seed,nextRandomSeed:()=> 'NEXT'});
    const nextData={...data,id:'crossroads' as const,kind:'village' as const,stage:0 as const};
    const village=GameWorld.fromLevel(nextData,{seedText:seed,carry:captureWorld(world)});
    expect(village.run.dragon).toEqual(world.run.dragon);expect(village.enemies.some(e=>e.def.id==='dragon')).toBe(false);
    world.restart();expect(world.run.dragon).toEqual(createRunState('NEXT').dragon);
  });
});
