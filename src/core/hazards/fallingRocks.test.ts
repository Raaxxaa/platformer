import { describe, expect, it } from 'vitest';
import { FALLING_ROCKS } from '../../data/hazards.ts';
import type { Rect } from '../combat/hitGroups.ts';
import { gridFromRects } from '../level/build.ts';
import type { LevelObject } from '../level/loadLevel.ts';
import { Bodies } from '../physics/bodies.ts';
import { createFallingRocks, stepFallingRocks, type FallingRocksState } from './fallingRocks.ts';

const zone = (props: LevelObject['props'] = {}): LevelObject => ({ id: 7, type: 'falling_rocks', x: 32, y: 32, w: 128, h: 320, props });
const floorGrid = () => gridFromRects(20, 30, [{ x0: 0, y0: 24, x1: 19, y1: 29, kind: 'solid' }]);
const player: Rect = { x: 74, y: 200, w: 12, h: 24 };
const outside: Rect = { x: 200, y: 200, w: 12, h: 24 };
const step = (state: FallingRocksState, count: number, box: Rect = player, scale = 1, grid = floorGrid()): boolean[] =>
  Array.from({ length: count }, () => stepFallingRocks(state, grid, box, scale));
const rock = (state: FallingRocksState, x: number, y: number) => state.rocks.push({ id: 99, zoneId: 7, x, y, w: 16, h: 16 });

