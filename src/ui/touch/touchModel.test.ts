import { describe, expect, it } from 'vitest';
import { TouchModel, buttonRects, unitOf, defaultTouchSettings, type TouchSink } from './touchModel.ts';

const W = 844, H = 390;
function setup(over: Partial<ReturnType<typeof defaultTouchSettings>> = {}) {
  const m = new TouchModel();
  const log: string[] = [];
  const sink: TouchSink = { down: (id) => log.push(`+${id}`), up: (id) => log.push(`-${id}`) };
  m.attach(sink); m.setScreen(W, H); m.setSettings({ ...defaultTouchSettings(), ...over }); m.setInteract(true);
  const at = (id: string) => { const r = buttonRects(W, H, m.settings, true, m.safe).find((b) => b.id === id)!; return { x: r.cx, y: r.cy }; };
  return { m, log, at };
}

describe('touch units and button table (07 §8.6)', () => {
  it('u = clamp(min(w, h) / 7.5, 40, 72) × Button size', () => {
    expect(unitOf(844, 390, 100)).toBeCloseTo(52, 0);
    expect(unitOf(300, 200, 100)).toBe(40); expect(unitOf(2000, 1200, 100)).toBe(72);
    expect(unitOf(844, 390, 130)).toBeCloseTo(67.6, 0);
  });
  it('places the buttons from the bottom-right corner, sizes in u; Pause is top-right', () => {
    const u = unitOf(W, H, 100), r = buttonRects(W, H, defaultTouchSettings(), true, { l: 0, r: 0, t: 0, b: 0 });
    const jump = r.find((b) => b.id === 'jump')!;
    expect(jump.cx).toBeCloseTo(W - 1.0 * u); expect(jump.cy).toBeCloseTo(H - 1.0 * u); expect(jump.r).toBeCloseTo(1.45 * u / 2);
    const pause = r.find((b) => b.id === 'pause')!;
    expect(pause.cx).toBeCloseTo(W - 0.7 * u); expect(pause.cy).toBeCloseTo(0.7 * u);
  });
  it('mirrors for left-handed, applies safe areas, and the Interact button exists only with a target', () => {
    const u = unitOf(W, H, 100);
    const left = buttonRects(W, H, { ...defaultTouchSettings(), leftHanded: true }, true, { l: 20, r: 0, t: 0, b: 0 }).find((b) => b.id === 'jump')!;
    expect(left.cx).toBeCloseTo(20 + 1.0 * u);
    expect(buttonRects(W, H, defaultTouchSettings(), false, { l: 0, r: 0, t: 0, b: 0 }).some((b) => b.id === 'interact')).toBe(false);
    const safe = buttonRects(W, H, defaultTouchSettings(), true, { l: 0, r: 30, t: 0, b: 10 }).find((b) => b.id === 'jump')!;
    expect(safe.cx).toBeCloseTo(W - 30 - 1.0 * u); expect(safe.cy).toBeCloseTo(H - 10 - 1.0 * u);
  });
  it('a saved layout position (fractions of the screen) and size override the table', () => {
    const r = buttonRects(W, H, { ...defaultTouchSettings(), layout: { dash: { x: 0.5, y: 0.25, scale: 1.5 } } }, true, { l: 0, r: 0, t: 0, b: 0 });
    const dash = r.find((b) => b.id === 'dash')!, u = unitOf(W, H, 100);
    expect(dash.cx).toBeCloseTo(W * 0.5); expect(dash.cy).toBeCloseTo(H * 0.25); expect(dash.r).toBeCloseTo(1.05 * u * 1.5 / 2);
  });
});

describe('floating stick', () => {
  it('centers on the first touch; X beyond 0.35r, up/down beyond 0.5r; 8 directions; release on lift', () => {
    const { m, log } = setup(); const u = unitOf(W, H, 100), r = 1.1 * u;
    m.pointerDown(1, 100, 200, 0);
    m.pointerMove(1, 100 + 0.3 * r, 200);  expect(log).toEqual([]);
    m.pointerMove(1, 100 + 0.4 * r, 200);  expect(log).toEqual(['+right']);
    m.pointerMove(1, 100 + 0.4 * r, 200 - 0.6 * r); expect(log).toEqual(['+right', '+up']);
    m.pointerMove(1, 100 - 0.5 * r, 200 + 0.6 * r); expect(log.slice(2).sort()).toEqual(['+down', '+left', '-right', '-up']);
    m.pointerUp(1, 0, 0, 10); expect(log.slice(6).sort()).toEqual(['-down', '-left']);
  });
  it('only starts in the left 45% of the screen; a mirrored layout uses the right 45%', () => {
    const a = setup(); a.m.pointerDown(1, W * 0.5, 200, 0); a.m.pointerMove(1, W * 0.5 + 60, 200); expect(a.log).toEqual([]);
    const b = setup({ leftHanded: true }); b.m.pointerDown(1, W * 0.7, 200, 0); b.m.pointerMove(1, W * 0.7 + 60, 200); expect(b.log).toEqual(['+right']);
  });
  it('reports the knob state for drawing', () => {
    const { m } = setup(); m.pointerDown(1, 100, 200, 0); m.pointerMove(1, 100 + 500, 200);
    const s = m.stick!; expect(s.cx).toBe(100); expect(Math.hypot(s.kx - 100, s.ky - 200)).toBeCloseTo(1.1 * unitOf(W, H, 100));
  });
});

