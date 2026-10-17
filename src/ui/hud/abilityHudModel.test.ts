import { describe, expect, it } from 'vitest';
import { kitLoadout, newAbility, newWeapon } from '../../core/abilities/runtime.ts';
import { arenaWorld, stepSpec } from '../../core/testkit/combatWorld.ts';
import { abilitySlotViews, chargeBarW, classLine, cooldownShade, linkBarW, weaponSlotViews } from './abilityHudModel.ts';

describe('ability and weapon HUD model (07 §4.8–4.10)', () => {
  it('weapon slots: class tags, lit when that class is carried; the Storm Hammer recharge', () => {
    const w = arenaWorld();
    w.setLoadout({ weapons: [newWeapon('storm_hammer'), newWeapon('katana')], abilities: [newAbility('thunder_strike'), null] });
    const [hammer, katana] = weaponSlotViews(w);
    expect(hammer!.tags).toEqual(expect.arrayContaining(['wizard', 'tank']));
    expect(hammer!.litTags).toEqual(['wizard']);
    expect(katana!.litTags).toEqual([]);
    expect(hammer!.hammer).toEqual({ out: false, ready: true, progress: 1 });
    w.hammerLaunchTick[0] = w.tick - 120;                          // 1.0 s of the Wizard's 2.0 s
    expect(weaponSlotViews(w)[0]!.hammer!.progress).toBeCloseTo(0.5, 2);
    expect(katana!.hammer).toBeNull();
  });
  it('ability slots: class, charges, cooldown, and the link glow on the other slot', () => {
    const w = arenaWorld();
    w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [newAbility('blade_dash'), newAbility('whirlwind')] });
    stepSpec(w, {}, 2);
    const [a, b] = abilitySlotViews(w);
    expect(a).toMatchObject({ id: 'blade_dash', cls: 'swordsman', level: 1, passive: false, linkTicksLeft: null });
    expect(b!.charges).toBe(b!.maxCharges);
    stepSpec(w, { ability1: true }, 1);
    const [a2, b2] = abilitySlotViews(w);
    expect(a2!.charges).toBe(a2!.maxCharges - 1);
    expect(a2!.rechargeLeft).toBeGreaterThan(0);
    expect(a2!.linkTicksLeft).toBeNull();
    expect(b2!.linkTicksLeft).toBeGreaterThan(300);
  });
  it('the passive (Vampire) and no-link without a Connection', () => {
    const w = arenaWorld();
    w.setLoadout({ weapons: [null, null], abilities: [newAbility('vampire'), newAbility('blink')] });
    stepSpec(w, { ability2: true }, 1);
    const [v, bl] = abilitySlotViews(w);
    expect(v!.passive).toBe(true);
    expect(v!.cls).toBeNull();
    expect(v!.linkTicksLeft).toBeNull();
    expect(bl!.linkTicksLeft).toBeNull();
  });
  it('cooldown shade height and seconds; the charge bar; the link bar', () => {
    const v = { charges: 0, maxCharges: 1, rechargeLeft: 300, cooldownTicks: 600, rechargeRate: 1 };
    expect(cooldownShade(v)).toEqual({ h: 8, seconds: 3 });
    expect(cooldownShade({ ...v, charges: 1 })).toBeNull();
    expect(cooldownShade({ ...v, rechargeRate: 2 })!.seconds).toBe(2);
    expect(chargeBarW({ charges: 1, maxCharges: 2, rechargeLeft: 150, cooldownTicks: 600 })).toBe(15);
    expect(chargeBarW({ charges: 2, maxCharges: 2, rechargeLeft: 0, cooldownTicks: 600 })).toBeNull();
    expect(linkBarW(180)).toBe(12);
  });
  it('class line: name and color; bond; hybrid parts; No Class', () => {
    const w = arenaWorld();
    expect(classLine(w)).toEqual({ displayName: 'No Class', color: 'none', bondName: null, hybridParts: null });
    w.setLoadout(kitLoadout('swordsman', 'greatsword'));
    expect(classLine(w)).toMatchObject({ displayName: 'Swordsman', color: 'swordsman' });
    w.setLoadout({ weapons: [null, null], abilities: [newAbility('blade_dash'), newAbility('whirlwind')] });
    expect(classLine(w).bondName).toBe('Blademaster');
    w.setLoadout({ weapons: [null, null], abilities: [newAbility('blade_dash'), newAbility('arrow_rain')] });
    expect(classLine(w)).toEqual({ displayName: 'Thief', color: 'thief', bondName: null, hybridParts: ['swordsman', 'archer'] });
  });
});
