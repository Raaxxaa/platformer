import { describe, expect, it } from 'vitest';
import { debugSeed } from './seed.ts';

describe('debug seed acceptance', () => {
  it('uses a nonempty seed only with debug enabled', () => {
    expect(debugSeed(new URLSearchParams('debug=1&seed=abc123'))).toBe('ABC123');
    expect(debugSeed(new URLSearchParams('seed=ABC123'))).toBeNull();
    expect(debugSeed(new URLSearchParams('debug=1&seed='))).toBeNull();
    expect(debugSeed(new URLSearchParams('debug=1'))).toBeNull();
  });
});
