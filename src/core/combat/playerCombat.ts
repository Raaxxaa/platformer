// The player's weapon attacks: combo, input buffer, cancels, move caps and facing (02 §9.1–9.3, §9.5–9.6).
import type { InputState } from '../input.ts';
import type { PlayerBody } from '../player/body.ts';
import { detachFromWall } from '../player/wall.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { COMBAT } from '../tuning.ts';
import { WEAPONS } from '../../data/weapons.ts';
import { boxToWorld } from './hitGroups.ts';
import { phaseTicks } from './phases.ts';
import { rushAttackSpeed, rushLevel } from './rush.ts';
import type { AttackStep, WeaponDef, WeaponInstance, Weight } from './types.ts';

export type AttackPhase = 'startup' | 'active' | 'recovery';
type Slot = 0 | 1;

export interface CurrentAttack {
  slot: Slot; step: number; phase: AttackPhase; phaseTicks: number; attackInstance: number;
  lens: Record<AttackPhase, number>;     // phase lengths in ticks, fixed when the step starts
  faceAway: boolean;
}

export interface PlayerCombat {
  slots: [WeaponInstance | null, WeaponInstance | null];
  current: CurrentAttack | null;
  queued: boolean;                  // the next step of the same weapon is queued (one press max)
  otherPending: Slot | null;        // the other weapon was pressed during startup/active: switch at recovery
  comboStep: [number, number];      // next combo step per slot
  comboEndTick: [number, number];   // world tick the slot's last step ended or was cancelled
  bufferTicks: number;              // input buffer (02 §9.1) for a press that cannot start yet
  bufferedSlot: Slot | null;
  nextAttackInstance: number;
}

const NEVER = -100000;

export function createPlayerCombat(slots: [WeaponInstance | null, WeaponInstance | null]): PlayerCombat {
  return {
    slots, current: null, queued: false, otherPending: null, comboStep: [0, 0], comboEndTick: [NEVER, NEVER],
    bufferTicks: 0, bufferedSlot: null, nextAttackInstance: 1,
  };
}

export function weaponIn(w: GameWorld, slot: Slot): WeaponDef | null {
  const inst = w.combat.slots[slot];
  return inst ? WEAPONS[inst.weaponId] ?? null : null;
}

/** 02 §9.9: Rush multiplier × (1 + bonuses); M2 has no bonuses. */
export function attackSpeed(w: GameWorld, weight: Weight): number {
  return rushAttackSpeed(rushLevel(w.rush), weight);
}

function stepDef(w: GameWorld, cur: CurrentAttack): AttackStep {
  return weaponIn(w, cur.slot)!.combo[cur.step];
}

/** Is this press a dive slam (down + weapon in the air, 01 §11.1) that movement will start instead? */
function isDivePress(b: PlayerBody, input: InputState, w: GameWorld, slot: Slot): boolean {
  return input.moveY === 1 && !b.grounded && (b.state === 'air' || b.state === 'wallSlide' || b.state === 'dash') && w.ctx.slotUsable[slot];
}

/** Whether an attack can start now: yes, hold the press (dash, ledge pull-up: no time limit), or buffer it. */
function startability(w: GameWorld): 'yes' | 'hold' | 'buffer' {
  const s = w.body.state;
  if (w.isDrinking()) return 'buffer';
  if ((w.abilities.cast as { phase: string } | null)?.phase === 'startup') return 'buffer';   // 03 §7.6
  if (s === 'ground' || s === 'air' || s === 'crawl' || s === 'slide' || s === 'wallSlide') return 'yes';
  if (s === 'dash' || s === 'ledgeClimb') return 'hold';
  return 'buffer';
}

function removeAttackGroups(w: GameWorld, attackInstance: number): void {
  w.hitGroups = w.hitGroups.filter((g) => !(g.owner === 'player' && g.attackInstance === attackInstance && g.kind === 'melee'));
}

function spawnStepGroup(w: GameWorld, cur: CurrentAttack): void {
  const st = stepDef(w, cur);
  if (!st.box || !st.hit) return;
  const b = w.body;
  w.hitGroups.push({
    id: w.newId(), owner: 'player', kind: 'melee', rect: boxToWorld(st.box, b.x, b.y, b.facing), spec: st.hit,
    active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: cur.attackInstance, slot: cur.slot, box: st.box,
  });
}