describe('buttons', () => {
  it('a touch starting on a button holds it until it lifts, even if it slides off or onto another button', () => {
    const { m, log, at } = setup();
    const j = at('jump'), a = at('attack1');
    m.pointerDown(5, j.x, j.y, 0); expect(log).toEqual(['+jump']);
    m.pointerMove(5, a.x, a.y); m.pointerMove(5, 10, 10); expect(log).toEqual(['+jump']);
    m.pointerUp(5, 0, 0, 5); expect(log).toEqual(['+jump', '-jump']);
  });
  it('hit area is the circle grown by 0.15u; overlapping areas pick the nearest center', () => {
    const { m, log, at } = setup(); const u = unitOf(W, H, 100), j = at('jump'), jr = 1.45 * u / 2;
    m.pointerDown(1, j.x + jr + 0.1 * u, j.y, 0); expect(log).toEqual(['+jump']);          // inside the grown circle
    m.pointerUp(1, 0, 0, 1); log.length = 0;
    m.pointerDown(2, W - 2, H / 2, 0); expect(log).toEqual([]); m.pointerUp(2, 0, 0, 1);     // outside every grown circle, and not the stick side
    // Jump and Attack 1 overlap: a point inside both picks the nearer center (Attack 1 here).
    const a1 = at('attack1'), dist = Math.hypot(a1.x - j.x, a1.y - j.y), k = (0.83 * u) / dist;
    const lens = { x: j.x + (a1.x - j.x) * k, y: j.y + (a1.y - j.y) * k };
    log.length = 0; m.pointerDown(3, lens.x, lens.y, 0); expect(log).toEqual(['+attack1']);
  });
  it('stick plus jump plus attack at once, each by its own finger', () => {
    const { m, log, at } = setup(); const j = at('jump'), a = at('attack1'), u = unitOf(W, H, 100);
    m.pointerDown(1, 100, 200, 0); m.pointerMove(1, 100 + u, 200);
    m.pointerDown(2, j.x, j.y, 0); m.pointerDown(3, a.x, a.y, 0);
    expect(log).toEqual(['+right', '+jump', '+attack1']);
    m.pointerUp(2, 0, 0, 1); expect(log.at(-1)).toBe('-jump');
    m.pointerUp(3, 0, 0, 1); m.pointerUp(1, 0, 0, 1); expect(log.slice(-2).sort()).toEqual(['-attack1', '-right']);
  });
  it('pointer cancel releases like a lift', () => {
    const { m, log, at } = setup(); const j = at('jump');
    m.pointerDown(1, j.x, j.y, 0); m.pointerCancel(1, 0); expect(log).toEqual(['+jump', '-jump']);
  });
  it('the Interact button is only hit while there is an interact target', () => {
    const { m, log, at } = setup(); const i = at('interact');
    m.setInteract(false); m.pointerDown(1, i.x, i.y, 0); expect(log).toEqual([]); m.pointerUp(1, 0, 0, 1);
    m.setInteract(true); m.pointerDown(2, i.x, i.y, 0); expect(log).toEqual(['+interact']);
  });
  it('releaseAll lets go of everything', () => {
    const { m, log, at } = setup(); const j = at('jump');
    m.pointerDown(1, 100, 200, 0); m.pointerMove(1, 200, 200); m.pointerDown(2, j.x, j.y, 0); log.length = 0;
    m.releaseAll(); expect(log.sort()).toEqual(['-jump', '-right']);
  });
});

describe('Pause button: tap pauses, hold restarts (06 §6.2)', () => {
  it('holding presses restart; a tap under 0.5 s releases it and presses pause', () => {
    const { m, log, at } = setup(); const p = at('pause');
    m.pointerDown(1, p.x, p.y, 1000); expect(log).toEqual(['+restart']);
    m.pointerUp(1, 0, 0, 1300); expect(log).toEqual(['+restart', '-restart', '+pause', '-pause']);
  });
  it('a hold of 0.5 s or more only releases restart', () => {
    const { m, log, at } = setup(); const p = at('pause');
    m.pointerDown(1, p.x, p.y, 1000); m.pointerUp(1, 0, 0, 1500); expect(log).toEqual(['+restart', '-restart']);
  });
  it('reports the hold progress for the ring', () => {
    const { m, at } = setup(); const p = at('pause');
    m.pointerDown(1, p.x, p.y, 1000); expect(m.pauseHold(1250)).toBeCloseTo(0.5); expect(m.pauseHold(5000)).toBe(1);
    m.pointerUp(1, 0, 0, 1100); expect(m.pauseHold(1200)).toBe(0);
  });
});
