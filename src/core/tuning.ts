// Every gameplay number lives here (00-README "Tuning constants").

/** Simulation rate: fixed 120 ticks per second (00-README "Simulation"). */
export const TICK_RATE = 120;
/** Length of one tick in seconds. */
export const TICK = 1 / TICK_RATE;

/** Converts a duration in seconds to whole ticks, once, here. */
export function ticks(seconds: number): number {
  return Math.round(seconds * TICK_RATE);
}

/** Full-run phase timings (06 §2.2, §2.5, §6). */
export const RUN = {
  STAGE_COUNT: 4,
  FADE_TICKS: ticks(0.5), RESTART_FADE_TICKS: ticks(0.25), STAT_PICK_DELAY_TICKS: ticks(1.0),
  STAT_PICK_CONFIRM_TICKS: ticks(0.30),
} as const;

/** Longest real frame the fixed-step loop catches up on; longer hitches are dropped (00-README). */
export const MAX_FRAME_SECONDS = 0.25;

/** Gamepad stick thresholds (01 §1.2 step 4). */
export const INPUT = {
  STICK_X: 0.30,
  STICK_Y: 0.60,
  TRIGGER_HELD: 0.5,   // gamepad buttons 6 and 7 count as held at this value (07 §8.2)
} as const;

/** Tile size in pixels (00-README "Units"). */
export const TILE_SIZE = 16;
/** Game view (resolution) in pixels (00-README "Units"). */
export const VIEW_W = 640;
export const VIEW_H = 360;

/** Collision forgiveness and safety distances, px (01 §2.7–2.8). */
export const COLLIDE = {
  STEP_UP_MAX: 4,         // §2.7.2 step-up lifts up to 4 px
  CEILING_NUDGE_MAX: 4,   // §2.7.1 ceiling nudge shifts up to 4 px
  PUSH_OUT_MAX: 32,       // §2.8 push-out search distance
  APEX_ASSIST_MAX: 6,     // §2.7.3 one-way apex assist reaches up to 6 px
} as const;

/**
 * Player movement (01 §4, plus the other movement numbers of 01).
 * Durations are in seconds; each has a `_TICKS` twin computed once here with ticks().
 */
export const MOVE = {
  RUN_MAX: 170,                  // px/s, target run speed (× speed multiplier)
  GROUND_ACCEL: 1800,            // px/s²
  GROUND_DECEL: 2400,            // px/s², no input on ground
  GROUND_TURN: 2400,             // px/s², input opposite to motion on ground
  AIR_ACCEL: 1400,
  AIR_DECEL: 900,
  AIR_TURN: 1400,
  OVERSPEED_DECAY_GROUND: 1600,  // px/s², above max while holding forward
  OVERSPEED_DECAY_AIR: 600,
  GRAVITY: 1500,
  MAX_FALL: 400,
  MAX_FALL_DOWN_HELD: 520,
  FALL_CAP_DECEL: 2400,          // px/s², how fast vy drops to a lower cap
  JUMP_V: -410,
  JUMP_CUT: 0.45,
  DOUBLE_JUMP_V: -346,
  COYOTE: 0.10, COYOTE_TICKS: ticks(0.10),
  JUMP_BUFFER: 0.10, JUMP_BUFFER_TICKS: ticks(0.10),
  DASH_SPEED: 400,
  DASH_TIME: 0.15, DASH_TICKS: ticks(0.15),
  DASH_COOLDOWN: 0.35, DASH_COOLDOWN_TICKS: ticks(0.35),
  DASH_BUFFER: 0.10, DASH_BUFFER_TICKS: ticks(0.10),
  SLIDE_SPEED: 330,
  SLIDE_TIME: 0.30, SLIDE_TICKS: ticks(0.30),
  SLIDE_IFRAMES: 0.15, SLIDE_IFRAMES_TICKS: ticks(0.15),
  CRAWL_MAX: 80,
  WALL_SLIDE_MAX: 90,
  WALL_SLIDE_MAX_DOWN_HELD: 400,
  WALL_JUMP_VX: 220,
  WALL_JUMP_VY: -400,
  WALL_JUMP_LOCK: 0.10, WALL_JUMP_LOCK_TICKS: ticks(0.10),
  WALL_JUMP_RANGE: 4,            // px, max gap to a wall for a wall jump
  WALL_COYOTE: 0.10, WALL_COYOTE_TICKS: ticks(0.10),
  LEDGE_WINDOW_MIN: 5,           // px, ledge top at least this far above the feet
  LEDGE_WINDOW_MAX: 24,          // px, and at most this far
  LEDGE_CLIMB_UP: 0.10, LEDGE_CLIMB_UP_TICKS: ticks(0.10),
  LEDGE_CLIMB_OVER: 0.05, LEDGE_CLIMB_OVER_TICKS: ticks(0.05),
  DIVE_WINDUP: 0.05, DIVE_WINDUP_TICKS: ticks(0.05),
  DIVE_SPEED: 600,
  DIVE_LAND_LAG: 0.10, DIVE_LAND_LAG_TICKS: ticks(0.10),
  DIVE_BOUNCE_V: -360,
  SPEED_MULT_MIN: 0.5,
  SPEED_MULT_MAX: 1.8,
  MAX_SPEED: 600,                // px/s, absolute cap on |vx| and |vy| (01 §2.4)
  BOX_W: 12,                     // px, player box width (01 §2.2)
  BOX_H: 28,                     // px, standing box height
  BOX_H_LOW: 14,                 // px, slide / crawl box height
  WALL_PROBE_ROW: 14,            // px above the feet where the wall gap is measured (01 §8.1)
  WALL_PROBE_MAX: 8,             // px, how far wallGap looks for a wall
  LEDGE_GRAB_GAP: 2,             // px, max gap to the wall for a ledge grab (01 §10.1)
  LEDGE_ROOM_BACK: 12,           // px, room check reaches this far back from the wall face (01 §10.1)
  LEDGE_ROOM_FORWARD: 14,        // px, and this far onto the ledge
  LEDGE_STAND_OFFSET: 8,         // px, standing spot center past the wall face (01 §10.2)
} as const;

