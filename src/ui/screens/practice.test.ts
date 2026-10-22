import { describe, expect, it } from 'vitest';
import { defaultSave, type SaveData } from '../../core/save/schema.ts';
import { PracticeResultModel, PracticeSetupModel, practiceBestLine } from './practice.ts';

const save = (change: (s: SaveData) => void = () => {}): SaveData => { const s = defaultSave(); change(s); return s; };

describe('practice setup model (07 §7.4)', () => {
  it('opens on Stage 1 with the saved kit and shows the seed and best rows read-only', () => {
    const s = save((d) => { d.lastKit = { cls: 'tank', weapon: 'iron_fists' }; d.practiceBests['plains|tank|1-1-1-1-1'] = 7200; });
    const m = new PracticeSetupModel(() => s);
    expect(m.value('stage')).toBe('1 · Plains & Forest'); expect(m.cls).toBe('tank'); expect(m.weapon).toBe('iron_fists');
    expect(m.value('seed')).toBe('Random'); expect(m.value('best')).toBe('—'); expect(m.value('dragon')).toBe('—');   // Random layout: no fixed best
    expect(m.selectable).toEqual(['stage', 'class', 'weapon', 'layout', 'start', 'back']);
    m.layoutMode = 'classic'; expect(m.value('best')).toBe('1:00.00');
  });
  it('lists only reached stages and shows the typed seed', () => {
    const s = save((d) => { d.progress.levelsReached = ['plains', 'swamps', 'kingdom']; d.typedSeed = 'RACE1'; });
    const m = new PracticeSetupModel(() => s);
    m.action('right'); expect(m.value('stage')).toBe('2 · Dark Forest & Swamps');
    m.action('right'); expect(m.value('stage')).toBe('3 · Enemy Kingdom'); m.action('right'); expect(m.value('stage')).toBe('1 · Plains & Forest');
    expect(m.value('seed')).toBe('RACE1');
  });
  it('enables the Dragon row on Stages 2 and 3 only and cycles its options', () => {
    const s = save((d) => { d.progress.levelsReached = ['plains', 'mountains', 'castle']; });
    const m = new PracticeSetupModel(() => s);
    m.action('right'); expect(m.selectable).toContain('dragon');
    m.action('down'); m.action('down'); m.action('down'); expect(m.cursor).toBe('dragon');
    expect(m.value('dragon')).toBe('Off'); m.action('right'); expect(m.value('dragon')).toBe('Random color'); m.action('right'); expect(m.setup.dragon).toBe('red');
    m.action('up'); m.action('up'); m.action('up'); m.action('right');
    expect(m.value('stage')).toBe("4 · King's Castle"); expect(m.setup.dragon).toBe('off'); expect(m.selectable).not.toContain('dragon');
  });
  it('changing class resets the weapon list, and the third weapon appears when unlocked', () => {
    const s = save((d) => { d.unlocks.startWeapons.archer = ['throwing_knives']; });
    const m = new PracticeSetupModel(() => s);
    m.action('down'); m.action('right'); m.action('right'); expect(m.cls).toBe('archer'); expect(m.weapon).toBe('bow');
    m.action('down'); m.action('left'); expect(m.weapon).toBe('throwing_knives');
  });
  it('Start and Back return results; Back key backs out; the setup comes out as chosen', () => {
    const m = new PracticeSetupModel(() => save());
    m.action('down'); m.action('down'); m.action('down'); m.action('down'); expect(m.cursor).toBe('start');
    expect(m.action('confirm')).toBe('start'); expect(m.setup).toEqual({ levelId: 'plains', cls: 'swordsman', weapon: 'greatsword', dragon: 'off', layout: null });
    m.action('down'); expect(m.action('confirm')).toBe('back'); expect(m.action('back')).toBe('back');
  });
  it('remembers an earlier setup', () => {
    const m = new PracticeSetupModel(() => save((d) => { d.progress.levelsReached = ['plains', 'kingdom']; }), { levelId: 'kingdom', cls: 'wizard', weapon: 'staff', dragon: 'storm' });
    expect(m.setup).toEqual({ levelId: 'kingdom', cls: 'wizard', weapon: 'staff', dragon: 'storm', layout: null });
  });
});

describe('practice Layout option (06 §8.7)', () => {
  it('Random, Classic, or Custom with a version per section; the best follows the layout code', () => {
    const s = save((d) => { d.practiceBests['plains|swordsman|2-1-3-1-1'] = 6000; });
    const m = new PracticeSetupModel(() => s);
    for (let i = 0; i < 3; i++) m.action('down');
    expect(m.cursor).toBe('layout'); expect(m.value('layout')).toBe('Random'); expect(m.setup.layout).toBeNull();
    m.action('right'); expect(m.value('layout')).toBe('Classic'); expect(m.setup.layout).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    m.action('right'); expect(m.value('layout')).toBe('Custom 1-1-1-1-1');
    expect(m.selectable).toEqual(['stage', 'class', 'weapon', 'layout', 's2', 's3', 's4', 's6', 's7', 'start', 'back']);
    m.action('down'); m.action('right'); expect(m.value('s2')).toBe('v2 Riverbank');
    m.action('down'); m.action('down'); m.action('left'); expect(m.value('s4')).toBe('v3 Ridge path');
    expect(m.setup.layout).toEqual([1, 2, 1, 3, 1, 1, 1, 1]); expect(m.value('layout')).toBe('Custom 2-1-3-1-1'); expect(m.value('best')).toBe('0:50.00');
  });
  it('is off for stages without versions yet', () => {
    const m = new PracticeSetupModel(() => save((d) => { d.progress.levelsReached = ['plains', 'kingdom']; }));
    m.action('right'); expect(m.value('layout')).toBe('—'); expect(m.selectable).not.toContain('layout'); expect(m.setup.layout).toBeNull();
  });
  it('remembers a custom layout', () => {
    const m = new PracticeSetupModel(() => save(), { levelId: 'plains', cls: 'tank', weapon: 'war_maul', dragon: 'off', layout: [1, 3, 3, 3, 1, 3, 3, 1] });
    expect(m.value('layout')).toBe('Custom 3-3-3-3-3');
  });
});

describe('practice result (07 §7.4)', () => {
  it('ignores confirms for 0.5 s then returns Retry, Change setup or Title', () => {
    const m = new PracticeResultModel();
    expect(m.action('confirm')).toBeNull(); for (let i = 0; i < 40; i++) m.advance(1 / 60);
    expect(m.action('confirm')).toBe('retry'); m.action('down'); expect(m.action('confirm')).toBe('setup'); m.action('down'); m.action('down'); expect(m.action('confirm')).toBe('title');
  });
  it('shows NEW BEST or the old best', () => {
    expect(practiceBestLine({ ticks: 600, best: null, isNew: true })).toEqual({ text: '★ NEW BEST', highlight: true });
    expect(practiceBestLine({ ticks: 900, best: 600, isNew: false })).toEqual({ text: 'Best 0:05.00', highlight: false });
  });
});
