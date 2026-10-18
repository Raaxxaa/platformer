// SPEC-GAP: placeholder end until Stage 2 (M7.1)
import type Phaser from 'phaser';
import type { KitSummary } from '../../core/save/schema.ts';
import { formatTime } from '../../core/time.ts';
import { ABILITY_INFO } from '../../data/abilities.ts';
import { FONTS } from '../../data/animKeys.ts';
import { RUN_UI as U } from '../../data/runUi.ts';
import { UI_COLOR, WEAPON_NAME } from '../../data/uiText.ts';
import { activeHomePad, HomePanelInput, type HomePanelAction, type HomePanelPad } from '../home/homePanels.ts';

export interface RunSoFarData { runTicks: number; split1: number | null; kit: KitSummary; gold: number; kills: number }
export interface RunSoFarCallbacks { onRestart(): void; onHomeVillage(): void; onTitle(): void }
export type RunSoFarCommand = typeof U.summary.commands[number];

export class RunSoFarModel {
  cursor = 0;
  readonly lines: string[];
  private closed = false;
  constructor(data: RunSoFarData) {
    const weapons = data.kit.weapons.map((weapon) => weapon ? `${WEAPON_NAME(weapon.weaponId)} ${weapon.grade}` : 'Empty');
    const abilities = data.kit.abilities.map((ability) => ability ? `${ABILITY_INFO[ability.id].name} Lv ${ability.level}` : 'Empty');
    this.lines = [
      `Time ${formatTime(data.runTicks)}`, `Split 1 ${data.split1 === null ? '—' : formatTime(data.split1)}`, `Class: ${data.kit.displayName}`,
      `Weapons: ${weapons.join(' / ') || 'Empty'}`, `Abilities: ${abilities.join(' / ') || 'Empty'}`, `Gold: ${data.gold}`, `Kills: ${data.kills}`,
    ];
  }
  select(index: number): void { if (!this.closed) this.cursor = Math.max(0, Math.min(U.summary.buttons.length - 1, index)); }
  action(action: HomePanelAction): RunSoFarCommand | null {
    if (this.closed) return null;
    if (action === 'left') this.select(this.cursor - 1);
    if (action === 'right') this.select(this.cursor + 1);
    if (action !== 'confirm') return null;
    this.closed = true; return U.summary.commands[this.cursor];
  }
}

export class RunSoFarView {
  readonly model: RunSoFarModel;
  private readonly input = new HomePanelInput('training');
  private readonly c: Phaser.GameObjects.Container;
  private readonly dim: Phaser.GameObjects.Graphics;
  private closed = false;
  private enabled = true;
  private padHints = false;
  private drawn = '';
  private readonly scene: Phaser.Scene;
  private readonly callbacks: RunSoFarCallbacks;
  constructor(scene: Phaser.Scene, data: RunSoFarData, callbacks: RunSoFarCallbacks) {
    this.scene = scene; this.callbacks = callbacks;
    this.model = new RunSoFarModel(data); this.input.blockHeldPad(activeHomePad());
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
    if (command === 'restart') this.callbacks.onRestart();
    else if (command === 'homeVillage') this.callbacks.onHomeVillage();
    else this.callbacks.onTitle();
  }
  destroy(): void {
    if (this.closed) return;
    this.closed = true; this.input.clear();
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp);
    this.c.destroy(); this.dim.destroy();
  }
  private text(x: number, y: number, value: string, color: number, large = false): void {
    this.c.add(this.scene.add.bitmapText(x, y, large ? FONTS.large : FONTS.small, value).setTint(color).setOrigin(0.5, 0).setMaxWidth(U.summary.textW));
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
    const S = U.summary, [x, y, w, h] = S.panel;
    if (this.scene.textures.exists('ui') && this.scene.textures.get('ui').has(U.panelFrame)) {
      this.c.add(this.scene.add.nineslice(x, y, 'ui', U.panelFrame, w, h, U.corner, U.corner, U.corner, U.corner).setOrigin(0));
    } else this.rect(x, y, w, h);
    this.text(x + w / 2, S.titleY, S.title, UI_COLOR.highlight, true);
    this.model.lines.forEach((line, row) => this.text(x + w / 2, S.linesY + row * S.lineGap, line, row === 0 ? UI_COLOR.text : UI_COLOR.textDim));
    S.buttons.forEach((label, i) => {
      const xx = S.buttonXs[i], selected = this.model.cursor === i;
      this.rect(xx, S.buttonY, S.buttonW, S.buttonH, selected);
      this.text(xx + S.buttonW / 2, S.buttonY + U.border, label, selected ? UI_COLOR.highlight : UI_COLOR.text);
      if (selected) this.text(xx - U.cursorGap, S.buttonY + U.border, '▸', UI_COLOR.highlight);
      const area = this.scene.add.rectangle(xx, S.buttonY, S.buttonW, S.buttonH).setOrigin(0).setScrollFactor(0).setInteractive({ useHandCursor: true });
      area.on('pointerover', () => { if (this.enabled && !this.closed) { this.model.select(i); this.draw(); } });
      area.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (!this.enabled || this.closed || pointer.button !== 0) return;
        this.model.select(i); this.action('confirm');
      }); this.c.add(area);
    });
    const glyph = this.padHints ? U.glyphs.pad : U.glyphs.keyboard;
    this.text(x + w / 2, S.hintY, `←→ Choose   [${glyph.confirm}] Confirm`, UI_COLOR.textDim);
  }
}
