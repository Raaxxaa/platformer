import { describe, expect, it } from 'vitest';
import { validateSave } from './validate.ts';
import { NewerSaveVersionError } from './migrate.ts';
import { defaultSave } from '../../data/save.ts';
import type { KitSummary, PbRecord, RunRecord } from './schema.ts';

const date = '2026-10-17T12:34:56.000Z';
const kit = (): KitSummary => ({ displayName: 'Gladiator', weapons: [{ weaponId: 'scythe', grade: 'S', element: 'fire', perk: 'keen' }, null], abilities: [{ id: 'time_slow', level: 5 }, null] });
const pb = (): PbRecord => ({ ticks: 12000, splits: [1200, 4000, 8000, 12000], date, seedText: 'ABCD1234', kit: kit() });
const history = (result: RunRecord['result'] = 'death', ticks = 4000): RunRecord => ({ date, startClass: 'tank', startWeapon: 'war_maul', road: 'forest', seedText: 'ABCD1234', seeded: false, result,
  stageReached: 2, sectionReached: 8, runTicks: ticks, splits: [1200, null, null, null], cause: 'spikes', dragon: 'absent', kit: kit(),
  stats: { kills: 5, eliteKills: 1, goldEarned: 10, chestsOpened: 1, luckyBlocksBroken: 2, damageTaken: 50, flasksDrunk: 1 } });

