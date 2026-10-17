// S-grade signature moves (02 §13) for the 8 built weapons. Their hits go through the normal pipeline
// (base × S 2.0 × match, the weapon's element) and belong to the attack instance that spawned them.
import type { EnemyState } from '../enemies/enemy.ts';
import { enemyCenter } from '../enemies/enemy.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { TICK, ticks } from '../tuning.ts';
import { SIGNATURE as SG } from '../../data/weapons.ts';
import { PLAYER_PROJECTILES } from '../../data/playerProjectiles.ts';
import type { HitGroup, Rect } from './hitGroups.ts';
import type { CurrentAttack } from './playerCombat.ts';
import { spawnBlast, type FireOpts } from './playerProjectiles.ts';
import type { HitSpec, WeaponDef, WeaponInstance } from './types.ts';

export const isS = (inst: WeaponInstance | null | undefined, id: string) => inst?.weaponId === id && inst.grade === 'S';

/** Katana Phantom Edge: charge time 0.25 s instead of the weapon's. */
export function chargeTimeOf(w: GameWorld, slot: 0 | 1, weapon: WeaponDef): number {
  return isS(w.combat.slots[slot], 'katana') ? SG.phantomEdge.chargeTime : weapon.chargeTime ?? 0;
}

function group(w: GameWorld, rect: Rect, spec: HitSpec, slot: 0 | 1, instance: number, extra: Partial<HitGroup> = {}): HitGroup {
  const g: HitGroup = {
    id: w.newId(), owner: 'player', kind: spec.kind, rect, spec, active: true, lastHitTick: new Map(), hitCount: new Map(),
    attackInstance: instance, slot, ...extra,
  };
  w.hitGroups.push(g);
  return g;
}

/** A box that slides along the floor (Ground Wave, Quake): stops at a wall, a ledge edge or its range. */
function floorWave(w: GameWorld, x: number, feet: number, dir: 1 | -1, size: { w: number; h: number }, speed: number, range: number,
  spec: HitSpec, slot: 0 | 1, instance: number): void {
  const g = group(w, { x: x - size.w / 2, y: feet - size.h, w: size.w, h: size.h }, spec, slot, instance, { dir, kbFromX: x - dir });
  let traveled = 0;
  w.abilityEntities.push({
    id: w.newId(), kind: 'signature_wave',
    step: (ww) => {
      const dx = speed * TICK;
      const front = g.rect.x + (dir > 0 ? g.rect.w + dx : -dx);
      const wall = ww.grid.isSolidPx(Math.floor(front), Math.floor(feet - 2));
      const ledge = !ww.grid.isSolidPx(Math.floor(front), Math.floor(feet + 1));
      traveled += dx;
      if (wall || ledge || traveled > range) { g.active = false; ww.hitGroups = ww.hitGroups.filter((x) => x !== g); return false; }
      g.rect = { ...g.rect, x: g.rect.x + dir * dx };
      return true;
    },
    view: () => ({ rect: g.rect, dir }),
  });
}

/** Called when a step's active phase starts (after the weapon's own special). */
export function signatureOnActive(w: GameWorld, cur: CurrentAttack): void {
  const inst = w.combat.slots[cur.slot], b = w.body, f = b.facing;
  if (!inst || inst.grade !== 'S' || cur.kind === 'throw') return;
  if (inst.weaponId === 'greatsword' && cur.kind === 'combo' && cur.step === 2) {
    floorWave(w, b.x + f * SG.groundWave.dx, b.y, f, SG.groundWave, SG.groundWave.speed, SG.groundWave.range, SG.groundWave.hit, cur.slot, cur.attackInstance);
  }
  if (inst.weaponId === 'war_maul' && cur.kind === 'combo' && cur.step === 1) {
    for (const d of [-1, 1] as const) floorWave(w, b.x, b.y, d, SG.quake, SG.quake.speed, SG.quake.range, SG.quake.hit, cur.slot, cur.attackInstance);
  }
  if (inst.weaponId === 'katana' && cur.kind === 'charged') watchPhantomPath(w, cur);
  if (inst.weaponId === 'iron_fists' && cur.kind === 'combo' && cur.step === 3) {
    const bx = SG.thunderclap.box;
    spawnBlast(w, b.x + f * bx.dx, b.y + bx.dy, { w: bx.w, h: bx.h }, SG.thunderclap.hit, cur.slot, cur.attackInstance, { dir: f });
  }
}

/** Katana Phantom Edge: 0.30 s after the dash-slash ends, its path detonates. The path group's last box is kept
 *  while it exists; when it goes, the detonation is scheduled. */
