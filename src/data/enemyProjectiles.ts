// Enemy projectiles (04 §8).
import type { EnemyProjectileDef, EnemyProjectileId } from '../core/enemies/types.ts';
import { VENOM_GLOB } from './venomProjectiles.ts';

export const ENEMY_PROJECTILES: Partial<Record<EnemyProjectileId, EnemyProjectileDef>> = {
  enemy_arrow: { id: 'enemy_arrow', w: 12, h: 4, motion: 'straight', speed: 300, range: 320, hit: { box: { dx: 0, dy: 0, w: 12, h: 4 }, damage: 9 } },
  bomb: { id: 'bomb', w: 8, h: 8, motion: 'arc', arcTime: 0.8, blast: { w: 56, h: 56, fuse: 0.5 }, hit: { box: { dx: 0, dy: 0, w: 56, h: 56 }, damage: 13, playerKb: [240, -220] } },
  brute_wave: { id: 'brute_wave', w: 16, h: 12, motion: 'floorWave', speed: 240, range: 160, hit: { box: { dx: 0, dy: 0, w: 16, h: 12 }, damage: 14 } },
  hex_bolt: { id: 'hex_bolt', w: 10, h: 10, motion: 'straight', speed: 220, range: 320, homing: { radius: 160, turnRate: 60 }, hit: { box: { dx: 0, dy: 0, w: 10, h: 10 }, damage: 18 } },
  potion: { id: 'potion', w: 8, h: 8, motion: 'arc', arcTime: 0.7, blast: { w: 40, h: 24, fuse: 0 },
    hit: { box: { dx: 0, dy: 0, w: 40, h: 24 }, damage: 9, status: { id: 'poisoned', stacks: 1 } },
    puddle: { w: 48, h: 8, life: 2.5, status: 'poisoned' } },
  venom_glob: VENOM_GLOB,
  // 04 §8 / §10.1: the Great Boar's Stomp Quake waves run to the walls; rockfall rocks drop at 420 px/s.
  shockwave: { id: 'shockwave', w: 16, h: 16, motion: 'floorWave', speed: 260, hit: { box: { dx: 0, dy: 0, w: 16, h: 16 }, damage: 15, playerKb: [260, -200] } },
  falling_rock: { id: 'falling_rock', w: 18, h: 18, motion: 'falling', speed: 420, hit: { box: { dx: 0, dy: 0, w: 18, h: 18 }, damage: 15 } },
};
