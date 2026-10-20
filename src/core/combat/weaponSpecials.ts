// Weapon specials (02 §10.5): projectile firing, the Katana dash-slash, the Iron Fists uppercut, the Crossbow pin,
// the Storm Hammer dive bolt. Called by playerCombat at phase changes.
import { enemyRect, type EnemyState } from '../enemies/enemy.ts';
import { setState } from '../player/body.ts';
import { startForcedMove } from '../player/forcedMove.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { MOVE, ticks, WEIGHT_MOVE_MULT } from '../tuning.ts';
import { WEAPON_SPECIAL } from '../../data/weapons.ts';
import { applyControl } from './enemyReactions.ts';
import type { HitGroup } from './hitGroups.ts';
import { firePlayerProjectile, spawnBlast, type FireOpts } from './playerProjectiles.ts';
import type { CurrentAttack } from './playerCombat.ts';
import { launchHammer } from './stormHammer.ts';
import { signatureFire, signatureOnActive, signatureOnRecovery } from './signatures.ts';
import type { AttackStep } from './types.ts';
import { onActiveM9, onRecoveryM9 } from './weaponsM9.ts';

export { decorateStepGroup, lungeReady, spinReady } from './weaponsM9.ts';

const S = WEAPON_SPECIAL;

/** The Storm Hammer throw step (02 §11): startup 0.10 s, the launch, recovery 0.20 s. */
export const HAMMER_THROW_STEP: AttackStep = {
  id: 'storm_hammer_throw', startup: S.hammerThrow.startup, active: 0, recovery: S.hammerThrow.recovery, moveMult: WEIGHT_MOVE_MULT.heavy,
};

/** Hooks other systems add to every weapon projectile (Warden, Arcane Archer...). */
type FireHook = (w: GameWorld, cur: CurrentAttack, weaponId: string, opts: FireOpts, projectile: string) => FireOpts;
const FIRE_HOOKS: FireHook[] = [];
export function addFireHook(h: FireHook): void {
  FIRE_HOOKS.push(h);
}

/** 02 §10.5 Crossbow: a bolt hit with a solid tile within 24 px behind the target pins it flush (not bosses). */
function crossbowPin(w: GameWorld, g: HitGroup, e: EnemyState): void {
  if (e.dead || e.def.boss) return;
  const dir = g.dir ?? w.body.facing;
  const r = enemyRect(e);
  const edge = dir > 0 ? r.x + r.w : r.x;
  for (let d = 0; d < S.crossbowPin.reach; d++) {
    const px = dir > 0 ? edge + d : edge - 1 - d;
    let solid = false;
    for (let y = r.y; y < r.y + r.h && !solid; y += 4) solid = w.grid.isSolidPx(px, y) || w.grid.isSolidPx(px, r.y + r.h - 1);
    if (!solid) continue;
    e.x += dir * d;                                   // flush against the wall face
    applyControl(w, e, 'pin', S.crossbowPin.seconds);
    return;
  }
}

/** The tick a step's active phase starts (projectile steps: the tick startup ends). */
export function onActiveStart(w: GameWorld, cur: CurrentAttack, st: AttackStep): void {
  const inst = w.combat.slots[cur.slot]!;
  const b = w.body;
  if (cur.kind === 'throw') { launchHammer(w, cur); return; }
  if (st.projectiles) {
    const base: FireOpts = { step: cur.kind === 'combo' ? cur.step : undefined };                                 // the instance's own bonus is added at hit time
    if (inst.weaponId === 'crossbow') base.onHit = (ww, g, e) => crossbowPin(ww, g, e);
    // Hooks run once per step (a Warden prime is used by every projectile of the step), then per projectile.
    for (const p of st.projectiles) {
      let opts: FireOpts = { ...base };
      for (const h of FIRE_HOOKS) opts = h(w, cur, inst.weaponId, opts, p.id);
      const sg = signatureFire(w, cur, opts, p);
      firePlayerProjectile(w, cur.slot, cur.attackInstance, p.id, p.angle, sg.opts);
      for (const x of sg.extra) firePlayerProjectile(w, cur.slot, cur.attackInstance, p.id, p.angle + x.angle, x.opts);
    }
  }
  if (inst.weaponId === 'katana' && cur.kind === 'charged') {
    // Dash-slash: 90 px in 0.15 s, gravity off, stops at walls, invulnerable; hits every enemy in the swept path once.
    const k = S.katanaSlash;
    startForcedMove(b, { vx: b.facing * k.speed, vy: 0, durationS: k.moveS, gravity: false, endOnWall: true, endVelocity: 'keep', cancelByJump: true, cancelByDash: true }, 'weapon:katana');
    w.health.abilityIframeTicks = Math.max(w.health.abilityIframeTicks, ticks(k.moveS));
    const startX = b.x;
    const g: HitGroup = {
      id: w.newId(), owner: 'player', kind: 'melee', rect: { x: b.x - b.w / 2, y: b.y - b.h / 2 - k.h / 2, w: b.w, h: k.h }, spec: st.hit!,
      active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: cur.attackInstance, slot: cur.slot, noPlayerStop: true,
      follow: (ww, gg) => {
        const bb = ww.body;
        const x0 = Math.min(startX, bb.x) - bb.w / 2, x1 = Math.max(startX, bb.x) + bb.w / 2;
        gg.rect = { x: x0, y: bb.y - bb.h / 2 - k.h / 2, w: x1 - x0, h: k.h };
      },
    };
    w.hitGroups.push(g);
  }
  if (inst.weaponId === 'iron_fists' && cur.kind === 'combo' && cur.step === 3 && !w.combat.uppercutUsed) {
    // Uppercut: vy = −300 on its first active tick, once per airtime.
    w.combat.uppercutUsed = true;
    b.vy = S.uppercutVy;
    b.grounded = false;
    if (b.state === 'ground' || b.state === 'crawl') setState(b, 'air', 0);
  }
  onActiveM9(w, cur, st);
  signatureOnActive(w, cur);
}

/** The tick a step's recovery starts. */
export function onRecoveryStart(w: GameWorld, cur: CurrentAttack): void {
  const inst = w.combat.slots[cur.slot];
  if (inst?.weaponId === 'katana' && cur.kind === 'charged') {
    const b = w.body;
    b.vy = 0;
    b.vx = b.facing * MOVE.RUN_MAX;                  // after the move: vx = facing × base max run speed
  }
  onRecoveryM9(w, cur);
  signatureOnRecovery(w, cur);
}

/** A cancel of the running step (nothing extra for now: groups go with the attack, the move with its own flags). */
export function endSpecial(_w: GameWorld, _cur: CurrentAttack): void {}

/** 02 §10.5 Storm Hammer dive: a lightning bolt 0.10 s after landing, `0,−80,32,160` from the landing feet. */
export function scheduleHammerDiveBolt(w: GameWorld, slot: 0 | 1, attackInstance: number): void {
  const H = S.hammerDiveBolt;
  const x = w.body.x, y = w.body.y;
  const at = w.tick + ticks(H.delayS);
  w.abilityEntities.push({
    id: w.newId(), kind: 'hammer_dive_bolt',
    step: (ww) => {
      if (ww.tick < at) return true;
      spawnBlast(ww, x + H.box.dx, y + H.box.dy, { w: H.box.w, h: H.box.h }, H.hit, slot, attackInstance);
      return false;
    },
    view: () => ({ x, y, at }),
  });
}
