import { describe, it, expect } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { hurtPlayer, type HurtSource } from './health.ts';
import { COMBAT } from '../tuning.ts';

const hit = (extra: Partial<Extract<HurtSource, { kind: 'enemyHit' }>> = {}): HurtSource =>
  ({ kind: 'enemyHit', enemyId: 7, enemyDefId: 'bandit', damageA: 12, attackerCx: 260, melee: true, ...extra });

describe('player health and hurt pipeline (02 §5)', () => {
  it('starts at 100/100', () => {
    const w = arenaWorld();
    expect(w.health).toMatchObject({ hp: 100, maxHp: 100, iframeTicks: 0, dead: false, deathCause: null });
  });
  it('a 12 hit takes 100 to 88; another at +0.79 s is ignored, at +0.81 s it applies (checklist 7)', () => {
    const w = arenaWorld();
    expect(hurtPlayer(w, hit())).toBeGreaterThan(0);
    expect(w.health.hp).toBe(88);
    stepSpec(w, {}, 95);
    expect(hurtPlayer(w, hit())).toBe(0);
    expect(w.health.hp).toBe(88);
    stepSpec(w, {}, 2);
    expect(hurtPlayer(w, hit())).toBeGreaterThan(0);
    expect(w.health.hp).toBe(76);
  });
  it('dash i-frames block enemy hits; spikes still apply: damage, i-frames, Rush −75, no hitstun or knockback', () => {
    const w = arenaWorld();
    stepSpec(w, { dash: true });
    expect(w.body.dashIframes).toBe(true);
    expect(hurtPlayer(w, hit())).toBe(0);
    expect(w.health.hp).toBe(100);
    w.rush.value = 150;
    expect(hurtPlayer(w, { kind: 'hazard', cause: 'spikes', damageA: 20 })).toBeGreaterThan(0);
    expect(w.health.hp).toBe(80);
    expect(w.health.iframeTicks).toBe(COMBAT.HURT_IFRAMES_TICKS);
    expect(w.rush.value).toBe(75);
    expect(w.body.state).toBe('dash');
    expect(w.body.hitStopTicks).toBe(0);
  });
  it('knockback is 180 away from the attacker with vy −160, and the player gets 9 ticks of hit-stop', () => {
    const w = arenaWorld();
    hurtPlayer(w, hit({ attackerCx: 260 }));
    expect([w.body.vx, w.body.vy, w.body.state]).toEqual([-180, -160, 'hurt']);
    expect(w.body.hitStopTicks).toBe(9);
    const w2 = arenaWorld();
    hurtPlayer(w2, hit({ attackerCx: 100 }));
    expect(w2.body.vx).toBe(180);
    const w3 = arenaWorld();
    hurtPlayer(w3, hit({ playerKb: [300, -200] }));
    expect([w3.body.vx, w3.body.vy]).toEqual([-300, -200]);
  });
  it('hitstun: a dash is refused through the hit-stop and the 24-tick stun, then accepted (checklist 8)', () => {
    const w = arenaWorld();
    hurtPlayer(w, hit());
    let accepted = -1;
    for (let t = 1; t <= 60 && accepted < 0; t++) {
      const ev = stepSpec(w, { dash: t % 2 === 1 });
      if (ev.some((e) => e.t === 'move' && e.e === 'dashStart')) accepted = t;
    }
    expect(accepted).toBeGreaterThan(9 + 24);
    expect(accepted).toBeLessThanOrEqual(9 + 24 + 2);
  });
  it('a lethal hit kills: dead, cause = enemy def id, playerDied event, dead body', () => {
    const w = arenaWorld();
    w.health.hp = 5;
    hurtPlayer(w, hit());
    expect(w.health).toMatchObject({ hp: 0, dead: true, deathCause: 'bandit' });
    expect(w.events).toContainEqual({ t: 'playerDied', cause: 'bandit' });
    expect(w.body.state).toBe('dead');
  });
  it('a lethal spike hit reports cause spikes (01 test 36)', () => {
    const w = arenaWorld();
    w.health.hp = 10;
    hurtPlayer(w, { kind: 'hazard', cause: 'spikes', damageA: 20 });
    expect(w.health.deathCause).toBe('spikes');
  });
  it('the world steps the player and counts run ticks', () => {
    const w = arenaWorld();
    stepSpec(w, { moveX: 1 }, 30);
    expect(w.body.x).toBeGreaterThan(200);
    expect(w.tick).toBe(30);
    expect(w.runTicks).toBe(30);
  });
});
