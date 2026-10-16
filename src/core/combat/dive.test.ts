import { describe, it, expect } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { stepSpec, arenaWorld } from '../testkit/combatWorld.ts';
import type { EnemySpawn } from '../enemies/types.ts';

function airWorld(enemies: EnemySpawn[], y = 200): GameWorld {
  const base = arenaWorld();
  const w = new GameWorld({ grid: base.grid, spawn: { x: 200, y }, enemies });
  for (const e of w.enemies) e.dormant = false;
  return w;
}

describe('dive slam damage (02 §9.7, §10.5)', () => {
  it('a Greatsword (heavy) dive onto a Wolf hits with the descent box for 26 and bounces; no impact', () => {
    const w = airWorld([{ enemy: 'wolf', x: 200, y: 320, facing: -1 }]);
    stepSpec(w, { moveY: 1, attack1: true });
    let bounced = false;
    for (let i = 0; i < 60 && !bounced; i++) bounced = stepSpec(w, {}).some((e) => e.t === 'move' && e.e === 'diveBounce');
    expect(bounced).toBe(true);
    expect(w.enemies[0].hp).toBe(4);
    expect(w.body.vy).toBe(-360);
    expect(w.body.state).toBe('air');
    stepSpec(w, {}, 60);
    expect(w.enemies[0].hp).toBe(4);                         // no impact hit after the bounce
  });
  it('a War Maul dive landing between two Bandits hits both for 30, knocks them down 120 ticks and shakes medium', () => {
    const w = airWorld([{ enemy: 'bandit', x: 160, y: 320, facing: 1 }, { enemy: 'bandit', x: 250, y: 320, facing: -1 }]);
    stepSpec(w, { moveY: 1, attack2: true });
    let shook = false, landed = false;
    for (let i = 0; i < 60 && !landed; i++) {
      const ev = stepSpec(w, {});
      landed = w.enemies[0].hp < 40;
      shook ||= ev.some((e) => e.t === 'shake' && e.level === 'medium');
    }
    expect(w.enemies.map((e) => e.hp)).toEqual([10, 10]);
    expect(w.enemies.map((e) => e.control)).toEqual([{ type: 'knockdown', ticks: 120 }, { type: 'knockdown', ticks: 120 }]);
    expect(shook).toBe(true);
  });
  it('a Bandit Brute hit by the shockwave is knocked down for 60 ticks', () => {
    const w = airWorld([{ enemy: 'bandit_brute', x: 250, y: 320, facing: -1 }]);
    stepSpec(w, { moveY: 1, attack2: true });
    for (let i = 0; i < 60 && w.enemies[0].hp === 160; i++) stepSpec(w, {});
    expect(w.enemies[0].hp).toBe(130);
    expect(w.enemies[0].control).toEqual({ type: 'knockdown', ticks: 60 });
  });
  it('each enemy is hit at most once per dive; the impact lasts 6 ticks', () => {
    const w = airWorld([{ enemy: 'training_dummy', x: 230, y: 320, facing: 1 }]);
    stepSpec(w, { moveY: 1, attack1: true });
    const hits: number[] = [];
    for (let i = 0; i < 80; i++) for (const e of stepSpec(w, {})) if (e.t === 'hit') hits.push(i);
    expect(hits.length).toBe(1);
  });
  it('down + attack during an air attack startup starts a dive; the cancelled step does not count (02 test 32)', () => {
    const w = airWorld([], 150);
    stepSpec(w, { attack1: true }); stepSpec(w, {});
    expect(w.combat.current?.phase).toBe('startup');
    const ev = stepSpec(w, { moveY: 1, attack1: true });
    expect(ev).toContainEqual({ t: 'move', e: 'diveStart' });
    expect(w.combat.current).toBeNull();
    expect(w.combat.comboStep[0]).toBe(0);
  });
});
