// The only localStorage boundary (06 §15). Pure validation and portable codes live in core/save.
import { defaultSave, type SaveData } from '../../core/save/schema.ts';
import { migrateSave, NewerSaveVersionError } from '../../core/save/migrate.ts';
import { validateSave } from '../../core/save/validate.ts';
import { decodeSave, encodeSave } from '../../core/save/codec.ts';
export interface SaveStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const SAVE_KEY = 'rushblade.save';
/** Dates belong to the browser save layer, never the deterministic core. */
export const saveDate = (): string => new Date().toISOString();
const parse = (text: string): SaveData => validateSave(migrateSave(JSON.parse(text)));
export class SaveStore {
  data = defaultSave();
  readOnly = false;
  warning: string | null = null;
  private warningShown = false;
  private storage: SaveStorage | null = null;
  constructor(storage?: SaveStorage) {
    try {
      this.storage = storage ?? window.localStorage;
      const text = this.storage.getItem(SAVE_KEY);
      if (text === null) return;
      try { this.data = parse(text); return; } catch (error) { if (this.newer(error)) return; }
      const backup = this.storage.getItem(`${SAVE_KEY}.bak`);
      if (backup !== null) {
        try { this.data = parse(backup); return; } catch (error) { if (this.newer(error)) return; }
      }
      this.storage.setItem(`${SAVE_KEY}.corrupt`, text);
    } catch { this.fail(); }
  }
  private newer(error: unknown): boolean {
    if (!(error instanceof NewerSaveVersionError)) return false;
    this.readOnly = true; this.warning = 'This save is from a newer version'; return true;
  }
  private fail(): void { this.storage = null; this.warning = "Can't save — progress won't be kept"; }
  takeWarning(): string | null {
    if (!this.warning || this.warningShown) return null;
    this.warningShown = true; return this.warning;
  }
  private write(): void {
    if (!this.storage || this.readOnly) return;
    try {
      const previous = this.storage.getItem(SAVE_KEY);
      if (previous !== null) {
        let valid = true;
        try { parse(previous); } catch (error) { if (this.newer(error)) return; valid = false; }
        // Preserve the last good backup if a recovered malformed main still cannot be replaced.
        if (valid) this.storage.setItem(`${SAVE_KEY}.bak`, previous);
      }
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch { this.fail(); }
  }
  update(change: (save: SaveData) => void): void { change(this.data); this.write(); }
  exportCode(): string { return encodeSave(this.data); }
  previewImport(code: string): SaveData { return decodeSave(code); }
  /** Called only after the visible replace confirmation. A newer save is never overwritten. */
  replace(imported: SaveData): boolean {
    if (this.readOnly) return false;
    let next: SaveData;
    try { next = validateSave(migrateSave(imported)); } catch { return false; }
    this.data = next; this.write(); return true;
  }
}
let currentStore: SaveStore | null = null;
export function saveStore(): SaveStore { return currentStore ??= new SaveStore(); }
