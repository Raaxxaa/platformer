import { describe, expect, it } from 'vitest';
import { defaultSave } from '../../data/save.ts';
import { bindKey, bindPad, canCapturePad, canCaptureKey, clearKey, isFixed } from './bindings.ts';

const base = () => structuredClone(defaultSave().settings.bindings);

describe('rebinding rules (07 §8.3)', () => {
  it('binds a free key; taking another action\'s only key into an empty cell is refused (it would be left with none)', () => {
    expect(bindKey(base(), 'jump', 1, 'KeyL')!.keyboard.jump).toEqual(['Space', 'KeyL']);
    expect(bindKey(base(), 'jump', 1, 'KeyK')).toBeNull();
  });
  it('a conflict swaps: Jump key 1 = J gives Attack 1 the old Space', () => {
    const b = bindKey(base(), 'jump', 0, 'KeyJ')!;
    expect(b.keyboard.jump[0]).toBe('KeyJ'); expect(b.keyboard.attack1[0]).toBe('Space');
  });
  it('binding a key to the other cell of the same action moves it', () => {
    const b = bindKey(base(), 'left', 1, 'KeyA')!;
    expect(b.keyboard.left).toEqual([null, 'KeyA']);
  });
  it('refuses a change that leaves an action without a keyboard key', () => {
    // Jump has only Space; moving Space to Dash's only cell would swap Dash's ShiftLeft back: allowed.
    expect(bindKey(base(), 'dash', 0, 'Space')!.keyboard.jump[0]).toBe('ShiftLeft');
    // Taking Jump's only key into Dash's empty second cell leaves Jump empty: refused.
    expect(bindKey(base(), 'dash', 1, 'Space')).toBeNull();
    expect(clearKey(base(), 'jump', 0)).toBeNull();
    expect(clearKey(base(), 'left', 1)!.keyboard.left).toEqual(['KeyA', null]);
  });
  it('fixed cells and keys/buttons that can\'t be captured', () => {
    expect(isFixed('pause', 0)).toBe(true); expect(isFixed('pause', 2)).toBe(true); expect(isFixed('left', 2)).toBe(true);
    expect(isFixed('jump', 0)).toBe(false);
    for (const k of ['Escape', 'Tab', 'MetaLeft', 'F5', 'F12', 'PrintScreen', 'ContextMenu']) expect(canCaptureKey(k)).toBe(false);
    expect(canCaptureKey('KeyK')).toBe(true);
    for (const p of [9, 12, 13, 14, 15]) expect(canCapturePad(p)).toBe(false);
    expect(canCapturePad(0)).toBe(true);
    expect(bindKey(base(), 'jump', 0, 'Escape')).toBeNull();
    expect(bindKey(base(), 'pause', 0, 'KeyO')).toBeNull();
  });
  it('gamepad cells always hold a button; a conflict swaps the two actions\' buttons', () => {
    const b = bindPad(base(), 'jump', 2)!;
    expect(b.gamepad.jump).toBe(2); expect(b.gamepad.attack1).toBe(0);
    expect(bindPad(base(), 'jump', 9)).toBeNull(); expect(bindPad(base(), 'left', 0)).toBeNull();
  });
});
