// The one TouchModel the page shares: the DOM overlay feeds it pointers, Devices feeds its events to the input latch.
import { TouchModel } from './touchModel.ts';
import type { TouchOverlay } from './TouchOverlay.ts';
export const touchModel = new TouchModel();
let overlay: TouchOverlay | null = null;
/** main.ts registers the overlay; scenes find it here (tests and Node have none). */
export const setTouchOverlay = (o: TouchOverlay | null): void => { overlay = o; };
export const getTouchOverlay = (): TouchOverlay | null => overlay;
