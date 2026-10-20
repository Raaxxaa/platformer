import { describe, expect, it } from 'vitest';
import { RecordsModel } from './records.ts';
import { defaultSave } from '../../data/save.ts';

describe('records menu (07 §7.5)', () => {
  it('shows4 starting classes and2 Road keys with each selected cell’s4 best segments', () => {
    const save = defaultSave(); save.pbs['tank|forest'] = { ticks: 12000, splits: [1000, 3000, 6000, 12000], date: '2026-01-01T00:00:00.000Z', seedText: 'ABC', kit: { displayName: 'Tank', weapons: [], abilities: [] } };
    save.bestSegments['tank|forest'] = [1000, null, 3000, 6000]; const m = new RecordsModel(() => save);
    expect(m.bestRows.map((row) => row.name)).toEqual(['Swordsman', 'Tank', 'Archer', 'Wizard']);
    expect(m.bestRows[1].times).toEqual(['—', '1:40.00']); m.selectCell(3);
    expect(m.selectedKey).toBe('tank|forest'); expect(m.segments).toEqual(['0:08.33', '—', '0:25.00', '0:50.00']);
  });
  it('uses left/right for tabs without wrapping; up/down chooses cells then the Back footer', () => {
    const m = new RecordsModel(defaultSave); m.action('left'); expect(m.tab).toBe(0);
    for (let i = 0; i < 8; i++) m.action('down'); expect(m.footer).toBe(true); expect(m.action('confirm')).toBe('close');
    m.action('up'); expect(m.footer).toBe(false); expect(m.cell).toBe(7);
    m.action('right'); m.action('right'); m.action('right'); expect(m.tab).toBe(2); expect(m.footer).toBe(true);
    expect(m.action('back')).toBe('close');
  });
  it('shows names/colors only for discovered bonds/hybrids in a10-entry grid', () => {
    const save = defaultSave(); save.progress.classesDiscovered = ['iron_will', 'arcane_archer'];
    const m = new RecordsModel(() => save); expect(m.classes).toHaveLength(10);
    expect(m.classes.find((entry) => entry.id === 'iron_will')).toMatchObject({ name: 'Iron Will', discovered: true });
    expect(m.classes.find((entry) => entry.id === 'arcane_archer')).toMatchObject({ name: 'Arcane Archer', discovered: true });
    expect(m.classes.find((entry) => entry.id === 'blademaster')).toMatchObject({ name: '???', discovered: false });
  });
  it('shows9 blueprint silhouettes and real names plus Not ready for unlocked unbuilt items', () => {
    const save = defaultSave(); save.unlocks.blueprints = ['scythe', 'time_slow']; save.unlocks.startWeapons.tank = ['giant_axe'];
    const m = new RecordsModel(() => save); expect(m.unlocks).toHaveLength(9);
    expect(m.unlocks.find((entry) => entry.id === 'scythe')).toMatchObject({ name: 'Scythe', unlocked: true, ready: false });
    expect(m.unlocks.find((entry) => entry.id === 'time_slow')).toMatchObject({ name: 'Time Slow', unlocked: true, ready: true });
    expect(m.unlocks.find((entry) => entry.id === 'flail')).toMatchObject({ name: '???', unlocked: false });
    expect(m.starters[1]).toContain('Giant Axe'); expect(m.starters[1]).toContain('Not ready'); expect(m.starters[0]).toBe('Beat the King as Swordsman');
    save.unlocks.blueprints.push('flail'); expect(m.unlocks.find((entry) => entry.id === 'flail')?.unlocked).toBe(true);
  });
});