describe('save shape validation (06 §15)', () => {
  it('resets both devices when a valid custom keyboard has an invalid gamepad binding', () => {
    const save = defaultSave(); save.settings.bindings.keyboard.jump = ['KeyZ', null]; save.settings.bindings.gamepad.jump = 2;
    expect(validateSave(save).settings.bindings).toEqual(defaultSave().settings.bindings);
  });
  it('resets both devices when a valid custom gamepad has an invalid keyboard binding', () => {
    const save = defaultSave(); save.settings.bindings.gamepad.jump = 10; save.settings.bindings.keyboard.jump = ['KeyJ', null];
    expect(validateSave(save).settings.bindings).toEqual(defaultSave().settings.bindings);
  });
  it('fills missing sections and nested fields without sharing defaults or mutating its input', () => {
    const raw = { settings: { volume: { master: 30 }, showTimer: false }, progress: { stage1Cleared: true }, stats: { deaths: 2 } }, before = structuredClone(raw);
    const save = validateSave(raw), defaults = defaultSave();
    expect(save.settings.volume).toEqual({ master: 30, music: 70, sfx: 80 }); expect(save.settings.showTimer).toBe(false);
    expect(save.progress).toEqual({ levelsReached: ['plains'], stage1Cleared: true, classesDiscovered: [] }); expect(save.stats.deaths).toBe(2);
    expect(save.training).toEqual([]); expect(save.history).toEqual([]); expect(raw).toEqual(before);
    save.settings.volume.sfx = 0; expect(defaults.settings.volume.sfx).toBe(80);
  });
  it('keeps a complete valid save byte-for-byte in shape, including full future gear and stages', () => {
    const save = defaultSave(); save.pbs['tank|forest'] = pb(); save.bestSegments['tank|forest'] = [1200, 2800, 4000, 4000];
    save.progress.levelsReached = ['plains', 'mountains', 'swamps', 'kingdom', 'castle']; save.practiceBests['castle|tank'] = 4000;
    save.history = [history()]; expect(validateSave(save)).toEqual(save);
  });
  it.each([null, [], 42, 'save'])('rejects invalid root %j instead of importing it as an empty save', (raw) => { expect(() => validateSave(raw)).toThrow(); });
  it('rejects a newer save with the dedicated error', () => { expect(() => validateSave({ v: 2 })).toThrow(NewerSaveVersionError); });
  it('deduplicates training1–17, discoveries and reached stage IDs, with Plains always available', () => {
    const save = validateSave({ training: [1, 1, 17, 0, 18, 2.5, '2'], progress: { levelsReached: ['castle', 'castle', 'home', 'bad'], classesDiscovered: ['iron_will', 'arcane_archer', 'iron_will', 'tank', 'bad'] } });
    expect(save.training).toEqual([1, 17]); expect(save.progress.levelsReached).toEqual(['plains', 'castle']); expect(save.progress.classesDiscovered).toEqual(['iron_will', 'arcane_archer']);
  });
  it('keeps every real blueprint, including unbuilt ones; drops nonblueprints and bad IDs individually', () => {
    const all = ['scythe', 'flail', 'hand_cannon', 'javelin', 'spell_tome', 'riposte', 'boulder_toss', 'turret', 'time_slow'];
    const save = validateSave({ unlocks: { blueprints: [...all, 'scythe', 'greatsword', 'vampire', 'made_up'] } });
    expect(save.unlocks.blueprints).toEqual(all);
  });
  it('keeps only the correct third starting weapon per class, and permits lastKit only when unlocked', () => {
    const raw = { unlocks: { startWeapons: { swordsman: ['spear', 'spear', 'katana'], tank: ['giant_axe', 'spear'], archer: ['throwing_knives'], wizard: ['wand'] } }, lastKit: { cls: 'tank', weapon: 'giant_axe' } };
    const save = validateSave(raw); expect(save.lastKit).toEqual(raw.lastKit);
    expect(save.unlocks.startWeapons).toEqual({ swordsman: ['spear'], tank: ['giant_axe'], archer: ['throwing_knives'], wizard: ['wand'] });
    expect(validateSave({ lastKit: raw.lastKit }).lastKit).toBeNull();
    expect(validateSave({ lastKit: { cls: 'tank', weapon: 'katana' } }).lastKit).toBeNull();
    expect(validateSave({ lastKit: { cls: 'tank', weapon: 'war_maul' } }).lastKit?.weapon).toBe('war_maul');
  });
  it('keeps an explicit empty starting-weapon list through export validation', () => {
    const save = defaultSave(); save.unlocks.startWeapons.tank = [];
    expect(validateSave(save)).toEqual(save);
  });
  it('validates seed and Road values without treating a level ID as a road', () => {
    expect(validateSave({ typedSeed: 'ABC012', lastRoad: 'forest' })).toMatchObject({ typedSeed: 'ABC012', lastRoad: 'forest' });
    for (const typedSeed of ['', 'abc', 'BAD-SEED', 'ABCDEFGHIJKLM', 123]) expect(validateSave({ typedSeed }).typedSeed).toBeNull();
    expect(validateSave({ lastRoad: 'swamps' }).lastRoad).toBe('mountain');
  });
  it('preserves valid settings and defaults bad values and broken bindings safely', () => {
    const save = validateSave({ settings: { volume: { master: 101, music: -10, sfx: 12.5 }, screenShake: false, damageNumbers: 'yes', promptStyle: 'playstation',
      bindings: { keyboard: { jump: [null, null], pause: ['KeyQ', null] }, gamepad: { attack1: 99, pause: 3 } } } });
    expect(save.settings.volume).toEqual({ master: 80, music: 70, sfx: 80 }); expect(save.settings.screenShake).toBe(false); expect(save.settings.damageNumbers).toBe(true);
    expect(save.settings.promptStyle).toBe('playstation'); expect(save.settings.bindings).toEqual(defaultSave().settings.bindings);
    const valid = defaultSave(); valid.settings.bindings.keyboard.jump = ['KeyZ', null]; expect(validateSave(valid).settings.bindings.keyboard.jump).toEqual(['KeyZ', null]);
  });
  it('rejects duplicate/reserved bindings while preserving valid swaps and immutable pause cells', () => {
    const defaults = defaultSave().settings.bindings;
    for (const change of [{ jump: ['KeyE', null] }, { jump: ['Tab', null] }, { pause: ['KeyZ', 'KeyP'] }, { jump: ['MadeUpKey', null] }]) {
      expect(validateSave({ settings: { bindings: { keyboard: change } } }).settings.bindings.keyboard).toEqual(defaults.keyboard);
    }
    const swapped = defaultSave(); swapped.settings.bindings.keyboard.jump = ['KeyE', null]; swapped.settings.bindings.keyboard.interact = ['Space', null];
    swapped.settings.bindings.gamepad.attack1 = 3; swapped.settings.bindings.gamepad.attack2 = 2;
    expect(validateSave(swapped).settings.bindings).toEqual(swapped.settings.bindings);
    for (const gamepad of [{ attack1: 12 }, { jump: 1 }, { left: 14 }, { pause: 0 }, { jump: null }]) {
      expect(validateSave({ settings: { bindings: { gamepad } } }).settings.bindings.gamepad).toEqual(defaults.gamepad);
    }
  });
  it('defaults nonfinite, fractional and negative counters one field at a time', () => {
    expect(validateSave({ stats: { runsStarted: 3, runsCompleted: -1, deaths: 1.5, dragonsKilled: Number.POSITIVE_INFINITY } }).stats).toEqual({ runsStarted: 3, runsCompleted: 0, deaths: 0, dragonsKilled: 0 });
  });
});

