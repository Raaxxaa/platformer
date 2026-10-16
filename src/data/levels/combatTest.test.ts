import { describe, it, expect } from 'vitest';
import { COMBAT_TEST } from './combatTest.ts';
import { ENEMIES } from '../enemies.ts';

describe('COMBAT_TEST level', () => {
  const g = COMBAT_TEST.grid;
  it('is 100 x 23 tiles with the floor at feet y 320', () => {
    expect([g.w, g.h]).toEqual([100, 23]);
    expect(COMBAT_TEST.spawn).toEqual({ x: 64, y: 320 });
    expect(g.isSolidPx(64, 320)).toBe(true); expect(g.isSolidPx(64, 319)).toBe(false);
  });
  it('every spawn stands on support and is free of solids', () => {
    for (const s of COMBAT_TEST.enemies) {
      const { w, h } = ENEMIES[s.enemy]!.hurtbox;
      const support = g.kindAt(Math.floor(s.x / 16), Math.floor(s.y / 16));
      expect(support === 'solid' || support === 'oneway', s.enemy).toBe(true);
      for (let x = Math.ceil(s.x - w / 2); x < s.x + w / 2; x++)
        for (let y = s.y - h; y < s.y; y++) expect(g.isSolidPx(x, y), `${s.enemy} at ${x},${y}`).toBe(false);
    }
  });
  it('the archer stands on the one-way platform 64 px up', () => {
    const a = COMBAT_TEST.enemies.find((s) => s.enemy === 'bandit_archer')!;
    expect(a.y).toBe(256); expect(g.kindAt(Math.floor(a.x / 16), 16)).toBe('oneway');
  });
  it('the boar has flat floor up to a wall within one charge on both sides', () => {
    const b = COMBAT_TEST.enemies.find((s) => s.enemy === 'wild_boar')!;
    const charge = ENEMIES.wild_boar.attacks.find((a) => a.id === 'charge')!.move!.dist;
    for (const dir of [-1, 1]) {
      let run = 0;
      while (!g.isSolidPx(b.x + dir * (run + 1), b.y - 1)) { expect(g.isSolidPx(b.x + dir * run, b.y)).toBe(true); run++; }
      expect(run).toBeGreaterThanOrEqual(100);
      expect(run).toBeLessThan(charge);
    }
  });
});
