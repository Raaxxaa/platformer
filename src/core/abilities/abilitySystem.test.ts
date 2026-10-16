import { beforeAll, describe, expect, it } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { startForcedMove } from '../player/forcedMove.ts';
import { registerAbility } from './abilitySystem.ts';
import type { AbilityDef, AbilityId, AbilitySlot } from './types.ts';

const row = (cooldownS: number, charges: 1 | 2) => ({ cooldownS, charges });
function fakeDef(id: string, kind: AbilityDef['kind'], extra: Partial<AbilityDef> = {}, charges: 1 | 2 = 1): AbilityDef {
  return {
    id: id as AbilityId, name: id, cls: 'wizard', kind, startupS: 0, recoveryS: 0, groundMoveCap: 1, airGravityMult: 1, airHover: false,
    dashAttack: false, hits: {}, levels: [row(8, charges), row(8, charges), row(8, charges), row(8, charges), row(8, charges)], ...extra,
  };
}
const effects: { id: string; tick: number }[] = [];

beforeAll(() => {
  registerAbility('fake_cast', { effect: (w) => { effects.push({ id: 'fake_cast', tick: w.tick }); } },
    fakeDef('fake_cast', 'cast', { startupS: 0.20, recoveryS: 0.25, groundMoveCap: 0.3, airGravityMult: 0.5, airHover: true }));
  registerAbility('fake_instant', { start: (w) => { effects.push({ id: 'fake_instant', tick: w.tick }); return true; } }, fakeDef('fake_instant', 'instant'));
  registerAbility('fake_two', { start: () => true }, fakeDef('fake_two', 'instant', {}, 2));
  registerAbility('fake_fizzle', { start: () => false }, fakeDef('fake_fizzle', 'instant'));
  registerAbility('fake_move', {
    start: (w, c) => {
      startForcedMove(w.body, { vx: c.dir * 480, vy: 0, durationS: 0.2, gravity: false, endOnWall: true, endVelocity: 'clampToRun', cancelByJump: true, cancelByDash: true }, 'ability:fake_move');
      return true;
    },
  }, fakeDef('fake_move', 'move'));
});

function slot(id: string, charges = -1): AbilitySlot {
  return { id: id as AbilityId, level: 1, charges: charges < 0 ? (id === 'fake_two' ? 2 : 1) : charges, rechargeLeft: 0 };
}
function world(a: string | null, b: string | null = null): GameWorld {
  const w = arenaWorld();
  w.setLoadout({ weapons: [w.combat.slots[0], w.combat.slots[1]], abilities: [a ? slot(a) : null, b ? slot(b) : null] });
  stepSpec(w, {}, 3);
  effects.length = 0;
  return w;
}
function run(w: GameWorld, spec: InputSpec, n = 1) {
  return stepSpec(w, spec, n);
}

describe('buffer (03 §7.4)', () => {
  it('a press is kept 18 player ticks', () => {
    for (const [left, starts] of [[17, true], [19, false]] as const) {
      const w = world('fake_instant');
      const s = w.abilities.slots[0]!;
      s.charges = 0; s.rechargeLeft = left;
      run(w, { ability1: true }, 1);
      run(w, {}, 30);
      expect(effects.length > 0).toBe(starts);
    }
  });
  it('a press during hit-stop starts its window after hit-stop', () => {
    const w = world('fake_instant');
    w.body.hitStopTicks = 30;
    run(w, { ability1: true }, 1);
    run(w, {}, 28);
    expect(effects).toEqual([]);
    run(w, {}, 3);
    expect(effects.length).toBe(1);
  });
});

describe('activation and the state table (03 §7.4–7.5)', () => {
  it('a cast from a wall slide turns away from the wall', () => {
    const w = arenaWorld();
    w.abilities.slots = [slot('fake_cast'), null];
    w.teleportPlayer(30, 200);                       // next to the left wall, in the air
    run(w, { moveX: -1 }, 20);
    expect(w.body.state).toBe('wallSlide');
    run(w, { ability1: true }, 1);
    expect(w.body.state).toBe('air');
    expect(w.body.facing).toBe(1);
  });
  it('a cast from a dash ends the dash first; hurt buffers', () => {
    const w = world('fake_cast');
    run(w, { dash: true }, 1);
    run(w, {}, 2);
    expect(w.body.state).toBe('dash');
    run(w, { ability1: true }, 1);
    expect(w.body.state).not.toBe('dash');
    expect(w.abilities.cast).not.toBeNull();
    const h = world('fake_instant');
    h.body.state = 'hurt'; h.body.hurtTicks = 10; h.body.stateTicks = 0;
    run(h, { ability1: true }, 1);
    expect(effects).toEqual([]);
    run(h, {}, 12);
    expect(effects.length).toBe(1);
  });
  it('slot 1 is processed before slot 2', () => {
    const w = world('fake_instant', 'fake_two');
    const ev = run(w, { ability1: true, ability2: true }, 1).filter((e) => e.t === 'abilityUsed');
    expect(ev.map((e) => e.t === 'abilityUsed' && e.slot)).toEqual([0, 1]);
  });
});

