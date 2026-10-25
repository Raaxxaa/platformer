// Weapon and ability slots, the class name lines and toasts (07 §4.8–4.10, §6.10). Grey-box shapes and the ui atlas
// icons; reads HUD views from abilityHudModel and reacts to the frame's events. UI timers use real time (07 §2).
import type Phaser from 'phaser';
import type { GameWorld, WorldEvent } from '../../core/sim/gameWorld.ts';
import { FONTS, itemIcon } from '../../data/animKeys.ts';
import { DEPTH } from '../../data/art.ts';
import { BONDS, CLASS_NAME, HYBRID_NAME } from '../../data/classes.ts';
import { SLOT_LAYOUT as L } from '../../data/stageUi.ts';
import { CLASS_COLOR, GRADE_COLOR, HYBRID_COLOR, UI_COLOR } from '../../data/uiText.ts';
import type { ClassId, HybridId } from '../../core/abilities/types.ts';
import { box, SKIN } from '../skin.ts';
import { TOP_HUD } from '../../data/stageUi.ts';
import { abilitySlotViews, chargeBarW, classLine, cooldownShade, linkBarW, SLOT_HUD, weaponSlotViews, type ClassColorKey } from './abilityHudModel.ts';
import type { ActionId } from '../../core/save/schema.ts';
import { PROMPT } from '../../data/prompts.ts';
import { actionLabel, getUiSettings, menuGlyphs, shownPromptStyle } from '../inputSettings.ts';

export interface ActionPrompt { style: 'keyboard' | 'xbox' | 'playstation'; label: string; button: number | null }
export function actionPrompt(action: ActionId): ActionPrompt {
  const style = shownPromptStyle(); return { style, label: actionLabel(action), button: style === 'keyboard' ? null : getUiSettings().bindings.gamepad[action] };
}
export function menuPrompt(kind: 'confirm' | 'back'): ActionPrompt {
  const style = shownPromptStyle(); return { style, label: menuGlyphs()[kind], button: style === 'keyboard' ? null : PROMPT.menuButtons[kind] };
}
/** Actual prompt shapes/art, including PS symbols absent from the bitmap font (07 §8.4). */
export class PromptGlyph {
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private key = '';
  private size = PROMPT.minWidth as number;
  constructor(scene: Phaser.Scene, x: number, y: number, prompt: ActionPrompt) {
    this.scene = scene; this.container = scene.add.container(x, y).setScrollFactor(0).setDepth(DEPTH.hud + PROMPT.depthOffset); this.update(prompt);
  }
  get width(): number { return this.size; }
  setVisible(on: boolean): this { this.container.setVisible(on); return this; }
  update(prompt: ActionPrompt, tone: number = UI_COLOR.text): void {
    const key = JSON.stringify([prompt, tone]); if (key === this.key) return; this.key = key; this.container.removeAll(true);
    const face = prompt.style !== 'keyboard' && prompt.button !== null && prompt.button < PROMPT.psFrames.length;
    const width = face ? PROMPT.height : Math.max(PROMPT.minWidth, prompt.label.length * PROMPT.charWidth + PROMPT.padding), half = PROMPT.height / 2;
    this.size = width; const g = this.scene.add.graphics(); this.container.add(g);
    if (face) {
      const index = prompt.button!;
      g.fillStyle(prompt.style === 'xbox' ? tone === UI_COLOR.textOff ? tone : PROMPT.xboxColors[index] : UI_COLOR.panel, 1).fillCircle(0, half, half);
      if (prompt.style === 'playstation') {
        const tint = tone === UI_COLOR.textOff ? tone : PROMPT.psColors[index], frame = PROMPT.psFrames[index];
        if (this.scene.textures.exists('ui') && this.scene.textures.get('ui').has(frame)) this.container.add(this.scene.add.image(0, half, 'ui', frame).setDisplaySize(PROMPT.height, PROMPT.height).setTint(tint));
        else {
          const r = half - PROMPT.glyphInset; g.lineStyle(PROMPT.border, tint, 1);
          if (index === PROMPT.menuButtons.confirm) { g.lineBetween(-r, half - r, r, half + r); g.lineBetween(r, half - r, -r, half + r); }
          else if (index === PROMPT.menuButtons.back) g.strokeCircle(0, half, r);
          else if (index === PROMPT.psButtons.square) g.strokeRect(-r, half - r, r * 2, r * 2);
          else g.strokeTriangle(0, half - r, r, half + r, -r, half + r);
        }
        return;
      }
    } else {
      g.fillStyle(UI_COLOR.panel, 1).lineStyle(PROMPT.border, tone, 1);
      if (prompt.style === 'keyboard') { g.fillRect(-width / 2, 0, width, PROMPT.height); g.strokeRect(-width / 2 + PROMPT.border / 2, PROMPT.border / 2, width - PROMPT.border, PROMPT.height - PROMPT.border); }
      else { g.fillRoundedRect(-width / 2, 0, width, PROMPT.height, PROMPT.corner); g.strokeRoundedRect(-width / 2 + PROMPT.border / 2, PROMPT.border / 2, width - PROMPT.border, PROMPT.height - PROMPT.border, PROMPT.corner); }
    }
    this.container.add(this.scene.add.bitmapText(0, half, FONTS.smallPlain, prompt.label).setOrigin(0.5).setTint(face ? UI_COLOR.ink : tone));
  }
}
const FIZZLE_LABEL: Record<string, string> = { hunters_mark: 'No target', blink: 'Blocked' };

