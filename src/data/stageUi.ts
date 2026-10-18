/** UI animation frame cap (07 §1.3). */
export const UI_FRAME_SECONDS = 0.1;
// Stage scene drawing numbers (M3 placeholders until the real HUD, 07).
export const STAGE_UI = {
  marker: 12,                       // px, grey loot marker box
  markerColor: 0x8a8a8a,
  door: 0x6b4a2c, doorActive: 0x4a3220, doorOpen: 0x5aa860, doorMissed: 0xa04040,
  arrowLen: 20,
  rockMarker: 0xff4040,
  hintBottom: 16,                   // px from the bottom edge
  splitSeconds: 3,
  // 07 §4.11 timer block, §4.12 boss bar (bottom center), §6.9 alert line for splits.
  doorInfoRange: 640, doorInfoBadS: 5,
  timer: [632, 8], segment: [632, 27], info: [632, 38], alert: [320, 10],
  alertLineY: 28, alertMaxWidth: 248, alertGap: 4,
  bossName: [160, 321], bossTitleRight: 480, bossHp: [160, 332, 320, 10], bossPoise: [160, 343, 320, 4],
  overviewAbove: 18, overviewBelow: 4,      // tiles above / below the main path in a section overview
} as const;

/** Training Yard view (06 §12.4): check flags, the board panel, the pit fade. */
export const YARD_UI = {
  signDx: 10,                                    // px from the hint zone's left edge
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
  boxAlpha: 0.35, zoneAlpha: 0.15, trailAlpha: 0.45, rainLines: 6, rainLen: 10, rainSpeed: 4, markLift: 26, markLinkedAbove: 1.3,       // the mark sits above the DPS readout
} as const;

/** 07 §4.1 top-left HUD layout and §4.2–4.6 timings (seconds). */
export const TOP_HUD = {
  plate: [4, 4, 196, 48], plateBottom: [4, 280, 128, 76],
  heart: [8, 9], heartSize: 10, hpFrame: [20, 8, 160, 12], hpText: [184, 10],
  rushX: [8, 58, 108], rushY: 22, rushW: 48, rushH: 6,
  flaskIcon: [8, 30], flaskStep: 12, flaskIconSize: [10, 12], flaskBar: [8, 46, 46, 4],
  coin: [62, 34], gold: [72, 34], key: [104, 33], keyText: [113, 34],
  lagDelayS: 0.4, lagSpeed: 0.6, healFlashS: 0.25, lowFrac: 0.25, lowHz: 2, rush3Hz: 4, flaskFullHz: 2, drinkHz: 8,
  refusedS: 0.15, chargeFlashS: 0.15, goldFlashS: 0.15,
} as const;

/** 07 §6.1 item card layout (px) and fade (s). */
export const CARD = {
  minW: 160, maxW: 260, pad: 4, icon: [4, 4], name: [24, 4], row2: [24, 13], row3: [4, 24], rowStep: 11, lift: 6, margin: 8,
  bottomPad: 7 + 4, fadeS: 0.08, classIcon: 8, blurbLines: 2, standLift: 20,
} as const;

/** 07 §7.6 pause panel with tabs (px). */
export const PAUSE_UI = {
  panel: [140, 70, 360, 220], tabY: 6, tabW: 72, tabH: 14, tabGap: 4, titleY: 26, infoY: 46, itemsY: 66, itemStep: 14, cursorDx: 8,
  rowsY: 28, rowStep: 26, classY: 140, controlsY: 30, controlsStep: 14, colX: [16, 100, 186, 270], hintY: 204, pad: 12,
} as const;

/** M4.1 Task 2 start screen (px). */
export const TITLE_UI = { titleY: 96, buttonsY: 170, buttonW: 140, buttonH: 22, buttonStep: 30, cursorDx: 12, hintY: 320 } as const;

/** 07 §4.1 / §4.7 / §6.8 loot HUD layout (px, s). */
export const LOOT_HUD_UI = {
  lockpick: [122, 33], effectX: 8, effectStep: 14, effectY: 54, effectBox: 12, effectLabelY: 68,
  bannerY: [80, 98], bannerInS: 0.1, bannerOutS: 0.3, bannerDrop: 6,
} as const;

/** M5 loot effects placement (px, Hz). */
export const LOOT_FX = {
  chestFxLift: 8, coinBlinkHz: 8, tagGap: 3, burnDy: 2, statusInset: 3, freezePad: 4, freezeAlpha: 0.85, shards: 3, shardStep: 5, promptObjH: 18, promptGap: 4,
} as const;

/** 07 §5.6 ground item look (px, Hz). */
export const ITEM_FX = { keyFrame: 'key_00', blueprintFrame: 'blueprint_00', beamFrame: 'beam_00', bobHz: 0.8, bobPx: 1, glowHz: 1.2, glowMin: 0.6, badge: 9, badgeGap: 2 } as const;
