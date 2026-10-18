// Loading progress before the font/assets are available (07 §7.2).
import Phaser from 'phaser';
import { FRONT_UI as U } from '../../data/frontUi.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import { loadingPercent } from '../../ui/screens/front.ts';
import { loadAssets } from '../assets/loadAssets.ts';
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload(): void {
    const text = this.add.text(this.scale.width / 2, U.boot.textY, '', { font: U.boot.font, color: `#${UI_COLOR.text.toString(16)}` }).setOrigin(0.5, 0);
    const bar = this.add.graphics(), [x, y, w, h] = U.boot.bar;
    const progress = (value: number) => { text.setText(`Loading ${loadingPercent(value)}%`); bar.clear().fillStyle(UI_COLOR.panelBorder).fillRect(x, y, w, h).fillStyle(UI_COLOR.highlight).fillRect(x, y, Math.floor(w * value), h); };
    progress(0); this.load.on('progress', progress); loadAssets(this);
  }
  create(): void { this.scene.start('Title'); }
}
