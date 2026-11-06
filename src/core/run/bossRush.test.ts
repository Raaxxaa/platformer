import { describe, expect, it } from 'vitest';
import { applyBossRushBest, bossDown, bossRushKey, bossRushLoadout, bossRushOrder, bossRushTicks, bossRushUnlocked, healBetween, newBossRush, secondAbility } from './bossRush.ts';
import { DRAGON_ROLL } from '../../data/run.ts';

describe('Boss rush (06 §14.2)', () => {
  it('is locked until the King is beaten; old saves with a finished run count', () => {
    expect(bossRushUnlocked({ progress: {}, stats: { runsCompleted: 0 } })).toBe(false);
    expect(bossRushUnlocked({ progress: { kingBeaten: true }, stats: { runsCompleted: 0 } })).toBe(true);
    expect(bossRushUnlocked({ progress: {}, stats: { runsCompleted: 1 } })).toBe(true);
  });
  it('fights in order, the Dragon after the Spider Queen when on, each in its own level (its own stage scaling)', () => {
    expect(bossRushOrder(false).map((f) => f.boss)).toEqual(['great_boar', 'stone_colossus', 'spider_queen', 'black_knight', 'enemy_king']);
    expect(bossRushOrder(true).map((f) => `${f.boss}@${f.levelId}:${f.arena}`)).toEqual(['great_boar@plains:boss', 'stone_colossus@mountains:boss',
      'spider_queen@swamps:boss', 'dragon@mountains:side', 'black_knight@kingdom:boss', 'enemy_king@castle:boss']);
  });
  it('loadout: the Stage 4 preset plus the second ability at Lv3; weapon slot 2 empty', () => {
    expect(secondAbility('swordsman')).toBe('whirlwind'); expect(secondAbility('wizard')).toBe('frost_burst');
    const l = bossRushLoadout('tank', 'war_maul');
    expect(l.weapons[0]).toMatchObject({ weaponId: 'war_maul', grade: 'B' }); expect(l.weapons[1]).toBeNull();
    expect(l.abilities.map((a) => a && [a.id, a.level])).toEqual([['shockwave', 3], ['shoulder_charge', 3]]);
  });
  it('between fights HP +50% (capped); time is the sum of fights; splits per boss', () => {
    expect(healBetween(30, 100)).toBe(80); expect(healBetween(70, 100)).toBe(100);
    const a = newBossRush('archer', 'bow', 'random', 0.99, DRAGON_ROLL.colors);
    expect(a.dragonColor).toBe('green'); expect(a.fights).toHaveLength(6);
    expect(bossDown(a, 1000, 40, 100)).toBe(false); expect(a.hp).toBe(90);
    bossDown(a, 500, 90, 100); expect(a.splits).toEqual([1000, 1500]); expect(bossRushTicks(a)).toBe(1500);
  });
  it('a best per class|dragon, only for finished non-assisted attempts', () => {
    const bests = {}; const a = newBossRush('tank', 'war_maul', 'off', 0, DRAGON_ROLL.colors);
    for (let i = 0; i < 4; i++) bossDown(a, 100, 100, 100);
    expect(applyBossRushBest(bests, a)).toBe(false);                 // not finished
    bossDown(a, 100, 100, 100);
    const b = structuredClone(a); b.assist = true; expect(applyBossRushBest(bests, b)).toBe(false);
    expect(applyBossRushBest(bests, a)).toBe(true);
    expect(bests).toEqual({ [bossRushKey('tank', false)]: { ticks: 500, splits: [100, 200, 300, 400, 500] } });
  });
});
