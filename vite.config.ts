import { defineConfig } from 'vitest/config';
import { readdirSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
const assetRoot = resolve('public/assets');
function filesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? filesIn(join(dir, entry.name))
    : [`assets/${relative(assetRoot, join(dir, entry.name)).replaceAll('\\', '/')}`]);
}
export default defineConfig({
  base: './',
  define: { __ASSET_FILES__: JSON.stringify(filesIn(assetRoot)) },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
