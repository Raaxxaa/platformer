import { describe, it, expect } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { addFlaskFill, onKillFill } from './flask.ts';
import { hurtPlayer } from './health.ts';

describe('heal flask (02 §7)', () => {
  it('starts at 2/2 charges with an empty bar', () => {
    expect(arenaWorld().flask).toEqual({ charges: 2, maxCharges: 2, fillTenths: 0 });
  });
  it('20 regular kills from 1/2 and 0 fill end at 2 charges and 0 fill; an elite adds 150 (checklist 13)', () => {
    const w = arenaWorld();
    w.flask.charges = 1;
    for (let i = 0; i < 20; i++) onKillFill(w, 'regular');
    expect(w.flask).toMatchObject({ charges: 2, fillTenths: 0 });
    onKillFill(w, 'elite');
    expect(w.flask.fillTenths).toBe(150);
  });
  it('at max charges the fill caps at 1000; drinking then leaves charges at max and fill at 0 (checklist 14)', () => {
    const w = arenaWorld();
    addFlaskFill(w, 1700);
    expect(w.flask).toMatchObject({ charges: 2, fillTenths: 1000 });
    w.health.hp = 50;
    stepSpec(w, { heal: true }); stepSpec(w, {}, 40);
    expect(w.flask).toMatchObject({ charges: 2, fillTenths: 0 });
  });
  it('a drink at 60/100 heals to 100 on tick 30 (checklist 15)', () => {
    const w = arenaWorld();
    w.health.hp = 60;
    stepSpec(w, { heal: true });
    stepSpec(w, {}, 28);
    expect(w.health.hp).toBe(60);
    const ev = stepSpec(w, {});
    expect(w.health.hp).toBe(100);
    expect(ev).toContainEqual({ t: 'drink' });
    expect(w.flask.charges).toBe(1);
  });
  it('a dash at tick 24 cancels the drink and keeps the charge', () => {
    const w = arenaWorld();
    w.health.hp = 60;
    stepSpec(w, { heal: true }); stepSpec(w, {}, 22);
    stepSpec(w, { dash: true });
    stepSpec(w, {}, 30);
    expect(w.health.hp).toBe(60);
    expect(w.flask.charges).toBe(2);
  });
  it('a hit before the sip cancels the drink for free', () => {
    const w = arenaWorld();
    w.health.hp = 60;
    stepSpec(w, { heal: true }); stepSpec(w, {}, 5);
    hurtPlayer(w, { kind: 'enemyHit', enemyId: 1, enemyDefId: 'bandit', damageA: 10, attackerCx: 300, melee: true });
    stepSpec(w, {}, 60);
    expect(w.health.hp).toBe(50);
    expect(w.flask.charges).toBe(2);
  });
  it('drinking caps ground speed at 40% (68 px/s)', () => {
    const w = arenaWorld();
    w.health.hp = 60;
    stepSpec(w, { moveX: 1 }, 30);
    stepSpec(w, { moveX: 1, heal: true }); stepSpec(w, { moveX: 1 }, 20);
    expect(w.body.vx).toBeCloseTo(68, 9);
  });
  it('refusals: fullHp, noCharge, hitstun (checklist 16)', () => {
    const w = arenaWorld();
    expect(stepSpec(w, { heal: true })).toContainEqual({ t: 'healRefused', reason: 'fullHp' });
    expect(w.flask.charges).toBe(2);
    w.flask.charges = 0;
    stepSpec(w, {});
    expect(stepSpec(w, { heal: true })).toContainEqual({ t: 'healRefused', reason: 'noCharge' });
    const h = arenaWorld();
    hurtPlayer(h, { kind: 'enemyHit', enemyId: 1, enemyDefId: 'bandit', damageA: 10, attackerCx: 300, melee: true });
    expect(stepSpec(h, { heal: true })).toContainEqual({ t: 'healRefused', reason: 'hitstun' });
  });
  it('during an attack startup the press is buffered; in recovery it cancels the attack and drinks', () => {
    const w = arenaWorld();
    w.health.hp = 50;
    stepSpec(w, { attack1: true }); stepSpec(w, {});
    stepSpec(w, { heal: true });
    expect(w.drinking).toBeNull();
    stepSpec(w, {}, 40);                                  // recovery starts at tick 37: within 0.15 s of the press? no: buffer expired
    const w2 = arenaWorld();
    w2.health.hp = 50;
    stepSpec(w2, { attack1: true }); stepSpec(w2, {}, 30);
    stepSpec(w2, { heal: true });                         // tick 32 (active): buffered
    stepSpec(w2, {}, 5);                                  // recovery starts at tick 37 → drink starts
    expect(w2.combat.current).toBeNull();
    expect(w2.drinking).not.toBeNull();
    const w3 = arenaWorld();
    w3.health.hp = 50;
    stepSpec(w3, { attack1: true }); stepSpec(w3, {}, 40);
    stepSpec(w3, { heal: true });                         // recovery: cancels at once
    expect(w3.combat.current).toBeNull();
    expect(w3.drinking).not.toBeNull();
  });
});
