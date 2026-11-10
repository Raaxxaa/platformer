import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ActionId } from '../core/save/schema.ts';
import { actionLabel, noteInputDevice } from './inputSettings.ts';

// The bitmap fonts only hold some characters; anything else is drawn as an empty gap (review 2026-11).
const fontChars = (file: string): Set<number> =>
  new Set([...readFileSync(`public/assets/fonts/${file}.xml`, 'utf8').matchAll(/char id="(\d+)"/g)].map((m) => Number(m[1])));
const undrawable = (text: string, chars: Set<number>): string[] => [...new Set([...text].filter((c) => !chars.has(c.codePointAt(0)!)))];
const ACTIONS: ActionId[] = ['left', 'right', 'up', 'down', 'jump', 'dash', 'attack1', 'attack2', 'ability1', 'ability2', 'heal', 'interact', 'restart', 'pause'];

describe('every label the game draws exists in its font', () => {
  it('the touch names of all actions can be drawn by the prompt font', () => {
    const chars = fontChars('rb_small_plain');
    noteInputDevice('touch');
    try {
      for (const action of ACTIONS) expect(undrawable(actionLabel(action), chars), `${action}: "${actionLabel(action)}"`).toEqual([]);
    } finally { noteInputDevice('keyboard'); }
  });
  it('the menu screens use no character the small font lacks', () => {
    const chars = fontChars('rb_small');
    for (const file of readdirSync('src/ui/screens').filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
      const code = readFileSync(`src/ui/screens/${file}`, 'utf8').split('\n').filter((line) => !/^\s*(\/\/|\/?\*)/.test(line)).map((line) => line.replace(/\s\/\/.*$/, '')).join('\n');
      const texts = [...code.matchAll(/'([^'\n]*)'|`([^`\n]*)`/g)].map((m) => m[1] ?? m[2] ?? '');
      for (const text of texts) expect(undrawable(text.replace(/\$\{[^}]*\}/g, ''), chars), `${file}: "${text}"`).toEqual([]);
    }
  });
});
