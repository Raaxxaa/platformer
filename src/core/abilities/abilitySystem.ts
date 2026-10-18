// The ability system (03 §7): slots, the press buffer, activation rules, casts, cooldowns and charges, fizzles, events.
// Runs last in 02 §2.1 step 3, after weapons. Each ability's own behavior lives in its file (registry below).
import type { InputState } from '../input.ts';
import { cancelAttack } from '../combat/playerCombat.ts';
import { cancelDrink } from '../combat/flask.ts';
import { endDive } from '../combat/dive.ts';
import { setState } from '../player/body.ts';
import { endDashOrSlide } from '../player/dash.ts';
import { finishClimb } from '../player/ledge.ts';
import { detachFromWall } from '../player/wall.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { ticks } from '../tuning.ts';
import { ABILITIES, ABILITY } from '../../data/abilities.ts';
import { BOND } from '../../data/classes.ts';
import { statValue } from '../economy/stats.ts';
import { NO_PRESS } from './runtime.ts';
import type { AbilityDef, AbilityId, AbilityKind, AbilityLevelRow, AbilitySlot } from './types.ts';

type Slot = 0 | 1;

/** What an activation passes to an ability (the press facing and inputs, and whether it is linked). */
export interface ActivationCtx {
  slot: Slot; ability: AbilitySlot; row: AbilityLevelRow; def: AbilityDef; linked: boolean;
  /** 03 §8.1 direction rule: moveX if not 0, else facing; from a wall slide, away from the wall. */
  dir: 1 | -1;
  input: InputState;
}

/**
 * One ability's behavior. `start` runs on the press tick for `instant` and `move` (return false to fizzle: nothing is
 * spent). `effect` runs on a cast's effect tick. `check` (casts) decides a fizzle before anything starts.
 */
export interface AbilityImpl {
  start?(w: GameWorld, c: ActivationCtx): boolean;
  effect?(w: GameWorld, c: ActivationCtx): void;
}

const IMPLS = new Map<string, AbilityImpl>();
const EXTRA_DEFS = new Map<string, AbilityDef>();

/** Registers an ability's behavior (each ability file calls this). Tests may also register a fake def. */
export function registerAbility(id: string, impl: AbilityImpl, def?: AbilityDef): void {
  IMPLS.set(id, impl);
  if (def) EXTRA_DEFS.set(id, def);
}

export function abilityDef(id: AbilityId): AbilityDef | undefined {
  return ABILITIES[id] ?? EXTRA_DEFS.get(id);
}
export function levelRow(s: AbilitySlot): AbilityLevelRow {
  return abilityDef(s.id)!.levels[s.level - 1];
}
export const cooldownTicks = (s: AbilitySlot) => ticks(levelRow(s).cooldownS);
export const maxCharges = (s: AbilitySlot) => levelRow(s).charges;

/** The running cast (03 §7.6), beyond the spec's `{ slot, startTick, linked }`. */
export interface CastRt {
  slot: Slot; startTick: number; linked: boolean;
  id: AbilityId; phase: 'startup' | 'recovery'; t: number; S: number; R: number; facing: 1 | -1;
  ctx: ActivationCtx;
}

/** Is an ability ForcedMove running? (Its owner tag starts with `ability:`.) */
export function abilityMoveRunning(w: GameWorld): boolean {
  return w.body.state === 'forced' && !!w.body.forced?.owner.startsWith('ability:');
}
export function castRt(w: GameWorld): CastRt | null {
  return w.abilities.cast as CastRt | null;
}

/** 03 §7.7: rechargeRate = 1 + Σ bonuses (Storm Caller +0.25). */
export function rechargeRate(w: GameWorld): number {
  return 1 + statValue(w, 'focus') + (w.classState.bond === 'storm_caller' ? BOND.STORM_CALLER_RECHARGE : 0);
}

/** 03 §7.7 one player tick of recharging for every slot. */
function recharge(w: GameWorld): void {
  const rate = rechargeRate(w);
  for (const s of w.abilities.slots) {
    if (!s || !abilityDef(s.id) || s.charges >= maxCharges(s)) continue;
    s.rechargeLeft -= rate;
    if (s.rechargeLeft <= 0) {
      s.charges += 1;
      s.rechargeLeft = s.charges < maxCharges(s) ? cooldownTicks(s) : 0;     // leftover is lost
    }
  }
}

/** Stage start (03 §7.7): full charges, nothing recharging, no link, no cast. */
export function fillAbilities(w: GameWorld): void {
  for (const s of w.abilities.slots) if (s && abilityDef(s.id)) { s.charges = maxCharges(s); s.rechargeLeft = 0; }
  w.abilities.link = null;
  w.abilities.cast = null;
  w.abilities.pressTick = [NO_PRESS, NO_PRESS];
}

