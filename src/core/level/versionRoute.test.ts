// M11 (06 §8.7): every non-classic version is walked by the route bot, and its keys stay inside the detour limits (06 §8.2).
import { describe, expect, it } from 'vitest';
import { LEVEL_PACKS } from '../../data/run.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { runRouteBot } from '../testkit/routeBot.ts';
import { assembleLevel, classicPicks, type LevelPack } from './assemble.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { levelGrid } from './loadLevel.ts';
import plainsPack from '../../../public/levels/plains.pack.json';
import mountainsPack from '../../../public/levels/mountains.pack.json';
import swampsPack from '../../../public/levels/swamps.pack.json';
import kingdomPack from '../../../public/levels/kingdom.pack.json';
import castlePack from '../../../public/levels/castle.pack.json';

const PACKS: Record<string, LevelPack> = {
  plains: plainsPack as unknown as LevelPack, mountains: mountainsPack as unknown as LevelPack, swamps: swampsPack as unknown as LevelPack,
  kingdom: kingdomPack as unknown as LevelPack, castle: castlePack as unknown as LevelPack,
};
const NEXT: Record<string, string> = { plains: 'crossroads', mountains: 'border', swamps: 'border', kingdom: 'rebel_camp' };
const ROAD: Record<string, 'mountain' | 'forest'> = { mountains: 'mountain', swamps: 'forest' };
const T = 16;

/** The detour that picks up a key, as offsets (tiles) from the key, copied from the v1 tests of each level: every version keeps the key's ledge shape. */
const KEY_ROUTE: Record<string, [number, number][][]> = {
  mountains: [[[3, 6], [0, 2], [3, 6]], [[5, 14], [3, 8], [0, 2], [5, 14]]],
  swamps: [[[-9, 12], [-6, 6], [0, 0], [4, 12]], [[-7, 12], [-4, 6], [0, 0], [4, 12]]],
  kingdom: [[[-12, 9], [-7, 6], [-3, 3], [0, 0], [-12, 9]], [[-17, 12], [-12, 9], [-8, 6], [-4, 3], [0, 0], [-17, 12]]],
  castle: [[[-11, 9], [-7, 6], [-3, 3], [0, 0], [-11, 9]], [[-11, 9], [-7, 6], [-3, 3], [0, 0], [-11, 9]]],
};

for (const id of LEVEL_PACKS.filter((l) => l !== 'plains')) {
  const pack = PACKS[id];
  describe(`${id}: every version walked by the route bot (06 §8.7)`, () => {
    for (const [i, vs] of pack.sections.entries()) for (let v = (i === 0 ? 0 : 1); v < (i === 0 ? 1 : vs.length); v++) {
      it(`s${i + 1} v${v + 1} reaches the end of the main path`, () => {
        const picks = classicPicks(pack); picks[i] = v + 1;
        const w = GameWorld.fromLevel(assembleLevel(pack, picks), { seedText: `VERSION-${id}-${i + 1}-${v + 1}` });
        const stage = w.stage; for (let k = 0; k < stage - 1; k++) w.run.splits[k] = 0;
        w.run.road = ROAD[id] ?? 'mountain';
        const result = runRouteBot(w, { maxTicksPerVertex: 1500 });
        if (NEXT[id]) {
          expect(result.log).toEqual([]);
          expect(w.run.transition?.target.levelId).toBe(NEXT[id]);
        } else {
          // The bot kills the King once the throne room locks; the run is then complete and the world freezes (06 §2.6).
          expect(w.run.phase).toBe('runComplete');
          expect(result.reached).toBeGreaterThanOrEqual(result.total - 3);
          expect(result.log.length).toBeLessThanOrEqual(1);
        }
      }, 120_000);
    }
  });

  describe(`${id}: keys stay inside their detour limits (06 §8.2)`, () => {
    for (const [i, vs] of pack.sections.entries()) for (let v = 0; v < vs.length; v++) {
      const picks = classicPicks(pack); picks[i] = v + 1;
      const d0 = assembleLevel(pack, picks);
      const sec = d0.objects.find((o) => o.type === 'section' && Number(o.props.index) === i + 1)!;
      const key = d0.objects.find((o) => o.type === 'key' && o.x >= sec.x && o.x < sec.x + sec.w);
      if (!key || !KEY_ROUTE[id]) continue;
      // The first key (before the arena) must be reachable and back within 5 s, the second within 8 s.
      const keys = d0.objects.filter((o) => o.type === 'key').sort((a, b) => a.x - b.x);
      const seconds = keys.indexOf(key) === 0 ? 5 : 8;
      it(`s${i + 1} v${v + 1}: the key is picked up and the route resumes within ${seconds} s`, () => {
        const d = assembleLevel(pack, picks);
        const kx = Math.floor(key.x / T), ky = Math.floor(key.y / T);
        const route = KEY_ROUTE[id][keys.indexOf(key)].map(([dx, dy]) => ({ x: kx + dx, y: ky + dy }));
        const path = d.objects.find((o) => o.type === 'main_path')!;
        const a = route[0];
        path.points = route.map((p) => ({ x: p.x * T + 8, y: p.y * T + 8 }));
        const w = GameWorld.fromLevel(d, { seedText: `KEY-${id}-${i + 1}-${v + 1}` });
        w.teleportPlayer(a.x * T + 8, (a.y + 1) * T);
        stepSpec(w, {});
        const result = runRouteBot(w, { maxTicksPerVertex: 1500 });
        expect(result.log).toEqual([]);
        expect(w.econ.keys).toBe(1);
        expect(result.ticks).toBeLessThanOrEqual(seconds * 120);
      });
    }
  });
}

