import { describe, it, expect } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { enemyDamageA } from './enemy.ts';
import { enemyHitDamage } from '../combat/damage.ts';
import { ENEMIES } from '../../data/enemies.ts';

describe('enemy spawning (04 §2.2–2.3)', () => {
  it('a Bandit in Stage 2 has 56 HP and its Slash hits for 13 (04 test 5)', () => {
    const w = arenaWorld({ stage: 2, enemies: [{ enemy: 'bandit', x: 300, y: 320, facing: -1 }] });
    expect(w.enemies[0]).toMatchObject({ maxHp: 56, hp: 56 });
    const slash = ENEMIES.bandit.attacks.find((a) => a.id === 'slash')!;
    expect(enemyHitDamage(enemyDamageA(w, slash.hit!.damage), 1, null)).toBe(13);
    const w1 = arenaWorld({ enemies: [{ enemy: 'bandit', x: 300, y: 320, facing: -1 }] });
    expect(enemyHitDamage(enemyDamageA(w1, slash.hit!.damage), 1, null)).toBe(10);
  });
  it('the Training Dummy is not stage-scaled', () => {
    const w = arenaWorld({ stage: 4, enemies: [{ enemy: 'training_dummy', x: 300, y: 320, facing: 1 }] });
    expect(w.enemies[0].maxHp).toBe(9999);
  });
  it('an enemy stays dormant until its spawn point is in the camera view grown by 96 px, then stays active', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'bandit', x: 820, y: 320, facing: -1 }] });
    stepSpec(w, {});
    expect(w.enemies[0].dormant).toBe(true);           // view 0–640, +96 = 736
    while (w.camera.x + 640 + 96 < 820) stepSpec(w, { moveX: 1 });
    stepSpec(w, {});
    expect(w.enemies[0].dormant).toBe(false);
    stepSpec(w, { moveX: -1 }, 120);
    expect(w.enemies[0].dormant).toBe(false);
  });
  it('enemies get ids in spawn order, facing and feet from the spawn', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'wolf', x: 300, y: 320, facing: -1 }, { enemy: 'bandit', x: 400, y: 320, facing: 1 }] });
    expect(w.enemies.map((e) => [e.def.id, e.x, e.y, e.facing])).toEqual([['wolf', 300, 320, -1], ['bandit', 400, 320, 1]]);
    expect(w.enemies[0].id).toBeLessThan(w.enemies[1].id);
    expect(w.enemies[0]).toMatchObject({ aware: false, noticeT: 0, poise: 10, dead: false });
  });
});