function startStep(w: GameWorld, slot: Slot, step: number, input: InputState): void {
  const c = w.combat, b = w.body;
  const weapon = weaponIn(w, slot)!;
  const st = weapon.combo[step];
  let faceAway = false;
  if (b.state === 'slide') b.endSlideRequested = true;                 // 01 §9.2: the press ends the slide
  if (b.state === 'wallSlide') { detachFromWall(b); faceAway = true; }  // 02 §9.3: detach, face away
  if (!faceAway && input.moveX !== 0) b.facing = input.moveX;
  const atk = attackSpeed(w, weapon.weight);
  const cur: CurrentAttack = {
    slot, step, phase: 'startup', phaseTicks: 1, attackInstance: c.nextAttackInstance++, faceAway,
    lens: { startup: phaseTicks(st.startup, atk), active: phaseTicks(st.active, atk), recovery: phaseTicks(st.recovery, atk) },
  };
  c.current = cur;
  w.lastAttackStartTick = w.tick;
  c.queued = false;
  c.otherPending = null;
  c.comboStep[slot === 0 ? 1 : 0] = 0;                                   // switching resets the other weapon's combo
  if (cur.lens.startup === 0) enterPhase(w, cur, 'active');
}

function enterPhase(w: GameWorld, cur: CurrentAttack, phase: AttackPhase): void {
  cur.phase = phase;
  cur.phaseTicks = 1;
  if (phase === 'active') {
    if (cur.lens.active === 0) { enterPhase(w, cur, 'recovery'); return; }
    spawnStepGroup(w, cur);
  } else if (phase === 'recovery') {
    removeAttackGroups(w, cur.attackInstance);
  }
}

/** Starts a fresh press on `slot`: continues the combo inside the 0.35 s window, else step 1. */
function startFromPress(w: GameWorld, slot: Slot, input: InputState): void {
  const c = w.combat;
  const len = weaponIn(w, slot)!.combo.length;
  const step = w.tick - c.comboEndTick[slot] <= COMBAT.COMBO_WINDOW_TICKS ? c.comboStep[slot] % len : 0;
  startStep(w, slot, step, input);
}

function finishStep(w: GameWorld, cur: CurrentAttack, endTick: number): void {
  const c = w.combat;
  const len = weaponIn(w, cur.slot)!.combo.length;
  c.comboStep[cur.slot] = (cur.step + 1) % len;
  c.comboEndTick[cur.slot] = endTick;
  removeAttackGroups(w, cur.attackInstance);
  c.current = null;
}

/** 02 §9.2 cancels. Recovery cancels keep combo progress; startup/active cancels don't count the step. */
export function cancelAttack(w: GameWorld, reason: 'dash' | 'jump' | 'dive' | 'hurt' | 'drink'): void {
  const c = w.combat, cur = c.current;
  if (cur) {
    removeAttackGroups(w, cur.attackInstance);
    if (reason === 'hurt') {
      c.comboStep = [0, 0];
      c.comboEndTick = [NEVER, NEVER];
    } else if (cur.phase === 'recovery') {
      c.comboStep[cur.slot] = (cur.step + 1) % weaponIn(w, cur.slot)!.combo.length;
      c.comboEndTick[cur.slot] = w.tick;
    } else {
      c.comboStep[cur.slot] = cur.step;
      c.comboEndTick[cur.slot] = w.tick;
    }
  }
  if (reason === 'hurt') { c.bufferedSlot = null; c.bufferTicks = 0; }
  c.current = null;
  c.queued = false;
  c.otherPending = null;
  w.mods.actionMoveMult = 1;
  w.mods.facingLocked = false;
}

