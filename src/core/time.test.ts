import { describe, it, expect } from 'vitest';
import { formatDelta, formatTime } from './time.ts';

describe('time formats (06 §5.1, test 1)', () => {
  it('formatTime', () => {
    expect(formatTime(0)).toBe('0:00.00');
    expect(formatTime(12345)).toBe('1:42.87');
    expect(formatTime(432000)).toBe('1:00:00.00');
    expect(formatTime(119)).toBe('0:00.99');
  });
  it('formatDelta', () => {
    expect(formatDelta(-390)).toBe('−3.25');
    expect(formatDelta(0)).toBe('±0.00');
    expect(formatDelta(9000)).toBe('+1:15.00');
    expect(formatDelta(120)).toBe('+1.00');
  });
});
