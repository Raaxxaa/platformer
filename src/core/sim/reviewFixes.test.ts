// Regression tests for the M2 review findings.
import { describe, it, expect } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { GameWorld } from './gameWorld.ts';
import { hurtPlayer } from '../combat/health.ts';
import { startEnemyAttack } from '../enemies/attack.ts';

describe('M2 review fixes', () => {
  it('a non-staggering player hit and an enemy swing landing on the same tick both land (a trade, 02 §2.4)', () => {
    const setup = () => {
      const w = arenaWorld({ enemies: [{ enemy: 'bandit', x: 225, y: 320, facing: -1 }] });
      const e = w.enemies[0];
      e.dormant = false; e.hp = e.maxHp = 1000;
      startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'slash')!);
      return w;
    };
    // Dry run: on which step does the slash land?
    const dry = setup();
    let land = 0;
    for (let i = 1; i <= 120 && !land; i++) { stepSpec(dry, {}); if (dry.health.hp < 100) land = i; }
    expect(land).toBeGreaterThan(30);
    // A Greatsword step 1 lands its hit on the 24th step after the press tick: time it for the same tick.
    const w = setup();
    stepSpec(w, {}, land - 25);
    stepSpec(w, { attack1: true });
    stepSpec(w, {}, 23);
    expect(w.enemies[0].hp).toBe(1000);
    expect(w.health.hp).toBe(100);
    stepSpec(w, {});
    expect(w.enemies[0].hp).toBe(1000 - 16);
    expect(w.health.hp).toBe(90);
  });

  it('dying while the dive impact box is out ends the dive: no ghost hits, Rush resets to 0', () => {
    const base = arenaWorld();
    const w = new GameWorld({ grid: base.grid, spawn: { x: 200, y: 200 }, enemies: [{ enemy: 'bandit', x: 900, y: 320, facing: -1 }] });
    stepSpec(w, { moveY: 1, attack1: true });
    for (let i = 0; i < 120 && !(w.dive && w.dive.impactId !== null); i++) stepSpec(w, {});
    expect(w.dive?.impactId).not.toBeNull();
    w.rush.value = 150;
    w.health.hp = 1;
    hurtPlayer(w, { kind: 'enemyHit', enemyId: 1, enemyDefId: 'bandit', damageA: 10, attackerCx: 300, melee: true });
    expect(w.rush.value).toBe(0);
    expect(w.dive).toBeNull();
    expect(w.hitGroups.filter((g) => g.owner === 'player')).toEqual([]);
    const e = w.enemies[0];
    e.dormant = false; e.x = w.body.x; e.hp = 5;
    const ev = stepSpec(w, {}, 3);
    expect(e.hp).toBe(5);
    expect(ev.some((x) => x.t === 'kill')).toBe(false);
    expect(w.gold).toBe(0);
  });

  it('a press during hit-stop while an attack runs queues the next step only once (02 §9.2)', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'training_dummy', x: 225, y: 320, facing: -1 }] });
    w.enemies[0].dormant = false;
    const steps: number[] = [];
    const log = () => { const c = w.combat.current; if (c && steps[steps.length - 1] !== c.step) steps.push(c.step); };
    stepSpec(w, { attack1: true }); log();
    for (let i = 0; i < 60 && w.body.hitStopTicks === 0; i++) { stepSpec(w, {}); log(); }
    expect(w.body.hitStopTicks).toBeGreaterThan(0);
    stepSpec(w, { attack1: true }); log();                     // press during hit-stop
    for (let i = 0; i < 60 && w.combat.current?.phase !== 'recovery'; i++) { stepSpec(w, {}); log(); }
    stepSpec(w, { attack1: true }); log();                     // a second press during recovery
    for (let i = 0; i < 240; i++) { stepSpec(w, {}); log(); }
    expect(steps).toEqual([0, 1]);
  });

  it('holding R while dead (before the death screen) does not restart; only a press after 0.25 s does (06 §6.2)', () => {
    const w = arenaWorld();
    w.health.hp = 1;
    hurtPlayer(w, { kind: 'enemyHit', enemyId: 1, enemyDefId: 'bandit', damageA: 10, attackerCx: 300, melee: true });
    stepSpec(w, {}, 5);
    stepSpec(w, { restart: true }, 100);
    expect(w.health.dead).toBe(true);
  });

  it("the player-hurt hit event carries the damage taken", () => {
    const w = arenaWorld({ enemies: [{ enemy: 'bandit', x: 225, y: 320, facing: -1 }] });
    const e = w.enemies[0];
    e.dormant = false;
    startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'slash')!);
    const ev = stepSpec(w, {}, 120);
    expect(ev).toContainEqual({ t: 'hit', target: 'player', amount: 10, crit: false, heavy: false });
  });
});