/** Follow camera (01 §14.1). */
export const CAMERA = {
  LOOK_AHEAD_K: 0.35,       // look-ahead target = clamp(vx × 0.35, ±80)
  LOOK_AHEAD_MAX: 80,
  LOOK_IDLE_SPEED: 10,      // px/s; below this the target is facing × 24
  LOOK_IDLE: 24,
  LOOK_RATE: 240,           // px/s, linear change toward the target
  FEET_OFFSET: 40,          // feet sit 40 px below the screen center (screen y 220)
  AIR_UP_SLACK: 80,
  LOOK_DOWN: 64,            // px, when vy >= 300 or in diveFall
  LOOK_DOWN_VY: 300,
  LOOK_DOWN_RATE: 300,      // px/s
  TAU_X: 0.08,              // s, exponential smoothing time constants
  TAU_Y: 0.12,
  MARGIN_X: 64,             // px between the player box and the left/right screen edges
  MARGIN_Y: 48,             // px between the player box and the top/bottom screen edges
  SNAP_DIST: 160,           // px, a single-tick player move larger than this snaps
  SHAKE_MAX: 8,             // px
  BOUNDS_BLEND: 0.4, BOUNDS_BLEND_TICKS: ticks(0.4),   // camera zone change (01 §14.3)
  SHAKE_SMALL: { amplitude: 2, seconds: 0.12 },
  SHAKE_MEDIUM: { amplitude: 4, seconds: 0.25 },
} as const;

/** Spikes (01 §13.4): 20 damage, not stage-scaled; hurt zones are inset inside the tile. */
export const SPIKES = {
  DAMAGE: 20,
  INSET_SIDE: 2, DEPTH: 8,                      // zone: 12 px wide, 8 px deep from the base
  UP_VY: -330, DOWN_VY: 150,
  SIDE_VX: 220, SIDE_VY: -200, SIDE_LOCK: 14,   // ticks of steering lock
} as const;

