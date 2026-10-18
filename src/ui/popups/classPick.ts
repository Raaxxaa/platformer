// Class pick panel (07 §6.7): 220 × 176 at (210, 72), fixed to the screen. Draws a ClassPickModel.
import type Phaser from 'phaser';
import { STARTING_KITS } from '../../data/classes.ts';
import { CLASS_NAME } from '../../data/classes.ts';
import { ABILITIES } from '../../data/abilities.ts';
import { FONTS } from '../../data/animKeys.ts';
import { DEPTH } from '../../data/art.ts';
import { ABILITY_BLURB, CLASS_COLOR, CLASS_STYLE, UI_COLOR, WEAPON_BLURB, WEAPON_NAME } from '../../data/uiText.ts';
import type { ClassPickModel, Kit } from './classPickModel.ts';
import { box, SKIN } from '../skin.ts';
import { CLASS_PICK_UI as P } from '../../data/classPickUi.ts';
import { promptLine } from '../promptLine.ts';
import { menuGlyphs } from '../inputSettings.ts';

export class ClassPickView {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly texts: Phaser.GameObjects.BitmapText[] = [];
  private readonly icon: Phaser.GameObjects.Image;
  private readonly scene: Phaser.Scene;
  private panel: Phaser.GameObjects.GameObject[] = [];
  private targets: Phaser.GameObjects.Rectangle[] = [];
  private readonly hint: Phaser.GameObjects.Container;
  private readonly confirm: () => void;
  private key = '';
  constructor(scene: Phaser.Scene, confirm: () => void = () => {}) {
    this.scene = scene;
    this.confirm = confirm;
    this.hint = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + P.depthOffset + 1);
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud + 10);
    this.icon = scene.add.image(P.x + P.w / 2, P.y + 16, 'ui', 'icon_class_swordsman').setScrollFactor(0).setDepth(DEPTH.hud + 11);
  }

  private text(x: number, y: number, s: string, color: number, large = false, center = true): void {
    const t = this.scene.add.bitmapText(x, y, large ? FONTS.large : FONTS.small, s).setScrollFactor(0).setDepth(DEPTH.hud + 11).setTint(color);
    if (center) t.setOrigin(0.5, 0);
    this.texts.push(t);
  }

  draw(m: ClassPickModel, equipped: Kit | null): void {
    const key = JSON.stringify([m.cls, m.wi, equipped, menuGlyphs()]); if (key === this.key) return; this.key = key;
    for (const target of this.targets) target.destroy(); this.targets = []; this.hint.removeAll(true);
    for (const t of this.texts) t.destroy();
    this.texts.length = 0;
    this.g.clear();
    const cx = P.x + P.w / 2, cls = m.cls, col = CLASS_COLOR[cls];
    // The popup skin (07 §3.4), edged in the class color.
    for (const o of this.panel) o.destroy();
    this.panel = box(this.scene, SKIN.panel, P.x, P.y, P.w, P.h, SKIN.corner.panel, { edge: col }).map((o) => o.setDepth(DEPTH.hud + 10));
    this.icon.setFrame(`icon_class_${cls}`);
    const name = m.classes.length > 1 ? `< ${CLASS_NAME[cls]} >` : CLASS_NAME[cls];
    this.text(cx, P.y + 24, name, col, true);
    this.text(cx, P.y + 48, CLASS_STYLE[cls], UI_COLOR.textDim);
    const ab = STARTING_KITS[cls].ability;
    this.text(cx, P.y + 64, `Ability: ${ABILITIES[ab]?.name ?? ab}`, UI_COLOR.text);
    this.text(cx, P.y + 76, ABILITY_BLURB[ab], UI_COLOR.textDim);
    this.text(P.x + P.pad, P.y + 96, 'Weapon', UI_COLOR.textDim, false, false);
    m.weapons.forEach((wid, i) => {
      const y = P.y + P.rowY + i * P.rowGap * 2;
      const mark = equipped && equipped.cls === cls && equipped.weapon === wid ? ' (equipped)' : '';
      this.text(P.x + P.pad, y, `${i === m.wi ? '>' : ' '} ${WEAPON_NAME(wid)}${mark}`, i === m.wi ? UI_COLOR.highlight : UI_COLOR.text, false, false);
      this.text(P.x + P.pad + 10, y + 11, WEAPON_BLURB[wid], UI_COLOR.textDim, false, false);
      const target = this.scene.add.rectangle(P.x + P.pad, y, P.w - P.pad * 2, P.rowGap * 2).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.hud + P.depthOffset + 1).setInteractive({ useHandCursor: true });
      const select = () => { if (m.wi !== i) { m.wi = i; this.draw(m, equipped); } };
      target.on('pointerover', select); target.on('pointerdown', (pointer: Phaser.Input.Pointer) => { if (pointer.button === 0) { select(); this.confirm(); } }); this.targets.push(target);
    });
    promptLine(this.scene, this.hint, cx, P.y + P.hintY, ['↑↓ Weapon   ', { menu: 'confirm' }, ' Equip   ', { menu: 'back' }, ' Back']);
  }

  destroy(): void {
    this.g.destroy();
    this.icon.destroy();
    this.hint.destroy(); for (const target of this.targets) target.destroy();
    for (const t of this.texts) t.destroy();
    for (const o of this.panel) o.destroy();
  }
}
