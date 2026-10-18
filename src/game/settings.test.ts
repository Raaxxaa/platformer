import { expect, it } from 'vitest';
import { defaultSettings } from '../data/save.ts';
import { applySettings } from './settings.ts';
import { getUiSettings } from '../ui/inputSettings.ts';
it('applies current imported settings to sound and menus immediately', () => {
  const sound = { volume: 1 }, value = defaultSettings(); value.volume.master = 30; value.bindings.keyboard.jump = ['KeyZ', null];
  applySettings({ sound } as never, value); expect(sound.volume).toBe(0.3); expect(getUiSettings().bindings.keyboard.jump).toEqual(['KeyZ', null]);
});
