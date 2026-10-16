import { describe, it, expect } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { gridFromRects } from '../level/build.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { canSee } from './awareness.ts';
import { resolvePlayerHits } from '../combat/resolve.ts';
import { enemyRect } from './enemy.ts';
import type { EnemySpawn } from './types.ts';

function world(enemies: EnemySpawn[], extra: { x0: number; y0: number; x1: number; y1: number; kind: 'solid' | 'oneway' }[] = [], player = 200): GameWorld {
  const grid = gridFromRects(60, 23, [{ x0: 0, y0: 20, x1: 59, y1: 22, kind: 'solid' }, ...extra]);
  const w = new GameWorld({ grid, spawn: { x: player, y: 320 }, enemies });
  for (const e of w.enemies) e.dormant = false;
  return w;
}

function ticksToAware(w: GameWorld, idx = 0, max = 400): number {
  for (let t = 1; t <= max; t++) { stepSpec(w, {}); if (w.enemies[idx].aware) return t; }
  return -1;
}

describe('noticing the player (04 §2.4, checklist 7–11)', () => {
  it('a Wolf facing the player 150 px away becomes aware after exactly 42 ticks', () => {
    expect(ticksToAware(world([{ enemy: 'wolf', x: 50, y: 320, facing: 1 }]))).toBe(42);
  });
  it('after noticing, it cannot start an attack for 30 more ticks (alert reaction)', () => {
    const w = world([{ enemy: 'wolf', x: 100, y: 320, facing: 1 }]);
    expect(ticksToAware(w)).toBe(42);
    let first = -1;
    for (let t = 1; t <= 100 && first < 0; t++) if (stepSpec(w, {}).some((e) => e.t === 'enemyTelegraph')) first = t;
    expect(first).toBeGreaterThan(30);
  });
  it('behind it, the range halves: 150 px behind never notices; 80 px behind does', () => {
    expect(ticksToAware(world([{ enemy: 'wolf', x: 350, y: 320, facing: 1 }]), 0, 300)).toBe(-1);
    expect(ticksToAware(world([{ enemy: 'wolf', x: 280, y: 320, facing: 1 }]), 0, 300)).toBe(42);
  });
  it('noticeTimeMult 2 doubles the time (84 ticks)', () => {
    const w = world([{ enemy: 'wolf', x: 50, y: 320, facing: 1 }]);
    w.noticeTimeMult = 2;
    expect(ticksToAware(w)).toBe(84);
  });
  it('a solid tile between a Bandit and the player blocks sight; a one-way platform does not', () => {
    const blocked = world([{ enemy: 'bandit', x: 100, y: 320, facing: 1 }], [{ x0: 9, y0: 17, x1: 9, y1: 19, kind: 'solid' }]);
    stepSpec(blocked, {}, 60);
    expect(blocked.enemies[0].noticeT).toBe(0);
    expect(canSee(blocked, blocked.enemies[0])).toBe(false);
    const oneway = world([{ enemy: 'bandit', x: 100, y: 320, facing: 1 }], [{ x0: 9, y0: 17, x1: 9, y1: 19, kind: 'oneway' }]);
    expect(canSee(oneway, oneway.enemies[0])).toBe(true);
  });
  it('a hit makes an unaware Bandit aware; the hit resolves with aware = false, a second hit that tick sees true', () => {
    const w = world([{ enemy: 'bandit', x: 260, y: 320, facing: 1 }]);
    const e = w.enemies[0];
    const seen: boolean[] = [];
    const orig = w.onPlayerLandedHit.bind(w);
    w.onPlayerLandedHit = (g, en) => { seen.push(en.aware); orig(g, en); };
    for (const inst of [1, 2]) {
      w.hitGroups.push({ id: w.newId(), owner: 'player', kind: 'melee', rect: enemyRect(e), spec: { damage: 1, kb: [0, 0], poise: 0, hitStop: 0, kind: 'melee' },
        active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: inst });
    }
    resolvePlayerHits(w);
    expect(seen).toEqual([false, true]);
    expect(e.aware).toBe(true);
    expect(e.ai.state).not.toBe('alert');                 // no alert reaction when made aware by a hit
  });
  it('a pack shares awareness at any distance; an unrelated Bandit 100 px away follows 36 ticks later (checklist 12)', () => {
    const w = world([
      { enemy: 'wolf', x: 400, y: 320, facing: -1, group: 'pack' },
      { enemy: 'wolf', x: 700, y: 320, facing: 1, group: 'pack' },
      { enemy: 'bandit', x: 500, y: 320, facing: 1 },
    ], [], 300);
    const t = ticksToAware(w);
    expect(t).toBeGreaterThan(0);
    expect(w.enemies[1].aware).toBe(true);
    expect(w.enemies[2].aware).toBe(false);
    stepSpec(w, {}, 35);
    expect(w.enemies[2].aware).toBe(false);
    stepSpec(w, {});
    expect(w.enemies[2].aware).toBe(true);
  });
});
