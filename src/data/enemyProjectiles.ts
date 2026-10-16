// Enemy projectiles used in Stage 1 (04 §8).
import type { EnemyProjectileDef, EnemyProjectileId } from '../core/enemies/types.ts';

export const ENEMY_PROJECTILES: Partial<Record<EnemyProjectileId, EnemyProjectileDef>> = {
  enemy_arrow: { id: 'enemy_arrow', w: 12, h: 4, motion: 'straight', speed: 300, range: 320, hit: { box: { dx: 0, dy: 0, w: 12, h: 4 }, damage: 9 } },
  brute_wave: { id: 'brute_wave', w: 16, h: 12, motion: 'floorWave', speed: 240, range: 160, hit: { box: { dx: 0, dy: 0, w: 16, h: 12 }, damage: 14 } },
  // 04 §8 / §10.1: the Great Boar's Stomp Quake waves run to the walls; rockfall rocks drop at 420 px/s.
  shockwave: { id: 'shockwave', w: 16, h: 16, motion: 'floorWave', speed: 260, hit: { box: { dx: 0, dy: 0, w: 16, h: 16 }, damage: 15, playerKb: [260, -200] } },
  falling_rock: { id: 'falling_rock', w: 18, h: 18, motion: 'falling', speed: 420, hit: { box: { dx: 0, dy: 0, w: 18, h: 18 }, damage: 15 } },
};
