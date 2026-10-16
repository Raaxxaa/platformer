import { describe, it, expect } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { gridFromRects } from '../level/build.ts';
import type { InputSpec } from '../sim/playerSim.ts';

type Trace = { slot: number; step: number; phase: string } | null;

/** Steps n ticks and records the current attack each tick. */
function trace(w: GameWorld, spec: (t: number) => InputSpec, n: number): Trace[] {
  const out: Trace[] = [];
  for (let t = 1; t <= n; t++) {
    stepSpec(w, spec(t));
    const c = w.combat.current;
    out.push(c ? { slot: c.slot, step: c.step, phase: c.phase } : null);
  }
  return out;
}

/** Run-length encoding of "step:phase" labels. */
function runs(tr: Trace[]): string[] {
  const out: string[] = [];
  let last = '', n = 0;
  for (const x of tr) {
    const k = x ? `${x.step}:${x.phase}` : '-';
    if (k === last) n++;
    else { if (n) out.push(`${last}×${n}`); last = k; n = 1; }
  }
  out.push(`${last}×${n}`);
  return out;
}

const GS_CYCLE = ['0:startup×24', '0:active×12', '0:recovery×24', '1:startup×24', '1:active×12', '1:recovery×24', '2:startup×36', '2:active×18', '2:recovery×42'];

