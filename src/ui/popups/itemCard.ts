// The item card (07 §6.1): drawn over the current interact target while it is a weapon or ability on the ground.
// Rebuilt when its text changes; follows the item on screen (round(world − camera scroll)).
import Phaser from 'phaser';
import type { GroundItem } from '../../core/abilities/items.ts';
import { FONTS, itemIcon } from '../../data/animKeys.ts';
import { DEPTH } from '../../data/art.ts';
import { CARD as C } from '../../data/stageUi.ts';
import { CLASS_COLOR, GRADE_COLOR, HYBRID_COLOR, UI_COLOR } from '../../data/uiText.ts';
import type { HybridId } from '../../core/abilities/types.ts';
import type { ClassColorKeyLike } from '../model/hudModel.ts';
import type { ItemCardView } from '../model/itemCard.ts';
import { box, SKIN } from '../skin.ts';

const colorOf = (k: ClassColorKeyLike): number =>
  k === 'none' ? UI_COLOR.textDim : k === 'neutral' ? UI_COLOR.textDim : (CLASS_COLOR as Record<string, number>)[k] ?? HYBRID_COLOR[k as HybridId];
const TONE = { good: UI_COLOR.good, bad: UI_COLOR.bad, dim: UI_COLOR.textDim } as const;

export class ItemCardPopup {
  private scene: Phaser.Scene;
  private c: Phaser.GameObjects.Container;
  private key = '';
  private h = 0;
  private w = 0;
  private shownAt = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.c = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.hud - 2).setVisible(false);
  }

  private text(x: number, y: number, s: string, color: number, font: string = FONTS.small) {
    const t = this.scene.add.bitmapText(x, y, font, s).setTint(color);
    this.c.add(t);
    return t;
  }

  private build(v: ItemCardView): void {
    this.c.removeAll(true);
    const border = v.grade ? GRADE_COLOR[v.grade] : colorOf(v.cls ?? 'none');
    this.c.add(this.scene.add.image(C.icon[0], C.icon[1], 'ui', itemIcon(v.kind, v.id)).setOrigin(0));
    const name = this.text(C.name[0], C.name[1], v.name, border);
    const badge = this.text(0, C.name[1], v.badge, border).setOrigin(1, 0);
    const row2 = this.text(C.row2[0], C.row2[1], v.row2, UI_COLOR.textDim);
    let y: number = C.row3[1];
    let widest = Math.max(C.name[0] + name.width + 8 + badge.width, C.row2[0] + row2.width);
    if (v.dmg) {
      const d = this.text(C.row3[0], y, `DMG ${v.dmg.value}`, UI_COLOR.text);
      let x = C.row3[0] + d.width + 4;
      for (const cls of v.tags) {
        this.c.add(this.scene.add.image(x, y + 1, 'ui', `class_${cls}`).setOrigin(0).setTint(v.litTags.includes(cls) ? CLASS_COLOR[cls] : UI_COLOR.panelBorder));
        x += C.classIcon;
      }
      if (v.dmg.matched) x += this.text(x + 2, y, 'MATCH', UI_COLOR.good).width + 2;
      widest = Math.max(widest, x);
      y += C.rowStep;
    } else {
      const b = this.text(C.row3[0], y, v.blurb, UI_COLOR.textDim).setMaxWidth(C.maxW - 2 * C.pad - 8);
      y += C.rowStep * Math.min(C.blurbLines, Math.max(1, Math.round(b.height / C.rowStep)));
      widest = Math.max(widest, C.row3[0] + b.width);
    }
    for (const o of v.options) {
      let x: number = C.row3[0];
      const arrow = o.after ? o.text.lastIndexOf('→') : -1;
      if (arrow >= 0 && o.after) {
        if (arrow > 0) x += this.text(x, y, o.text.slice(0, arrow), UI_COLOR.text).width;
        x += this.text(x, y, `→ ${o.after.name}`, colorOf(o.after.color)).width;
        if (o.after.bond) x += this.text(x, y, ` + ${o.after.bond}`, UI_COLOR.highlight).width;
      } else {
        x += this.text(x, y, o.text, o.after === null || o.text.startsWith('(') ? UI_COLOR.textDim : UI_COLOR.text).width;
        if (o.delta) x += this.text(x + 4, y, o.delta.text, TONE[o.delta.tone]).width + 4;
      }
      widest = Math.max(widest, x);
      y += C.rowStep;
    }
    this.text(C.row3[0], y, v.bottom, v.bottomTone === 'bad' ? UI_COLOR.bad : UI_COLOR.highlight);
    this.w = Math.min(C.maxW, Math.max(C.minW, widest + 8));
    this.h = y + C.bottomPad;
    badge.setX(this.w - C.pad);
    const bg = box(this.scene, SKIN.panel, 0, 0, this.w, this.h, SKIN.corner.panel, { edge: border });
    for (const o of bg) { o.setScrollFactor(1); this.c.addAt(o, 0); }
  }

  /** `item` = the interact target if it's a ground item, else null. `now` in ms. */
  update(item: GroundItem | null, v: ItemCardView | null, now: number, shown = true): void {
    if (!item || !v || !shown) { this.c.setVisible(false); this.key = ''; return; }
    const key = JSON.stringify(v);
    if (key !== this.key) { if (!this.key) this.shownAt = now; this.key = key; this.build(v); }
    const cam = this.scene.cameras.main;
    const top = item.y - (item.endless ? C.standLift : 0) - 16 - C.lift - this.h;
    const x = Math.round(item.x - cam.scrollX - this.w / 2), y = Math.round(top - cam.scrollY);
    const { width, height } = this.scene.scale;
    this.c.setPosition(Math.max(C.margin, Math.min(width - C.margin - this.w, x)), Math.max(C.margin, Math.min(height - C.margin - this.h, y)))
      .setVisible(true).setAlpha(Math.min(1, (now - this.shownAt) / (C.fadeS * 1000)));
  }
}
