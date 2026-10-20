import { describe, it, expect } from 'vitest';
import { applyEnemyDamage } from './enemyDamage.ts';
import type { EnemyState } from '../enemies/enemy.ts';

function enemy(hp: number, ward: number | null): EnemyState {
  return { hp, ward: ward === null ? null : { hp: ward } } as unknown as EnemyState;
}

describe('applyEnemyDamage', () => {
  it('no ward: hp 100, damage 30 -> hp 70, ward stays null', () => {
    const e = enemy(100, null);
    applyEnemyDamage(e, 30);
    expect(e.hp).toBe(70);
    expect(e.ward).toBeNull();
  });

  it('ward 20, hp 100, damage 15 -> ward hp 5, enemy hp 100', () => {
    const e = enemy(100, 20);
    applyEnemyDamage(e, 15);
    expect(e.hp).toBe(100);
    expect(e.ward).toEqual({ hp: 5 });
  });

  it('ward 20, hp 100, damage 50 -> ward becomes null, enemy hp 70', () => {
    const e = enemy(100, 20);
    applyEnemyDamage(e, 50);
    expect(e.hp).toBe(70);
    expect(e.ward).toBeNull();
  });

  it('ward 20, hp 100, damage 20 -> ward becomes null, enemy hp 100', () => {
    const e = enemy(100, 20);
    applyEnemyDamage(e, 20);
    expect(e.hp).toBe(100);
    expect(e.ward).toBeNull();
  });
});