/** 03 §7.5 per state: 'yes', 'buffer' (wait) or 'no'. */
function stateAllows(w: GameWorld, kind: AbilityKind): 'yes' | 'buffer' | 'no' {
  const s = w.body.state;
  if (s === 'dead' || w.health.dead) return 'no';
  if (s === 'hurt') return 'buffer';
  if (s === 'forced') return kind === 'instant' ? 'yes' : 'buffer';
  return 'yes';
}

/** 03 §7.5: a cast or move leaves the special states first. */
function prepareState(w: GameWorld): void {
  const b = w.body;
  switch (b.state) {
    case 'wallSlide': detachFromWall(b); break;                          // state → air, facing away from the wall
    case 'dash': case 'slide': endDashOrSlide(b, w.mods); setState(b, b.grounded ? (b.h < 28 ? 'crawl' : 'ground') : 'air', 0); break;
    case 'ledgeClimb': finishClimb(b); break;
    case 'diveWindup': case 'diveFall': endDive(w); setState(b, 'air', 0); break;
    case 'diveLand': endDive(w); setState(b, 'ground', 0); break;
    default: break;
  }
}

/** 03 §8.1 direction rule. */
function pressDir(w: GameWorld, input: InputState): 1 | -1 {
  const b = w.body;
  if (b.state === 'wallSlide') return (-b.lastWallDir) as 1 | -1;
  return input.moveX !== 0 ? input.moveX : b.facing;
}

/** 03 §5.1: decides whether this activation is linked, and updates the link window. */
function applyLink(w: GameWorld, slot: Slot): boolean {
  const a = w.abilities, pt = w.body.pt;
  const linked = w.classState.connection && a.link !== null && a.link.fromSlot !== slot && pt - a.link.openedTick <= BOND.LINK_TICKS;
  if (linked) { a.link = null; w.events.push({ t: 'abilityLinked', slot }); }
  else a.link = { fromSlot: slot, openedTick: pt };
  return linked;
}

/** 03 §7.4 activation: spend a charge, start the cooldown, link, emit `abilityUsed`. */
function activate(w: GameWorld, slot: Slot, s: AbilitySlot): boolean {
  const recharging = s.charges < maxCharges(s);
  s.charges -= 1;
  if (!recharging) s.rechargeLeft = cooldownTicks(s);
  const linked = applyLink(w, slot);
  w.events.push({ t: 'abilityUsed', slot, id: s.id, linked });
  return linked;
}

/** Cancels the running cast. In startup nothing was spent (03 §7.6); in recovery it already was. */
export function cancelCast(w: GameWorld): void {
  if (!w.abilities.cast) return;
  w.abilities.cast = null;
  w.mods.gravityMult = 1;
}

function startCast(w: GameWorld, slot: Slot, s: AbilitySlot, def: AbilityDef, input: InputState): void {
  const b = w.body;
  cancelCast(w);
  if (input.moveX !== 0) b.facing = input.moveX;                       // turn to moveX at cast start, then locked
  const S = ticks(def.startupS), R = ticks(def.recoveryS);
  const ctx: ActivationCtx = { slot, ability: s, row: levelRow(s), def, linked: false, dir: b.facing, input };
  const cast: CastRt = { slot, startTick: w.tick, linked: false, id: s.id, phase: 'startup', t: 0, S, R, facing: b.facing, ctx };
  w.abilities.cast = cast;
  if (def.airHover && !b.grounded) b.vy = 0;
  if (S === 0) fireCast(w, cast);
}

function fireCast(w: GameWorld, c: CastRt): void {
  const s = w.abilities.slots[c.slot];
  // The ability may have left its slot during startup (a swap): the cast still finishes with its stored state.
  c.linked = activate(w, c.slot, s && s.id === c.id ? s : c.ctx.ability);
  c.ctx.linked = c.linked;
  c.phase = 'recovery';
  IMPLS.get(c.id)?.effect?.(w, c.ctx);
}

/** One tick of the running cast: startup → effect → recovery → free. */
function advanceCast(w: GameWorld): void {
  const c = castRt(w);
  if (!c) return;
  c.t += 1;
  if (c.phase === 'startup' && c.t >= c.S) fireCast(w, c);
  else if (c.phase === 'recovery' && c.t >= c.S + c.R) w.abilities.cast = null;
}

