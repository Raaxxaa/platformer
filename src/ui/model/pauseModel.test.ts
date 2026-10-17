import { describe, expect, it } from 'vitest';
import { PauseModel } from './pauseModel.ts';

describe('pause menu (07 §7.6)', () => {
  it('opens on MENU; left/right switch tabs; disabled items are skipped', () => {
    const m = new PauseModel('run');
    expect(m.tab).toBe('MENU');
    expect(m.items.map((i) => i.label)).toEqual(['Resume', 'Restart run', 'Settings', 'Quit to title']);
    m.input('down', 0);
    expect(m.selected.label).toBe('Restart run');
    m.input('down', 0);
    expect(m.selected.label).toBe('Quit to title');          // Settings is disabled until the settings screen exists
    m.input('right', 0);
    expect(m.tab).toBe('LOADOUT');
    m.input('right', 0); m.input('right', 0);
    expect(m.tab).toBe('CONTROLS');                           // lists don't wrap
  });
  it('confirm and back', () => {
    const m = new PauseModel('run');
    expect(m.input('confirm', 0)).toBe('resume');
    expect(new PauseModel('run').input('back', 0)).toBe('resume');
    const r = new PauseModel('run'); r.input('down', 0);
    expect(r.input('confirm', 0)).toBe('restart');
  });
  it('a quit item needs a second confirm within 2.0 s', () => {
    const m = new PauseModel('training');
    expect(m.items.map((i) => i.label)).toEqual(['Resume', 'Settings', 'Leave Training Yard']);
    m.input('down', 0);
    expect(m.input('confirm', 0)).toBeNull();
    expect(m.selected.label).toBe('Quit? Confirm again');
    expect(m.input('confirm', 2500)).toBeNull();               // too late: armed again instead
    expect(m.input('confirm', 3000)).toBe('quit');
  });
});
