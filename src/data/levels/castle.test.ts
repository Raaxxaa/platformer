import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadLevel, kindAt, levelGrid } from '../../core/level/loadLevel.ts';
import { pathLengthTiles, validateLevel } from '../../core/level/validateLevel.ts';
import { routeLint, sectionAt } from '../../core/level/routeLint.ts';
import { reachLint } from '../../core/level/reachLint.ts';
import { boxFree, isGrounded } from '../../core/physics/collide.ts';
import { createPlayerBody } from '../../core/player/body.ts';
import { MOVE } from '../../core/tuning.ts';
import { GameWorld } from '../../core/sim/gameWorld.ts';
import { runRouteBot } from '../../core/testkit/routeBot.ts';

const read = () => loadLevel(JSON.parse(readFileSync(new URL('../../../public/levels/castle.json', import.meta.url), 'utf8')));
const d = read();
const of = (type: string) => d.objects.filter((o) => o.type === type);
const EXPECTED: Record<number, Record<string, number>> = {
  1: {},
  2: { royal_guard: 3, gargoyle: 2, castle_mage: 2, living_armor: 3, royal_executioner: 1 },
  3: { royal_guard: 1, gargoyle: 2, castle_mage: 1 },
  4: { royal_guard: 2, gargoyle: 2, castle_mage: 1, living_armor: 3, royal_executioner: 1 },
  5: { royal_guard: 3, castle_mage: 1, gargoyle: 3, living_armor: 2, royal_executioner: 1 },
  6: { royal_guard: 2, gargoyle: 1, castle_mage: 1, living_armor: 1 },
  7: { castle_mage: 2, living_armor: 1, royal_guard: 1, royal_executioner: 1 },
  8: {},
};

