// Player HP and the hurt pipeline (02 §5.1–5.2).
import { applyKnockback, setDead } from '../player/movement.ts';
import { COMBAT } from '../tuning.ts';
import { enemyHitDamage } from './damage.ts';
import { maxStop } from './hitStop.ts';
import { addRushValue } from './rush.ts';
import type { GameWorld } from '../sim/gameWorld.ts';

export interface PlayerHealth {
  hp: number; maxHp: number;
  iframeTicks: number;     // hurt i-frames left (wall ticks, counted from the hurt tick)
  hitstunTicks: number;    // hitstun left (pauses during the player's hit-stop)
  dead: boolean; deathCause: string | null;
}

export function createHealth(): PlayerHealth {
  return { hp: COMBAT.MAX_HP, maxHp: COMBAT.MAX_HP, iframeTicks: 0, hitstunTicks: 0, dead: false, deathCause: null };
}

export type HurtSource =
  | { kind: 'enemyHit'; enemyId: number; enemyDefId: string; damageA: number; attackerCx: number; melee: boolean; playerKb?: [number, number] }
  | { kind: 'hazard'; cause: 'spikes' | 'hazard'; damageA: number };

/** Hooks for later milestones (02 §5.2 steps 2–4, Second Wind). They never handle the hit in M2. */
const ripostes = (): boolean => false;
const parries = (): boolean => false;
const blocks = (): boolean => false;
const secondWind = (): boolean => false;

/**
 * 02 §5.2 for one enemy direct hit or hazard. Returns the damage dealt (0 = it did not land).
 * Spikes run steps 1, 5, 6, 8, 10; a level hazard 1, 5–10; an enemy hit 1–10.
 */
export function hurtPlayer(w: GameWorld, src: HurtSource): number {
  const h = w.health, b = w.body;
  if (h.dead) return 0;
  // 1. Invulnerability. Hazards only respect hurt i-frames.
  if (h.iframeTicks > 0) return 0;
  if (src.kind === 'enemyHit' && b.dashIframes) return 0;
  // 2–4. Riposte, parry, block: hooks.
  if (src.kind === 'enemyHit' && (ripostes() || parries() || blocks())) return 0;
  // 5. Damage.
  const dealt = enemyHitDamage(src.damageA, 1, null);
  h.hp -= dealt;
  // 6. Death.
  if (h.hp <= 0 && !secondWind()) {
    h.hp = 0;
    h.dead = true;
    h.deathCause = src.kind === 'enemyHit' ? src.enemyDefId : src.cause;
    setDead(b);
    w.onPlayerDied(h.deathCause);
    return dealt;
  }
  const spikes = src.kind === 'hazard' && src.cause === 'spikes';
  // 7. Hitstun and knockback (cancels the attack, drink and combo).
  if (!spikes) {
    w.onPlayerHitstun();
    let kbx: number = COMBAT.HURT_KB_X, kby: number = COMBAT.HURT_KB_Y;
    let dir: 1 | -1 = (-b.facing) as 1 | -1;
    if (src.kind === 'enemyHit') {
      if (src.playerKb) [kbx, kby] = src.playerKb;
      if (b.x !== src.attackerCx) dir = b.x > src.attackerCx ? 1 : -1;
    }
    applyKnockback(b, dir * kbx, kby, COMBAT.HITSTUN_TICKS, w.mods);
    h.hitstunTicks = COMBAT.HITSTUN_TICKS;
  }
  // 8. I-frames from this tick.
  h.iframeTicks = COMBAT.HURT_IFRAMES_TICKS;
  // 9. Hit-stop for the player (and a melee attacker: done by the caller).
  if (!spikes) b.hitStopTicks = maxStop(b.hitStopTicks, COMBAT.HURT_HIT_STOP_TICKS);
  // 10. Rush −75.
  addRushValue(w.rush, COMBAT.RUSH_HURT);
  return dealt;
}
