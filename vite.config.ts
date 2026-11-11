import { defineConfig } from 'vitest/config';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { buildPrecache } from './src/pwa/precache.ts';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
const assetRoot = resolve('public/assets');
function filesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? filesIn(join(dir, entry.name))
    : [`assets/${relative(assetRoot, join(dir, entry.name)).replaceAll('\\', '/')}`]);
}
/** After a build: the list of every built file, for the service worker's offline copy (M12 Task 6). */
const precachePlugin = {
  name: 'rushblade-precache', apply: 'build' as const,
  closeBundle() {
    const dist = resolve('dist');
    const files = filesBelow(dist).map((p) => ({ path: relative(dist, p).replaceAll('\\', '/'), size: statSync(p).size, hash: createHash('sha1').update(readFileSync(p)).digest('hex') }));
    const list = buildPrecache(files);
    writeFileSync(join(dist, 'precache.json'), JSON.stringify(list) + '\n');
    // The browser only looks for a new service worker when sw.js itself changes, so each build stamps its version into it.
    const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
    if (!sw.includes('const BUILD = null;')) throw new Error('sw.js: the BUILD line to stamp is missing');
    writeFileSync(join(dist, 'sw.js'), sw.replace('const BUILD = null;', `const BUILD = ${JSON.stringify(list.version)};`));
  },
};
function buildLabel(): string {
  const day = new Date().toISOString().slice(0, 10);
  try { return `${day} · ${execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()}`; } catch { return day; }
}
function filesBelow(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesBelow(join(dir, e.name)) : [join(dir, e.name)]));
}
export default defineConfig({
  plugins: [precachePlugin],
  base: './',
  // Review C12: the title shows the build date (and the short commit when git is there).
  define: { __ASSET_FILES__: JSON.stringify(filesIn(assetRoot)), __BUILD_LABEL__: JSON.stringify(buildLabel()) },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
