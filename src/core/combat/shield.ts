// The Shield (02 §12): raise, parry window, block, bash. The hurt pipeline asks `shieldGuard` at steps 3–4 (02 §5.2).
import { damagePoise, applyControl } from './enemyReactions.ts';
import { refundDash } from '../player/dash.ts';
import type { InputState } from '../input.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { ticks } from '../tuning.ts';
import { SHIELD, SIGNATURE as SG } from '../../data/weapons.ts';
import { markHit, type HitGroup } from './hitGroups.ts';
import { maxStop } from './hitStop.ts';
import { isS } from './signatures.ts';
import { firePlayerProjectile } from './playerProjectiles.ts';
import { addRush } from './rush.ts';
import type { HurtSource } from './health.ts';

type Slot = 0 | 1;

/** The raised (or just lowered) shield. `up` is the guarding phase; `lower` is the 0.10 s recovery after a held shield. */
export interface ShieldState { slot: Slot; t: number; phase: 'up' | 'lower'; windowTicks: number; lowerLeft: number }

const heldOf = (input: InputState, slot: Slot) => (slot === 0 ? input.attack1.held : input.attack2.held);

/** 02 §12: the shield goes up at once; the parry window is the first 0.20 s (0.30 s with Aegis). */
export function raiseShield(w: GameWorld, slot: Slot, _input: InputState): void {
  const c = w.combat;
  if (c.shield?.slot === slot && c.shield.phase === 'up') return;
  c.queued = false;
  c.otherPending = null;
  c.shield = { slot, t: 0, phase: 'up', windowTicks: ticks(isS(c.slots[slot], 'shield') ? SG.aegis.windowS : SHIELD.windowS), lowerLeft: 0 };
}

/**
 * Per tick while a shield is raised. Returns the slot to bash with when the shield was let go inside the parry window
 * (the caller starts the bash step).
 */
export function stepShield(w: GameWorld, input: InputState, press: Slot | null): Slot | null {
  const c = w.combat, sh = c.shield;
  if (!sh) return null;
  if (press !== null && press !== sh.slot) { c.shield = null; return null; }           // the other weapon lowers it and attacks
  if (sh.phase === 'lower') {
    if (press === sh.slot) { c.shield = null; return null; }                           // raising again
    if (--sh.lowerLeft <= 0) c.shield = null;
    return null;
  }
  sh.t += 1;
  if (heldOf(input, sh.slot)) return null;
  if (sh.t <= sh.windowTicks) { c.shield = null; return sh.slot; }                      // released inside the window
  sh.phase = 'lower';
  sh.lowerLeft = ticks(SHIELD.lowerS);
  return null;
}

export const shieldUp = (w: GameWorld): boolean => w.combat.shield?.phase === 'up';

/** Is the hit in front of the shield (02 §12 "Frontal check")? */
function frontal(w: GameWorld, src: Extract<HurtSource, { kind: 'enemyHit' }>): boolean {
  const b = w.body;
  if (!src.melee) return src.travelDir === -b.facing;
  const cx = src.group ? src.group.rect.x + src.group.rect.w / 2 : src.attackerCx;
  const dx = cx - b.x;
  return Math.abs(dx) < 4 || dx * b.facing > 0;
}

/** Steps 3 and 4 of the hurt pipeline. 'parry': the hit is fully answered (0 damage). 'block': the caller applies ×0.25 damage. */
export function shieldGuard(w: GameWorld, src: HurtSource): 'parry' | 'block' | null {
  const sh = w.combat.shield;
  if (src.kind !== 'enemyHit' || !sh || sh.phase !== 'up' || src.unblockable || !frontal(w, src)) return null;
  if (sh.t >= sh.windowTicks) return 'block';
  parry(w, src, sh);
  return 'parry';
}

function parry(w: GameWorld, src: Extract<HurtSource, { kind: 'enemyHit' }>, sh: ShieldState): void {
  const b = w.body, stop = ticks(SHIELD.parryStopS);
  if (src.group) markHit(src.group, 0, w.tick);                                         // the parried hit is used up
  if (src.melee) {
    const owner = w.enemies.find((e) => e.id === src.enemyId);
    if (owner) {
      if (owner.def.boss) damagePoise(w, owner, SHIELD.parryBossPoise, false);
      else applyControl(w, owner, 'stun', SHIELD.parryStunS);                           // elites take ×0.5 inside applyControl
      owner.hitStopTicks = maxStop(owner.hitStopTicks, stop);
    }
  } else if (src.group) {
    // A projectile is sent back as a player shot: reversed, 1.5× speed, range reset to 320 (24 base, the Shield's grade, match and element).
    const ep = w.projectiles.find((q) => q.groupId === src.group!.id);
    if (ep) {
      const R = SHIELD.reflect;
      firePlayerProjectile(w, sh.slot, w.combat.nextAttackInstance++, 'reflected', 0, {
        origin: { x: ep.x, y: ep.y }, velocity: { vx: -ep.vx * R.speedMult, vy: -ep.vy * R.speedMult },
      });
    }
    src.group.active = false;
    w.onEnemyShotLanded(src.group);
  }
  refundDash(b);
  w.health.iframeTicks = Math.max(w.health.iframeTicks, ticks(SHIELD.parryIframesS));
  addRush(w, SHIELD.parryRush);
  b.hitStopTicks = maxStop(b.hitStopTicks, stop);
  if (isS(w.combat.slots[sh.slot], 'shield')) {
    // Aegis: each parry also fires a shockwave in front.
    const A = SG.aegis.wave;
    // The parry happens in step 7b, after player hits were resolved: the wave lives through the next tick's 7a, then goes.
    const x = b.x + b.facing * A.dx, y = b.y + A.dy;
    const g: HitGroup = {
      id: w.newId(), owner: 'player', kind: 'shot', rect: { x: x - A.w / 2, y: y - A.h / 2, w: A.w, h: A.h }, spec: SG.aegis.hit, active: true,
      lastHitTick: new Map(), hitCount: new Map(), attackInstance: w.combat.nextAttackInstance++, slot: sh.slot, dir: b.facing, kbFromX: x,
    };
    w.hitGroups.push(g);
    let age = 0;
    w.abilityEntities.push({ id: w.newId(), kind: 'aegis_wave', step: (ww) => {
      if (age++ < 1) return true;
      g.active = false;
      ww.hitGroups = ww.hitGroups.filter((q) => q !== g);
      return false;
    } });
  }
}

/**
 * A block (02 §12): the caller applies the damage; this ends the hit itself and applies the shove and hit-stop.
 * SPEC-GAP: the attacker's hit-stop stays the standard 0.075 s the hit resolver adds (02 §12 says 0.05 s), and a blocked hit's status effect still applies.
 */
export function blockEffects(w: GameWorld, src: Extract<HurtSource, { kind: 'enemyHit' }>): void {
  const b = w.body, stop = ticks(SHIELD.blockStopS);
  if (src.group) {
    markHit(src.group, 0, w.tick);
    if (!src.melee) { src.group.active = false; w.onEnemyShotLanded(src.group); }      // blocked projectiles are destroyed
  }
  const dir: 1 | -1 = b.x > src.attackerCx ? 1 : -1;
  b.vx = dir * SHIELD.blockKbVx;
  b.vy = 0;
  b.hitStopTicks = maxStop(b.hitStopTicks, stop);
  if (src.melee) {
    const owner = w.enemies.find((e) => e.id === src.enemyId);
    if (owner) owner.hitStopTicks = maxStop(owner.hitStopTicks, stop);
  }
}
