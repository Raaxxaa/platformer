// Touch control numbers (07 §8.6). Sizes are in units `u` (CSS px, see unitOf); `right`/`bottom` are the circle's
// center measured from the screen's right/bottom edge (Pause: from the top).
import type { TouchSettings } from '../core/save/schema.ts';
export const defaultTouchSettings = (): TouchSettings => ({ mode: 'auto', opacity: 55, size: 100, leftHanded: false, vibration: true, effects: null, layout: {} });

export const TOUCH = {
  uDiv: 7.5, uMin: 40, uMax: 72, stickZone: 0.45, stickRadius: 1.1, stickX: 0.35, stickY: 0.5, hitGrow: 0.15,
  opacityDefault: 55, opacityMin: 20, opacityMax: 100, sizeMin: 80, sizeMax: 130, scaleMin: 0.6, scaleMax: 1.5,
  restartHoldMs: 500, stickHint: [1.6, 1.6] as const, backArrow: 0.75,
  vibration: { hit: 12, death: 25, parry: 8 },
  buttonIds: ['jump', 'attack1', 'dash', 'attack2', 'ability1', 'ability2', 'heal', 'interact', 'pause'] as const,
  buttons: [
    { id: 'jump', d: 1.45, right: 1.0, bottom: 1.0, top: false },
    { id: 'attack1', d: 1.25, right: 2.55, bottom: 0.85, top: false },
    { id: 'dash', d: 1.05, right: 1.1, bottom: 2.5, top: false },
    { id: 'attack2', d: 1.05, right: 2.6, bottom: 2.3, top: false },
    { id: 'ability1', d: 0.95, right: 3.95, bottom: 1.25, top: false },
    { id: 'ability2', d: 0.95, right: 3.85, bottom: 2.6, top: false },
    { id: 'heal', d: 0.85, right: 2.35, bottom: 3.6, top: false },
    { id: 'interact', d: 1.0, right: 5.2, bottom: 1.2, top: false },
    { id: 'pause', d: 0.75, right: 0.7, bottom: 0.7, top: true },
  ] as const,
} as const;