describe('falling-rock level hazards (06 §10)', () => {
  it('marks on entry tick 36, keeps all 72 warning ticks, and only moves the rock on its next tick', () => {
    const s = createFallingRocks([zone()]);
    step(s, 35); expect(s.markers).toHaveLength(0);
    step(s, 1); expect(s.markers).toEqual([{ id: 1, zoneId: 7, x: 80, floorY: 384, topY: 32, ticks: 72 }]);
    step(s, 71); expect(s.markers[0].ticks).toBe(1); expect(s.rocks).toHaveLength(0);
    step(s, 1); expect(s.markers).toHaveLength(0); expect(s.rocks).toEqual([{ id: 1, zoneId: 7, x: 80, y: 32, w: 16, h: 16 }]);
    step(s, 1); expect(s.rocks[0].y).toBe(35);
  });

  it('starts only when the player center is inside and clamps the chosen x eight pixels from either edge', () => {
    const s = createFallingRocks([zone()]);
    step(s, 50, { x: 20, y: 200, w: 20, h: 24 }); expect(s.markers).toHaveLength(0);
    step(s, 36, { x: 27, y: 200, w: 12, h: 24 }); expect(s.markers[0].x).toBe(40);
    step(s, 1, outside);
    step(s, 36, { x: 153, y: 200, w: 12, h: 24 }); expect(s.markers.at(-1)?.x).toBe(152);
    const edge = createFallingRocks([zone()]);
    step(edge, 50, { x: 154, y: 200, w: 12, h: 24 }); expect(edge.markers).toHaveLength(0);
  });

  it('repeats marks 240 ticks apart by default and honors a zone interval', () => {
    const normal = createFallingRocks([zone()]);
    step(normal, 36); expect(normal.markers[0].id).toBe(1);
    step(normal, 239); expect(normal.markers).toHaveLength(0);
    step(normal, 1); expect(normal.markers[0].id).toBe(2);
    const custom = createFallingRocks([zone({ interval: 0.5 })]);
    step(custom, 36 + 59); expect(custom.markers).toHaveLength(1);
    step(custom, 1); expect(custom.markers).toHaveLength(2);
  });

  it('resets entry delay on leaving but keeps a warning already placed at its original x', () => {
    const s = createFallingRocks([zone()]);
    step(s, 20); step(s, 1, outside); step(s, 35); expect(s.markers).toHaveLength(0);
    step(s, 1); const mark = { ...s.markers[0] };
    step(s, 20, outside); expect(s.markers[0]).toEqual({ ...mark, ticks: 52 });
    step(s, 36, { ...player, x: 110 }); expect(s.markers).toHaveLength(2);
    expect(s.markers[0].x).toBe(80); expect(s.markers[1].x).toBe(116);
    step(s, 16, outside); expect(s.rocks[0].x).toBe(80);
  });

  it('scales entry, warning, repeat timers and falling speed with worldTimeScale', () => {
    const s = createFallingRocks([zone()]);
    step(s, 71, player, 0.5); expect(s.markers).toHaveLength(0);
    step(s, 1, player, 0.5); expect(s.markers[0].ticks).toBe(72);
    step(s, 143, player, 0.5); expect(s.rocks).toHaveLength(0);
    step(s, 1, player, 0.5); expect(s.rocks[0].y).toBe(32);
    step(s, 10, player, 0.5); expect(s.rocks[0].y).toBe(47);
    step(s, 325, player, 0.5); expect(s.markers).toHaveLength(0);
    step(s, 1, player, 0.5); expect(s.markers[0].id).toBe(2);
  });

  it('does not advance or report a hit while world time is stopped', () => {
    const s = createFallingRocks([zone()]); step(s, 36); rock(s, 80, 205);
    const before = structuredClone(s);
    expect(step(s, 10, player, 0)).toEqual(Array(10).fill(false)); expect(s).toEqual(before);
  });

  it('marks the first solid floor below the player, ignoring one-way tiles and bodies', () => {
    const g = floorGrid(); g.bodies = new Bodies(20, 30);
    g.bodies.add({ id: 'ledge', x: 64, y: 288, w: 32, h: 16, oneWay: true, surface: 'normal', grabbable: false, noTeleport: false, active: true });
    const s = createFallingRocks([zone()]); step(s, 36, player, 1, g); expect(s.markers[0].floorY).toBe(384);
    g.bodies.add({ id: 'floor', x: 64, y: 320, w: 32, h: 16, oneWay: false, surface: 'normal', grabbable: false, noTeleport: false, active: true });
    const bodyFloor = createFallingRocks([zone()]); step(bodyFloor, 36, player, 1, g); expect(bodyFloor.markers[0].floorY).toBe(320);
    g.bodies.setActive('floor', false);
    const inactive = createFallingRocks([zone()]); step(inactive, 36, player, 1, g); expect(inactive.markers[0].floorY).toBe(384);
  });

  it('passes one-way tiles, then shatters on a solid tile without passing through it', () => {
    const g = gridFromRects(20, 30, [
      { x0: 0, y0: 8, x1: 19, y1: 8, kind: 'oneway' },
      { x0: 0, y0: 20, x1: 19, y1: 20, kind: 'ice' },
    ]);
    const s = createFallingRocks([]); rock(s, 80, 100);
    step(s, 20, outside, 1, g); expect(s.rocks[0].y).toBe(160);
    step(s, 48, outside, 1, g); expect(s.rocks[0].y).toBe(304);
    step(s, 1, outside, 1, g); expect(s.rocks).toHaveLength(0);
  });

  it('uses the full sixteen-pixel footprint for active solid-body collision, not just the center', () => {
    const g = floorGrid(); g.bodies = new Bodies(20, 30);
    g.bodies.add({ id: 'wall', x: 64, y: 160, w: 16, h: 16, oneWay: false, surface: 'normal', grabbable: false, noTeleport: false, active: true });
    const s = createFallingRocks([]); rock(s, 84, 144);
    step(s, 1, outside, 1, g); expect(s.rocks).toHaveLength(0);
    g.bodies.setActive('wall', false); rock(s, 84, 144);
    step(s, 1, outside, 1, g); expect(s.rocks[0].y).toBe(147);
  });

  it('reports swept player contacts, keeps fixed damage in data, and never accepts enemy targets', () => {
    const s = createFallingRocks([]); rock(s, 80, 160);
    expect(stepFallingRocks(s, floorGrid(), player, 10)).toBe(true);
    expect(s.rocks[0].y).toBe(190);
    expect(FALLING_ROCKS.damage).toBe(18);
    expect(stepFallingRocks(s, floorGrid(), outside, 1)).toBe(false);
  });

  it('does not hit a player behind an earlier solid collision, even across a large time step', () => {
    const g = gridFromRects(20, 30, [{ x0: 0, y0: 10, x1: 19, y1: 10, kind: 'solid' }]);
    const s = createFallingRocks([]); rock(s, 80, 100);
    expect(stepFallingRocks(s, g, player, 40)).toBe(false); expect(s.rocks).toHaveLength(0);
  });

  it('filters unrelated level objects and keeps independent overlapping zone timers', () => {
    const second = { ...zone({ interval: 1 }), id: 8 };
    const s = createFallingRocks([{ ...zone(), type: 'firefly' }, zone(), second]);
    expect(s.zones).toHaveLength(2); step(s, 36); expect(s.markers.map((m) => m.zoneId)).toEqual([7, 8]);
  });
});
