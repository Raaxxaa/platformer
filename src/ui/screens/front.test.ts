import { describe, expect, it } from 'vitest';
import { TitleModel, DeathModel, deathCause, loadingPercent } from './front.ts';
describe('title, boot and death screens (07 §7)', () => {
  it('consumes the first gesture and keeps title choices in bounds', () => {
    const m = new TitleModel(); expect(m.action('confirm')).toBeNull(); expect(m.step).toBe(2);
    expect(m.action('confirm')).toBe('play');
    for (let i = 0; i < 9; i++) m.action('down'); expect(m.cursor).toBe(4); expect(m.action('confirm')).toBe('settings');
    expect(m.action('back')).toBeNull(); expect(m.step).toBe(1);
  });
  it('guards death confirms for a quarter second and clamps long UI frames', () => {
    const m = new DeathModel(); expect(m.action('confirm')).toBeNull(); m.advance(9); expect(m.canConfirm).toBe(false);
    m.advance(0.1); m.advance(0.05); expect(m.canConfirm).toBe(true); expect(m.action('confirm')).toBe('restart');
    m.action('down'); expect(m.action('confirm')).toBe('home'); m.action('down'); expect(m.action('confirm')).toBe('title');
    expect(m.action('back')).toBeNull();
  });
  it('uses the exact cause labels and a bounded loading percentage', () => {
    expect(deathCause('bandit_archer')).toBe('Killed by Bandit Archer'); expect(deathCause('wisp')).toBe("Killed by Will-o'-Wisp");
    expect(deathCause('hazard')).toBe('Killed by a trap'); expect(deathCause('burning')).toBe('Burned'); expect(deathCause('spikes')).toBe('Killed by spikes');
    expect(loadingPercent(0.429)).toBe(42); expect(loadingPercent(2)).toBe(100);
  });
});
