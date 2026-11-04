import { describe, expect, it } from 'vitest';
import { HUD_LAYOUT } from '../../data/hudLayout.ts';
import { defaultHud, nudge, offsetOf, presetPlace, problems, resolveHud } from './hudLayout.ts';

describe('HUD groups and their layout (07 §4.1a)', () => {
  it('defaults: vitals top-left, slots top-right, timer bottom-right (top-center with touch controls); all legal', () => {
    expect(defaultHud(false)).toEqual({ vitals: { x: 4, y: 4 }, slots: { x: 504, y: 4 }, timer: { x: 472, y: 300 } });
    expect(defaultHud(true).timer).toEqual({ x: 240, y: 8 });
    expect(problems(defaultHud(false))).toEqual([]); expect(problems(defaultHud(true))).toEqual([]);
  });
  it('old saves (no hud) get the defaults; a saved place is kept and clamped on screen', () => {
    expect(resolveHud(undefined, false)).toEqual(defaultHud(false));
    expect(resolveHud({ slots: { x: 4, y: 280 } }, false).slots).toEqual({ x: 4, y: 280 });
    expect(resolveHud({ timer: { x: 9999, y: -50 } }, false).timer).toEqual({ x: 640 - 4 - 160, y: 4 });
  });
  it('a moved group keeps its inner layout: everything shifts by one offset from its home box', () => {
    expect(offsetOf('slots', { x: 504, y: 4 })).toEqual({ dx: 500, dy: -276 });
    expect(offsetOf('vitals', HUD_LAYOUT.home.vitals)).toEqual({ dx: 0, dy: 0 });
  });
  it('overlaps and the boss-bar zone are refused', () => {
    const l = defaultHud(false);
    expect(problems({ ...l, slots: { x: 8, y: 8 } })).toEqual(['vitals', 'slots']);
    expect(problems({ ...l, slots: presetPlace('slots', 3) })).toEqual([]);
    expect(problems({ ...l, timer: { x: 240, y: 316 } })).toEqual(['timer']);
  });
  it('presets and 4 px nudges stay on screen', () => {
    expect(presetPlace('timer', 1)).toEqual({ x: 240, y: 4 }); expect(presetPlace('slots', 4)).toEqual({ x: 508, y: 280 });
    expect(nudge(defaultHud(false), 'vitals', -1, 0).vitals).toEqual({ x: 4, y: 4 });
    expect(nudge(defaultHud(false), 'vitals', 1, 2).vitals).toEqual({ x: 8, y: 12 });
  });
});
