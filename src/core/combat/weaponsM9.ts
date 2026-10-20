// The weapon rules added in M9 part 2 (02 §10.5, §13): Twin Daggers backstab, Spear lunge, Scythe, Giant Axe spin,
// Flail pull, Hand Cannon recoil, Spell Tome rune ring, and their S-grade signatures.
import { enemyCenter, enemyHittable, type EnemyState } from '../enemies/enemy.ts';
import { startForcedMove } from '../player/forcedMove.ts';
import type { AbilityEntity } from '../abilities/entities.ts';
import type { InputState } from '../input.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { MOVE, TICK, ticks } from '../tuning.ts';
import { SIGNATURE as SG, WEAPON_SPECIAL as S } from '../../data/weapons.ts';
import { applyPull } from './enemyReactions.ts';
import { boxToWorld, type HitGroup, type Rect } from './hitGroups.ts';
import { addHitMod } from './hitMods.ts';
import { firePlayerProjectile, spawnBlast } from './playerProjectiles.ts';
import type { CurrentAttack } from './playerCombat.ts';
import { isS } from './signatures.ts';
import type { AttackStep, HitSpec, WeaponInstance } from './types.ts';

type Slot = 0 | 1;
const slotOf = (w: GameWorld, inst: WeaponInstance | null): Slot | null => (inst === null ? null : w.combat.slots[0] === inst ? 0 : w.combat.slots[1] === inst ? 1 : null);

// ---------------------------------------------------------------- Twin Daggers

const marks = new WeakMap<GameWorld, Map<number, number>>();           // Shadow Step: enemy id -> mark expires at this tick
const marksOf = (w: GameWorld): Map<number, number> => {
  let m = marks.get(w);
  if (!m) { m = new Map(); marks.set(w, m); }
  return m;
};

const isDaggerHit = (w: GameWorld, g: HitGroup): boolean => g.ability === undefined && g.slot !== undefined && w.combat.slots[g.slot]?.weaponId === 'twin_daggers';

/** 02 §10.5: the target faces away from the player (right-facing and the player is left of it, or the reverse). `noFacing` enemies never count. */
export function isBackstab(w: GameWorld, e: EnemyState): boolean {
  if (e.def.noFacing) return false;
  return (e.facing === 1 && w.body.x < e.x) || (e.facing === -1 && w.body.x > e.x);
}

/** 02 §13 Shadow Step: dashing through an enemy marks it (S Daggers only), 1.5 s. */
export function markShadowStep(w: GameWorld, e: EnemyState): void {
  if (!w.combat.slots.some((s) => isS(s, 'twin_daggers'))) return;
  marksOf(w).set(e.id, w.tick + ticks(SG.shadowStep.markS));
}
export const shadowMarked = (w: GameWorld, e: EnemyState): boolean => (marksOf(w).get(e.id) ?? -1) > w.tick;

addHitMod({
  crit: (w, g, e) => isDaggerHit(w, g) && (isBackstab(w, e) || shadowMarked(w, e)),
  afterHit: (w, g, e) => { if (isDaggerHit(w, g)) marksOf(w).delete(e.id); },       // the mark is used by the next Daggers hit
});

// ---------------------------------------------------------------- Spear lunge

/** 02 §10.5: the Spear button while dashing, or within 0.10 s after a dash, lunges instead of a combo step. */
export function lungeReady(w: GameWorld, slot: Slot): boolean {
  if (w.combat.slots[slot]?.weaponId !== 'spear') return false;
  return w.body.state === 'dash' || w.tick - w.lastDashEndTick <= ticks(S.spearLunge.afterTriggerS);
}

function startLunge(w: GameWorld, cur: CurrentAttack, st: AttackStep): void {
  const b = w.body, L = S.spearLunge, f = b.facing;
  startForcedMove(b, { vx: f * L.speed, vy: 0, durationS: L.moveS, gravity: false, endOnWall: true, endVelocity: 'keep', cancelByJump: true, cancelByDash: true }, 'weapon:spear');
  w.health.abilityIframeTicks = Math.max(w.health.abilityIframeTicks, ticks(L.moveS));          // invulnerable during the move
  const startX = b.x;
  const sweepRect = (ww: GameWorld): Rect => {
    const bb = ww.body, tip = boxToWorld(L.tip, bb.x, bb.y, bb.facing);
    const x0 = Math.min(startX, bb.x) - bb.w / 2, x1 = Math.max(startX, bb.x) + bb.w / 2;
    const y0 = Math.min(tip.y, bb.y - bb.h), y1 = Math.max(tip.y + tip.h, bb.y);
    const bx0 = Math.min(x0, tip.x), bx1 = Math.max(x1, tip.x + tip.w);
    return { x: bx0, y: y0, w: bx1 - bx0, h: y1 - y0 };
  };
  w.hitGroups.push({
    id: w.newId(), owner: 'player', kind: 'melee', rect: sweepRect(w), spec: st.hit!, active: true, lastHitTick: new Map(), hitCount: new Map(),
    attackInstance: cur.attackInstance, slot: cur.slot, noPlayerStop: true, follow: (ww, g) => { g.rect = sweepRect(ww); },
  });
}

