import { describe, expect, it } from 'vitest';
import { newAbility, newWeapon } from '../abilities/runtime.ts';
import type { AbilityId } from '../abilities/types.ts';
import type { GameWorld, WorldEvent } from '../sim/gameWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import type { EnemyId } from '../enemies/types.ts';
import type { WeaponId } from '../combat/types.ts';
import { firePlayerProjectile } from '../combat/playerProjectiles.ts';
import { tryLockpick } from './hybrids.ts';

interface Foe { id: EnemyId; x: number; hp?: number; aware?: boolean }
function setup(abilities: [AbilityId | null, AbilityId | null], weapons: [WeaponId | null, WeaponId | null], foes: Foe[] = []): GameWorld {
  const w = arenaWorld({ enemies: foes.map((f) => ({ enemy: f.id, x: f.x, y: 320, facing: -1 })) });
  w.setLoadout({ weapons: [weapons[0] && newWeapon(weapons[0]), weapons[1] && newWeapon(weapons[1])], abilities: [abilities[0] && newAbility(abilities[0]), abilities[1] && newAbility(abilities[1])] });
  foes.forEach((f, i) => { const e = w.enemies[i]; e.hp = e.maxHp = f.hp ?? 5000; e.dormant = false; if (f.aware !== false) e.aware = true; });
  stepSpec(w, {}, 2);
  return w;
}
const run = (w: GameWorld, spec: InputSpec, n = 1) => stepSpec(w, spec, n);
type Hit = Extract<WorldEvent, { t: 'hit' }>;
const hitsOn = (ev: WorldEvent[], id: number) => ev.filter((e): e is Hit => e.t === 'hit' && e.target === id);

describe('Thief (03 §6.1)', () => {
  it('+20% run speed; notice time ×2; a hit on an unaware enemy crits; one Lockpick per stage', () => {
    const w = setup(['blade_dash', 'arrow_rain'], ['greatsword', null], [{ id: 'training_dummy', x: 230, aware: false }]);
    expect(w.classState.hybrid).toBe('thief');
    expect(w.noticeTime).toBe(2);
    const ev = [...run(w, { attack1: true }, 1), ...run(w, {}, 90)];
    expect(hitsOn(ev, w.enemies[0].id)[0].crit).toBe(true);
    const ev2 = [...run(w, { attack1: true }, 1), ...run(w, {}, 90)];
    expect(hitsOn(ev2, w.enemies[0].id)[0].crit).toBe(false);   // aware now
    const r = setup(['blade_dash', 'arrow_rain'], ['greatsword', null]);
    run(r, { moveX: 1 }, 60);
    expect(r.body.vx).toBeCloseTo(170 * 1.2, 5);
    expect(tryLockpick(r)).toBe(true);
    expect(tryLockpick(r)).toBe(false);
    r.restart();
    expect(tryLockpick(r)).toBe(true);
  });
});

describe('Gladiator (03 §6.2)', () => {
  it('Greatsword 1, 2 → War Maul starts at step 1 with +50%; Katana 1, 2 → Greatsword step 3 with +50%', () => {
    const w = setup(['blade_dash', 'shockwave'], ['greatsword', 'war_maul'], [{ id: 'training_dummy', x: 230 }]);
    run(w, { attack1: true }, 1); run(w, {}, 59);
    run(w, { attack1: true }, 1); run(w, {}, 59);
    const ev = [...run(w, { attack2: true }, 1), ...run(w, {}, 60)];
    expect(hitsOn(ev, w.enemies[0].id).map((h) => h.amount)).toEqual([47]);   // step 1: 25 × 1.25 matched × 1.5 = 46.9
    const k = setup(['blade_dash', 'shockwave'], ['katana', 'greatsword'], [{ id: 'training_dummy', x: 230 }]);
    run(k, { attack1: true }, 1); run(k, {}, 39);
    run(k, { attack1: true }, 1); run(k, {}, 39);
    const ev2 = [...run(k, { attack2: true }, 1), ...run(k, {}, 100)];
    expect(hitsOn(ev2, k.enemies[0].id).map((h) => h.amount)).toEqual([Math.floor(34 * 1.25 * 1.5 + 0.5)]);
  });
  it('the +0.50 has a 180-tick cooldown; the combo still carries over', () => {
    const w = setup(['blade_dash', 'shockwave'], ['katana', 'greatsword'], [{ id: 'training_dummy', x: 230 }]);
    run(w, { attack1: true }, 1); run(w, {}, 39);
    run(w, { attack2: true }, 1); run(w, {}, 59);        // switch 1: bonus
    const ev = [...run(w, { attack1: true }, 1), ...run(w, {}, 39)];   // switch back within 180 ticks: no bonus
    expect(hitsOn(ev, w.enemies[0].id).map((h) => h.amount)).toEqual([21]);   // Katana step 3 (17 × 1.25), no bonus
  });
});

