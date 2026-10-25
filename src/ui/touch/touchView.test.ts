import { describe, expect, it } from 'vitest';
import { newAbility, newWeapon } from '../../core/abilities/runtime.ts';
import { dropItem } from '../../core/abilities/items.ts';
import { arenaWorld, stepSpec } from '../../core/testkit/combatWorld.ts';
import { touchHudView } from './touchView.ts';

function world() {
  const w = arenaWorld();
  w.setLoadout({ weapons: [{ ...newWeapon('greatsword'), grade: 'B' }, null], abilities: [newAbility('blade_dash'), null] });
  stepSpec(w, {}, 2);
  return w;
}
describe('touch HUD view (07 §4.8, §4.9, §5.7)', () => {
  it('weapon icons with a grade color, an empty slot dimmed, abilities with their icon', () => {
    const v = touchHudView(world());
    expect(v.attack1).toMatchObject({ icon: 'icon_weapon_greatsword', dim: false }); expect(v.attack1.ring).toBe(0x4a9dff);
    expect(v.attack2).toMatchObject({ icon: null, dim: true });
    expect(v.ability1.icon).toBe('icon_ability_blade_dash'); expect(v.ability2.icon).toBeNull();
  });
  it('an ability with no charge shows the shade fraction and whole seconds, like the HUD', () => {
    const w = world(); const s = w.abilities.slots[0]!; s.charges = 0; s.rechargeLeft = 240;
    const v = touchHudView(w); expect(v.ability1.shade).toBeGreaterThan(0); expect(v.ability1.shade).toBeLessThanOrEqual(1); expect(v.ability1.seconds).toBeGreaterThan(0);
  });
  it('the flask shows its charge count; Interact appears only with a target and names the action', () => {
    const w = world();
    expect(touchHudView(w).heal).toBe(w.flask.charges); expect(touchHudView(w).interact).toBeNull();
    const it = dropItem(w, w.body.x, w.body.y, { weapon: newWeapon('katana') });
    stepSpec(w, {}, 2);
    expect(it).toBeDefined(); expect(touchHudView(w).interact).toBe('Take');
  });
});

describe('the Interact word (07 §8.6)', () => {
  it('objects without a prompt of their own get a word by kind; a locked chest hides the button', async () => {
    const { interactWord } = await import('../model/prompt.ts');
    expect(interactWord('class_statue')).toBe('Choose'); expect(interactWord('inn')).toBe('Sleep'); expect(interactWord('whatever')).toBe('Use');
  });
});