// ---------------------------------------------------------------- Giant Axe spin

/** 02 §10.5: on the ground, a direction held and |vx| at least 50% of base run speed. */
export function spinReady(w: GameWorld, slot: Slot, input: InputState): boolean {
  const b = w.body;
  return w.combat.slots[slot]?.weaponId === 'giant_axe' && b.state === 'ground' && b.grounded
    && input.moveX !== 0 && Math.abs(b.vx) >= S.axeSpin.minVxFrac * MOVE.RUN_MAX;
}

// ---------------------------------------------------------------- Flail

/** The Flail release pulls small and medium enemies to 24 px in front of the player, then staggers them 0.6 s. */
function flailPull(w: GameWorld, _g: HitGroup, e: EnemyState, info: { killed: boolean }): void {
  if (info.killed) return;
  const b = w.body, F = S.flailPull;
  e.vx = 0; e.vy = 0;
  applyPull(w, e, { x: b.x + b.facing * F.dist, y: b.y - e.def.hurtbox.h / 2, speed: F.speed }, ticks(F.staggerS), 'stagger');
}

/** Called for every melee step group right after it is made (a place to attach weapon rules). */
export function decorateStepGroup(w: GameWorld, cur: CurrentAttack, g: HitGroup): void {
  const inst = w.combat.slots[cur.slot];
  if (!inst) return;
  if (inst.weaponId === 'flail' && cur.kind === 'charged') g.onHit = (ww, gg, e, info) => flailPull(ww, gg, e, info);
  if (inst.weaponId === 'giant_axe' && cur.kind === 'spin' && inst.grade === 'S') g.spec = { ...g.spec, maxHits: SG.cyclone.maxHits };
}

// ---------------------------------------------------------------- Spell Tome rune ring

interface RingEntity extends AbilityEntity { remove(): void }
interface RingState { slot: Slot; group: HitGroup; start: number; life: number; runes: number; radius: number }

/** Step 3 of the Tome: 4 runes (6 with Rune Storm) orbiting the player's center, one hit group, one ring at a time. */
function castRing(w: GameWorld, cur: CurrentAttack): void {
  const inst = w.combat.slots[cur.slot]!, storm = inst.grade === 'S';
  const R = S.runeRing;
  const ring: RingState = {
    slot: cur.slot, start: w.tick, group: undefined as unknown as HitGroup,
    life: ticks(storm ? SG.runeStorm.lifeS : R.lifeS), runes: storm ? SG.runeStorm.runes : R.runes, radius: storm ? SG.runeStorm.radius : R.radius,
  };
  for (const old of w.abilityEntities) if (old.kind === 'rune_ring') (old as RingEntity).remove();
  w.abilityEntities = w.abilityEntities.filter((e) => e.kind !== 'rune_ring');           // casting again replaces the ring
  const spec: HitSpec = { damage: 4, kb: [30, -10], poise: 3, hitStop: 0, kind: 'shot', multiHit: true, rehit: 0.25 };
  const runeRects = (ww: GameWorld): Rect[] => {
    const b = ww.body, t = (ww.tick - ring.start) * TICK;
    const spin = (R.degPerS * t * Math.PI) / 180;
    const out: Rect[] = [];
    for (let i = 0; i < ring.runes; i++) {
      const a = spin + (2 * Math.PI * i) / ring.runes;
      const cx = b.x + Math.cos(a) * ring.radius, cy = b.y + R.centerDy + Math.sin(a) * ring.radius;
      out.push({ x: cx - R.size / 2, y: cy - R.size / 2, w: R.size, h: R.size });
    }
    return out;
  };
  const bounds = (rs: Rect[]): Rect => {
    const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y));
    return { x: x0, y: y0, w: Math.max(...rs.map((r) => r.x + r.w)) - x0, h: Math.max(...rs.map((r) => r.y + r.h)) - y0 };
  };
  const rects = runeRects(w);
  const g: HitGroup = {
    id: w.newId(), owner: 'player', kind: 'shot', rect: bounds(rects), rects, spec, active: true, lastHitTick: new Map(), hitCount: new Map(),
    attackInstance: cur.attackInstance, slot: cur.slot,
  };
  ring.group = g;
  w.hitGroups.push(g);
  const drop = (ww: GameWorld) => { g.active = false; ww.hitGroups = ww.hitGroups.filter((x) => x !== g); };
  const entity: RingEntity = {
    id: w.newId(), kind: 'rune_ring',
    step: (ww) => {
      // It stays while the other weapon is used, and goes with the Tome leaving its slot or the player dying (02 §10.5).
      if (ww.combat.slots[ring.slot] !== inst || ww.health.dead || ww.tick - ring.start >= ring.life) { drop(ww); return false; }
      g.rects = runeRects(ww);
      g.rect = bounds(g.rects);
      return true;
    },
    remove: () => drop(w),
    view: () => ({ runes: g.rects, left: ring.life - (w.tick - ring.start), slot: ring.slot }),
  };
  w.abilityEntities.push(entity);
}

