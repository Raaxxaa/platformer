// View-only art numbers (08). Nothing here changes game rules.

/** 08 §4.3 draw order. */
export const DEPTH = {
  parallax: [0, 1, 2], deco: 10, terrain: 20, enemies: 40, player: 50, projectiles: 88, debug: 89, hud: 90,
} as const;

/** 08 §9: tileset layout (16 × 9 tiles of 16 px, margin 1, spacing 2). */
export const TILESET = {
  tile: 16, margin: 1, spacing: 2, columns: 16,
  fullVariants: 5,                         // mask 255: blob 46 or row 3 cols 0–3
  iceRow: 4,                               // ice blob tiles: rows 4–6
  onewayRow: 3, onewayCols: { left: 4, middle: 5, right: 6, single: 7 },
  spikeCols: { spikeUp: 8, spikeRight: 9, spikeDown: 10, spikeLeft: 11 },   // row 3
  topDecoRow: 7, topDecoCol: 8, topDecoCount: 8, topDecoChance: 30,
  hangDecoRow: 8, hangDecoCol: 0, hangDecoCount: 8, hangDecoChance: 20,
} as const;

/** 08 §10.1 parallax factors; sky top = first `pl_sky` band. */
export const PARALLAX = {
  plains: { skyTop: 0x78bfe6, layers: [{ fx: 0.10, fy: 0.05 }, { fx: 0.30, fy: 0.12 }, { fx: 0.55, fy: 0.25 }] },
} as const;
export const VIEW = { w: 640, h: 360 } as const;

/** 08 §5.1 run anim speed; 08 §7.1 enemy walk speed. */
export const ANIM = {
  RUN_FPS_AT: 14, RUN_SPEED_REF: 170, RUN_FPS_MIN: 8, RUN_FPS_MAX: 24,
  WALK_FPS_AT: 10, WALK_FPS_MIN: 6, WALK_FPS_MAX: 20,
  KNOCKDOWN_F0: 0.1,                        // knockdown: f0 for 0.1 s, then f1
  BREAK_F0: 0.2, BREAK_FPS: 4,              // boss break: f0 for 0.2 s, then [1, 2] at 4 fps
  PROJ_ANGLE_STEP: 22.5,                    // projectiles rotate to the velocity angle in 22.5° steps
  // 08 §6.1 player movement anims.
  SKID_SPEED: 100,                          // skid: grounded, facing opposite to vx, abs(vx) > 100
  RUN_MIN_SPEED: 1,                         // below this the grounded player idles
  AIR_APEX_VY: 60,                          // jump vy < −60 / apex abs(vy) ≤ 60 / fall vy > 60
  LAND_MIN_VY: 200,                         // land plays when landing at vy ≥ 200
  DASH_FRAME_STARTS: [4, 14],               // dash ticks 0–3 → f0, 4–13 → f1, 14+ → f2
  SLIDE_F0_TICKS: 6,
  CRAWL_MOVE_SPEED: 10,
  DRINK_FRAME_ENDS: [0.10, 0.25, 0.33],     // drink: 0–0.10 s f0, –0.25 f1, –0.33 f2, then f3
  SMEAR_RECOVERY_TICKS: 6,                  // smear shows in the active phase and the first 6 ticks of recovery
} as const;

/** 08 §5.3 overlay flashes. */
export const OVERLAY = {
  hitFlash: { color: 0xffffff, alpha: 1.0, minTicks: 6 },
  telegraphGo: { color: 0xfff4c8, alpha: 0.85 },
  telegraph: { color: 0xff8a1f, alphaMin: 0.15, alphaMax: 0.55, period: 0.2 },
} as const;

/** 08 §3.4 class trim tints. */
export const TRIM_TINT = { swordsman: 0xff5a5a, tank: 0xff9a3c, archer: 0xa8d846, wizard: 0x42d9ff, none: 0x9d98b0 } as const;

/** 08 §4.1 character frames: the feet anchor in frame pixels. */
export const ANCHOR = {
  human: { w: 48, h: 48 },
  feetFromBottom: 2,           // every character frame: feet at (w/2, h − 2)
} as const;
