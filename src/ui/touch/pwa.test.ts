import { describe, expect, it } from 'vitest';
import { isNativeApp, shouldRegisterSw } from './pwa.ts';

const nav = { serviceWorker: {} };
describe('service worker registration (M12 Task 6, M16 Task 1)', () => {
  it('registers on the website, not inside the iPhone/Mac app', () => {
    expect(shouldRegisterSw({ navigator: nav, location: { search: '' } })).toBe(true);
    expect(shouldRegisterSw({ Capacitor: {}, navigator: nav, location: { search: '' } })).toBe(false);
    expect(isNativeApp({ Capacitor: {} })).toBe(true); expect(isNativeApp({})).toBe(false);
    // The Capacitor library's web shim in a plain browser is not the app.
    expect(isNativeApp({ Capacitor: { isNativePlatform: () => false } })).toBe(false); expect(isNativeApp({ Capacitor: { isNativePlatform: () => true } })).toBe(true);
  });
  it('skips debug pages unless ?sw=1, and browsers without service workers', () => {
    expect(shouldRegisterSw({ navigator: nav, location: { search: '?debug=1' } })).toBe(false);
    expect(shouldRegisterSw({ navigator: nav, location: { search: '?debug=1&sw=1' } })).toBe(true);
    expect(shouldRegisterSw({ navigator: {}, location: { search: '' } })).toBe(false);
  });
});
