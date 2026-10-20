import { describe, expect, it } from 'vitest';
import { newAbility, newWeapon } from './runtime.ts';
import type { AbilityLevel } from './types.ts';
import type { GameWorld, WorldEvent } from '../sim/gameWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { hurtPlayer } from '../combat/health.ts';
import { stance } from './list/riposte.ts';

function setup(level: AbilityLevel = 1): GameWorld {
  const w = arenaWorld({ enemies: [{ enemy: 'training_dummy', x: 230, y: 320, facing: -1 }] });
  w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [newAbility('riposte', level), null] });
  const e = w.enemies[0]; e.hp = e.maxHp = 100000; e.dormant = false;
  stepSpec(w, {}, 2);
  w.body.facing = 1;
  return w;
}
const run = (w: GameWorld, spec: InputSpec, n = 1) => stepSpec(w, spec, n);
const hitsOn = (ev: WorldEvent[], id: number) => ev.filter((e): e is Extract<WorldEvent, { t: 'hit' }> => e.t === 'hit' && e.target === id).map((e) => e.amount);
const enemyHit = (w: GameWorld, extra: object = {}) =>
  hurtPlayer(w, { kind: 'enemyHit', enemyId: w.enemies[0].id, enemyDefId: 'bandit', damageA: 10, attackerCx: w.enemies[0].x, melee: true, ...extra });

describe('Riposte (03 §8.4, checklist 28)', () => {
  it('blocks an enemy hit (0 damage, no hitstun) and the counter deals 45 to the attacker', () => {
    const w = setup();
    run(w, { ability1: true }, 1);
    expect(stance(w)).toBeDefined();
    run(w, {}, 5);
    const hp = w.health.hp;
    expect(enemyHit(w)).toBe(0);
    expect(w.health.hp).toBe(hp);
    expect(w.health.hitstunTicks).toBe(0);
    expect(w.health.abilityIframeTicks).toBe(48);
    expect(stance(w)).toBeUndefined();                          // the first block ends the stance
    const ev = run(w, {}, 15);
    expect(hitsOn(ev, w.enemies[0].id)).toEqual([45]);
  });
  it('a spike hazard during the stance still hurts, and the stance stays up', () => {
    const w = setup();
    run(w, { ability1: true }, 1);
    const hp = w.health.hp;
    hurtPlayer(w, { kind: 'hazard', cause: 'spikes', damageA: 10 });
    expect(w.health.hp).toBeLessThan(hp);
    expect(stance(w)).toBeDefined();
  });
  it('an unblockable enemy hit goes through', () => {
    const w = setup();
    run(w, { ability1: true }, 1);
    const hp = w.health.hp;
    expect(enemyHit(w, { unblockable: true })).toBeGreaterThan(0);
    expect(w.health.hp).toBeLessThan(hp);
  });
  it('after 120 ticks with no hit, an enemy hit hurts again', () => {
    const w = setup();
    run(w, { ability1: true }, 1);
    run(w, {}, 125);
    expect(stance(w)).toBeUndefined();
    const hp = w.health.hp;
    expect(enemyHit(w)).toBeGreaterThan(0);
    expect(w.health.hp).toBeLessThan(hp);
  });
  it('a jump ends the stance (still spent)', () => {
    const w = setup();
    run(w, { ability1: true }, 1);
    run(w, { jump: true }, 2);
    run(w, {}, 2);
    expect(stance(w)).toBeUndefined();
    expect(w.abilities.slots[0]!.charges).toBe(0);
  });
  it('Lv5 refunds the dash on the block', () => {
    const w = setup(5);
    w.body.airDashAvailable = false;
    run(w, { ability1: true }, 1);
    w.body.airDashAvailable = false;
    enemyHit(w);
    expect(w.body.airDashAvailable).toBe(true);
  });
});
