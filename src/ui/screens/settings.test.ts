import { describe, expect, it } from 'vitest';
import { SettingsModel } from './settings.ts';
import { defaultSettings } from '../../data/save.ts';

describe('settings menu (07 §7.7)', () => {
  it('lists only built features and leaves saved music/damage-number fields intact', () => {
    const settings = defaultSettings(), m = new SettingsModel(() => settings);
    expect(m.rows).toEqual(['controls', 'master', 'sfx', 'timer', 'shake', 'icons', 'fullscreen', 'export', 'import', 'back']);
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
    m.select(9); m.action('down'); expect(m.cursor).toBe(9); expect(m.action('confirm')).toEqual({ type: 'close' });
  });
  it('returns export/import/fullscreen callbacks without treating them as saved settings', () => {
    const m = new SettingsModel(defaultSettings);
    for (const [index, type] of [[6, 'fullscreen'], [7, 'export'], [8, 'import']] as const) { m.select(index); expect(m.action('confirm')).toEqual({ type }); }
    expect(m.action('back')).toEqual({ type: 'close' });
  });
});
