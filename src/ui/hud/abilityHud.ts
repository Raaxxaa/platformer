// Weapon and ability slots, the class name lines and toasts (07 §4.8–4.10, §6.10). Grey-box shapes and the ui atlas
// icons; reads HUD views from abilityHudModel and reacts to the frame's events. UI timers use real time (07 §2).
import Phaser from 'phaser';
import type { GameWorld, WorldEvent } from '../../core/sim/gameWorld.ts';
import { FONTS, itemIcon } from '../../data/animKeys.ts';
import { DEPTH } from '../../data/art.ts';
import { BONDS, CLASS_NAME, HYBRID_NAME } from '../../data/classes.ts';
import { SLOT_LAYOUT as L } from '../../data/stageUi.ts';
import { CLASS_COLOR, GRADE_COLOR, HYBRID_COLOR, UI_COLOR } from '../../data/uiText.ts';
import type { ClassId, HybridId } from '../../core/abilities/types.ts';
import { abilitySlotViews, chargeBarW, classLine, cooldownShade, linkBarW, SLOT_HUD, weaponSlotViews, type ClassColorKey } from './abilityHudModel.ts';

const PROMPTS = ['J', 'K', 'U', 'I'];                      // M1 key names (07 §8.4 glyphs later)
const FIZZLE_LABEL: Record<string, string> = { hunters_mark: 'No target', blink: 'Blocked' };

const colorOf = (k: ClassColorKey): number =>
  k === 'none' ? UI_COLOR.textDim : k === 'neutral' ? CLASS_COLOR.neutral : (CLASS_COLOR as Record<string, number>)[k] ?? HYBRID_COLOR[k as HybridId];

interface Flash { color: number; until: number }
interface Toast { text: Phaser.GameObjects.BitmapText; born: number; until: number }