/** Surfaces, collapsing platforms, minecarts and grapple points (01 §13). */
export const TERRAIN = {
  WATER_SPEED_MULT: 0.5, WATER_JUMP_V: -340, WATER_MAX_FALL: 160,
  ICE_ACCEL: 450, ICE_DECEL: 200, ICE_TURN: 900, ICE_OVERSPEED: 120,
  COLLAPSE_DELAY: 0.5, COLLAPSE_RESPAWN: 4, COLLAPSE_VISUAL_TICKS: ticks(1),
  CART_W: 24, CART_H: 14, CART_RIDER_H: 20, CART_SEAT: 8, CART_ACCEL: 800, CART_MAX: 260,
  CART_GRAVITY: 1500, CART_MAX_FALL: 520, CART_JUMP_V: -420, CART_THROW_V: -300,
  CART_RESPAWN_TICKS: ticks(2),
  GRAPPLE_SIZE: 16, GRAPPLE_ARRIVE: 12, GRAPPLE_VX: 200, GRAPPLE_VY: -250, GRAPPLE_ZERO_X: 8,
  CHARGE_WALL_REACH: 4,
  DARK_LIGHT_RADIUS: 112, FIREFLY_RADIUS: 48,
} as const;

/** Combat arenas (06 §9.2). Fill in tenths of a percent. */
export const ARENA = {
  NEXT_WAVE: 0.75, NEXT_WAVE_TICKS: ticks(0.75),
  DOORS_OPEN: 0.5, DOORS_OPEN_TICKS: ticks(0.5),
  STUCK: 3.0, STUCK_TICKS: ticks(3.0),
  FILL_FAST: 400, FILL_SLOW: 250,
} as const;

/** Bosses (04 §9). */
export const BOSS = {
  SPAWN_FRACTION: 0.75,                  // of the arena width from the entry side
  INTRO: 1.0, INTRO_TICKS: ticks(1.0),
  DEATH_ANIM_TICKS: ticks(1.5),
  POISE_IMMUNE: 2.0, POISE_IMMUNE_TICKS: ticks(2.0),
} as const;

/** The Great Boar (04 §10.1). */
export const GREAT_BOAR = {
  CHARGE_SPEED: 380, CHARGE_SPEED_ENRAGED: 440,
  DAZE: 2.0, DAZE_TICKS: ticks(2.0), DAZE_ENRAGED: 1.4, DAZE_ENRAGED_TICKS: ticks(1.4),
  CRASH_SHAKE: { amplitude: 4, seconds: 0.3 },
  ROCKS: 3, ROCK_SPACING: 48, ROCK_TRIES: 200,
  ROCK_MARKER: 0.8, ROCK_MARKER_TICKS: ticks(0.8),
} as const;

/** Main-path movement limits for level design (06 §8.5), in tiles. "Late" = from section 3 on. */
export const ROUTE = {
  RISE: 5, RISE_LATE: 7,
  ONEWAY_RISE: 3, ONEWAY_RISE_LATE: 6,
  GAP: 4, GAP_LATE: 5,
  LATE_SECTION: 3,
  SHAFT_MIN: 3, SHAFT_MAX: 5,           // wall-jump shaft inner width
} as const;

/** Timed doors (06 §9.5). */
export const TIMED_DOOR = { TRIGGER_W: 48 } as const;   // px strip in front of the door

/** Death and restart (06 §6). */
export const RESTART = {
  DEATH_SIM: 1.0, DEATH_SIM_TICKS: ticks(1.0),          // the world keeps running after death
  PRESS_AFTER: 0.25, PRESS_AFTER_TICKS: ticks(0.25),    // a restart press counts from here
  HOLD: 0.5, HOLD_TICKS: ticks(0.5),                    // instant restart hold
} as const;

