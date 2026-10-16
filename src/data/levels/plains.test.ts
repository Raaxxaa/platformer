import { describe, it, expect } from 'vitest';
import plainsJson from '../../../public/levels/plains.json';
import { loadLevel, levelGrid } from '../../core/level/loadLevel.ts';
import { validateLevel, pathLengthTiles } from '../../core/level/validateLevel.ts';
import { routeLint, sectionAt } from '../../core/level/routeLint.ts';
import { boxFree, isGrounded } from '../../core/physics/collide.ts';
import { createPlayerBody } from '../../core/player/body.ts';
import { GameWorld } from '../../core/sim/gameWorld.ts';
import { MOVE } from '../../core/tuning.ts';

const d = loadLevel(plainsJson);

/** M3 plan Task 9 table: regulars and elites per section. */
const EXPECTED: Record<number, Record<string, number>> = {
  1: {},
  2: { wolf: 3, bandit: 3, bandit_archer: 2, wild_boar: 2, bandit_brute: 1 },
  3: { wolf: 2, bandit_archer: 1, wild_boar: 1 },
  4: { wolf: 3, bandit: 3, bandit_archer: 1, wild_boar: 1, bandit_brute: 1 },
  5: { wolf: 2, bandit: 3, bandit_archer: 2, wild_boar: 2, bandit_brute: 1 },
  6: { wolf: 2, bandit_archer: 2, wild_boar: 1 },
  7: { bandit: 1, bandit_archer: 1, wild_boar: 2, bandit_brute: 1 },
  8: {},
};
const HINTS: Record<string, number> = {
  move: 1, jump: 1, interact: 1, attack: 1, dash: 2, lucky_block: 2, double_jump: 3, wall_jump: 3, slide: 3,
  dive_slam: 4, heal: 5, drop_through: 6,
};

describe('Plains & Forest level (M3 Task 9)', () => {
  it('passes validateLevel and routeLint', () => {
    expect(validateLevel(d)).toEqual([]);
    expect(routeLint(d)).toEqual([]);
  });
  it('is 650–730 tiles of main path, at most 720 × 64', () => {
    const len = pathLengthTiles(d.objects.find((o) => o.type === 'main_path')!);
    expect(len).toBeGreaterThanOrEqual(650);
    expect(len).toBeLessThanOrEqual(730);
    expect(d.widthTiles).toBeLessThanOrEqual(720);
    expect(d.heightTiles).toBeLessThanOrEqual(64);
  });
  it('has the per-section enemy counts of the plan', () => {
    const got: Record<number, Record<string, number>> = {};
    for (let i = 1; i <= 8; i++) got[i] = {};
    for (const e of d.objects.filter((o) => o.type === 'enemy')) {
      const s = sectionAt(d, e.x, e.y - 1);
      const id = String(e.props.enemy);
      got[s][id] = (got[s][id] ?? 0) + 1;
    }
    expect(got).toEqual(EXPECTED);
  });
  it('every hint action is in its section', () => {
    for (const [action, sec] of Object.entries(HINTS)) {
      const h = d.objects.find((o) => o.type === 'hint' && o.props.action === action);
      expect(h, action).toBeDefined();
      expect(sectionAt(d, h!.x + h!.w / 2, h!.y + h!.h / 2), action).toBe(sec);
    }
  });
  it('no spikes in sections 1–2; wolves are in packs; a guide arrow at the fork', () => {
    const g = levelGrid(d);
    const s2 = d.objects.find((o) => o.type === 'section' && o.props.index === 2)!;
    for (let ty = 0; ty < g.h; ty++) for (let tx = 0; tx < (s2.x + s2.w) / 16; tx++) expect(g.kindAt(tx, ty).startsWith('spike')).toBe(false);
    expect(d.objects.filter((o) => o.type === 'enemy' && o.props.enemy === 'wolf').every((o) => String(o.props.group ?? '') !== '')).toBe(true);
    expect(d.objects.some((o) => o.type === 'guide_arrow')).toBe(true);
  });
  it('route runner: the player can stand (or crawl, in the slide tunnel) at every main_path vertex', () => {
    const g = levelGrid(d);
    const pts = d.objects.find((o) => o.type === 'main_path')!.points!;
    const bad: string[] = [];
    pts.forEach((p, i) => {
      const feetY = Math.floor(p.y / 16) * 16 + 16;
      const b = createPlayerBody(p.x, feetY);
      const fits = boxFree(g, b.x, b.y, b.w, b.h) || boxFree(g, b.x, b.y, b.w, MOVE.BOX_H_LOW);
      if (!fits || !isGrounded(b, g, 0)) bad.push(`vertex ${i} (${Math.floor(p.x / 16)}, ${Math.floor(p.y / 16)})`);
    });
    expect(bad).toEqual([]);
  });
  it('builds a world: 40 placed or wave regulars, 4 brutes and the Great Boar', () => {
    const w = GameWorld.fromLevel(d, { seedText: 'PLAINS' });
    const all = [...w.enemies.map((e) => e.def.id), ...w.waveSpawns.map((s) => s.enemy)];
    expect(all.filter((id) => id !== 'bandit_brute' && id !== 'great_boar').length).toBe(40);
    expect(all.filter((id) => id === 'bandit_brute').length).toBe(4);
    expect(all.filter((id) => id === 'great_boar').length).toBe(1);
  });
});
