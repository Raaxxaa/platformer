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

it('every Stage 2 enemy and both Guardians resolve idle, stagger and death art, flyers included', async () => {
  const { readFileSync } = await import('node:fs');
  const list = JSON.parse(readFileSync(new URL('../../../public/assets/anims.json', import.meta.url), 'utf8'));
  const bank = new AnimBank(list);
  const regulars = ['bat_swarm', 'goblin_miner', 'rock_golem', 'ram', 'goblin_shaman', 'bog_zombie', 'giant_spider', 'wisp', 'swamp_witch', 'treant'];
  for (const id of regulars) for (const k of ['idle', 'stagger', 'death']) expect(bank.enemy(id, false)(k), `${id} ${k}`).toBeDefined();
  expect(bank.enemy('bat_swarm', false)('idle')?.key).toBe('bat_swarm_fly');
  expect(bank.enemy('wisp', false)('idle')?.key).toBe('wisp_float');
  for (const id of ['stone_colossus', 'spider_queen']) for (const k of ['idle', 'stagger', 'death']) expect(bank.enemy(id, true)(k), `${id} ${k}`).toBeDefined();
});
