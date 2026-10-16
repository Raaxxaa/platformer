import { describe, it, expect } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { stepAi } from './ai.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { gridFromRects } from '../level/build.ts';
import type { EnemySpawn } from './types.ts';

function engaged(enemies: EnemySpawn[], seed = 1): GameWorld {
  const w = arenaWorld({ enemies, seed });
  for (const e of w.enemies) { e.dormant = false; e.aware = true; e.ai.state = 'engage'; }
  return w;
}

describe('enemy AI (04 §2.5–2.6)', () => {
  it('an engaged Bandit closes in and attacks with telegraphs', () => {
    const w = engaged([{ enemy: 'bandit', x: 330, y: 320, facing: -1 }]);
    const tele: string[] = [];
    for (let i = 0; i < 400; i++) for (const e of stepSpec(w, {})) if (e.t === 'enemyTelegraph') tele.push(e.attackId);
    expect(tele.length).toBeGreaterThan(0);
    expect(w.enemies[0].x).toBeLessThan(330);
    expect(w.health.hp).toBeLessThan(100);
  });
  it('with 3 Bandits in range and off cooldown, at most 2 are in Tele or Act at once (checklist 13)', () => {
    const w = engaged([{ enemy: 'bandit', x: 180, y: 320, facing: 1 }, { enemy: 'bandit', x: 222, y: 320, facing: -1 }, { enemy: 'bandit', x: 228, y: 320, facing: -1 }]);
    w.health.iframeTicks = 100000;                           // keep the player standing there
    let maxBusy = 0;
    for (let i = 0; i < 600; i++) {
      stepSpec(w, {});
      const busy = w.enemies.filter((e) => e.ai.attack && (e.ai.attack.phase === 'tele' || e.ai.attack.phase === 'act')).length;
      maxBusy = Math.max(maxBusy, busy);
    }
    expect(maxBusy).toBe(2);
  });
  it('a Bandit Archer whose center is outside the camera view never starts Arrow (checklist 14)', () => {
    const w = engaged([{ enemy: 'bandit_archer', x: 360, y: 320, facing: -1 }]);
    const e = w.enemies[0];
    e.ai.gapTicks = 0;
    w.camera.x = 400;                                       // view 400–1040: the archer is outside
    for (let i = 0; i < 20; i++) stepAi(w, e);
    expect(e.ai.attack).toBeNull();
    w.camera.x = 0;
    stepAi(w, e);
    expect(e.ai.attack?.def.id).toBe('arrow');
  });
  it('the same seed makes the same attack choices; another seed can differ', () => {
    // A Brute 44 px away can use both Club Swing (≤ 48) and Overhead Smash (≤ 56): a weighted roll on enemyAI.
    const run = (seed: number) => {
      const w = engaged([{ enemy: 'bandit_brute', x: 244, y: 320, facing: -1 }], seed);
      const e = w.enemies[0];
      const picks: string[] = [];
      for (let i = 0; i < 30; i++) {
        e.ai.attack = null; e.ai.state = 'engage'; e.ai.gapTicks = 0; e.ai.cooldowns.clear(); e.token = null;
        stepAi(w, e);
        picks.push(e.ai.attack!.def.id);
      }
      return picks.join(',');
    };
    expect(run(7)).toBe(run(7));
    expect(run(7)).toContain('club_swing');
    expect(run(7)).toContain('overhead_smash');
    expect([11, 12, 13].some((s) => run(s) !== run(7))).toBe(true);
  });
  it('an unaware patrolling Bandit walks between its ends and pauses', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'bandit', x: 700, y: 320, facing: 1, patrol: 32 }] });
    const e = w.enemies[0];
    e.dormant = false;
    let minX = 1e9, maxX = -1e9;
    for (let i = 0; i < 600; i++) { stepSpec(w, {}); minX = Math.min(minX, e.x); maxX = Math.max(maxX, e.x); }
    expect(e.aware).toBe(false);
    expect(maxX).toBeGreaterThanOrEqual(731);
    expect(minX).toBeLessThanOrEqual(669);
  });
  it('an aware enemy returns home after the player is beyond loseRange for 5 s', () => {
    const grid = gridFromRects(60, 23, [{ x0: 0, y0: 20, x1: 59, y1: 22, kind: 'solid' }, { x0: 40, y0: 0, x1: 40, y1: 19, kind: 'solid' }]);
    const w = new GameWorld({ grid, spawn: { x: 200, y: 320 }, enemies: [{ enemy: 'bandit', x: 900, y: 320, facing: -1 }] });
    const e = w.enemies[0];
    e.dormant = false; e.aware = true; e.ai.state = 'engage';
    for (let i = 0; i < 601; i++) stepSpec(w, {});
    expect(['return', 'idle']).toContain(w.enemies[0].ai.state);
  });
});
