import { describe, expect, it } from 'vitest';
import { checklistLines } from './checklist.ts';

describe('Training Yard checklist board (06 §12.4)', () => {
  it('lists all 17 stations with a check for each one done, and a count', () => {
    const lines = checklistLines(new Set([1, 4, 17]));
    expect(lines[0]).toBe('Training  3 / 17');
    expect(lines.length).toBe(18);
    expect(lines[1]).toBe('[x]  1 Run and jump');
    expect(lines[2]).toBe('[ ]  2 Double jump');
    expect(lines[17]).toBe('[x] 17 Dive bounce');
  });
});
