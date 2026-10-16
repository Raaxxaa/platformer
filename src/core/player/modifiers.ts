// Inputs from other systems (combat, abilities, curses) to movement (01 §12.1).
import { MOVE } from '../tuning.ts';

export interface MoveModifiers {
  speedPercents: number[];        // e.g. [+0.20, +0.25, -0.20]; summed in 01 §5.2
  actionMoveMult: number;         // ground move cap of the current attack/charge/drink/shield/cast; 1 if none
  statusMult: number;             // 0.70 while Chilled, else 1
  gravityMult: number;            // air gravity factor from a cast; 0 = hover; 1 if none
  facingLocked: boolean;          // set by combat/abilities per 01 §12.2
  canJump: boolean;
  canDoubleJump: boolean;         // false under Heavy Feet
  canDash: boolean;
  dashCooldownMult: number;       // product of sources (Jammed ×2, Light Feet ×0.80)
  rooted: boolean;                // vx = 0, no jump/dash/slide; falls normally
  maxFallOverride: number | null; // e.g. Eagle Eye aiming
}

/** What movement needs to know about the rest of the player. */
export interface MoveContext {
  /** Whether each weapon slot holds a usable weapon (dive slam needs one, 01 §11.1). */
  slotUsable: [boolean, boolean];
}

export function defaultModifiers(): MoveModifiers {
  return {
    speedPercents: [], actionMoveMult: 1, statusMult: 1, gravityMult: 1, facingLocked: false,
    canJump: true, canDoubleJump: true, canDash: true, dashCooldownMult: 1, rooted: false, maxFallOverride: null,
  };
}

/** 01 §5.2: clamp(1 + sum of % modifiers, 0.5, 1.8). */
export function speedMult(m: MoveModifiers): number {
  const sum = m.speedPercents.reduce((a, p) => a + p, 0);
  return Math.min(MOVE.SPEED_MULT_MAX, Math.max(MOVE.SPEED_MULT_MIN, 1 + sum));
}
