// 07 §4.1a HUD groups (M17): each group's §4.1 box (where its parts were drawn before M17) and its new default place.
export type HudGroupId = 'vitals' | 'slots' | 'timer';
export interface Box { x: number; y: number; w: number; h: number }
export const HUD_GROUPS: readonly HudGroupId[] = ['vitals', 'slots', 'timer'];
export const HUD_LAYOUT = {
  /** Where each group's parts are drawn by their own code (the §4.1 layout); a group is moved by its offset from here. */
  home: { vitals: { x: 4, y: 4, w: 216, h: 72 }, slots: { x: 4, y: 280, w: 128, h: 76 }, timer: { x: 472, y: 8, w: 160, h: 44 } } as Record<HudGroupId, Box>,
  defaults: { vitals: { x: 4, y: 4 }, slots: { x: 504, y: 4 }, timer: { x: 472, y: 300 } } as Record<HudGroupId, { x: number; y: number }>,
  /** With the touch overlay the timer sits top-center (box centered on x 320 at y 8). */
  touchTimer: { x: 240, y: 8 },
  screen: { w: 640, h: 360 },
  /** SPEC-GAP 59: the safe margin is 4 px (the defaults sit at 4) and the boss-bar zone 320 × 40 at bottom center ends at x 472. */
  margin: 4, bossZone: { x: 160, y: 320, w: 312, h: 40 } as Box,
  step: 4,
  toast: { x: 8, bottom: 352 },
  editor: { depth: 1700, outline: 1, labelY: 2, toolbarY: 160, buttonW: 64, buttonH: 16, gap: 4 },
  presets: ['Top-left', 'Top-center', 'Top-right', 'Bottom-left', 'Bottom-right'] as const,
} as const;
