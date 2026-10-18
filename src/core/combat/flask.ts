// Heal flask: charges, drinking, kill-charged fill (02 §7).
import type { InputState } from '../input.ts';
import { roundHalfUp } from '../math.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { COMBAT, FLASK } from '../tuning.ts';
import { LUCKY_FX } from '../../data/loot.ts';
import { statValue } from '../economy/stats.ts';
import { cancelAttack } from './playerCombat.ts';
import type { FlaskState } from './types.ts';

export interface DrinkState { t: number; sipped: boolean }

export function createFlask(): FlaskState {
  return { charges: FLASK.START_CHARGES, maxCharges: FLASK.START_CHARGES, fillTenths: 0 };
}

/** 02 §7.3 conversion: a full bar becomes a charge whenever there is room; at max the bar caps at full. */
function convert(f: FlaskState): void {
  while (f.fillTenths >= FLASK.FULL_TENTHS && f.charges < f.maxCharges) {
    f.charges += 1;
    f.fillTenths -= FLASK.FULL_TENTHS;
  }
  if (f.charges >= f.maxCharges) f.fillTenths = Math.min(f.fillTenths, FLASK.FULL_TENTHS);
}

export function addFlaskFill(w: GameWorld, tenths: number): void {
  w.flask.fillTenths += tenths;
  convert(w.flask);
}

export function onKillFill(w: GameWorld, tier: 'regular' | 'elite', extraTenths = 0): void {
  const mult = w.econ.buffs.includes('bloodrush') ? LUCKY_FX.bloodrushMult : 1;     // 05 §7.2 Bloodrush
  addFlaskFill(w, ((tier === 'elite' ? FLASK.FILL_ELITE : FLASK.FILL_REGULAR) + statValue(w, 'bloodthirst') + extraTenths) * mult);
}

function startDrink(w: GameWorld): void {
  w.drinking = { t: 0, sipped: false };
  w.drinkBufferTicks = 0;
}

/** 02 §7.2: a heal press. Refusals name the first failed check; attacks buffer it or are cancelled. */
export function tryStartDrink(w: GameWorld, input: InputState): void {
  if (w.health.dead) return;
  if (input.heal.pressed) {
    if (w.drinking) return;
    const blocked = w.econ.debuffs.some((d) => d.id === 'dry_flask') || w.econ.curse?.id === 'no_heal';
    const reason = w.flask.charges < 1 ? 'noCharge' : w.health.hp >= w.health.maxHp ? 'fullHp' : blocked ? 'blocked' : w.body.state === 'hurt' || w.health.hitstunTicks > 0 ? 'hitstun' : null;
    if (reason) { w.events.push({ t: 'healRefused', reason }); return; }
    w.drinkBufferTicks = COMBAT.INPUT_BUFFER_TICKS;
  } else if (w.drinkBufferTicks > 0 && w.body.hitStopTicks === 0) {
    w.drinkBufferTicks -= 1;
  }
  if (w.drinkBufferTicks <= 0 || w.drinking) return;
  const cur = w.combat.current;
  if (cur && cur.phase !== 'recovery') return;            // startup/active: wait (buffered)
  if (cur) cancelAttack(w, 'drink');
  startDrink(w);
}

/** One tick of drinking: the sip at 0.25 s, done at 0.40 s. Paused during the player's hit-stop. */
export function stepDrink(w: GameWorld): void {
  const d = w.drinking;
  if (!d || w.body.hitStopTicks > 0) return;
  d.t += 1;
  if (d.t === FLASK.SIP_TICKS && !d.sipped) {
    d.sipped = true;
    w.flask.charges -= 1;
    w.health.hp = Math.min(w.health.maxHp, w.health.hp + roundHalfUp(FLASK.HEAL_FRACTION * w.health.maxHp));
    convert(w.flask);
    w.events.push({ t: 'drink' });
  }
  if (d.t >= FLASK.DRINK_TICKS) w.drinking = null;
}

/** A dash, jump or hit ends the drink. Before the sip nothing is used. */
export function cancelDrink(w: GameWorld): void {
  w.drinking = null;
  w.drinkBufferTicks = 0;
}

/** Step 10: conversion after any change. */
export function stepFlask(w: GameWorld): void {
  convert(w.flask);
}
