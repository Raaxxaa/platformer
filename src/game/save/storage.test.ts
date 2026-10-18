import { describe, expect, it } from 'vitest';
import { SaveStore, saveDate } from './storage.ts';

const storage = () => { const data = new Map<string, string>(); return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } }; };
describe('Home save scaffold', () => {
  it('backs up the exact previous main value before every write', () => {
    const s = storage(), store = new SaveStore(s); store.update((save) => { save.lastRoad = 'forest'; });
    const first = s.getItem('rushblade.save'); store.update((save) => { save.typedSeed = 'ABC'; });
    expect(s.getItem('rushblade.save.bak')).toBe(first); expect(JSON.parse(s.getItem('rushblade.save')!).typedSeed).toBe('ABC');
  });
  it('recovers a malformed primary from its valid backup', () => {
    const s = storage(); s.setItem('rushblade.save', '{bad'); s.setItem('rushblade.save.bak', JSON.stringify({ v: 1, lastRoad: 'forest', training: [2, 8] }));
    const store = new SaveStore(s); expect(store.data.lastRoad).toBe('forest'); expect(store.data.training).toEqual([2, 8]);
    store.update((save) => { save.typedSeed = 'RECOVERED'; }); expect(JSON.parse(s.getItem('rushblade.save')!).typedSeed).toBe('RECOVERED');
  });
  it('preserves the only good backup if the repaired main write fails', () => {
    const s = storage(), backup = JSON.stringify({ v: 1, lastRoad: 'forest' }); s.setItem('rushblade.save', '{bad'); s.setItem('rushblade.save.bak', backup);
    const store = new SaveStore(s), write = s.setItem; s.setItem = (key, value) => { if (key === 'rushblade.save') throw Error('quota'); write(key, value); };
    store.update((save) => { save.typedSeed = 'NEW'; }); expect(s.getItem('rushblade.save.bak')).toBe(backup);
    expect(new SaveStore(s).data.lastRoad).toBe('forest'); expect(store.takeWarning()).toBe("Can't save — progress won't be kept");
  });
  it('keeps corrupt primary text and starts fresh when both copies fail', () => {
    const s = storage(); s.setItem('rushblade.save', '{broken-main'); s.setItem('rushblade.save.bak', '{broken-backup');
    const store = new SaveStore(s); expect(store.data.lastKit).toBeNull(); expect(s.getItem('rushblade.save.corrupt')).toBe('{broken-main');
    store.update((save) => { save.lastRoad = 'forest'; }); expect(JSON.parse(s.getItem('rushblade.save')!).lastRoad).toBe('forest');
  });
  it('exports and validates an import without changes, then replaces the whole save with backup', () => {
    const s = storage(), first = new SaveStore(s); first.update((save) => { save.lastRoad = 'forest'; save.typedSeed = 'OLD'; });
    const before = s.getItem('rushblade.save'), source = new SaveStore(storage()); source.update((save) => { save.typedSeed = 'NEW'; save.training = [3]; });
    const imported = first.previewImport(source.exportCode()); expect(first.data.typedSeed).toBe('OLD'); expect(s.getItem('rushblade.save')).toBe(before);
    expect(first.replace(imported)).toBe(true); expect(first.data).toEqual(source.data); expect(first.data.lastRoad).toBe('mountain'); expect(s.getItem('rushblade.save.bak')).toBe(before);
  });
  it('invalid imports and future-version replacement leave the save untouched', () => {
    const s = storage(), store = new SaveStore(s); store.update((save) => { save.typedSeed = 'OLD'; });
    const before = s.getItem('rushblade.save'); expect(() => store.previewImport('RB1:broken:00000000')).toThrow(); expect(s.getItem('rushblade.save')).toBe(before);
    s.setItem('rushblade.save', '{"v":2,"future":true}'); const future = new SaveStore(s), source = new SaveStore(storage());
    expect(future.replace(source.data)).toBe(false); expect(s.getItem('rushblade.save')).toBe('{"v":2,"future":true}');
  });
  it('stores full ISO timestamps; the Records screen formats the short date', () => {
    expect(saveDate()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
  it('persists chosen kit, seed, road and Training progress across reload', () => {
    const s = storage(), first = new SaveStore(s);
    first.update((save) => { save.lastKit = { cls: 'tank', weapon: 'war_maul' }; save.typedSeed = 'ABC'; save.lastRoad = 'forest'; save.training = [1, 3]; });
    expect(new SaveStore(s).data).toMatchObject({ lastKit: { cls: 'tank', weapon: 'war_maul' }, typedSeed: 'ABC', lastRoad: 'forest', training: [1, 3] });
  });
  it('never overwrites a newer-version save', () => {
    const s = storage(); s.setItem('rushblade.save', '{"v":2,"future":true}');
    const store = new SaveStore(s); store.update((save) => { save.typedSeed = 'ABC'; });
    expect(s.getItem('rushblade.save')).toBe('{"v":2,"future":true}');
    expect(store.readOnly).toBe(true);
  });
  it('storage failure keeps working in memory with a single warning', () => {
    const store = new SaveStore({ getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('full'); } });
    store.update((save) => { save.training = [1]; });
    expect(store.data.training).toEqual([1]); expect(store.warning).toBe("Can't save — progress won't be kept");
    expect(store.takeWarning()).toBe("Can't save — progress won't be kept");
    expect(store.takeWarning()).toBeNull();
  });
});