const colorOf = (k: ClassColorKey): number =>
  k === 'none' ? UI_COLOR.textDim : k === 'neutral' ? CLASS_COLOR.neutral : (CLASS_COLOR as Record<string, number>)[k] ?? HYBRID_COLOR[k as HybridId];

interface Flash { color: number; until: number }
interface Toast { text: Phaser.GameObjects.BitmapText; icon?: Phaser.GameObjects.Image; born: number; until: number }

export class AbilityHud {
  private scene: Phaser.Scene;
  private g: Phaser.GameObjects.Graphics;
  private icons: Phaser.GameObjects.Image[] = [];
  private classIcons: Phaser.GameObjects.Image[] = [];
  private prompts: PromptGlyph[] = [];
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
  private plate: Phaser.GameObjects.Components.Visible[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, d = 0) => o.setScrollFactor(0).setDepth(DEPTH.hud + d);
    const [px, py, pw, ph] = TOP_HUD.plateBottom;
    this.plate = box(scene, SKIN.plate, px, py, pw, ph, SKIN.corner.plate, { alpha: SKIN.plateAlpha }).map((o) => o.setDepth(DEPTH.hud - 1));
    this.g = fixed(scene.add.graphics());
    const xs = [...L.weaponX, ...L.abilityX];
    for (let i = 0; i < 4; i++) {
      this.icons.push(fixed(scene.add.image(xs[i] + 4, L.boxY + 4, 'ui', itemIcon('weapon', 'greatsword')).setOrigin(0), 1));
      this.prompts.push(new PromptGlyph(scene, xs[i] + L.box / 2, L.promptY, actionPrompt(PROMPT.hudActions[i])));
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

  toast(text: string, color: number, now: number, seconds: number = L.toastS, icon?: string): void {
    const t = this.scene.add.bitmapText(0, 0, FONTS.small, text).setOrigin(1, 1).setRightAlign().setTint(color).setScrollFactor(0).setDepth(DEPTH.hud + 2)
      .setMaxWidth(L.toastMaxW);
    const img = icon && this.scene.textures.get('ui').has(icon) ? this.scene.add.image(0, 0, 'ui', icon).setOrigin(1, 1).setScrollFactor(0).setDepth(DEPTH.hud + 2) : undefined;
    this.toasts.push({ text: t, icon: img, born: now, until: now + seconds * 1000 });
    while (this.toasts.length > L.toastMax) { const old = this.toasts.shift()!; old.text.destroy(); old.icon?.destroy(); }
  }

  private all(): Phaser.GameObjects.Components.Visible[] {
    return [...this.plate, this.g, ...this.icons, ...this.classIcons, ...this.prompts.map((prompt) => prompt.container), ...this.digits, this.line1, this.line2, this.linkIcon, this.linkText,
      this.fizzle, ...this.toasts.map((t) => t.text), ...this.toasts.flatMap((t) => (t.icon ? [t.icon] : []))];
  }

  /** `now` in ms (real time). `shown` false hides it all (the debug overview zooms the camera out). */
  update(w: GameWorld, events: readonly WorldEvent[], now: number, shown = true): void {
    for (const o of this.all()) o.setVisible(shown);
    if (!shown) return;
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
      this.prompts[i].update(actionPrompt(PROMPT.hudActions[i]), id ? UI_COLOR.text : UI_COLOR.textOff); this.prompts[i].setVisible(!av?.passive);
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
    this.toasts = this.toasts.filter((t) => { if (t.until > now) return true; t.text.destroy(); t.icon?.destroy(); return false; });
    let ty = L.toastBottom;
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      const fade = Math.min(1, (t.until - now) / (L.toastFadeS * 1000));
      t.text.setPosition(L.toastRight, ty).setAlpha(fade);
      t.icon?.setPosition(L.toastRight - t.text.width - 2, ty).setAlpha(fade);
      ty -= Math.max(t.text.height, t.icon?.height ?? 0) + L.toastGap;
    }
  }
}
