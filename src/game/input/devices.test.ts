import { afterEach, describe, it, expect, vi } from 'vitest';
import { Devices, KEY_BINDINGS, PAD_BUTTONS, padButtonHeld } from './devices.ts';
import { defaultSettings } from '../../data/save.ts';

describe('default controls (07 §8.1)', () => {
  it('maps the default keys by KeyboardEvent.code', () => {
    expect(KEY_BINDINGS.get('KeyA')).toBe('left');
    expect(KEY_BINDINGS.get('ArrowLeft')).toBe('left');
    expect(KEY_BINDINGS.get('KeyD')).toBe('right');
    expect(KEY_BINDINGS.get('ArrowRight')).toBe('right');
    expect(KEY_BINDINGS.get('KeyW')).toBe('up');
    expect(KEY_BINDINGS.get('ArrowUp')).toBe('up');
    expect(KEY_BINDINGS.get('KeyS')).toBe('down');
    expect(KEY_BINDINGS.get('ArrowDown')).toBe('down');
    expect(KEY_BINDINGS.get('Space')).toBe('jump');
    expect(KEY_BINDINGS.get('ShiftLeft')).toBe('dash');
    expect(KEY_BINDINGS.get('KeyJ')).toBe('attack1');
    expect(KEY_BINDINGS.get('KeyK')).toBe('attack2');
    expect(KEY_BINDINGS.get('KeyU')).toBe('ability1');
    expect(KEY_BINDINGS.get('KeyI')).toBe('ability2');
    expect(KEY_BINDINGS.get('KeyQ')).toBe('heal');
    expect(KEY_BINDINGS.get('KeyE')).toBe('interact');
    expect(KEY_BINDINGS.get('KeyR')).toBe('restart');
    expect(KEY_BINDINGS.get('Escape')).toBe('pause');
    expect(KEY_BINDINGS.get('KeyP')).toBe('pause');
  });
  it('maps the standard gamepad buttons', () => {
    expect(PAD_BUTTONS).toMatchObject({ 0: 'jump', 1: 'interact', 2: 'attack1', 3: 'attack2', 4: 'heal', 5: 'dash', 6: 'ability1', 7: 'ability2', 8: 'restart', 9: 'pause', 12: 'up', 13: 'down', 14: 'left', 15: 'right' });
  });
  it('triggers (6, 7) count as held at value >= 0.5; other buttons use pressed (07 §8.2)', () => {
    expect(padButtonHeld(6, { pressed: true, value: 0.3 })).toBe(false);
    expect(padButtonHeld(6, { pressed: false, value: 0.5 })).toBe(true);
    expect(padButtonHeld(7, { pressed: true, value: 0.49 })).toBe(false);
    expect(padButtonHeld(0, { pressed: true, value: 0 })).toBe(true);
    expect(padButtonHeld(0, { pressed: false, value: 1 })).toBe(false);
  });
});

const keyboard = () => {
  const events = new Map<string, (event: any) => void>();
  vi.stubGlobal('window', { addEventListener: (name: string, fn: (event: any) => void) => events.set(name, fn), removeEventListener: (name: string) => events.delete(name) });
  return { key: (code: string, down: boolean, repeat = false) => events.get(down ? 'keydown' : 'keyup')?.({ code, repeat, preventDefault: vi.fn() }), blur: () => events.get('blur')?.({}) };
};
afterEach(() => vi.unstubAllGlobals());
describe('multiple current keyboard bindings', () => {
  it('keeps Jump held until both imported Z and X bindings are released', () => {
    const kb = keyboard(), bindings = defaultSettings().bindings; bindings.keyboard.jump = ['KeyZ', 'KeyX']; const devices = new Devices(bindings);
    kb.key('KeyZ', true); expect(devices.builder.build().jump).toEqual({ held: true, pressed: true, released: false });
    kb.key('KeyX', true); expect(devices.builder.build().jump).toEqual({ held: true, pressed: false, released: false });
    kb.key('KeyZ', false); expect(devices.builder.build().jump).toEqual({ held: true, pressed: false, released: false });
    kb.key('KeyX', false); expect(devices.builder.build().jump).toEqual({ held: false, pressed: false, released: true }); devices.destroy();
  });
  it('keeps a direction held while its second key remains down', () => {
    const kb = keyboard(), devices = new Devices(); kb.key('KeyA', true); kb.key('ArrowLeft', true); expect(devices.builder.build().moveX).toBe(-1);
    kb.key('KeyA', false); expect(devices.builder.build().moveX).toBe(-1); kb.key('ArrowLeft', false); expect(devices.builder.build().moveX).toBe(0); devices.destroy();
  });
  it('clears tracked codes on blur, disable and binding replacement', () => {
    const kb = keyboard(), bindings = defaultSettings().bindings; bindings.keyboard.jump = ['KeyZ', 'KeyX']; const devices = new Devices(bindings);
    kb.key('KeyZ', true); kb.key('KeyX', true); devices.builder.build(); kb.blur(); expect(devices.builder.build().jump.held).toBe(false);
    kb.key('KeyZ', true); devices.builder.build(); kb.key('KeyZ', false); expect(devices.builder.build().jump.held).toBe(false);
    kb.key('KeyX', true); devices.setEnabled(false); devices.builder.build(); devices.setEnabled(true); kb.key('KeyZ', true); devices.builder.build(); kb.key('KeyZ', false);
    expect(devices.builder.build().jump.held).toBe(false);
    kb.key('KeyX', true); devices.builder.build(); const changed = defaultSettings().bindings; changed.keyboard.jump = ['KeyC', null]; devices.setBindings(changed); devices.builder.build();
    kb.key('KeyC', true); devices.builder.build(); kb.key('KeyC', false); expect(devices.builder.build().jump.held).toBe(false); devices.destroy();
  });
  it('uses a fresh imported pause key T and ignores the old unbound P', () => {
    const kb = keyboard(), bindings = defaultSettings().bindings; bindings.keyboard.pause = ['Escape', 'KeyT']; const devices = new Devices(bindings);
    kb.key('KeyP', true); expect(devices.builder.build().pause.held).toBe(false); kb.key('KeyT', true); expect(devices.builder.build().pause.pressed).toBe(true);
    kb.key('KeyT', false); expect(devices.builder.build().pause.released).toBe(true); devices.destroy();
  });
  it('keeps the physical pause key edge through keyup so fixed menu meanings can win', () => {
    const kb = keyboard(), bindings = defaultSettings().bindings; bindings.keyboard.pause = ['Escape', 'KeyA']; const devices = new Devices(bindings);
    kb.key('KeyA', true); kb.key('KeyA', false); expect(devices.takePauseKey()).toBe('KeyA'); expect(devices.takePauseKey()).toBeNull();
    expect(devices.builder.build().pause.pressed).toBe(true); devices.destroy();
  });
});
