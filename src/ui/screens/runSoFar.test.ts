import { describe, expect, it } from 'vitest';
import { RunSoFarModel, type RunSoFarData } from './runSoFar.ts';

const data: RunSoFarData = {
  runTicks: 14401, split1: 12000, gold: 123, kills: 42,
  kit: { displayName: 'Gladiator', weapons: [{ weaponId: 'greatsword', grade: 'B', element: null, perk: null }, null], abilities: [{ id: 'blade_dash', level: 2 }, { id: 'shockwave', level: 1 }] },
};
describe('temporary run-so-far summary', () => {
  it('shows the actual time, first split, current kit, gold and kills', () => {
    expect(new RunSoFarModel(data).lines).toEqual([
      'Time 2:00.00', 'Split 1 1:40.00', 'Class: Gladiator', 'Weapons: Greatsword B / Empty',
      'Abilities: Blade Dash Lv 2 / Shockwave Lv 1', 'Gold: 123', 'Kills: 42',
    ]);
    const m = new RunSoFarModel({ ...data, split1: null, kit: { displayName: 'No Class', weapons: [], abilities: [] } });
    expect(m.lines).toContain('Split 1 —'); expect(m.lines).toContain('Weapons: Empty'); expect(m.lines).toContain('Abilities: Empty');
  });
  it('defaults to Restart, does not wrap, and dispatches one selected action', () => {
    const m = new RunSoFarModel(data); m.action('left'); expect(m.cursor).toBe(0);
    m.action('right'); m.action('right'); m.action('right'); expect(m.cursor).toBe(2);
    expect(m.action('confirm')).toBe('title'); expect(m.action('confirm')).toBeNull();
    const home = new RunSoFarModel(data); home.select(1); expect(home.action('confirm')).toBe('homeVillage');
    expect(new RunSoFarModel(data).action('confirm')).toBe('restart');
  });
  it('Back stays on this summary and no action writes its input data', () => {
    const before = structuredClone(data), m = new RunSoFarModel(data);
    expect(m.action('back')).toBeNull(); expect(m.cursor).toBe(0); m.action('confirm'); expect(data).toEqual(before);
  });
  it('the Border ending includes the actual second cumulative split',()=>{
    const m=new RunSoFarModel({...data,split2:14400});expect(m.lines).toContain('Split 2 2:00.00');
  });
});