describe('entry-level save validation', () => {
  it('drops invalid PB entries individually, including non-Road keys, invalid ticks, splits, gear and dates', () => {
    const raw = { pbs: { 'tank|forest': pb(), 'tank|swamps': pb(), 'wizard|mountain': { ...pb(), ticks: -1 }, 'archer|forest': { ...pb(), splits: [1, 3, 2, 12000] }, 'swordsman|forest': { ...pb(), kit: { ...kit(), weapons: [{ weaponId: 'unknown', grade: 'S', element: null, perk: null }] } }, 'wizard|forest': { ...pb(), date: '2026-10-17' } } };
    expect(validateSave(raw).pbs).toEqual({ 'tank|forest': pb() });
  });
  it.each([
    { ticks: 1.5 }, { ticks: Number.NaN }, { ticks: Number.POSITIVE_INFINITY }, { ticks: 1000 }, { splits: [1200, 4000, 12000] },
    { splits: [1200, null, 8000, 12000] }, { splits: [1200, 4000, 8000, 12000, 13000] }, { seedText: 'bad seed' },
  ])('rejects invalid PB detail %j', (change) => { expect(validateSave({ pbs: { 'tank|forest': { ...pb(), ...change } } }).pbs).toEqual({}); });
  it('rejects impossible calendar dates and invalid future gear details, not the neighboring PB', () => {
    for (const date of ['2026-02-30T12:34:56.000Z', '2026-10-17T25:34:56.000Z']) {
      expect(validateSave({ pbs: { 'tank|forest': { ...pb(), date }, 'wizard|forest': pb() } }).pbs).toEqual({ 'wizard|forest': pb() });
    }
    for (const item of [{ id: 'time_slow', level: 6 }, { id: 'time_slow', level: 1.5 }, { id: 'constructor', level: 1 }]) {
      expect(validateSave({ pbs: { 'tank|forest': { ...pb(), kit: { ...kit(), abilities: [item] } } } }).pbs).toEqual({});
    }
  });
  it('drops a bad best-segment or practice entry without losing valid neighboring entries', () => {
    const save = validateSave({ bestSegments: { 'tank|forest': [1, null, 3, null], 'wizard|mountain': [1, -1, null, null], 'tank|swamps': [1, 2, 3, 4] }, practiceBests: { 'castle|wizard': 120, 'plains|tank': 0, 'home|tank': 50, 'swamps|archer': 1.5, 'plains|bad': 100 } });
    expect(save.bestSegments).toEqual({ 'tank|forest': [1, null, 3, null] }); expect(save.practiceBests).toEqual({ 'castle|wizard': 120, 'plains|tank': 0 });
  });
  it('drops bad history entries individually and keeps deaths plus only long enough restarts/quits', () => {
    const shortDeath = history('death', 10); shortDeath.splits = [null, null, null, null];
    const save = validateSave({ history: [history(), { ...history(), startClass: 'made_up' }, history('restart', 3599), history('quit', 3599), history('restart', 3600), history('quit', 3600), shortDeath] });
    expect(save.history).toEqual([history(), history('restart', 3600), history('quit', 3600), shortDeath]);
  });
  it('keeps max20 newest first by full ISO date without reading a clock', () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ ...history(), date: `2026-10-${String(i + 1).padStart(2, '0')}T12:34:56.000Z` }));
    const save = validateSave({ history: rows }); expect(save.history).toHaveLength(20);
    expect(save.history[0].date).toBe('2026-10-25T12:34:56.000Z'); expect(save.history.at(-1)?.date).toBe('2026-10-06T12:34:56.000Z');
  });
  it('drops malformed history counters, stage/section, splits and incomplete completion records individually', () => {
    const changes = [{ stats: { ...history().stats, kills: -1 } }, { stageReached: 5 }, { sectionReached: 9 }, { splits: [1200, null, 2000, null] }, { result: 'complete' }, { road: 'swamps' }];
    expect(validateSave({ history: [history(), ...changes.map((change) => ({ ...history(), ...change }))] }).history).toEqual([history()]);
    const complete = { ...history('complete', 12000), stageReached: 4, splits: [1200, 4000, 8000, 12000], cause: null };
    expect(validateSave({ history: [complete] }).history).toEqual([complete]);
  });
  it('returns detached values so later source mutations cannot damage validated records', () => {
    const raw = { pbs: { 'tank|forest': pb() }, history: [history()] }, saved = validateSave(raw);
    raw.pbs['tank|forest'].splits[0] = 99; raw.history[0].kit.abilities[0]!.level = 1;
    expect(saved.pbs['tank|forest']?.splits[0]).toBe(1200); expect(saved.history[0].kit.abilities[0]?.level).toBe(5);
  });
});
