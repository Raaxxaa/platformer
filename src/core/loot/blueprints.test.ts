import { afterEach, describe, expect, it, vi } from 'vitest';
import { candidates, kingUnlocks, rollBlueprint, unlockedCatalog, type BlueprintId } from './blueprints.ts';
import { ABILITY_IDS } from '../../data/abilities.ts';
import { BLUEPRINT_IDS } from '../../data/save.ts';
import { WEAPONS } from '../../data/weapons.ts';
import { WEAPON_ORDER } from './roll.ts';
import * as pick from './pick.ts';

afterEach(() => vi.restoreAllMocks());

describe('frozen unlocked catalog (05 §14.1)', () => {
  it('keeps all36 known IDs in weapon-then-ability order for typed/practice runs', () => {
    const full = unlockedCatalog([], true);
    expect(full).toEqual([...WEAPON_ORDER, ...ABILITY_IDS]); expect(full).toHaveLength(36);
    expect(WEAPON_ORDER).toHaveLength(19); expect(ABILITY_IDS).toHaveLength(17);
    expect(candidates(full, [])).toEqual([]);
  });
  it('excludes exactly the9 locked IDs from the first random run; keeps starting items and Vampire', () => {
    const first = unlockedCatalog([]); expect(first).toHaveLength(27);
    expect(first).toEqual([...WEAPON_ORDER, ...ABILITY_IDS].filter((id) => !BLUEPRINT_IDS.includes(id)));
    for (const id of ['greatsword', 'war_maul', 'bow', 'storm_hammer', 'spear', 'giant_axe', 'throwing_knives', 'wand', 'vampire']) expect(first).toContain(id);
  });
  it('accepts all blueprint IDs; every weapon has a definition since M9 part 2', () => {
    const all = unlockedCatalog(BLUEPRINT_IDS); expect(all).toEqual(unlockedCatalog([], true));
    expect(all).toContain('time_slow'); expect(all).toContain('scythe');
    expect(WEAPONS.scythe).toBeDefined();
  });
  it('takes a detached snapshot: a newly saved blueprint joins the next catalog only', () => {
    const saved: BlueprintId[] = [], current = unlockedCatalog(saved);
    saved.push('scythe'); expect(current).not.toContain('scythe'); expect(unlockedCatalog(saved)).toContain('scythe');
    expect(unlockedCatalog(['scythe', 'scythe'])).toHaveLength(28);
  });
});

describe('blueprint candidates and seeded rolls (05 §14.2)', () => {
  it('uses declared weapon/ability order and excludes unlocked and already-dropped IDs, even uncollected', () => {
    expect(candidates(unlockedCatalog([]), [])).toEqual(['scythe', 'flail', 'hand_cannon', 'javelin', 'spell_tome', 'riposte', 'boulder_toss', 'turret', 'time_slow']);
    expect(candidates(unlockedCatalog(['flail', 'turret']), ['scythe', 'time_slow', 'scythe'])).toEqual(['hand_cannon', 'javelin', 'spell_tome', 'riposte', 'boulder_toss']);
  });
  it('uses the exact independent blueprint source stream and second successful draw for the candidate', () => {
    const unlocked = unlockedCatalog(['scythe']), dropped: BlueprintId[] = ['turret'], list = candidates(unlocked, dropped);
    for (let seed = 0; seed < 1000; seed++) {
      const rng = pick.sourceRng(seed, 'blueprint', 'plains', 'great_boar');
      const expected = rng() < 0.25 ? list[Math.floor(rng() * list.length)] : null;
      expect(rollBlueprint(seed, 'plains', 'great_boar', 'boss', unlocked, dropped)).toBe(expected);
      const unrelated = pick.sourceRng(seed, 'loot', 'plains', 'great_boar'); for (let i = 0; i < 20; i++) unrelated();
      expect(rollBlueprint(seed, 'plains', 'great_boar', 'boss', unlocked, dropped)).toBe(expected);
    }
  });
  it('uses strict2%/25% boundaries, one chance draw on failure and one extra pick on success', () => {
    const spy = vi.spyOn(pick, 'sourceRng'), unlocked = unlockedCatalog([]);
    for (const [kind, chance] of [['elite', 0.02], ['boss', 0.25]] as const) {
      const miss = vi.fn(() => chance); spy.mockReturnValue(miss);
      expect(rollBlueprint(7, 'swamps', 17, kind, unlocked, [])).toBeNull(); expect(miss).toHaveBeenCalledTimes(1);
      const hit = vi.fn().mockReturnValueOnce(chance - 0.00001).mockReturnValueOnce(0.99999); spy.mockReturnValue(hit);
      expect(rollBlueprint(7, 'swamps', 17, kind, unlocked, [])).toBe('time_slow'); expect(hit).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenLastCalledWith(7, 'blueprint', 'swamps', 17);
    }
  });
  it('returns no candidate and creates no RNG when every blueprint is unlocked or already dropped', () => {
    const spy = vi.spyOn(pick, 'sourceRng');
    expect(rollBlueprint(1, 'plains', 1, 'elite', unlockedCatalog(BLUEPRINT_IDS), [])).toBeNull();
    expect(rollBlueprint(1, 'plains', 1, 'boss', unlockedCatalog([]), BLUEPRINT_IDS)).toBeNull(); expect(spy).not.toHaveBeenCalled();
  });
  it('matches elite2% and boss25% rates, with uniform candidates over100000 fixed seeds', () => {
    const unlocked = unlockedCatalog([]), totals = { elite: 0, boss: 0 }, distribution = new Map<BlueprintId, number>();
    for (let seed = 0; seed < 100000; seed++) {
      if (rollBlueprint(seed, 'plains', 42, 'elite', unlocked, [])) totals.elite++;
      const drop = rollBlueprint(seed, 'plains', 'great_boar', 'boss', unlocked, []);
      if (drop) { totals.boss++; distribution.set(drop, (distribution.get(drop) ?? 0) + 1); }
    }
    expect(Math.abs(totals.elite / 100000 - 0.02)).toBeLessThan(0.002);
    expect(Math.abs(totals.boss / 100000 - 0.25)).toBeLessThan(0.005);
    expect(distribution.size).toBe(9); for (const count of distribution.values()) expect(Math.abs(count / totals.boss - 1 / 9)).toBeLessThan(0.01);
  });
});

