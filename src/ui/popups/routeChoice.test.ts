import { afterEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { RouteChoiceModel, RouteChoiceView, type RouteChoiceData } from './routeChoice.ts';

const data = (lastRoad: 'mountain' | 'forest' = 'forest'): RouteChoiceData => ({
  lastRoad, startClass: 'tank', pbs: { 'tank|mountain': { ticks: 1200 }, 'tank|forest': { ticks: 2400 }, 'wizard|forest': { ticks: 1 } },
});

describe('Crossroads route choice (07 §6.6)', () => {
  it('starts on lastRoad and reads PBs using the starting class and road key', () => {
    const before = data(), m = new RouteChoiceModel(before);
    expect(m.cursor).toBe(1); expect(m.road).toBe('forest');
    expect(m.cards.map((card) => card.lines)).toEqual([
      ['MOUNTAIN ROAD', 'Caves & Mountains', 'Guardian: Stone Colossus', 'More climbing', 'PB 0:10.00'],
      ['FOREST ROAD', 'Dark Forest & Swamps', 'Guardian: Spider Queen', 'More fighting', 'PB 0:20.00'],
    ]);
    expect(before.pbs['wizard|forest']?.ticks).toBe(1);
    expect(new RouteChoiceModel({ ...before, pbs: {} }).cards[1].lines.at(-1)).toBe('PB —');
    expect(new RouteChoiceModel({ ...before, startClass: null }).cards.map((card) => card.lines.at(-1))).toEqual(['PB —', 'PB —']);
  });
  it('moves only left/right without wrapping, confirms one road, and cancels without changing data', () => {
    const m = new RouteChoiceModel(data('mountain'));
    m.action('left'); m.action('up'); expect(m.cursor).toBe(0);
    m.action('right'); m.action('right'); m.action('down'); expect(m.cursor).toBe(1);
    expect(m.action('confirm')).toEqual({ type: 'confirm', road: 'forest' });
    expect(m.action('confirm')).toBeNull(); expect(m.action('back')).toBeNull();
    const before = data('mountain'), cancelled = new RouteChoiceModel(before);
    cancelled.action('right'); expect(cancelled.action('back')).toEqual({ type: 'cancel' });
    expect(before.lastRoad).toBe('mountain');
  });
});

function fakeScene() {
  type Obj = Record<string, any>;
  const objects: Obj[] = [], listeners = new Map<string, (event: any) => void>();
  const make = (kind: string, args: any[]) => {
    const object: Obj = { kind, args, handlers: {}, children: [], destroyed: false };
    for (const method of ['setScrollFactor', 'setDepth', 'setTint', 'setOrigin', 'setInteractive', 'setMaxWidth', 'setCenterAlign', 'fillStyle', 'fillRect', 'lineStyle', 'strokeRect']) {
      object[method] = (...values: any[]) => { object[method + 'Args'] = values; return object; };
    }
    object.on = (event: string, fn: (pointer?: unknown) => void) => { object.handlers[event] = fn; return object; };
    object.add = (child: Obj) => { object.children.push(child); return object; };
    object.removeAll = () => { object.children.forEach((child: Obj) => child.destroy()); object.children = []; return object; };
    object.destroy = () => { object.destroyed = true; }; objects.push(object); return object;
  };
  vi.stubGlobal('window', { addEventListener: (event: string, fn: (event: unknown) => void) => listeners.set(event, fn), removeEventListener: (event: string) => listeners.delete(event) });
  vi.stubGlobal('navigator', { getGamepads: () => [] });
  const scene = {
    scale: { width: 640, height: 360 }, textures: { exists: () => false }, events: { once: vi.fn() },
    add: Object.fromEntries(['container', 'graphics', 'bitmapText', 'rectangle', 'nineslice'].map((kind) => [kind, (...args: any[]) => make(kind, args)])),
  } as unknown as Phaser.Scene;
  return { scene, objects, listeners };
}
afterEach(() => vi.unstubAllGlobals());

describe('route menu view and direct input', () => {
  it('draws the exact panel and cards; hover selects and only left click confirms once', () => {
    const { scene, objects } = fakeScene(), confirm = vi.fn(), cancel = vi.fn();
    const view = new RouteChoiceView(scene, data(), { onConfirm: confirm, onCancel: cancel });
    expect(objects.some((o) => o.fillRectArgs?.join() === '160,90,320,150')).toBe(true);
    let targets = objects.filter((o) => o.kind === 'rectangle' && !o.destroyed);
    expect(targets.map((o) => o.args)).toEqual([[168, 122, 148, 100], [324, 122, 148, 100]]);
    targets[0].handlers.pointerover(); expect(view.model.road).toBe('mountain');
    targets = objects.filter((o) => o.kind === 'rectangle' && !o.destroyed);
    targets[0].handlers.pointerdown({ button: 2 }); targets[0].handlers.pointerdown({ button: 1 }); expect(confirm).not.toHaveBeenCalled();
    targets[0].handlers.pointerdown({ button: 0 }); view.action('confirm');
    expect(confirm).toHaveBeenCalledExactlyOnceWith('mountain'); expect(cancel).not.toHaveBeenCalled();
  });
  it('reads direct keys, ignores browser repeats, and freezes input while a pause is on top', () => {
    const { scene, listeners } = fakeScene(), confirm = vi.fn();
    const view = new RouteChoiceView(scene, data('mountain'), { onConfirm: confirm, onCancel: vi.fn() });
    const press = (code: string, repeat = false) => listeners.get('keydown')?.({ code, repeat, preventDefault: vi.fn() });
    press('ArrowRight'); view.update(0); expect(view.model.road).toBe('forest');
    view.setEnabled(false); press('ArrowLeft'); press('Enter'); view.update(1); expect(confirm).not.toHaveBeenCalled();
    view.setEnabled(true); press('Enter', true); view.update(0); expect(confirm).not.toHaveBeenCalled();
    press('Enter'); view.update(0); expect(confirm).toHaveBeenCalledExactlyOnceWith('forest');
  });
  it('blocks a held pad when opened or resumed until release, then accepts A or B', () => {
    const { scene } = fakeScene(), confirm = vi.fn(), cancel = vi.fn();
    const pad = { axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    pad.buttons[1].pressed = true; vi.stubGlobal('navigator', { getGamepads: () => [{ ...pad, connected: true, mapping: 'standard' }] });
    const view = new RouteChoiceView(scene, data(), { onConfirm: confirm, onCancel: cancel });
    view.update(1, pad); expect(cancel).not.toHaveBeenCalled();
    pad.buttons[1].pressed = false; view.update(0, pad); pad.buttons[0].pressed = true;
    view.setEnabled(false); view.setEnabled(true); view.update(1, pad); expect(confirm).not.toHaveBeenCalled();
    pad.buttons[0].pressed = false; view.update(0, pad); pad.buttons[0].pressed = true; view.update(0, pad);
    expect(confirm).toHaveBeenCalledExactlyOnceWith('forest');
  });
});