/** Advances the running step by one tick (phases change at the start of the tick after a phase's last tick). */
function advance(w: GameWorld, input: InputState): void {
  const c = w.combat, cur = c.current!;
  if (cur.phaseTicks < cur.lens[cur.phase]) { cur.phaseTicks += 1; return; }
  if (cur.phase === 'startup') { enterPhase(w, cur, 'active'); return; }
  if (cur.phase === 'active') {
    enterPhase(w, cur, 'recovery');
    if (c.otherPending !== null) {
      const other = c.otherPending;
      cancelAttack(w, 'dash');                    // a recovery cancel: keeps progress, then the switch resets it
      startStep(w, other, 0, input);
    }
    return;
  }
  // Recovery finished at the end of the previous tick. Holding a `repeat` weapon continues the combo.
  const held = cur.slot === 0 ? input.attack1.held : input.attack2.held;
  const queued = c.queued || (held && weaponIn(w, cur.slot)!.hold === 'repeat'), other = c.otherPending;
  finishStep(w, cur, w.tick - 1);
  if (queued) startStep(w, cur.slot, c.comboStep[cur.slot], input);
  else if (other !== null) startStep(w, other, 0, input);
}

/** 02 §2.1 step 3 for weapons. */
export function stepPlayerCombat(w: GameWorld, input: InputState): void {
  const c = w.combat, b = w.body;
  if (b.state === 'dead') { cancelAttack(w, 'hurt'); return; }
  let press: Slot | null = null;
  if (input.attack1.pressed && c.slots[0]) press = 0;
  else if (input.attack2.pressed && c.slots[1]) press = 1;
  if (press !== null && isDivePress(b, input, w, press)) press = null;
  // 03 §7.6: a weapon press ends a cast's recovery at once (during startup it waits in the buffer).
  if (press !== null && (w.abilities.cast as { phase: string } | null)?.phase === 'recovery') { w.abilities.cast = null; w.mods.gravityMult = 1; }

  // Hit-stop: timers pause; presses are buffered and the buffer starts when hit-stop ends.
  if (b.hitStopTicks > 0) {
    if (press !== null) {
      const cur = c.current;
      if (cur && cur.slot === press) c.queued = true;            // one queued step, as outside hit-stop (02 §9.2)
      else if (cur) c.otherPending = press;
      else { c.bufferedSlot = press; c.bufferTicks = COMBAT.INPUT_BUFFER_TICKS; }
    }
    return;
  }

  if (c.current) advance(w, input);

  if (press !== null) {
    const cur = c.current;
    if (cur && cur.slot === press) c.queued = true;
    else if (cur) {
      if (cur.phase === 'recovery') { cancelAttack(w, 'dash'); startStep(w, press, 0, input); }
      else c.otherPending = press;
    } else {
      const can = startability(w);
      if (can === 'yes') startFromPress(w, press, input);
      else { c.bufferedSlot = press; c.bufferTicks = COMBAT.INPUT_BUFFER_TICKS; }
    }
  } else if (c.bufferedSlot !== null && !c.current) {
    const can = startability(w);
    if (can === 'yes') { const s = c.bufferedSlot; c.bufferedSlot = null; startFromPress(w, s, input); }
    else if (can === 'buffer' && --c.bufferTicks <= 0) c.bufferedSlot = null;
  }

  // Holding a `repeat` weapon with nothing running (e.g. after a dash cancel) starts it again.
  if (!c.current && press === null && c.bufferedSlot === null) {
    for (const slot of [0, 1] as const) {
      const held = slot === 0 ? input.attack1.held : input.attack2.held;
      const weapon = weaponIn(w, slot);
      if (!held || !weapon || weapon.hold !== 'repeat') continue;
      if (startability(w) === 'yes' && !isDivePress(b, input, w, slot)) startFromPress(w, slot, input);
      break;
    }
  }

  const cur = c.current;
  w.mods.actionMoveMult = cur ? stepDef(w, cur).moveMult : 1;
  w.mods.facingLocked = cur !== null && !stepDef(w, cur).canTurn;
}

/** After player movement: attached melee boxes follow the player (02 §2.2). */
export function syncPlayerGroups(w: GameWorld): void {
  const b = w.body;
  for (const g of w.hitGroups) {
    if (g.owner === 'player' && g.kind === 'melee' && g.box) g.rect = boxToWorld(g.box, b.x, b.y, b.facing);
  }
}