function watchPhantomPath(w: GameWorld, cur: CurrentAttack): void {
  const slot = cur.slot, instance = cur.attackInstance;
  let rect: Rect | null = null, at = -1;
  w.abilityEntities.push({
    id: w.newId(), kind: 'phantom_edge',
    step: (ww) => {
      const g = ww.hitGroups.find((x) => x.attackInstance === instance && x.slot === slot && x.owner === 'player' && x.active);
      if (at < 0) {
        if (g) { rect = { ...g.rect }; return true; }
        if (!rect) return false;
        at = ww.tick + ticks(SG.phantomEdge.delayS);
      }
      if (ww.tick < at) return true;
      // A new instance: the path's own group already hit these enemies once.
      spawnBlast(ww, rect!.x + rect!.w / 2, rect!.y + rect!.h / 2, { w: rect!.w, h: rect!.h }, SG.phantomEdge.hit, slot, ww.combat.nextAttackInstance++);
      return false;
    },
    view: () => ({ rect, at }),
  });
}

/** Kept for the recovery hook (nothing extra at recovery now: the path watcher schedules the detonation). */
export function signatureOnRecovery(_w: GameWorld, _cur: CurrentAttack): void {}

/** Projectile options for S weapons: Bow Triple Shot extra arrows, Crossbow Impaler pierce + pin blasts, Staff Singularity. */
export function signatureFire(w: GameWorld, cur: CurrentAttack, opts: FireOpts): { opts: FireOpts; extra: { angle: number; opts: FireOpts }[] } {
  const inst = w.combat.slots[cur.slot];
  if (!inst || inst.grade !== 'S') return { opts, extra: [] };
  if (inst.weaponId === 'bow' && cur.kind === 'charged') {
    const side: HitSpec = { ...PLAYER_PROJECTILES.arrow_charged!.hit, damage: SG.tripleShot.sideDamage };
    return { opts, extra: SG.tripleShot.angles.map((angle) => ({ angle, opts: { ...opts, spec: side } })) };
  }
  if (inst.weaponId === 'crossbow') {
    const slot = cur.slot;
    const onHit = opts.onHit;
    return { opts: { ...opts, pierce: SG.impaler.pierce - 1, onHit: (ww, g, e, info) => { onHit?.(ww, g, e, info); watchPin(ww, e, slot); } }, extra: [] };
  }
  if (inst.weaponId === 'staff' && cur.kind === 'charged') return { opts: { ...opts, singularity: true, blastMult: (opts.blastMult ?? 1) * SG.singularity.blast / 80 }, extra: [] };
  return { opts, extra: [] };
}

/** Impaler: when a Pin on this enemy ends, a 64 × 64 blast around it. */
function watchPin(w: GameWorld, e: EnemyState, slot: 0 | 1): void {
  if (e.control?.type !== 'pin') return;
  w.abilityEntities.push({
    id: w.newId(), kind: 'impaler_pin',
    step: (ww) => {
      if (e.control?.type === 'pin' && !e.dead) return true;
      const c = enemyCenter(e);
      spawnBlast(ww, c.x, c.y, SG.impaler.blast, SG.impaler.hit, slot, ww.combat.nextAttackInstance++);
      return false;
    },
  });
}

/** Per tick: Storm Hammer Tempest clouds and Staff Singularity pull. */
export function stepSignatures(w: GameWorld): void {
  const h = w.hammer;
  if (h && isS(w.combat.slots[h.slot], 'storm_hammer') && w.tick % ticks(SG.tempest.everyS) === 0) {
    const s = SG.tempest.size, g = group(w, { x: h.x - s / 2, y: h.y - s / 2, w: s, h: s }, SG.tempest.hit, h.slot, h.attackInstance);
    const end = w.tick + ticks(SG.tempest.lifeS);
    w.abilityEntities.push({ id: w.newId(), kind: 'tempest_cloud', step: (ww) => {
      if (ww.tick < end) return true;
      ww.hitGroups = ww.hitGroups.filter((x) => x !== g);
      return false;
    }, view: () => ({ rect: g.rect }) });
  }
  for (const p of w.playerProjectiles) {
    if (!p.opts.singularity) continue;
    for (const e of w.enemies) {
      if (e.dead || e.dormant || (e.def.size !== 'small' && e.def.size !== 'medium')) continue;
      const c = enemyCenter(e), d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d > SG.singularity.radius || d < 1) continue;
      e.x += ((p.x - c.x) / d) * SG.singularity.pull * TICK;
    }
  }
}
