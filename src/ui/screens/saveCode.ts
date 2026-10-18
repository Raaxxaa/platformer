// Portable code editing and explicit replacement confirmation (07 §7.9).
import type Phaser from 'phaser';
import type { SaveData } from '../../core/save/schema.ts';
import { MENU_UI as U } from '../../data/menuUi.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import type { HomePanelAction, HomePanelPad } from '../home/homePanels.ts';
import { activeHomePad } from '../home/homePanels.ts';
import { MenuSurface } from './records.ts';

export type SaveCodeMode = 'export' | 'import';
export type SaveCodeCommand = { type: 'copy' | 'close' } | { type: 'apply'; data: SaveData };
export interface SaveCodeCallbacks {
  exportCode: string; preview(code: string): SaveData; confirm(data: SaveData): boolean; onClose(): void; onApplied?(): void; onFocus?(focused: boolean): void;
}
export class SaveCodeModel {
  readonly mode: SaveCodeMode;
  code: string;
  cursor = 0;
  confirming = false;
  error = '';
  notice = '';
  private candidate: SaveData | null = null;
  private closed = false;
  constructor(mode: SaveCodeMode, exportCode: string) { this.mode = mode; this.code = mode === 'export' ? exportCode : ''; }
  get stage(): 'edit' | 'confirm' { return this.confirming ? 'confirm' : 'edit'; }
  get buttons(): readonly string[] { return this.confirming ? U.saveCode.confirmButtons : this.mode === 'export' ? U.saveCode.exportButtons : U.saveCode.importButtons; }
  setCode(value: string): void { if (this.mode === 'import' && value !== this.code) { this.code = value; this.confirming = false; this.candidate = null; this.error = ''; this.notice = ''; this.cursor = 0; } }
  select(index: number): void { this.cursor = Math.max(0, Math.min(this.buttons.length - 1, index)); }
  applied(ok: boolean): void { if (ok) this.closed = true; else this.error = U.saveCode.applyFailed; }
  action(action: HomePanelAction, preview: (code: string) => SaveData): SaveCodeCommand | null {
    if (this.closed) return null;
    if (action === 'left') this.select(this.cursor - 1); if (action === 'right') this.select(this.cursor + 1);
    if (action === 'back' || action === 'confirm' && this.cursor === 1) {
      if (this.confirming) { this.confirming = false; this.candidate = null; this.error = ''; this.cursor = 0; return null; }
      return { type: 'close' };
    }
    if (action !== 'confirm') return null;
    if (this.mode === 'export') return { type: 'copy' };
    if (this.confirming && this.candidate) return { type: 'apply', data: structuredClone(this.candidate) };
    try { this.candidate = structuredClone(preview(this.code)); this.confirming = true; this.error = ''; this.cursor = 0; }
    catch { this.error = U.saveCode.invalid; this.candidate = null; this.confirming = false; }
    return null;
  }
}