describe('cast timing (03 §7.6)', () => {
  it('startup 24: the effect fires on T+24, free on T+24+30; move cap, facing lock', () => {
    const w = world('fake_cast');
    run(w, { ability1: true, moveX: -1 }, 1);
    const T = w.tick;
    expect(w.body.facing).toBe(-1);
    expect(w.mods.actionMoveMult).toBeCloseTo(0.3);
    run(w, { moveX: 1 }, 23);
    expect(effects).toEqual([]);
    expect(w.body.facing).toBe(-1);
    run(w, { moveX: 1 }, 1);
    expect(effects).toEqual([{ id: 'fake_cast', tick: T + 24 }]);
    run(w, {}, 29);
    expect(w.abilities.cast).not.toBeNull();
    run(w, {}, 1);
    expect(w.tick).toBe(T + 54);
    expect(w.abilities.cast).toBeNull();
  });
  it('hover in the air during startup', () => {
    const w = arenaWorld();
    w.abilities.slots = [slot('fake_cast'), null];
    w.teleportPlayer(300, 200);
    run(w, {}, 10);
    run(w, { ability1: true }, 1);
    const y = w.body.y;
    run(w, {}, 20);
    expect(w.body.y).toBe(y);
  });
});

describe('cancels (03 §7.6, checklist 16)', () => {
  it('jump in startup spends nothing; jump in recovery has spent', () => {
    const w = world('fake_cast');
    run(w, { ability1: true }, 1);
    run(w, {}, 5);
    run(w, { jump: true }, 1);
    expect(w.abilities.cast).toBeNull();
    expect(w.abilities.slots[0]).toMatchObject({ charges: 1, rechargeLeft: 0 });
    const r = world('fake_cast');
    run(r, { ability1: true }, 1);
    run(r, {}, 30);
    run(r, { jump: true }, 1);
    expect(r.abilities.cast).toBeNull();
    expect(r.abilities.slots[0]!.charges).toBe(0);
  });
  it('getting hurt in startup spends nothing', () => {
    const w = world('fake_cast');
    run(w, { ability1: true }, 1);
    run(w, {}, 3);
    w.onPlayerHitstun();
    expect(w.abilities.cast).toBeNull();
    expect(w.abilities.slots[0]!.charges).toBe(1);
  });
  it('a cast activation cancels a weapon attack', () => {
    const w = world('fake_cast');
    run(w, { attack1: true }, 1);
    run(w, {}, 3);
    expect(w.combat.current).not.toBeNull();
    run(w, { ability1: true }, 1);
    expect(w.combat.current).toBeNull();
  });
});

describe('cooldowns and charges (03 §7.7)', () => {
  it('an 8 s cooldown takes 960 player ticks; hit-stop ticks do not count', () => {
    const w = world('fake_instant');
    run(w, { ability1: true }, 1);
    expect(w.abilities.slots[0]).toMatchObject({ charges: 0, rechargeLeft: 960 });
    w.body.hitStopTicks = 40;
    run(w, {}, 40);
    run(w, {}, 959);
    expect(w.abilities.slots[0]!.charges).toBe(0);
    run(w, {}, 1);
    expect(w.abilities.slots[0]).toMatchObject({ charges: 1, rechargeLeft: 0 });
  });
  it('with 2 charges only one recharges at a time; leftover is lost', () => {
    const w = world('fake_two');
    run(w, { ability1: true }, 1);
    run(w, {}, 1);
    run(w, { ability1: true }, 1);
    expect(w.abilities.slots[0]).toMatchObject({ charges: 0, rechargeLeft: 958 });
    run(w, {}, 958);
    expect(w.abilities.slots[0]).toMatchObject({ charges: 1, rechargeLeft: 960 });
    run(w, {}, 960);
    expect(w.abilities.slots[0]).toMatchObject({ charges: 2, rechargeLeft: 0 });
  });
  it('fizzle spends nothing; a press with no charge emits abilityNotReady once', () => {
    const w = world('fake_fizzle');
    const ev = run(w, { ability1: true }, 1);
    expect(ev.map((e) => e.t)).toContain('abilityFizzle');
    expect(w.abilities.slots[0]).toMatchObject({ charges: 1, rechargeLeft: 0 });
    const n = world('fake_instant');
    n.abilities.slots[0]!.charges = 0; n.abilities.slots[0]!.rechargeLeft = 500;
    const ev2 = [...run(n, { ability1: true }, 1), ...run(n, {}, 20)];
    expect(ev2.filter((e) => e.t === 'abilityNotReady').length).toBe(1);
  });
  it('stage start fills every charge; death clears ability entities', () => {
    const w = world('fake_two');
    run(w, { ability1: true }, 1);
    w.abilityEntities.push({ id: 1, kind: 'test', step: () => true });
    w.onPlayerDied('test');
    expect(w.abilityEntities).toEqual([]);
    w.restart();
    expect(w.abilities.slots[0]).toMatchObject({ charges: 2, rechargeLeft: 0 });
  });
});

describe('move abilities', () => {
  it('start a ForcedMove on the press tick; another cast or move waits for it', () => {
    const w = world('fake_move', 'fake_cast');
    const x0 = w.body.x;
    run(w, { ability1: true }, 1);
    expect(w.body.state).toBe('forced');
    run(w, {}, 10);
    run(w, { ability2: true }, 1);
    expect(w.abilities.cast).toBeNull();
    run(w, {}, 12);
    expect(w.body.x - x0).toBe(96);
    run(w, {}, 2);                                  // the move ends in tick 25's movement step; the cast starts on 26
    expect(w.abilities.cast).not.toBeNull();       // the buffered cast starts once the move ends
  });
});