/** Combat numbers (02 §2–9). Seconds, with tick twins where code counts ticks. */
export const COMBAT = {
  IFRAME_BLINK: 0.05, IFRAME_BLINK_TICKS: ticks(0.05),   // sprite alpha toggle while in i-frames (02 §5.2 step 8)
  GRADE_MULT: { F: 0.8, C: 1.0, B: 1.25, A: 1.6, S: 2.0 },
  MATCH_MULT: 1.25,
  CRIT_MULT: 2.0,
  HIT_STOP_CAP: 0.125,           // s (02 §4.1)
  HIT_STOP_CRIT_BONUS: 0.025,
  HIT_STOP_KILL_BONUS: 0.025,
  HURT_HIT_STOP: 0.075, HURT_HIT_STOP_TICKS: ticks(0.075),
  HURT_IFRAMES: 0.80, HURT_IFRAMES_TICKS: ticks(0.80),
  HITSTUN: 0.20, HITSTUN_TICKS: ticks(0.20),
  HURT_KB_X: 180, HURT_KB_Y: -160,
  COMBO_WINDOW: 0.35, COMBO_WINDOW_TICKS: ticks(0.35),
  INPUT_BUFFER: 0.15, INPUT_BUFFER_TICKS: ticks(0.15),
  RUSH_HURT: -75,
  MAX_HP: 100,
  KILL_CREDIT_WINDOW: 5.0, KILL_CREDIT_TICKS: ticks(5.0),
  // Enemy reactions (02 §4.2–4.4)
  ENEMY_KB_DECAY_GROUND: 1600,   // px/s²
  ENEMY_KB_DECAY_AIR: 400,
  ENEMY_KB_CONTROL_SPEED: 20,    // px/s: AI resumes below this
  STAGGER: 0.5, STAGGER_TICKS: ticks(0.5),
  STAGGER_HEAVY: 0.8, STAGGER_HEAVY_TICKS: ticks(0.8),
  POISE_REFILL: 1.5, POISE_REFILL_TICKS: ticks(1.5),
  ELITE_POISE_IMMUNE: 2.0, ELITE_POISE_IMMUNE_TICKS: ticks(2.0),
  ELITE_CONTROL_MULT: 0.5,
  LAUNCH_LAND: 0.2, LAUNCH_LAND_TICKS: ticks(0.2),   // 02 §4.4: launched enemies act again 0.2 s after landing
  PULL_MAX: 0.3, PULL_MAX_TICKS: ticks(0.3), PULL_ARRIVE: 4,
  BOSS_CONTROL_POISE: 30,
  /** 02 §6.4 Lightning chain per level: targets, % of procBase, range px. */
  LIGHTNING: [{ targets: 2, pct: 0.35, range: 80 }, { targets: 2, pct: 0.50, range: 96 }, { targets: 2, pct: 0.65, range: 112 }],
  HIT_STREAK_TIMEOUT: 2.0, HIT_STREAK_TIMEOUT_TICKS: ticks(2.0),
  FRONTAL_DX: 4,
} as const;

/** Ground move cap while attacking, by weapon weight (02 §9.3). */
export const WEIGHT_MOVE_MULT = { light: 0.60, medium: 0.40, heavy: 0.25 } as const;

/** Rush meter (02 §8). */
export const RUSH = {
  MAX: 300,
  LEVEL_STEP: 100,                                   // level = floor(value / 100); 3 only at exactly 300
  ATTACK_SPEED_LIGHT_MEDIUM: [1.00, 1.05, 1.10, 1.15],
  ATTACK_SPEED_HEAVY: [1.00, 1.15, 1.30, 1.45],
  SPEED_PERCENT: [0, 0.05, 0.10, 0.15],
  GOLD_MULT: [1.00, 1.10, 1.20, 1.30],
  HIT: 3,                       // first direct hit of an attack instance
  DASH_HIT: 5,                  // extra, during a dash or ≤ 0.20 s after one
  DASH_HIT_WINDOW: 0.20, DASH_HIT_WINDOW_TICKS: ticks(0.20),
  DASH_THROUGH: 4,              // per enemy per dash
  KILL_REGULAR: 15,
  KILL_ELITE: 40,
  KILL_BOSS: 100,
  MOVE_GAIN: 6,                 // per second while |vx| ≥ 60% of base run max
  MOVE_FRACTION: 0.6,
  STILL_SPEED: 20,              // px/s
  STILL_DRAIN: 50,              // per second
  STILL_DELAY: 0.5, STILL_DELAY_TICKS: ticks(0.5),
  STILL_ATTACK_WINDOW: 1.0, STILL_ATTACK_WINDOW_TICKS: ticks(1.0),
  NO_GAIN_DELAY: 4.0, NO_GAIN_DELAY_TICKS: ticks(4.0),
  NO_GAIN_DRAIN: 15,            // per second
} as const;

