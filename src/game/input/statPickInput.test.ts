import { describe, expect, it } from 'vitest';
import { StatPickInput } from './statPickInput.ts';

describe('stat pick menu devices (07 §7.1)', () => {
  it('reads fixed keyboard confirm/back and ignores browser repeats', () => {
    const m = new StatPickInput();
    m.key('Enter', true, false); expect(m.poll(0)).toEqual(['confirm']);
    m.key('Enter', true, true); expect(m.poll(1)).toEqual([]);
    m.key('Backspace', true, false); expect(m.poll(0)).toEqual(['back']);
  });
  it('repeats navigation after 0.35 s then every 0.10 s', () => {
    const m = new StatPickInput(); m.key('ArrowRight', true, false);
    expect(m.poll(0)).toEqual(['right']); expect(m.poll(0.34)).toEqual([]);
    expect(m.poll(0.01)).toEqual(['right']); expect(m.poll(0.1)).toEqual(['right']);
    m.key('ArrowRight', false, false); expect(m.poll(1)).toEqual([]);
  });
  it('reads gamepad A and stick/D-pad navigation, not B as confirm', () => {
    const m = new StatPickInput();
    const pad = { axes: [0.6], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    pad.buttons[0].pressed = true; expect(m.poll(0, pad)).toEqual(['right', 'confirm']);
    expect(m.poll(0, pad)).toEqual([]);
    pad.buttons[0].pressed = false; pad.buttons[1].pressed = true; pad.axes[0] = 0;
    expect(m.poll(0, pad)).toEqual(['back']);
  });
  it('swallows a held gamepad confirm after closing pause until release', () => {
    const m = new StatPickInput(), pad = { axes: [0], buttons: [{ pressed: true }] };
    m.blockUntilRelease(); expect(m.poll(1, pad)).toEqual([]);
    pad.buttons[0].pressed = false; expect(m.poll(0, pad)).toEqual([]);
    pad.buttons[0].pressed = true; expect(m.poll(0, pad)).toEqual(['confirm']);
  });
  it('a cleared earlier menu cannot swallow the first intentional key of a later popup', () => {
    const m = new StatPickInput(); m.blockUntilRelease(); m.clear();
    m.key('ArrowRight', true, false); expect(m.poll(0)).toEqual(['right']);
  });
});
