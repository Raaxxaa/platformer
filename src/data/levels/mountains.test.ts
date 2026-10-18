import { describe, expect, it } from 'vitest';
import mountainJson from '../../../public/levels/mountains.json';
import { levelGrid, loadLevel } from '../../core/level/loadLevel.ts';
import { pathLengthTiles, validateLevel } from '../../core/level/validateLevel.ts';
import { routeLint, sectionAt } from '../../core/level/routeLint.ts';
import { boxFree } from '../../core/physics/collide.ts';
import { MOVE } from '../../core/tuning.ts';
import { GameWorld } from '../../core/sim/gameWorld.ts';
import { runRouteBot } from '../../core/testkit/routeBot.ts';
import { stepSpec } from '../../core/testkit/combatWorld.ts';

const d = loadLevel(mountainJson);
const of = (type: string) => d.objects.filter((o) => o.type === type);
const EXPECTED: Record<number, Record<string, number>> = {
  1: {},
  2: { bat_swarm: 2, goblin_miner: 4, rock_golem: 1, ram: 3, goblin_shaman: 1 },
  3: { bat_swarm: 2 },
  4: { bat_swarm: 1, goblin_miner: 2, rock_golem: 4, ram: 1, goblin_shaman: 1 },
  5: { bat_swarm: 1, goblin_miner: 2, rock_golem: 2, ram: 4, goblin_shaman: 1 },
  6: { bat_swarm: 1, goblin_miner: 1, ram: 1 },
  7: { bat_swarm: 1, goblin_miner: 1, rock_golem: 1, ram: 1, goblin_shaman: 1 },
  8: {},
};

