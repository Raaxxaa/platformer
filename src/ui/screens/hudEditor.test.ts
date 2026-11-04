import { describe, expect, it } from 'vitest';
import { defaultHud } from '../model/hudLayout.ts';
import { HudEditorModel } from './hudEditor.ts';

describe('HUD layout editor (07 §4.1a)', () => {
  it('nudges the picked group by 4 px, refuses Confirm on overlap, Reset restores the defaults', () => {
    const m = new HudEditorModel(defaultHud(false), false);
    expect(m.group).toBe('slots');
    m.action('down'); expect(m.layout.slots).toEqual({ x: 504, y: 8 });
    m.pick('slots'); m.place(8, 8); expect(m.problems).toEqual(['vitals', 'slots']); expect(m.action('confirm')).toBeNull();
    m.preset(3); expect(m.problems).toEqual([]); expect(m.action('confirm')).toBe('save');
    expect(m.saved()).toEqual({ slots: m.layout.slots });
    m.reset(); expect(m.saved()).toEqual({}); expect(m.action('back')).toBe('cancel');
  });
});
