// Rush meter (02 §8). stillTime and noGainTime are counted in ticks.
import type { GameWorld } from '../sim/gameWorld.ts';
import { MOVE, RUSH, TICK } from '../tuning.ts';
import type { RushState, Weight } from './types.ts';

export function createRush(): RushState {
  return { value: 0, stillTime: 0, noGainTime: 0, floor: 0 };
}

/** Adds (or removes) Rush, clamped to [floor, 300]. A positive amount counts as a gain. */
export function addRushValue(r: RushState, amount: number): void {
  r.value = Math.max(r.floor, Math.min(RUSH.MAX, r.value + amount));
  if (amount > 0) r.noGainTime = 0;
}

export function addRush(w: GameWorld, amount: number): void {
  if (w.level?.kind === 'village') return;
  addRushValue(w.rush, amount);
}

export function rushLevel(r: RushState): 0 | 1 | 2 | 3 {
  return Math.min(3, Math.floor(r.value / RUSH.LEVEL_STEP)) as 0 | 1 | 2 | 3;
}

/** Rush attack-speed multiplier by weight (02 §8.3). */
export function rushAttackSpeed(level: 0 | 1 | 2 | 3, weight: Weight): number {
  return (weight === 'heavy' ? RUSH.ATTACK_SPEED_HEAVY : RUSH.ATTACK_SPEED_LIGHT_MEDIUM)[level];
}

export function rushGoldMult(level: 0 | 1 | 2 | 3): number {
  return RUSH.GOLD_MULT[level];
}

export function rushSpeedPercent(level: 0 | 1 | 2 | 3): number {
  return RUSH.SPEED_PERCENT[level];
}

/** Step 10: passive gain from moving fast, the standing-still drain and the no-gain drain (02 §8.2). */
export function stepRush(w: GameWorld): void {
  const r = w.rush, b = w.body;
  if (w.level?.kind === 'village') { r.value = 0; return; }
  if (w.health.dead) return;
  r.noGainTime += 1;
  if (Math.abs(b.vx) >= RUSH.MOVE_FRACTION * MOVE.RUN_MAX) addRushValue(r, RUSH.MOVE_GAIN * TICK);
  const still = b.grounded && Math.abs(b.vx) < RUSH.STILL_SPEED && w.tick - w.lastAttackStartTick > RUSH.STILL_ATTACK_WINDOW_TICKS;
  r.stillTime = still ? r.stillTime + 1 : 0;
  if (r.stillTime > RUSH.STILL_DELAY_TICKS) addRushValue(r, -RUSH.STILL_DRAIN * TICK);
  if (r.noGainTime > RUSH.NO_GAIN_DELAY_TICKS) addRushValue(r, -RUSH.NO_GAIN_DRAIN * TICK);
}