describe('player attacks (02 §9)', () => {
  it('holding J runs Greatsword steps 1 → 2 → 3 → 1 with 24/12/24, 24/12/24, 36/18/42 ticks', () => {
    const w = arenaWorld();
    const r = runs(trace(w, () => ({ attack1: true }), 216 + 10));
    expect(r.slice(0, 9)).toEqual(GS_CYCLE);
    expect(r[9]).toBe('0:startup×10');
  });
  it('mashing gives the same timing as holding; only one press is queued', () => {
    const w = arenaWorld();
    const r = runs(trace(w, (t) => ({ attack1: t % 2 === 1 }), 216));
    expect(r).toEqual(GS_CYCLE);
    const w2 = arenaWorld();
    stepSpec(w2, { attack1: true }); stepSpec(w2, {}); stepSpec(w2, { attack1: true }); stepSpec(w2, {}); stepSpec(w2, { attack1: true });
    expect(w2.combat.queued).toBe(true);
    const r2 = runs(trace(w2, () => ({}), 200));
    expect(r2.filter((x) => x.endsWith('startup×24') || x.startsWith('2:')).length).toBeLessThanOrEqual(2);   // step 1 then one queued step 2
    expect(r2.some((x) => x.startsWith('2:'))).toBe(false);
  });
  it('a press within 42 ticks after a step ends continues the combo; later it restarts at step 1', () => {
    for (const [gap, expected] of [[42, 1], [43, 0]] as const) {
      const w = arenaWorld();
      stepSpec(w, { attack1: true }); stepSpec(w, {}, 59);   // step 1 ends after tick 60
      stepSpec(w, {});
      expect(w.combat.current).toBeNull();
      stepSpec(w, {}, gap - 2);
      stepSpec(w, { attack1: true });
      expect(w.combat.current?.step).toBe(expected);
    }
  });
  it('dash on any startup tick of step 3 cancels with no hit; the next press starts step 3 again (checklist 9)', () => {
    for (const k of [2, 18, 36]) {
      const w = arenaWorld();
      stepSpec(w, { attack1: true }, 121);           // held: steps 1 and 2 done, step 3 starts on tick 121
      expect(w.combat.current?.step).toBe(2);
      while (w.combat.current!.phaseTicks < k - 1) stepSpec(w, {});
      const ev = stepSpec(w, { dash: true });
      expect(ev).toContainEqual({ t: 'move', e: 'dashStart' });
      expect(w.combat.current).toBeNull();
      expect(w.hitGroups).toEqual([]);
      stepSpec(w, {}, 18);
      stepSpec(w, { attack1: true });
      expect(w.combat.current?.step).toBe(2);
    }
  });
  it('a dash during recovery keeps the combo progress', () => {
    const w = arenaWorld();
    stepSpec(w, { attack1: true }); stepSpec(w, {}, 40);
    expect(w.combat.current?.phase).toBe('recovery');
    stepSpec(w, { dash: true }); stepSpec(w, {}, 18);
    stepSpec(w, { attack1: true });
    expect(w.combat.current?.step).toBe(1);
  });
  it('K during Greatsword startup waits until recovery, then switches; the Greatsword combo resets', () => {
    const w = arenaWorld();
    stepSpec(w, { attack1: true }); stepSpec(w, {}, 3);
    stepSpec(w, { attack2: true });
    expect(w.combat.current?.slot).toBe(0);
    stepSpec(w, {}, 31);                              // tick 36: still active
    expect(w.combat.current).toMatchObject({ slot: 0, phase: 'active' });
    stepSpec(w, {});                                  // recovery starts: switch
    expect(w.combat.current).toMatchObject({ slot: 1, step: 0, phase: 'startup' });
    expect(w.combat.comboStep[0]).toBe(0);
  });
  it('both buttons on the same tick: weapon 1', () => {
    const w = arenaWorld();
    stepSpec(w, { attack1: true, attack2: true });
    expect(w.combat.current?.slot).toBe(0);
    stepSpec(w, {}, 70);
    expect(w.combat.current).toBeNull();
  });
  it('on the ground a heavy step caps run speed at 42.5 px/s; in the air there is no cap (01 test 32)', () => {
    const w = arenaWorld();
    stepSpec(w, { moveX: 1 }, 30);
    expect(w.body.vx).toBe(170);
    stepSpec(w, { moveX: 1, attack1: true }, 30);
    expect(w.body.vx).toBeCloseTo(42.5, 9);
    const a = arenaWorld();
    stepSpec(a, { moveX: 1, dash: true, jump: true });
    stepSpec(a, { moveX: 1, jump: true, attack1: true });
    const vx0 = a.body.vx;
    stepSpec(a, { moveX: 1, jump: true, attack1: true });
    expect(a.body.vx).toBeCloseTo(vx0 - 600 / 120, 9);
    expect(a.mods.actionMoveMult).toBe(0.25);
  });
  it('facing turns to moveX at step start, then stays locked', () => {
    const w = arenaWorld();
    stepSpec(w, { moveX: -1, attack1: true });
    expect(w.body.facing).toBe(-1);
    stepSpec(w, { moveX: 1 }, 10);
    expect(w.body.facing).toBe(-1);
    stepSpec(w, {}, 60);
    stepSpec(w, { moveX: 1 });
    expect(w.body.facing).toBe(1);
  });
  it('an attack press during a slide ends it that tick: ground, no i-frames, |vx| ≤ 170, cooldown (01 test 34)', () => {
    const w = arenaWorld();
    stepSpec(w, { moveX: 1, moveY: 1, dash: true }); stepSpec(w, { moveX: 1 }, 3);
    const ev = stepSpec(w, { moveX: 1, attack1: true });
    expect(ev).toContainEqual({ t: 'move', e: 'slideEnd' });
    expect(w.body.state).toBe('ground');
    expect(w.body.dashIframes).toBe(false);
    expect(Math.abs(w.body.vx)).toBeLessThanOrEqual(170);
    expect(w.body.dashReadyPt).toBe(w.body.pt + 42);
    expect(w.combat.current?.step).toBe(0);
  });
  it('under a 1-tile ceiling the attack-ended slide becomes crawl', () => {
    const grid = gridFromRects(60, 23, [{ x0: 0, y0: 20, x1: 59, y1: 22, kind: 'solid' }, { x0: 16, y0: 0, x1: 30, y1: 18, kind: 'solid' }]);
    const w = new GameWorld({ grid, spawn: { x: 230, y: 320 } });
    stepSpec(w, { moveX: 1, moveY: 1, dash: true }); stepSpec(w, { moveX: 1 }, 20);
    expect(w.body.x).toBeGreaterThan(262);
    stepSpec(w, { moveX: 1, attack1: true });
    expect(w.body.state).toBe('crawl');
  });
  it('an attack press during a wall slide detaches, faces away and attacks', () => {
    const grid = gridFromRects(60, 23, [{ x0: 0, y0: 20, x1: 59, y1: 22, kind: 'solid' }, { x0: 20, y0: 0, x1: 20, y1: 19, kind: 'solid' }]);
    const w = new GameWorld({ grid, spawn: { x: 314, y: 150 } });
    stepSpec(w, { moveX: 1 }, 3);
    expect(w.body.state).toBe('wallSlide');
    stepSpec(w, { moveX: 1, attack1: true });
    expect(w.body.state).not.toBe('ground');      // detached (it may slide again mid air-attack, 01 §8.2)
    expect(w.body.lastWallPt).toBeGreaterThanOrEqual(w.body.pt - 1);
    expect(w.body.facing).toBe(-1);
    expect(w.combat.current?.step).toBe(0);
  });
  it('at Rush level 3 a Greatsword cycle takes 150 ticks (02 test 18)', () => {
    const w = arenaWorld();
    w.rush.value = 300;
    const tr = trace(w, () => ({ attack1: true }), 151);
    expect(tr[149]?.step).toBe(2);
    expect(tr[150]).toMatchObject({ step: 0, phase: 'startup' });
  });
  it('an empty slot does nothing', () => {
    const w = arenaWorld();
    w.combat.slots[1] = null;
    stepSpec(w, { attack2: true });
    expect(w.combat.current).toBeNull();
  });
  it('the active phase has a hit group at the weapon box; startup and recovery have none', () => {
    const w = arenaWorld();
    stepSpec(w, { attack1: true }, 24);
    expect(w.hitGroups).toEqual([]);
    stepSpec(w, {});
    expect(w.hitGroups.length).toBe(1);
    expect(w.hitGroups[0]).toMatchObject({ owner: 'player', kind: 'melee', rect: { x: 202, y: 290, w: 40, h: 28 } });
    stepSpec(w, {}, 12);
    expect(w.hitGroups).toEqual([]);
  });
});
