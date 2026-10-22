import { describe, expect, it } from 'vitest';
import { HomePanelsModel, HomePanelInput, type HomePanelData } from './homePanels.ts';

const data = (seed: string | null = null): HomePanelData => ({ typedSeed: seed, progress: { classesDiscovered: ['iron_will'] }, unlocks: { blueprints: ['hand_cannon'] } });
const seed = () => new HomePanelsModel('seed', data(), () => 'ABCDEFGH');

describe('Home seed panel (07 §6.12)', () => {
  it('accepts 1–12 upper-case letters/digits and ignores invalid characters', () => {
    const m = seed();
    for (const text of ['a', 'b', '7', '-', '!', ' ']) m.action({ text });
    expect(m.seed).toBe('AB7'); expect(m.cursor).toBe(3);
    expect(m.action('confirm')).toEqual({ type: 'seed', seed: 'AB7' });
  });
  it('uses only the prefix before the first blank; Backspace removes the box to the left', () => {
    const m = new HomePanelsModel('seed', data('ABCD'), () => 'ABCDEFGH');
    m.action('backspace'); expect(m.seed).toBe('ABC'); expect(m.cursor).toBe(3);
    m.action('left'); m.action('up'); expect(m.seed).toBe('ABD');
    m.action('left'); m.action('down'); expect(m.seed).toBe('AAD');
    m.select(1); m.action('down'); expect(m.seed).toBe('A');
    expect(m.action('confirm')).toEqual({ type: 'seed', seed: 'A' });
  });
  it('cycles blank → A…Z → 0…9 → blank; down reverses the cycle', () => {
    const m = seed(); m.action('up'); expect(m.seed).toBe('A');
    for (let i = 0; i < 25; i++) m.action('up'); expect(m.seed).toBe('Z');
    m.action('up'); expect(m.seed).toBe('0');
    for (let i = 0; i < 9; i++) m.action('up'); expect(m.seed).toBe('9');
    m.action('up'); expect(m.seed).toBe(''); m.action('down'); expect(m.seed).toBe('9');
  });
  it('Use is disabled while empty, Random fills without committing, Clear removes the seed', () => {
    const m = seed(); expect(m.action('confirm')).toBeNull(); expect(m.canUse).toBe(false);
    m.select(13); expect(m.action('confirm')).toBeNull(); expect(m.seed).toBe('ABCDEFGH');
    m.select(12); expect(m.action('confirm')).toEqual({ type: 'seed', seed: 'ABCDEFGH' });
    m.select(14); expect(m.action('confirm')).toEqual({ type: 'seed', seed: null });
  });
  it('has bounded navigation, skips disabled Use, and Back leaves the active seed unchanged', () => {
    const m = seed(); m.action('left'); expect(m.cursor).toBe(0);
    m.select(11); m.action('right'); expect(m.cursor).toBe(13);
    m.select(15); m.action('right'); expect(m.cursor).toBe(15);
    expect(m.action('back')).toEqual({ type: 'close' });
  });
  it('keeps exactly 12 boxes and overwrites the last box without growing the seed', () => {
    const m = seed(); for (const text of 'ABCDEFGHIJKL') m.action({ text });
    expect(m.seed).toBe('ABCDEFGHIJKL'); expect(m.cursor).toBe(11);
    m.action({ text: 'M' }); expect(m.seed).toBe('ABCDEFGHIJKM');
  });
});

describe('direct Home menu input', () => {
  it('blocks buttons already held when a menu opens until each is released', () => {
    const input = new HomePanelInput('training');
    const pad = { axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    pad.buttons[1].pressed = true; input.blockHeldPad(pad);
    expect(input.poll(0, pad)).toEqual([]); expect(input.poll(1, pad)).toEqual([]);
    pad.buttons[1].pressed = false; input.poll(0, pad); pad.buttons[1].pressed = true;
    expect(input.poll(0, pad)).toEqual(['back']);
  });
  it('seed letters only type; Enter confirms, Escape backs, Backspace deletes', () => {
    const i = new HomePanelInput('seed');
    i.key('KeyA', true); i.key('Space', true); i.key('KeyE', true); i.key('Enter', true); i.key('Backspace', true); i.key('Escape', true);
    expect(i.poll(0)).toEqual([{ text: 'A' }, { text: 'E' }, 'confirm', 'backspace', 'back']);
  });
  it('ignores browser repeat; repeats navigation after 0.35 seconds and every 0.10 seconds', () => {
    const i = new HomePanelInput('seed'); i.key('ArrowRight', true); i.key('ArrowRight', true, true);
    expect(i.poll(0)).toEqual(['right']); expect(i.poll(0.34)).toEqual([]);
    expect(i.poll(0.01)).toEqual(['right']); expect(i.poll(0.10)).toEqual(['right']);
    i.key('ArrowRight', false); expect(i.poll(1)).toEqual([]);
  });
  it('reads pad arrows/stick, A confirm and B back', () => {
    const i = new HomePanelInput('seed'), pad = { axes: [0.6, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    pad.buttons[0].pressed = true; expect(i.poll(0, pad)).toEqual(['right', 'confirm']);
    expect(i.poll(0, pad)).toEqual([]); pad.axes[0] = 0; pad.buttons[0].pressed = false; pad.buttons[1].pressed = true;
    expect(i.poll(0, pad)).toEqual(['back']);
  });
});

describe('Home training and records panels', () => {
  it('defaults the Training Yard offer to Yes; No/back closes; choices do not wrap', () => {
    const m = new HomePanelsModel('training', data(), () => 'ABCDEFGH');
    expect(m.action('confirm')).toEqual({ type: 'training' });
    m.action('right'); m.action('right'); expect(m.cursor).toBe(1); expect(m.action('confirm')).toEqual({ type: 'close' });
    m.action('left'); m.action('left'); expect(m.cursor).toBe(0); expect(m.action('back')).toEqual({ type: 'close' });
  });
  it('shows only actual discoveries and blueprint IDs; records confirm/back closes', () => {
    const m = new HomePanelsModel('records', data(), () => 'ABCDEFGH');
    expect(m.classes).toEqual(['iron_will']); expect(m.blueprints).toEqual(['hand_cannon']);
    expect(m.action('confirm')).toEqual({ type: 'close' });
    expect(m.action('back')).toEqual({ type: 'close' });
  });
});

describe('seed panel layout code (06 §8.7)', () => {
  it('shows the Plains layout the typed seed gives, matching the run', async () => {
    const { createRunState } = await import('../../core/run/runState.ts');
    const { layoutCode } = await import('../../core/run/layout.ts');
    const m = new HomePanelsModel('seed', data('RACE1'), () => 'ABCDEFGH');
    expect(m.layoutLine).toBe(`Plains layout ${layoutCode(createRunState('RACE1').layout.plains)}`);
    expect(seed().layoutLine).toBe('');
  });
});
