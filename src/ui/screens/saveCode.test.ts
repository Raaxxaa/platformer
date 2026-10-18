import { afterEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { SaveCodeModel, SaveCodeView } from './saveCode.ts';
import { RecordsView } from './records.ts';
import { defaultSave } from '../../data/save.ts';

describe('save-code confirmation (07 §7.9)', () => {
  it('export offers Copy/Back; navigation is bounded and copy does not change the code', () => {
    const m = new SaveCodeModel('export', 'RB1:CODE'); m.action('left', vi.fn()); expect(m.cursor).toBe(0);
    expect(m.action('confirm', vi.fn())).toEqual({ type: 'copy' }); expect(m.code).toBe('RB1:CODE');
    m.action('right', vi.fn()); m.action('right', vi.fn()); expect(m.cursor).toBe(1); expect(m.action('confirm', vi.fn())).toEqual({ type: 'close' });
  });
  it('invalid preview shows the exact error and leaves confirmation off', () => {
    const m = new SaveCodeModel('import', ''), preview = vi.fn(() => { throw Error('CRC'); }); m.setCode('bad');
    expect(m.action('confirm', preview)).toBeNull(); expect(m.error).toBe("That code isn't valid"); expect(m.confirming).toBe(false); expect(preview).toHaveBeenCalledExactlyOnceWith('bad');
  });
  it('valid preview only prepares a detached replacement; Confirm applies once acknowledged', () => {
    const save = defaultSave(), m = new SaveCodeModel('import', ''), preview = vi.fn(() => save); m.setCode('valid');
    expect(m.action('confirm', preview)).toBeNull(); expect(m.confirming).toBe(true); expect(m.error).toBe('');
    save.training.push(17); const command = m.action('confirm', preview); expect(command?.type).toBe('apply');
    if (command?.type !== 'apply') throw Error('missing candidate'); expect(command.data.training).toEqual([]); expect(preview).toHaveBeenCalledTimes(1);
    m.applied(true); expect(m.action('confirm', preview)).toBeNull();
  });
  it('Cancel/Back returns to editing with no apply; editing invalidates the old preview', () => {
    const m = new SaveCodeModel('import', ''), preview = vi.fn(defaultSave); m.setCode('first'); m.action('confirm', preview);
    m.action('right', preview); expect(m.action('confirm', preview)).toBeNull(); expect(m.confirming).toBe(false); expect(m.code).toBe('first');
    m.action('confirm', preview); m.setCode('second'); expect(m.confirming).toBe(false); expect(m.error).toBe('');
    expect(m.action('back', preview)).toEqual({ type: 'close' });
  });
  it('failed replacement does not close or pretend success', () => {
    const m = new SaveCodeModel('import', ''); m.setCode('valid'); m.action('confirm', defaultSave); m.applied(false);
    expect(m.confirming).toBe(true); expect(m.error).toBe("Can't replace this save");
  });
});

function surfaces() {
  type Node = Record<string, any>;
  const windowEvents = new Map<string, Set<(event: any) => void>>(), sceneEvents = new Map<string, () => void>(), scaleEvents = new Map<string, () => void>(), objects: Node[] = [], children: Node[] = [];
  const document: Node = { activeElement: null, body: { appendChild: (el: Node) => { children.push(el); } } };
  const make = (kind: string, args: any[]) => {
    const n: Node = { kind, args, handlers: {}, children: [], style: {}, value: '', readOnly: false, disabled: false, selectionStart: 0, selectionEnd: 0, destroyed: false };
    for (const method of ['setScrollFactor', 'setDepth', 'setTint', 'setOrigin', 'setPosition', 'setDisplaySize', 'setInteractive', 'setMaxWidth', 'fillStyle', 'fillRect', 'lineStyle', 'strokeRect', 'fillRoundedRect', 'strokeRoundedRect', 'fillCircle', 'strokeCircle', 'lineBetween', 'strokeTriangle']) n[method] = (...values: any[]) => { n[method + 'Args'] = values; return n; };
    n.on = (name: string, fn: (...args: any[]) => void) => { n.handlers[name] = fn; return n; };
    n.add = (child: Node) => { n.children.push(child); return n; }; n.removeAll = () => { n.children.forEach((child: Node) => child.destroy()); n.children = []; };
    n.destroy = () => { n.destroyed = true; };
    n.addEventListener = (name: string, fn: (...args: any[]) => void) => { n.handlers[name] = fn; };
    n.removeEventListener = (name: string) => { delete n.handlers[name]; };
    n.setAttribute = (name: string, value: string) => { n[name] = value; };
    n.focus = () => { document.activeElement = n; n.handlers.focus?.(); }; n.blur = () => { if (document.activeElement === n) { document.activeElement = null; n.handlers.blur?.(); } };
    n.select = () => { n.selectionStart = 0; n.selectionEnd = n.value.length; };
    n.remove = () => { children.splice(children.indexOf(n), 1); if (document.activeElement === n) document.activeElement = null; };
    objects.push(n); return n;
  };
  document.createElement = (kind: string) => make(kind, []);
  const bounds = { left: 10, top: 20, width: 1280, height: 720 };
  const scene = { scale: { width: 640, height: 360, on: (event: string, fn: () => void) => scaleEvents.set(event, fn), off: (event: string) => scaleEvents.delete(event) },
    game: { canvas: { getBoundingClientRect: () => bounds } }, textures: { exists: () => false },
    events: { once: (event: string, fn: () => void) => sceneEvents.set(event, fn), off: (event: string) => sceneEvents.delete(event) },
    add: Object.fromEntries(['graphics', 'container', 'rectangle', 'bitmapText', 'nineslice', 'image'].map((kind) => [kind, (...args: any[]) => make(kind, args)])),
  } as unknown as Phaser.Scene;
  vi.stubGlobal('window', { addEventListener: (event: string, fn: (event: any) => void) => { const set = windowEvents.get(event) ?? new Set(); set.add(fn); windowEvents.set(event, set); }, removeEventListener: (event: string, fn: (event: any) => void) => windowEvents.get(event)?.delete(fn) });
  const clipboard = vi.fn(async (_code: string) => {});
  vi.stubGlobal('navigator', { getGamepads: () => [], clipboard: { writeText: clipboard } }); vi.stubGlobal('document', document);
  const emit = (name: string, event: unknown = {}) => { for (const fn of [...windowEvents.get(name) ?? []]) fn(event); };
  return { scene, document, children, objects, bounds, windowEvents, sceneEvents, scaleEvents, clipboard, emit };
}
afterEach(() => vi.unstubAllGlobals());

describe('save-code DOM and shared menu view', () => {
  it('selects readonly export text, copies it, and scales/repositions with canvas resize', async () => {
    const s = surfaces(), view = new SaveCodeView(s.scene, 'export', { exportCode: 'RB1:EXPORTED', preview: defaultSave, confirm: () => true, onClose: vi.fn() });
    expect(view.textarea.readOnly).toBe(true); expect(view.textarea.selectionStart).toBe(0); expect(view.textarea.selectionEnd).toBe(12);
    expect(view.textarea.style).toMatchObject({ left: '122px', top: '240px', width: '1056px', height: '224px' });
    Object.assign(s.bounds, { left: 100, top: 50, width: 640, height: 360 }); s.emit('resize');
    expect(view.textarea.style).toMatchObject({ left: '156px', top: '160px', width: '528px', height: '112px' });
    view.action('confirm'); await Promise.resolve(); expect(s.clipboard).toHaveBeenCalledExactlyOnceWith('RB1:EXPORTED'); expect(view.model.notice).toBe('Copied'); view.destroy();
  });
  it('leaves typed Enter/letters/Backspace alone; Escape closes and cleans DOM/listeners/focus', () => {
    const s = surfaces(), close = vi.fn(), focus = vi.fn(), preview = vi.fn(defaultSave);
    const view = new SaveCodeView(s.scene, 'import', { exportCode: '', preview, confirm: () => true, onClose: close, onFocus: focus });
    expect(s.document.activeElement).toBe(view.textarea); expect(focus).toHaveBeenLastCalledWith(true);
    for (const code of ['Enter', 'KeyE', 'Backspace', 'Space']) s.emit('keydown', { code, repeat: false, preventDefault: vi.fn() });
    view.update(0); expect(preview).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
    const event = { code: 'Escape', repeat: false, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    (view.textarea as unknown as Record<string, any>).handlers.keydown(event);
    expect(event.preventDefault).toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1); expect(s.children).toHaveLength(0);
    expect(focus).toHaveBeenLastCalledWith(false); expect(s.windowEvents.get('keydown')?.size).toBe(0); expect(s.scaleEvents.size).toBe(0);
  });
  it('previews without applying, blurs for Confirm/Cancel, and applies exactly once', () => {
    const s = surfaces(), confirm = vi.fn(() => true), applied = vi.fn(), close = vi.fn();
    const view = new SaveCodeView(s.scene, 'import', { exportCode: '', preview: defaultSave, confirm, onClose: close, onApplied: applied });
    view.textarea.value = 'valid'; (view.textarea as unknown as Record<string, any>).handlers.input(); view.action('confirm');
    expect(view.model.confirming).toBe(true); expect(view.textarea.readOnly).toBe(true); expect(s.document.activeElement).toBeNull(); expect(confirm).not.toHaveBeenCalled();
    view.action('back'); expect(view.model.confirming).toBe(false); expect(view.textarea.readOnly).toBe(false); expect(s.document.activeElement).toBe(view.textarea);
    view.action('confirm'); view.action('confirm'); view.action('confirm');
    expect(confirm).toHaveBeenCalledTimes(1); expect(applied).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1); expect(s.children).toHaveLength(0);
  });
  it('cleans textarea on scene shutdown and ignores non-left pointer clicks', () => {
    const s = surfaces(), preview = vi.fn(defaultSave), view = new SaveCodeView(s.scene, 'import', { exportCode: '', preview, confirm: () => true, onClose: vi.fn() });
    const target = s.objects.find((object) => object.kind === 'rectangle' && object.args[0] === 232)!;
    target.handlers.pointerdown({ button: 2 }); target.handlers.pointerdown({ button: 1 }); expect(preview).not.toHaveBeenCalled();
    s.sceneEvents.get('shutdown')?.(); expect(s.children).toHaveLength(0); expect(view.active).toBe(false);
  });
  it('shares held-pad release guards, pause blocking, and current direct menu input', () => {
    const s = surfaces(), close = vi.fn(), pad = { axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    pad.buttons[1].pressed = true; vi.stubGlobal('navigator', { getGamepads: () => [{ ...pad, connected: true, mapping: 'standard' }] });
    const view = new RecordsView(s.scene, defaultSave, { onClose: close }); view.update(1, pad); expect(close).not.toHaveBeenCalled();
    view.setEnabled(false); view.action('back'); expect(close).not.toHaveBeenCalled(); view.setEnabled(true); view.update(1, pad); expect(close).not.toHaveBeenCalled();
    pad.buttons[1].pressed = false; view.update(0, pad); pad.buttons[1].pressed = true; view.update(0, pad); expect(close).toHaveBeenCalledTimes(1);
  });
  it('allows controller A while textarea is focused, blocks the opening hold, and needs a fresh A to apply', () => {
    const s = surfaces(), preview = vi.fn(defaultSave), close = vi.fn(), confirm = vi.fn(() => true), pad = { axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    pad.buttons[0].pressed = true;
    vi.stubGlobal('navigator', { getGamepads: () => [{ ...pad, connected: true, mapping: 'standard' }] });
    const view = new SaveCodeView(s.scene, 'import', { exportCode: '', preview, confirm, onClose: close });
    view.update(1, pad); expect(view.model.cursor).toBe(0); expect(view.active).toBe(true); expect(preview).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
    pad.buttons[0].pressed = false; view.update(0, pad); pad.buttons[0].pressed = true; view.update(0, pad);
    expect(preview).toHaveBeenCalledTimes(1); expect(view.model.confirming).toBe(true); expect(confirm).not.toHaveBeenCalled();
    view.update(1, pad); expect(confirm).not.toHaveBeenCalled(); pad.buttons[0].pressed = false; view.update(0, pad); pad.buttons[0].pressed = true; view.update(0, pad);
    expect(confirm).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1);
  });
  it('allows direct D-pad/B menu input to leave a focused textarea without keyboard input', () => {
    const s = surfaces(), close = vi.fn(), pad = { axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    vi.stubGlobal('navigator', { getGamepads: () => [{ ...pad, connected: true, mapping: 'standard' }] });
    const view = new SaveCodeView(s.scene, 'export', { exportCode: 'RB1:CODE', preview: defaultSave, confirm: () => true, onClose: close });
    pad.buttons[15].pressed = true; view.update(0, pad); expect(view.model.cursor).toBe(1);
    pad.buttons[15].pressed = false; view.update(0, pad); pad.buttons[1].pressed = true; view.update(0, pad);
    expect(close).toHaveBeenCalledTimes(1); expect(s.children).toHaveLength(0);
  });
});
