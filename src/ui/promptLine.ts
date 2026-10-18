// Inline prompt glyphs use measured widths, so text and hold rings share one position.
import type Phaser from 'phaser';
import type { ActionId } from '../core/save/schema.ts';
import { FONTS } from '../data/animKeys.ts';
import { UI_COLOR } from '../data/uiText.ts';
import { PROMPT } from '../data/prompts.ts';
import { PromptGlyph, actionPrompt, menuPrompt } from './hud/abilityHud.ts';
export type PromptPart = string | { action: ActionId } | { menu: 'confirm' | 'back' };
export function promptLine(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, parts: readonly PromptPart[], color: number = UI_COLOR.textDim, fixed = true) {
  const objects: { object: Phaser.GameObjects.BitmapText | Phaser.GameObjects.Container; width: number; glyph: boolean }[] = [];
  for (const part of parts) {
    if (typeof part === 'string') { const text = scene.add.bitmapText(0, y, FONTS.small, part).setTint(color).setOrigin(0); objects.push({ object: text, width: text.width, glyph: false }); }
    else { const glyph = new PromptGlyph(scene, 0, y, 'action' in part ? actionPrompt(part.action) : menuPrompt(part.menu)); glyph.container.setScrollFactor(fixed ? 0 : 1); objects.push({ object: glyph.container, width: glyph.width, glyph: true }); }
  }
  const width = objects.reduce((n, entry) => n + entry.width, 0); let left = x - width / 2;
  const glyphs: { x: number; y: number }[] = [];
  for (const entry of objects) { entry.object.x = left + (entry.glyph ? entry.width / 2 : 0); parent.add(entry.object); if (entry.glyph) glyphs.push({ x: entry.object.x, y: y + PROMPT.height / 2 }); left += entry.width; }
  return { width, glyphs };
}