describe('Mountain road layout (M7.1 Task 5)', () => {
  it('passes level validation and movement-limit lint within its size and main-route budget', () => {
    expect(validateLevel(d)).toEqual([]); expect(routeLint(d)).toEqual([]);
    expect(d.widthTiles).toBeLessThanOrEqual(560); expect(d.heightTiles).toBeLessThanOrEqual(176);
    const length = pathLengthTiles(of('main_path')[0]); expect(length).toBeGreaterThanOrEqual(650); expect(length).toBeLessThanOrEqual(730);
  });

  it('matches the exact section-by-type enemy contract', () => {
    const got: Record<number, Record<string, number>> = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, {}]));
    for (const e of of('enemy')) {
      const section = sectionAt(d, e.x, e.y - 1), id = String(e.props.enemy);
      got[section][id] = (got[section][id] ?? 0) + 1;
    }
    expect(got).toEqual(EXPECTED);
  });

  it('has the documented three arena waves, with the Shaman only in wave three', () => {
    const waves = of('enemy').filter((e) => Number(e.props.wave) > 0);
    expect([1, 2, 3].map((n) => waves.filter((e) => e.props.wave === n).length)).toEqual([3, 3, 4]);
    expect(waves.filter((e) => e.props.enemy === 'goblin_shaman').map((e) => e.props.wave)).toEqual([3]);
  });

  it('keeps the great climb at least sixty tiles tall and marks falling rocks before the rest ledges', () => {
    const section = of('section').find((o) => o.props.index === 3)!;
    const points = of('main_path')[0].points!.filter((p) => p.x >= section.x && p.x < section.x + section.w);
    expect((Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y))) / 16).toBeGreaterThanOrEqual(60);
    expect(of('falling_rocks').some((o) => sectionAt(d, o.x + o.w / 2, o.y + o.h / 2) === 3)).toBe(true);
    expect(of('cracked_wall').some((o) => sectionAt(d, o.x, o.y) === 4)).toBe(true);
  });

  it('has the empty side room, central platform, and a same-section warning at least forty tiles earlier', () => {
    const side = of('arena').find((o) => o.props.kind === 'side')!, warning = of('dragon_warning')[0];
    expect([side.w, side.h]).toEqual([640, 320]); expect(side.x - (warning.x + warning.w)).toBeGreaterThanOrEqual(640);
    expect(sectionAt(d, warning.x, warning.y)).toBe(6); expect(sectionAt(d, side.x, side.y)).toBe(6);
    expect(of('arena_door').some((o) => o.props.arena === side.props.id)).toBe(false);
    expect(of('enemy').some((o) => o.x >= side.x && o.x < side.x + side.w && o.y > side.y && o.y <= side.y + side.h)).toBe(false);
    const grid = levelGrid(d), platformY = (side.y + side.h - 96) / 16;
    const centerX = (side.x + side.w / 2) / 16;
    for (let x = centerX - 4; x < centerX + 4; x++) expect(grid.kindAt(x, platformY)).toBe('oneway');
  });

  it('offers at least 120 horizontal tiles of cart travel before its stop', () => {
    const cart = of('minecart')[0], stop = of('minecart_stop')[0];
    expect(stop.x - cart.x).toBeGreaterThanOrEqual(120 * 16);
    expect(sectionAt(d, cart.x, cart.y - 1)).toBe(6); expect(sectionAt(d, stop.x, stop.y)).toBe(6);
  });

  it('fits the standing or crawling player at every main-route point', () => {
    const grid = levelGrid(d), bad: number[] = [];
    of('main_path')[0].points!.forEach((p, i) => {
      const feet = Math.floor(p.y / 16) * 16 + 16;
      if (!boxFree(grid, p.x, feet, MOVE.BOX_W, MOVE.BOX_H) && !boxFree(grid, p.x, feet, MOVE.BOX_W, MOVE.BOX_H_LOW)) bad.push(i);
    });
    expect(bad).toEqual([]);
  });

  it('traverses the real main road with ordinary movement and reaches the Border exit', () => {
    const w = GameWorld.fromLevel(loadLevel(mountainJson), { seedText: 'MOUNTAIN-ROUTE' });
    w.run.splits[0] = 0; w.run.road = 'mountain';
    const result = runRouteBot(w);
    expect(result.log).toEqual([]);
    expect(w.run.transition?.target.levelId, JSON.stringify({ result, body: w.body })).toBe('border');
  });

  it.each([
    { name: 'first', limit: 5, route: [[153, 91], [150, 87], [153, 91]] },
    { name: 'second', limit: 8, route: [[295, 91], [293, 85], [290, 79], [295, 91]] },
  ])('collects the $name key and returns within $limit seconds using normal jumps', ({ limit, route }) => {
    const level = loadLevel(mountainJson), start = level.objects.find((o) => o.type === 'player_start')!;
    start.x = route[0][0] * 16 + 8; start.y = route[0][1] * 16 + 16;
    level.objects.find((o) => o.type === 'main_path')!.points = route.map(([x, y]) => ({ x: x * 16 + 8, y: y * 16 + 8 }));
    const w = GameWorld.fromLevel(level, { seedText: 'MOUNTAIN-KEY' });
    const result = runRouteBot(w);
    expect(result.log).toEqual([]); expect(result.reached).toBe(result.total);
    expect(w.econ.keys).toBe(1); expect(result.ticks).toBeLessThanOrEqual(limit * 120);
  });

  it('boards the real cart, jumps both gaps, passes both low tunnels and reaches its stop without an earlier crash', () => {
    const level = loadLevel(mountainJson), start = level.objects.find((o) => o.type === 'player_start')!, anchor = level.objects.find((o) => o.type === 'minecart')!;
    start.x = anchor.x; start.y = anchor.y;
    const w = GameWorld.fromLevel(level, { seedText: 'MOUNTAIN-CART' }), cart = w.minecarts[0], initialX = cart.x;
    stepSpec(w, { interact: true }); expect(w.body.cartId).toBe(cart.id);
    let jumpLeft = 0, first = false, second = false, jumps = 0, crashes = 0;
    for (let i = 0; i < 1800 && cart.active; i++) {
      w.health.iframeTicks = 1000;
      if (!first && cart.x >= 321 * 16 && cart.x < 324 * 16) { first = true; jumpLeft = 40; }
      if (!second && cart.x >= 394 * 16 && cart.x < 396 * 16) { second = true; jumpLeft = 40; }
      const events = stepSpec(w, { jump: jumpLeft-- > 0 });
      jumps += events.filter((e) => e.t === 'move' && e.e === 'cartJump').length;
      crashes += events.filter((e) => e.t === 'move' && e.e === 'cartCrash').length;
    }
    const stop = level.objects.find((o) => o.type === 'minecart_stop')!;
    expect(jumps).toBe(2); expect(crashes).toBe(1);
    expect(cart.x, JSON.stringify({ x: cart.x / 16, y: cart.y / 16, first, second })).toBeGreaterThanOrEqual(stop.x - cart.w / 2 - 1);
    expect(cart.x - initialX).toBeGreaterThanOrEqual(120 * 16);
    expect(cart.active).toBe(false); expect(w.body.cartId).toBeNull();
  });
});
