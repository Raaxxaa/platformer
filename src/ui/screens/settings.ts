// Settings (07 §7.7) with the Controls page (07 §7.8: rebinding, rules in ui/model/bindings.ts) and the touch page (07 §8.6).
import type Phaser from 'phaser';
import { TOUCH } from '../../data/touch.ts';
import { effectsLevel } from '../touch/effects.ts';
import { isTouchDevice } from '../../game/zoom.ts';
import type { ActionId, SettingsData } from '../../core/save/schema.ts';
import { MENU_UI as U } from '../../data/menuUi.ts';
import { SAVE_RULES } from '../../data/save.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import { PROMPT } from '../../data/prompts.ts';
import type { HomePanelAction } from '../home/homePanels.ts';
import { MenuSurface } from './records.ts';
import { keyLabel, menuGlyphs, shownPromptStyle } from '../inputSettings.ts';
import { ACTIONS, bindKey, bindPad, canCaptureKey, canCapturePad, clearKey, isFixed, type BindCol } from '../model/bindings.ts';
import { defaultSettings } from '../../data/save.ts';
import { ASSIST } from '../../data/assist.ts';
import { PromptGlyph } from '../hud/abilityHud.ts';

export type SettingsRow = typeof U.settings.rows[number];
export type SettingsCommand = { type: 'change'; settings: SettingsData } | { type: 'export' | 'import' | 'fullscreen' | 'layout' | 'hudLayout' | 'close' };
export interface SettingsCallbacks { onChange(settings: SettingsData): void; onExport(): void; onImport(): void; onFullscreen(): void; onClose(): void; onEditLayout?(): void; onEditHud?(): void }
export type TouchRow = typeof U.settings.touchRows[number];
/** The Controls page (07 §7.8): rows are the 14 actions, then Reset to defaults and Back; columns Key 1, Key 2, Gamepad. */
export class ControlsModel {
  row = 0;
  col: BindCol = 0;
  /** A cell waiting for a press, with the time it opened (seconds). */
  capture: { action: ActionId; col: BindCol; since: number } | null = null;
  flash: { action: ActionId; col: BindCol; until: number } | null = null;
  get onAction(): boolean { return this.row < ACTIONS.length; }
  get action(): ActionId | null { return this.onAction ? ACTIONS[this.row] : null; }
  private skipFixed(dir: 1 | -1): void {
    const a = this.action; if (!a) return;
    for (let i = 0; i < 3 && isFixed(a, this.col); i++) this.col = Math.max(0, Math.min(2, this.col + dir)) as BindCol;
    if (isFixed(a, this.col)) this.col = ([0, 1, 2] as BindCol[]).find((c) => !isFixed(a, c)) ?? 0;
  }
  move(action: HomePanelAction): void {
    if (action === 'up') this.row = Math.max(0, this.row - 1);
    if (action === 'down') this.row = Math.min(ACTIONS.length + 1, this.row + 1);
    if (action === 'left') this.col = Math.max(0, this.col - 1) as BindCol;
    if (action === 'right') this.col = Math.min(2, this.col + 1) as BindCol;
    this.skipFixed(action === 'left' ? -1 : 1);
  }
  /** Result of a key or button press while capturing: new bindings, or null (refused or cancelled). */
  refuse(now: number): void { const c = this.capture; if (c) this.flash = { action: c.action, col: c.col, until: now + U.settings.controls.flashS }; this.capture = null; }
}

