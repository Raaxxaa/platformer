// The look the game draws (09 §7): the saved look, or the wardrobe's unsaved preview while it is open.
import type { Look } from '../../data/cosmetics.ts';
import { saveStore } from '../save/storage.ts';

let preview: Look | null = null;
export const getLook = (): Look => preview ?? saveStore().data.look;
/** The wardrobe shows changes live on the world player before Confirm; `null` goes back to the saved look. */
export const setPreviewLook = (l: Look | null): void => { preview = l; };
