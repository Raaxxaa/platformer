import { describe, it, expect } from 'vitest';
import { KEY_BINDINGS, PAD_BUTTONS, padButtonHeld } from './devices.ts';

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
