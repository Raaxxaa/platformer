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

/** Training Yard view (06 §12.4): check flags, the board panel, the pit fade. */
export const YARD_UI = {
  flagPole: 22, flagW: 10, flagH: 7,             // px
  flagTodo: 0x8a8a8a, flagDone: 0x6be36b, pole: 0x5a4632,
  boardRange: 40,                                // px from the board's x: the checklist panel shows
  panelPad: 6, panelLine: 10,
  iconLift: 4,                                   // px between a stand's top and the item icon
} as const;

/** 07 §4.1 slot HUD layout (640 × 360) and §4.8–4.10, §6.10 timings (seconds). */
export const SLOT_LAYOUT = {
  boxY: 320, box: 24, weaponX: [8, 36], abilityX: [72, 100], linkBarY: 318, promptY: 307,
  classIconY: 346, classIcon: 8, pipY: 347, pip: 4, pipW: 3, pipH: 2, pips: 5,
  classX: 8, classY: 285, class2Y: 296, bondX: 18,
  hammerBarY: 20, chargeDigit: [17, 14], barX: 2, barH: 2,
  flashUsed: 0.08, flashCharge: 0.1, flashNotReady: 0.15, flashFizzle: 0.2, fizzleLabel: 0.8, fizzleLift: 4,
  flashClass: 0.3, linkRise: 12, linkRiseS: 0.5, swapBlinkHz: 4, iconOutAlpha: 0.35, shadeAlpha: 0.7,
  toastRight: 632, toastBottom: 352, toastGap: 2, toastMaxW: 144, toastMax: 4, toastS: 3.0, toastFadeS: 0.3,
  dpsLift: 14,
} as const;

/** Grey-box ability visuals (M4 Task 15): how long each trace stays, in seconds; alphas. */
export const ABILITY_FX = {
  boxS: 0.15, trailS: 0.15, trailEvery: 3, blinkS: 0.15, blinkR: 12, chainS: 0.15,
  boxAlpha: 0.35, zoneAlpha: 0.15, trailAlpha: 0.45, rainLines: 6, rainLen: 10, rainSpeed: 4, markLift: 26,       // the mark sits above the DPS readout
} as const;
