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

const read = () => loadLevel(JSON.parse(readFileSync(new URL('../../../public/levels/kingdom.json', import.meta.url), 'utf8')));
const d = read();
const of = (type: string) => d.objects.filter((o) => o.type === type);
const EXPECTED: Record<number, Record<string, number>> = {
  1: {},
  2: { soldier: 4, war_hound: 3, crossbowman: 2, battle_mage: 1, knight: 1 },
  3: { soldier: 1, crossbowman: 2, battle_mage: 1 },
  4: { soldier: 2, war_hound: 3, crossbowman: 2, battle_mage: 1, knight: 1 },
  5: { soldier: 3, battle_mage: 1, war_hound: 3, crossbowman: 2, knight: 1 },
  6: { soldier: 2, crossbowman: 2, battle_mage: 1 },
  7: { war_hound: 3, battle_mage: 1, knight: 1 },
  8: {},
};

describe('Enemy Kingdom level (M9 part 3)', () => {
  it('passes validateLevel, routeLint and the single-jump reachLint within 720 x 112 and 650-730 tiles', () => {
    expect(validateLevel(d)).toEqual([]);
    expect(routeLint(d)).toEqual([]);
    expect(reachLint(d, true)).toEqual([]);
    expect(d.widthTiles).toBeLessThanOrEqual(720); expect(d.heightTiles).toBeLessThanOrEqual(112);
    const len = pathLengthTiles(of('main_path')[0]);
    expect(len).toBeGreaterThanOrEqual(650); expect(len).toBeLessThanOrEqual(730);
    expect([d.id, d.stage, d.kind]).toEqual(['kingdom', 3, 'stage']);
  });

  it('matches the exact section-by-type enemy contract (04 / 05 §9.5)', () => {
    const got: Record<number, Record<string, number>> = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, {}]));
    for (const e of of('enemy')) {
      const section = sectionAt(d, e.x, e.y - 1), id = String(e.props.enemy);
      got[section][id] = (got[section][id] ?? 0) + 1;
    }
    expect(got).toEqual(EXPECTED);
  });

  it('has three arena waves of 3, 3 and 3 + the Knight, with the Hound pack in wave two', () => {
    const waves = of('enemy').filter((e) => Number(e.props.wave) > 0);
    expect([1, 2, 3].map((n) => waves.filter((e) => e.props.wave === n).length)).toEqual([3, 3, 4]);
    expect(waves.filter((e) => e.props.enemy === 'knight').map((e) => e.props.wave)).toEqual([3]);
    expect(waves.filter((e) => e.props.wave === 2).every((e) => e.props.enemy === 'war_hound' && e.props.group === 'hounds_yard')).toBe(true);
  });

  it('puts at least 3 cannons in sections 3 and 6, each firing along the street', () => {
    for (const index of [3, 6]) expect(of('cannon').filter((c) => sectionAt(d, c.x, c.y) === index).length).toBeGreaterThanOrEqual(3);
    for (const c of of('cannon')) {
      expect(kindAt(d, Math.floor(c.x / 16), Math.floor(c.y / 16))).toBe('empty');                 // the muzzle is in open air
      expect(Math.abs(Number(c.props.dir))).toBe(1);
    }
  });

  it('has hound packs of exactly 3 sharing a group, and perched Crossbowmen standing on something', () => {
    const hounds = of('enemy').filter((e) => e.props.enemy === 'war_hound');
    const groups = new Map<string, number>();
    for (const h of hounds) groups.set(String(h.props.group), (groups.get(String(h.props.group)) ?? 0) + 1);
    expect([...groups.values()]).toEqual([3, 3, 3, 3]);
    for (const e of of('enemy')) {
      const tx = Math.floor(e.x / 16), ty = Math.floor((e.y - 1) / 16);
      expect(['solid', 'ice', 'oneway'], `enemy #${e.id} ${e.props.enemy} at ${tx},${ty}`).toContain(kindAt(d, tx, ty + 1));
      expect(kindAt(d, tx, ty)).toBe('empty');
    }
  });

  it('has the rooftops 24 tiles above the street, a Dragon-sized empty side room and a warning 640+ px earlier', () => {
    const side = of('arena').find((o) => o.props.kind === 'side')!, warning = of('dragon_warning')[0];
    expect([side.w, side.h]).toEqual([640, 320]);
    expect(side.x - (warning.x + warning.w)).toBeGreaterThanOrEqual(640);
    expect(sectionAt(d, side.x, side.y)).toBe(6); expect(sectionAt(d, warning.x, warning.y)).toBe(6);
    expect(of('enemy').some((o) => o.x >= side.x && o.x < side.x + side.w && o.y > side.y && o.y <= side.y + side.h)).toBe(false);
    expect(of('arena_door').some((o) => o.props.arena === side.props.id)).toBe(false);
    // the central platform: 128 px wide, 96 px above the floor
    const floor = (side.y + side.h) / 16, top = floor - 6;
    let run = 0;
    for (let x = side.x / 16; x < (side.x + side.w) / 16; x++) if (kindAt(d, x, top) === 'oneway') run++;
    expect(run).toBe(8);
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

  it('has the Black Knight arena: 640 x 256 with a flat floor, a ceiling and an exit road of 12-20 tiles', () => {
    const arena = of('arena').find((o) => o.props.kind === 'boss')!;
    expect([arena.w, arena.h, arena.props.boss]).toEqual([640, 256, 'black_knight']);
    const left = arena.x / 16, top = arena.y / 16, floor = (arena.y + arena.h) / 16;
    for (let x = left; x < left + arena.w / 16; x++) {
      expect(kindAt(d, x, top - 1)).toBe('solid');
      expect(kindAt(d, x, floor)).toBe('solid');
      for (let y = top; y < floor; y++) expect(kindAt(d, x, y), `arena tile ${x},${y}`).toBe('empty');
    }
    const exitDoor = of('arena_door').find((o) => o.props.role === 'exit')!, exit = of('exit')[0];
    const road = (exit.x - exitDoor.x) / 16 - 1;
    expect(road).toBeGreaterThanOrEqual(12); expect(road).toBeLessThanOrEqual(20);
  });

  it('walks the whole real main road with normal movement, fights included, to the Rebel Camp', () => {
    const w = GameWorld.fromLevel(read(), { seedText: 'KINGDOM-ROUTE' });
    w.run.splits[0] = 0; w.run.splits[1] = 0;
    w.run.road = 'mountain';
    const result = runRouteBot(w);
    expect(result.log).toEqual([]);
    expect(w.run.phase).toBe('transition');
    expect(w.run.transition?.target.levelId).toBe('rebel_camp');
  });

  it.each([
    { label: 'the rooftop skip route (24 tiles up, over two roof gaps, then back down)', route: [[264, 71], [268, 68], [272, 65], [276, 62], [280, 59], [284, 56], [288, 53], [292, 50], [297, 47], [308, 47], [316, 47], [328, 47], [335, 47], [346, 47], [353, 71]] },
    { label: 'the side-path cellar (down three steps, to the dead end and back)', route: [[333, 71], [335, 74], [338, 77], [345, 80], [362, 80], [345, 80], [338, 77], [335, 74], [338, 71]] },
  ])('is walkable with normal jumps: $label', ({ route }) => {
    const data = read();
    data.objects.find((o) => o.type === 'main_path')!.points = route.map(([x, y]) => ({ x: x * 16 + 8, y: y * 16 + 8 }));
    const w = GameWorld.fromLevel(data, { seedText: 'KINGDOM-SKIP' });
    w.teleportPlayer(route[0][0] * 16 + 8, (route[0][1] + 1) * 16);
    const result = runRouteBot(w, { maxTicksPerVertex: 1500 });
    expect(result.log).toEqual([]);
    expect(result.reached).toBe(result.total);
  });

  it.each([
    { label: 'first key', seconds: 5, route: [[221, 71], [226, 68], [230, 65], [233, 62], [221, 71]] },
    { label: 'second key', seconds: 8, route: [[519, 71], [524, 68], [528, 65], [532, 62], [536, 59], [519, 71]] },
  ])('collects the $label by single jumps within its detour limit', ({ seconds, route }) => {
    const data = read();
    data.objects.find((o) => o.type === 'main_path')!.points = route.map(([x, y]) => ({ x: x * 16 + 8, y: y * 16 + 8 }));
    const w = GameWorld.fromLevel(data, { seedText: 'KINGDOM-KEY' });
    w.teleportPlayer(route[0][0] * 16 + 8, (route[0][1] + 1) * 16);
    const result = runRouteBot(w);
    expect(result.log).toEqual([]);
    expect(w.econ.keys).toBe(1);
    expect(result.ticks).toBeLessThanOrEqual(seconds * 120);
  });
});
