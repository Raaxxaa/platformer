// Storm Hammer throw (02 §11): out at 520 px/s, back at 600 px/s through terrain, caught near the player.
import type { GameWorld } from '../sim/gameWorld.ts';
import { TICK, ticks } from '../tuning.ts';
import { PROJECTILE_SPAWN } from '../../data/playerProjectiles.ts';
import { WEAPON_SPECIAL } from '../../data/weapons.ts';
import { boxFree } from '../physics/collide.ts';
import { sweep, type HitGroup, type Rect } from './hitGroups.ts';
import type { CurrentAttack } from './playerCombat.ts';

const H = WEAPON_SPECIAL.hammerThrow;

export interface HammerState {
  slot: 0 | 1; x: number; y: number; vx: number; vy: number;
  phase: 'out' | 'back'; t: number;            // ticks in the current phase
  groupId: number; attackInstance: number;
  traveled: number;                            // the full path, out and back (Eagle Eye)
}

const rectAt = (x: number, y: number): Rect => ({ x: x - H.size / 2, y: y - H.size / 2, w: H.size, h: H.size });

export function hammerOutIn(w: GameWorld, slot: 0 | 1): boolean {
  return w.hammer?.slot === slot;
}

/** 02 §11 recharge: in hand, and ≥ 2.0 s since launch with a Wizard ability carried (checked every tick), else 5.0 s. */
export function throwReady(w: GameWorld, slot: 0 | 1): boolean {
  if (w.combat.slots[slot]?.weaponId !== 'storm_hammer' || hammerOutIn(w, slot)) return false;
  const need = ticks(w.classState.carriedClasses.includes('wizard') ? H.rechargeWizardS : H.rechargeS);
  return w.tick - w.hammerLaunchTick[slot] >= need;
}

function addGroup(w: GameWorld, h: HammerState): void {
  const g: HitGroup = {
    id: w.newId(), owner: 'player', kind: 'shot', rect: rectAt(h.x, h.y), spec: H.hit, active: true,
    lastHitTick: new Map(), hitCount: new Map(), attackInstance: h.attackInstance, slot: h.slot, dir: h.vx >= 0 ? 1 : -1,
  };
  h.groupId = g.id;
  w.hitGroups.push(g);
}

function removeGroup(w: GameWorld, id: number): void {
  w.hitGroups = w.hitGroups.filter((g) => g.id !== id);
}

/** The throw step's launch tick. */
export function launchHammer(w: GameWorld, cur: CurrentAttack): void {
  const b = w.body;
  const h: HammerState = {
    slot: cur.slot, x: b.x + b.facing * PROJECTILE_SPAWN.dx, y: b.y + PROJECTILE_SPAWN.dy, vx: b.facing * H.outSpeed, vy: 0,
    phase: 'out', t: 0, groupId: 0, attackInstance: cur.attackInstance, traveled: 0,
  };
  w.hammer = h;
  w.hammerLaunchTick[cur.slot] = w.tick;
  addGroup(w, h);
}

function startReturn(w: GameWorld, h: HammerState): void {
  removeGroup(w, h.groupId);
  h.phase = 'back';
  h.t = 0;
  addGroup(w, h);                                   // a new group: each enemy can be hit once more on the way back
}

/** Any press of its button while outbound starts the return; during the return it does nothing. */
export function recallHammer(w: GameWorld): void {
  if (w.hammer?.phase === 'out') startReturn(w, w.hammer);
}

/** Removes the flying hammer; the throw becomes ready (slot change, death, stage end). */
export function removeHammer(w: GameWorld, ready: boolean): void {
  const h = w.hammer;
  if (!h) return;
  removeGroup(w, h.groupId);
  if (ready) w.hammerLaunchTick[h.slot] = -100000;
  w.hammer = null;
}

/** Step 6 (not slowed by the player's hit-stop). */
export function stepHammer(w: GameWorld): void {
  const h = w.hammer;
  if (!h) return;
  if (w.combat.slots[h.slot]?.weaponId !== 'storm_hammer') { removeHammer(w, true); return; }
  const prev = rectAt(h.x, h.y);
  h.t += 1;
  if (h.phase === 'out') {
    const nx = h.x + h.vx * TICK;
    if (!boxFree(w.grid, nx, h.y + H.size / 2, H.size, H.size) || h.t > ticks(H.outTime)) { startReturn(w, h); }
    else h.x = nx;
  }
  if (h.phase === 'back') {
    const b = w.body;
    const tx = b.x, ty = b.y - 14;
    const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 1;
    h.vx = (dx / d) * H.backSpeed; h.vy = (dy / d) * H.backSpeed;
    h.x += h.vx * TICK; h.y += h.vy * TICK;
    const g = w.hitGroups.find((x) => x.id === h.groupId);
    if (g) g.dir = h.vx >= 0 ? 1 : -1;
    if (Math.hypot(tx - h.x, ty - h.y) <= H.catchDist || h.t >= ticks(H.autoCatchS)) { removeHammer(w, false); return; }
  }
  h.traveled += Math.hypot(h.x - (prev.x + H.size / 2), h.y - (prev.y + H.size / 2));
  const g = w.hitGroups.find((x) => x.id === h.groupId);
  if (g) { g.rect = sweep(prev, rectAt(h.x, h.y)); g.traveled = h.traveled; }
}
