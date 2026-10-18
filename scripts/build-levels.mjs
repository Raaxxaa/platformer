// Portable launcher and deterministic logical-id → public filename mapping. The protected builder is unchanged.
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
const result = spawnSync(process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3'), ['tools/build_levels.py', ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const output = resolve('public/levels');
for (const id of ['home', 'crossroads', 'border', 'rebel_camp']) {
  const source = resolve(output, `${id}.json`), target = resolve(output, `village_${id}.json`);
  if (!source.startsWith(`${output}\\`) && !source.startsWith(`${output}/`)) throw new Error('Level path outside output folder');
  if (existsSync(source)) renameSync(source, target);
}