export class AbilityHud {
  private scene: Phaser.Scene;
  private g: Phaser.GameObjects.Graphics;
  private icons: Phaser.GameObjects.Image[] = [];
  private classIcons: Phaser.GameObjects.Image[] = [];
  private prompts: Phaser.GameObjects.BitmapText[] = [];
  private digits: Phaser.GameObjects.BitmapText[] = [];
  private line1: Phaser.GameObjects.BitmapText;
  private line2: Phaser.GameObjects.BitmapText;
  private linkIcon: Phaser.GameObjects.Image;
  private linkText: Phaser.GameObjects.BitmapText;
  private linkAt = { slot: 0, born: -1e9 };
  private fizzle: Phaser.GameObjects.BitmapText;
  private fizzleUntil = -1e9;
  private flashes: Flash[] = [0, 1, 2, 3].map(() => ({ color: 0, until: -1e9 }));
  private classFlashUntil = -1e9;
  private prevCharges: number[] = [0, 0];
  private prevHammerReady = [true, true];
  private toasts: Toast[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, d = 0) => o.setScrollFactor(0).setDepth(DEPTH.hud + d);
    this.g = fixed(scene.add.graphics());
    const xs = [...L.weaponX, ...L.abilityX];
    for (let i = 0; i < 4; i++) {
      this.icons.push(fixed(scene.add.image(xs[i] + 4, L.boxY + 4, 'ui', itemIcon('weapon', 'greatsword')).setOrigin(0), 1));
      this.prompts.push(fixed(scene.add.bitmapText(xs[i] + L.box / 2, L.promptY, FONTS.small, PROMPTS[i]).setOrigin(0.5, 0), 1));
      this.digits.push(fixed(scene.add.bitmapText(0, 0, FONTS.small, '').setOrigin(0.5), 3));
    }
    for (let i = 0; i < 4; i++) this.classIcons.push(fixed(scene.add.image(0, 0, 'ui', 'class_swordsman').setOrigin(0), 1));
    this.line1 = fixed(scene.add.bitmapText(L.classX, L.classY, FONTS.small, ''));
    this.line2 = fixed(scene.add.bitmapText(L.classX, L.class2Y, FONTS.small, ''));
    this.linkIcon = fixed(scene.add.image(L.classX, L.class2Y, 'ui', 'hud_link').setOrigin(0));
    this.linkText = fixed(scene.add.bitmapText(0, 0, FONTS.small, 'LINK ×1.5').setOrigin(0.5, 1).setTint(UI_COLOR.highlight), 4);
    this.fizzle = scene.add.bitmapText(0, 0, FONTS.small, '').setOrigin(0.5, 1).setDepth(DEPTH.hud);
  }

  private flash(i: number, color: number, s: number, now: number): void {
    this.flashes[i] = { color, until: now + s * 1000 };
  }

  private toast(text: string, color: number, now: number): void {
    const t = this.scene.add.bitmapText(0, 0, FONTS.small, text).setOrigin(1, 1).setTint(color).setScrollFactor(0).setDepth(DEPTH.hud + 2)
      .setMaxWidth(L.toastMaxW);
    this.toasts.push({ text: t, born: now, until: now + L.toastS * 1000 });
    while (this.toasts.length > L.toastMax) this.toasts.shift()!.text.destroy();
  }

  /** `now` in ms (real time). */
  update(w: GameWorld, events: readonly WorldEvent[], now: number): void {
    const weapons = weaponSlotViews(w), abilities = abilitySlotViews(w), cls = classLine(w);
    for (const e of events) {
      if (e.t === 'abilityUsed') this.flash(2 + e.slot, UI_COLOR.text, L.flashUsed, now);
      if (e.t === 'abilityNotReady') this.flash(2 + e.slot, UI_COLOR.bad, L.flashNotReady, now);
      if (e.t === 'abilityFizzle') {
        this.flash(2 + e.slot, UI_COLOR.textDim, L.flashFizzle, now);
        const label = FIZZLE_LABEL[w.abilities.slots[e.slot]?.id ?? ''];
        if (label) { this.fizzle.setText(label); this.fizzleUntil = now + L.fizzleLabel * 1000; }
      }
      if (e.t === 'abilityLinked') this.linkAt = { slot: e.slot, born: now };
      if (e.t === 'classChanged') this.classFlashUntil = now + L.flashClass * 1000;
      if (e.t === 'classDiscovered') {
        const name = (HYBRID_NAME as Record<string, string>)[e.id] ?? Object.values(BONDS).find((b) => b.id === e.id)?.name ?? e.id;
        this.toast(`New class discovered: ${name}`, UI_COLOR.highlight, now);
      }
    }
    // A charge coming back, the hammer becoming ready: frame `text` for 0.1 s.
    abilities.forEach((a, i) => { if (a && a.charges > this.prevCharges[i]) this.flash(2 + i, UI_COLOR.text, L.flashCharge, now); this.prevCharges[i] = a?.charges ?? 0; });
    weapons.forEach((v, i) => { const r = v?.hammer?.ready ?? true; if (r && !this.prevHammerReady[i]) this.flash(i, UI_COLOR.text, L.flashCharge, now); this.prevHammerReady[i] = r; });

    const g = this.g.clear();
    const blinkOn = Math.floor(now / (1000 / (2 * L.swapBlinkHz))) % 2 === 0;
    const xs = [...L.weaponX, ...L.abilityX];
    let ci = 0;
    for (let i = 0; i < 4; i++) {
      const x = xs[i], y = L.boxY, isW = i < 2;
      const wv = isW ? weapons[i] : null, av = isW ? null : abilities[i - 2];
      let frame: number = UI_COLOR.slotEmpty;
      if (wv) frame = GRADE_COLOR[w.combat.slots[i]!.grade];
      if (av) frame = av.passive || !av.cls ? UI_COLOR.textDim : CLASS_COLOR[av.cls];
      if (av?.linkTicksLeft != null) frame = UI_COLOR.highlight;
      const swap = isW ? w.weaponSwapChoice : w.abilities.swapChoice;
      if (swap && blinkOn) frame = UI_COLOR.text;
      if (this.flashes[i].until > now) frame = this.flashes[i].color;
      g.fillStyle(UI_COLOR.ink, 1).fillRect(x, y, L.box, L.box);
      g.fillStyle(frame, 1).fillRect(x + 1, y + 1, L.box - 2, L.box - 2);
      g.fillStyle(UI_COLOR.panel, 1).fillRect(x + 2, y + 2, L.box - 4, L.box - 4);
      const icon = this.icons[i];
      const id = wv?.weaponId ?? av?.id;
      icon.setVisible(!!id);
      if (id) icon.setFrame(itemIcon(isW ? 'weapon' : 'ability', id)).setAlpha(wv?.hammer?.out ? L.iconOutAlpha : 1);
      this.prompts[i].setTint(id ? UI_COLOR.text : UI_COLOR.textOff).setVisible(!av?.passive);
      this.digits[i].setText('');
      if (wv) {
        // Class icons under the box, lit when that class is carried; the hammer's recharge bar.
        wv.tags.forEach((c, k) => {
          const ic = this.classIcons[ci++];
          ic?.setVisible(true).setFrame(`class_${c}`).setPosition(x + 2 + L.classIcon * k, L.classIconY).setTint(wv.litTags.includes(c) ? CLASS_COLOR[c] : UI_COLOR.panelBorder);
        });
        const h = wv.hammer;
        if (h && !h.out && !h.ready) g.fillStyle(CLASS_COLOR.wizard, 1).fillRect(x + L.barX, y + L.hammerBarY, Math.floor(SLOT_HUD.bar * h.progress), L.barH);
      }
      if (av) {
        for (let p = 0; p < L.pips; p++) g.fillStyle(p < av.level ? UI_COLOR.highlight : UI_COLOR.slotEmpty, 1).fillRect(x + 2 + L.pip * p, L.pipY, L.pipW, L.pipH);
        const shade = av.passive ? null : cooldownShade(av);
        if (shade) {
          g.fillStyle(UI_COLOR.ink, L.shadeAlpha).fillRect(x + 4, y + 4, SLOT_HUD.icon, shade.h);
          this.digits[i].setPosition(x + 4 + SLOT_HUD.icon / 2, y + 4 + SLOT_HUD.icon / 2).setText(String(shade.seconds));
        } else if (av.maxCharges >= 2) {
          this.digits[i].setPosition(x + L.chargeDigit[0], y + L.chargeDigit[1]).setText(String(av.charges));
        }
        const bar = chargeBarW(av);
        if (bar !== null) g.fillStyle(av.cls ? CLASS_COLOR[av.cls] : UI_COLOR.textDim, 1).fillRect(x + L.barX, y + L.hammerBarY, bar, L.barH);
        if (av.linkTicksLeft != null) g.fillStyle(UI_COLOR.highlight, 1).fillRect(x, L.linkBarY, linkBarW(av.linkTicksLeft), L.barH);
      }
    }
    for (; ci < this.classIcons.length; ci++) this.classIcons[ci].setVisible(false);

    // Class name (§4.10).
    this.line1.setText(cls.displayName).setTint(this.classFlashUntil > now ? UI_COLOR.text : colorOf(cls.color));
    this.linkIcon.setVisible(!!cls.bondName);
    if (cls.bondName) this.line2.setPosition(L.bondX, L.class2Y).setText(cls.bondName).setTint(UI_COLOR.highlight);
    else if (cls.hybridParts) this.line2.setPosition(L.classX, L.class2Y).setText(cls.hybridParts.map((c: ClassId) => CLASS_NAME[c]).join(' + ')).setTint(UI_COLOR.textDim);
    else this.line2.setText('');

    // LINK ×1.5 rising over the linked slot; the fizzle label over the player.
    const lt = (now - this.linkAt.born) / (L.linkRiseS * 1000);
    this.linkText.setVisible(lt >= 0 && lt < 1);
    if (lt >= 0 && lt < 1) this.linkText.setPosition(L.abilityX[this.linkAt.slot] + L.box / 2, L.linkBarY - 2 - L.linkRise * lt);
    const b = w.body;
    this.fizzle.setVisible(this.fizzleUntil > now).setPosition(b.x, b.y - b.h - L.fizzleLift);

    // Toasts, newest at the bottom.
    this.toasts = this.toasts.filter((t) => { if (t.until > now) return true; t.text.destroy(); return false; });
    let ty = L.toastBottom;
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.text.setPosition(L.toastRight, ty).setAlpha(Math.min(1, (t.until - now) / (L.toastFadeS * 1000)));
      ty -= t.text.height + L.toastGap;
    }
  }
}
