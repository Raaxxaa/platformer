import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '../core/save/schema.ts';
import { applyUiSettings, actionLabel, menuConfirmKey, noteInputDevice, shownPromptStyle, keyLabel, fixedMenuAction, menuPauseKey } from './inputSettings.ts';
import { HomePanelInput } from './home/homePanels.ts';
beforeEach(() => applyUiSettings(defaultSettings()));
describe('live settings and bound prompts (07 §8)', () => {
  it('keeps every fixed menu meaning ahead of an imported pause binding', () => {
    const s = defaultSettings(); s.bindings.keyboard.pause = ['Escape', 'KeyA']; applyUiSettings(s);
    expect(fixedMenuAction('KeyA')).toBe('left'); expect(menuPauseKey('KeyA')).toBe(false); expect(menuPauseKey('Escape')).toBe(false);
    s.bindings.keyboard.pause = ['Escape', 'KeyT']; applyUiSettings(s); expect(menuPauseKey('KeyT')).toBe(true);
    for (const code of ['KeyW', 'Space', 'Backspace', 'Enter', 'ArrowUp']) { s.bindings.keyboard.pause = ['Escape', code]; applyUiSettings(s); expect(menuPauseKey(code)).toBe(false); }
  });
  it('uses imported Jump/Interact confirms in menus while fixed menu keys win', () => {
    const settings = defaultSettings(); settings.bindings.keyboard.jump = ['KeyZ', null]; settings.bindings.keyboard.interact = ['Backspace', null]; applyUiSettings(settings);
    expect(menuConfirmKey('KeyZ')).toBe(true); expect(menuConfirmKey('KeyE')).toBe(false);
    const menu = new HomePanelInput('training'); menu.key('KeyZ', true); expect(menu.poll(0)).toEqual(['confirm']); menu.clear(); menu.key('Backspace', true); expect(menu.poll(0)).toEqual(['back']);
    const seed = new HomePanelInput('seed'); seed.key('KeyZ', true); expect(seed.poll(0)).toEqual([{ text: 'Z' }]);
  });
  it('shows current binding labels and the chosen icon style; Auto follows the last input device', () => {
    const settings = defaultSettings(); settings.bindings.keyboard.attack1 = ['KeyZ', null]; applyUiSettings(settings); noteInputDevice('keyboard');
    expect(actionLabel('attack1')).toBe('Z'); noteInputDevice('gamepad', 'DualSense'); expect(shownPromptStyle()).toBe('playstation'); expect(actionLabel('attack1')).toBe('□');
    settings.promptStyle = 'xbox'; applyUiSettings(settings); expect(actionLabel('attack1')).toBe('X'); noteInputDevice('keyboard'); expect(shownPromptStyle()).toBe('xbox');
    expect(actionLabel('left')).toBe('←'); expect(actionLabel('down')).toBe('↓');
  });
  it('uses exact compact and readable keyboard labels', () => {
    expect(keyLabel('Space')).toBe('SPC'); expect(keyLabel('ShiftRight')).toBe('RSH'); expect(keyLabel('Numpad5')).toBe('N5'); expect(keyLabel('ArrowLeft', true)).toBe('Left Arrow');
  });
});
