import { describe, expect, it } from 'vitest';
import { falloff, jitterRate, panFor, SfxMixer } from './sfxRules.ts';

const L = { camCenterX: 1000, playerX: 1000 };
const dur = () => 1;

describe('SFX playback rules (08 §13.2)', () => {
  it('a 4th wolf growl inside the voice limit is dropped', () => {
    const m = new SfxMixer();
    expect(m.request({ id: 'vo_wolf', x: 1000 }, 0, 0, L, dur)).not.toBeNull();
    expect(m.request({ id: 'vo_wolf', x: 1000 }, 0.1, 12, L, dur)).not.toBeNull();
    expect(m.request({ id: 'vo_wolf', x: 1000 }, 0.2, 24, L, dur)).not.toBeNull();
    expect(m.request({ id: 'vo_wolf', x: 1000 }, 0.3, 36, L, dur)).toBeNull();
    // Once the first one has ended, there is room again.
    expect(m.request({ id: 'vo_wolf', x: 1000 }, 1.05, 126, L, dur)).not.toBeNull();
  });
  it('two of the same id 0.02 s apart only play once', () => {
    const m = new SfxMixer();
    expect(m.request({ id: 'jump' }, 0, 0, L, dur)).not.toBeNull();
    expect(m.request({ id: 'jump' }, 0.02, 2, L, dur)).toBeNull();
    expect(m.request({ id: 'jump' }, 0.05, 6, L, dur)).not.toBeNull();
  });
  it('pan is −0.5 for a sound 320 px to the left; player sounds are centered', () => {
    expect(panFor(680, 1000)).toBe(-0.5);
    expect(panFor(1160, 1000)).toBe(0.25);
    const m = new SfxMixer();
    expect(m.request({ id: 'vo_wolf', x: 680 }, 0, 0, L, dur)!.pan).toBe(-0.5);
    expect(m.request({ id: 'jump' }, 0, 0, L, dur)!.pan).toBe(0);
  });
  it('distance falloff: full to 320 px, silent at 640 px (dropped)', () => {
    expect(falloff(100)).toBe(1);
    expect(falloff(480)).toBe(0.5);
    expect(falloff(700)).toBe(0);
    expect(new SfxMixer().request({ id: 'vo_wolf', x: 1700 }, 0, 0, L, dur)).toBeNull();
  });
  it('variants go round robin; pitch jitter stays within ±3%', () => {
    const m = new SfxMixer();
    const v = [0, 1, 2, 3].map((i) => m.request({ id: 'land' }, i, i * 120, L, () => 0.1)!.variant);
    expect(v).toEqual([0, 1, 2, 0]);
    for (let t = 0; t < 500; t++) { const r = jitterRate(t, 'land'); expect(r).toBeGreaterThanOrEqual(0.97); expect(r).toBeLessThanOrEqual(1.03); }
  });
  it('32 voices max: the quietest world sound is stopped', () => {
    const m = new SfxMixer();
    const ids = ['hit_light', 'hit_medium', 'hit_heavy', 'hit_crit', 'swing_light', 'swing_medium', 'swing_heavy', 'land', 'jump', 'dash'];
    let n = 0, quiet = -1;
    for (const id of ids) for (let k = 0; k < 4 && n < 31; k++) { const p = m.request({ id }, k * 0.05, k, L, () => 10); if (p) n++; }
    const q = m.request({ id: 'vo_wolf', x: 1500 }, 0.3, 40, L, () => 10);       // far: quiet world sound
    quiet = q!.handle;
    expect(m.active).toBe(32);
    const p = m.request({ id: 'enemy_swing_m', x: 1000 }, 0.4, 50, L, () => 10);
    expect(p!.stop).toBe(quiet);
    expect(m.active).toBe(32);
  });
});
