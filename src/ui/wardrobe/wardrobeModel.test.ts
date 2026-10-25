import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK } from '../../data/cosmetics.ts';
import { PREVIEW_ANIMS, WardrobeModel } from './wardrobeModel.ts';

const make = (owned: string[] = [], opts = {}) => new WardrobeModel({ ...DEFAULT_LOOK }, owned, opts);

describe('wardrobe model (09 §6)', () => {
  it('cycling skips locked colors and items, and wraps', () => {
    const m = make();
    expect(m.options('colorA').map((o) => o.id)).not.toContain('crimson');
    expect(m.options('head')).toEqual([{ id: null, name: 'None' }]);
    const owned = make(['dye_crimson', 'acc_wolf', 'hat_straw', 'cape_gold']);
    expect(owned.options('colorA').map((o) => o.id)).toContain('crimson');
    expect(owned.options('head').map((o) => o.id)).toEqual([null, 'acc_wolf', 'hat_straw']);
    expect(owned.options('back').map((o) => o.id)).toEqual([null, 'cape_gold']);
    owned.cycle('head', 1); expect(owned.look.head).toBe('acc_wolf');
    owned.cycle('head', 1); owned.cycle('head', 1); expect(owned.look.head).toBeNull();
    owned.cycle('head', -1); expect(owned.look.head).toBe('hat_straw');
  });
  it('changing race keeps the skin in range and takes the race default beard', () => {
    const m = make(); m.look.skin = 5;
    m.cycle('race', 1); m.cycle('race', 1);                       // human → elf → dwarf
    expect(m.look.race).toBe('dwarf'); expect(m.look.beard).toBe(3);
    m.cycle('race', 1);                                           // orc has 4 skins
    expect(m.look.race).toBe('orc'); expect(m.look.skin).toBe(3);
  });
  it('Undo restores the saved look and Confirm hands out the draft', () => {
    const m = make(); m.cycle('hair', 1); m.cycle('face', 1);
    expect(m.changed).toBe(true);
    m.zone = 'footer'; m.footer = 1; expect(m.action('confirm')).toBeNull();
    expect(m.look).toEqual(DEFAULT_LOOK); expect(m.changed).toBe(false);
    m.cycle('hair', 1); m.footer = 2;
    expect(m.action('confirm')).toEqual({ type: 'confirm', look: { ...DEFAULT_LOOK, hair: DEFAULT_LOOK.hair + 1 } });
  });
  it('Back closes without confirming', () => { expect(make().action('back')).toEqual({ type: 'close' }); });
  it('Random only picks owned options', () => {
    let n = 0; const rng = () => ((n = (n * 7 + 3) % 11) / 11);
    const m = make(['acc_wolf', 'hair_pink'], { rng });
    for (let i = 0; i < 30; i++) {
      m.randomize();
      expect([null, 'acc_wolf']).toContain(m.look.head); expect(m.look.back).toBeNull();
      expect(['black', 'brown', 'auburn', 'blond', 'grey', 'white', 'pink']).toContain(m.look.hairColor);
    }
  });
  it('moves between tabs, rows, the preview buttons and the footer by direction', () => {
    const m = make();
    expect(m.zone).toBe('rows');
    m.action('up'); expect(m.zone).toBe('tabs');
    m.action('right'); expect(m.tab).toBe('clothes');
    m.action('down'); expect(m.zone).toBe('rows');
    for (let i = 0; i < 3; i++) m.action('down');
    expect(m.zone).toBe('anim');
    m.action('right'); expect(m.anim).toBe(PREVIEW_ANIMS[1]);
    m.action('down'); expect(m.zone).toBe('footer');
  });
  it('the first-launch wardrobe starts on Confirm', () => {
    const m = make([], { intro: true });
    expect(m.zone).toBe('footer'); expect(m.footer).toBe(2);
    expect(m.action('confirm')).toMatchObject({ type: 'confirm' });
  });
  it('the collection grid moves a cursor and leaves through the top and bottom', () => {
    const m = make(); m.setTab('collection'); m.zone = 'rows';
    m.action('right'); expect(m.cell).toBe(1);
    m.action('down'); expect(m.cell).toBe(11);
    m.action('up'); m.action('up'); expect(m.zone).toBe('tabs');
    m.zone = 'rows'; m.cell = 58; m.action('down'); expect(m.zone).toBe('footer');
  });
});
