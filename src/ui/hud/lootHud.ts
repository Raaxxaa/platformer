// Loot HUD (07 §4.6 Lockpick icon, §4.7 effects row, §6.8 banners). Reads the core economy through lootHud.ts.
import Phaser from 'phaser';
import type { GameWorld, WorldEvent } from '../../core/sim/gameWorld.ts';
import { FONTS } from '../../data/animKeys.ts';
import { DEPTH } from '../../data/art.ts';
import { LOOT_HUD_UI as U } from '../../data/stageUi.ts';
import { GRADE_COLOR, HUD_COLOR, LOOT_HUD, UI_COLOR } from '../../data/uiText.ts';
import { bannerFor, effectsRow, toastFor, type LootTone } from '../model/lootHud.ts';

export const toneColor = (t: LootTone): number =>
  t === 'curse' ? HUD_COLOR.curse : t === 'S' ? GRADE_COLOR.S : UI_COLOR[t];

export class LootHud {
  private g: Phaser.GameObjects.Graphics;
  private lockpick: Phaser.GameObjects.Image;
  private icons: Phaser.GameObjects.Image[] = [];
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private b1: Phaser.GameObjects.BitmapText;
  private b2: Phaser.GameObjects.BitmapText;
  private banner = { born: -1e9, until: -1e9 };
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    this.lockpick = scene.add.image(U.lockpick[0], U.lockpick[1], 'ui', 'hud_lockpick').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.hud + 1);
    const cx = scene.scale.width / 2;
    this.b1 = scene.add.bitmapText(cx, U.bannerY[0], FONTS.large, '').setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud + 3);
    this.b2 = scene.add.bitmapText(cx, U.bannerY[1], FONTS.small, '').setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud + 3);
  }

  /** `toast` hands loot toasts to the shared bottom-right list (07 §6.10). */
  update(w: GameWorld, events: readonly WorldEvent[], now: number, shown: boolean, toast: (text: string, color: number, s: number) => void): void {
    for (const e of events) {
      const b = bannerFor(e);
      if (b) {
        this.b1.setText(b.l1).setTint(toneColor(b.tone));
        this.b2.setText(b.l2).setTint(UI_COLOR.text);
        this.banner = { born: now, until: now + b.s * 1000 };
      }
      const t = toastFor(e);
      if (t) toast(t.text, toneColor(t.tone), t.s);
    }
    // Banner: in over 0.1 s moving down 6 px, out over the last 0.3 s.
    const age = (now - this.banner.born) / 1000, left = (this.banner.until - now) / 1000;
    const on = shown && left > 0;
    const a = on ? Math.min(1, age / U.bannerInS, left / U.bannerOutS) : 0;
    const dy = on ? -U.bannerDrop * (1 - Math.min(1, age / U.bannerInS)) : 0;
    this.b1.setVisible(on).setAlpha(a).setY(U.bannerY[0] + dy);
    this.b2.setVisible(on).setAlpha(a).setY(U.bannerY[1] + dy);

    this.lockpick.setVisible(shown && w.classState.hybrid === 'thief' && !w.abilities.lockpickUsedThisStage);
    const g = this.g.clear();
    const row = shown ? effectsRow(w.econ) : [];
    const blinkOff = Math.floor(now / (500 / LOOT_HUD.blinkHz)) % 2 === 1;
    while (this.icons.length < row.length) {
      this.icons.push(this.scene.add.image(0, 0, 'ui', 'effect_swift').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.hud + 1));
      this.labels.push(this.scene.add.bitmapText(0, 0, FONTS.small, '').setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1));
    }
    this.icons.forEach((ic, i) => {
      const r = row[i];
      ic.setVisible(!!r);
      this.labels[i].setVisible(!!r);
      if (!r) return;
      const x = U.effectX + U.effectStep * i, y = U.effectY;
      const hide = r.blink && blinkOff;
      g.fillStyle(toneColor(r.tone), hide ? 0.3 : 1).fillRect(x, y, U.effectBox, U.effectBox);
      g.fillStyle(UI_COLOR.ink, 1).fillRect(x + 1, y + 1, U.effectBox - 2, U.effectBox - 2);
      if (this.scene.textures.get('ui').has(r.icon)) ic.setFrame(r.icon).setPosition(x + 1, y + 1).setAlpha(hide ? 0.3 : 1);
      else ic.setVisible(false);
      this.labels[i].setText(r.label).setPosition(x + U.effectBox / 2, U.effectLabelY).setTint(toneColor(r.tone));
    });
  }
}
