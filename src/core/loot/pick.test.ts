import { describe, expect, it } from 'vitest';
import { AMBUSH_PACKS, CURSE_WEIGHTS, FIXED_ODDS, GRADE_ODDS, GRADES, LUCKY, PERKS, S_PREFIX, S_SUFFIX } from '../../data/loot.ts';
import { CHEST_GOLD, PRICES } from '../../data/economy.ts';
import { pick, pickGrade } from './pick.ts';

const seq = (vals: number[]) => { let i = 0; return () => vals[i++]; };

describe('loot tables (05 §3, checklist 1–3)', () => {
  it('1: every odds row sums to 100', () => {
    for (const t of Object.values(GRADE_ODDS)) for (const row of Object.values(t)) expect(GRADES.reduce((s, g) => s + row[g], 0)).toBe(100);
    for (const row of Object.values(FIXED_ODDS)) expect(GRADES.reduce((s, g) => s + row[g], 0)).toBe(100);
  });
  it('2: re-deriving the key and cursed rows for Stages 2–4 gives the stored tables', () => {
    for (const table of ['key', 'cursed'] as const) {
      for (const n of [2, 3, 4] as const) {
        const v = GRADES.map((g) => GRADE_ODDS[table][1][g] + (GRADE_ODDS.free[n][g] - GRADE_ODDS.free[1][g]));
        for (let i = 0; i < 4; i++) if (v[i] < 0) { v[i + 1] += v[i]; v[i] = 0; }
        expect(v, `${table} ${n}`).toEqual(GRADES.map((g) => GRADE_ODDS[table][n][g]));
      }
    }
  });
  it('3: pick on the Stage-1 free row', () => {
    expect(pickGrade(GRADE_ODDS.free[1], seq([0.4999]))).toBe('F');
    expect(pickGrade(GRADE_ODDS.free[1], seq([0.5]))).toBe('C');
    expect(pickGrade(GRADE_ODDS.free[1], seq([0.995]))).toBe('S');
    expect(pick([['a', 0], ['b', 1]], seq([0]))).toBe('b');                    // weight 0 is never picked
  });
  it('perks, names, Lucky Block, curses, Ambush packs and prices match 05', () => {
    expect(PERKS.map((p) => [p.id, p.value, p.scope])).toEqual([
      ['quick', 0.15, 'weapon'], ['keen', 0.12, 'weapon'], ['brutal', 0.15, 'weapon'], ['finisher', 0.40, 'weapon'],
      ['leeching', 40, 'weapon'], ['fleet', 0.08, 'carried'], ['sturdy', 0.90, 'carried'], ['greedy', 50, 'weapon'],
    ]);
    expect(S_PREFIX).toEqual({ fire: 'Sun', ice: 'Frost', lightning: 'Sky', poison: 'Venom', wind: 'Gale' });
    expect(S_SUFFIX.greatsword).toBe('breaker');
    expect(S_SUFFIX.storm_hammer).toBe('splitter');
    expect(Object.keys(S_SUFFIX).length).toBe(19);
    expect(LUCKY.filter((l) => l.kind === 'buff').map((l) => l.weight)).toEqual([15, 15, 15, 15, 15, 15, 10]);
    expect(LUCKY.filter((l) => l.kind === 'debuff').map((l) => l.id)).toEqual(['heavy', 'glass_bones', 'leaky_pockets', 'ambush', 'jammed', 'dry_flask', 'butterfingers']);
    expect(CURSE_WEIGHTS).toEqual({ one_hit: 40, no_heal: 20, heavy_feet: 20, hunted: 20 });
    expect(AMBUSH_PACKS.plains).toEqual(['wolf', 'wolf', 'bandit']);
    expect(CHEST_GOLD).toEqual({ key: 40, timed: 80, cursed: 100 });
    expect(PRICES.weapon).toEqual({ F: 40, C: 80, B: 160, A: 320, S: 640 });
  });
});
