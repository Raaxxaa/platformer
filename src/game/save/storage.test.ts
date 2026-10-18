import { describe, expect, it } from 'vitest';
import { SaveStore } from './storage.ts';

const storage = () => { const data = new Map<string, string>(); return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } }; };
describe('Home save scaffold', () => {
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
