import { describe, expect, it } from 'vitest';
import { SettingsModel } from './settings.ts';
// A device that can vibrate (the row is hidden where it can't, review P8).
(globalThis.navigator as { vibrate?: unknown }).vibrate ??= () => true;
import { defaultSettings } from '../../data/save.ts';

describe('settings menu (07 §7.7)', () => {
  it('lists only built features and leaves saved music/damage-number fields intact', () => {
    const settings = defaultSettings(), m = new SettingsModel(() => settings);
    expect(m.rows).toEqual(['controls', 'master', 'sfx', 'timer', 'shake', 'icons', 'hud', 'assist', 'touch', 'fullscreen', 'export', 'import', 'back']);
    m.select(1); const command = m.action('left'); expect(command?.type).toBe('change');
    if (command?.type !== 'change') throw Error('missing change');
    expect(command.settings.volume).toEqual({ master: 70, music: 70, sfx: 80 }); expect(command.settings.damageNumbers).toBe(true); expect(settings.volume.master).toBe(80);
  });
  it('changes volume in10-point steps, clamps0–100, and returns detached snapshots', () => {
    let settings = defaultSettings(); const m = new SettingsModel(() => settings); m.select(1);
    for (let i = 0; i < 20; i++) { const command = m.action('left'); if (command?.type === 'change') settings = command.settings; }
    expect(settings.volume.master).toBe(0); expect(m.action('left')).toBeNull();
    for (let i = 0; i < 20; i++) { const command = m.action('right'); if (command?.type === 'change') settings = command.settings; }
    expect(settings.volume.master).toBe(100); expect(m.action('right')).toBeNull();
  });
  it('edits booleans and icon styles without wrapping or mutating the source', () => {
    let settings = defaultSettings(); const m = new SettingsModel(() => settings); m.select(3);
    const off = m.action('left'); if (off?.type !== 'change') throw Error('missing toggle'); settings = off.settings;
    expect(settings.showTimer).toBe(false);
    const toggledLeft = m.action('left'); expect(toggledLeft?.type === 'change' && toggledLeft.settings.showTimer).toBe(true);
    const toggledRight = m.action('right'); expect(toggledRight?.type === 'change' && toggledRight.settings.showTimer).toBe(true);
    const on = m.action('confirm'); expect(on?.type === 'change' && on.settings.showTimer).toBe(true);
    m.select(5); for (let i = 0; i < 3; i++) { const next = m.action('right'); if (next?.type === 'change') settings = next.settings; }
    expect(settings.promptStyle).toBe('playstation'); expect(m.action('right')).toBeNull();
  });
  it('opens the Controls page, Back returns, and top/bottom do not wrap', () => {
    const m = new SettingsModel(defaultSettings); m.action('up'); expect(m.cursor).toBe(0);
    expect(m.action('confirm')).toBeNull(); expect(m.controlsOpen).toBe(true); m.action('left'); expect(m.controlsOpen).toBe(true);
    expect(m.action('back')).toBeNull(); expect(m.controlsOpen).toBe(false);
    m.select(12); m.action('down'); expect(m.cursor).toBe(12); expect(m.action('confirm')).toEqual({ type: 'close' });
  });
  it('returns export/import/fullscreen callbacks without treating them as saved settings', () => {
    const m = new SettingsModel(defaultSettings);
    for (const [index, type] of [[6, 'hudLayout'], [9, 'fullscreen'], [10, 'export'], [11, 'import']] as const) { m.select(index); expect(m.action('confirm')).toEqual({ type }); }
    expect(m.action('back')).toEqual({ type: 'close' });
  });
});