describe("King's Castle level (M9 part 4)", () => {
  it('passes validateLevel, routeLint and the single-jump reachLint within 640 x 144 and 650-730 tiles', () => {
    expect(validateLevel(d)).toEqual([]);
    expect(routeLint(d)).toEqual([]);
    expect(reachLint(d, true)).toEqual([]);
    expect(d.widthTiles).toBeLessThanOrEqual(640); expect(d.heightTiles).toBeLessThanOrEqual(144);
    const len = pathLengthTiles(of('main_path')[0]);
    expect(len).toBeGreaterThanOrEqual(650); expect(len).toBeLessThanOrEqual(730);
    expect([d.id, d.stage, d.kind]).toEqual(['castle', 4, 'stage']);
  });

  it('matches the exact section-by-type enemy contract (04 / 05 §9.5)', () => {
    const got: Record<number, Record<string, number>> = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, {}]));
    for (const e of of('enemy')) {
      const section = sectionAt(d, e.x, e.y - 1), id = String(e.props.enemy);
      got[section][id] = (got[section][id] ?? 0) + 1;
    }
    expect(got).toEqual(EXPECTED);
  });

  it('has three arena waves of 3, 3 and 3 + the Executioner, the Gargoyles in wave two', () => {
    const waves = of('enemy').filter((e) => Number(e.props.wave) > 0);
    expect([1, 2, 3].map((n) => waves.filter((e) => e.props.wave === n).length)).toEqual([3, 3, 4]);
    expect(waves.filter((e) => e.props.enemy === 'royal_executioner').map((e) => e.props.wave)).toEqual([3]);
    expect(waves.filter((e) => e.props.wave === 2).every((e) => e.props.enemy === 'gargoyle')).toBe(true);
  });

  it('has the Stage 4 gimmicks: spike floors in the ground, 4+ blades, 3+ collapsing bridges, a cannon gallery and two wall-jump towers', () => {
    expect(of('swinging_blade').length).toBeGreaterThanOrEqual(4);
    expect(of('collapsing_platform').length).toBeGreaterThanOrEqual(3);
    expect(of('cannon').filter((c) => sectionAt(d, c.x, c.y) === 6).length).toBeGreaterThanOrEqual(4);
    let spikes = 0;
    for (let y = 0; y < d.heightTiles - 1; y++) for (let x = 0; x < d.widthTiles; x++) if (kindAt(d, x, y) === 'spikeUp') {
      spikes++;
      expect(['solid', 'spikeUp'], `spike ${x},${y} sits in the ground`).toContain(kindAt(d, x, y + 1));
    }
    expect(spikes).toBeGreaterThan(20);
    // blades hang from a gallery tile right above their pivot, and swing over open street
    for (const b of of('swinging_blade')) {
      const tx = Math.floor(b.x / 16), ty = Math.floor(b.y / 16);
      expect(kindAt(d, tx, ty)).toBe('empty');
      expect(kindAt(d, tx, ty - 1)).toBe('solid');
      expect(Number(b.props.length)).toBe(88);
    }
    for (const c of of('cannon')) {
      expect(kindAt(d, Math.floor(c.x / 16), Math.floor(c.y / 16))).toBe('empty');
      expect(Math.abs(Number(c.props.dir))).toBe(1);
    }
  });

  it('has no Dragon room: no side arena and no warning (06 §9.4)', () => {
    expect(of('dragon_warning')).toHaveLength(0);
    expect(of('arena').filter((a) => a.props.kind === 'side')).toHaveLength(0);
  });

  it('keeps every enemy on something solid, in open air', () => {
    for (const e of of('enemy')) {
      const tx = Math.floor(e.x / 16), ty = Math.floor((e.y - 1) / 16);
      expect(['solid', 'ice', 'oneway'], `enemy #${e.id} ${e.props.enemy} at ${tx},${ty}`).toContain(kindAt(d, tx, ty + 1));
      expect(kindAt(d, tx, ty)).toBe('empty');
    }
  });

  it('keeps every main-path stop supported and free of solid bodies without an ability', () => {
    const grid = levelGrid(d);
    const bad: number[] = [];
    of('main_path')[0].points!.forEach((p, i) => {
      const body = createPlayerBody(p.x, Math.floor(p.y / 16) * 16 + 16);
      if (!(boxFree(grid, body.x, body.y, body.w, body.h) || boxFree(grid, body.x, body.y, body.w, MOVE.BOX_H_LOW)) || !isGrounded(body, grid, 0)) bad.push(i);
    });
    expect(bad).toEqual([]);
  });

  it("has the Enemy King's throne room: 640 x 304, platforms 96 px wide and 96 px up at 1/4 and 3/4, two summon points and a 12-20 tile road", () => {
    const arena = of('arena').find((o) => o.props.kind === 'boss')!;
    expect([arena.w, arena.h, arena.props.boss]).toEqual([640, 304, 'enemy_king']);
    const left = arena.x / 16, top = arena.y / 16, floor = (arena.y + arena.h) / 16;
    for (let x = left; x < left + arena.w / 16; x++) {
      expect(kindAt(d, x, top - 1)).toBe('solid');
      expect(kindAt(d, x, floor)).toBe('solid');
      for (let y = top; y < floor; y++) if (y !== floor - 6) expect(kindAt(d, x, y), `arena tile ${x},${y}`).toBe('empty');
    }
    const runs: number[][] = [];
    for (let x = left; x < left + 40; x++) if (kindAt(d, x, floor - 6) === 'oneway') { const r = runs[runs.length - 1]; if (r && r[r.length - 1] === x - 1) r.push(x); else runs.push([x]); }
    expect(runs.map((r) => [r.length, (r[0] - left) / 40 + r.length / 80])).toEqual([[6, 0.25], [6, 0.75]]);
    const summons = of('summon_point');
    expect(summons.map((s) => s.x - arena.x)).toEqual([56, 584]);                // 56 px in from each wall: the tile center nearest 48 px
    const exitDoor = of('arena_door').find((o) => o.props.role === 'exit')!, exit = of('exit')[0];
    const road = (exit.x - exitDoor.x) / 16 - 1;
    expect(road).toBeGreaterThanOrEqual(12); expect(road).toBeLessThanOrEqual(20);
  });

  it('walks the whole real main road with normal movement (wall-jump towers included), fights included, to the exit', () => {
    const w = GameWorld.fromLevel(read(), { seedText: 'CASTLE-ROUTE' });
    w.run.splits[0] = 0; w.run.splits[1] = 0; w.run.splits[2] = 0;
    w.run.road = 'mountain';
    const result = runRouteBot(w, { maxTicksPerVertex: 1500 });
    // The bot kills the King once the throne room locks; the run is then complete and the world freezes (06 §2.6).
    expect(w.run.phase).toBe('runComplete');
    expect(w.run.splits[3]).not.toBeNull();
    expect(result.reached).toBeGreaterThanOrEqual(result.total - 3);
    expect(result.log.length).toBeLessThanOrEqual(1);                       // only the vertices inside the frozen throne room
  });

  it.each([
    { label: 'the skip chain over the spikes', route: [[266, 109], [269, 106], [276, 106], [283, 106], [290, 106], [294, 109]] },
    { label: 'the side-path cellar (down three steps, to the dead end and back)', route: [[305, 109], [307, 112], [310, 115], [318, 118], [333, 118], [318, 118], [310, 115], [307, 112], [310, 109]] },
  ])('is walkable with normal jumps: $label', ({ route }) => {
    const data = read();
    data.objects.find((o) => o.type === 'main_path')!.points = route.map(([x, y]) => ({ x: x * 16 + 8, y: y * 16 + 8 }));
    const w = GameWorld.fromLevel(data, { seedText: 'CASTLE-SKIP' });
    w.teleportPlayer(route[0][0] * 16 + 8, (route[0][1] + 1) * 16);
    const result = runRouteBot(w, { maxTicksPerVertex: 1500 });
    expect(result.log).toEqual([]);
    expect(result.reached).toBe(result.total);
  });

  it.each([
    { label: 'first key', seconds: 5, route: [[224, 109], [228, 106], [232, 103], [235, 100], [224, 109]] },
    { label: 'second key', seconds: 8, route: [[406, 109], [410, 106], [414, 103], [417, 100], [406, 109]] },
  ])('collects the $label by single jumps within its detour limit', ({ seconds, route }) => {
    const data = read();
    data.objects.find((o) => o.type === 'main_path')!.points = route.map(([x, y]) => ({ x: x * 16 + 8, y: y * 16 + 8 }));
    const w = GameWorld.fromLevel(data, { seedText: 'CASTLE-KEY' });
    w.teleportPlayer(route[0][0] * 16 + 8, (route[0][1] + 1) * 16);
    const result = runRouteBot(w);
    expect(result.log).toEqual([]);
    expect(w.econ.keys).toBe(1);
    expect(result.ticks).toBeLessThanOrEqual(seconds * 120);
  });
});
