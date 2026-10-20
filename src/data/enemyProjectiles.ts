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

// Stage 3 (04 §8). Fireball burns; dark_wave is the Black Knight's jumpable floor wave.
ENEMY_PROJECTILES.enemy_bolt = { id: 'enemy_bolt', w: 12, h: 4, motion: 'straight', speed: 420, range: 400, hit: { box: { dx: 0, dy: 0, w: 12, h: 4 }, damage: 12 } };
ENEMY_PROJECTILES.fireball = { id: 'fireball', w: 12, h: 12, motion: 'straight', speed: 260, range: 360, hit: { box: { dx: 0, dy: 0, w: 12, h: 12 }, damage: 12, status: { id: 'burning' } } };
ENEMY_PROJECTILES.dark_wave = { id: 'dark_wave', w: 20, h: 32, motion: 'floorWave', speed: 300, range: 480, hit: { box: { dx: 0, dy: 0, w: 20, h: 32 }, damage: 18 } };

// Stage 4 (04 §8). The Castle Mage's bolts, the King's homing orbs and falling swords, the Red Dragon's fire rain.
ENEMY_PROJECTILES.arcane_bolt = { id: 'arcane_bolt', w: 8, h: 8, motion: 'straight', speed: 240, range: 300, hit: { box: { dx: 0, dy: 0, w: 8, h: 8 }, damage: 10 } };
ENEMY_PROJECTILES.royal_orb = { id: 'royal_orb', w: 12, h: 12, motion: 'straight', speed: 160, life: 3.0, homing: { radius: 200, turnRate: 45 }, hit: { box: { dx: 0, dy: 0, w: 12, h: 12 }, damage: 15 } };
ENEMY_PROJECTILES.falling_sword = { id: 'falling_sword', w: 12, h: 32, motion: 'falling', speed: 600, hit: { box: { dx: 0, dy: 0, w: 12, h: 32 }, damage: 18 } };
ENEMY_PROJECTILES.fire_rain = { id: 'fire_rain', w: 16, h: 16, motion: 'falling', speed: 450, hit: { box: { dx: 0, dy: 0, w: 16, h: 16 }, damage: 16, status: { id: 'burning' } } };
