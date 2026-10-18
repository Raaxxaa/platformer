import type { EnemyProjectileDef } from '../core/enemies/types.ts';

// Spider Queen Venom Spit, 04 §8 and §10.3.
export const VENOM_SPIT_OFFSETS = [-48, 0, 48] as const;
export const VENOM_GLOB: EnemyProjectileDef = {
  id: 'venom_glob', w: 10, h: 10, motion: 'arc', arcTime: 0.8,
  // A one-tick impact box preserves the normal hit pipeline without adding a larger splash.
  blast: { w: 10, h: 10, fuse: 0 },
  hit: { box: { dx: 0, dy: 0, w: 10, h: 10 }, damage: 15, status: { id: 'poisoned', stacks: 1 } },
  puddle: { w: 48, h: 8, life: 2.0, status: 'poisoned' },
};
