// 07 §6.6: choose a road at the Crossroads inn. Only the owner changes core/save state.
import type Phaser from 'phaser';
import type { ClassId } from '../../core/abilities/types.ts';
import type { PbKey, Road } from '../../core/save/schema.ts';
import { formatTime } from '../../core/time.ts';
import { FONTS } from '../../data/animKeys.ts';
import { RUN_UI as U } from '../../data/runUi.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import { activeHomePad, HomePanelInput, type HomePanelAction, type HomePanelPad } from '../home/homePanels.ts';

export interface RouteChoiceData {
  lastRoad: Road;
  startClass: ClassId | null;
  pbs: Readonly<Partial<Record<PbKey, { ticks: number }>>>;
}
export interface RouteChoiceCallbacks { onConfirm(road: Road): void; onCancel(): void }
export type RouteChoiceCommand = { type: 'confirm'; road: Road } | { type: 'cancel' };

export class RouteChoiceModel {
  cursor: number;
  readonly cards: { road: Road; lines: string[] }[];
  private closed = false;
  constructor(data: RouteChoiceData) {
    this.cards = U.route.cards.map((card) => {
      const pb = data.startClass === null ? undefined : data.pbs[`${data.startClass}|${card.road}`];
      return { road: card.road, lines: [...card.lines, `PB ${pb ? formatTime(pb.ticks) : '—'}`] };
    });
    this.cursor = Math.max(0, this.cards.findIndex((card) => card.road === data.lastRoad));
  }
  get road(): Road { return this.cards[this.cursor].road; }
  select(index: number): void { if (!this.closed) this.cursor = Math.max(0, Math.min(this.cards.length - 1, index)); }
  action(action: HomePanelAction): RouteChoiceCommand | null {
    if (this.closed) return null;
    if (action === 'left') this.select(this.cursor - 1);
    if (action === 'right') this.select(this.cursor + 1);
    if (action === 'confirm' || action === 'back') {
      this.closed = true;
      return action === 'confirm' ? { type: 'confirm', road: this.road } : { type: 'cancel' };
    }
    return null;
  }
}

export class RouteChoiceView {
  readonly model: RouteChoiceModel;
  private readonly input = new HomePanelInput('training');
  private readonly c: Phaser.GameObjects.Container;
  private readonly dim: Phaser.GameObjects.Graphics;
  private closed = false;
  private enabled = true;
  private padHints = false;
  private drawn = '';
  private readonly scene: Phaser.Scene;
  private readonly callbacks: RouteChoiceCallbacks;
  constructor(scene: Phaser.Scene, data: RouteChoiceData, callbacks: RouteChoiceCallbacks) {
    this.scene = scene; this.callbacks = callbacks;
    this.model = new RouteChoiceModel(data); this.input.blockHeldPad(activeHomePad());
    this.dim = scene.add.graphics().setScrollFactor(0).setDepth(U.dimDepth);
    this.dim.fillStyle(UI_COLOR.ink, U.dimAlpha).fillRect(0, 0, scene.scale.width, scene.scale.height);
    this.c = scene.add.container(0, 0).setScrollFactor(0).setDepth(U.depth);
    window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp);
    scene.events.once('shutdown', () => this.destroy()); this.draw();
  }
  get active(): boolean { return !this.closed; }
  setEnabled(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on; this.input.clear(); if (on) this.input.blockHeldPad(activeHomePad());
  }
  private readonly keyDown = (event: KeyboardEvent) => {
    if (!this.enabled || this.closed) return;
    if (this.input.key(event.code, true, event.repeat)) { this.padHints = false; event.preventDefault(); }
  };
  private readonly keyUp = (event: KeyboardEvent) => { this.input.key(event.code, false); };
  update(seconds: number, pad: HomePanelPad | null = activeHomePad()): void {
    if (!this.enabled || this.closed) return;
    if (pad?.buttons.some((button) => button.pressed) || pad?.axes.some((axis) => Math.abs(axis) >= U.stick)) this.padHints = true;
    for (const action of this.input.poll(Math.min(U.frameClamp, Math.max(0, seconds)), pad)) this.action(action);
    this.draw();
  }
  action(action: HomePanelAction): void {
    if (!this.enabled || this.closed) return;
    const command = this.model.action(action); this.draw();
    if (!command) return;
    this.destroy();
    if (command.type === 'confirm') this.callbacks.onConfirm(command.road); else this.callbacks.onCancel();
  }
  destroy(): void {
    if (this.closed) return;
    this.closed = true; this.input.clear();
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp);
    this.c.destroy(); this.dim.destroy();
  }
  private text(x: number, y: number, value: string, color: number, large = false): void {
    this.c.add(this.scene.add.bitmapText(x, y, large ? FONTS.large : FONTS.small, value).setTint(color).setOrigin(0.5, 0));
  }
  private rect(x: number, y: number, w: number, h: number, selected = false): void {
    const g = this.scene.add.graphics(); g.fillStyle(UI_COLOR.panel, 1).fillRect(x, y, w, h);
    g.lineStyle(U.border, selected ? UI_COLOR.highlight : UI_COLOR.panelBorder, 1)
      .strokeRect(x + U.border / 2, y + U.border / 2, w - U.border, h - U.border); this.c.add(g);
  }
  private draw(): void {
    if (this.closed) return;
    const key = JSON.stringify([this.model.cursor, this.padHints]); if (key === this.drawn) return;
    this.drawn = key; this.c.removeAll(true);
    const R = U.route, [x, y, w, h] = R.panel;
    if (this.scene.textures.exists('ui') && this.scene.textures.get('ui').has(U.panelFrame)) {
      this.c.add(this.scene.add.nineslice(x, y, 'ui', U.panelFrame, w, h, U.corner, U.corner, U.corner, U.corner).setOrigin(0));
    } else this.rect(x, y, w, h);
    this.text(x + w / 2, R.titleY, R.title, UI_COLOR.text, true);
    this.model.cards.forEach((card, i) => {
      const xx = R.cardXs[i], selected = i === this.model.cursor;
      this.rect(xx, R.cardY, R.cardW, R.cardH, selected);
      card.lines.forEach((line, row) => this.text(xx + R.cardW / 2, R.cardY + R.lineY + row * R.lineGap, line,
        row === 0 ? selected ? UI_COLOR.highlight : UI_COLOR.text : UI_COLOR.textDim));
      if (selected) this.text(xx + U.textInset, R.cardY + R.lineY, '▸', UI_COLOR.highlight);
      const area = this.scene.add.rectangle(xx, R.cardY, R.cardW, R.cardH).setOrigin(0).setScrollFactor(0).setInteractive({ useHandCursor: true });
      area.on('pointerover', () => { if (this.enabled && !this.closed) { this.model.select(i); this.draw(); } });
      area.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (!this.enabled || this.closed || pointer.button !== 0) return;
        this.model.select(i); this.action('confirm');
      }); this.c.add(area);
    });
    const glyph = this.padHints ? U.glyphs.pad : U.glyphs.keyboard;
    this.text(x + w / 2, R.hintY, `←→ Road   [${glyph.confirm}] Sleep   [${glyph.back}] Cancel`, UI_COLOR.textDim);
  }
}
