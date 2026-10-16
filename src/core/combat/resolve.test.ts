import { describe, it, expect } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { resolvePlayerHits, resolveEnemyHits } from './resolve.ts';
import { startEnemyAttack } from '../enemies/attack.ts';
import { enemyRect, type EnemyState } from '../enemies/enemy.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import type { HitSpec } from './types.ts';
import { WEAPONS } from '../../data/weapons.ts';

const bandit = (x = 230) => arenaWorld({ enemies: [{ enemy: 'bandit', x, y: 320, facing: -1 }] });

/** A player hit group covering enemy `e`, resolved now (7a). */
function playerHit(w: GameWorld, e: EnemyState, spec: HitSpec): void {
  w.hitGroups.push({ id: w.newId(), owner: 'player', kind: spec.kind, rect: enemyRect(e), spec, active: true,
    lastHitTick: new Map(), hitCount: new Map(), attackInstance: 999 + w.hitGroups.length });
  resolvePlayerHits(w);
}
const GS = WEAPONS.greatsword!;

describe('player hits on enemies (02 §3–4)', () => {
  it('a Greatsword step-1 hit on a Bandit: 16 damage, poise 20 → 5, KB 108, 6 ticks of hit-stop on both', () => {
    const w = bandit();
    stepSpec(w, { attack1: true });
    let ev = stepSpec(w, {}, 23);
    expect(w.enemies[0].hp).toBe(40);
    ev = stepSpec(w, {});
    const e = w.enemies[0];
    expect(ev).toContainEqual({ t: 'hit', target: e.id, amount: 16, crit: false, heavy: false });
    expect(e).toMatchObject({ hp: 24, poise: 5 });
    expect(e.vx).toBeCloseTo(108, 9);
    expect(e.vy).toBeCloseTo(-36, 9);
    expect(e.hitStopTicks).toBe(6);
    expect(w.body.hitStopTicks).toBe(6);
    expect(e.aware).toBe(true);
  });
  it('two step-1 hits stagger a Bandit for 60 ticks; the stagger cancels its telegraph and starts that attack’s cooldown', () => {
    const w = bandit();
    const e = w.enemies[0];
    e.dormant = false;
    playerHit(w, e, GS.combo[0].hit!);
    startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'slash')!);
    expect(e.ai.attack?.phase).toBe('tele');
    w.tick += 1;
    playerHit(w, e, GS.combo[0].hit!);
    expect(e.control).toEqual({ type: 'stagger', ticks: 60 });
    expect(e.poise).toBe(0);
    expect(e.ai.attack).toBeNull();
    expect(e.ai.cooldowns.get('slash')).toBe(144);
    expect(w.hitGroups.filter((g) => g.owner === e.id)).toEqual([]);
  });
  it('a heavy breaking hit staggers for 0.8 s (96 ticks)', () => {
    const w = bandit();
    const e = w.enemies[0];
    e.dormant = false;
    playerHit(w, e, GS.combo[2].hit!);
    expect(e.control).toEqual({ type: 'stagger', ticks: 96 });
  });
  it('further hits during a stagger do not extend it; poise returns to max when it ends', () => {
    const w = bandit();
    const e = w.enemies[0];
    e.dormant = false;
    e.hp = 1000;
    playerHit(w, e, GS.combo[2].hit!);
    stepSpec(w, {}, 20);
    const left = e.control!.ticks;
    w.tick += 1;
    playerHit(w, e, GS.combo[0].hit!);
    expect(e.control!.ticks).toBe(left);
    stepSpec(w, {}, 120);
    expect(e.control).toBeNull();
    expect(e.poise).toBe(20);
  });
  it('1.5 s with no hits refills poise', () => {
    const w = bandit();
    const e = w.enemies[0];
    e.dormant = false;
    playerHit(w, e, GS.combo[0].hit!);
    expect(e.poise).toBe(5);
    stepSpec(w, {}, 6 + 179);
    expect(e.poise).toBe(5);
    stepSpec(w, {});
    expect(e.poise).toBe(20);
  });
  it('an enemy committed in Tele or Act ignores knockback unless the hit staggers it', () => {
    const w = bandit();
    const e = w.enemies[0];
    e.dormant = false;
    startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'slash')!);
    playerHit(w, e, GS.combo[0].hit!);
    expect(e.vx).toBe(0);
    expect(e.knockback).toBe(false);
    w.tick += 1;
    playerHit(w, e, GS.combo[1].hit!);         // breaks poise: full knockback
    expect(e.control?.type).toBe('stagger');
    expect(e.vx).not.toBe(0);
  });
  it('an elite gets 2.0 s of poise immunity after a stagger ends; a regular gets none', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'bandit_brute', x: 230, y: 320, facing: -1 }] });
    const e = w.enemies[0];
    e.dormant = false;
    playerHit(w, e, { ...GS.combo[2].hit!, poise: 100 });
    expect(e.control?.type).toBe('stagger');
    stepSpec(w, {}, 200);
    expect(e.control).toBeNull();
    expect(e.poiseImmuneTicks).toBeGreaterThan(0);
    w.tick += 1;
    playerHit(w, e, GS.combo[0].hit!);
    expect(e.poise).toBe(70);
  });
  it('an enemy killed in 7a deals no damage from its hit box active that tick (checklist 12)', () => {
    const w = bandit(210);
    const e = w.enemies[0];
    e.dormant = false;
    e.hp = 1;
    startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'slash')!);
    e.ai.attack!.phase = 'act';
    e.ai.attack!.t = 1;
    w.hitGroups.push({ id: w.newId(), owner: e.id, kind: 'melee', rect: { x: 180, y: 280, w: 60, h: 40 }, spec: { damage: 10, kb: [0, 0], poise: 0, hitStop: 0, kind: 'melee' },
      enemyHit: { box: { dx: 0, dy: 0, w: 60, h: 40 }, damage: 10 }, active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: 1 });
    playerHit(w, e, GS.combo[0].hit!);
    resolveEnemyHits(w);
    expect(e.dead).toBe(true);
    expect(w.health.hp).toBe(100);
  });
  it('two enemy boxes on the player in one tick: one hit applies (checklist 11)', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'bandit', x: 220, y: 320, facing: -1 }, { enemy: 'bandit', x: 180, y: 320, facing: 1 }] });
    for (const e of w.enemies) {
      e.dormant = false;
      w.hitGroups.push({ id: w.newId(), owner: e.id, kind: 'melee', rect: { x: 180, y: 280, w: 40, h: 40 }, spec: { damage: 10, kb: [0, 0], poise: 0, hitStop: 0, kind: 'melee' },
        enemyHit: { box: { dx: 0, dy: 0, w: 40, h: 40 }, damage: 10 }, active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: 1 });
    }
    resolveEnemyHits(w);
    expect(w.health.hp).toBe(90);
    expect(w.enemies[0].hitStopTicks).toBe(9);    // the melee attacker shares the player's hurt hit-stop
  });
  it('a kill credits gold, emits kill and starts the 0.4 s death', () => {
    const w = bandit();
    const e = w.enemies[0];
    e.dormant = false;
    e.hp = 5;
    playerHit(w, e, GS.combo[0].hit!);
    expect(e.dead).toBe(true);
    stepSpec(w, {});
    expect(w.gold).toBe(4);
    expect(w.events).toContainEqual({ t: 'kill', enemyId: e.id, tier: 'regular' });
    expect(e.deathTicks).toBeGreaterThan(0);
  });
  it('the Training Dummy never dies and heals to max 1.0 s after the last damage', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'training_dummy', x: 230, y: 320, facing: 1 }] });
    const e = w.enemies[0];
    e.dormant = false;
    e.hp = 10;
    playerHit(w, e, { ...GS.combo[2].hit!, damage: 500 });
    expect(e.dead).toBe(false);
    expect(e.hp).toBeGreaterThanOrEqual(1);
    stepSpec(w, {}, 140);
    expect(e.hp).toBe(9999);
  });
});