// The Mountains cart ride (06 §8.3: ≥ 120 tiles, two gaps, two low tunnels): every Section 6 version is ridden with one jump per gap.
if (LEVEL_PACKS.includes('mountains')) {
  const pack = PACKS.mountains;
  describe('mountains: the minecart ride of every Section 6 version', () => {
    for (let v = 1; v <= pack.sections[5].length; v++) {
      it(`s6 v${v}: boards, jumps both gaps, passes both low tunnels and reaches its stop`, () => {
        const picks = classicPicks(pack); picks[5] = v;
        const level = assembleLevel(pack, picks);
        const start = level.objects.find((o) => o.type === 'player_start')!, anchor = level.objects.find((o) => o.type === 'minecart')!;
        start.x = anchor.x; start.y = anchor.y;
        const g = levelGrid(level);
        const w = GameWorld.fromLevel(level, { seedText: 'VERSION-CART' }), cart = w.minecarts[0], initialX = cart.x;
        stepSpec(w, { interact: true }); expect(w.body.cartId).toBe(cart.id);
        let jumpLeft = 0, jumps = 0, crashes = 0, lastGapCol = -99;
        const roofRuns: number[] = [], bad: string[] = [];
        let inTunnel = false;
        for (let i = 0; i < 2400 && cart.active; i++) {
          w.health.iframeTicks = 1000;
          const f = Math.floor(cart.y / T), col = Math.floor(cart.x / T);
          // A catch-floor gap ahead: the track drops 7 or more tiles for a few columns, then the rail returns.
          const drop = (c: number) => { let r = f; while (r < f + 14 && g.kindAt(c, r) === 'empty') r++; return r - f; };
          for (let c = col + 2; c <= col + 4 && jumpLeft <= 0; c++) {
            if (drop(c) >= 7 && [1, 2, 3, 4, 5].some((k) => drop(c + k) <= 4) && c - lastGapCol > 8) { jumpLeft = 40; lastGapCol = c }
          }
          const events = stepSpec(w, { jump: jumpLeft-- > 0 });
          jumps += events.filter((e) => e.t === 'move' && e.e === 'cartJump').length;
          crashes += events.filter((e) => e.t === 'move' && e.e === 'cartCrash').length;
          // Roofed columns under the cart: the cart must be riding below the roof.
          let roof = -1;
          for (let c = Math.floor((cart.x - cart.w / 2) / T); c <= Math.floor((cart.x + cart.w / 2) / T); c++) {
            if (g.kindAt(c, Math.floor(cart.y / T) - 2) === 'solid') roof = Math.floor(cart.y / T) - 2;
          }
          if (roof >= 0) {
            if (!inTunnel) { roofRuns.push(i); inTunnel = true; }
            if (w.body.cartId !== cart.id || cart.y - cart.h < (roof + 1) * T) bad.push(`${(cart.x / T).toFixed(1)},${(cart.y / T).toFixed(1)}`);
          } else inTunnel = false;
        }
        const stop = level.objects.find((o) => o.type === 'minecart_stop')!;
        expect(jumps).toBe(2); expect(crashes).toBe(1);
        expect(cart.x, `x ${cart.x / T} y ${cart.y / T}`).toBeGreaterThanOrEqual(stop.x - cart.w / 2 - 1);
        expect(cart.x - initialX).toBeGreaterThanOrEqual(120 * T);
        expect(roofRuns.length).toBe(2);
        expect(bad).toEqual([]);
        expect(cart.active).toBe(false); expect(w.body.cartId).toBeNull();
      });
    }
  });
}

