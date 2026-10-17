import { describe, it, expect } from 'vitest';
import mini from '../level/fixtures/mini.json';
import { loadLevel } from '../level/loadLevel.ts';
import { GameWorld } from './gameWorld.ts';
import { fnv1a32 } from '../rng.ts';

describe('GameWorld.fromLevel (M3 Task 4)', () => {
  const d = loadLevel(mini);
  it('places the player at player_start (feet anchor) with its facing', () => {
    const w = GameWorld.fromLevel(d, { seedText: 'ABC' });
    expect([w.body.x, w.body.y, w.body.facing]).toEqual([24, 128, 1]);
  });
  it('adds the placed enemies dormant, but not the wave spawns', () => {
    const w = GameWorld.fromLevel(d, { seedText: 'ABC' });
    expect(w.enemies.map((e) => e.def.id)).toEqual(['wolf']);
    expect(w.enemies[0].dormant).toBe(true);
    expect(w.enemies[0].facing).toBe(-1);
    expect(w.waveSpawns.map((s) => [s.enemy, s.wave, s.arena])).toEqual([['bandit', 1, 'a1']]);
  });
  it('doors are bodies; keys and chests are real loot, the rest still markers', () => {
    const w = GameWorld.fromLevel(d, { seedText: 'ABC' });
    const doors = w.bodies.list.filter((b) => b.id.startsWith('arena_door'));
    expect(doors.map((b) => b.active)).toEqual([false, false]);
    expect(w.bodies.get('td1')?.active).toBe(true);
    expect(w.grid.kindAt(10, 6)).toBe('solid');             // the timed door blocks
    expect(w.markers.map((m) => m.type)).toEqual([]);
    expect(w.luckyBlocks.length).toBe(1);
    expect(w.groundItems.filter((i) => i.key).length).toBe(1);
    expect(w.chests.map((c) => c.kind)).toEqual(['timed']);
  });
  it('the run seed is fnv1a32 of the seed text, and the same seed gives the same stream values', () => {
    const a = GameWorld.fromLevel(d, { seedText: 'ABC' }), b = GameWorld.fromLevel(d, { seedText: 'ABC' });
    expect(a.run.runSeed).toBe(fnv1a32('ABC'));
    expect(a.runSeed).toBe(fnv1a32('ABC'));
    expect([a.rng.enemyAI.next(), a.rng.combat.next()]).toEqual([b.rng.enemyAI.next(), b.rng.combat.next()]);
    expect(GameWorld.fromLevel(d, { seedText: 'XYZ' }).rng.enemyAI.next()).not.toBe(GameWorld.fromLevel(d, { seedText: 'ABC' }).rng.enemyAI.next());
  });
  it('the camera stays inside the level rectangle', () => {
    const w = GameWorld.fromLevel(d, { seedText: 'ABC' });
    expect(w.camera.bounds).toEqual({ x: 0, y: 0, w: 24 * 16, h: 10 * 16 });
  });
});
