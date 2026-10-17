import { describe, expect, it } from 'vitest';
import { bannerFor, debuffLabel, effectsRow, toastFor } from './lootHud.ts';
import { newEconomy } from '../../core/economy/gold.ts';

describe('loot HUD model (07 §4.7, §6.8, §6.10)', () => {
  it('debuff sub-label = ceil(ticksLeft / 120) (07 checklist 5)', () => {
    expect(debuffLabel(5400)).toBe('45');
    expect(debuffLabel(1)).toBe('1');
  });
  it('orders curse, then debuffs by first application, then buffs', () => {
    const e = newEconomy();
    e.buffs = ['swift', 'bloodrush'];
    e.debuffs = [{ id: 'jammed', ticksLeft: 600 }, { id: 'heavy', ticksLeft: 5400 }];
    e.curse = { id: 'one_hit', killsLeft: 7 };
    const row = effectsRow(e);
    expect(row.map((r) => r.icon)).toEqual(['effect_curse_one_hit', 'effect_jammed', 'effect_heavy', 'effect_swift', 'effect_bloodrush']);
    expect(row.map((r) => r.label)).toEqual(['7', '5', '45', '', '']);
    expect(row.map((r) => r.tone)).toEqual(['curse', 'bad', 'bad', 'good', 'good']);
    expect(row[1].blink).toBe(true);
    expect(row[2].blink).toBe(false);
  });
  it('banners and toasts', () => {
    expect(bannerFor({ t: 'luckyResult', id: 'swift' })).toEqual({ l1: 'SWIFT', l2: '+25% move speed this stage', tone: 'good', s: 1.6 });
    expect(bannerFor({ t: 'luckyResult', id: 'jammed' })?.tone).toBe('bad');
    expect(bannerFor({ t: 'luckyResult', id: 'jackpot' })).toMatchObject({ l1: 'JACKPOT!', tone: 'S' });
    expect(bannerFor({ t: 'curseApplied', id: 'one_hit' })).toEqual({ l1: 'CURSED', l2: 'You die in one hit until 10 kills', tone: 'curse', s: 2.0 });
    expect(bannerFor({ t: 'curseLifted' })).toEqual({ l1: 'CURSE LIFTED', l2: '', tone: 'good', s: 1.2 });
    expect(toastFor({ t: 'keysFull' })).toEqual({ text: 'Keys full (3)', tone: 'textDim', s: 2.0 });
    expect(toastFor({ t: 'lockpickUsed' })).toEqual({ text: 'Lockpick used', tone: 'text', s: 2.0 });
    expect(toastFor({ t: 'purchase', what: 'x', price: 45 })).toEqual({ text: '−45', tone: 'textDim', s: 1.5 });
  });
});
