import { describe,it,expect } from 'vitest';
import { levelFrom,rect,feet } from '../testkit/levelData.ts';
import { validateLevel } from './validateLevel.ts';

describe('Stage2 level contracts (06 §8.2–8.5)',()=>{
  it('rejects missing Mountain section mix, the great climb, falling rocks, ice, cart and cracked skip',()=>{
    const d=levelFrom(Array(30).fill('.'.repeat(60)),[feet('player_start',1,20),rect('section',0,0,60,30,{index:3})],'mountains');d.stage=2;
    const errors=validateLevel(d);
    expect(errors).toContain('section 3: expected 2 regulars, found 0');
    expect(errors).toContain('mountains: section 3 needs a main-path climb of at least 60 tiles');
    expect(errors).toContain('mountains: section 3 needs falling_rocks');
    expect(errors).toContain('mountains: section 4 needs a cracked_wall skip');
    expect(errors).toContain('mountains: section 6 needs ice and a minecart route of at least 120 tiles');
  });
  it('rejects dry Swamp sections and missing dark/firefly and grapple foundations',()=>{
    const d=levelFrom(Array(30).fill('.'.repeat(60)),[rect('section',0,0,60,30,{index:2}),rect('section',0,0,60,30,{index:3}),rect('section',0,0,60,30,{index:6})],'swamps');d.stage=2;
    const errors=validateLevel(d);
    expect(errors).toContain('swamps: section 2 water covers 0.0% of its floor length (min 30%)');
    expect(errors).toContain('swamps: section 3 needs a dark_zone with a firefly');
    expect(errors).toContain('swamps: section 6 needs a dark_zone with a firefly');
    expect(errors).toContain('swamps: section 4 needs a grapple_point skip');
  });
  it('rejects a side arena warning less than640px before the opening',()=>{
    const d=levelFrom(Array(30).fill('.'.repeat(100)),[rect('arena',50,1,40,20,{id:'dragon',kind:'side'}),rect('dragon_warning',30,1,1,5)],'mountains');d.stage=2;
    expect(validateLevel(d)).toContain('side arena dragon: warning must be at least 640 px before its opening');
  });
  it('does not count floating sky water toward the Swamp floor coverage',()=>{
    const rows=Array.from({length:30},(_,y)=>y===1?'~'.repeat(60):y>=20?'#'.repeat(60):'.'.repeat(60));
    const d=levelFrom(rows,[rect('section',0,0,60,30,{index:2})],'swamps');d.stage=2;
    expect(validateLevel(d)).toContain('swamps: section 2 water covers 0.0% of its floor length (min 30%)');
  });
});
