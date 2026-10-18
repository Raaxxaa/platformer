import { describe, expect, it } from 'vitest';
import { newAbility } from '../../core/abilities/runtime.ts';
import { arenaWorld } from '../../core/testkit/combatWorld.ts';
import { interactPrompt } from './prompt.ts';
import { serviceTag } from '../popups/shop.ts';
import { upgradeAt } from '../../core/loot/merchant.ts';

const ia = (kind: string, label = '0') => ({ id: 1, x: 0, y: 0, kind, label, use: () => {} });

describe('interact prompts (07 §5.7, §6.4)', () => {
  it('chests', () => {
    const w = arenaWorld();
    expect(interactPrompt(w, ia('key_chest'))).toEqual({ l1: 'Locked', tone: 'textDim', glyph: false });
    w.econ.keys = 1;
    expect(interactPrompt(w, ia('key_chest'))).toEqual({ l1: 'Open (1 key)', tone: 'text', glyph: true });
    expect(interactPrompt(w, ia('cursed_chest'))).toEqual({ l1: 'Open', l2: 'Cursed: one-hit death for 10 kills', tone: 'curse', glyph: true });
    expect(interactPrompt(w, ia('timed_chest'))).toEqual({ l1: 'Open', tone: 'text', glyph: true });
  });
  it('merchant altars', () => {
    const w = arenaWorld();
    w.abilities.slots[0] = null;
    expect(interactPrompt(w, ia('merchant_altar'))).toEqual({ l1: 'No ability', tone: 'textOff', glyph: false });
    w.abilities.slots[0] = newAbility('blink');
    expect(interactPrompt(w, ia('merchant_altar'))).toEqual({ l1: 'Upgrade Blink Lv 1 → 2 (100)', tone: 'text', glyph: true });
    w.abilities.slots[0]!.level = 5;
    expect(interactPrompt(w, ia('merchant_altar'))).toEqual({ l1: 'MAX', tone: 'textDim', glyph: false });
  });
  it('Haggler merchant upgrade tag and prompt match the exact charged price', () => {
    const w = arenaWorld(); w.abilities.slots[0] = newAbility('blink', 2); w.econ.statStacks.haggler = 1; w.econ.goldTenths = 1500;
    expect(serviceTag(w, 'merchant_altar', 0).price).toBe(150);
    expect(interactPrompt(w, ia('merchant_altar'))?.l1).toContain('(150)');
    expect(upgradeAt(w, 0)).toBe(true); expect(w.gold).toBe(0); expect(w.abilities.slots[0]!.level).toBe(3);
  });
});
