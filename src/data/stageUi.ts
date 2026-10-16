// Stage scene drawing numbers (M3 placeholders until the real HUD, 07).
export const STAGE_UI = {
  marker: 12,                       // px, grey loot marker box
  markerColor: 0x8a8a8a,
  door: 0x6b4a2c, doorActive: 0x4a3220, doorOpen: 0x5aa860, doorMissed: 0xa04040,
  arrowLen: 20,
  rockMarker: 0xff4040,
  hintBottom: 16,                   // px from the bottom edge
  splitSeconds: 3,
  bossBarW: 300, bossBarH: 4, bossBarY: 24,
  overviewAbove: 18, overviewBelow: 4,      // tiles above / below the main path in a section overview
} as const;