export class SettingsModel {
  cursor = 0;
  controlsOpen = false;
  readonly controls = new ControlsModel();
  /** The touch page is open (07 §8.6 settings); `savedCursor` is where the main page's cursor was. */
  touchOpen = false;
  /** The Assist page (06 §5.4). */
  assistOpen = false;
  private savedCursor = 0;
  get rows(): readonly string[] { return this.touchOpen ? U.settings.touchRows : this.assistOpen ? U.settings.assistRows : U.settings.rows; }
  private readonly getSettings: () => SettingsData;
  constructor(getSettings: () => SettingsData) { this.getSettings = getSettings; }
  snapshot(): SettingsData { return structuredClone(this.getSettings()); }
  select(index: number): void { this.cursor = Math.max(0, Math.min(this.rows.length - 1, index)); }
  setVolume(value: number): SettingsCommand | null {
    const row = this.rows[this.cursor]; if (row !== 'master' && row !== 'sfx') return null;
    const next = this.snapshot(), rounded = Math.round(value / SAVE_RULES.volumeStep) * SAVE_RULES.volumeStep;
    const volume = Math.max(0, Math.min(SAVE_RULES.volumeMax, rounded)); if (next.volume[row] === volume) return null;
    next.volume[row] = volume; return { type: 'change', settings: next };
  }
  /** The touch page's actions: cycle or step each value, open the layout editor, Back to the main page. */
  private touchAction(action: HomePanelAction): SettingsCommand | null {
    const S = U.settings, rows = S.touchRows;
    const back = (): null => { this.touchOpen = false; this.cursor = this.savedCursor; return null; };
    if (action === 'back') return back();
    if (action === 'up') this.select(this.cursor - 1);
    if (action === 'down') this.select(this.cursor + 1);
    const row = rows[this.cursor], delta = action === 'left' ? -1 : action === 'right' ? 1 : 0, next = this.snapshot(), t = next.touch;
    if (action !== 'confirm' && !delta) return null;
    const step = delta || 1;
    if (row === 'tback') return action === 'confirm' ? back() : null;
    if (row === 'layout') return action === 'confirm' ? { type: 'layout' } : null;
    if (row === 'mode') { const modes = ['auto', 'on', 'off'] as const; t.mode = modes[(modes.indexOf(t.mode) + step + modes.length) % modes.length]; }
    else if (row === 'opacity') { const v = Math.max(TOUCH.opacityMin, Math.min(TOUCH.opacityMax, t.opacity + step * S.opacityStep)); if (v === t.opacity) return null; t.opacity = v; }
    else if (row === 'size') { const v = Math.max(TOUCH.sizeMin, Math.min(TOUCH.sizeMax, t.size + step * S.sizeStep)); if (v === t.size) return null; t.size = v; }
    else if (row === 'hand') t.leftHanded = !t.leftHanded;
    else if (row === 'vibe') t.vibration = !t.vibration;
    else if (row === 'effects') t.effects = effectsLevel(t, isTouchDevice()) === 'high' ? 'low' : 'high';
    return { type: 'change', settings: next };
  }
  /** The Assist page: step each option; Back returns to the main page. */
  private assistAction(action: HomePanelAction): SettingsCommand | null {
    const back = (): null => { this.assistOpen = false; this.cursor = this.savedCursor; return null; };
    if (action === 'back') return back();
    if (action === 'up') this.select(this.cursor - 1);
    if (action === 'down') this.select(this.cursor + 1);
    const row = U.settings.assistRows[this.cursor], delta = action === 'left' ? -1 : action === 'right' ? 1 : 0;
    if (action !== 'confirm' && !delta) return null;
    if (row === 'aback') return action === 'confirm' ? back() : null;
    const next = this.snapshot(), a = next.assist, step = delta || 1;
    const cycle = <T>(list: readonly T[], v: T): T => list[(list.indexOf(v) + step + list.length) % list.length];
    if (row === 'speed') a.speed = cycle(ASSIST.speeds, a.speed);
    else if (row === 'damage') a.damageTaken = cycle(ASSIST.damage, a.damageTaken);
    else if (row === 'flask') a.extraFlask = !a.extraFlask;
    else a.longerDoors = !a.longerDoors;
    return { type: 'change', settings: next };
  }
  /** Controls page navigation (captures are fed through `capturedKey` / `capturedPad`). */
  private controlsAction(action: HomePanelAction, now = 0): SettingsCommand | null {
    const c = this.controls;
    if (c.capture) return null;
    if (action === 'back') { this.controlsOpen = false; return null; }
    if (action === 'backspace') return this.clearCell(now);
    if (action !== 'confirm') { c.move(action); return null; }
    if (c.row === ACTIONS.length) { const next = this.snapshot(); next.bindings = structuredClone(defaultSettings().bindings); return { type: 'change', settings: next }; }
    if (c.row === ACTIONS.length + 1) { this.controlsOpen = false; return null; }
    if (!isFixed(c.action!, c.col)) c.capture = { action: c.action!, col: c.col, since: now || -1 };   // -1: the next tick starts its clock
    return null;
  }
  /** The open capture got a keyboard key (Escape cancels). */
  capturedKey(code: string, now: number): SettingsCommand | null {
    const c = this.controls, cap = c.capture; if (!cap) return null;
    if (code === 'Escape') { c.capture = null; return null; }
    if (cap.col === 2 || !canCaptureKey(code)) return null;                 // ignored; keep waiting
    const b = bindKey(this.snapshot().bindings, cap.action, cap.col, code);
    if (!b) { c.refuse(now); return null; }
    c.capture = null; const next = this.snapshot(); next.bindings = b; return { type: 'change', settings: next };
  }
  /** The open capture got a pad button (Start cancels). */
  capturedPad(button: number, now: number): SettingsCommand | null {
    const c = this.controls, cap = c.capture; if (!cap) return null;
    if (button === 9) { c.capture = null; return null; }
    if (cap.col !== 2 || !canCapturePad(button)) return null;
    const b = bindPad(this.snapshot().bindings, cap.action, button);
    if (!b) { c.refuse(now); return null; }
    c.capture = null; const next = this.snapshot(); next.bindings = b; return { type: 'change', settings: next };
  }
  /** Delete / Backspace / pad X empties a keyboard cell (07 §7.8). */
  clearCell(now: number): SettingsCommand | null {
    const c = this.controls; if (!c.action || c.col === 2) return null;
    const b = clearKey(this.snapshot().bindings, c.action, c.col);
    if (!b) { c.capture = { action: c.action, col: c.col, since: now }; c.refuse(now); return null; }
    const next = this.snapshot(); next.bindings = b; return { type: 'change', settings: next };
  }
  /** 5 s without a press cancels a capture. */
  tick(now: number): void {
    const cap = this.controls.capture; if (!cap) return;
    if (cap.since < 0) cap.since = now; else if (now - cap.since >= U.settings.controls.captureS) this.controls.capture = null;
  }
  action(action: HomePanelAction): SettingsCommand | null {
    if (this.controlsOpen) return this.controlsAction(action);
    if (this.touchOpen) return this.touchAction(action);
    if (this.assistOpen) return this.assistAction(action);
    if (action === 'back') return { type: 'close' };
    if (action === 'up') this.select(this.cursor - 1); if (action === 'down') this.select(this.cursor + 1);
    const row = this.rows[this.cursor] as typeof U.settings.rows[number], delta = action === 'left' ? -1 : action === 'right' ? 1 : 0, next = this.snapshot();
    if ((row === 'master' || row === 'sfx') && delta) return this.setVolume(next.volume[row] + delta * SAVE_RULES.volumeStep);
    const booleanKey = row === 'timer' ? 'showTimer' : row === 'shake' ? 'screenShake' : null;
    if (booleanKey && (delta || action === 'confirm')) {
      const value = !next[booleanKey];
      if (value === next[booleanKey]) return null; next[booleanKey] = value; return { type: 'change', settings: next };
    }
    if (row === 'icons' && (delta || action === 'confirm')) {
      const at = U.settings.styles.indexOf(next.promptStyle), value = U.settings.styles[Math.max(0, Math.min(U.settings.styles.length - 1, at + (delta || 1)))];
      if (value === next.promptStyle) return null; next.promptStyle = value; return { type: 'change', settings: next };
    }
    if (action !== 'confirm') return null;
    if (row === 'controls') { this.controlsOpen = true; return null; }
    if (row === 'hud') return { type: 'hudLayout' };
    if (row === 'assist') { this.assistOpen = true; this.savedCursor = this.cursor; this.cursor = 0; return null; }
    if (row === 'touch') { this.touchOpen = true; this.savedCursor = this.cursor; this.cursor = 0; return null; }
    if (row === 'export' || row === 'import' || row === 'fullscreen') return { type: row };
    return row === 'back' ? { type: 'close' } : null;
  }
}

