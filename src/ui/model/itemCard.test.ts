import { afterEach, describe, expect, it } from 'vitest';
import { newAbility, newWeapon } from '../../core/abilities/runtime.ts';
import { dropItem } from '../../core/abilities/items.ts';
import { arenaWorld, stepSpec } from '../../core/testkit/combatWorld.ts';
import { itemCard } from './itemCard.ts';
import { defaultSettings } from '../../data/save.ts';
import { applyUiSettings, noteInputDevice } from '../inputSettings.ts';
afterEach(() => { applyUiSettings(defaultSettings()); noteInputDevice('keyboard'); });

function world(abilities: [string | null, string | null], weapons: [string | null, string | null]) {
  const w = arenaWorld();
  w.setLoadout({
    weapons: weapons.map((x) => (x ? newWeapon(x as never) : null)) as never,
    abilities: abilities.map((x) => (x ? newAbility(x as never) : null)) as never,
  });
  stepSpec(w, {}, 2);
  return w;
}

describe('item card (07 §6.1)', () => {
  it('a weapon with both slots full: one row per slot with DMG and the difference', () => {
    const w = world(['blade_dash', null], ['greatsword', 'war_maul']);
    const it = dropItem(w, 300, 320, { weapon: { ...newWeapon('katana'), grade: 'B' } });
    const c = itemCard(w, it);
    expect(c.name).toBe('Katana');
    expect(c.badge).toBe('B');
    expect(c.row2).toBe('Katana');
    expect(c.dmg).toEqual({ value: 156, matched: true });
    expect(c.options.map((o) => o.text)).toEqual(['[J] Greatsword C  DMG 125', '[K] War Maul C  DMG 100']);
    expect(c.options.map((o) => o.delta)).toEqual([{ text: '+31', tone: 'good' }, { text: '+56', tone: 'good' }]);
    expect(c.bottom).toBe('[E] Swap');
  });
  it('a weapon with an empty slot: Take', () => {
    const w = world([null, null], ['greatsword', null]);
    const c = itemCard(w, dropItem(w, 300, 320, { weapon: newWeapon('bow') }));
    expect(c.options).toEqual([]);
    expect(c.bottom).toBe('[E] Take');
  });
  it('an ability with an empty slot shows the class after; the bond if it would be on', () => {
    const w = world(['blade_dash', null], ['greatsword', null]);
    const c = itemCard(w, dropItem(w, 300, 320, { ability: newAbility('whirlwind') }));
    expect(c.badge).toBe('Lv 1');
    expect(c.row2).toBe('Swordsman ability');
    expect(c.blurb).toBe('Spin forward through enemies');
    expect(c.options[0]).toMatchObject({ text: '→ Swordsman', after: { color: 'swordsman', bond: 'Blademaster' } });
  });
  it('the same ability carried; both slots full; Vampire', () => {
    const w = world(['blade_dash', 'whirlwind'], ['greatsword', null]);
    expect(itemCard(w, dropItem(w, 300, 320, { ability: newAbility('blade_dash') })).options[0].text).toBe('Replaces your Lv 1 copy');
    const c = itemCard(w, dropItem(w, 300, 320, { ability: newAbility('arrow_rain') }));
    expect(c.options.map((o) => o.text)).toEqual(['[U] Blade Dash Lv 1 → Thief', '[I] Whirlwind Lv 1 → Thief']);
    expect(itemCard(w, dropItem(w, 300, 320, { ability: newAbility('vampire') })).row2).toBe('Neutral · always on');
  });
  it('(no change) when the class would stay the same', () => {
    const w = world(['blade_dash', null], [null, null]);
    expect(itemCard(w, dropItem(w, 300, 320, { ability: newAbility('vampire') })).options[0]).toMatchObject({ text: '(no change)', after: null });
  });
});

describe('item card with loot (M5)', () => {
  it('names the item (05 §4.5), lists element and perk words, and prices shop items', () => {
    const w = world(['blade_dash', null], ['greatsword', null]);
    const it = dropItem(w, 300, 320, { weapon: { ...newWeapon('katana'), grade: 'A', element: 'fire', perk: 'keen' } });
    it.price = 45;
    const c = itemCard(w, it);
    expect(c.name).toBe('Fire Katana');
    expect(c.row2).toBe('Katana · Fire · Keen');
    expect(c.bottom).toBe('[E] Buy 45');
    const ab = dropItem(w, 300, 320, { ability: newAbility('blade_dash') });
    ab.price = 60;
    const ca = itemCard(w, ab);
    expect(ca.bottom).toBe('Owned');
    expect(ca.bottomTone).toBe('bad');
  });
});

describe('current item-card action bindings (07 §8.4)', () => {
  it('uses imported weapon, ability and interact keys while retaining action metadata for drawn glyphs', () => {
    const settings = defaultSettings(); settings.bindings.keyboard.attack1 = ['KeyZ', null]; settings.bindings.keyboard.attack2 = ['KeyX', null];
    settings.bindings.keyboard.ability1 = ['KeyC', null]; settings.bindings.keyboard.ability2 = ['KeyV', null]; settings.bindings.keyboard.interact = ['KeyF', null]; applyUiSettings(settings);
    const w = world(['blade_dash', 'whirlwind'], ['greatsword', 'war_maul']);
    const weapon = itemCard(w, dropItem(w, 300, 320, { weapon: newWeapon('katana') }));
    expect(weapon.options.map((option) => option.text.slice(0, 3))).toEqual(['[Z]', '[X]']); expect(weapon.options.map((option) => option.action)).toEqual(['attack1', 'attack2']);
    expect(weapon.bottom).toBe('[F] Swap'); expect(weapon.bottomAction).toBe('interact');
    const ability = itemCard(w, dropItem(w, 300, 320, { ability: newAbility('arrow_rain') }));
    expect(ability.options.map((option) => option.text.slice(0, 3))).toEqual(['[C]', '[V]']); expect(ability.options.map((option) => option.action)).toEqual(['ability1', 'ability2']);
  });
  it('uses forced pad labels, and Owned has no active pickup prompt', () => {
    const settings = defaultSettings(); settings.promptStyle = 'playstation'; applyUiSettings(settings);
    const w = world(['blade_dash', null], ['greatsword', 'war_maul']), weapon = itemCard(w, dropItem(w, 300, 320, { weapon: newWeapon('katana') }));
    expect(weapon.options[0].text).toMatch(/^\[□\]/); expect(weapon.bottom).toBe('[○] Swap');
    const owned = itemCard(w, dropItem(w, 300, 320, { ability: newAbility('blade_dash'), price: 120 }));
    expect(owned.bottom).toBe('Owned'); expect(owned.bottomAction).toBeUndefined();
  });
});
