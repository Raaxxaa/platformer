import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../data/enemies.ts';
import { PLAYER_PROJECTILES, PROJECTILE_SPAWN } from '../../data/playerProjectiles.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { firePlayerProjectile } from './playerProjectiles.ts';
import type { EnemyId } from '../enemies/types.ts';

// M17 Task 1 (02 §9.8, §10.4): shots fired from the ground hit every enemy standing on the same floor.
const SHOTS = ['arrow', 'bolt', 'knife', 'staff_bolt'] as const;
const FLOOR = 320;

describe('shots hit low enemies (playtest: arrows flew over Wolves)', () => {
  it('spawns at +12, −10 and the arrow, bolt and knife boxes are 6 px tall', () => {
    expect(PROJECTILE_SPAWN).toEqual({ dx: 12, dy: -10 });
    for (const id of ['arrow', 'arrow_charged', 'bolt', 'knife'] as const) expect(PLAYER_PROJECTILES[id]!.h).toBe(6);
  });
  it('every enemy standing on the floor overlaps the line of every tap shot', () => {
    for (const [id, def] of Object.entries(ENEMIES)) {
      for (const s of SHOTS) {
        const p = PLAYER_PROJECTILES[s]!, top = FLOOR + PROJECTILE_SPAWN.dy - p.h / 2, bottom = top + p.h;
        expect(bottom > FLOOR - def!.hurtbox.h && top < FLOOR, `${s} vs ${id}`).toBe(true);
      }
    }
  });
  for (const enemy of ['wolf', 'spiderling', 'wild_boar', 'giant_spider', 'bandit'] as EnemyId[]) {
    for (const dist of [24, 100]) {
      it(`a Bow arrow, a bolt, a knife and a Staff bolt hit a ${enemy} at ${dist} px`, () => {
        for (const s of SHOTS) {
          const w = arenaWorld({ enemies: [{ enemy, x: 200 + dist, y: FLOOR, facing: -1 }] });
          const e = w.enemies[0]; e.dormant = false;
          const hp = e.hp;
          firePlayerProjectile(w, 0, 1, s, 0);
          stepSpec(w, {}, 20);
          expect(e.hp, `${s} vs ${enemy}`).toBeLessThan(hp);
        }
      });
    }
  }
});
