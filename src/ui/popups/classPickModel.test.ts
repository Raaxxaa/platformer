import { describe, expect, it } from 'vitest';
import { emptyInput } from '../../core/input.ts';
import { ClassPickModel, parseKit } from './classPickModel.ts';

const press = (f: (i: ReturnType<typeof emptyInput>) => void) => { const i = emptyInput(); f(i); return i; };

describe('class pick (07 §6.7)', () => {
  it('left/right picks the class, up/down the weapon; confirm gives the kit', () => {
    const m = new ClassPickModel(['swordsman', 'tank', 'archer', 'wizard'], null);
    m.step(press((i) => { i.moveX = 1; }));
    m.step(emptyInput());
    m.step(press((i) => { i.moveY = 1; }));
    expect(m.step(press((i) => { i.jump.pressed = true; }))).toBe('confirm');
    expect(m.kit).toEqual({ cls: 'tank', weapon: 'iron_fists' });
  });
  it('starts on the equipped kit; back closes', () => {
    const m = new ClassPickModel(['wizard'], { cls: 'wizard', weapon: 'staff' });
    expect(m.kit.weapon).toBe('staff');
    expect(m.step(press((i) => { i.pause.pressed = true; }))).toBe('close');
  });
  it('parses ?kit=', () => {
    expect(parseKit('archer:bow')).toEqual({ cls: 'archer', weapon: 'bow' });
    expect(parseKit('archer:staff')).toBeNull();
  });
});
