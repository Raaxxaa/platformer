import { describe, expect, it } from 'vitest';
import { applyPracticeTime, dragonAllowed, practiceDragon, practiceKey, practiceLevels, practiceLoadout, practiceWeapons, type PracticeSetup } from './practice.ts';
import { PRACTICE_ELEMENT, PRACTICE_PRESET } from '../../data/practice.ts';

const setup = (levelId: PracticeSetup['levelId'], cls: PracticeSetup['cls'] = 'swordsman', weapon: PracticeSetup['weapon'] = 'greatsword'): PracticeSetup => ({ levelId, cls, weapon, dragon: 'off' });

describe('practice rules (06 §14)', () => {
  it('lists plains always and the rest from levelsReached, in menu order', () => {
    expect(practiceLevels(['plains'])).toEqual(['plains']);
    expect(practiceLevels(['castle', 'swamps'])).toEqual(['plains', 'swamps', 'castle']);
    expect(practiceLevels([])).toEqual(['plains']);
  });
  it('offers the third weapon only when unlocked', () => {
    expect(practiceWeapons('tank', {})).toEqual(['war_maul', 'iron_fists']);
    expect(practiceWeapons('tank', { tank: ['giant_axe'] })).toEqual(['war_maul', 'iron_fists', 'giant_axe']);
  });
  it('builds the preset rows: C weapon Lv1 in stage 1, B + class element from stage 2', () => {
    const s1 = practiceLoadout(setup('plains'));
    expect(s1.weapons[0]).toMatchObject({ weaponId: 'greatsword', grade: 'C', element: null }); expect(s1.weapons[1]).toBeNull();
    expect(s1.abilities[0]).toMatchObject({ id: 'blade_dash', level: 1 }); expect(s1.abilities[1]).toBeNull();
    const s2 = practiceLoadout(setup('mountains')); expect(s2.weapons[0]).toMatchObject({ grade: 'B', element: 'fire' }); expect(s2.abilities[0]!.level).toBe(2);
    for (const l of ['kingdom', 'castle'] as const) expect(practiceLoadout(setup(l)).abilities[0]!.level).toBe(3);
  });
  it('maps each class to its element', () => {
    expect(PRACTICE_ELEMENT).toEqual({ swordsman: 'fire', tank: 'lightning', archer: 'wind', wizard: 'lightning' });
    expect(practiceLoadout(setup('swamps', 'archer', 'bow')).weapons[0]!.element).toBe('wind');
  });
  it('keeps the table of flask, HP, gold and keys', () => {
    expect(PRACTICE_PRESET[1]).toMatchObject({ flask: 2, hp: 100, gold: 0, keys: 0 });
    expect(PRACTICE_PRESET[2]).toMatchObject({ flask: 2, keys: 1 });
    expect(PRACTICE_PRESET[3]).toMatchObject({ flask: 3, keys: 1 }); expect(PRACTICE_PRESET[4]).toMatchObject({ flask: 3, keys: 1 });
  });
  it('rolls the Dragon only for stages 2 and 3', () => {
    expect(dragonAllowed('plains')).toBe(false); expect(dragonAllowed('swamps')).toBe(true); expect(dragonAllowed('castle')).toBe(false);
    expect(practiceDragon({ ...setup('plains'), dragon: 'red' }, 0)).toBeNull();
    expect(practiceDragon(setup('kingdom'), 0)).toBeNull();
    expect(practiceDragon({ ...setup('kingdom'), dragon: 'storm' }, 0)).toEqual({ present: true, stage: 3, color: 'storm', outcome: 'absent' });
    expect(practiceDragon({ ...setup('mountains'), dragon: 'random' }, 0.99)!.color).toBe('green');
    expect(practiceDragon({ ...setup('mountains'), dragon: 'random' }, 0)!.color).toBe('red');
  });
  it('writes a practice best only when faster', () => {
    const bests: Record<string, number> = {}; const key = practiceKey('plains', 'tank');
    expect(applyPracticeTime(bests, key, 5000)).toEqual({ best: 5000, isNew: true });
    expect(applyPracticeTime(bests, key, 5000)).toEqual({ best: 5000, isNew: false });
    expect(applyPracticeTime(bests, key, 4000)).toEqual({ best: 4000, isNew: true }); expect(bests[key]).toBe(4000);
  });
});
