// M15 (06 §14.1): Share copies the text; on phones the share sheet is used when the browser has one.
import { isTouchDevice } from '../game/zoom.ts';

export let lastShared: string | null = null;
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  lastShared = text;
  const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
  try {
    if (nav.share && isTouchDevice()) { await nav.share({ text }); return 'shared'; }
  } catch { /* cancelled or blocked: fall back to the clipboard */ }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}