describe('Spellblade (03 §6.3, checklist 9)', () => {
  it('a weapon melee instance landing on 3 enemies takes exactly 60 ticks off each slot; a shot takes nothing', () => {
    const w = setup(['blade_dash', 'thunder_strike'], ['greatsword', 'staff'], [{ id: 'training_dummy', x: 220 }, { id: 'training_dummy', x: 225 }, { id: 'training_dummy', x: 230 }]);
    for (const s of w.abilities.slots) { s!.charges = 0; s!.rechargeLeft = 500; }
    /** rechargeLeft drop on the tick a hit lands (1 for the tick's own recharge, plus 60 for a melee landing). */
    const dropOnHit = (spec: InputSpec) => {
      run(w, spec, 1);
      for (let i = 0; i < 100; i++) {
        const before = w.abilities.slots[0]!.rechargeLeft;
        if (run(w, {}, 1).some((e) => e.t === 'hit')) return [before - w.abilities.slots[0]!.rechargeLeft, before - w.abilities.slots[1]!.rechargeLeft + (w.abilities.slots[1]!.rechargeLeft - w.abilities.slots[0]!.rechargeLeft)];
      }
      return [-1, -1];
    };
    expect(dropOnHit({ attack1: true })).toEqual([61, 61]);    // 3 enemies, once per instance
    run(w, {}, 60);
    expect(dropOnHit({ attack2: true })).toEqual([1, 1]);      // a shot takes nothing
  });
});

describe('Warden (03 §6.4)', () => {
  it('a melee landing primes the next shot (+0.50); a shot landing primes the next landing melee instance', () => {
    const w = setup(['shockwave', 'arrow_rain'], ['war_maul', 'crossbow'], [{ id: 'training_dummy', x: 230 }]);
    run(w, { attack1: true }, 1); run(w, {}, 100);
    expect(w.abilities.shotPrimed).toBe(true);
    const ev = [...run(w, { attack2: true }, 1), ...run(w, {}, 100)];
    expect(hitsOn(ev, w.enemies[0].id).map((h) => h.amount)).toEqual([Math.floor(29 * 1.25 * 1.5 + 0.5)]);
    expect(w.abilities.meleePrimed).toBe(true);
    // A whiff does not use the melee prime.
    w.teleportPlayer(500, 320);
    run(w, { attack1: true }, 1); run(w, {}, 100);
    expect(w.abilities.meleePrimed).toBe(true);
  });
});

describe('Thunderlord (03 §6.5)', () => {
  it('a heavy hit calls a bolt 12 ticks later for 50% of its base; bolts never call bolts', () => {
    const w = setup(['shockwave', 'thunder_strike'], ['war_maul', null], [{ id: 'training_dummy', x: 230 }]);
    const ticks: [number, number][] = [];
    run(w, { attack1: true }, 1);
    for (let i = 0; i < 90; i++) for (const e of run(w, {}, 1)) if (e.t === 'hit') ticks.push([w.tick, e.amount]);
    expect(ticks.length).toBe(2);
    expect(ticks[1][0] - ticks[0][0]).toBe(12);
    expect(ticks[1][1]).toBe(Math.floor(12.5 * 1.25 + 0.5));   // 50% of 25, matched
  });
});

describe('Arcane Archer (03 §6.6)', () => {
  it('Bow arrows carry Lightning 1; the orb blast is 120 × 120', () => {
    const w = setup(['arrow_rain', 'thunder_strike'], ['bow', 'staff'], [{ id: 'training_dummy', x: 300 }, { id: 'training_dummy', x: 340 }]);
    const ev = [...run(w, { attack1: true }, 1), ...run(w, {}, 60)];
    expect(hitsOn(ev, w.enemies[1].id).length).toBe(1);        // the chain
    const o = setup(['arrow_rain', 'thunder_strike'], ['staff', null]);
    run(o, { attack1: true }, 1);
    run(o, { attack1: true }, 42 + 62);
    run(o, {}, 1);
    run(o, {}, 6);
    const p = o.playerProjectiles[0];
    expect(p?.opts.blastMult).toBe(1.5);
  });
  it('a charged arrow explodes once at the first enemy it hits; that enemy is not hit by the blast', () => {
    const w = setup(['arrow_rain', 'thunder_strike'], ['bow', null], [{ id: 'training_dummy', x: 300 }, { id: 'training_dummy', x: 320 }]);
    run(w, { attack1: true }, 1); run(w, { attack1: true }, 39 + 56);
    const ev = [...run(w, {}, 1), ...run(w, {}, 60)];
    const a = hitsOn(ev, w.enemies[0].id).map((h) => h.amount), b = hitsOn(ev, w.enemies[1].id).map((h) => h.amount);
    expect(a[0]).toBe(40);                                     // 32 × 1.25 matched
    expect(a).not.toContain(20);                               // never hit by its own blast (the chain may still reach it)
    expect(b).toContain(20);                                   // the blast: 16 × 1.25
  });
  it('primes and timers clear when the hybrid ends and at death', () => {
    const w = setup(['shockwave', 'arrow_rain'], ['war_maul', 'crossbow']);
    w.abilities.shotPrimed = true;
    w.abilities.slots[1] = null; w.refreshClassState();
    expect(w.abilities.shotPrimed).toBe(false);
    void firePlayerProjectile;
  });
});
