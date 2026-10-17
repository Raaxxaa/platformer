import { describe, expect, it } from 'vitest';
import { newAbility, newWeapon } from '../abilities/runtime.ts';
import type { AbilityId } from '../abilities/types.ts';
import type { GameWorld, WorldEvent } from '../sim/gameWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import type { EnemyId } from '../enemies/types.ts';
import type { WeaponId } from '../combat/types.ts';
import { firePlayerProjectile } from '../combat/playerProjectiles.ts';

interface Foe { id: EnemyId; x: number; hp?: number }
function setup(abilities: [AbilityId | null, AbilityId | null], weapons: [WeaponId | null, WeaponId | null], foes: Foe[] = []): GameWorld {
  const w = arenaWorld({ enemies: foes.map((f) => ({ enemy: f.id, x: f.x, y: 320, facing: -1 })) });
  w.setLoadout({ weapons: [weapons[0] && newWeapon(weapons[0]), weapons[1] && newWeapon(weapons[1])], abilities: [abilities[0] && newAbility(abilities[0]), abilities[1] && newAbility(abilities[1])] });
  foes.forEach((f, i) => { const e = w.enemies[i]; e.hp = e.maxHp = f.hp ?? 5000; e.dormant = false; });
  stepSpec(w, {}, 2);
  return w;
}
const run = (w: GameWorld, spec: InputSpec, n = 1) => stepSpec(w, spec, n);
type Hit = Extract<WorldEvent, { t: 'hit' }>;
const hitEvents = (ev: WorldEvent[]) => ev.filter((e): e is Hit => e.t === 'hit' && e.target !== 'player');

describe('the link (03 §5.1, checklist 6–7)', () => {
  function shockAfter(gap: number, pair: [AbilityId, AbilityId]): number {
    const w = setup(pair, ['war_maul', null], [{ id: 'training_dummy', x: 330 }]);
    run(w, { ability1: true }, 1);                           // slot 1 activates now (a move: the press tick), 96 px ahead
    run(w, {}, gap - 24 - 1);
    const ev = [...run(w, { ability2: true }, 1), ...run(w, {}, 30)];   // Shockwave: effect 24 ticks after its press
    return hitEvents(ev)[0]?.amount ?? -1;
  }
  it('with the Connection, an activation 360 ticks after the other slot\'s is linked (+0.50); 361 is not', () => {
    expect(shockAfter(360, ['shoulder_charge', 'shockwave'])).toBe(60);
    expect(shockAfter(361, ['shoulder_charge', 'shockwave'])).toBe(40);
  });
  it('a hybrid pair never links', () => {
    expect(shockAfter(360, ['blade_dash', 'shockwave'])).toBe(40);
  });
  it('a linked activation does not open a new window', () => {
    const w = setup(['blade_dash', 'whirlwind'], ['greatsword', null]);
    w.abilities.slots[0] = newAbility('blade_dash', 5);
    const used: boolean[] = [];
    const collect = (ev: WorldEvent[]) => { for (const e of ev) if (e.t === 'abilityUsed') used.push(e.linked); };
    collect(run(w, { ability1: true }, 1)); run(w, {}, 99);
    collect(run(w, { ability2: true }, 1)); run(w, {}, 99);
    collect(run(w, { ability1: true }, 1));
    expect(used).toEqual([false, true, false]);
  });
  it('the link clears when the Connection is lost and at death', () => {
    const w = setup(['blade_dash', 'whirlwind'], ['greatsword', null]);
    run(w, { ability1: true }, 1);
    expect(w.abilities.link).not.toBeNull();
    w.abilities.slots[1] = newAbility('shockwave');
    w.refreshClassState();
    expect(w.abilities.link).toBeNull();
    w.abilities.slots[1] = newAbility('whirlwind');
    w.refreshClassState();
    w.abilities.link = { fromSlot: 0, openedTick: w.body.pt };
    w.onPlayerDied('test');
    expect(w.abilities.link).toBeNull();
  });
});

describe('Blademaster (03 §5.2, checklist 11)', () => {
  it('the 3rd and 6th landing instances crit; the 4th and 5th do not; kills refund the dash once', () => {
    const w = setup(['blade_dash', 'whirlwind'], ['katana', null], [{ id: 'training_dummy', x: 222 }]);
    const crits: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      const ev = [...run(w, { attack1: true }, 1), ...run(w, {}, 50)];
      crits.push(...hitEvents(ev).map((e) => e.crit));
    }
    expect(crits).toEqual([false, false, true, false, false, true]);
    const k = setup(['blade_dash', 'whirlwind'], ['greatsword', null], [{ id: 'wolf', x: 225, hp: 1 }, { id: 'wolf', x: 230, hp: 1 }]);
    k.body.dashReadyPt = k.body.pt + 1000;                    // as if the dash were on a long cooldown
    run(k, { attack1: true }, 1); run(k, {}, 40);
    expect(k.enemies.every((e) => e.dead)).toBe(true);
    expect(k.body.dashReadyPt).toBeLessThanOrEqual(k.body.pt);
  });
});

