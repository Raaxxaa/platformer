// Settings for built features. Controls are a current-binding view until M10.
import type Phaser from 'phaser';
import type { ActionId, SettingsData } from '../../core/save/schema.ts';
import { MENU_UI as U } from '../../data/menuUi.ts';
import { SAVE_RULES } from '../../data/save.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import { PROMPT } from '../../data/prompts.ts';
import type { HomePanelAction } from '../home/homePanels.ts';
import { MenuSurface } from './records.ts';
import { keyLabel, menuGlyphs, shownPromptStyle } from '../inputSettings.ts';
import { PromptGlyph } from '../hud/abilityHud.ts';

export type SettingsRow = typeof U.settings.rows[number];
export type SettingsCommand = { type: 'change'; settings: SettingsData } | { type: 'export' | 'import' | 'fullscreen' | 'close' };
export interface SettingsCallbacks { onChange(settings: SettingsData): void; onExport(): void; onImport(): void; onFullscreen(): void; onClose(): void }
export class SettingsModel {
  readonly rows = U.settings.rows;
  cursor = 0;
  controlsOpen = false;
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
  action(action: HomePanelAction): SettingsCommand | null {
    if (this.controlsOpen) { if (action === 'back' || action === 'confirm') this.controlsOpen = false; return null; }
    if (action === 'back') return { type: 'close' };
    if (action === 'up') this.select(this.cursor - 1); if (action === 'down') this.select(this.cursor + 1);
    const row = this.rows[this.cursor], delta = action === 'left' ? -1 : action === 'right' ? 1 : 0, next = this.snapshot();
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
    else { this.destroy(); this.callbacks.onClose(); }
  }
  action(action: HomePanelAction): void { if (!this.enabled || this.closed) return; this.dispatch(this.model.action(action)); this.render(); }
  protected render(): void {
    const m = this.model, settings = m.snapshot(), glyph = menuGlyphs(); if (!this.beginDraw([m.cursor, m.controlsOpen, settings, glyph])) return;
    const S = U.settings; this.panel(S.panel); this.text(this.scene.scale.width / 2, S.titleY, m.controlsOpen ? 'CONTROLS · READ ONLY' : 'SETTINGS', UI_COLOR.text, true);
    if (m.controlsOpen) {
      (Object.keys(S.controlNames) as ActionId[]).forEach((id, i) => {
        const y = S.controlsRowsY + i * S.controlsRowH, keys = settings.bindings.keyboard[id].filter((key) => key !== null).map((key) => keyLabel(key)).join(' / '), pad = settings.bindings.gamepad[id];
        this.text(S.labelX, y, S.controlNames[id], UI_COLOR.text, false, 'left');
        if (pad === null) this.text(S.valueX, y, `${keys} · D-pad / L-stick`, UI_COLOR.textDim, false, 'right');
        else {
          const style = shownPromptStyle() === 'playstation' ? 'playstation' : 'xbox', prompt = new PromptGlyph(this.scene, 0, y, { style, label: PROMPT[style][pad], button: pad });
          prompt.container.setPosition(S.valueX - prompt.width / 2, y); this.c.add(prompt.container);
          this.text(S.valueX - prompt.width - U.cursorGap, y, keys, UI_COLOR.textDim, false, 'right');
        }
      });
      this.text(this.scene.scale.width / 2, S.controlsBackY, '▸ Back', UI_COLOR.highlight);
      this.target(S.labelX, S.controlsBackY, S.rowW, S.rowH, () => {}, () => this.action('back')); return;
    }
    m.rows.forEach((id, i) => {
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
}
