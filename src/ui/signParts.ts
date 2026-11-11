// Training Yard signs are written with the default keyboard keys in the level file ("S + Shift — slide").
// This turns each key name into that action's glyph, so the sign shows the player's own keys, controller
// buttons or touch buttons, like the Stage 1 hints do (07 §4.13). Pure: no Phaser.
import type { ActionId } from '../core/save/schema.ts';
import type { PromptPart } from './promptLine.ts';

/** The words the sign texts use for each action (the default keyboard layout, GAME_PLAN §11). */
const KEY_WORD: Record<string, ActionId> = {
  A: 'left', D: 'right', S: 'down', '↑': 'up', Space: 'jump', Shift: 'dash', J: 'attack1', Attack: 'attack1', K: 'attack2',
  U: 'ability1', I: 'ability2', Q: 'heal', E: 'interact',
};
// Whole words only, capitals only: "a wall", "3 s" and "Use" stay text.
const KEY = /(?<![A-Za-z])(Space|Shift|Attack|[ADSJKUIQE])(?![A-Za-z])|↑/g;

export function signParts(text: string): PromptPart[] {
  const parts: PromptPart[] = [];
  let from = 0;
  for (const m of text.matchAll(KEY)) {
    if (m.index > from) parts.push(text.slice(from, m.index));
    parts.push({ action: KEY_WORD[m[0]] });
    from = m.index + m[0].length;
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
}
