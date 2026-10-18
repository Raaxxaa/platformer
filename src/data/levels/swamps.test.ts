import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadLevel, kindAt, levelGrid } from '../../core/level/loadLevel.ts';
import { sectionAt } from '../../core/level/routeLint.ts';
import { boxFree, isGrounded } from '../../core/physics/collide.ts';
import { createPlayerBody } from '../../core/player/body.ts';
import { MOVE } from '../../core/tuning.ts';
import { GameWorld } from '../../core/sim/gameWorld.ts';
import { runRouteBot } from '../../core/testkit/routeBot.ts';

const read = () => loadLevel(JSON.parse(readFileSync(new URL('../../../public/levels/swamps.json', import.meta.url), 'utf8')));
const EXPECTED: Record<number, Record<string, number>> = {
  1: {},
  2: { bog_zombie: 4, giant_spider: 2, wisp: 3, swamp_witch: 3, treant: 1 },
  3: { giant_spider: 4 },
  4: { bog_zombie: 2, giant_spider: 2, wisp: 2, swamp_witch: 2, treant: 1 },
  5: { bog_zombie: 2, giant_spider: 2, wisp: 2, swamp_witch: 3, treant: 1 },
  6: { bog_zombie: 2, giant_spider: 1, wisp: 2, swamp_witch: 2 },
  7: { giant_spider: 1, wisp: 1, swamp_witch: 2, treant: 1 },
  8: {},
};

describe('Swamps authored road (M7.1 Task 5)', () => {
  it('matches every section of the reviewed enemy budget, including all waves', () => {
    const d = read();
    const got: Record<number, Record<string, number>> = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, {}]));
    for (const e of d.objects.filter(o => o.type === 'enemy' && o.props.enemy !== 'spider_queen')) {
      const section = sectionAt(d, e.x, e.y - 1);
      const id = String(e.props.enemy);
      got[section][id] = (got[section][id] ?? 0) + 1;
    }
    expect(got).toEqual(EXPECTED);
  });

  it('has water over at least 30% of the floor columns in sections 2, 3 and 6', () => {
    const d = read();
    for (const index of [2, 3, 6]) {
      const s = d.objects.find(o => o.type === 'section' && o.props.index === index)!;
      let wet = 0;
      for (let x = s.x / 16; x < (s.x + s.w) / 16; x++) {
        let found = false;
        for (let y = 0; y < d.heightTiles - 1; y++) {
          if (kindAt(d, x, y) === 'water' && ['solid', 'ice', 'oneway'].includes(kindAt(d, x, y + 1))) found = true;
        }
        if (found) wet++;
      }
      expect(wet / (s.w / 16), `section ${index}`).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('puts submerged Zombies in water and hanging Spiders above the dark-hollow path', () => {
    const d = read();
    const zombies = d.objects.filter(o => o.type === 'enemy' && o.props.enemy === 'bog_zombie' && o.props.submerged === true);
    expect(zombies.length).toBeGreaterThanOrEqual(4);
    for (const e of zombies) expect(kindAt(d, Math.floor(e.x / 16), Math.floor((e.y - 1) / 16))).toBe('water');
    const spiders = d.objects.filter(o => o.type === 'enemy' && o.props.enemy === 'giant_spider' && sectionAt(d, o.x, o.y - 1) === 3);
    expect(spiders).toHaveLength(4);
    expect(spiders.every(e => e.props.hang === true)).toBe(true);
    for (const index of [3, 6]) {
      expect(d.objects.some(o => o.type === 'dark_zone' && sectionAt(d, o.x + 1, o.y + 1) === index)).toBe(true);
      expect(d.objects.filter(o => o.type === 'firefly' && sectionAt(d, o.x, o.y) === index).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every main-path stop supported and free of solid bodies without an ability', () => {
    const d = read();
    const grid = levelGrid(d);
    const bad: number[] = [];
    const points = d.objects.find(o => o.type === 'main_path')!.points!;
    points.forEach((p, i) => {
      const body = createPlayerBody(p.x, Math.floor(p.y / 16) * 16 + 16);
      if (!(boxFree(grid, body.x, body.y, body.w, body.h) || boxFree(grid, body.x, body.y, body.w, MOVE.BOX_H_LOW)) || !isGrounded(body, grid, 0)) bad.push(i);
    });
    expect(bad).toEqual([]);
  });

  it('has the Queen ceiling and exact six-tile platforms at their specified offsets', () => {
    const d = read();
    const arena = d.objects.find(o => o.type === 'arena' && o.props.kind === 'boss')!;
    const left = arena.x / 16, top = arena.y / 16, floor = (arena.y + arena.h) / 16;
    for (let x = left; x < left + arena.w / 16; x++) {
      expect(kindAt(d, x, top - 1)).toBe('solid');
      expect(kindAt(d, x, floor)).toBe('solid');
    }
    for (const offset of [5, 21]) {
      for (let x = left + offset; x < left + offset + 6; x++) expect(kindAt(d, x, floor - 6)).toBe('oneway');
    }
  });

  it('walks the whole real main road with normal movement and reaches Border Village', () => {
    const w = GameWorld.fromLevel(read(), { seedText: 'SWAMPS-ROUTE' });
    // A normal Stage 2 visit already has the preceding Guardian split and chosen road.
    w.run.splits[0] = 0;
    w.run.road = 'forest';
    const result = runRouteBot(w);
    expect(result.log).toEqual([]);
    expect(w.run.phase).toBe('transition');
    expect(w.run.transition?.target.levelId).toBe('border');
  });

  it.each([
    { label: 'first key', seconds: 5, route: [[243, 55], [246, 49], [252, 43], [256, 55]] },
    { label: 'second key', seconds: 8, route: [[524, 55], [527, 49], [531, 43], [535, 55]] },
  ])('collects the $label and returns within its detour limit using normal jumps', ({ seconds, route }) => {
    const data = read();
    data.objects.find(o => o.type === 'main_path')!.points = route.map(([x, y]) => ({ x: x * 16 + 8, y: y * 16 + 8 }));
    const w = GameWorld.fromLevel(data, { seedText: 'SWAMPS-KEY' });
    w.teleportPlayer(route[0][0] * 16 + 8, route[0][1] * 16 + 16);
    const result = runRouteBot(w);
    expect(result.log).toEqual([]);
    expect(result.reached).toBe(result.total);
    expect(w.econ.keys).toBe(1);
    expect(result.ticks).toBeLessThanOrEqual(seconds * 120);
  });
});
