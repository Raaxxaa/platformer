// Review C3: keep the save. Ask the browser not to clear it (navigator.storage.persist, once), and inside the
// Capacitor app also mirror it into Capacitor Preferences, read back at launch when localStorage is empty.
import { Preferences } from '@capacitor/preferences';
import { isNativeApp } from '../../ui/touch/pwa.ts';

let asked = false;
/** After every write: the first one asks for persistent storage; in the app, the text is mirrored. */
export function afterSaveWrite(key: string, text: string): void {
  if (!asked) {
    asked = true;
    try { void navigator.storage?.persist?.().catch(() => {}); } catch { /* not available */ }
  }
  if (isNativeApp()) void Preferences.set({ key, value: text }).catch(() => {});
}
/** At launch, in the app only: an empty localStorage is refilled from the mirror (iOS can clear web storage). */
export async function restoreNativeSave(key: string, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    if (storage.getItem(key) !== null) return false;
    const { value } = await Preferences.get({ key });
    if (value === null) return false;
    storage.setItem(key, value); return true;
  } catch { return false; }
}