// ---------------------------------------------------------------- Scythe

/** 02 §7.3 / §10.5: kills where the Scythe is the killing source add +3.0% flask fill. */
export const scytheFillTenths = (e: EnemyState): number => (e.killedBy?.weaponId === 'scythe' ? S.scytheFlaskTenths : 0);

/** 02 §13 Soul Reap: each S Scythe kill releases a homing soul; with no enemy within 160 px it fades at once. */
export function onScytheKill(w: GameWorld, dead: EnemyState): void {
  const killer = dead.killedBy;
  if (!isS(killer, 'scythe')) return;
  const slot = slotOf(w, killer!);
  if (slot === null) return;
  const from = enemyCenter(dead), R = SG.soulReap.radius;
  let best: { x: number; y: number } | null = null, bestD = Infinity;
  for (const e of w.enemies) {
    if (e === dead || !enemyHittable(e)) continue;
    const c = enemyCenter(e), d = Math.hypot(c.x - from.x, c.y - from.y);
    if (d <= R && d < bestD) { best = c; bestD = d; }
  }
  if (!best) return;
  const speed = 300;
  firePlayerProjectile(w, slot, w.combat.nextAttackInstance++, 'soul', 0, {
    origin: { x: from.x, y: from.y }, velocity: { vx: ((best.x - from.x) / bestD) * speed, vy: ((best.y - from.y) / bestD) * speed },
  });
}

// ---------------------------------------------------------------- hooks used by weaponSpecials

/** A step's active phase starts (after projectiles were fired by the shared code). */
export function onActiveM9(w: GameWorld, cur: CurrentAttack, st: AttackStep): void {
  const inst = w.combat.slots[cur.slot]!, b = w.body;
  if (cur.kind === 'lunge') startLunge(w, cur, st);
  if (inst.weaponId === 'hand_cannon' && cur.kind === 'combo') {
    // Recoil: an impulse backwards (and up if airborne). Big Bore recoils harder.
    b.vx = -b.facing * (inst.grade === 'S' ? SG.bigBore.recoilVx : S.handCannonRecoil.vx);
    if (!b.grounded) b.vy = Math.min(b.vy, S.handCannonRecoil.vy);
  }
  if (inst.weaponId === 'spell_tome' && cur.kind === 'combo' && cur.step === 2) castRing(w, cur);
  if (inst.weaponId === 'flail' && cur.kind === 'charged' && inst.grade === 'S') {
    // Meteor: the release also explodes at the ball.
    const M = SG.meteor;
    spawnBlast(w, b.x + b.facing * M.box.dx, b.y + M.box.dy, M.blast, M.hit, cur.slot, cur.attackInstance, { dir: b.facing, kbFromX: b.x + b.facing * M.box.dx });
  }
}

/** A step's recovery starts. */
export function onRecoveryM9(w: GameWorld, cur: CurrentAttack): void {
  const inst = w.combat.slots[cur.slot], b = w.body;
  if (inst?.weaponId === 'spear' && cur.kind === 'lunge') {
    b.vx = b.facing * MOVE.RUN_MAX;                                  // after the move: vx = facing × base max run speed
    if (inst.grade === 'S') {
      // Skewer Wave: the lunge ends by firing a piercing shot from the tip.
      const tip = SG.skewerWave.tip;
      firePlayerProjectile(w, cur.slot, cur.attackInstance, 'skewer', 0, { origin: { x: b.x + b.facing * tip.dx, y: b.y + tip.dy } });
    }
  }
}

/** Per world tick: Giant Axe Cyclone pulls small and medium enemies in while the spin lasts. */
export function stepM9(w: GameWorld): void {
  const cur = w.combat.current;
  if (!cur || cur.kind !== 'spin' || cur.phase !== 'active') return;
  const inst = w.combat.slots[cur.slot];
  if (!isS(inst, 'giant_axe')) return;
  const b = w.body, C = SG.cyclone;
  for (const e of w.enemies) {
    if (!enemyHittable(e) || (e.def.size !== 'small' && e.def.size !== 'medium')) continue;
    const c = enemyCenter(e), d = Math.hypot(c.x - b.x, c.y - (b.y - b.h / 2));
    if (d > C.pullRadius || d < 2) continue;
    e.x += (b.x - c.x > 0 ? 1 : -1) * Math.min(C.pullSpeed * TICK, Math.abs(b.x - c.x));
  }
}
