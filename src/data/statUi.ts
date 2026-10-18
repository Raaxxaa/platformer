// Stat pick layout/input numbers (07 §6.11, §7.1). The simulation uses the guard in RUN.
import { STAT_PICK_DEFAULT_INDEX } from './economy.ts';
export const STAT_PICK_UI = {
  title: 'CHOOSE AN UPGRADE', titleY: 72, cardXs: [134, 262, 390], cardY: 110,
  cardW: 116, cardH: 120, selectedLift: 4, iconSize: 16, iconY: 8,
  nameY: 30, textY: 44, textW: 104, stackY: 106, hintY: 246,
  hint: '←→ Choose   [ENT] Pick', dimAlpha: 0.60, border: 1, depth: 1200,
  // Darkness covers the world, while the HUD remains bright.
  dimDepth: 89.5, defaultCursor: STAT_PICK_DEFAULT_INDEX, confirmSeconds: 0.30,
  repeatDelay: 0.35, repeatEvery: 0.10, stick: 0.5, frameClamp: 0.1, pauseDepth: 1400,
} as const;
