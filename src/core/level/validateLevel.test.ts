import { describe, it, expect } from 'vitest';
import mini from './fixtures/mini.json';
import { loadLevel, type LevelData } from './loadLevel.ts';
import { validateLevel } from './validateLevel.ts';

const plains = (): LevelData => ({ ...loadLevel(mini), id: 'plains' });

describe('validateLevel (06 §13.6)', () => {
  it('reports a missing player_start', () => {
    const d = plains();
    d.objects = d.objects.filter((o) => o.type !== 'player_start');
    expect(validateLevel(d)).toContain('player_start: expected 1, found 0');
  });
  it('reports two exits', () => {
    const d = plains();
    const exit = d.objects.find((o) => o.type === 'exit')!;
    d.objects.push({ ...exit, id: 999 });
    expect(validateLevel(d)).toContain('exit: expected 1, found 2');
  });
  it('reports a combat arena without 2 doors', () => {
    const d = plains();
    d.objects = d.objects.filter((o) => o.id !== d.objects.find((x) => x.type === 'arena_door')!.id);
    expect(validateLevel(d).some((e) => e.includes('expected 2 doors, found 1'))).toBe(true);
  });
  it('reports a timed chest whose door does not exist', () => {
    const d = plains();
    d.objects.find((o) => o.type === 'timed_chest')!.props.door = 'nope';
    expect(validateLevel(d)).toContain(`timed_chest #${d.objects.find((o) => o.type === 'timed_chest')!.id}: door nope does not exist`);
  });
  it('reports a wrong enemy mix, a non-wave spawn inside the arena and a short main path', () => {
    const d = plains();
    const errs = validateLevel(d);
    expect(errs).toContain('wolf: expected 12, found 1');
    expect(errs.some((e) => e.startsWith('main_path:'))).toBe(true);
    const w = d.objects.find((o) => o.type === 'enemy' && o.props.enemy === 'wolf')!;
    w.x = 18 * 16 + 8;
    expect(validateLevel(d).some((e) => e.includes('placed (non-wave) spawn inside combat arena a1'))).toBe(true);
  });
});
