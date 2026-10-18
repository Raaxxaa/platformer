import { describe, expect, it } from 'vitest';
import { cardDelta, flaskFillW, hpFillW, rushFills, weaponDmg, topHudView } from './hudModel.ts';
import { arenaWorld } from '../../core/testkit/combatWorld.ts';

describe('HUD numbers (07 test checklist)', () => {
  it('packs player statuses in fixed order and keeps the Poison stack digit', () => {
    const w = arenaWorld();
    expect(topHudView(w).statuses).toEqual([]);
    w.playerStatus.rooted = 120; w.playerStatus.chilled = 120;
    w.playerStatus.poisoned = { stacks: 3, left: 120, next: 120, damageA: 3 };
    expect(topHudView(w).statuses).toEqual([{ id: 'poisoned', x: 184, stacks: 3 }, { id: 'chilled', x: 200, stacks: null }, { id: 'rooted', x: 210, stacks: null }]);
    w.playerStatus.burning = { stacks: 1, left: 120, next: 120, damageA: 4 };
    expect(topHudView(w).statuses[0]).toEqual({ id: 'burning', x: 184, stacks: null });
    expect(topHudView(w).statuses[1].x).toBe(194);
  });
  it('1: HP fill width on the 158 px fill area', () => {
    expect(hpFillW(50, 100)).toBe(79);
    expect(hpFillW(1, 208)).toBe(1);
    expect(hpFillW(0, 100)).toBe(0);
    expect(hpFillW(100, 100)).toBe(158);
  });
  it('2: Rush segment fills on the 46 px fill areas; level 3 blinks', () => {
    expect(rushFills(150)).toEqual({ w: [46, 23, 0], blink: false });
    expect(rushFills(299)).toEqual({ w: [46, 46, 45], blink: false });
    expect(rushFills(300)).toEqual({ w: [46, 46, 46], blink: true });
  });
  it('3: flask fill', () => {
    expect(flaskFillW(500)).toBe(22);
    expect(flaskFillW(999)).toBe(43);
    expect(flaskFillW(1000)).toBe(44);
    expect(flaskFillW(1400)).toBe(44);
  });
  it('8: weapon DMG and the card delta', () => {
    expect(weaponDmg('S', true)).toBe(250);
    expect(weaponDmg('C', true)).toBe(125);
    expect(weaponDmg('F', false)).toBe(80);
    expect(weaponDmg('B', true)).toBe(156);
    expect(cardDelta(156, 125)).toEqual({ text: '+31', tone: 'good' });
    expect(cardDelta(100, 125)).toEqual({ text: '-25', tone: 'bad' });
    expect(cardDelta(125, 125)).toEqual({ text: '=', tone: 'dim' });
  });
});
