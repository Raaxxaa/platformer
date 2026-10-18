// The start screen (M4.1 Task 2): `Play` (Stage 1, with the class pick) or `Training Yard` (06 §12.4).
// `?start=…` URLs skip it. Up/down picks, confirm starts (07 §7.1 menu keys).
import Phaser from 'phaser';
import { FONTS } from '../../data/animKeys.ts';
import { TITLE_UI as T } from '../../data/stageUi.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import { box, hasFrame, SKIN } from '../../ui/skin.ts';
import { loadAssets } from '../assets/loadAssets.ts';
import { debugEnabled } from '../debug.ts';
import { gameSession } from '../session.ts';

export const TITLE_CHOICES = [{ label: 'Play', level: 'home' }, { label: 'Training Yard', level: 'training_yard' }] as const;

export class TitleScene extends Phaser.Scene {
  private cursor = 0;
  private items: Phaser.GameObjects.GameObject[] = [];

  constructor() { super('Title'); }

  preload(): void { loadAssets(this); }

  create(): void {
    this.cursor = 0;
    const { width } = this.scale;
    for (let i = 0; i < 3; i++) this.add.image(0, 0, `bg_plains_${i}`).setOrigin(0).setScrollFactor(0);
    this.add.bitmapText(width / 2, T.titleY, FONTS.large, 'RUSHBLADE').setOrigin(0.5).setScale(2);
    this.add.bitmapText(width / 2, T.hintY, FONTS.small, '↑↓ Choose   [ENT] Start').setOrigin(0.5).setTint(UI_COLOR.textDim);
    this.draw();
    const keys = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (['ArrowUp', 'KeyW'].includes(e.code)) { this.cursor = Math.max(0, this.cursor - 1); this.draw(); }
      else if (['ArrowDown', 'KeyS'].includes(e.code)) { this.cursor = Math.min(TITLE_CHOICES.length - 1, this.cursor + 1); this.draw(); }
      else if (['Enter', 'Space', 'KeyE'].includes(e.code)) this.choose(this.cursor);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', keys);
    this.events.once('shutdown', () => window.removeEventListener('keydown', keys));
    if (debugEnabled()) {
      window.__game = { ready: true, title: true, titleCursor: () => this.cursor, titleChoose: (i: number) => this.choose(i) } as never;
    }
  }

  private draw(): void {
    for (const o of this.items) o.destroy();
    this.items = [];
    const { width } = this.scale;
    TITLE_CHOICES.forEach((c, i) => {
      const sel = i === this.cursor, x = (width - T.buttonW) / 2, y = T.buttonsY + i * T.buttonStep;
      this.items.push(...box(this, sel ? SKIN.buttonSel : SKIN.button, x, y, T.buttonW, T.buttonH, SKIN.corner.button,
        { edge: sel ? UI_COLOR.highlight : UI_COLOR.panelBorder }));
      this.items.push(this.add.bitmapText(width / 2, y + T.buttonH / 2, FONTS.small, c.label).setOrigin(0.5).setTint(sel ? UI_COLOR.highlight : UI_COLOR.text));
      if (sel) {
        this.items.push(hasFrame(this, SKIN.cursor)
          ? this.add.image(x - T.cursorDx, y + T.buttonH / 2, 'ui', SKIN.cursor).setOrigin(0, 0.5)
          : this.add.bitmapText(x - T.cursorDx, y + T.buttonH / 2, FONTS.small, '▸').setOrigin(0, 0.5).setTint(UI_COLOR.highlight));
      }
    });
  }

  /** Starts the chosen level in a fresh Stage scene. */
  choose(i: number): void {
    const level = TITLE_CHOICES[i].level;
    if (level === 'training_yard') gameSession.trainingReturn = 'title';
    if (level === 'home') this.scene.start('Village', { level });
    else this.scene.start('Stage', { level });
    this.scene.stop();
  }
}
