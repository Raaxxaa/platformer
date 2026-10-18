// The one save repository. Task 7 adds full entry validation/recovery and the portable code.
import { defaultSave, type SaveData } from '../../core/save/schema.ts';
import { STARTING_KITS } from '../../data/classes.ts';
import { SAVE_RULES } from '../../data/save.ts';
export interface SaveStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const SAVE_KEY = 'rushblade.save';
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
      if (!text) return;
      const raw = JSON.parse(text) as Partial<SaveData>;
      if (Number(raw.v) > this.data.v) { this.readOnly = true; this.warning = 'This save is from a newer version'; return; }
      if (raw.v !== SAVE_RULES.version) return;
      const merged = { ...this.data, ...raw };
      merged.progress = { ...this.data.progress, ...raw.progress };
      merged.unlocks = { ...this.data.unlocks, ...raw.unlocks };
      merged.stats = { ...this.data.stats, ...raw.stats };
      merged.settings = { ...this.data.settings, ...raw.settings };
      const kit = raw.lastKit;
      merged.lastKit = kit && STARTING_KITS[kit.cls]?.weapons.includes(kit.weapon) ? kit : null;
      merged.typedSeed = typeof raw.typedSeed === 'string' && raw.typedSeed.length <= SAVE_RULES.seedMaxLength && /^[A-Z0-9]+$/.test(raw.typedSeed) ? raw.typedSeed : null;
      merged.lastRoad = raw.lastRoad === 'forest' ? 'forest' : 'mountain';
      merged.training = Array.isArray(raw.training) ? raw.training.filter((n) => Number.isInteger(n) && n >= 1 && n <= SAVE_RULES.trainingStations) : [];
      this.data = merged;
    } catch { this.fail(); }
  }
  private fail(): void { this.storage = null; this.warning = "Can't save — progress won't be kept"; }
  takeWarning(): string | null {
    if (!this.warning || this.warningShown) return null;
    this.warningShown = true; return this.warning;
  }
  update(change: (save: SaveData) => void): void {
    change(this.data);
    if (!this.storage || this.readOnly) return;
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch { this.fail(); }
  }
}
let currentStore: SaveStore | null = null;
export function saveStore(): SaveStore { return currentStore ??= new SaveStore(); }
