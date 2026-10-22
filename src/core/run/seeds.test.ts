import { describe, expect, it } from 'vitest';
import plainsJson from '../../../public/levels/plains.json';
import { loadLevel } from '../level/loadLevel.ts';
import { deriveSeed, fnv1a32, Rng } from '../rng.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { rollDragon } from './dragonRoll.ts';
import { RANDOM_SEED } from '../../data/run.ts';

// 06 §7 and the §16 checklist (items 2, 4, 6, 30): the rules the seed board and race mode rely on.
describe('seeds (06 §7)', () => {
  it('a typed seed in lowercase is the same seed once upper-cased, and different streams differ', () => {
    expect(fnv1a32('abc123'.toUpperCase())).toBe(fnv1a32('ABC123'));
    const s = fnv1a32('ABC123');
    expect(deriveSeed(s, 'loot', 'plains', 7)).not.toBe(deriveSeed(s, 'loot', 'plains', 8)); expect(deriveSeed(s, 'loot')).not.toBe(deriveSeed(s, 'lucky'));
  });
  it('Dragon odds over 100 000 seeds: present 30%, stage 2 half the time, each color a quarter; always three draws', () => {
    const N = 100_000, colors: Record<string, number> = { red: 0, white: 0, storm: 0, green: 0 }; let present = 0, stage2 = 0;
    for (let i = 0; i < N; i++) {
      const rng = new Rng(deriveSeed(fnv1a32(`SEED${i}`), 'dragon', 'run')); let draws = 0;
      const roll = rollDragon(() => { draws++; return rng.next(); }); expect(draws).toBe(3);
      if (roll.present) present++; if (roll.stage === 2) stage2++; colors[roll.color]++;
    }
    expect(Math.abs(present / N - 0.3)).toBeLessThan(0.005); expect(Math.abs(stage2 / N - 0.5)).toBeLessThan(0.005);
    for (const c of Object.values(colors)) expect(Math.abs(c / N - 0.25)).toBeLessThan(0.005);
  });
  it('random seeds are 8 characters from the allowed alphabet', () => {
    expect(RANDOM_SEED.length).toBe(8); expect(RANDOM_SEED.alphabet).toBe('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
  });
  it('restart keeps a typed seed and replaces a random one', () => {
    const level = loadLevel(plainsJson); let n = 0;
    const make = (seeded: boolean) => GameWorld.fromLevel(level, { seedText: 'RACE7', seeded, nextRandomSeed: () => `NEW${++n}`, startKit: { cls: 'tank', weapon: 'war_maul' } });
    const typed = make(true); typed.restart(); expect(typed.run.seedText).toBe('RACE7'); expect(typed.run.seeded).toBe(true);
    const random = make(false); random.restart(); expect(random.run.seedText).toBe('NEW1'); expect(random.run.seeded).toBe(false);
  });
  it('the same seed and the same inputs give the same run; another seed gives other loot', () => {
    const level = loadLevel(plainsJson);
    const play = (seedText: string) => {
      const w = GameWorld.fromLevel(level, { seedText, seeded: true, startKit: { cls: 'swordsman', weapon: 'greatsword' } });
      for (let i = 0; i < 5; i++) stepSpec(w, { moveX: 1, jump: i % 2 === 0 }, 60);
      return { run: structuredClone(w.run), body: { x: w.body.x, y: w.body.y }, items: w.groundItems.map((it) => [it.x, it.y, it.weapon?.weaponId ?? it.ability?.id ?? null]), chests: JSON.stringify(w.chests), lucky: JSON.stringify(w.luckyBlocks) };
    };
    expect(play('RACE7')).toEqual(play('RACE7'));
    const a = play('RACE7'), b = play('OTHER9');
    expect(JSON.stringify([a.items, a.chests, a.lucky])).not.toBe(JSON.stringify([b.items, b.chests, b.lucky]));
  });
});
