import { describe, expect, it } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { addGoldTenths, dropLeakyCoins, killGoldTenths } from './gold.ts';
import { dropKey } from './keys.ts';

describe('gold (05 §9, checklist 18–19)', () => {
  it('18: kill gold, integer tenths, round half up', () => {
    expect(killGoldTenths({ gold: 3, rushLevel: 2, goldenTouch: true, prospector: 0, greedy: false })).toBe(72);
    expect(killGoldTenths({ gold: 4, rushLevel: 0, goldenTouch: false, prospector: 1, greedy: true })).toBe(70);
    expect(killGoldTenths({ gold: 3, rushLevel: 1, goldenTouch: false, prospector: 0, greedy: false })).toBe(33);
  });
  it('a real kill credits gold at once; the shown gold is floor(tenths / 10); it resets on restart', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'wolf', x: 230, y: 320, facing: -1 }] });
    stepSpec(w, {}, 2);
    w.enemies[0].hp = 1;
    stepSpec(w, { attack1: true }, 1); stepSpec(w, {}, 40);
    expect(w.econ.goldTenths).toBe(30);
    expect(w.gold).toBe(3);
    w.restart();
    expect(w.econ.goldTenths).toBe(0);
  });
  it('19: Leaky Pockets coins: 200 → 20 as 4 × 5; 30 → 5 as 1; 3 → 3; 0 → nothing; collectable after 0.40 s, gone at 5.0 s', () => {
    const cases: [number, number, number[]][] = [[200, 20, [5, 5, 5, 5]], [30, 5, [5]], [3, 3, [3]], [0, 0, []]];
    for (const [gold, lost, coins] of cases) {
      const w = arenaWorld();
      addGoldTenths(w, gold * 10, 'test');
      dropLeakyCoins(w);
      expect(w.gold).toBe(gold - lost);
      expect(w.coins.map((c) => c.value)).toEqual(coins);
    }
    const w = arenaWorld();
    stepSpec(w, {}, 2);
    addGoldTenths(w, 300, 'test');
    dropLeakyCoins(w);
    expect(w.gold).toBe(25);
    stepSpec(w, {}, 47);                                    // touching the player, but not collectable before 0.40 s
    expect(w.gold).toBe(25);
    stepSpec(w, {}, 2);
    expect(w.gold).toBe(30);
    addGoldTenths(w, 300, 'test');
    dropLeakyCoins(w);
    w.teleportPlayer(w.body.x + 300, w.body.y);
    stepSpec(w, {}, 600);
    expect(w.coins.length).toBe(0);                         // gone at 5.0 s
  });
});

describe('keys (05 §6, checklist 11)', () => {
  it('keys are collected by touch; at 3 a key stays on the ground and the count stays 3', () => {
    const w = arenaWorld();
    stepSpec(w, {}, 2);
    for (let i = 0; i < 4; i++) dropKey(w, w.body.x, w.body.y - 4);
    stepSpec(w, {}, 30);
    expect(w.econ.keys).toBe(3);
    expect(w.groundItems.filter((i) => i.key).length).toBe(1);
  });
});
