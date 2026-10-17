import { describe, expect, it } from 'vitest';
import { newWeapon } from '../abilities/runtime.ts';
import { dropItem } from '../abilities/items.ts';
import { hurtPlayer } from '../combat/health.ts';
import { mulberry32 } from '../rng.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { applyLucky, rollLucky, stepLucky } from './lucky.ts';
import { incomingMult, extraSpeed } from './perks.ts';

const enemyHit = (dmg: number) => ({ kind: 'enemyHit' as const, enemyId: 0, enemyDefId: 'wolf', damageA: dmg, attackerCx: 0, melee: true });

describe('Lucky Block (05 §7, checklist 12–16, 29)', () => {
  it('12: buffs 55% and Jackpot 5.5% with no buffs active', () => {
    const rng = mulberry32(12);
    let buffs = 0, jackpot = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) {
      const r = rollLucky(rng, [], false);
      if (r.kind === 'buff') buffs++;
      if (r.id === 'jackpot') jackpot++;
    }
    expect(Math.abs(buffs / n - 0.55)).toBeLessThan(0.005);
    expect(Math.abs(jackpot / n - 0.055)).toBeLessThan(0.003);
  });
  it('13: an active buff is never rolled; with all 6 active, a buff roll gives Jackpot', () => {
    const rng = mulberry32(13);
    const all = ['swift', 'golden_touch', 'firestarter', 'second_wind', 'overdrive', 'bloodrush'] as const;
    for (let i = 0; i < 2000; i++) {
      const r = rollLucky(rng, ['swift'], false);
      expect(r.id).not.toBe('swift');
      const r2 = rollLucky(rng, [...all], false);
      if (r2.kind === 'buff') expect(r2.id).toBe('jackpot');
    }
  });
  it('14: Heavy rolled at 0 s and again at 30 s ends at 75 s; buffs and debuffs end on restart', () => {
    const w = arenaWorld();
    applyLucky(w, 'heavy', 0, 0);
    for (let i = 0; i < 3600; i++) stepLucky(w);
    applyLucky(w, 'heavy', 0, 0);
    for (let i = 0; i < 5399; i++) stepLucky(w);
    expect(w.econ.debuffs.map((d) => d.id)).toEqual(['heavy']);
    stepLucky(w);
    expect(w.econ.debuffs).toEqual([]);
    applyLucky(w, 'swift', 0, 0);
    w.restart();
    expect(w.econ.buffs).toEqual([]);
  });
  it('15: Glass Bones doubles a 12 hit to 24; Swift + Heavy = +0.05', () => {
    const w = arenaWorld();
    applyLucky(w, 'glass_bones', 0, 0);
    expect(incomingMult(w)).toBe(2);
    const hp = w.health.hp;
    hurtPlayer(w, enemyHit(12));
    expect(hp - w.health.hp).toBe(24);
    const v = arenaWorld();
    applyLucky(v, 'swift', 0, 0); applyLucky(v, 'heavy', 0, 0);
    expect(extraSpeed(v)).toBeCloseTo(0.05);
  });
  it('16: Second Wind at 10/100: a 30 hit sets HP to 50 and the buff is gone; the next lethal hit kills', () => {
    const w = arenaWorld();
    applyLucky(w, 'second_wind', 0, 0);
    w.health.hp = 10;
    hurtPlayer(w, enemyHit(30));
    expect(w.health.hp).toBe(50);
    expect(w.econ.buffs).not.toContain('second_wind');
    expect(w.health.iframeTicks).toBe(240);
    w.health.iframeTicks = 0;
    w.health.hp = 10;
    hurtPlayer(w, enemyHit(30));
    expect(w.health.dead).toBe(true);
  });
  it('Overdrive raises Rush to 200 and holds the floor; Jackpot drops an A or S weapon', () => {
    const w = arenaWorld();
    applyLucky(w, 'overdrive', 0, 0);
    expect(w.rush.value).toBe(200);
    expect(w.rush.floor).toBe(200);
    applyLucky(w, 'jackpot', 300, 200, 7);
    expect(['A', 'S']).toContain(w.groundItems.at(-1)!.weapon!.grade);
  });
  it('Ambush spawns wolf, wolf, bandit with spawn-in at −96 / +96 / +160', () => {
    const w = arenaWorld();
    stepSpec(w, {}, 2);
    const n0 = w.enemies.length;
    applyLucky(w, 'ambush', 0, 0);
    const pack = w.enemies.slice(n0);
    expect(pack.map((e) => e.def.id)).toEqual(['wolf', 'wolf', 'bandit']);
    expect(pack.map((e) => Math.round(e.x - w.body.x))).toEqual([-96, 96, 160]);
    expect(pack.every((e) => e.spawnInTicks > 0 && e.aware)).toBe(true);
  });
  it('Leaky Pockets drops coins on a hit that lands', () => {
    const w = arenaWorld();
    w.econ.goldTenths = 2000;
    applyLucky(w, 'leaky_pockets', 0, 0);
    hurtPlayer(w, enemyHit(5));
    expect(w.gold).toBe(180);
    expect(w.coins.length).toBe(4);
  });
  it('Dry Flask refuses a drink; Jammed doubles the dash cooldown', () => {
    const w = arenaWorld();
    stepSpec(w, {}, 2);
    w.health.hp = 50;
    applyLucky(w, 'dry_flask', 0, 0);
    expect(stepSpec(w, { heal: true }, 1).some((e) => e.t === 'healRefused')).toBe(true);
    applyLucky(w, 'jammed', 0, 0);
    stepSpec(w, {}, 1);
    expect(w.mods.dashCooldownMult).toBe(2);
  });
  it('29: Butterfingers with slot 1 full and slot 2 empty: interact opens the choice with slot 1 only; slot 2 stays empty', () => {
    const w = arenaWorld();
    w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [null, null] });
    stepSpec(w, {}, 2);
    applyLucky(w, 'butterfingers', 0, 0);
    dropItem(w, w.body.x, w.body.y, { weapon: newWeapon('katana') });
    stepSpec(w, {}, 3);
    stepSpec(w, { interact: true }, 1);
    expect(w.weaponSwapChoice).not.toBeNull();
    stepSpec(w, { attack2: true }, 1);                         // refused
    expect(w.combat.slots[1]).toBeNull();
    expect(w.weaponSwapChoice).not.toBeNull();
    stepSpec(w, { attack1: true }, 1);
    expect(w.combat.slots[0]?.weaponId).toBe('katana');
    // After it ends, the same pickup goes straight into slot 2.
    w.econ.debuffs = [];
    w.groundItems = [];
    dropItem(w, w.body.x, w.body.y, { weapon: newWeapon('bow') });
    stepSpec(w, {}, 3);
    stepSpec(w, { interact: true }, 1);
    expect(w.combat.slots[1]?.weaponId).toBe('bow');
  });
});

describe('curses (05 §8, checklist 17)', () => {
  it('17: cursed at 100 HP a 1 hit kills; after 10 player kills the curse lifts and a 12 hit leaves 88', async () => {
    const { onCurseKill } = await import('./lucky.ts');
    const w = arenaWorld();
    w.econ.curse = { id: 'one_hit', killsLeft: 10 };
    const v = arenaWorld();
    v.econ.curse = { id: 'one_hit', killsLeft: 10 };
    hurtPlayer(v, enemyHit(1));
    expect(v.health.dead).toBe(true);
    for (let i = 0; i < 10; i++) onCurseKill(w);
    expect(w.econ.curse).toBeNull();
    hurtPlayer(w, enemyHit(12));
    expect(w.health.hp).toBe(88);
  });
});
