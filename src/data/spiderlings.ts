import type { EnemyDef } from '../core/enemies/types.ts';
import { ENEMY } from '../core/tuning.ts';

// Spider Queen Brood, 04 §2.2 and §10.3.
export const SPIDERLING_RULES = { offsets: [-32, 32], maxAlive: 4, spawnInTicks: 60 } as const;
export const SPIDERLING: EnemyDef = {
  id: 'spiderling', tier: 'summon', elite: false, size: 'small', hurtbox: { w: 12, h: 8 }, hp: 12,
  poiseMax: 0, kbResist: 0, walk: 0, chase: 120, preferred: [0, 16],
  // Summons start aware and never return home, so noticing/patrol values are unused.
  notice: { range: 0, rangeY: ENEMY.NOTICE_RANGE_Y, time: 0 },
  attackGap: ENEMY.ATTACK_GAP_REGULAR, turnDelay: 0, gold: 0, itemRoll: 'none', blueprintRoll: false, hpBar: 'damaged',
  attacks: [{ id: 'bite', use: { minX: 0, maxX: 20 }, telegraph: 0.35, active: 0.10, recovery: 0.35, cooldown: 1.2,
    token: 'melee', hit: { box: { dx: 10, dy: -5, w: 14, h: 10 }, damage: 8 } }],
};
