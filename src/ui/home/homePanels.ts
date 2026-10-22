// Small Home Village panels. Models and input are pure; only the view touches Phaser/devices.
import { layoutCode, rollLayout } from '../../core/run/layout.ts';
import { fnv1a32 } from '../../core/rng.ts';
import type Phaser from 'phaser';
import { FONTS } from '../../data/animKeys.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import { HOME_UI as U } from '../../data/homeUi.ts';
import { fixedMenuAction, menuConfirmKey, menuGlyphs, noteInputDevice } from '../inputSettings.ts';
import { promptLine } from '../promptLine.ts';
export { configureMenuBindings } from '../inputSettings.ts';

export type HomePanelKind = 'seed' | 'training' | 'records';
export type HomePanelAction = 'left' | 'right' | 'up' | 'down' | 'confirm' | 'back' | 'backspace' | { text: string };
export type HomePanelCommand = { type: 'seed'; seed: string | null } | { type: 'training' } | { type: 'close' };
export interface HomePanelData {
  typedSeed: string | null;
  progress: { classesDiscovered: readonly string[] };
  unlocks: { blueprints: readonly string[] };
}
export interface HomePanelCallbacks { onSeedChange(seed: string | null): void; onTraining(): void; onClose(): void }
export interface HomePanelPad { axes: readonly number[]; buttons: readonly { pressed: boolean }[] }
export function activeHomePad(): HomePanelPad | null {
  const pads = (navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p?.connected);
  return pads.find((p) => p.mapping === 'standard') ?? pads[0] ?? null;
}

export class HomePanelsModel {
  readonly kind: HomePanelKind;
  readonly boxes: string[];
  readonly classes: string[];
  readonly blueprints: string[];
  cursor = 0;
  private readonly randomSeed: () => string;
  constructor(kind: HomePanelKind, data: HomePanelData, randomSeed: () => string) {
    this.kind = kind; this.randomSeed = randomSeed;
    const initial = (data.typedSeed ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, U.seed.length);
    this.boxes = Array.from({ length: U.seed.length }, (_, i) => initial[i] ?? '');
    this.cursor = kind === 'seed' ? Math.min(initial.length, U.seed.length - 1) : 0;
    this.classes = [...data.progress.classesDiscovered]; this.blueprints = [...data.unlocks.blueprints];
  }
  get seed(): string { const blank = this.boxes.indexOf(''); return this.boxes.slice(0, blank < 0 ? this.boxes.length : blank).join(''); }
  get canUse(): boolean { return this.seed.length > 0; }
  /** 06 §8.7: the typed seed fixes the layout too; show its Plains code. */
  get layoutLine(): string { return this.seed ? `Plains layout ${layoutCode(rollLayout(fnv1a32(this.seed)).plains)}` : ''; }
  select(index: number): void {
    const max = this.kind === 'seed' ? U.seed.length + U.seed.buttons.length - 1 : this.kind === 'training' ? U.training.buttons.length - 1 : 0;
    this.cursor = Math.max(0, Math.min(max, index));
  }
  action(action: HomePanelAction): HomePanelCommand | null {
    if (action === 'back') return { type: 'close' };
    if (this.kind === 'records') return action === 'confirm' ? { type: 'close' } : null;
    if (this.kind === 'training') {
      if (action === 'left' || action === 'up') this.select(this.cursor - 1);
      if (action === 'right' || action === 'down') this.select(this.cursor + 1);
      return action === 'confirm' ? { type: this.cursor === 0 ? 'training' : 'close' } : null;
    }
    if (typeof action === 'object') {
      if (this.cursor < U.seed.length && /^[A-Z0-9]$/i.test(action.text)) {
        this.boxes[this.cursor] = action.text.toUpperCase(); this.cursor = Math.min(U.seed.length - 1, this.cursor + 1);
      }
      return null;
    }
    if (action === 'backspace') {
      this.cursor = Math.max(0, Math.min(U.seed.length, this.cursor) - 1); this.boxes[this.cursor] = ''; return null;
    }
    if (action === 'left' || action === 'right') {
      const dir = action === 'left' ? -1 : 1;
      this.select(this.cursor + dir);
      if (this.cursor === U.seed.length && !this.canUse) this.select(this.cursor + dir);
    }
    if ((action === 'up' || action === 'down') && this.cursor < U.seed.length) {
      const chars = ['', ...U.seed.alphabet], at = chars.indexOf(this.boxes[this.cursor]);
      this.boxes[this.cursor] = chars[(at + (action === 'up' ? 1 : -1) + chars.length) % chars.length];
    }
    if (action !== 'confirm') return null;
    const button = this.cursor < U.seed.length ? 'Use' : U.seed.buttons[this.cursor - U.seed.length];
    if (button === 'Use') return this.canUse ? { type: 'seed', seed: this.seed } : null;
    if (button === 'Clear') return { type: 'seed', seed: null };
    if (button === 'Back') return { type: 'close' };
    if (button === 'Random') {
      const value = this.randomSeed().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, U.seed.randomLength);
      this.boxes.forEach((_, i) => { this.boxes[i] = value[i] ?? ''; }); this.cursor = Math.min(value.length, U.seed.length - 1);
    }
    return null;
  }
}

