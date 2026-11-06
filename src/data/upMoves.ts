// 02 §9.6a (M15, "Smash-style" moves): the Launcher, the up air attack and the dash attack (Rushing Strike), derived for
// every weapon from its step 1 and its weight, so no weapon needs its own table. Ranged weapons shoot straight up.
import type { AttackStep, Box, WeaponDef, Weight } from '../core/combat/types.ts';

type Row = { s: number; a: number; r: number; box?: Box; kb: [number, number]; stop: number };
export const LAUNCHER: Record<Weight, Row> = {
  light: { s: 0.10, a: 0.08, r: 0.22, box: { dx: 10, dy: -30, w: 30, h: 36 }, kb: [40, -380], stop: 0.05 },
  medium: { s: 0.14, a: 0.10, r: 0.26, box: { dx: 12, dy: -32, w: 36, h: 40 }, kb: [40, -380], stop: 0.05 },
  heavy: { s: 0.22, a: 0.12, r: 0.34, box: { dx: 14, dy: -34, w: 44, h: 44 }, kb: [40, -400], stop: 0.075 },
};
export const UP_AIR: Record<Weight, Row> = {
  light: { s: 0.08, a: 0.08, r: 0.18, box: { dx: 4, dy: -34, w: 30, h: 26 }, kb: [20, -300], stop: 0.05 },
  medium: { s: 0.10, a: 0.10, r: 0.22, box: { dx: 4, dy: -34, w: 30, h: 26 }, kb: [20, -300], stop: 0.05 },
  heavy: { s: 0.16, a: 0.12, r: 0.28, box: { dx: 4, dy: -36, w: 40, h: 30 }, kb: [20, -320], stop: 0.075 },
};
export const DASH_ATTACK: Record<Weight, Row> = {
  light: { s: 0.04, a: 0.10, r: 0.22, kb: [220, -60], stop: 0.05 },
  medium: { s: 0.04, a: 0.10, r: 0.26, kb: [220, -60], stop: 0.05 },
  heavy: { s: 0.06, a: 0.12, r: 0.32, kb: [260, -80], stop: 0.075 },
};
export const UP_MOVE = {
  /** Damage and poise multipliers of step 1. */
  launcher: { dmg: 1.2, poise: 1.5 }, upAir: { dmg: 1.0, poise: 1.0 }, dash: { dmg: 1.3, poise: 1.5, boxGrow: 8 },
  /** The up air attack's hop: vy = min(vy, −140) once per airtime. */
  hopVy: -140,
  /** Juggles (§9.6a.3): refresh vy, +0.10 per juggle in the additive pool, at most 4. */
  juggleVy: -160, juggleBonus: 0.10, juggleMax: 4,
  /** Dash attack trigger: during a dash or within 0.10 s after it (as the Spear lunge). */
  dashGraceS: 0.10,
  /** Ranged weapons shoot straight up from 0, −30; the Spell Tome's blast is placed at 0, −40. */
  upShotOrigin: { dx: 0, dy: -30 }, tomeUp: { dx: 0, dy: -40 },
} as const;
export type UpMoveKind = 'launcher' | 'upAir' | 'dashAtk';

const half = (n: number) => Math.floor(n + 0.5);
const RANGED = new Set(['bow', 'crossbow', 'hand_cannon', 'javelin', 'throwing_knives', 'staff', 'wand']);
export const isRangedWeapon = (w: WeaponDef): boolean => RANGED.has(w.id);
/** Weapons whose own dash move stays (02 §9.6a.4): the Spear lunge, the Shield. */
export const hasOwnDashMove = (w: WeaponDef): boolean => w.id === 'spear' || w.id === 'shield';

/** The derived step, or null when the weapon has no such move (ranged: no dash attack; Shield/Spear: no dash attack). */
export function upMoveStep(weapon: WeaponDef, kind: UpMoveKind): AttackStep | null {
  const s1 = weapon.combo[0];
  if (isRangedWeapon(weapon)) {
    if (kind === 'dashAtk' || !s1.projectiles) return null;
    return { ...s1, id: `${weapon.id}_up`, projectiles: s1.projectiles.slice(0, 1).map((p) => ({ ...p, angle: -90 })), shotOrigin: UP_MOVE.upShotOrigin };
  }
  if (kind === 'dashAtk' && hasOwnDashMove(weapon)) return null;
  if (!s1.box || !s1.hit) return null;
  if (weapon.id === 'spell_tome' && kind !== 'dashAtk') {
    const b = s1.box;
    return { ...s1, id: `spell_tome_${kind}`, box: { ...b, dx: UP_MOVE.tomeUp.dx, dy: UP_MOVE.tomeUp.dy } };
  }
  const row = (kind === 'launcher' ? LAUNCHER : kind === 'upAir' ? UP_AIR : DASH_ATTACK)[weapon.weight];
  const m = kind === 'launcher' ? UP_MOVE.launcher : kind === 'upAir' ? UP_MOVE.upAir : UP_MOVE.dash;
  const box = kind === 'dashAtk' ? { ...s1.box, w: s1.box.w + UP_MOVE.dash.boxGrow } : row.box!;
  const launch = kind !== 'dashAtk';
  return {
    id: `${weapon.id}_${kind === 'launcher' ? 'up' : kind === 'upAir' ? 'upair' : 'dash'}`, startup: row.s, active: row.a, recovery: row.r,
    moveMult: s1.moveMult, box,
    hit: { kind: 'melee', damage: half(s1.hit.damage * m.dmg), kb: row.kb, poise: half(s1.hit.poise * m.poise), hitStop: row.stop,
      heavy: weapon.weight === 'heavy' ? true : undefined, ...(launch ? { control: { type: 'launch' as const, duration: 0 } } : {}) },
  };
}
