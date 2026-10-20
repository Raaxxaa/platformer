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
  it('lists the third starting weapon only once it is unlocked (05 §14.3)', () => {
    expect(new ClassPickModel(['tank'], null).weapons).toEqual(['war_maul', 'iron_fists']);
    const m = new ClassPickModel(['tank'], { cls: 'tank', weapon: 'giant_axe' }, { tank: ['giant_axe'] });
    expect(m.weapons).toEqual(['war_maul', 'iron_fists', 'giant_axe']);
    expect(m.kit).toEqual({ cls: 'tank', weapon: 'giant_axe' });
    expect(new ClassPickModel(['wizard'], null, { tank: ['giant_axe'] }).weapons).toEqual(['storm_hammer', 'staff']);
  });
  it('parses ?kit=', () => {
    expect(parseKit('archer:bow')).toEqual({ cls: 'archer', weapon: 'bow' });
    expect(parseKit('archer:staff')).toBeNull();
  });
  it('direct menu actions do not wrap and gameplay Attack/Dash never confirm or close', () => {
    const m = new ClassPickModel(['tank'], { cls: 'tank', weapon: 'war_maul' });
    m.action('up'); expect(m.wi).toBe(0);
    m.action('down'); m.action('down'); expect(m.wi).toBe(1);
    expect(m.step(press((i) => { i.attack1.pressed = true; i.dash.pressed = true; }))).toBeNull();
    expect(m.action('back')).toBe('close');
  });
});