/** Same direct-menu/repeat policy as StatPickInput, with seed-entry's keyboard exception. */
export class HomePanelInput {
  private readonly kind: HomePanelKind;
  private keys = new Map<string, HomePanelAction>();
  private pending: HomePanelAction[] = [];
  private held = new Map<string, number>();
  private blockedPad = new Set<string>();
  constructor(kind: HomePanelKind) { this.kind = kind; }
  clear(): void { this.keys.clear(); this.pending = []; this.held.clear(); this.blockedPad.clear(); }
  blockHeldPad(pad?: HomePanelPad | null): void {
    this.clear(); this.poll(0, pad);
    for (const key of this.held.keys()) if (key.startsWith('pad:')) this.blockedPad.add(key);
  }
  key(code: string, down: boolean, repeat = false): boolean {
    const nav: Record<string, HomePanelAction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'confirm', Escape: 'back' };
    let action: HomePanelAction | undefined = nav[code];
    if (this.kind === 'seed') {
      if (code === 'Backspace') action = 'backspace';
      else if (/^Key[A-Z]$/.test(code)) action = { text: code.slice(3) };
      else if (/^(Digit|Numpad)[0-9]$/.test(code)) action = { text: code.at(-1)! };
    } else {
      action ??= fixedMenuAction(code);
      if (!action && menuConfirmKey(code)) action = 'confirm';
    }
    if (!action) return code === 'Space' || code === 'Tab';
    if (!down) this.keys.delete(code);
    else if (!repeat && !this.keys.has(code)) { this.keys.set(code, action); this.pending.push(action); }
    return true;
  }
  poll(seconds: number, pad?: HomePanelPad | null): HomePanelAction[] {
    const out = this.pending.splice(0), now = new Map([...this.keys].map(([k, a]) => [`key:${k}`, a]));
    const add = (a: HomePanelAction & string, on: boolean) => { if (on) now.set(`pad:${a}`, a); };
    if (pad) {
      add('left', !!pad.buttons[U.pad.left]?.pressed || (pad.axes[0] ?? 0) <= -U.stick);
      add('right', !!pad.buttons[U.pad.right]?.pressed || (pad.axes[0] ?? 0) >= U.stick);
      add('up', !!pad.buttons[U.pad.up]?.pressed || (pad.axes[1] ?? 0) <= -U.stick);
      add('down', !!pad.buttons[U.pad.down]?.pressed || (pad.axes[1] ?? 0) >= U.stick);
      add('confirm', !!pad.buttons[U.pad.confirm]?.pressed); add('back', !!pad.buttons[U.pad.back]?.pressed);
    }
    for (const key of [...this.blockedPad]) { if (now.has(key)) now.delete(key); else this.blockedPad.delete(key); }
    for (const key of [...this.held.keys()]) if (!now.has(key)) this.held.delete(key);
    for (const [key, action] of now) {
      const before = this.held.get(key);
      if (before === undefined) { this.held.set(key, U.repeatDelay); if (key.startsWith('pad:')) out.push(action); }
      else if (typeof action === 'string' && ['left', 'right', 'up', 'down'].includes(action)) {
        let left = before - seconds;
        while (left <= Number.EPSILON) { out.push(action); left += U.repeatEvery; }
        this.held.set(key, left);
      }
    }
    return out;
  }
}

