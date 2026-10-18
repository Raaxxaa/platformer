import { describe, expect, it } from 'vitest';
import { migrateSave, NewerSaveVersionError } from './migrate.ts';

describe('save version migration', () => {
  it('keeps version1 data and defaults a missing version without changing the input', () => {
    const current = { v: 1, training: [1] }; expect(migrateSave(current)).toBe(current);
    const old = { training: [2] }; expect(migrateSave(old)).toEqual({ v: 1, training: [2] }); expect(old).toEqual({ training: [2] });
  });
  it('distinguishes newer versions for storage read-only protection', () => {
    expect(() => migrateSave({ v: 2 })).toThrow(NewerSaveVersionError);
    expect(() => migrateSave({ v: 99 })).toThrow(NewerSaveVersionError);
  });
  it.each([null, [], 7, 'save', { v: 0 }, { v: -1 }, { v: '1' }, { v: 1.5 }])('rejects malformed root/version %j', (raw) => {
    expect(() => migrateSave(raw)).toThrow();
  });
});
