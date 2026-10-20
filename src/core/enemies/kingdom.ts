// Stage 3 specials (04 §6, §11): Crossbowman aim lock, War Hound packs, Battle Mage Teleport, Black Knight Bulwark.
import { KINGDOM as K } from '../../data/kingdom.ts';
import { boxFree, isGrounded } from '../physics/collide.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { VIEW_H, VIEW_W, ticks } from '../tuning.ts';
import type { EnemyState } from './enemy.ts';
import { startEnemyAttack } from './attack.ts';

export interface KingdomState {
  /** Crossbowman: the aim point; it tracks the player, then locks (04 §6). */
  aim: { x: number; y: number } | null;
  /** Battle Mage Teleport: fading out (hittable), then fading in (cannot act). */
  fade: 'out' | 'in' | null;
  fadeTicks: number;
  /** Black Knight Bulwark: the stance starts on `bulwarkFrom` (the tick after the triggering hit). */
  bulwarkTicks: number;
  bulwarkFrom: number;
}

export function kingdomState(e: EnemyState): KingdomState {
  return e.kingdom ??= { aim: null, fade: null, fadeTicks: 0, bulwarkTicks: 0, bulwarkFrom: 0 };
}

/** Crossbowman: the aim line follows the player until the last 0.2 s of Tele, then stays locked. */
export function kingdomTeleTick(w: GameWorld, e: EnemyState): void {
  const a = e.ai.attack;
  if (e.def.id !== 'crossbowman' || a?.def.id !== 'bolt') return;
  const s = kingdomState(e);
  if (a.t <= 1 || a.len - a.t >= ticks(K.aimLockS)) s.aim = { x: w.body.x, y: w.body.y - w.body.h / 2 };
}

/** War Hounds sharing a `group` get `packIndex` 0, 1, 2 in spawn-id order; the band shifts 24 px each (04 §6). */
export function packIndex(w: GameWorld, e: EnemyState): number {
  const g = e.spawn.group;
  if (!g) return 0;
  return w.enemies.filter((o) => o.def.id === e.def.id && o.spawn.group === g && o.id < e.id).length;
}

export function preferredBand(w: GameWorld, e: EnemyState): [number, number] {
  const [min, max] = e.def.preferred;
  if (e.def.id !== 'war_hound') return [min, max];
  const i = packIndex(w, e) * K.packBandStep;
  return [min + i, max + i];
}

/** Black Knight phase-2 walk speed (84 px/s). */
export function bossSpeedMult(e: EnemyState): number {
  if (e.boss?.phase && e.def.boss?.speedMults) return e.def.boss.speedMults[e.boss.phase - 1] ?? 1;
  return e.boss?.enraged ? e.def.boss?.enragedSpeedMult ?? 1 : 1;
}

// SPEC-GAP: 04 §6 does not say which side of the player the Battle Mage teleports to (docs/SPEC-GAPS.md 31).
function teleportSpot(w: GameWorld, e: EnemyState): { x: number; y: number } | null {
  const own = e.x >= w.body.x ? 1 : -1;
  for (const side of [own, -own]) {
    const x = w.body.x + side * K.teleportDistance;
    for (let d = 0; d <= K.teleportGroundScan; d++) {
      const y = e.y + d, box = { x, y, w: e.def.hurtbox.w, h: e.def.hurtbox.h, remX: 0, remY: 0 };
      if (x - box.w / 2 < w.camera.x || x + box.w / 2 > w.camera.x + VIEW_W || y - box.h < w.camera.y || y > w.camera.y + VIEW_H) continue;
      if (boxFree(w.grid, x, y, box.w, box.h) && isGrounded(box, w.grid, 0)) return { x, y };
    }
  }
  return null;
}

/** Interruptions (stagger, control, freeze, knockback) cancel a pending Teleport and a Bulwark stance. */
export function cancelKingdomReaction(e: EnemyState): void {
  if (!e.kingdom) return;
  e.kingdom.fade = null; e.kingdom.fadeTicks = 0; e.kingdom.bulwarkTicks = 0;
}

/** Reactions run before attacks and ignore the attack gap (04 §2.6). True: the reaction owns this tick. */
export function stepKingdomReaction(w: GameWorld, e: EnemyState): boolean {
  if (e.def.id === 'battle_mage') return stepTeleport(w, e);
  if (e.def.id === 'black_knight') return stepBulwark(w, e);
  return false;
}

function stepTeleport(w: GameWorld, e: EnemyState): boolean {
  const s = kingdomState(e);
  if (s.fade) {
    e.vx = 0;
    if (--s.fadeTicks > 0) return true;
    if (s.fade === 'out') {
      const to = teleportSpot(w, e);
      if (to) { e.x = to.x; e.y = to.y; e.remX = e.remY = 0; e.grounded = true; }
      s.fade = 'in'; s.fadeTicks = ticks(K.teleportFadeInS);
      return true;
    }
    s.fade = null;
    return true;
  }
  if (!e.aware || e.ai.attack || (e.ai.cooldowns.get('teleport') ?? 0) > 0 || Math.abs(w.body.x - e.x) > K.teleportRange) return false;
  e.ai.cooldowns.set('teleport', ticks(K.teleportCooldownS));
  s.fade = 'out'; s.fadeTicks = ticks(K.teleportFadeOutS);
  e.vx = 0;
  return true;
}

export function bulwarkActive(w: GameWorld, e: EnemyState): boolean {
  const s = e.kingdom;
  return !!s && s.bulwarkTicks > 0 && w.tick >= s.bulwarkFrom;
}

/** A frontal player direct hit on a Black Knight that is in engage starts Bulwark from the next tick (04 §11). */
export function onKingdomDamaged(w: GameWorld, e: EnemyState): void {
  if (e.def.id !== 'black_knight' || e.dead || !e.boss || e.boss.introTicks > 0 || (e.boss.transitionTicks ?? 0) > 0) return;
  const s = kingdomState(e);
  if (s.bulwarkTicks > 0 || e.ai.state !== 'engage' || e.ai.attack || e.control) return;
  if (Math.sign(w.body.x - e.x) !== e.facing) return;      // SPEC-GAP: "frontal" is judged from where the player stands (docs/SPEC-GAPS.md 30)
  const phase = e.boss.enraged ? 2 : 1;
  if ((e.ai.cooldowns.get('bulwark') ?? 0) > 0) return;
  e.ai.cooldowns.set('bulwark', ticks(K.bulwarkCooldownS[phase]));
  s.bulwarkTicks = ticks(K.bulwarkS);
  s.bulwarkFrom = w.tick + 1;
}

function stepBulwark(w: GameWorld, e: EnemyState): boolean {
  const s = kingdomState(e);
  if (s.bulwarkTicks <= 0) return false;
  if (w.tick < s.bulwarkFrom) return false;
  e.vx = 0;                                          // facing stays locked: the AI (and facePlayer) does not run
  if (--s.bulwarkTicks > 0) return true;
  if (Math.abs(w.body.x - e.x) <= K.bulwarkBashRange) {
    e.ai.cooldowns.set('shield_bash', 0);
    startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'shield_bash')!);
  }
  return true;
}