// Kingdom §4: the rooftop skip (a stair of balconies, the roofs, back down) and the cellar side path of every version (06 §8.3).
if (LEVEL_PACKS.includes('kingdom')) {
  const pack = PACKS.kingdom;
  const SKIP: Record<number, [number, number][]> = {
    1: [[4, 71], [8, 68], [12, 65], [16, 62], [20, 59], [24, 56], [28, 53], [32, 50], [37, 47], [48, 47], [56, 47], [68, 47], [75, 47], [86, 47], [93, 71]],
    2: [[28, 71], [32, 68], [36, 65], [40, 62], [44, 59], [48, 56], [52, 53], [56, 50], [61, 47], [69, 47], [73, 47], [85, 47], [89, 47], [100, 47], [105, 71]],
    3: [[4, 71], [8, 68], [12, 65], [16, 62], [20, 59], [24, 56], [28, 53], [32, 50], [37, 47], [44, 47], [50, 47], [76, 47], [83, 47], [88, 47], [93, 71]],
  };
  const CELLAR_X: Record<number, number> = { 1: 74, 2: 4, 3: 44 };
  describe('kingdom: section 4 skip routes and side paths in every version', () => {
    for (let v = 1; v <= 3; v++) {
      const route = (pts: [number, number][]) => {
        const picks = classicPicks(pack); picks[3] = v;
        const d = assembleLevel(pack, picks);
        const sec = d.objects.find((o) => o.type === 'section' && Number(o.props.index) === 4)!;
        const x0 = Math.floor(sec.x / T);
        d.objects.find((o) => o.type === 'main_path')!.points = pts.map(([x, y]) => ({ x: (x + x0) * T + 8, y: y * T + 8 }));
        const w = GameWorld.fromLevel(d, { seedText: `KINGDOM-S4-${v}` });
        w.teleportPlayer((pts[0][0] + x0) * T + 8, (pts[0][1] + 1) * T);
        return runRouteBot(w, { maxTicksPerVertex: 1500 });
      };
      it(`v${v}: the rooftop skip (24 tiles up, over the roof gaps, back down)`, () => {
        const r = route(SKIP[v]);
        expect(r.log).toEqual([]); expect(r.reached).toBe(r.total);
      });
      it(`v${v}: the cellar side path (down three steps, to the dead end and back)`, () => {
        const xe = CELLAR_X[v];
        const pts: [number, number][] = [[xe - 1, 71], [xe + 1, 74], [xe + 4, 77], [xe + 11, 80], [xe + 28, 80], [xe + 11, 80], [xe + 4, 77], [xe + 1, 74], [xe + 4, 71]];
        const r = route(pts);
        expect(r.log).toEqual([]); expect(r.reached).toBe(r.total);
      });
    }
  });
}

// Castle §4: the skip chain over the spikes and the cellar side path of every version (06 §8.3).
if (LEVEL_PACKS.includes('castle')) {
  const pack = PACKS.castle;
  const CHAIN_X: Record<number, number> = { 1: 34, 2: 14, 3: 46 };       // first spike pit of each version
  const CELLAR_X: Record<number, number> = { 1: 70, 2: 70, 3: 14 };
  describe('castle: section 4 skip chains and side paths in every version', () => {
    for (let v = 1; v <= 3; v++) {
      const route = (pts: [number, number][]) => {
        const picks = classicPicks(pack); picks[3] = v;
        const d = assembleLevel(pack, picks);
        const sec = d.objects.find((o) => o.type === 'section' && Number(o.props.index) === 4)!;
        const x0 = Math.floor(sec.x / T);
        d.objects.find((o) => o.type === 'main_path')!.points = pts.map(([x, y]) => ({ x: (x + x0) * T + 8, y: y * T + 8 }));
        const w = GameWorld.fromLevel(d, { seedText: `CASTLE-S4-${v}` });
        w.teleportPlayer((pts[0][0] + x0) * T + 8, (pts[0][1] + 1) * T);
        return runRouteBot(w, { maxTicksPerVertex: 1500 });
      };
      it(`v${v}: the skip chain over the spikes`, () => {
        const p = CHAIN_X[v];
        const r = route([[p - 4, 109], [p - 1, 106], [p + 6, 106], [p + 13, 106], [p + 20, 106], [p + 24, 109]]);
        expect(r.log).toEqual([]); expect(r.reached).toBe(r.total);
      });
      it(`v${v}: the cellar side path (down three steps, to the dead end and back)`, () => {
        const xe = CELLAR_X[v];
        const r = route([[xe - 1, 109], [xe + 1, 112], [xe + 4, 115], [xe + 12, 118], [xe + 27, 118], [xe + 12, 118], [xe + 4, 115], [xe + 1, 112], [xe + 4, 109]]);
        expect(r.log).toEqual([]); expect(r.reached).toBe(r.total);
      });
    }
  });
}
