// The top-left HUD (07 §4.1–4.6): plate, heart, the 160 × 12 HP bar with lag, heal flash and low-HP pulse, Rush,
// flask charges and fill, gold and keys. Reads TopHudView only.
import type Phaser from 'phaser';
import type { WorldEvent } from '../../core/sim/gameWorld.ts';
import { FONTS } from '../../data/animKeys.ts';
import { DEPTH } from '../../data/art.ts';
import { TOP_HUD as T } from '../../data/stageUi.ts';
import { HUD_COLOR, UI_COLOR } from '../../data/uiText.ts';
import { flaskFillW, hpFillW, rushFills, type TopHudView } from '../model/hudModel.ts';
import { box, icon, SKIN } from '../skin.ts';

const blink = (now: number, hz: number) => Math.floor(now / (500 / hz)) % 2 === 0;

export class TopHud {
  private objs: (Phaser.GameObjects.Components.Visible)[] = [];
  private g: Phaser.GameObjects.Graphics;
  private hpText: Phaser.GameObjects.BitmapText;
  private goldText: Phaser.GameObjects.BitmapText;
  private keyText: Phaser.GameObjects.BitmapText;
  private flaskIcons: Phaser.GameObjects.Image[] = [];
  private statusIcons = new Map<string, Phaser.GameObjects.Image>();
  private poisonStacks: Phaser.GameObjects.BitmapText;
  private lag = -1;
  private lastDrop = -1e9;
  private healFrom = 0;
  private healUntil = -1e9;
  private refusedUntil = -1e9;
  private goldUntil = -1e9;
  private prevGold = 0;
  private prevCharges = -1;
  private chargeFlash = { i: -1, until: -1e9 };
  private lastNow = 0;

  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const d = <O extends Phaser.GameObjects.Components.Depth>(o: O, k = 0): O => { o.setDepth(DEPTH.hud + k); return o; };
    for (const o of box(scene, SKIN.plate, T.plate[0], T.plate[1], T.plate[2], T.plate[3], SKIN.corner.plate, { alpha: SKIN.plateAlpha })) { d(o, -1); this.objs.push(o); }
    const heart = d(icon(scene, SKIN.heart, T.heart[0], T.heart[1], [T.heartSize, T.heartSize]), 1);
    this.objs.push(heart);
    this.g = d(scene.add.graphics().setScrollFactor(0));
    this.hpText = d(scene.add.bitmapText(T.hpText[0], T.hpText[1], FONTS.small, '').setScrollFactor(0), 1);
    const coin = d(scene.add.image(T.coin[0], T.coin[1], 'ui', 'hud_coin').setOrigin(0).setScrollFactor(0), 1);
    this.goldText = d(scene.add.bitmapText(T.gold[0], T.gold[1], FONTS.small, '').setScrollFactor(0), 1);
    const key = d(scene.add.image(T.key[0], T.key[1], 'ui', 'hud_key').setOrigin(0).setScrollFactor(0), 1);
    this.keyText = d(scene.add.bitmapText(T.keyText[0], T.keyText[1], FONTS.small, '').setScrollFactor(0), 1);
    this.objs.push(this.g, this.hpText, coin, this.goldText, key, this.keyText);
    for (const id of T.status.order) {
      const image = d(scene.add.image(T.status.x, T.status.y, 'ui', `status_${id}`).setOrigin(0).setScrollFactor(0), 1);
      this.statusIcons.set(id, image); this.objs.push(image);
    }
    this.poisonStacks = d(scene.add.bitmapText(T.status.x, T.status.y, FONTS.small, '').setScrollFactor(0), 1);
    this.objs.push(this.poisonStacks);
  }

  /** `now` in ms (real time, 07 §1.3). */
  update(v: TopHudView, events: readonly WorldEvent[], now: number, shown = true): void {
    for (const o of this.objs) o.setVisible(shown);
    for (const i of this.flaskIcons) i.setVisible(shown);
    if (!shown) return;
    for (const image of this.statusIcons.values()) image.setVisible(false);
    this.poisonStacks.setVisible(false);
    for (const status of v.statuses) {
      this.statusIcons.get(status.id)!.setVisible(true).setPosition(status.x, T.status.y);
      if (status.stacks !== null) this.poisonStacks.setVisible(true).setPosition(status.x + T.status.stackDx, T.status.y).setText(String(status.stacks));
    }
    const dt = Math.min(0.1, (now - this.lastNow) / 1000);
    this.lastNow = now;
    for (const e of events) if (e.t === 'healRefused') this.refusedUntil = now + T.refusedS * 1000;
    // HP lag and heal flash (§4.2).
    if (this.lag < 0 || this.lag > v.maxHp) this.lag = v.hp;
    if (v.hp < this.lag && this.lastHp !== null && v.hp < this.lastHp) this.lastDrop = now;
    if (this.lastHp !== null && v.hp > this.lastHp) { this.healFrom = this.lastHp; this.healUntil = now + T.healFlashS * 1000; this.lag = v.hp; }
    if (now - this.lastDrop > T.lagDelayS * 1000) this.lag = Math.max(v.hp, this.lag - T.lagSpeed * v.maxHp * dt);
    this.lastHp = v.hp;

    const g = this.g.clear();
    const [fx, fy, fw, fh] = T.hpFrame;
    g.fillStyle(UI_COLOR.ink, 1).fillRect(fx, fy, fw, fh);
    const low = v.hp <= T.lowFrac * v.maxHp;
    const hpColor = low && !blink(now, T.lowHz) ? HUD_COLOR.hpLow : HUD_COLOR.hp;
    const fill = hpFillW(v.hp, v.maxHp), lagW = hpFillW(Math.round(this.lag), v.maxHp);
    if (lagW > fill) g.fillStyle(UI_COLOR.text, 1).fillRect(fx + 1 + fill, fy + 1, lagW - fill, fh - 2);
    g.fillStyle(hpColor, 1).fillRect(fx + 1, fy + 1, fill, fh - 2);
    if (this.healUntil > now) {
      const from = hpFillW(this.healFrom, v.maxHp);
      g.fillStyle(UI_COLOR.good, 1).fillRect(fx + 1 + from, fy + 1, Math.max(0, fill - from), fh - 2);
    }
    this.hpText.setText(`${v.hp}/${v.maxHp}`).setTint(low ? UI_COLOR.bad : UI_COLOR.text);

    // Rush (§4.4).
    const r = rushFills(v.rush);
    T.rushX.forEach((x, k) => {
      if (!v.rushVisible) return;
      g.fillStyle(UI_COLOR.ink, 1).fillRect(x, T.rushY, T.rushW, T.rushH);
      const c = r.blink && !blink(now, T.rush3Hz) ? UI_COLOR.text : HUD_COLOR.rush[k];
      g.fillStyle(c, 1).fillRect(x + 1, T.rushY + 1, r.w[k], T.rushH - 2);
      if (r.w[k] >= T.rushW - 2) g.fillStyle(UI_COLOR.text, 1).fillRect(x + 1, T.rushY + 1, r.w[k], 1);
    });

    // Flask (§4.5).
    const f = v.flask;
    while (this.flaskIcons.length < f.maxCharges) {
      this.flaskIcons.push(this.scene.add.image(0, 0, 'ui', 'hud_flask_full').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.hud + 1));
    }
    if (this.prevCharges >= 0 && f.charges > this.prevCharges) this.chargeFlash = { i: f.charges - 1, until: now + T.chargeFlashS * 1000 };
    this.prevCharges = f.charges;
    this.flaskIcons.forEach((ic, i) => {
      const on = i < f.maxCharges;
      ic.setVisible(on).setPosition(T.flaskIcon[0] + T.flaskStep * i, T.flaskIcon[1]).setFrame(i < f.charges ? 'hud_flask_full' : 'hud_flask_empty');
      const drinkingThis = f.drinking && i === f.charges - 1 && !blink(now, T.drinkHz);
      ic.setAlpha(drinkingThis ? 0.3 : 1);
      if (this.refusedUntil > now) ic.setTint(UI_COLOR.bad);
      else if (this.chargeFlash.i === i && this.chargeFlash.until > now) ic.setTint(UI_COLOR.text);
      else ic.clearTint();
    });
    const [bx, by, bw, bh] = T.flaskBar;
    g.fillStyle(UI_COLOR.ink, 1).fillRect(bx, by, bw, bh);
    const banked = f.charges >= f.maxCharges && f.fillTenths >= 1000;
    g.fillStyle(banked && !blink(now, T.flaskFullHz) ? UI_COLOR.text : HUD_COLOR.flask, 1).fillRect(bx + 1, by + 1, flaskFillW(f.fillTenths), bh - 2);

    // Gold and keys (§4.6).
    if (v.gold !== this.prevGold) { this.goldUntil = now + T.goldFlashS * 1000; this.prevGold = v.gold; }
    this.goldText.setText(String(v.gold)).setTint(this.goldUntil > now ? UI_COLOR.highlight : UI_COLOR.text);
    this.keyText.setText(String(v.keys)).setTint(v.keys === 0 ? UI_COLOR.textDim : v.keys >= 3 ? UI_COLOR.highlight : UI_COLOR.text);
  }
  private lastHp: number | null = null;
}
