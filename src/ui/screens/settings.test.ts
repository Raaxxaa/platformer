import { describe, expect, it } from 'vitest';
import { SettingsModel } from './settings.ts';
import { defaultSettings } from '../../data/save.ts';

describe('settings menu (07 §7.7)', () => {
  it('lists only built features and leaves saved music/damage-number fields intact', () => {
    const settings = defaultSettings(), m = new SettingsModel(() => settings);
    expect(m.rows).toEqual(['controls', 'master', 'sfx', 'timer', 'shake', 'icons', 'touch', 'fullscreen', 'export', 'import', 'back']);
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
  it('opens current controls read-only, Back returns, and top/bottom do not wrap', () => {
    const m = new SettingsModel(defaultSettings); m.action('up'); expect(m.cursor).toBe(0);
    expect(m.action('confirm')).toBeNull(); expect(m.controlsOpen).toBe(true); m.action('left'); expect(m.controlsOpen).toBe(true);
    expect(m.action('back')).toBeNull(); expect(m.controlsOpen).toBe(false);
    m.select(10); m.action('down'); expect(m.cursor).toBe(10); expect(m.action('confirm')).toEqual({ type: 'close' });
  });
  it('returns export/import/fullscreen callbacks without treating them as saved settings', () => {
    const m = new SettingsModel(defaultSettings);
    for (const [index, type] of [[7, 'fullscreen'], [8, 'export'], [9, 'import']] as const) { m.select(index); expect(m.action('confirm')).toEqual({ type }); }
    expect(m.action('back')).toEqual({ type: 'close' });
  });
});

describe('touch settings page (07 §8.6, M12 Task 5)', () => {
  const open = () => {
    let settings = defaultSettings(); const m = new SettingsModel(() => settings); m.select(6);
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
    t.apply('down'); expect(t.m.action('confirm')).toBeNull(); expect(t.m.touchOpen).toBe(false); expect(t.m.cursor).toBe(6);
  });
});
