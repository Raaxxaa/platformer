import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadLevel } from './loadLevel.ts';
import { reachLint } from './reachLint.ts';

const read = (id: string) => loadLevel(JSON.parse(readFileSync(new URL(`../../../public/levels/${id}.json`, import.meta.url), 'utf8')));

describe('reachLint: every one-way platform is reachable with one jump (06 §8.5)', () => {
  it.each(['plains', 'mountains', 'swamps'])('%s', (id) => {
    expect(reachLint(read(id), true)).toEqual([]);
  });
});
