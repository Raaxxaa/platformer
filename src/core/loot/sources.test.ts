import { describe, expect, it } from 'vitest';
import plainsJson from '../../../public/levels/plains.json';
import { loadLevel } from '../level/loadLevel.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { kitLoadout, newAbility, newWeapon } from '../abilities/runtime.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { openChest } from './sources.ts';

const plains = loadLevel(plainsJson);
function world(seed = 'LOOT', kit: Parameters<typeof kitLoadout> = ['swordsman', 'greatsword']) {
  const w = GameWorld.fromLevel(plains, { seedText: seed });
  w.setLoadout(kitLoadout(...kit));
  return w;
}
const chests = (w: GameWorld, kind: string) => w.chests.filter((c) => c.kind === kind);
const items = (w: GameWorld) => w.groundItems.filter((i) => !i.key).map((i) => JSON.stringify(i.weapon ?? i.ability));

describe('loot sources (05 §5, checklist 9–10)', () => {
  it('free loot stands roll at stage load: a weapon stand and an ability stand', () => {
    const w = world();
    const standItems = w.groundItems.filter((i) => i.stand);
    expect(standItems.length).toBe(2);
    expect(standItems.some((i) => i.weapon)).toBe(true);
    expect(standItems.some((i) => i.ability)).toBe(true);
    expect(JSON.stringify(world().groundItems.filter((i) => i.stand))).toBe(JSON.stringify(standItems));
  });
  it('placed keys lie on the ground at stage load', () => {
    expect(world().groundItems.filter((i) => i.key).length).toBe(2);
  });
  it('9: a key chest gives the same two items whether it is opened first or last', () => {
    const a = world(), b = world();
    a.econ.keys = 3; b.econ.keys = 3;
    const [c1, c2, c3] = chests(a, 'key');
    openChest(a, c1);
    const firstA = items(a);
    for (const c of [c3, c2, c1].map((c) => chests(b, 'key').find((x) => x.objectId === c.objectId)!)) openChest(b, c);
    for (const it of firstA) expect(items(b)).toContain(it);
  });
  it('10: a key chest takes a key (+40 gold); taking one of its items removes the other on the same tick', () => {
    const w = world();
    stepSpec(w, {}, 2);
    const c = chests(w, 'key')[0];
    expect(openChest(w, c)).toBe(false);                        // no key, no Lockpick: nothing happens
    w.econ.keys = 1;
    expect(openChest(w, c)).toBe(true);
    expect(w.econ.keys).toBe(0);
    expect(w.gold).toBe(40);
    const pair = w.groundItems.filter((i) => i.chestGroup === c.objectId);
    expect(pair.length).toBe(2);
    w.teleportPlayer(pair[0].x, pair[0].y);
    stepSpec(w, {}, 30);
    stepSpec(w, { interact: true }, 1);
    expect(w.groundItems.filter((i) => i.chestGroup === c.objectId).length).toBe(0);
  });
  it('10: the Thief Lockpick is used before a key', () => {
    const w = world();
    w.setLoadout({ weapons: [newWeapon('katana'), null], abilities: [newAbility('blade_dash'), newAbility('arrow_rain')] });
    stepSpec(w, {}, 2);
    expect(w.classState.hybrid).toBe('thief');
    w.econ.keys = 1;
    openChest(w, chests(w, 'key')[0]);
    expect(w.econ.keys).toBe(1);
    expect(w.abilities.lockpickUsedThisStage).toBe(true);
  });
  it('the cursed chest: 100 gold, a cursed-table weapon (C or better), one_hit for 10 kills', () => {
    const w = world();
    openChest(w, chests(w, 'cursed')[0]);
    expect(w.gold).toBe(100);
    expect(w.econ.curse).toEqual({ id: 'one_hit', killsLeft: 10 });
    const it = w.groundItems.find((i) => i.fromChest === chests(w, 'cursed')[0].objectId)!;
    expect(['C', 'B', 'A', 'S']).toContain(it.weapon!.grade);
  });
  it('the timed chest: 80 gold and a weapon', () => {
    const w = world();
    openChest(w, chests(w, 'timed')[0]);
    expect(w.gold).toBe(80);
    expect(w.groundItems.some((i) => i.fromChest === chests(w, 'timed')[0].objectId && i.weapon)).toBe(true);
  });
  it('04-23: the same seed gives the same elite drops whatever the kill order', () => {
    const drops = (w: GameWorld) => w.enemies.filter((e) => e.def.elite).map((e) => e.drop);
    expect(drops(world('A'))).toEqual(drops(world('A')));
    const all = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((s) => JSON.stringify(drops(world(s))));
    expect(new Set(all).size).toBeGreaterThan(1);
  });
});