export class SaveCodeView extends MenuSurface {
  readonly model: SaveCodeModel;
  readonly textarea: HTMLTextAreaElement;
  private readonly callbacks: SaveCodeCallbacks;
  private focused = false;
  constructor(scene: Phaser.Scene, mode: SaveCodeMode, callbacks: SaveCodeCallbacks) {
    super(scene); this.callbacks = callbacks; this.model = new SaveCodeModel(mode, callbacks.exportCode);
    this.textarea = document.createElement('textarea'); this.textarea.value = this.model.code; this.textarea.readOnly = mode === 'export';
    this.textarea.setAttribute('aria-label', mode === 'export' ? 'Export save code' : 'Import save code');
    this.textarea.spellcheck = false;
    Object.assign(this.textarea.style, { position: 'fixed', boxSizing: 'border-box', resize: 'none', zIndex: String(U.domZ), fontFamily: 'monospace', background: `#${UI_COLOR.ink.toString(16).padStart(6, '0')}`, color: `#${UI_COLOR.text.toString(16).padStart(6, '0')}` });
    this.textarea.addEventListener('input', this.onInput); this.textarea.addEventListener('focus', this.onTextFocus); this.textarea.addEventListener('blur', this.onTextBlur); this.textarea.addEventListener('keydown', this.textKey);
    document.body.appendChild(this.textarea); window.addEventListener('resize', this.align); scene.scale.on('resize', this.align);
    this.align(); this.render(); this.textarea.focus(); if (mode === 'export') this.textarea.select();
  }
  private setFocused(value: boolean): void { if (this.focused === value) return; this.focused = value; this.input.blockHeldPad(activeHomePad()); this.callbacks.onFocus?.(value); }
  private readonly onTextFocus = () => this.setFocused(true);
  private readonly onTextBlur = () => this.setFocused(false);
  private readonly onInput = () => { this.model.setCode(this.textarea.value); this.render(); };
  private readonly textKey = (event: KeyboardEvent) => {
    event.stopPropagation(); if (event.code === 'Escape' && !event.repeat) { event.preventDefault(); this.action('back'); }
  };
  protected allowKey(_event: KeyboardEvent): boolean { return document.activeElement !== this.textarea; }
  private readonly align = () => {
    if (this.closed) return; const bounds = this.scene.game.canvas.getBoundingClientRect(), [x, y, w, h] = U.saveCode.textarea;
    const sx = bounds.width / this.scene.scale.width, sy = bounds.height / this.scene.scale.height;
    Object.assign(this.textarea.style, { left: `${bounds.left + x * sx}px`, top: `${bounds.top + y * sy}px`, width: `${w * sx}px`, height: `${h * sy}px`, fontSize: `${U.fontSize * sx}px` });
  };
  override setEnabled(on: boolean): void { super.setEnabled(on); this.textarea.disabled = !on; if (!on) this.textarea.blur(); }
  override update(seconds: number, pad: HomePanelPad | null = activeHomePad()): void {
    if (this.closed) return; this.align(); super.update(seconds, pad);
  }
  action(action: HomePanelAction): void {
    if (!this.enabled || this.closed) return;
    const wasConfirming = this.model.confirming, command = this.model.action(action, this.callbacks.preview);
    if (command?.type === 'close') { this.destroy(); this.callbacks.onClose(); return; }
    if (command?.type === 'copy') { void this.copy(); }
    if (command?.type === 'apply') {
      let ok = false; try { ok = this.callbacks.confirm(command.data); } catch { /* Keep the explicit confirmation open on failure. */ }
      this.model.applied(ok);
      if (ok) { this.destroy(); this.callbacks.onApplied?.(); this.callbacks.onClose(); return; }
    }
    if (wasConfirming !== this.model.confirming) {
      this.textarea.readOnly = this.model.confirming;
      this.input.blockHeldPad(activeHomePad());
      if (this.model.confirming) this.textarea.blur(); else this.textarea.focus();
    }
    this.render();
  }
  private async copy(): Promise<void> {
    try { await navigator.clipboard.writeText(this.model.code); if (!this.closed) { this.model.notice = U.saveCode.copied; this.model.error = ''; } }
    catch { if (!this.closed) this.model.error = U.saveCode.copyFailed; }
    this.render();
  }
  override destroy(): void {
    if (this.closed) return;
    this.textarea.removeEventListener('input', this.onInput); this.textarea.removeEventListener('focus', this.onTextFocus); this.textarea.removeEventListener('blur', this.onTextBlur); this.textarea.removeEventListener('keydown', this.textKey);
    window.removeEventListener('resize', this.align); this.scene.scale.off('resize', this.align); this.setFocused(false); this.textarea.remove(); super.destroy();
  }
  protected render(): void {
    const m = this.model; if (!this.beginDraw([m.cursor, m.confirming, m.error, m.notice])) return;
    const S = U.saveCode; this.panel(S.panel); this.text(this.scene.scale.width / 2, S.titleY, m.mode === 'export' ? 'EXPORT SAVE' : 'IMPORT SAVE', UI_COLOR.text, true);
    this.text(this.scene.scale.width / 2, S.statusY, m.error || (m.confirming ? S.warning : m.notice), m.error ? UI_COLOR.bad : m.confirming ? UI_COLOR.highlight : UI_COLOR.good);
    m.buttons.forEach((label, i) => {
      const x = S.buttonXs[i], selected = m.cursor === i;
      this.rect(x, S.buttonY, S.buttonW, S.buttonH, selected); this.text(x + S.buttonW / 2, S.buttonY + U.border, `${selected ? '▸ ' : ''}${label}`, selected ? UI_COLOR.highlight : UI_COLOR.text);
      this.target(x, S.buttonY, S.buttonW, S.buttonH, () => m.select(i), () => this.action('confirm'));
    });
  }
}
