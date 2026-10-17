// Class pick panel (07 §6.7): 220 × 176 at (210, 72), fixed to the screen. Draws a ClassPickModel.
import Phaser from 'phaser';
import { STARTING_KITS } from '../../data/classes.ts';
import { CLASS_NAME } from '../../data/classes.ts';
import { ABILITIES } from '../../data/abilities.ts';
import { FONTS } from '../../data/animKeys.ts';
import { DEPTH } from '../../data/art.ts';
import { ABILITY_BLURB, CLASS_COLOR, CLASS_STYLE, UI_COLOR, WEAPON_BLURB, WEAPON_NAME } from '../../data/uiText.ts';
import type { ClassPickModel, Kit } from './classPickModel.ts';
import { box, SKIN } from '../skin.ts';

const P = { x: 210, y: 72, w: 220, h: 176, pad: 8, rowY: 112, rowGap: 14 } as const;

export class ClassPickView {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly texts: Phaser.GameObjects.BitmapText[] = [];
  private readonly icon: Phaser.GameObjects.Image;
  private readonly scene: Phaser.Scene;
  private panel: Phaser.GameObjects.GameObject[] = [];
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud + 10);
    this.icon = scene.add.image(P.x + P.w / 2, P.y + 16, 'ui', 'icon_class_swordsman').setScrollFactor(0).setDepth(DEPTH.hud + 11);
  }

  private text(x: number, y: number, s: string, color: number, large = false, center = true): void {
    const t = this.scene.add.bitmapText(x, y, large ? FONTS.large : FONTS.small, s).setScrollFactor(0).setDepth(DEPTH.hud + 11).setTint(color);
    if (center) t.setOrigin(0.5, 0);
    this.texts.push(t);
  }

  draw(m: ClassPickModel, equipped: Kit | null): void {
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
    });
    this.text(cx, P.y + 162, m.classes.length > 1 ? '<> Class   ↑↓ Weapon   [Space] Equip' : '↑↓ Weapon   [Space] Equip   [Esc] Close', UI_COLOR.textDim);
  }

  destroy(): void {
    this.g.destroy();
    this.icon.destroy();
    for (const t of this.texts) t.destroy();
    for (const o of this.panel) o.destroy();
  }
}
