import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPrecache } from './precache.ts';

describe('installable app (M12 Task 6)', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
  it('the manifest is full-screen landscape with the game colors, and its paths are relative so the GitHub Pages folder works', () => {
    expect(manifest).toMatchObject({ name: 'RUSHBLADE', display: 'fullscreen', orientation: 'landscape', theme_color: '#0d0b14', background_color: '#0d0b14', start_url: './', scope: './' });
    for (const icon of manifest.icons) { expect(icon.src.startsWith('/')).toBe(false); expect(existsSync(`public/${icon.src}`), icon.src).toBe(true); }
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(existsSync('public/app/apple-touch-icon.png')).toBe(true);
  });
  it('index.html links the manifest and the iPhone settings; the viewport is phone-ready', () => {
    const html = readFileSync('index.html', 'utf8');
    for (const part of ['rel="manifest"', 'apple-mobile-web-app-capable', 'apple-touch-icon', 'viewport-fit=cover', 'user-scalable=no']) expect(html, part).toContain(part);
  });
  it('the precache list holds every built file once, except the worker and itself, and its version follows the contents', () => {
    const a = buildPrecache([{ path: 'index.html', size: 10 }, { path: 'sw.js', size: 5 }, { path: 'assets/b.js', size: 7 }, { path: 'precache.json', size: 1 }, { path: 'assets/a.png', size: 3 }]);
    expect(a.files).toEqual(['./', './assets/a.png', './assets/b.js', './index.html']);
    const same = buildPrecache([{ path: 'assets/a.png', size: 3 }, { path: 'index.html', size: 10 }, { path: 'assets/b.js', size: 7 }]);
    expect(same).toEqual(a);
    expect(buildPrecache([{ path: 'index.html', size: 11 }, { path: 'assets/a.png', size: 3 }, { path: 'assets/b.js', size: 7 }]).version).not.toBe(a.version);
  });
});
