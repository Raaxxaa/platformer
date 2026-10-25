import { describe, expect, it } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';

// 09 checklist 1: the simulation does not read the look; owning every cosmetic changes no number.
describe('looks never change the simulation (09 §1)', () => {
  it('the same inputs give the same body, health and enemies with nothing owned and with everything owned', () => {
    const run = (owned: string[]) => {
      const w = arenaWorld({ enemies: [{ enemy: 'wolf', x: 400, y: 320, facing: -1 }, { enemy: 'bandit', x: 440, y: 320, facing: -1 }] });
      for (const id of owned) (w as unknown as { cosmetics: { owned: Set<string> } }).cosmetics.owned.add(id);
      const seq = [{ moveX: 1 }, { moveX: 1, jump: true }, { moveX: 1, attack1: true }, {}, { moveX: -1, dash: true }] as const;
      for (let i = 0; i < 400; i++) stepSpec(w, seq[Math.floor(i / 80) % seq.length] as never, 1);
      return JSON.stringify({ body: w.body, hp: w.health, enemies: w.enemies.map((e) => [e.id, e.x, e.y, e.hp, e.dead]), tick: w.tick });
    };
    const all = ['acc_wolf', 'acc_bandit', 'cape_gold', 'hat_straw', 'dye_crimson'];
    expect(run([])).toBe(run(all));
  });
});
