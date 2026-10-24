import { describe, expect, it } from 'vitest';
import { killEnemy } from '../combat/resolve.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';

const unlocks = (ev: ReturnType<typeof stepSpec>) => ev.filter((e) => e.t === 'cosmeticUnlocked');
describe('cosmetics in the world (09 §3–§4, checklist 2, 8)', () => {
  it('the first kill of a type unlocks it once, with an event; the second kill adds nothing', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'wolf', x: 320, y: 320, facing: -1 }, { enemy: 'wolf', x: 360, y: 320, facing: -1 }] });
    w.enemies.forEach((e) => { e.dormant = false; });
    killEnemy(w, w.enemies[0]);
    expect(unlocks(stepSpec(w, {}, 1))).toEqual([{ t: 'cosmeticUnlocked', id: 'acc_wolf', source: 'kill' }]);
    killEnemy(w, w.enemies[1]);
    expect(unlocks(stepSpec(w, {}, 1))).toEqual([]);
    expect([...w.cosmetics.owned]).toEqual(['acc_wolf']);
  });
  it('an owned accessory from the save is not unlocked again', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'bandit', x: 320, y: 320, facing: -1 }] });
    (w as unknown as { cosmetics: { owned: Set<string> } }).cosmetics.owned.add('acc_bandit');
    w.enemies[0].dormant = false; killEnemy(w, w.enemies[0]);
    expect(unlocks(stepSpec(w, {}, 1))).toEqual([]);
  });
  it('a dummy or a straw target unlocks nothing', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'training_dummy', x: 320, y: 320, facing: -1 }, { enemy: 'straw_target', x: 360, y: 320, facing: -1 }] });
    for (const e of w.enemies) { e.dormant = false; killEnemy(w, e); }
    expect(unlocks(stepSpec(w, {}, 1))).toEqual([]); expect(w.cosmetics.owned.size).toBe(0);
  });
  it('a type becoming aware of the player is remembered once (the collection hint)', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'wolf', x: 320, y: 320, facing: -1 }] });
    w.enemies[0].dormant = false; w.enemies[0].aware = true;
    const seen = (ev: ReturnType<typeof stepSpec>) => ev.filter((e) => e.t === 'enemySeen');
    expect(seen(stepSpec(w, {}, 1))).toEqual([{ t: 'enemySeen', enemy: 'wolf' }]);
    expect(seen(stepSpec(w, {}, 5))).toEqual([]); expect([...w.cosmetics.seen]).toEqual(['wolf']);
  });
});
