import { describe, expect, it } from 'vitest';
import { cardDelta, flaskFillW, hpFillW, rushFills, weaponDmg } from './hudModel.ts';

describe('HUD numbers (07 test checklist)', () => {
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