describe('touch settings page (07 §8.6, M12 Task 5)', () => {
  const open = () => {
    let settings = defaultSettings(); const m = new SettingsModel(() => settings); m.select(8);
    expect(m.action('confirm')).toBeNull(); expect(m.touchOpen).toBe(true); expect(m.cursor).toBe(0);
    const apply = (a: Parameters<SettingsModel['action']>[0]) => { const c = m.action(a); if (c?.type === 'change') settings = c.settings; return c; };
    return { m, apply, get s() { return settings; } };
  };
  it('cycles Auto/On/Off, steps opacity (20–100) and size (80–130), toggles hand and vibration, flips effects', () => {
    const t = open();
    t.apply('right'); expect(t.s.touch.mode).toBe('on'); t.apply('right'); t.apply('right'); expect(t.s.touch.mode).toBe('auto');
    t.apply('down'); t.apply('right'); expect(t.s.touch.opacity).toBe(60);
    for (let i = 0; i < 20; i++) t.apply('right'); expect(t.s.touch.opacity).toBe(100); expect(t.apply('right')).toBeNull();
    for (let i = 0; i < 30; i++) t.apply('left'); expect(t.s.touch.opacity).toBe(20);
    t.apply('down'); t.apply('right'); expect(t.s.touch.size).toBe(110); t.apply('right'); t.apply('right'); expect(t.s.touch.size).toBe(130); expect(t.apply('right')).toBeNull();
    t.apply('down'); t.apply('confirm'); expect(t.s.touch.leftHanded).toBe(true);
    t.apply('down'); t.apply('confirm'); expect(t.s.touch.vibration).toBe(false);
    t.apply('down'); t.apply('confirm'); expect(t.s.touch.effects).toBe('low');       // the desktop default is High, so the first flip is Low
    t.apply('confirm'); expect(t.s.touch.effects).toBe('high');
  });
  it('Edit layout asks for the editor, and Back returns to the main page where it was', () => {
    const t = open();
    for (let i = 0; i < 6; i++) t.apply('down');
    expect(t.m.action('confirm')).toEqual({ type: 'layout' });
    t.apply('down'); expect(t.m.action('confirm')).toBeNull(); expect(t.m.touchOpen).toBe(false); expect(t.m.cursor).toBe(8);
  });
  it('Controls page (07 §7.8): capture a key, Escape cancels, a refused clear flashes, Reset restores defaults', () => {
    let settings = defaultSettings();
    const m = new SettingsModel(() => settings); m.action('confirm');
    for (let i = 0; i < 4; i++) m.action('down');                 // Jump, Key 1
    expect(m.controls.action).toBe('jump');
    m.action('confirm'); expect(m.controls.capture).toMatchObject({ action: 'jump', col: 0 });
    expect(m.capturedKey('Escape', 1)).toBeNull(); expect(m.controls.capture).toBeNull();
    m.action('confirm');
    const c = m.capturedKey('KeyK', 1)!; expect(c.type).toBe('change');
    if (c.type !== 'change') throw Error('no change'); settings = c.settings;
    expect(settings.bindings.keyboard.jump[0]).toBe('KeyK'); expect(settings.bindings.keyboard.attack2[0]).toBe('Space');
    expect(m.clearCell(2)).toBeNull(); expect(m.controls.flash).toMatchObject({ action: 'jump', col: 0 });   // Jump's only key
    m.action('confirm'); m.tick(4); expect(m.controls.capture).not.toBeNull(); m.tick(9); expect(m.controls.capture).toBeNull();                              // 5 s without a press cancels
    m.action('right'); m.action('right'); m.action('confirm');                                           // the gamepad cell
    const p = m.capturedPad(3, 11)!; if (p.type !== 'change') throw Error('no pad change'); settings = p.settings;
    expect(settings.bindings.gamepad.jump).toBe(3); expect(settings.bindings.gamepad.attack2).toBe(0);
    for (let i = 0; i < 20; i++) m.action('down');
    m.action('up'); const r = m.action('confirm')!;                                                     // Reset to defaults
    if (r.type !== 'change') throw Error('no reset'); expect(r.settings.bindings).toEqual(defaultSettings().bindings);
  });
  it('Assist page (06 §5.4): steps speed 100/85/70 and damage 100/75/50, toggles flask and doors, Back returns', () => {
    let settings = defaultSettings(); const m = new SettingsModel(() => settings); m.select(7);
    const apply = (a: Parameters<SettingsModel['action']>[0]) => { const c = m.action(a); if (c?.type === 'change') settings = c.settings; return c; };
    apply('confirm'); expect(m.assistOpen).toBe(true);
    apply('right'); expect(settings.assist.speed).toBe(0.85); apply('right'); expect(settings.assist.speed).toBe(0.7);
    apply('down'); apply('right'); apply('right'); expect(settings.assist.damageTaken).toBe(0.5);
    apply('down'); apply('confirm'); expect(settings.assist.extraFlask).toBe(true);
    apply('down'); apply('confirm'); expect(settings.assist.longerDoors).toBe(true);
    apply('down'); apply('confirm'); expect(m.assistOpen).toBe(false); expect(m.cursor).toBe(7);
  });
});

describe('vibration row (review P8)', () => {
  it('is hidden where the device cannot vibrate', () => {
    const nav = globalThis.navigator as { vibrate?: unknown }, saved = nav.vibrate; delete nav.vibrate;
    try { expect(new SettingsModel(defaultSettings).touchRowsHere).not.toContain('vibe'); } finally { nav.vibrate = saved; }
    expect(new SettingsModel(defaultSettings).touchRowsHere).toContain('vibe');
  });
});