export class SettingsView extends MenuSurface {
  readonly model: SettingsModel;
  private readonly callbacks: SettingsCallbacks;
  constructor(scene: Phaser.Scene, getSettings: () => SettingsData, callbacks: SettingsCallbacks) { super(scene); this.model = new SettingsModel(getSettings); this.callbacks = callbacks; this.render(); }
  private dispatch(command: SettingsCommand | null): void {
    if (!command) return;
    if (command.type === 'change') this.callbacks.onChange(command.settings);
    else if (command.type === 'export') this.callbacks.onExport();
    else if (command.type === 'import') this.callbacks.onImport();
    else if (command.type === 'fullscreen') this.callbacks.onFullscreen();
    else if (command.type === 'layout') { this.destroy(); this.callbacks.onEditLayout?.(); }
    else if (command.type === 'hudLayout') { this.destroy(); this.callbacks.onEditHud?.(); }
    else { this.destroy(); this.callbacks.onClose(); }
  }
  action(action: HomePanelAction): void { if (!this.enabled || this.closed) return; this.dispatch(this.model.action(action)); this.render(); }
  protected render(): void {
    const m = this.model, settings = m.snapshot(), glyph = menuGlyphs(), c = m.controls, now = this.now(), blink = c.capture ? Math.floor(now * 3) % 2 : 0;
    if (!this.beginDraw([m.cursor, m.controlsOpen, m.touchOpen, settings, glyph, c.row, c.col, c.capture, c.flash && c.flash.until > now, blink])) return;
    const S = U.settings; if (!m.controlsOpen) this.panel(S.panel); this.text(this.scene.scale.width / 2, S.titleY, m.controlsOpen ? '' : m.touchOpen ? 'TOUCH CONTROLS' : m.assistOpen ? 'ASSIST' : 'SETTINGS', UI_COLOR.text, true);
    if (m.controlsOpen) { this.renderControls(m, settings); return; }
    if (m.touchOpen) { this.renderTouch(m, settings); return; }
    if (m.assistOpen) { this.renderAssist(m, settings); return; }
    (m.rows as readonly (typeof S.rows[number])[]).forEach((id, i) => {
      const y = S.rowsY + i * S.rowH, selected = m.cursor === i;
      if (selected) this.text(S.labelX - U.cursorGap, y, '▸', UI_COLOR.highlight);
      this.text(S.labelX, y, S.labels[id], selected ? UI_COLOR.highlight : UI_COLOR.text, false, 'left');
      this.target(S.labelX - U.cursorGap, y, S.rowW, S.rowH, () => m.select(i), () => this.action('confirm'));
      if (id === 'master' || id === 'sfx') {
        const value = settings.volume[id];
        this.text(S.valueX, y, String(value), selected ? UI_COLOR.highlight : UI_COLOR.text, false, 'right');
        for (let cell = 0; cell < S.volumeCells; cell++) {
          const x = S.barX + cell * (S.cell + S.cellGap); this.rect(x, y + S.barY, S.cell, S.cell, false, cell < value / SAVE_RULES.volumeStep ? UI_COLOR.highlight : UI_COLOR.textOff);
          this.target(x, y, S.cell + S.cellGap, S.rowH, () => m.select(i), () => { this.dispatch(m.setVolume((cell + 1) * SAVE_RULES.volumeStep)); });
        }
        for (const [x, action, label] of [[S.minusX, 'left', '−'], [S.plusX, 'right', '+']] as const) {
          this.text(x, y, label, selected ? UI_COLOR.highlight : UI_COLOR.textDim);
          this.target(x - S.stepW / 2, y, S.stepW, S.rowH, () => m.select(i), () => this.action(action));
        }
      } else {
        const value = id === 'timer' ? settings.showTimer ? 'On' : 'Off' : id === 'shake' ? settings.screenShake ? 'On' : 'Off'
          : id === 'icons' ? S.styleNames[S.styles.indexOf(settings.promptStyle)] : '';
        this.text(S.valueX, y, value, selected ? UI_COLOR.highlight : UI_COLOR.textDim, false, 'right');
      }
    });
    this.hint(this.scene.scale.width / 2, S.hintY, ['↑↓ Select   ←→ Change   ', { menu: 'confirm' }, ' Choose   ', { menu: 'back' }, ' Back']);
  }
  private now(): number { return this.scene.time.now / 1000; }
  /** Raw keys while the Controls page captures (07 §7.8), and Delete/Backspace to clear a cell. */
  protected override allowKey(e: KeyboardEvent): boolean {
    const m = this.model;
    if (!m.controlsOpen) return true;
    if (m.controls.capture) { e.preventDefault(); if (!e.repeat) { this.dispatch(m.capturedKey(e.code, this.now())); this.render(); } return false; }
    if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); if (!e.repeat) { this.dispatch(m.clearCell(this.now())); this.render(); } return false; }
    return true;
  }
  private padDown = new Set<number>();
  override update(seconds: number, pad?: Parameters<MenuSurface['update']>[1]): void {
    const m = this.model, now = this.now();
    m.tick(now);
    const p = (navigator.getGamepads?.() ?? []).find((g): g is Gamepad => !!g?.connected) ?? null;
    const pressed = new Set<number>(); p?.buttons.forEach((b, i) => { if (b.pressed) pressed.add(i); });
    const fresh = [...pressed].filter((i) => !this.padDown.has(i)); this.padDown = pressed;
    if (m.controlsOpen && m.controls.capture) { for (const i of fresh) this.dispatch(m.capturedPad(i, now)); this.render(); return; }
    if (m.controlsOpen && fresh.includes(2)) this.dispatch(m.clearCell(now));          // pad X clears a keyboard cell
    super.update(seconds, pad);
    if (m.controlsOpen) this.render();
  }
  /** The Controls page (07 §7.8). */
  private renderControls(m: SettingsModel, settings: SettingsData): void {
    const C = U.settings.controls, c = m.controls, now = this.now(), mid = this.scene.scale.width / 2;
    this.panel(C.panel); this.text(mid, C.titleY, 'CONTROLS', UI_COLOR.text, true);
    C.heads.forEach((h, i) => this.text(C.colXs[i], C.headY, h, UI_COLOR.textDim));
    const style = shownPromptStyle() === 'playstation' ? 'playstation' : 'xbox';
    ACTIONS.forEach((id, r) => {
      const y = C.rowsY + r * C.rowH;
      this.text(C.nameX, y, U.settings.controlNames[id], c.row === r ? UI_COLOR.highlight : UI_COLOR.text, false, 'left');
      ([0, 1, 2] as const).forEach((col) => {
        const x = C.colXs[col], fixed = isFixed(id, col), sel = c.row === r && c.col === col;
        const capturing = c.capture?.action === id && c.capture.col === col, flashed = c.flash && c.flash.action === id && c.flash.col === col && c.flash.until > now;
        if (sel || flashed) this.rect(x - C.cellW / 2, y - 2, C.cellW, C.rowH, sel, flashed ? UI_COLOR.bad : UI_COLOR.ink);
        let label: string, color: number = fixed ? UI_COLOR.textDim : sel ? UI_COLOR.highlight : UI_COLOR.text;
        if (capturing) { label = Math.floor(now * 3) % 2 ? '' : col === 2 ? 'Press a button…' : 'Press a key…'; color = UI_COLOR.highlight; }
        else if (col === 2) {
          const pad = settings.bindings.gamepad[id];
          if (pad === null || fixed) label = id === 'pause' ? 'Start' : 'D-pad / L-stick';
          else { const g = new PromptGlyph(this.scene, 0, y, { style, label: PROMPT[style][pad], button: pad }); g.container.setPosition(x, y); this.c.add(g.container); label = ''; }
        } else { const k = settings.bindings.keyboard[id][col]; label = k ? keyLabel(k, true) : '—'; }
        if (label) this.text(x, y, label, color).setMaxWidth(C.cellW);
        if (!fixed) this.target(x - C.cellW / 2, y - 2, C.cellW, C.rowH, () => { c.row = r; c.col = col; }, () => this.action('confirm'));
      });
    });
    ([[ACTIONS.length, C.resetY, 'Reset to defaults'], [ACTIONS.length + 1, C.backY, 'Back']] as const).forEach(([r, y, label]) => {
      const sel = c.row === r;
      this.text(mid, y, `${sel ? '▸ ' : ''}${label}`, sel ? UI_COLOR.highlight : UI_COLOR.text);
      this.target(mid - 80, y - 2, 160, C.rowH, () => { c.row = r; }, () => this.action('confirm'));
    });
    this.hint(mid, C.hintY, c.capture ? ['Press the new ', c.capture.col === 2 ? 'button   ' : 'key   ', 'ESC / Start cancels'] : ['↑↓←→ Select   ', { menu: 'confirm' }, ' Change   DEL Clear   ', { menu: 'back' }, ' Back']);
  }

  /** The touch page: one row per setting, `< value >` on the selected one (taps pick a row; < > step it). */
  private renderAssist(m: SettingsModel, settings: SettingsData): void {
    const S = U.settings, a = settings.assist, mid = this.scene.scale.width / 2, pct = (v: number) => `${Math.round(v * 100)}%`;
    const value: Record<string, string> = { speed: pct(a.speed), damage: pct(a.damageTaken), flask: a.extraFlask ? 'On' : 'Off', doors: a.longerDoors ? 'On' : 'Off', aback: '' };
    S.assistRows.forEach((id, i) => {
      const y = S.rowsY + i * S.rowH, selected = m.cursor === i;
      if (selected) this.text(S.labelX - U.cursorGap, y, '▸', UI_COLOR.highlight);
      this.text(S.labelX, y, S.assistLabels[id], selected ? UI_COLOR.highlight : UI_COLOR.text, false, 'left');
      this.target(S.labelX - U.cursorGap, y, S.rowW - 60, S.rowH, () => m.select(i), () => this.action('confirm'));
      if (value[id]) {
        this.text(S.valueX, y, selected ? `< ${value[id]} >` : value[id], selected ? UI_COLOR.highlight : UI_COLOR.textDim, false, 'right');
        this.target(S.valueX - 70, y, 36, S.rowH, () => m.select(i), () => this.action('left'));
        this.target(S.valueX - 34, y, 34, S.rowH, () => m.select(i), () => this.action('right'));
      }
    });
    S.assistNote.forEach((line, i) => this.text(mid, S.assistNoteY + i * 14, line, UI_COLOR.textDim));
    this.hint(mid, S.hintY, ['↑↓ Select   ←→ Change   ', { menu: 'confirm' }, ' Choose   ', { menu: 'back' }, ' Back']);
  }
  private renderTouch(m: SettingsModel, settings: SettingsData): void {
    const S = U.settings, t = settings.touch, mid = this.scene.scale.width / 2;
    const value: Record<TouchRow, string> = {
      mode: S.modeNames[t.mode], opacity: `${t.opacity}%`, size: `${t.size}%`, hand: t.leftHanded ? 'On' : 'Off', vibe: t.vibration ? 'On' : 'Off',
      effects: effectsLevel(t, isTouchDevice()) === 'high' ? 'High' : 'Low', layout: '', tback: '',
    };
    S.touchRows.forEach((id, i) => {
      const y = S.rowsY + i * S.rowH, selected = m.cursor === i;
      if (selected) this.text(S.labelX - U.cursorGap, y, '▸', UI_COLOR.highlight);
      this.text(S.labelX, y, S.touchLabels[id], selected ? UI_COLOR.highlight : UI_COLOR.text, false, 'left');
      this.target(S.labelX - U.cursorGap, y, S.rowW - 60, S.rowH, () => m.select(i), () => this.action('confirm'));
      if (value[id]) this.text(S.valueX, y, selected ? `< ${value[id]} >` : value[id], selected ? UI_COLOR.highlight : UI_COLOR.textDim, false, 'right');
      if (value[id]) {
        // Tap targets for the step arrows (the whole value is also a "next" tap).
        this.target(S.valueX - 70, y, 36, S.rowH, () => m.select(i), () => this.action('left'));
        this.target(S.valueX - 34, y, 34, S.rowH, () => m.select(i), () => this.action('right'));
      }
    });
    this.hint(mid, S.hintY, ['↑↓ Select   ←→ Change   ', { menu: 'confirm' }, ' Choose   ', { menu: 'back' }, ' Back']);
  }
}