export class HomePanels {
  readonly model: HomePanelsModel;
  private readonly scene: Phaser.Scene;
  private readonly callbacks: HomePanelCallbacks;
  private readonly input: HomePanelInput;
  private readonly c: Phaser.GameObjects.Container;
  private readonly dim: Phaser.GameObjects.Graphics;
  private closed = false;
  private enabled = true;
  private lastDraw = '';
  constructor(scene: Phaser.Scene, kind: HomePanelKind, data: HomePanelData, callbacks: HomePanelCallbacks, randomSeed: () => string) {
    this.scene = scene; this.callbacks = callbacks;
    this.model = new HomePanelsModel(kind, data, randomSeed); this.input = new HomePanelInput(kind);
    this.input.blockHeldPad(activeHomePad());
    this.dim = scene.add.graphics().setScrollFactor(0).setDepth(U.dimDepth);
    this.dim.fillStyle(UI_COLOR.ink, U.dimAlpha).fillRect(0, 0, scene.scale.width, scene.scale.height);
    this.c = scene.add.container(0, 0).setScrollFactor(0).setDepth(U.depth);
    window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp);
    scene.events.once('shutdown', () => this.destroy()); this.draw();
  }
  get active(): boolean { return !this.closed; }
  setEnabled(on: boolean): void { if (this.enabled === on) return; this.enabled = on; this.input.clear(); if (on) this.input.blockHeldPad(activeHomePad()); }
  private readonly keyDown = (e: KeyboardEvent) => { if (this.enabled && this.input.key(e.code, true, e.repeat)) { noteInputDevice('keyboard'); e.preventDefault(); } };
  private readonly keyUp = (e: KeyboardEvent) => { this.input.key(e.code, false); };
  update(seconds: number, pad?: HomePanelPad | null): void {
    if (this.closed || !this.enabled) return;
    const pads = pad === undefined ? (navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => p !== null && p.connected) : [];
    const activePad = pad === undefined ? pads.find((p) => p.mapping === 'standard') ?? pads[0] : pad;
    if (activePad?.buttons.some((b) => b.pressed) || activePad?.axes.some((axis) => Math.abs(axis) >= U.stick)) noteInputDevice('gamepad', (activePad as HomePanelPad & { id?: string }).id);
    for (const action of this.input.poll(Math.min(U.frameClamp, Math.max(0, seconds)), activePad)) this.action(action);
    this.draw();
  }
  action(action: HomePanelAction): void {
    if (this.closed || !this.enabled) return;
    const command = this.model.action(action); this.draw();
    if (!command) return;
    this.destroy();
    if (command.type === 'seed') this.callbacks.onSeedChange(command.seed);
    this.callbacks.onClose();
    if (command.type === 'training') this.callbacks.onTraining();
  }
  destroy(): void {
    if (this.closed) return;
    this.closed = true; this.input.clear();
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp);
    this.c.destroy(); this.dim.destroy();
  }
  private text(x: number, y: number, value: string, color: number = UI_COLOR.text, large = false, centered = true): Phaser.GameObjects.BitmapText {
    const text = this.scene.add.bitmapText(x, y, large ? FONTS.large : FONTS.small, value).setTint(color).setOrigin(centered ? 0.5 : 0, 0);
    this.c.add(text); return text;
  }
  private rect(x: number, y: number, w: number, h: number, selected = false, fill: number = UI_COLOR.panel): void {
    const g = this.scene.add.graphics(); g.fillStyle(fill, 1).fillRect(x, y, w, h);
    g.lineStyle(U.border, selected ? UI_COLOR.highlight : UI_COLOR.panelBorder, 1).strokeRect(x + U.border / 2, y + U.border / 2, w - U.border, h - U.border); this.c.add(g);
  }
  private panel(x: number, y: number, w: number, h: number): void {
    if (this.scene.textures.exists('ui') && this.scene.textures.get('ui').has(U.panelFrame)) {
      this.c.add(this.scene.add.nineslice(x, y, 'ui', U.panelFrame, w, h, U.corner, U.corner, U.corner, U.corner).setOrigin(0));
    } else this.rect(x, y, w, h);
  }
  private target(x: number, y: number, w: number, h: number, index: number, confirm = true): void {
    const area = this.scene.add.rectangle(x, y, w, h).setOrigin(0).setScrollFactor(0).setInteractive({ useHandCursor: true });
    area.on('pointerover', () => { if (this.enabled) { this.model.select(index); this.draw(); } });
    area.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.enabled || pointer.button !== 0) return;
      this.model.select(index); if (confirm) this.action('confirm'); else this.draw();
    }); this.c.add(area);
  }
  private draw(): void {
    if (this.closed) return;
    const m = this.model, key = JSON.stringify([m.kind, m.cursor, m.boxes, m.classes, m.blueprints, menuGlyphs()]);
    if (key === this.lastDraw) return; this.lastDraw = key; this.c.removeAll(true);
    if (m.kind === 'seed') {
      const S = U.seed, [x, y, w, h] = S.panel; this.panel(x, y, w, h); this.text(x + w / 2, y + S.titleY, 'SEED', UI_COLOR.text, true);
      const startX = x + (w - (S.length * (S.boxW + S.boxGap) - S.boxGap)) / 2;
      m.boxes.forEach((char, i) => {
        const xx = startX + i * (S.boxW + S.boxGap); this.rect(xx, y + S.boxesY, S.boxW, S.boxH, m.cursor === i, UI_COLOR.ink);
        this.text(xx + S.boxW / 2, y + S.boxesY + U.border, char); this.target(xx, y + S.boxesY, S.boxW, S.boxH, i, false);
      });
      const actionsX = x + (w - (S.buttons.length * (S.actionW + S.actionGap) - S.actionGap)) / 2;
      S.buttons.forEach((label, i) => {
        const index = S.length + i, disabled = i === 0 && !m.canUse, xx = actionsX + i * (S.actionW + S.actionGap);
        this.rect(xx, y + S.actionsY, S.actionW, S.actionH, m.cursor === index);
        this.text(xx + S.actionW / 2, y + S.actionsY + U.border, label, disabled ? UI_COLOR.textOff : m.cursor === index ? UI_COLOR.highlight : UI_COLOR.text);
        if (!disabled) this.target(xx, y + S.actionsY, S.actionW, S.actionH, index);
      });
      if (m.layoutLine) this.text(x + w / 2, y + S.layoutY, m.layoutLine, UI_COLOR.textDim);
      promptLine(this.scene, this.c, x + w / 2, y + S.hintY, ['←→ Position   ↑↓ Change   ', { menu: 'confirm' }, ' Use   ', { menu: 'back' }, ' Back']);
    } else if (m.kind === 'training') {
      const T = U.training, [x, y, w, h] = T.panel; this.panel(x, y, w, h);
      this.text(x + w / 2, y + T.titleY, T.title, UI_COLOR.text, true); this.text(x + w / 2, y + T.bodyY, T.body, UI_COLOR.textDim);
      const startX = x + (w - (T.buttons.length * (T.actionW + T.actionGap) - T.actionGap)) / 2;
      T.buttons.forEach((label, i) => { const xx = startX + i * (T.actionW + T.actionGap); this.rect(xx, y + T.actionsY, T.actionW, T.actionH, m.cursor === i); this.text(xx + T.actionW / 2, y + T.actionsY + U.border, label, m.cursor === i ? UI_COLOR.highlight : UI_COLOR.text); this.target(xx, y + T.actionsY, T.actionW, T.actionH, i); });
    } else {
      const R = U.records, [x, y, w, h] = R.panel; this.panel(x, y, w, h); this.text(x + w / 2, y + R.titleY, R.title, UI_COLOR.text, true);
      [m.classes, m.blueprints].forEach((rows, col) => {
        const xx = x + R.columns[col]; this.text(xx, y + R.headingsY, col === 0 ? R.classes : R.blueprints, UI_COLOR.highlight, false, false);
        (rows.length ? rows : [R.empty]).forEach((value, i) => this.text(xx, y + R.rowsY + i * R.rowH, value, UI_COLOR.textDim, false, false).setMaxWidth(R.columnW));
      }); const xx = x + (w - R.backW) / 2; this.rect(xx, y + R.backY, R.backW, R.backH, true); this.text(x + w / 2, y + R.backY + U.border, 'Back', UI_COLOR.highlight); this.target(xx, y + R.backY, R.backW, R.backH, 0);
    }
  }
}
