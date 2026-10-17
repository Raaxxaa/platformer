import { describe, it, expect } from 'vitest';
import { feet, levelFrom, rect } from '../testkit/levelData.ts';
import { validateLevel } from './validateLevel.ts';
import type { LevelData } from './loadLevel.ts';

/** 200 × 12 tiles, floor row 10; section 2 is x 0–99, section 3 is x 100–199. Enemies: [tx, id]. */
function lvl(enemies: [number, string][], id: LevelData['id'] = 'plains') {
  const rows = Array.from({ length: 12 }, (_, y) => (y >= 10 ? '#' : '.').repeat(200));
  return levelFrom(rows, [
    rect('section', 0, 0, 100, 12, { index: 2 }), rect('section', 100, 0, 100, 12, { index: 3 }),
    ...enemies.map(([tx, enemy]) => feet('enemy', tx, 9, { enemy })),
  ], id);
}
const spacing = (d: LevelData) => validateLevel(d).filter((e) => e.startsWith('spacing'));

describe('early-game spacing (06 §8.6)', () => {
  it('a §2 group of 3 regulars fails, naming the group', () => {
    expect(spacing(lvl([[2, 'bandit'], [30, 'wolf'], [33, 'wolf'], [36, 'wolf']]))).toEqual(['spacing: section 2 group at x 30–36 has 3 regular enemies (max 2)']);
  });
  it('two §2 groups 20 tiles apart fail; 24 apart pass', () => {
    expect(spacing(lvl([[2, 'bandit'], [22, 'wolf']]))).toEqual(['spacing: section 2 groups at x 2 and x 22 are 20 tiles apart (min 24)']);
    expect(spacing(lvl([[2, 'bandit'], [26, 'wolf']]))).toEqual([]);
  });
  it('the first enemy must be a single bandit', () => {
    expect(spacing(lvl([[2, 'wolf'], [40, 'bandit']]))).toEqual(['spacing: the first group of the stage must be a single bandit']);
  });
  it('an elite sharing a group fails', () => {
    expect(spacing(lvl([[2, 'bandit'], [40, 'bandit_brute'], [44, 'wolf']]))).toEqual(['spacing: elite bandit_brute at x 40 shares a group']);
  });
  it('§3 is checked too, other sections and other levels are not', () => {
    expect(spacing(lvl([[2, 'bandit'], [120, 'wolf'], [123, 'wolf'], [126, 'wolf']]))).toHaveLength(1);
    expect(spacing(lvl([[2, 'wolf'], [3, 'wolf'], [4, 'wolf']], 'mountains'))).toEqual([]);
  });
});
