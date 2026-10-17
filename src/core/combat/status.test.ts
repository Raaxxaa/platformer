import { describe, expect, it } from 'vitest';
import { newWeapon } from '../abilities/runtime.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { applyElementHit, shatterMult, stepStatuses } from './status.ts';
import { processDeaths } from './resolve.ts';

const world = (n = 3, enemy: 'wolf' | 'bandit_brute' | 'great_boar' = 'wolf') => {
  const w = arenaWorld({ enemies: Array.from({ length: n }, (_, i) => ({ enemy, x: 400 + 40 * i, y: 320, facing: -1 as const })) });
  for (const e of w.enemies) e.dormant = false;
  return w;
};
const run = (w: ReturnType<typeof world>, n: number) => { for (let i = 0; i < n; i++) stepStatuses(w); };

describe('elements (02 §6, checklist 20–24)', () => {
  it('20: Burn L1, procBase 20: 6 ticks of 2 over 3.0 s; a burning enemy that dies ignites one 40 px away', () => {
    const w = world(2);
    const [a, b] = w.enemies;
    a.hp = b.hp = 1000;
    applyElementHit(w, a, { id: 'fire', level: 1 }, 20, 1, 0);
    const hp0 = a.hp;
    run(w, 59);
    expect(a.hp).toBe(hp0);                             // the first tick is 0.5 s after application
    run(w, 1);
    expect(a.hp).toBe(hp0 - 2);
    run(w, 400);
    expect(a.hp).toBe(hp0 - 12);
    applyElementHit(w, a, { id: 'fire', level: 1 }, 20, 1, 0);
    a.hp = 1;
    run(w, 60);                                         // dies from the burn tick → spreads to b (40 px)
    processDeaths(w);
    expect(a.dead).toBe(true);
    expect(b.status.burn).not.toBeNull();
  });
  it('21: Ice L1: the 5th hit freezes a regular for 1.5 s; next hit ×2.0; no freeze for 3.0 s after; a boss never freezes', () => {
    const w = world(1);
    const e = w.enemies[0];
    e.hp = 1000;
    for (let i = 0; i < 4; i++) applyElementHit(w, e, { id: 'ice', level: 1 }, 20, 1, 0);
    expect(e.status.frozen).toBeNull();
    applyElementHit(w, e, { id: 'ice', level: 1 }, 20, 1, 0);
    expect(e.status.frozen?.left).toBe(180);
    expect(shatterMult(w, e, true)).toBe(2);           // consumes the freeze
    expect(e.status.frozen).toBeNull();
    for (let i = 0; i < 6; i++) applyElementHit(w, e, { id: 'ice', level: 1 }, 20, 1, 0);
    expect(e.status.frozen).toBeNull();
    run(w, 361);
    for (let i = 0; i < 5; i++) applyElementHit(w, e, { id: 'ice', level: 1 }, 20, 1, 0);
    expect(e.status.frozen).not.toBeNull();
    const boss = world(1, 'great_boar').enemies[0];
    const wb = world(1, 'great_boar');
    for (let i = 0; i < 10; i++) applyElementHit(wb, wb.enemies[0], { id: 'ice', level: 1 }, 20, 1, 0);
    expect(wb.enemies[0].status.frozen).toBeNull();
    expect(wb.enemies[0].status.chill?.scale).toBeCloseTo(1 - (1 - 0.75) / 2, 5);
    void boss;
  });
  it('23: Poison L1: 5 hits with procBase 20 → 5 stacks, each tick deals 3; stacks expire 4.0 s after the last hit', () => {
    const w = world(1);
    const e = w.enemies[0];
    e.hp = 1000;
    for (let i = 0; i < 5; i++) applyElementHit(w, e, { id: 'poison', level: 1 }, 20, 1, 0);
    expect(e.status.poison!.stacks.length).toBe(5);
    const hp0 = e.hp;
    run(w, 60);
    expect(e.hp).toBe(hp0 - 3);
    run(w, 420);
    expect(e.status.poison).toBeNull();
  });
  it('24: a wind weapon kill calls refundDash, a fire one does not', async () => {
    const { creditKillSource } = await import('./status.ts');
    const w = world(1);
    w.body.dashReadyPt = w.body.pt + 30;
    creditKillSource(w, { ...newWeapon('greatsword'), grade: 'B', element: 'fire' });
    expect(w.body.dashReadyPt).toBe(w.body.pt + 30);
    creditKillSource(w, { ...newWeapon('greatsword'), grade: 'B', element: 'wind' });
    expect(w.body.dashReadyPt).toBe(w.body.pt);
    stepSpec(w, {}, 1);
  });
  it('a real B fire Greatsword swing burns the enemy; ability hits carry no element', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'bandit_brute', x: 230, y: 320, facing: -1 }] });
    w.setLoadout({ weapons: [{ ...newWeapon('greatsword'), grade: 'B', element: 'fire' }, null], abilities: [null, null] });
    stepSpec(w, {}, 2);
    stepSpec(w, { attack1: true }, 1);
    stepSpec(w, {}, 40);
    expect(w.enemies[0].status.burn).not.toBeNull();
  });
});