describe('Iron Will (03 §5.3, checklist 10)', () => {
  it('50/100 → bond on 80/130 → off 50/100; 10/130 → off 1/100', () => {
    const w = setup(['shockwave', null], ['war_maul', null]);
    w.health.hp = 50;
    w.abilities.slots[1] = newAbility('shoulder_charge'); w.refreshClassState();
    expect([w.health.hp, w.health.maxHp]).toEqual([80, 130]);
    w.abilities.slots[1] = null; w.refreshClassState();
    expect([w.health.hp, w.health.maxHp]).toEqual([50, 100]);
    w.abilities.slots[1] = newAbility('shoulder_charge'); w.refreshClassState();
    w.health.hp = 10;
    w.abilities.slots[1] = null; w.refreshClassState();
    expect([w.health.hp, w.health.maxHp]).toEqual([1, 100]);
  });
  it('super armor while attacking; heavy hits stagger 1.6 s', () => {
    const w = setup(['shockwave', 'shoulder_charge'], ['war_maul', null], [{ id: 'bandit', x: 228 }]);
    run(w, { attack1: true }, 1);
    run(w, {}, 3);
    w.hitGroups.push({ id: w.newId(), owner: w.enemies[0].id, kind: 'melee', rect: { x: w.body.x - 20, y: w.body.y - 30, w: 40, h: 30 },
      spec: { damage: 10, kb: [0, 0], poise: 0, hitStop: 0, kind: 'melee' }, enemyHit: { box: { dx: 0, dy: 0, w: 1, h: 1 }, damage: 10 },
      active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: 1 });
    run(w, {}, 1);
    expect(w.health.hp).toBeLessThan(w.health.maxHp);
    expect(w.combat.current).not.toBeNull();                   // the attack keeps going
    const e = w.enemies[0];
    e.poise = 1;
    run(w, {}, 60);
    expect(e.control?.type).toBe('stagger');
  });
});

describe('Eagle Eye (03 §5.4)', () => {
  it('an arrow that flew 130 px crits; one at 100 px does not', () => {
    for (const [x, crit] of [[200 + 12 + 130 + 6 + 12, true], [200 + 12 + 100 + 6 + 12, false]] as const) {
      const w = setup(['arrow_rain', 'hunters_mark'], ['bow', null], [{ id: 'training_dummy', x }]);
      firePlayerProjectile(w, 0, 99, 'arrow', 0);
      const ev = run(w, {}, 60);
      expect(hitEvents(ev)[0]?.crit).toBe(crit);
    }
  });
  it('slow fall at 60 px/s while aiming in the air, for at most 120 ticks per airtime', () => {
    const w = setup(['arrow_rain', 'hunters_mark'], ['bow', null]);
    w.teleportPlayer(300, 120);
    run(w, {}, 20);
    run(w, { attack1: true }, 1);
    run(w, { attack1: true }, 60);
    expect(w.body.vy).toBeLessThanOrEqual(60);
    expect(w.abilities.eagleEyeBudget).toBeLessThan(120);
  });
});

describe('Storm Caller (03 §5.5, checklist 8) and Lightning (02 §6.4, checklist 22)', () => {
  it('an 8 s cooldown recharges in 768 player ticks', () => {
    const w = setup(['thunder_strike', 'blink'], ['staff', null]);
    run(w, { ability1: true }, 1);
    run(w, {}, 18);
    expect(w.abilities.slots[0]!.charges).toBe(0);
    run(w, {}, 766);
    expect(w.abilities.slots[0]!.charges).toBe(0);
    run(w, {}, 2);
    expect(w.abilities.slots[0]!.charges).toBe(1);
  });
  it('Lightning L1, procBase 20: the 2 nearest within 80 px take 7; a third takes nothing', () => {
    const w = setup([null, null], ['greatsword', null], [{ id: 'training_dummy', x: 230 }, { id: 'training_dummy', x: 260 }, { id: 'training_dummy', x: 280 }, { id: 'training_dummy', x: 300 }]);
    w.combat.slots[0] = { weaponId: 'greatsword', grade: 'B', element: 'lightning', perk: null };
    const ev = [...run(w, { attack1: true }, 1), ...run(w, {}, 40)];
    const [a, b, c, d] = w.enemies.map((e) => hitEvents(ev).filter((h) => h.target === e.id).map((h) => h.amount));
    expect(a).toEqual([20]);
    expect(b).toEqual([7]);
    expect(c).toEqual([7]);
    expect(d).toEqual([]);
  });
  it('a C-grade weapon gets Lightning 1 with Storm Caller, and the chain is ×1.25', () => {
    const w = setup(['thunder_strike', 'blink'], ['staff', null], [{ id: 'training_dummy', x: 300 }, { id: 'training_dummy', x: 330 }]);
    const ev = [...run(w, { attack1: true }, 1), ...run(w, {}, 60)];
    const [a, b] = w.enemies.map((e) => hitEvents(ev).filter((h) => h.target === e.id).map((h) => h.amount));
    expect(a).toEqual([16]);                                    // staff bolt 13 × 1.25 matched
    expect(b).toEqual([Math.floor(16.25 * 0.35 * 1.25 + 0.5)]);
  });
});
