import { defineConfig } from 'vitest/config';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { buildPrecache } from './src/pwa/precache.ts';
import { resolve, relative, join } from 'node:path';
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
    const files = filesBelow(dist).map((p) => ({ path: relative(dist, p).replaceAll('\\', '/'), size: statSync(p).size }));
    const list = buildPrecache(files);
    writeFileSync(join(dist, 'precache.json'), JSON.stringify(list) + '\n');
    // The browser only looks for a new service worker when sw.js itself changes, so each build stamps its version into it.
    writeFileSync(join(dist, 'sw.js'), `${readFileSync(join(dist, 'sw.js'), 'utf8')}\n// build ${list.version}\n`);
  },
};
function filesBelow(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesBelow(join(dir, e.name)) : [join(dir, e.name)]));
}
export default defineConfig({
  plugins: [precachePlugin],
  base: './',
  define: { __ASSET_FILES__: JSON.stringify(filesIn(assetRoot)) },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