describe('Enemy King unlocks (05 §14.2–14.3)', () => {
  it('uses the first fresh draw for the bonus pick only, with no chance draw', () => {
    const unlocked = unlockedCatalog([]), list = candidates(unlocked, []), expected = list[Math.floor(pick.sourceRng(77, 'blueprint', 'castle', 'enemy_king')() * list.length)];
    expect(kingUnlocks(77, 'tank', unlocked, [])).toEqual({ blueprint: expected, startWeapon: 'giant_axe' });
    const rng = vi.fn(() => 0.99999), spy = vi.spyOn(pick, 'sourceRng').mockReturnValue(rng);
    expect(kingUnlocks(77, 'tank', unlocked, [])).toEqual({ blueprint: 'time_slow', startWeapon: 'giant_axe' });
    expect(rng).toHaveBeenCalledTimes(1); expect(spy).toHaveBeenCalledExactlyOnceWith(77, 'blueprint', 'castle', 'enemy_king');
  });
  it('never offers a duplicate dropped blueprint; with all9 exhausted only the starting weapon remains', () => {
    const unlocked = unlockedCatalog([]), dropped: BlueprintId[] = [];
    for (let seed = 0; seed < 9; seed++) {
      const result = kingUnlocks(seed, 'tank', unlocked, dropped); expect(result.blueprint).not.toBeNull(); expect(dropped).not.toContain(result.blueprint);
      dropped.push(result.blueprint!);
    }
    expect(kingUnlocks(10, 'tank', unlocked, dropped)).toEqual({ blueprint: null, startWeapon: 'giant_axe' });
  });
  it.each([['swordsman', 'spear'], ['tank', 'giant_axe'], ['archer', 'throwing_knives'], ['wizard', 'wand']] as const)('offers %s starting unlock in normal and typed runs, never practice', (cls, weapon) => {
    const unlocked = unlockedCatalog([]);
    expect(kingUnlocks(1, cls, unlocked, []).startWeapon).toBe(weapon);
    expect(kingUnlocks(1, cls, unlocked, [], true)).toEqual({ blueprint: null, startWeapon: weapon });
    expect(kingUnlocks(1, cls, unlocked, [], false, true)).toEqual({ blueprint: null, startWeapon: null });
    expect(kingUnlocks(1, cls, unlocked, [], true, true)).toEqual({ blueprint: null, startWeapon: null });
  });
  it('never mutates the saved catalog or dropped list; repeated calls return the same intent', () => {
    const unlocked = unlockedCatalog(['scythe']), dropped: BlueprintId[] = ['flail'], before = structuredClone({ unlocked, dropped });
    expect(kingUnlocks(42, 'tank', unlocked, dropped)).toEqual(kingUnlocks(42, 'tank', unlocked, dropped));
    expect({ unlocked, dropped }).toEqual(before);
  });
});
