import { describe, expect, it } from 'vitest';
import { crashMessage } from './crashPanel.ts';
describe('crash panel text (review C4)', () => {
  it('shows the error name and message', () => {
    expect(crashMessage(new TypeError('x is undefined'))).toBe('TypeError: x is undefined');
    expect(crashMessage('boom')).toBe('boom'); expect(crashMessage({ a: 1 })).toBe('{"a":1}');
  });
});