/** Tries the buffered press on `slot`. Returns true when the press is used up (started or fizzled). */
function tryStart(w: GameWorld, slot: Slot, input: InputState): boolean {
  const a = w.abilities;
  const s = a.slots[slot];
  const def = s ? abilityDef(s.id) : undefined;
  if (!s || !def || def.kind === 'passive' || a.swapChoice) return true;   // nothing to do: drop the press
  if (s.charges < 1) return false;
  const allow = stateAllows(w, def.kind);
  if (allow === 'no') return true;
  if (allow === 'buffer') return false;
  const cast = castRt(w);
  if (def.kind !== 'instant' && ((cast && cast.phase === 'startup') || abilityMoveRunning(w))) return false;
  const impl = IMPLS.get(s.id);
  if (def.kind === 'instant') {
    const ctx: ActivationCtx = { slot, ability: s, row: levelRow(s), def, linked: false, dir: pressDir(w, input), input };
    if (impl?.start && !impl.start(w, { ...ctx })) { w.events.push({ t: 'abilityFizzle', slot }); return true; }
    ctx.linked = activate(w, slot, s);
    return true;
  }
  // cast / move: cancel weapon attacks and charges (02 §9.2 after-cancel rules) and a drink before its sip.
  const dir = pressDir(w, input);
  if (cast) cancelCast(w);                                              // another cast's recovery
  if (w.combat.current) cancelAttack(w, 'dash');
  if (w.drinking && !w.drinking.sipped) cancelDrink(w);
  prepareState(w);
  if (def.kind === 'cast') { startCast(w, slot, s, def, input); return true; }
  // move: the ability decides; on success it has started its ForcedMove or teleport.
  const ctx: ActivationCtx = { slot, ability: s, row: levelRow(s), def, linked: false, dir, input };
  ctx.linked = w.classState.connection && a.link !== null && a.link.fromSlot !== slot && w.body.pt - a.link.openedTick <= BOND.LINK_TICKS;
  if (impl?.start && !impl.start(w, ctx)) { w.events.push({ t: 'abilityFizzle', slot }); return true; }
  activate(w, slot, s);
  return true;
}

/** 02 §2.1 step 3, abilities part (03 §7.4–7.7). */
export function stepAbilities(w: GameWorld, input: InputState): void {
  const a = w.abilities, b = w.body;
  if (w.health.dead) { a.cast = null; a.pressTick = [NO_PRESS, NO_PRESS]; return; }
  // Presses (the buffer stamp is the player tick; it stands still in hit-stop).
  for (const slot of [0, 1] as const) {
    const pressed = slot === 0 ? input.ability1.pressed : input.ability2.pressed;
    if (!pressed || a.swapChoice) continue;
    const s = a.slots[slot];
    if (!s || abilityDef(s.id)?.kind === 'passive') continue;
    a.pressTick[slot] = b.pt;
    if (s.charges < 1) w.events.push({ t: 'abilityNotReady', slot });
  }
  if (b.hitStopTicks > 0) return;                                       // player ticks only
  recharge(w);
  advanceCast(w);
  for (const slot of [0, 1] as const) {
    if (a.pressTick[slot] === NO_PRESS) continue;
    if (b.pt + 1 - a.pressTick[slot] > ABILITY.BUFFER_TICKS) { a.pressTick[slot] = NO_PRESS; continue; }
    if (tryStart(w, slot, input)) a.pressTick[slot] = NO_PRESS;
  }
  applyCastModifiers(w);
}

/** 03 §7.6 move cap, gravity and facing lock while a cast runs. */
export function applyCastModifiers(w: GameWorld): void {
  const c = castRt(w);
  if (!c) { w.mods.gravityMult = 1; return; }
  const def = c.ctx.def;
  w.mods.actionMoveMult = Math.min(w.mods.actionMoveMult, def.groundMoveCap);
  w.mods.facingLocked = true;
  w.body.facing = c.facing;
  w.mods.gravityMult = c.phase === 'startup' && def.airHover ? 0 : def.airGravityMult;
}

/** A jump or dash happened this tick: it cancels the cast (startup: nothing spent; recovery: already spent). */
export function onCastCancelMove(w: GameWorld): void {
  cancelCast(w);
}

/** The player was hurt into hitstun without super armor: a cast in startup is cancelled with nothing spent. */
export function onCastHurt(w: GameWorld): void {
  cancelCast(w);
}

/** Death (03 §7.9): every ability entity and effect goes; the link clears. */
export function clearAbilityEffects(w: GameWorld): void {
  w.abilities.cast = null;
  w.abilities.link = null;
  w.abilities.pressTick = [NO_PRESS, NO_PRESS];
  w.abilityEntities = [];
}
