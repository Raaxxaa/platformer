import { describe, expect, it } from 'vitest';
import { ABILITIES, ABILITY_IDS, ABILITY_INFO } from './abilities.ts';
import { M4_ABILITIES, STARTING_KITS, WEAPON_CLASSES } from './classes.ts';

describe('class tags and kits (03 §2–§3)', () => {
  it('checklist 5: weapon tags and ability classes', () => {
    const ids = Object.keys(WEAPON_CLASSES);
    expect(ids.length).toBe(19);
    for (const id of ids) expect(WEAPON_CLASSES[id as keyof typeof WEAPON_CLASSES].length).toBeGreaterThanOrEqual(1);
    expect(ids.filter((id) => WEAPON_CLASSES[id as keyof typeof WEAPON_CLASSES].length > 1)).toEqual(['storm_hammer']);
    expect(ABILITY_IDS.length).toBe(17);
    for (const id of ABILITY_IDS) expect(ABILITY_INFO[id].cls === null).toBe(id === 'vampire');
  });
  it('starting kits (03 §3)', () => {
    expect(STARTING_KITS.swordsman).toEqual({ cls: 'swordsman', ability: 'blade_dash', weapons: ['greatsword', 'katana'] });
    expect(STARTING_KITS.tank).toEqual({ cls: 'tank', ability: 'shockwave', weapons: ['war_maul', 'iron_fists'] });
    expect(STARTING_KITS.archer).toEqual({ cls: 'archer', ability: 'arrow_rain', weapons: ['bow', 'crossbow'] });
    expect(STARTING_KITS.wizard).toEqual({ cls: 'wizard', ability: 'thunder_strike', weapons: ['storm_hammer', 'staff'] });
    for (const k of Object.values(STARTING_KITS)) for (const w of k.weapons) expect(WEAPON_CLASSES[w]).toContain(k.cls);
  });
});

describe('ability level rows (03 §8–§12)', () => {
  const lv = (id: keyof typeof ABILITIES, n: number) => ABILITIES[id]!.levels[n - 1];
  it('the 9 M4 abilities have 5 rows each', () => {
    for (const id of M4_ABILITIES) expect(ABILITIES[id]!.levels.length).toBe(5);
  });
  it('spot values', () => {
    expect(lv('blade_dash', 5)).toMatchObject({ damage: 82, charges: 2 });
    expect(lv('whirlwind', 3).maxHits).toBe(6);
    expect(lv('shockwave', 4).R).toBe(84);
    expect(lv('shoulder_charge', 5).stunS).toBe(1.0);
    expect(lv('arrow_rain', 5).waves).toBe(10);
    expect(lv('hunters_mark', 3).marks).toBe(2);
    expect(lv('thunder_strike', 2)).toMatchObject({ bolts: 3, damagePerBolt: 23 });
    expect(lv('blink', 5)).toMatchObject({ distancePx: 96, charges: 2 });
    expect([1, 2, 3, 4, 5].map((n) => lv('vampire', n).tenths)).toEqual([20, 25, 30, 40, 50]);
    expect(lv('blade_dash', 1).cooldownS).toBe(6);
  });
  it('cast data (03 §7.6)', () => {
    expect(ABILITIES.shockwave).toMatchObject({ startupS: 0.20, recoveryS: 0.25, groundMoveCap: 0, airHover: true, airGravityMult: 0.5 });
    expect(ABILITIES.arrow_rain).toMatchObject({ startupS: 0.15, recoveryS: 0.15, groundMoveCap: 0.5, airGravityMult: 0.5, airHover: false });
    expect(ABILITIES.thunder_strike).toMatchObject({ startupS: 0.15, recoveryS: 0.20, groundMoveCap: 0.3, airGravityMult: 0.3, airHover: false });
  });
});
