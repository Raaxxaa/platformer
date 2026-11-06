// The HUD layout editor's live draft (07 §4.1a): while it is open the game draws the HUD there instead of the saved places.
import type { HudLayout } from '../model/hudLayout.ts';

let draft: HudLayout | null = null;
export const hudDraft = (): HudLayout | null => draft;
export const setHudDraft = (l: HudLayout | null): void => { draft = l; };
