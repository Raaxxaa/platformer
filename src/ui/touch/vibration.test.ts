import { describe, expect, it } from 'vitest';
import { vibrationFor } from './vibration.ts';
import { defaultTouchSettings } from '../../data/touch.ts';

describe('vibration (07 §8.6)', () => {
  const hit = { t: 'hit', target: 'player', amount: 5, crit: false, heavy: false } as const;
  it('12 ms when the player is hit, 25 on death; enemy hits and other events do nothing', () => {
    const on = defaultTouchSettings();
    expect(vibrationFor([hit], on, true)).toBe(12);
    expect(vibrationFor([{ t: 'playerDied', cause: 'x' }], on, true)).toBe(25);
    expect(vibrationFor([hit, { t: 'playerDied', cause: 'x' }], on, true)).toBe(25);
    expect(vibrationFor([{ ...hit, target: 3 }, { t: 'drink' }], on, true)).toBeNull();
  });
  it('never when off, in menus, or when the last device is not touch', () => {
    expect(vibrationFor([hit], { ...defaultTouchSettings(), vibration: false }, true)).toBeNull();
    expect(vibrationFor([hit], defaultTouchSettings(), false)).toBeNull();
  });
});
