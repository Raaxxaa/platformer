// 07 §6.11: a view of the core's three offered upgrades. Gameplay rules stay in the core.
import type Phaser from 'phaser';
import { STAT_UPGRADES, type StatUpgradeId } from '../../data/economy.ts';
import { STAT_PICK_UI as U } from '../../data/statUi.ts';
import { FONTS } from '../../data/animKeys.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import { icon } from '../skin.ts';
import type { StatPickModel } from './statPickModel.ts';
import { menuPrompt } from '../hud/abilityHud.ts';
import { promptLine } from '../promptLine.ts';

export class StatPickView {
  private readonly scene: Phaser.Scene;
  private readonly c: Phaser.GameObjects.Container;
  private readonly dim: Phaser.GameObjects.Graphics;
  private key = '';
  private readonly select: (index: number) => void;
  private readonly confirm: () => void;
  constructor(scene: Phaser.Scene, select: (index: number) => void, confirm: () => void) {
    this.scene = scene; this.select = select; this.confirm = confirm;
    this.dim = scene.add.graphics().setScrollFactor(0).setDepth(U.dimDepth);
    this.dim.fillStyle(UI_COLOR.ink, U.dimAlpha).fillRect(0, 0, scene.scale.width, scene.scale.height);
    this.c = scene.add.container(0, 0).setScrollFactor(0).setDepth(U.depth);
  }
  draw(model: StatPickModel, offer: readonly StatUpgradeId[], stacks: Partial<Record<StatUpgradeId, number>>): void {
    const key = JSON.stringify([model.cursor, offer, stacks, menuPrompt('confirm')]); if (key === this.key) return;
    this.key = key; this.c.removeAll(true);
    const text = (x: number, y: number, s: string, color: number, large = false) => {
      const t = this.scene.add.bitmapText(x, y, large ? FONTS.large : FONTS.small, s).setTint(color).setOrigin(0.5, 0);
      this.c.add(t); return t;
    };
    text(this.scene.scale.width / 2, U.titleY, U.title, UI_COLOR.text, true);
    offer.forEach((id, i) => {
      const def = STAT_UPGRADES.find((s) => s.id === id)!, x = U.cardXs[i];
      const selected = model.cursor === i, y = U.cardY - (selected ? U.selectedLift : 0);
      const g = this.scene.add.graphics();
      g.fillStyle(UI_COLOR.panel, 1).fillRect(x, y, U.cardW, U.cardH);
      g.lineStyle(U.border, selected ? UI_COLOR.highlight : UI_COLOR.panelBorder, 1)
        .strokeRect(x + U.border / 2, y + U.border / 2, U.cardW - U.border, U.cardH - U.border);
      this.c.add(g);
      this.c.add(icon(this.scene, `icon_stat_${id}`, x + (U.cardW - U.iconSize) / 2, y + U.iconY, [U.iconSize, U.iconSize]));
      text(x + U.cardW / 2, y + U.nameY, def.name, UI_COLOR.text);
      text(x + U.cardW / 2, y + U.textY, def.text, UI_COLOR.textDim).setMaxWidth(U.textW).setCenterAlign();
      const n = stacks[id] ?? 0;
      if (n > 0) text(x + U.cardW / 2, y + U.stackY, `Have ${n}/${def.maxStacks}`, UI_COLOR.textDim);
      const area = this.scene.add.rectangle(x, y, U.cardW, U.cardH).setOrigin(0).setScrollFactor(0).setInteractive({ useHandCursor: true });
      area.on('pointerover', () => this.select(i));
      area.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.button !== 0) return;
        this.select(i); this.confirm();
      });
      this.c.add(area);
    });
    promptLine(this.scene, this.c, this.scene.scale.width / 2, U.hintY, ['←→ Choose   ', { menu: 'confirm' }, ' Pick']);
  }
  destroy(): void { this.c.destroy(); this.dim.destroy(); }
}
