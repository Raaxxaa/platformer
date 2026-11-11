import { afterEach, describe, expect, it, vi } from 'vitest';
const store = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({ Preferences: {
  get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
  set: async ({ key, value }: { key: string; value: string }) => { store.set(key, value); },
} }));
import { afterSaveWrite, restoreNativeSave } from './persist.ts';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
describe('keeping the save (review C3)', () => {
  afterEach(() => { delete (globalThis as { Capacitor?: unknown }).Capacitor; store.clear(); });
  it('in the app, writes are mirrored and an empty localStorage is refilled at launch', async () => {
    (globalThis as { Capacitor?: unknown }).Capacitor = {};
    afterSaveWrite('rushblade.save', '{"v":1}'); await Promise.resolve();
    const s = mem(); expect(await restoreNativeSave('rushblade.save', s)).toBe(true); expect(s.getItem('rushblade.save')).toBe('{"v":1}');
    s.setItem('rushblade.save', '{"v":1,"x":2}'); expect(await restoreNativeSave('rushblade.save', s)).toBe(false);
  });
  it('in a browser nothing is mirrored or restored', async () => {
    afterSaveWrite('rushblade.save', 'x'); await Promise.resolve();
    expect(store.size).toBe(0); expect(await restoreNativeSave('rushblade.save', mem())).toBe(false);
  });
});
