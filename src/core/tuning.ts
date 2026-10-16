// Every gameplay number lives here (00-README "Tuning constants").

/** Simulation rate: fixed 120 ticks per second (00-README "Simulation"). */
export const TICK_RATE = 120;
/** Length of one tick in seconds. */
export const TICK = 1 / TICK_RATE;

/** Converts a duration in seconds to whole ticks, once, here. */
export function ticks(seconds: number): number {
  return Math.round(seconds * TICK_RATE);
}

/** Longest real frame the fixed-step loop catches up on; longer hitches are dropped (00-README). */
export const MAX_FRAME_SECONDS = 0.25;

/** Gamepad stick thresholds (01 §1.2 step 4). */
export const INPUT = {
  STICK_X: 0.30,
  STICK_Y: 0.60,
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
  WALL_JUMP_VY: -380,
  WALL_JUMP_LOCK: 0.12, WALL_JUMP_LOCK_TICKS: ticks(0.12),
  WALL_JUMP_RANGE: 3,            // px, max gap to a wall for a wall jump
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
