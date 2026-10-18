import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../core/save/schema.ts';
import { bindingsToKeys, bindingsToPad } from './devices.ts';
describe('applied imported controls', () => {
  it('uses both custom keyboard cells and custom pad buttons while keeping D-pad movement', () => {
    const bindings = defaultSettings().bindings; bindings.keyboard.jump = ['KeyZ', 'KeyX']; bindings.gamepad.jump = 10;
    expect(bindingsToKeys(bindings).get('KeyZ')).toBe('jump'); expect(bindingsToKeys(bindings).get('Space')).toBeUndefined();
    expect(bindingsToKeys(bindings).get('KeyX')).toBe('jump'); expect(bindingsToPad(bindings)[10]).toBe('jump'); expect(bindingsToPad(bindings)[0]).toBeUndefined(); expect(bindingsToPad(bindings)[12]).toBe('up');
  });
});
