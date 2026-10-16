import { describe, it, expect } from 'vitest';
import mini from './fixtures/mini.json';
import { buildWorldParts, kindAt, loadLevel } from './loadLevel.ts';

describe('loadLevel (06 §13)', () => {
  const d = loadLevel(mini);
  it('reads the map and its tiles', () => {
    expect([d.id, d.kind, d.stage, d.widthTiles, d.heightTiles]).toEqual(['mini', 'stage', 1, 24, 10]);
    expect(kindAt(d, 0, 8)).toBe('solid');
    expect(kindAt(d, 6, 8)).toBe('spikeUp');
    expect(kindAt(d, 12, 8)).toBe('oneway');
    expect(kindAt(d, 0, 0)).toBe('empty');
  });
  it('anchors points at the feet or the tile center', () => {
    const p = d.objects.find((o) => o.type === 'player_start')!;
    expect([p.x, p.y]).toEqual([1 * 16 + 8, 8 * 16]);
    const l = d.objects.find((o) => o.type === 'lucky_block')!;
    expect([l.x, l.y]).toEqual([4 * 16 + 8, 6 * 16 + 8]);
    const path = d.objects.find((o) => o.type === 'main_path')!;
    expect(path.points![2]).toEqual({ x: 20 * 16 + 8, y: 7 * 16 + 8 });
  });
  it('objects are sorted by id and keep their properties', () => {
    expect(d.objects.map((o) => o.id)).toEqual([...d.objects.map((o) => o.id)].sort((a, b) => a - b));
    const w = d.objects.find((o) => o.type === 'enemy' && o.props.enemy === 'wolf')!;
    expect(w.props).toEqual({ enemy: 'wolf', facing: -1, group: 'p1' });
  });
  it('a flipped gid throws, and so does a non-aligned rect', () => {
    const bad = structuredClone(mini) as any;
    bad.layers[0].data[0] = 0x80000001;
    expect(() => loadLevel(bad)).toThrow(/flip/);
    const bad2 = structuredClone(mini) as any;
    bad2.layers.find((l: any) => l.name === 'zones').objects.find((o: any) => o.type === 'exit').x = 5;
    expect(() => loadLevel(bad2)).toThrow(/tile-aligned/);
  });
  it('builds world parts: doors are bodies, combat doors start open, timed doors closed', () => {
    const parts = buildWorldParts(d);
    expect(parts.grid.w).toBe(24);
    const doors = parts.bodies.filter((b) => b.type === 'arena_door');
    expect(doors.map((b) => b.active)).toEqual([false, false]);
    expect(parts.bodies.find((b) => b.type === 'timed_door')).toMatchObject({ id: 'td1', active: true, noTeleport: true });
    expect(parts.spawns.map((s) => [s.enemy, s.wave, s.arena])).toEqual([['wolf', 0, ''], ['bandit', 1, 'a1']]);
  });
});