/** Stage scaling (04 §2.3, 00-README). */
export const STAGE_SCALING = {
  1: { mobHp: 1.0, bossHp: 1.0, dmg: 1.0 }, 2: { mobHp: 1.4, bossHp: 1.7, dmg: 1.3 },
  3: { mobHp: 1.9, bossHp: 2.6, dmg: 1.5 }, 4: { mobHp: 2.4, bossHp: 3.6, dmg: 1.7 } } as const;

/** Shared enemy rules (04 §2). */
export const ENEMY = {
  GRAVITY: 1500,
  MAX_FALL: 400,
  SEPARATION_DIST: 10,          // px between feet x
  SEPARATION_SPEED: 40,         // px/s
  ATTACK_GAP_REGULAR: 0.6,
  ATTACK_GAP_ELITE: 0.8,
  ALERT_REACTION: 0.25, ALERT_REACTION_TICKS: ticks(0.25),
  ALERT_SPREAD_RANGE: 128,
  ALERT_SPREAD_DELAY: 0.3, ALERT_SPREAD_TICKS: ticks(0.3),
  NOTICE_RANGE_Y: 80,
  LOSE_RANGE_MIN: 320,          // loseRange = max(320, 2 × range)
  RETURN_AFTER: 5.0, RETURN_AFTER_TICKS: ticks(5.0),
  PATROL_PAUSE: 1.0, PATROL_PAUSE_TICKS: ticks(1.0),
  DEATH_ANIM: 0.4, DEATH_ANIM_TICKS: ticks(0.4),
  ACTIVATION_MARGIN: 96,
  MELEE_DY_MIN: -40, MELEE_DY_MAX: 24,
  RANGED_DY_MIN: -96, RANGED_DY_MAX: 96,
  MAX_TOKENS_MELEE: 2, MAX_TOKENS_RANGED: 2,
  LEAP_MAX: 1.0, LEAP_MAX_TICKS: ticks(1.0),
  DUMMY_HEAL_DELAY: 1.0, DUMMY_HEAL_TICKS: ticks(1.0),
  BOAR_DAZE: 1.2, BOAR_DAZE_TICKS: ticks(1.2),             // Boar charge into a wall (04 §3)
  BOAR_WALL_SHAKE: { amplitude: 2, seconds: 0.15 },
  AIM_CLAMP_DEG: 30,            // aimed shots clamp to ±30° from horizontal (04 §2.7)
  WAVE_SPAWN_DX: 24,            // floor waves start this far in front of the feet
  HURT_FLASH_TICKS: 2,          // enemy hurt flash (02 §4.6: 2 ticks)
  LOS_STEP: 4,                  // px between line-of-sight samples
  SPAWN_IN: 0.5, SPAWN_IN_TICKS: ticks(0.5),               // arena waves, ambushes, summons (04 §2.2)
  TELEGRAPH_FLASH_LAST: 0.15, TELEGRAPH_FLASH_LAST_TICKS: ticks(0.15),   // last part of a telegraph flashes near-white
} as const;

/** Heal flask (02 §7). Fill is in tenths of a percent. */
export const FLASK = {
  START_CHARGES: 2,
  MAX_CHARGES: 4,
  FULL_TENTHS: 1000,
  DRINK: 0.40, DRINK_TICKS: ticks(0.40),
  SIP: 0.25, SIP_TICKS: ticks(0.25),
  HEAL_FRACTION: 0.40,
  MOVE_CAP: 0.40,
  FILL_REGULAR: 50,
  FILL_ELITE: 150,
} as const;

/** 02 §6.2–6.6 element tables (index = level − 1) and timings (seconds). */
export const ELEMENT = {
  BURN: { pct: [0.10, 0.15, 0.20], durationS: 3.0, intervalS: 0.5, spread: [48, 48, 64] },
  ICE: { scale: [0.75, 0.65, 0.55], stacks: [5, 4, 3], shatter: [2.0, 2.5, 3.0], chillS: 2.5, stackClearS: 3.0,
    freezeS: { regular: 1.5, elite: 0.75 }, immuneS: 3.0 },
  POISON: { pct: [0.03, 0.045, 0.06], max: [5, 6, 8], intervalS: 0.5, expireS: 4.0 },
  WIND: { kb: [1.5, 1.8, 2.2], poise: [1.25, 1.5, 2.0] },
} as const;
