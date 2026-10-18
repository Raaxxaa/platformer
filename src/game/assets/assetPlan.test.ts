import { describe,it,expect } from 'vitest';
import { assetPlan } from './assetPlan.ts';
describe('load only art and audio files actually present on main',()=>{
  it('requires complete atlas pairs and does not invent missing Stage2 paths',()=>{
    const plan=assetPlan(['assets/atlases/enemies_plains.json','assets/atlases/enemies_plains.png','assets/atlases/enemies_mountains.json','assets/tiles/tiles_plains.png']);
    expect(plan.atlases).toEqual(['enemies_plains']);expect(plan.tiles).toEqual(['plains']);expect(plan.backgrounds).toEqual([]);
  });
  it('loads newly present biome art automatically and filters audio to real files',()=>{
    const plan=assetPlan(['assets/tiles/tiles_mountains.png','assets/bg/bg_village_border_0.png','assets/bg/bg_village_border_1.png','assets/bg/bg_village_border_2.png','assets/audio/sfx/cart_jump.wav']);
    expect(plan.tiles).toEqual(['mountains']);expect(plan.backgrounds).toEqual(['village_border']);expect(plan.audio).toContain('cart_jump.wav');
  });
});
