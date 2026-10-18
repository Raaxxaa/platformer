import { describe, expect, it } from 'vitest';
import { StatPickModel } from './statPickModel.ts';

describe('stat pick input (07 §6.11)', () => {
  it('starts on the middle card and does not wrap', () => {
    const m = new StatPickModel(); expect(m.cursor).toBe(1);
    m.input('left'); m.input('left'); expect(m.cursor).toBe(0);
    m.input('right'); m.input('right'); m.input('right'); expect(m.cursor).toBe(2);
  });
  it('ignores confirm at 0.29 seconds, accepts it at exactly 0.30 seconds', () => {
    const m = new StatPickModel(); m.advance(0.29);
    expect(m.input('confirm')).toBeNull(); m.advance(0.01);
    expect(m.input('confirm')).toBe(1);
    m.accept();
    expect(m.input('confirm')).toBeNull();
  });
  it('a refused core confirmation leaves the cards usable until acknowledged', () => {
    const m = new StatPickModel(); m.advance(0.30);
    expect(m.input('confirm')).toBe(1);
    m.input('right'); expect(m.input('confirm')).toBe(2);
    m.accept(); expect(m.input('confirm')).toBeNull();
  });
  it('back never skips the pick; mouse select follows the same guard', () => {
    const m = new StatPickModel(); m.select(2); expect(m.input('back')).toBeNull();
    expect(m.input('confirm')).toBeNull(); m.advance(0.30); expect(m.input('confirm')).toBe(2);
  });
});
