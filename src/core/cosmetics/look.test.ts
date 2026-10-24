import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK } from '../../data/cosmetics.ts';
import { clothColors, hairColors, ownedFor, validateCosmetics, validateLook } from './look.ts';

describe('the saved look (09 §2, §8, checklist 6)', () => {
  it('a missing or junk look is the default', () => {
    expect(validateLook(undefined, [])).toEqual(DEFAULT_LOOK); expect(validateLook('x', [])).toEqual(DEFAULT_LOOK);
  });
  it('an unknown race loads as human; a bad number or color falls back to its default', () => {
    const l = validateLook({ ...DEFAULT_LOOK, race: 'goblin', skin: 99, face: -1, hair: 'x', hairColor: 'neon', outfit: 'tux', colorA: 'neon' }, []);
    expect(l).toEqual(DEFAULT_LOOK);
  });
  it('skin counts follow the race (orc has 4); an orc keeps a valid skin', () => {
    expect(validateLook({ ...DEFAULT_LOOK, race: 'orc', skin: 3 }, []).skin).toBe(3);
    expect(validateLook({ ...DEFAULT_LOOK, race: 'orc', skin: 4 }, []).skin).toBe(DEFAULT_LOOK.skin);
  });
  it('a hat that is not owned loads as none; an owned one stays; a hat in the wrong slot is dropped', () => {
    expect(validateLook({ ...DEFAULT_LOOK, head: 'acc_wolf' }, []).head).toBeNull();
    expect(validateLook({ ...DEFAULT_LOOK, head: 'acc_wolf' }, ['acc_wolf']).head).toBe('acc_wolf');
    expect(validateLook({ ...DEFAULT_LOOK, head: 'cape_gold' }, ['cape_gold']).head).toBeNull();
    expect(validateLook({ ...DEFAULT_LOOK, back: 'cape_gold' }, ['cape_gold']).back).toBe('cape_gold');
  });
  it('a dye color needs its dye owned', () => {
    expect(validateLook({ ...DEFAULT_LOOK, colorA: 'crimson' }, []).colorA).toBe(DEFAULT_LOOK.colorA);
    expect(validateLook({ ...DEFAULT_LOOK, colorA: 'crimson', hairColor: 'pink' }, ['dye_crimson', 'hair_pink'])).toMatchObject({ colorA: 'crimson', hairColor: 'pink' });
  });
  it('the colors on offer are the base ones plus owned dyes', () => {
    expect(clothColors([]).length).toBe(8); expect(hairColors([]).length).toBe(6);
    expect(clothColors(['dye_teal', 'hair_blue']).map((c) => c.id)).toContain('teal'); expect(hairColors(['dye_teal', 'hair_blue']).map((c) => c.id)).toContain('blue');
    expect(ownedFor('head', ['acc_wolf', 'cape_gold', 'hat_straw'])).toEqual(['acc_wolf', 'hat_straw']);
  });
  it('the cosmetics block: junk entries dropped, duplicates removed, the intro flag defaults to false', () => {
    expect(validateCosmetics(undefined)).toEqual({ owned: [], seenEnemies: [], wardrobeIntroDone: false });
    expect(validateCosmetics({ owned: ['acc_wolf', 'acc_wolf', 'nope', 3], seenEnemies: ['wolf', 'unicorn'], wardrobeIntroDone: true })).toEqual({ owned: ['acc_wolf'], seenEnemies: ['wolf'], wardrobeIntroDone: true });
  });
});
