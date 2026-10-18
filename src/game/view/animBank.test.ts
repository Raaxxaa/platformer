import { it, expect } from 'vitest';
import { AnimBank } from './animBank.ts';

it('finds road enemy art in the loaded biome atlas, including carried Ambush enemies', () => {
  const bank = new AnimBank([
    { key: 'goblin_miner_idle', atlas: 'enemies_mountains', frames: ['miner_00'], mode: 'loop', fps: 6 },
    { key: 'bog_zombie_idle', atlas: 'enemies_swamps', frames: ['zombie_00'], mode: 'loop', fps: 6 },
  ]);
  expect(bank.enemy('goblin_miner', false)('idle')?.atlas).toBe('enemies_mountains');
  expect(bank.enemy('bog_zombie', false, 'swamps')('idle')?.atlas).toBe('enemies_swamps');
  expect(bank.enemy('missing', false, 'swamps')('idle')).toBeUndefined();
});
